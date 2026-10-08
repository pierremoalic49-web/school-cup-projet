// Tests de la logique du tournoi. Lancer avec : npm test
import { describe, expect, it } from 'vitest'
import { buildBracket, matchMinute, minuteLabel, winnerOf } from './bracket'
import { uuid } from './safe'
import type { Match, Team } from './types'

const teams = (n: number): Team[] =>
  Array.from({ length: n }, (_, i) => ({ id: `t${i}`, tournamentId: 'g', name: `Équipe ${i}`, short: `E${i}`, classe: '', color1: '#fff', color2: '#000', captainId: null }))

describe('construction du tableau', () => {
  for (let n = 2; n <= 16; n++) {
    it(`fonctionne avec ${n} équipes`, () => {
      const ms = buildBracket('g', teams(n))
      let size = 2
      while (size < n) size *= 2
      // Un tableau à élimination directe a toujours (places - 1) matchs.
      expect(ms).toHaveLength(size - 1)
      // Chaque équipe est placée une seule fois au premier tour.
      const first = ms.filter((m) => m.round === 0)
      const placed = first.flatMap((m) => [m.teamAId, m.teamBId]).filter(Boolean)
      expect(new Set(placed).size).toBe(n)
      // Tous les matchs sauf la finale mènent à un match suivant qui existe.
      const final = ms.filter((m) => !m.nextMatchId)
      expect(final).toHaveLength(1)
      for (const m of ms) if (m.nextMatchId) expect(ms.some((x) => x.id === m.nextMatchId)).toBe(true)
      // Pas de match « vide contre vide » au premier tour.
      for (const m of first) expect(m.teamAId || m.teamBId).toBeTruthy()
      // Les équipes exemptées sont déjà qualifiées pour le tour suivant.
      const byes = first.filter((m) => !m.teamAId || !m.teamBId)
      expect(byes).toHaveLength(size - n)
      for (const b of byes) {
        expect(b.status).toBe('finished')
        const next = ms.find((x) => x.id === b.nextMatchId)!
        expect([next.teamAId, next.teamBId]).toContain(b.teamAId ?? b.teamBId)
      }
    })
  }
})

describe('vainqueur', () => {
  const base = buildBracket('g', teams(2))[0]
  const m = (p: Partial<Match>): Match => ({ ...base, status: 'finished', ...p })
  it('le plus de buts gagne', () => {
    expect(winnerOf(m({ scoreA: 2, scoreB: 1 }))).toBe(base.teamAId)
    expect(winnerOf(m({ scoreA: 0, scoreB: 3 }))).toBe(base.teamBId)
  })
  it('égalité : les tirs au but départagent', () => {
    expect(winnerOf(m({ scoreA: 1, scoreB: 1, penA: 3, penB: 4 }))).toBe(base.teamBId)
  })
  it('égalité sans tirs au but : pas de vainqueur', () => {
    expect(winnerOf(m({ scoreA: 1, scoreB: 1 }))).toBeNull()
    expect(winnerOf(m({ scoreA: 1, scoreB: 1, penA: 2, penB: 2 }))).toBeNull()
  })
  it('un match pas terminé n’a pas de vainqueur', () => {
    expect(winnerOf({ ...base, status: 'live', scoreA: 5 })).toBeNull()
  })
})

describe('minute de jeu', () => {
  const base = buildBracket('g', teams(2))[0]
  const start = new Date('2027-05-20T14:00:00Z').getTime()
  const live = (period: 1 | 2): Match => ({ ...base, status: 'live', period, periodStartedAt: new Date(start).toISOString() })
  it('compte les minutes et le temps additionnel', () => {
    expect(minuteLabel(live(1), 10, start + 30_000)).toBe("1'")
    expect(minuteLabel(live(1), 10, start + 4.5 * 60_000)).toBe("5'")
    expect(minuteLabel(live(2), 10, start + 3 * 60_000)).toBe("14'")
    expect(minuteLabel(live(1), 10, start + 11.2 * 60_000)).toBe("10'+2")
    expect(matchMinute(live(1), 10, start + 30 * 60_000)).toBe(10)
  })
  it('horloge du téléphone en retard : jamais de minute négative', () => {
    expect(minuteLabel(live(1), 10, start - 5 * 60_000)).toBe("1'")
  })
})

describe('identifiants', () => {
  it('sont au format UUID attendu par Supabase', () => {
    for (let i = 0; i < 50; i++) expect(uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})
