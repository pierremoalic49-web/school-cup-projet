// Onglet « Direct » : l'écran du bord du terrain. Choisir le match, lancer le chrono,
// valider un but en deux touches, annuler, gérer la mi-temps, les tirs au but et la fin du match.
import { useEffect, useState } from 'react'
import { goalsOfMatch, isLive, matchMinute, matchTitle, minuteLabel, playerName, statusLabel, winnerOf } from '../data/bracket'
import { storeGet, storeSet } from '../data/safe'
import { actions } from '../data/store'
import type { DB, Match, Team } from '../data/types'
import { Crest, shade } from '../ui/Crest'
import { Minus, Plus, Undo, Whistle } from '../ui/Icons'
import { useNow } from '../public/sections'
import { useUi } from './Admin'

const label = (t: 'g' | 'f') => (t === 'g' ? 'Garçons' : 'Filles')

export default function LiveTab({ db }: { db: DB }) {
  const ui = useUi()
  const now = useNow(10000)
  const teamOf = (id: string | null) => (id ? db.teams.find((t) => t.id === id) ?? null : null)
  // Matchs jouables : en cours d'abord, puis à venir avec deux équipes connues, puis terminés.
  const order = (m: Match) => (isLive(m) ? 0 : m.status === 'upcoming' ? 1 : 2)
  const candidates = db.matches
    .filter((m) => m.teamAId && m.teamBId)
    .sort((a, b) => order(a) - order(b) || a.tournamentId.localeCompare(b.tournamentId) || a.round - b.round || a.order - b.order)
  const [selId, setSelId] = useState<string | null>(() => storeGet('session', 'schoolcup-live-match'))
  const sel = candidates.find((m) => m.id === selId) ?? candidates[0] ?? null
  useEffect(() => {
    if (sel) storeSet('session', 'schoolcup-live-match', sel.id)
  }, [sel])
  const [picking, setPicking] = useState<Team | null>(null)
  const [choose, setChoose] = useState(false)

  if (!sel) {
    return (
      <>
        <h2>Direct</h2>
        <div className="card">
          <p style={{ margin: 0 }}>
            <b>Aucun match à jouer pour l&rsquo;instant.</b>
          </p>
          <p className="muted">Ajoute les équipes, puis génère le tableau dans l&rsquo;onglet Matchs.</p>
        </div>
      </>
    )
  }

  const a = teamOf(sel.teamAId)!
  const b = teamOf(sel.teamBId)!
  const goals = goalsOfMatch(db, sel.id)
  const minute = matchMinute(sel, db.settings.halfLength, now) ?? 1
  const shown = minuteLabel(sel, db.settings.halfLength, now)
  const draw = sel.scoreA === sel.scoreB

  const scoreGoal = async (team: Team, playerId: string | null) => {
    setPicking(null)
    const who = playerId ? db.players.find((p) => p.id === playerId) : null
    let goalId = ''
    const ok = await ui.run(async () => {
      goalId = await actions.addGoal(sel.id, team.id, playerId, minute)
    })
    if (ok)
      ui.toast(`But de ${who ? playerName(who) : team.name} validé`, {
        action: { label: 'Annuler', run: () => ui.run(() => actions.undoLastGoal(sel.id, goalId), 'But annulé') },
      })
  }

  const undo = async () => {
    const last = [...goals].sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0]
    if (!last) return
    const p = last.playerId ? db.players.find((x) => x.id === last.playerId) : null
    if (await ui.confirm('Annuler le dernier but ?', `${p ? playerName(p) : 'But'} (${last.minute}') sera retiré et le score corrigé.`, 'Annuler le but', true))
      await ui.run(() => actions.undoLastGoal(sel.id), 'Dernier but annulé')
  }

  const finish = async () => {
    if (draw && (sel.penA == null || sel.penB == null || sel.penA === sel.penB)) {
      ui.toast('Égalité : saisis les tirs au but (et un vainqueur) avant de terminer.', { bad: true })
      return
    }
    const w = winnerOf({ ...sel, status: 'finished' })
    const wName = teamOf(w)?.name
    if (await ui.confirm('Terminer le match ?', `${wName} sera qualifiée pour le tour suivant.`, 'Terminer'))
      await ui.run(() => actions.finishMatch(sel.id), 'Match terminé, vainqueur qualifié')
  }

  return (
    <>
      <h2>Direct</h2>
      <button type="button" className="match-opt" aria-pressed="true" onClick={() => setChoose(true)}>
        <span>
          {a.name} – {b.name}
          <small>
            {matchTitle(db, sel)} · {label(sel.tournamentId)} · {sel.field}
          </small>
        </span>
        <span className="chip">Changer</span>
      </button>

      <div className="card board" style={{ marginTop: 12 }}>
        <div className="board-meta">
          <span className={`chip${isLive(sel) ? ' live' : sel.status === 'finished' ? ' ok' : ''}`}>{statusLabel(sel)}</span>
          {sel.status === 'live' && shown && <span className="board-min">{shown}</span>}
        </div>
        <div className="board-score">
          <div className="board-team">
            <Crest team={a} />
            {a.name}
          </div>
          <div className="board-num" aria-live="polite">
            {sel.scoreA}
            <span className="sep">–</span>
            {sel.scoreB}
          </div>
          <div className="board-team">
            <Crest team={b} />
            {b.name}
          </div>
        </div>
        {sel.penA != null && sel.penB != null && (
          <p className="muted" style={{ margin: 0 }}>
            Tirs au but : {sel.penA} – {sel.penB}
          </p>
        )}

        {sel.status !== 'finished' && (
          <div className="goal-btns">
            {[a, b].map((t) => (
              <button
                key={t.id}
                type="button"
                className="goal-btn"
                disabled={sel.status === 'upcoming'}
                style={{ background: `linear-gradient(160deg, ${t.color1}, ${shade(t.color1, -0.3)})`, color: t.color2 }}
                onClick={() => setPicking(t)}
              >
                But
                <small>{t.name}</small>
              </button>
            ))}
          </div>
        )}

        <div className="actions">
          {sel.status === 'upcoming' && (
            <button type="button" className="b b-live b-block" onClick={() => ui.run(() => actions.startPeriod(sel.id, 1), 'Coup d’envoi ! Le match est en direct.')}>
              <Whistle /> Coup d&rsquo;envoi
            </button>
          )}
          {sel.status === 'live' && sel.period === 1 && (
            <button type="button" className="b b-line" onClick={() => ui.run(() => actions.updateMatch(sel.id, { status: 'halftime' }), 'Mi-temps')}>
              <Whistle /> Mi-temps
            </button>
          )}
          {sel.status === 'halftime' && (
            <button type="button" className="b b-live" onClick={() => ui.run(() => actions.startPeriod(sel.id, 2), '2e mi-temps lancée')}>
              <Whistle /> Reprise 2e mi-temps
            </button>
          )}
          {isLive(sel) && (
            <button type="button" className="b b-gold" onClick={finish}>
              Fin du match
            </button>
          )}
          {goals.length > 0 && sel.status !== 'finished' && (
            <button type="button" className="b b-line" onClick={undo}>
              <Undo /> Annuler le dernier but
            </button>
          )}
          {sel.status === 'finished' && (
            <button
              type="button"
              className="b b-line"
              onClick={async () => {
                if (await ui.confirm('Rouvrir ce match ?', 'À utiliser seulement pour corriger une erreur. Le vainqueur sera retiré du tour suivant s’il n’a pas encore joué.', 'Rouvrir', true))
                  await ui.run(() => actions.reopenMatch(sel.id), 'Match rouvert')
              }}
            >
              Rouvrir le match
            </button>
          )}
        </div>

        {isLive(sel) && draw && (
          <div style={{ marginTop: 18, textAlign: 'left' }}>
            <h3 style={{ marginTop: 0 }}>Tirs au but</h3>
            <p className="muted" style={{ marginTop: 0 }}>
              Égalité : saisis le résultat de la séance avant de terminer le match.
            </p>
            {(['A', 'B'] as const).map((slot) => {
              const t = slot === 'A' ? a : b
              const v = (slot === 'A' ? sel.penA : sel.penB) ?? 0
              const key = slot === 'A' ? 'penA' : 'penB'
              return (
                <div className="corr" key={slot}>
                  <span>{t.name}</span>
                  <div className="stepper">
                    <button type="button" aria-label={`Retirer un tir au but réussi à ${t.name}`} onClick={() => ui.run(() => actions.updateMatch(sel.id, { [key]: Math.max(0, v - 1) }))}>
                      <Minus />
                    </button>
                    <output>{v}</output>
                    <button type="button" aria-label={`Ajouter un tir au but réussi à ${t.name}`} onClick={() => ui.run(() => actions.updateMatch(sel.id, { [key]: v + 1, ...(slot === 'A' ? { penB: sel.penB ?? 0 } : { penA: sel.penA ?? 0 }) }))}>
                      <Plus />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {goals.length > 0 && (
        <>
          <h3>Buts du match</h3>
          <div className="list">
            {goals.map((g) => {
              const p = g.playerId ? db.players.find((x) => x.id === g.playerId) : null
              const t = teamOf(g.teamId)
              return (
                <div key={g.id} className="item" style={{ cursor: 'default' }}>
                  <span className="board-min" style={{ minWidth: 44 }}>
                    {g.minute}&rsquo;
                  </span>
                  <span className="grow">
                    <b>{p ? playerName(p) : 'But contre son camp'}</b>
                    <small>{t?.name}</small>
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}

      <details className="more">
        <summary>Corriger le score à la main</summary>
        <div className="card">
          <p className="muted" style={{ marginTop: 0 }}>
            Change le score sans ajouter de but ni de buteur (et sans célébration). Pour un but normal, utilise les gros boutons.
          </p>
          {(['A', 'B'] as const).map((slot) => {
            const t = slot === 'A' ? a : b
            const v = slot === 'A' ? sel.scoreA : sel.scoreB
            const key = slot === 'A' ? 'scoreA' : 'scoreB'
            return (
              <div className="corr" key={slot}>
                <span>{t.name}</span>
                <div className="stepper">
                  <button type="button" aria-label={`Retirer un but à ${t.name}`} onClick={() => ui.run(() => actions.updateMatch(sel.id, { [key]: Math.max(0, v - 1) }))}>
                    <Minus />
                  </button>
                  <output>{v}</output>
                  <button type="button" aria-label={`Ajouter un but à ${t.name}`} onClick={() => ui.run(() => actions.updateMatch(sel.id, { [key]: v + 1 }))}>
                    <Plus />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </details>

      {picking && (
        <div className="sheet-bg" onClick={() => setPicking(null)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="pick-t" onClick={(e) => e.stopPropagation()}>
            <h2 id="pick-t">But pour {picking.name}</h2>
            <p className="muted" style={{ marginTop: -6 }}>
              Qui a marqué ? ({minute}&rsquo;)
            </p>
            <div className="list">
              {db.players
                .filter((p) => p.teamId === picking.id)
                .map((p) => (
                  <button key={p.id} type="button" className="item" onClick={() => scoreGoal(picking, p.id)}>
                    <span className="grow">
                      <b>{playerName(p)}</b>
                      <small>{p.position}</small>
                    </span>
                    <span className="chip warn">But</span>
                  </button>
                ))}
              <button type="button" className="item" onClick={() => scoreGoal(picking, null)}>
                <span className="grow">
                  <b>But contre son camp ou buteur inconnu</b>
                  <small>Le score change, aucun buteur n&rsquo;est crédité</small>
                </span>
              </button>
            </div>
            <div className="actions">
              <button type="button" className="b b-line" onClick={() => setPicking(null)}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {choose && (
        <div className="sheet-bg" onClick={() => setChoose(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="ch-t" onClick={(e) => e.stopPropagation()}>
            <h2 id="ch-t">Choisir le match</h2>
            <div className="match-pick">
              {candidates.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="match-opt"
                  aria-pressed={m.id === sel.id}
                  onClick={() => {
                    setSelId(m.id)
                    setChoose(false)
                  }}
                >
                  <span>
                    {teamOf(m.teamAId)?.name} – {teamOf(m.teamBId)?.name}
                    <small>
                      {matchTitle(db, m)} · {label(m.tournamentId)} {m.kickoff ? `· ${m.kickoff}` : ''}
                    </small>
                  </span>
                  <span className={`chip${isLive(m) ? ' live' : m.status === 'finished' ? ' ok' : ''}`}>
                    {m.status === 'finished' ? `${m.scoreA}-${m.scoreB}` : isLive(m) ? 'Direct' : 'À venir'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
