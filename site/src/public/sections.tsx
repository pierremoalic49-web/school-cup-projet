// Les sections du site public : direct, tableau, buteurs, équipes, infos.
// Elles lisent les données du store et se mettent à jour toutes seules.
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import {
  featuredMatch,
  goalsOfMatch,
  isLive,
  matchTitle,
  minuteLabel,
  playerName,
  roundName,
  roundsOf,
  scorers,
  statusLabel,
  winnerOf,
  type ScorerRow,
} from '../data/bracket'
import type { DB, Match, Team, TournamentId } from '../data/types'
import { Crest } from '../ui/Crest'
import { Calendar, Chat, Clock, Info, Pin, Silhouette, Trophy, Whistle } from '../ui/Icons'

/** Renvoie l'heure actuelle, rafraîchie régulièrement (pour faire avancer la minute de jeu). */
export function useNow(ms = 15000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

const teamOf = (db: DB, id: string | null) => (id ? db.teams.find((t) => t.id === id) ?? null : null)
const tournamentLabel = (t: TournamentId) => (t === 'g' ? 'Tournoi garçons' : 'Tournoi filles')

/* ------------------------------- Bandeau ------------------------------- */

export function Ticker({ db }: { db: DB }) {
  const items: { text: string; live?: boolean }[] = []
  for (const m of db.matches.filter(isLive)) {
    const a = teamOf(db, m.teamAId)
    const b = teamOf(db, m.teamBId)
    items.push({ text: `Direct · ${matchTitle(db, m)} : ${a?.name} ${m.scoreA}-${m.scoreB} ${b?.name}`, live: true })
  }
  const done = db.matches.filter((m) => m.status === 'finished' && m.teamAId && m.teamBId).slice(-3)
  for (const m of done) {
    const w = teamOf(db, winnerOf(m))
    if (w) items.push({ text: `${w.name} qualifiée${m.nextMatchId ? '' : ' : championne de la School Cup'}` })
  }
  const next = db.matches.find((m) => m.status === 'upcoming' && m.teamAId && m.teamBId)
  if (next) {
    const a = teamOf(db, next.teamAId)
    const b = teamOf(db, next.teamBId)
    items.push({ text: `À suivre · ${a?.name} contre ${b?.name}${next.kickoff ? ` à ${next.kickoff}` : ''}, ${next.field}` })
  }
  for (const t of ['g', 'f'] as const) {
    const top = scorers(db, t)[0]
    if (top) items.push({ text: `${playerName(top.player)} : ${top.goals} but${top.goals > 1 ? 's' : ''}, en tête des buteurs ${t === 'g' ? 'garçons' : 'filles'}` })
  }
  if (!items.length) items.push({ text: `${db.settings.name} · ${db.settings.school} · ${db.settings.city}` })
  // Le message est écrit deux fois à la suite pour que le défilement boucle sans saut.
  const row = (copy: string) =>
    items.map((it, i) => (
      <span key={copy + i} className={`tk${it.live ? ' is-live' : ''}`}>
        {it.live && <span className="dot" />}
        {it.text}
      </span>
    ))
  return (
    <div className="ticker" aria-label="Fil d'actualité du tournoi">
      <div className="ticker-track">
        {row('a')}
        <span aria-hidden="true" style={{ display: 'contents' }}>
          {row('b')}
        </span>
      </div>
    </div>
  )
}

/* -------------------------------- Direct -------------------------------- */

function ScoreNum({ value }: { value: number }) {
  const prev = useRef(value)
  const [bump, setBump] = useState(false)
  useEffect(() => {
    if (value > prev.current) {
      setBump(true)
      const id = setTimeout(() => setBump(false), 900)
      prev.current = value
      return () => clearTimeout(id)
    }
    prev.current = value
  }, [value])
  return <span className={bump ? 'bump' : ''}>{value}</span>
}

export function MatchCard({ db, m, now }: { db: DB; m: Match; now: number }) {
  const a = teamOf(db, m.teamAId)
  const b = teamOf(db, m.teamBId)
  const live = isLive(m)
  const minute = minuteLabel(m, db.settings.halfLength, now)
  const goals = goalsOfMatch(db, m.id)
  const pName = (id: string | null) => {
    const p = id ? db.players.find((x) => x.id === id) : null
    return p ? playerName(p) : 'But contre son camp'
  }
  const played = m.status !== 'upcoming'
  return (
    <article className={`glass live t-${m.tournamentId}`} aria-label={`${matchTitle(db, m)}, ${a?.name ?? 'à définir'} contre ${b?.name ?? 'à définir'}`}>
      <div className="live-meta">
        {live ? (
          <span className="on">
            <span className="dot" />
            En direct
          </span>
        ) : m.status === 'finished' ? (
          <span>Terminé</span>
        ) : (
          <span className="soon">Prochain match</span>
        )}
        <span>
          {matchTitle(db, m)} · {tournamentLabel(m.tournamentId)}
        </span>
      </div>
      <div className="score-row">
        <div className="team">
          <Crest team={a} />
          <p className="team-name">{a?.name ?? 'À définir'}</p>
        </div>
        <div className="score" aria-live="polite" aria-atomic="true">
          {played ? (
            <>
              <ScoreNum value={m.scoreA} />
              <span className="sep" aria-label="à">
                —
              </span>
              <ScoreNum value={m.scoreB} />
            </>
          ) : (
            <span className="vs">{m.kickoff ?? 'VS'}</span>
          )}
        </div>
        <div className="team right">
          <p className="team-name">{b?.name ?? 'À définir'}</p>
          <Crest team={b} />
        </div>
      </div>
      {m.penA != null && m.penB != null && (
        <p className="pens">
          Tirs au but&nbsp;: {m.penA} – {m.penB}
        </p>
      )}
      <p className="minute">
        {m.status === 'live' && minute != null ? (
          <>
            <b>{minute}</b> · {statusLabel(m)} · {m.field}
          </>
        ) : (
          <>
            {statusLabel(m)} · {m.field}
          </>
        )}
      </p>
      {goals.length > 0 && (
        <ul className="goals-list" aria-label="Buts du match">
          {goals.map((g) => (
            <li key={g.id} className={g.teamId === m.teamAId ? 'a' : 'b'}>
              <span className="min">{g.minute}&rsquo;</span>
              <span>{pName(g.playerId)}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

export function LiveSection({ db }: { db: DB }) {
  const now = useNow()
  const live = db.matches.filter(isLive)
  const featured = live.length ? live : [featuredMatch(db)].filter((m): m is Match => !!m)
  const champions = (['g', 'f'] as const)
    .map((t) => {
      const final = db.matches.find((m) => m.tournamentId === t && !m.nextMatchId && m.status === 'finished')
      return final ? { t, team: teamOf(db, winnerOf(final)) } : null
    })
    .filter(Boolean)
  return (
    <section className="section wrap" id="direct" aria-labelledby="direct-title">
      <div className="sec-head">
        <h2 id="direct-title">En direct</h2>
        <p>Le score bouge dès qu&rsquo;un organisateur valide un but. Pas besoin de recharger la page.</p>
      </div>
      <div className="lives">
        {champions.map((c) => (
          <div className="glass champion" key={c!.t}>
            <Trophy size={52} style={{ color: 'var(--gold)' }} />
            <p className="eyebrow" style={{ margin: '10px 0 0', justifyContent: 'center' }}>
              Champion · {tournamentLabel(c!.t)}
            </p>
            <h3>{c!.team?.name}</h3>
          </div>
        ))}
        {featured.map((m) => (
          <MatchCard key={m.id} db={db} m={m} now={now} />
        ))}
        {!featured.length && !champions.length && (
          <div className="glass empty">
            <strong>Pas encore de match</strong>
            Le tableau sera publié quelques jours avant le tournoi.
          </div>
        )}
      </div>
    </section>
  )
}

/* -------------------------------- Tableau -------------------------------- */

function TeamRow({ team, score, pen, state }: { team: Team | null; score: string; pen: number | null; state: string }) {
  return (
    <div className={`mrow ${state}${team ? '' : ' tbd'}`}>
      <span className="nm">
        {team && <span className="swatch" style={{ background: team.color1 }} />}
        <span>{team?.name ?? 'À définir'}</span>
      </span>
      <span className="s">
        {score}
        {pen != null && <small>({pen})</small>}
      </span>
    </div>
  )
}

export function BracketSection({ db }: { db: DB }) {
  const liveT = db.matches.find(isLive)?.tournamentId
  const [t, setT] = useState<TournamentId>(liveT ?? 'g')
  const rounds = roundsOf(db, t)
  return (
    <section className="section wrap" id="tableau" aria-labelledby="tableau-title">
      <div className="sec-head">
        <h2 id="tableau-title">Le tableau</h2>
        <div className="tabs" role="tablist" aria-label="Choisir le tournoi">
          {(['g', 'f'] as const).map((id) => (
            <button key={id} role="tab" className="tab" data-t={id} aria-selected={t === id} onClick={() => setT(id)}>
              Jour {id === 'g' ? 1 : 2} · {id === 'g' ? 'Garçons' : 'Filles'}
            </button>
          ))}
        </div>
      </div>
      <div className="glass bracket-wrap" role="tabpanel" tabIndex={0} aria-label={`Tableau du ${tournamentLabel(t).toLowerCase()}`}>
        {rounds.length === 0 ? (
          <div className="empty">
            <strong>Tableau à venir</strong>
            Les équipes du {tournamentLabel(t).toLowerCase()} n&rsquo;ont pas encore été tirées au sort.
          </div>
        ) : (
          <div className="bracket">
            {rounds.map((ms, r) => {
              const isFinal = r === rounds.length - 1
              const champ = isFinal ? teamOf(db, winnerOf(ms[0])) : null
              return (
                <div className="round" key={r}>
                  <p className="round-title">
                    {roundName(ms.length)}
                    {isFinal && ms[0].kickoff ? ` · ${ms[0].kickoff}` : ''}
                  </p>
                  <div className="round-matches">
                    {ms.map((m) => {
                      const a = teamOf(db, m.teamAId)
                      const b = teamOf(db, m.teamBId)
                      const w = winnerOf(m)
                      const bye = m.status === 'finished' && (!m.teamAId || !m.teamBId)
                      const played = m.status !== 'upcoming' && !bye
                      const st = (id: string | null) => (w ? (w === id ? 'win' : 'lose') : '')
                      return (
                        <div key={m.id} className={`match${isLive(m) ? ' is-live' : ''}${isFinal ? ' is-final' : ''}`}>
                          <TeamRow team={a} score={played ? String(m.scoreA) : bye && a ? 'Qualifiée' : '–'} pen={m.penA} state={st(m.teamAId)} />
                          <TeamRow team={b} score={played ? String(m.scoreB) : bye && b ? 'Qualifiée' : '–'} pen={m.penB} state={st(m.teamBId)} />
                          <div className="mtag">
                            <span>
                              {isLive(m) ? (
                                <span className="l">
                                  <span className="dot" />
                                  {statusLabel(m)}
                                </span>
                              ) : bye ? (
                                'Exemptée'
                              ) : (
                                statusLabel(m)
                              )}
                            </span>
                            <span>{m.field}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {isFinal && (
                    <div className="trophy">
                      <Trophy size={58} />
                      {champ ? (
                        <>
                          <p>Champion</p>
                          <strong>{champ.name}</strong>
                        </>
                      ) : (
                        <p>La School Cup attend son champion</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

/* -------------------------------- Buteurs -------------------------------- */

function PlayerCard({ row, rank, highlight }: { row: ScorerRow; rank: number; highlight: boolean }) {
  const { player: p, team, goals, matches } = row
  const ref = useRef<HTMLDivElement>(null)
  const showPhoto = p.consent && !!p.photoUrl
  // La carte s'incline vers la souris, avec un reflet qui la suit.
  const move = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    ref.current.style.setProperty('--ry', `${(x - 0.5) * 16}deg`)
    ref.current.style.setProperty('--rx', `${(0.5 - y) * 12}deg`)
    ref.current.style.setProperty('--mx', `${x * 100}%`)
    ref.current.style.setProperty('--my', `${y * 100}%`)
  }
  const leave = () => {
    ref.current?.style.setProperty('--ry', '0deg')
    ref.current?.style.setProperty('--rx', '0deg')
  }
  return (
    <article className={`pcard${rank === 1 ? ' top' : ''}${highlight ? ' updated' : ''}`} onPointerMove={move} onPointerLeave={leave}>
      <div className="pcard-in" ref={ref}>
        <div className="shine" />
        <div className="pc-top">
          <div>
            <p className="pc-rating" style={{ color: rank === 1 ? undefined : team.color1 }}>
              {p.rating}
            </p>
            <p className="pc-pos">{p.position}</p>
          </div>
          <p className="pc-goals">
            {goals}
            <small>but{goals > 1 ? 's' : ''}</small>
          </p>
        </div>
        <div className="pc-photo" style={{ color: team.color1 }}>
          <span className="pc-rank">#{rank}</span>
          {showPhoto ? <img src={p.photoUrl!} alt={`Photo de ${playerName(p)}`} loading="lazy" /> : <Silhouette />}
          {!showPhoto && <span className="tag">Photo à venir</span>}
        </div>
        <h3 className="pc-name">{playerName(p)}</h3>
        <p className="pc-team">{team.name}</p>
        <div className="pc-stats">
          <div>
            <b>{matches}</b>
            <span>MATCHS</span>
          </div>
          <div>
            <b>{goals}</b>
            <span>BUTS</span>
          </div>
          <div>
            <b>{(goals / matches).toFixed(1).replace('.', ',')}</b>
            <span>BUTS/M</span>
          </div>
        </div>
      </div>
    </article>
  )
}

export function ScorersSection({ db, lastScorer }: { db: DB; lastScorer: string | null }) {
  const [t, setT] = useState<TournamentId | 'all'>('g')
  const rows = scorers(db, t)
  const top = rows.slice(0, 8)
  const rest = rows.slice(8, 20)
  return (
    <section className="section wrap" id="buteurs" aria-labelledby="buteurs-title">
      <div className="sec-head">
        <h2 id="buteurs-title">Meilleurs buteurs</h2>
        <div className="tabs" role="tablist" aria-label="Choisir le classement">
          {(
            [
              ['g', 'Garçons'],
              ['f', 'Filles'],
              ['all', 'Général'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} role="tab" className="tab" data-t={id} aria-selected={t === id} onClick={() => setT(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {top.length === 0 ? (
        <div className="glass empty">
          <strong>Aucun but pour l&rsquo;instant</strong>
          Le premier buteur aura sa carte ici dès que son but sera validé.
        </div>
      ) : (
        <div className="cards">
          {top.map((r, i) => (
            <PlayerCard key={r.player.id} row={r} rank={i + 1} highlight={lastScorer === r.player.id} />
          ))}
        </div>
      )}
      {rest.length > 0 && (
        <div className="glass rank-table">
          {rest.map((r, i) => (
            <div className="rank-row" key={r.player.id}>
              <span className="r">{i + 9}</span>
              <span>
                {playerName(r.player)} <span className="t">· {r.team.name}</span>
              </span>
              <span className="t">{r.matches} m.</span>
              <span className="g">{r.goals}</span>
            </div>
          ))}
        </div>
      )}
      <p className="note">Classement calculé automatiquement à partir des buts validés. Les photos n&rsquo;apparaissent qu&rsquo;avec l&rsquo;autorisation de droit à l&rsquo;image signée par les parents.</p>
    </section>
  )
}

/* -------------------------------- Équipes -------------------------------- */

export function TeamsSection({ db }: { db: DB }) {
  const [t, setT] = useState<TournamentId>('g')
  const teams = db.teams.filter((x) => x.tournamentId === t).sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  const eliminated = (id: string) => db.matches.some((m) => m.status === 'finished' && (m.teamAId === id || m.teamBId === id) && winnerOf(m) && winnerOf(m) !== id)
  const order = { GB: 0, DEF: 1, MIL: 2, ATT: 3 }
  return (
    <section className="section wrap" id="equipes" aria-labelledby="equipes-title">
      <div className="sec-head">
        <h2 id="equipes-title">Les équipes</h2>
        <div className="tabs" role="tablist" aria-label="Choisir le tournoi">
          {(['g', 'f'] as const).map((id) => (
            <button key={id} role="tab" className="tab" data-t={id} aria-selected={t === id} onClick={() => setT(id)}>
              {id === 'g' ? 'Garçons' : 'Filles'}
            </button>
          ))}
        </div>
      </div>
      {teams.length === 0 ? (
        <div className="glass empty">
          <strong>Équipes à venir</strong>
          Les organisateurs ajoutent les équipes au fil des inscriptions.
        </div>
      ) : (
        <div className="teams">
          {teams.map((team) => {
            const out = eliminated(team.id)
            const players = db.players.filter((p) => p.teamId === team.id).sort((a, b) => order[a.position] - order[b.position])
            return (
              <article key={team.id} className={`glass team-card${out ? ' out' : ''}`} style={{ ['--c1' as string]: team.color1 }}>
                <div className="hd">
                  <Crest team={team} />
                  <div>
                    <h3>{team.name}</h3>
                    <p className="sub">
                      {players.length} joueur{players.length > 1 ? 's' : ''}
                      {out ? ' · éliminée' : ''}
                    </p>
                  </div>
                </div>
                <ul>
                  {players.map((p) => (
                    <li key={p.id}>
                      <span>
                        {playerName(p)}
                        {team.captainId === p.id && (
                          <span className="cap" title="Capitaine" aria-label="capitaine">
                            C
                          </span>
                        )}
                      </span>
                      <span className="p">{p.position}</span>
                    </li>
                  ))}
                </ul>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

/* --------------------------------- Infos --------------------------------- */

export function InfoSection({ db }: { db: DB }) {
  const s = db.settings
  const rules = s.rules.split('\n').filter(Boolean)
  return (
    <section className="section wrap" id="infos" aria-labelledby="infos-title">
      <div className="sec-head">
        <h2 id="infos-title">Infos pratiques</h2>
      </div>
      <div className="info">
        <div className="glass">
          <h3>
            <Calendar /> Quand
          </h3>
          <p>
            {s.dates}
            {'\n'}Jour&nbsp;1&nbsp;: tournoi garçons. Jour&nbsp;2&nbsp;: tournoi filles.
          </p>
        </div>
        <div className="glass">
          <h3>
            <Pin /> Où
          </h3>
          <p>{s.place}</p>
        </div>
        <div className="glass">
          <h3>
            <Clock /> Horaires
          </h3>
          <p>{s.schedule}</p>
        </div>
        <div className="glass">
          <h3>
            <Whistle /> Règlement
          </h3>
          <ul>
            {rules.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
            <li>Matchs de 2 × {s.halfLength} minutes.</li>
          </ul>
        </div>
        <div className="glass">
          <h3>
            <Chat /> Contact
          </h3>
          <p>{s.contact}</p>
        </div>
        {s.demo && (
          <div className="glass">
            <h3>
              <Info /> Données d&rsquo;exemple
            </h3>
            <p>Les équipes, joueurs et scores affichés sont des exemples pour présenter le site. Ils seront remplacés par les vrais avant le tournoi.</p>
          </div>
        )}
      </div>
    </section>
  )
}
