// DONNÉES D'EXEMPLE. Elles servent à voir le site « vivant » avant le tournoi.
// Le site affiche clairement « Données d'exemple » tant que settings.demo = true.
// Dans l'admin, le bouton « Repartir de zéro » les efface.
import { advanceWinner, buildBracket, uid } from './bracket'
import type { DB, Goal, Player, Position, Settings, Team, TournamentId } from './types'

export const defaultSettings: Settings = {
  name: 'School Cup',
  school: 'Lycée Sacré-Cœur La Salle',
  city: 'Angers',
  dates: 'Dates à confirmer',
  place: 'Lieu à confirmer',
  schedule: 'Premiers matchs vers 9 h, finale en fin d’après-midi.',
  rules:
    'Élimination directe : le perdant sort.\nÉgalité à la fin du match : tirs au but.\nRespect de l’arbitre, des adversaires et du public.\nCrampons moulés ou baskets, protège-tibias conseillés.',
  contact: 'Les organisateurs, au CDI ou à la vie scolaire.',
  halfLength: 10,
  demo: true,
}

type TeamSeed = [name: string, short: string, c1: string, c2: string]

const boys: TeamSeed[] = [
  ['Terminale STMG', 'TS', '#FFC63D', '#1A1200'],
  ['Seconde 3', 'S3', '#3FE3FF', '#03202B'],
  ['Seconde 7', 'S7', '#E8E8F0', '#16182A'],
  ['Terminale Générale', 'TG', '#8A6BFF', '#120A33'],
  ['Terminale A', 'TA', '#4FD18B', '#062615'],
  ['Première STMG', 'PS', '#FF8A3D', '#2A1000'],
  ['Première B', '1B', '#FF5C6C', '#2A0509'],
  ['Seconde 5', 'S5', '#5C8BFF', '#08143A'],
]
const girls: TeamSeed[] = [
  ['Terminale Générale', 'TG', '#FF6FB0', '#2A0418'],
  ['Seconde 2', 'S2', '#3FE3FF', '#03202B'],
  ['Première STMG', 'PS', '#FFC63D', '#1A1200'],
  ['Seconde 6', 'S6', '#B8F05A', '#1A2600'],
  ['Terminale A', 'TA', '#E8E8F0', '#16182A'],
  ['Première B', '1B', '#FF8A3D', '#2A1000'],
  ['Terminale STMG', 'TS', '#8A6BFF', '#120A33'],
  ['Seconde 4', 'S4', '#4FD18B', '#062615'],
]

const boyNames = ['Théo', 'Yanis', 'Hugo', 'Nolan', 'Sacha', 'Adam', 'Lucas', 'Rayan', 'Enzo', 'Noah', 'Mathis', 'Ilyes', 'Jules', 'Liam', 'Tom', 'Malo', 'Gabin', 'Nathan', 'Évan', 'Timéo', 'Louka', 'Kylian', 'Axel', 'Robin', 'Aaron', 'Mehdi', 'Paul', 'Baptiste', 'Samuel', 'Elio', 'Côme', 'Valentin', 'Marius', 'Ethan', 'Léon', 'Victor', 'Simon', 'Romain', 'Yohan', 'Bilal']
const girlNames = ['Lina', 'Jade', 'Inès', 'Léa', 'Chloé', 'Manon', 'Zoé', 'Lou', 'Maëlys', 'Romane', 'Nina', 'Camille', 'Emma', 'Sarah', 'Louise', 'Anaïs', 'Clara', 'Lilou', 'Juliette', 'Mila', 'Elsa', 'Ambre', 'Yasmine', 'Rose', 'Agathe', 'Lola', 'Margaux', 'Iris', 'Salomé', 'Alice', 'Eva', 'Noémie', 'Océane', 'Mia', 'Capucine', 'Lisa', 'Maya', 'Aya', 'Lucie', 'Jeanne']
const initials = 'ABCDEFGHJKLMNPRSTV'
const positions: Position[] = ['GB', 'DEF', 'DEF', 'MIL', 'ATT']

// Petit générateur pseudo-aléatoire déterministe : les mêmes exemples à chaque chargement.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

export function demoDB(): DB {
  const rand = rng(42)
  const teams: Team[] = []
  const players: Player[] = []
  const mk = (t: TournamentId, seeds: TeamSeed[], names: string[]) => {
    seeds.forEach(([name, short, c1, c2], ti) => {
      const team: Team = { id: uid(), tournamentId: t, name, short, classe: name, color1: c1, color2: c2, captainId: null }
      teams.push(team)
      positions.forEach((position, pi) => {
        const p: Player = {
          id: uid(),
          teamId: team.id,
          firstName: names[(ti * 5 + pi) % names.length],
          lastInitial: initials[Math.floor(rand() * initials.length)],
          position,
          rating: 68 + Math.floor(rand() * 24) + (position === 'ATT' ? 4 : 0),
          number: [1, 4, 5, 8, 9][pi],
          photoUrl: null,
          consent: false,
        }
        players.push(p)
        if (pi === 3) team.captainId = p.id
      })
    })
  }
  mk('g', boys, boyNames)
  mk('f', girls, girlNames)

  const boyTeams = teams.filter((t) => t.tournamentId === 'g')
  const girlTeams = teams.filter((t) => t.tournamentId === 'f')
  const gm = buildBracket('g', boyTeams)
  const fm = buildBracket('f', girlTeams)
  const goals: Goal[] = []
  const now = Date.now()

  const kick = ['9:00', '9:30', '10:00', '10:30', '13:30', '14:15', '16:00']
  ;[...gm, ...fm].forEach((m) => {
    const idx = m.round === 0 ? m.order : m.round === 1 ? 4 + m.order : 6
    m.kickoff = kick[idx]
    m.field = m.round === 0 ? `Terrain ${(m.order % 2) + 1}` : 'Terrain 1'
  })

  // Jour 1 garçons : quarts et demi 1 joués, demi 2 en cours.
  const play = (matchIdx: number, a: number, b: number, pen?: [number, number]) => {
    const m = gm[matchIdx]
    m.scoreA = a
    m.scoreB = b
    if (pen) [m.penA, m.penB] = pen
    m.status = 'finished'
    addGoals(m.id, m.teamAId!, a)
    addGoals(m.id, m.teamBId!, b)
    advanceWinner(gm, m)
  }
  const addGoals = (matchId: string, teamId: string, n: number) => {
    const shooters = players.filter((p) => p.teamId === teamId && p.position !== 'GB')
    for (let i = 0; i < n; i++) {
      // Les attaquants marquent plus souvent.
      const p = rand() < 0.6 ? shooters[shooters.length - 1] : shooters[Math.floor(rand() * shooters.length)]
      goals.push({ id: uid(), matchId, playerId: p.id, teamId, minute: 1 + Math.floor(rand() * 19), createdAt: new Date(now - 3600e3).toISOString() })
    }
  }
  play(0, 3, 0)
  play(1, 2, 1)
  play(2, 1, 1, [4, 3])
  play(3, 2, 0)
  play(4, 1, 0)
  const live = gm[5]
  live.status = 'live'
  live.period = 2
  live.periodStartedAt = new Date(now - 4 * 60e3).toISOString()
  live.scoreA = 2
  live.scoreB = 1
  addGoals(live.id, live.teamAId!, 2)
  addGoals(live.id, live.teamBId!, 1)

  return {
    settings: { ...defaultSettings },
    tournaments: [
      { id: 'g', name: 'Garçons', day: 1, date: 'Jour 1' },
      { id: 'f', name: 'Filles', day: 2, date: 'Jour 2' },
    ],
    teams,
    players,
    matches: [...gm, ...fm],
    goals,
  }
}

export function emptyDB(settings: Settings): DB {
  return {
    settings: { ...settings, demo: false },
    tournaments: [
      { id: 'g', name: 'Garçons', day: 1, date: 'Jour 1' },
      { id: 'f', name: 'Filles', day: 2, date: 'Jour 2' },
    ],
    teams: [],
    players: [],
    matches: [],
    goals: [],
  }
}
