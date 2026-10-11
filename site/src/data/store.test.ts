// Tests d'un tournoi complet, comme le jour J : on crée les équipes, le tableau, on marque,
// on annule, on va aux tirs au but, et on vérifie que le champion est le bon.
import { beforeAll, describe, expect, it } from 'vitest'
import { roundsOf, scorers, winnerOf } from './bracket'
import { actions, getDB, initStore, onGoal } from './store'

const db = () => getDB()!

beforeAll(async () => {
  await initStore()
})

describe('un tournoi de A à Z (mode local)', () => {
  it('démarre avec les données d’exemple, marquées comme telles', () => {
    expect(db().settings.demo).toBe(true)
    expect(db().teams.length).toBeGreaterThan(0)
  })

  it('« Tout effacer » vide tout mais garde les réglages', async () => {
    await actions.clearAll()
    expect(db().teams).toHaveLength(0)
    expect(db().matches).toHaveLength(0)
    expect(db().goals).toHaveLength(0)
    expect(db().settings.demo).toBe(false)
    expect(db().settings.school).toContain('Sacré-Cœur')
  })

  it('crée 5 équipes avec 2 joueurs chacune et le tableau', async () => {
    for (let i = 0; i < 5; i++) {
      const t = { ...actions.newTeam('g'), name: `Classe ${i}`, short: `C${i}` }
      await actions.saveTeam(t)
      for (const name of ['Alex', 'Sam']) await actions.savePlayer({ ...actions.newPlayer(t.id), firstName: name, lastInitial: 'B' })
    }
    await actions.generateBracket('g', db().teams)
    // 5 équipes → tableau à 8 places : 7 matchs, 3 équipes exemptées du premier tour.
    expect(db().matches).toHaveLength(7)
    expect(roundsOf(db(), 'g')).toHaveLength(3)
  })

  it('un but met le score à jour et déclenche la célébration', async () => {
    const m = db().matches.find((x) => x.round === 0 && x.teamAId && x.teamBId)!
    await actions.startPeriod(m.id, 1)
    const fired: string[] = []
    const off = onGoal((g) => fired.push(g.id))
    const scorer = db().players.find((p) => p.teamId === m.teamAId)!
    const goalId = await actions.addGoal(m.id, m.teamAId!, scorer.id, 3)
    off()
    const after = db().matches.find((x) => x.id === m.id)!
    expect(after.scoreA).toBe(1)
    expect(fired).toEqual([goalId])
    expect(scorers(db(), 'g')[0].player.id).toBe(scorer.id)
  })

  it('« Annuler » retire précisément le bon but', async () => {
    const m = db().matches.find((x) => x.status === 'live')!
    const keep = await actions.addGoal(m.id, m.teamBId!, null, 5)
    const remove = await actions.addGoal(m.id, m.teamAId!, null, 6)
    await actions.undoLastGoal(m.id, remove)
    const after = db().matches.find((x) => x.id === m.id)!
    expect(db().goals.some((g) => g.id === keep)).toBe(true)
    expect(db().goals.some((g) => g.id === remove)).toBe(false)
    expect([after.scoreA, after.scoreB]).toEqual([1, 1])
  })

  it('refuse de finir un match nul sans tirs au but', async () => {
    const m = db().matches.find((x) => x.status === 'live')!
    await expect(actions.finishMatch(m.id)).rejects.toThrow(/tirs au but/)
  })

  it('tirs au but puis qualification automatique', async () => {
    const m = db().matches.find((x) => x.status === 'live')!
    await actions.updateMatch(m.id, { penA: 4, penB: 2 })
    await actions.finishMatch(m.id)
    const next = db().matches.find((x) => x.id === m.nextMatchId)!
    expect([next.teamAId, next.teamBId]).toContain(m.teamAId)
    // Modifier la mi-temps ne doit jamais écraser le score.
    expect(db().matches.find((x) => x.id === m.id)!.scoreA).toBe(1)
  })

  it('rouvrir un match retire le qualifié du tour suivant', async () => {
    const m = db().matches.find((x) => x.status === 'finished' && x.teamAId && x.teamBId)!
    await actions.reopenMatch(m.id)
    const next = db().matches.find((x) => x.id === m.nextMatchId)!
    expect([next.teamAId, next.teamBId]).not.toContain(m.teamAId)
    await actions.finishMatch(m.id)
  })

  it('on joue tout le tableau jusqu’au champion', async () => {
    for (let guard = 0; guard < 10; guard++) {
      const m = db().matches.find((x) => x.status !== 'finished' && x.teamAId && x.teamBId)
      if (!m) break
      await actions.startPeriod(m.id, 1)
      await actions.addGoal(m.id, m.teamBId!, null, 2)
      await actions.finishMatch(m.id)
    }
    const final = db().matches.find((x) => !x.nextMatchId)!
    expect(final.status).toBe('finished')
    expect(winnerOf(final)).toBeTruthy()
  })

  it('supprimer une équipe supprime aussi ses joueurs', async () => {
    const t = db().teams[0]
    await actions.deleteTeam(t.id)
    expect(db().players.some((p) => p.teamId === t.id)).toBe(false)
  })

  it('pas de photo sans autorisation droit à l’image', async () => {
    const p = db().players[0]
    await actions.savePlayer({ ...p, consent: false, photoUrl: 'data:image/jpeg;base64,xxx' })
    expect(db().players.find((x) => x.id === p.id)!.photoUrl).toBeNull()
    await expect(actions.uploadPhoto({ ...p, consent: false }, new Blob(['x']))).rejects.toThrow(/autorisation/)
  })
})
