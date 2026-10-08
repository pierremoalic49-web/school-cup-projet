// Les « formes » des données du tournoi. Les mêmes noms sont utilisés dans la base Supabase
// (voir supabase/schema.sql) pour que le site et la base parlent la même langue.

export type TournamentId = 'g' | 'f' // g = garçons (jour 1), f = filles (jour 2)

export interface Settings {
  name: string
  school: string
  city: string
  dates: string // texte libre, ex. « 12 et 13 mai 2027 »
  place: string
  schedule: string // horaires, texte libre
  rules: string // règlement simplifié, une règle par ligne
  contact: string
  halfLength: number // durée d'une mi-temps, en minutes
  demo: boolean // true tant que les vraies données n'ont pas été saisies
}

export interface Tournament {
  id: TournamentId
  name: string // « Garçons », « Filles »
  day: 1 | 2
  date: string
}

export interface Team {
  id: string
  tournamentId: TournamentId
  name: string // ex. « Terminale A »
  short: string // 2 ou 3 lettres pour l'écusson, ex. « TA »
  classe: string
  color1: string
  color2: string
  captainId: string | null
}

export type Position = 'GB' | 'DEF' | 'MIL' | 'ATT'

export interface Player {
  id: string
  teamId: string
  firstName: string
  lastInitial: string // RGPD : seulement l'initiale du nom
  position: Position
  rating: number // note « fun » façon jeu vidéo, de 50 à 99
  photoUrl: string | null
  consent: boolean // autorisation droit à l'image signée par les parents
}

export type MatchStatus = 'upcoming' | 'live' | 'halftime' | 'finished'

export interface Match {
  id: string
  tournamentId: TournamentId
  round: number // 0 = premier tour ; le dernier tour est la finale
  order: number // position dans le tour, de haut en bas
  teamAId: string | null
  teamBId: string | null
  scoreA: number
  scoreB: number
  penA: number | null // tirs au but
  penB: number | null
  status: MatchStatus
  kickoff: string | null // heure prévue, ex. « 14:30 »
  period: 1 | 2
  periodStartedAt: string | null // date ISO du début de la mi-temps en cours
  field: string
  nextMatchId: string | null
  nextSlot: 'A' | 'B' | null
}

export interface Goal {
  id: string
  matchId: string
  playerId: string | null // null = but contre son camp ou buteur inconnu
  teamId: string // équipe qui marque
  minute: number
  createdAt: string
}

export interface DB {
  settings: Settings
  tournaments: Tournament[]
  teams: Team[]
  players: Player[]
  matches: Match[]
  goals: Goal[]
}

/** Événement envoyé à tous les visiteurs quand un but est validé. */
export interface GoalEvent {
  goal: Goal
}
