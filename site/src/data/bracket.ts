// Toute la « logique de tournoi » : construire le tableau, savoir qui gagne, calculer la minute,
// classer les buteurs. Ces fonctions ne touchent pas à la base : elles calculent, c'est tout.
import { uuid } from './safe'
import type { DB, Goal, Match, Player, Team, TournamentId } from './types'

export const uid = uuid

/** Nom d'un tour selon le nombre de matchs qu'il contient. */
export function roundName(matchesInRound: number): string {
  if (matchesInRound === 1) return 'Finale'
  if (matchesInRound === 2) return 'Demi-finales'
  if (matchesInRound === 4) return 'Quarts de finale'
  if (matchesInRound === 8) return 'Huitièmes de finale'
  return `Tour à ${matchesInRound * 2}`
}

/** Ordre de placement des têtes de série (1 contre le dernier, etc.) pour 2, 4, 8, 16 places. */
function seedOrder(size: number): number[] {
  let order = [0]
  while (order.length < size) {
    const n = order.length * 2
    order = order.flatMap((s) => [s, n - 1 - s])
  }
  return order
}

/**
 * Construit un tableau à élimination directe à partir d'une liste d'équipes (de 2 à 16).
 * S'il manque des équipes pour arriver à 4, 8 ou 16, certaines sont « exemptées » du premier tour
 * et passent directement au tour suivant.
 */
export function buildBracket(tournamentId: TournamentId, teams: Team[], field = 'Terrain 1'): Match[] {
  const n = teams.length
  if (n < 2) return []
  let size = 2
  while (size < n) size *= 2
  const rounds = Math.log2(size)
  const matches: Match[][] = []
  for (let r = 0; r < rounds; r++) {
    const count = size / 2 ** (r + 1)
    matches.push(
      Array.from({ length: count }, (_, i) => ({
        id: uid(),
        tournamentId,
        round: r,
        order: i,
        teamAId: null,
        teamBId: null,
        scoreA: 0,
        scoreB: 0,
        penA: null,
        penB: null,
        status: 'upcoming' as const,
        kickoff: null,
        period: 1 as const,
        periodStartedAt: null,
        field,
        nextMatchId: null,
        nextSlot: null,
      })),
    )
  }
  // On relie chaque match au match suivant.
  for (let r = 0; r < rounds - 1; r++) {
    matches[r].forEach((m, i) => {
      m.nextMatchId = matches[r + 1][Math.floor(i / 2)].id
      m.nextSlot = i % 2 === 0 ? 'A' : 'B'
    })
  }
  // On place les équipes : les places vides (exemptions) affrontent les premières équipes.
  const order = seedOrder(size)
  matches[0].forEach((m, i) => {
    const a = order[i * 2]
    const b = order[i * 2 + 1]
    m.teamAId = teams[a]?.id ?? null
    m.teamBId = teams[b]?.id ?? null
  })
  const all = matches.flat()
  // Les exemptions : le match est « terminé » d'office et l'équipe avance.
  for (const m of matches[0]) {
    if ((m.teamAId && !m.teamBId) || (!m.teamAId && m.teamBId)) {
      m.status = 'finished'
      advanceWinner(all, m)
    }
  }
  return all
}

/** Renvoie l'id de l'équipe gagnante d'un match terminé (tirs au but compris), sinon null. */
export function winnerOf(m: Match): string | null {
  if (m.status !== 'finished') return null
  if (m.teamAId && !m.teamBId) return m.teamAId
  if (!m.teamAId && m.teamBId) return m.teamBId
  if (m.scoreA > m.scoreB) return m.teamAId
  if (m.scoreB > m.scoreA) return m.teamBId
  if (m.penA != null && m.penB != null && m.penA !== m.penB) return m.penA > m.penB ? m.teamAId : m.teamBId
  return null
}

/** Place le vainqueur d'un match dans le match suivant. Modifie la liste et renvoie le match suivant modifié. */
export function advanceWinner(matches: Match[], m: Match): Match | null {
  if (!m.nextMatchId || !m.nextSlot) return null
  const next = matches.find((x) => x.id === m.nextMatchId)
  if (!next) return null
  const w = winnerOf(m)
  if (m.nextSlot === 'A') next.teamAId = w
  else next.teamBId = w
  return next
}

/** Minute de jeu (calculée depuis le début de la mi-temps), plafonnée à la fin de la mi-temps. */
export function matchMinute(m: Match, halfLength: number, now = Date.now()): number | null {
  if (m.status === 'halftime') return halfLength
  if (m.status !== 'live' || !m.periodStartedAt) return null
  const elapsed = Math.floor((now - new Date(m.periodStartedAt).getTime()) / 60000)
  const base = (m.period - 1) * halfLength
  return Math.max(1, base + Math.min(elapsed + 1, halfLength))
}

/** Minute affichée façon télé : « 14' », ou « 20'+2 » pendant le temps additionnel. */
export function minuteLabel(m: Match, halfLength: number, now = Date.now()): string | null {
  if (m.status === 'halftime') return 'Mi-temps'
  if (m.status !== 'live' || !m.periodStartedAt) return null
  const elapsed = Math.floor((now - new Date(m.periodStartedAt).getTime()) / 60000)
  const base = (m.period - 1) * halfLength
  if (elapsed < halfLength) return `${base + Math.max(0, elapsed) + 1}'`
  return `${base + halfLength}'+${Math.min(9, elapsed - halfLength + 1)}`
}

export function statusLabel(m: Match): string {
  switch (m.status) {
    case 'live':
      return m.period === 1 ? '1re mi-temps' : '2e mi-temps'
    case 'halftime':
      return 'Mi-temps'
    case 'finished':
      return 'Terminé'
    default:
      return m.kickoff ? `Coup d'envoi ${m.kickoff}` : 'À venir'
  }
}

export const isLive = (m: Match) => m.status === 'live' || m.status === 'halftime'

export function roundsOf(db: DB, t: TournamentId): Match[][] {
  const ms = db.matches.filter((m) => m.tournamentId === t)
  const max = ms.reduce((a, m) => Math.max(a, m.round), -1)
  const out: Match[][] = []
  for (let r = 0; r <= max; r++) out.push(ms.filter((m) => m.round === r).sort((a, b) => a.order - b.order))
  return out
}

export function matchTitle(db: DB, m: Match): string {
  const rounds = roundsOf(db, m.tournamentId)
  const count = rounds[m.round]?.length ?? 1
  const singular: Record<number, string> = { 2: 'Demi-finale', 4: 'Quart de finale', 8: 'Huitième de finale' }
  if (count === 1) return 'Finale'
  return `${singular[count] ?? roundName(count)} ${m.order + 1}`
}

export const playerName = (p: Player) => `${p.firstName} ${p.lastInitial}.`

export interface ScorerRow {
  player: Player
  team: Team
  goals: number
  matches: number
}

/** Classement des buteurs, calculé à partir des buts (jamais saisi à la main). */
export function scorers(db: DB, t: TournamentId | 'all'): ScorerRow[] {
  const teamById = new Map(db.teams.map((x) => [x.id, x]))
  const counts = new Map<string, number>()
  for (const g of db.goals) if (g.playerId) counts.set(g.playerId, (counts.get(g.playerId) ?? 0) + 1)
  const played = (teamId: string) =>
    db.matches.filter((m) => (m.teamAId === teamId || m.teamBId === teamId) && m.teamAId && m.teamBId && m.status !== 'upcoming').length
  const rows: ScorerRow[] = []
  for (const p of db.players) {
    const team = teamById.get(p.teamId)
    if (!team) continue
    if (t !== 'all' && team.tournamentId !== t) continue
    const goals = counts.get(p.id) ?? 0
    if (goals === 0) continue
    rows.push({ player: p, team, goals, matches: Math.max(1, played(team.id)) })
  }
  return rows.sort((a, b) => b.goals - a.goals || a.matches - b.matches || b.player.rating - a.player.rating)
}

export function goalsOfMatch(db: DB, matchId: string): Goal[] {
  return db.goals.filter((g) => g.matchId === matchId).sort((a, b) => a.minute - b.minute || a.createdAt.localeCompare(b.createdAt))
}

/** Le match à mettre en avant : un match en cours, sinon le prochain, sinon le dernier joué. */
export function featuredMatch(db: DB): Match | null {
  const live = db.matches.filter(isLive)
  if (live.length) return live[0]
  const tOrder = (m: Match) => (m.tournamentId === 'g' ? 0 : 1)
  const playable = db.matches
    .filter((m) => m.status === 'upcoming' && m.teamAId && m.teamBId)
    .sort((a, b) => tOrder(a) - tOrder(b) || a.round - b.round || a.order - b.order)
  if (playable.length) return playable[0]
  const done = db.matches.filter((m) => m.status === 'finished' && m.teamAId && m.teamBId)
  return done.sort((a, b) => tOrder(b) - tOrder(a) || b.round - a.round)[0] ?? null
}
