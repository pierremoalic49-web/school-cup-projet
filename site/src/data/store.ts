// Le « store » : la mémoire du site. Il contient toutes les données, prévient l'interface
// quand elles changent, et envoie les modifications de l'admin vers le stockage :
//  - mode LOCAL (par défaut) : données dans le navigateur, synchronisées entre onglets.
//    Parfait pour tester : ouvre le site dans un onglet et /admin dans un autre.
//  - mode SUPABASE (quand les clés sont dans .env) : vraie base en ligne, temps réel sur tous les téléphones.
import { useSyncExternalStore } from 'react'
import { buildBracket, jerseyNumber, uid, winnerOf } from './bracket'
import { defaultSettings, demoDB, emptyDB } from './demo'
import { storeGet, storeSet } from './safe'
import type { DB, Goal, Match, Player, Settings, Team, TournamentId } from './types'

export type Table = 'teams' | 'players' | 'matches' | 'goals' | 'settings'
type Row = { id: string | number } & Record<string, unknown>

export interface Backend {
  mode: 'local' | 'supabase'
  load(): Promise<DB>
  /** Écoute les changements venant d'ailleurs (autre onglet, autre téléphone). */
  listen(onDB: (db: DB) => void): () => void
  put(table: Table, rows: Row[]): Promise<void>
  /** Modifie seulement certains champs d'une ligne (sans réécrire le reste, ex. le score). */
  patch(table: Table, id: string, fields: Record<string, unknown>): Promise<void>
  del(table: Table, ids: string[]): Promise<void>
  uploadPhoto(playerId: string, file: Blob): Promise<string>
  removePhoto(playerId: string): Promise<void>
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  currentUser(): Promise<string | null>
  replaceAll?(db: DB): Promise<void>
  /** true = c'est la base qui met le score à jour quand un but est ajouté (aucun but perdu si deux organisateurs saisissent en même temps). */
  serverScores?: boolean
}

/** Vérifie que des données lues sur le téléphone ont la bonne forme (sinon on repart des exemples). */
function isDB(x: unknown): x is DB {
  const d = x as DB
  return !!d && typeof d === 'object' && !!d.settings && ['teams', 'players', 'matches', 'goals', 'tournaments'].every((k) => Array.isArray((d as unknown as Record<string, unknown>)[k]))
}

/* ------------------------------------------------------------------ */
/* Appliquer une modification à une copie des données (sans toucher à la base) */

function apply(db: DB, table: Table, rows: Row[]): DB {
  if (table === 'settings') return { ...db, settings: { ...db.settings, ...(rows[0] as unknown as Settings) } }
  const list = db[table] as unknown as Row[]
  const byId = new Map(list.map((r) => [r.id, r]))
  for (const r of rows) byId.set(r.id, { ...(byId.get(r.id) ?? {}), ...r })
  return { ...db, [table]: [...byId.values()] }
}
function remove(db: DB, table: Table, ids: string[]): DB {
  if (table === 'settings') return db
  const set = new Set(ids)
  return { ...db, [table]: (db[table] as unknown as Row[]).filter((r) => !set.has(r.id as string)) }
}

/* ------------------------------------------------------------------ */
/* Mode local : localStorage + BroadcastChannel                         */

const KEY = 'schoolcup-db-v1'

function localBackend(): Backend {
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('schoolcup') : null
  let current: DB | null = null
  const save = () => {
    // Stockage plein ou bloqué : tant pis, on garde en mémoire (storeSet ne plante jamais).
    storeSet('local', KEY, JSON.stringify(current))
    try {
      channel?.postMessage(current)
    } catch {
      /* onglet en cours de fermeture */
    }
  }
  return {
    mode: 'local',
    async load() {
      try {
        const raw = storeGet('local', KEY)
        const parsed: unknown = raw ? JSON.parse(raw) : null
        current = isDB(parsed) ? { ...parsed, settings: { ...defaultSettings, ...parsed.settings } } : null
      } catch {
        current = null
      }
      if (!current) {
        current = demoDB()
        save()
      }
      return current
    },
    listen(onDB) {
      const h = (e: MessageEvent<unknown>) => {
        if (!isDB(e.data)) return
        current = e.data
        onDB(e.data)
      }
      channel?.addEventListener('message', h)
      const onStorage = (e: StorageEvent) => {
        if (e.key !== KEY || !e.newValue) return
        try {
          const parsed: unknown = JSON.parse(e.newValue)
          if (!isDB(parsed)) return
          current = parsed
          onDB(parsed)
        } catch {
          /* donnée illisible : on l'ignore */
        }
      }
      window.addEventListener('storage', onStorage)
      return () => {
        channel?.removeEventListener('message', h)
        window.removeEventListener('storage', onStorage)
      }
    },
    async put(table, rows) {
      current = apply(current!, table, rows)
      save()
    },
    async patch(table, id, fields) {
      current = apply(current!, table, [{ id, ...fields }])
      save()
    },
    async del(table, ids) {
      current = remove(current!, table, ids)
      save()
    },
    async uploadPhoto(_playerId, file) {
      // En local, la photo (déjà réduite) est gardée sous forme de texte « data URL ».
      return await new Promise<string>((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(r.result as string)
        r.onerror = rej
        r.readAsDataURL(file)
      })
    },
    async removePhoto() {},
    async signIn() {},
    async signOut() {},
    async currentUser() {
      return storeGet('session', 'schoolcup-admin') ? 'organisateur (démo)' : null
    },
    async replaceAll(db) {
      current = db
      save()
    },
  }
}

/* ------------------------------------------------------------------ */
/* Le store lui-même                                                   */

type Listener = () => void
type GoalListener = (g: Goal) => void

let backend: Backend = localBackend()
let db: DB | null = null
let ready: Promise<void> | null = null
const listeners = new Set<Listener>()
const goalListeners = new Set<GoalListener>()
const seenGoals = new Set<string>()

function emit() {
  listeners.forEach((l) => l())
}

/** Compare les buts avant/après pour lancer la célébration sur les nouveaux. */
function setDB(next: DB) {
  const fresh = next.goals.filter((g) => !seenGoals.has(g.id))
  next.goals.forEach((g) => seenGoals.add(g.id))
  db = next
  emit()
  // Les buts déjà là à l'ouverture de la page ne sont pas fêtés (ils sont marqués « vus » au chargement).
  if (!initialised || !fresh.length) return
  // S'il en arrive plusieurs d'un coup (téléphone qui sort de veille), on ne fête que le dernier.
  // La marge de 15 minutes tolère une horloge de téléphone mal réglée chez l'organisateur.
  const latest = fresh.reduce((a, b) => (a.createdAt > b.createdAt ? a : b))
  if (Math.abs(Date.now() - new Date(latest.createdAt).getTime()) < 15 * 60_000) goalListeners.forEach((l) => l(latest))
}
let initialised = false

export function initStore(): Promise<void> {
  if (ready) return ready
  ready = (async () => {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
    if (url && key) {
      try {
        const { supabaseBackend } = await import('./supabase')
        backend = supabaseBackend(url, key)
      } catch (e) {
        console.error('Supabase indisponible, passage en mode local', e)
      }
    }
    let loaded: DB
    try {
      loaded = await backend.load()
    } catch (e) {
      console.error('Chargement impossible, passage en mode local', e)
      backend = localBackend()
      loaded = await backend.load()
    }
    setDB(loaded)
    initialised = true
    backend.listen(setDB)
  })()
  return ready
}

export const getBackendMode = () => backend.mode
export const getDB = () => db

export function useDB(): DB | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => db,
  )
}

export function onGoal(l: GoalListener) {
  goalListeners.add(l)
  return () => {
    goalListeners.delete(l)
  }
}

/* ------------------------------------------------------------------ */
/* Écritures : on met à jour l'écran tout de suite, puis on enregistre. */

async function put(table: Table, rows: Row[]) {
  setDB(apply(db!, table, rows))
  await backend.put(table, rows).catch(rollback)
}
async function patch(table: Table, id: string, fields: Record<string, unknown>) {
  setDB(apply(db!, table, [{ id, ...fields }]))
  await backend.patch(table, id, fields).catch(rollback)
}
async function del(table: Table, ids: string[]) {
  setDB(remove(db!, table, ids))
  await backend.del(table, ids).catch(rollback)
}
/** L'enregistrement a échoué : on recharge les vraies données pour ne pas afficher un faux score. */
async function rollback(e: unknown): Promise<never> {
  try {
    setDB(await backend.load())
  } catch {
    /* hors ligne : on garde l'affichage, l'erreur est montrée à l'organisateur */
  }
  throw e
}
const asRow = <T extends object>(x: T) => x as unknown as Row
const findMatch = (id: string) => db!.matches.find((m) => m.id === id)!

export const auth = {
  signIn: async (email: string, password: string) => {
    await backend.signIn(email, password)
    if (backend.mode === 'local') storeSet('session', 'schoolcup-admin', '1')
  },
  signOut: async () => {
    await backend.signOut()
    storeSet('session', 'schoolcup-admin', null)
  },
  currentUser: () => backend.currentUser(),
}

export const actions = {
  async saveSettings(s: Partial<Settings>) {
    await put('settings', [asRow({ id: 1, ...db!.settings, ...s })])
  },

  async saveTeam(t: Team) {
    await put('teams', [asRow(t)])
  },
  async deleteTeam(id: string) {
    const playerIds = db!.players.filter((p) => p.teamId === id).map((p) => p.id)
    if (playerIds.length) await del('players', playerIds)
    await del('teams', [id])
  },
  newTeam(t: TournamentId): Team {
    return { id: uid(), tournamentId: t, name: '', short: '', classe: '', color1: '#FFC63D', color2: '#1A1200', captainId: null }
  },

  async savePlayer(p: Player) {
    // Sécurité droit à l'image : sans autorisation, jamais de photo.
    const clean = p.consent ? p : { ...p, photoUrl: null }
    if (!p.consent && p.photoUrl) await backend.removePhoto(p.id)
    await put('players', [asRow(clean)])
  },
  async deletePlayer(id: string) {
    await backend.removePhoto(id).catch(() => {})
    await del('players', [id])
  },
  newPlayer(teamId: string): Player {
    // Premier numéro de maillot libre dans l'équipe (les numéros « de légende » d'abord).
    const used = new Set(db!.players.filter((p) => p.teamId === teamId).map(jerseyNumber))
    const number = [10, 7, 11, 9, 8, 6, 2, 3, 4, 5, 14, 17, 19, 21, 23].find((n) => !used.has(n)) ?? Array.from({ length: 98 }, (_, i) => i + 2).find((n) => !used.has(n)) ?? 99
    return { id: uid(), teamId, firstName: '', lastInitial: '', position: 'MIL', rating: 75, number, photoUrl: null, consent: false }
  },
  async uploadPhoto(p: Player, file: Blob) {
    if (!p.consent) throw new Error('Coche d’abord l’autorisation droit à l’image.')
    const url = await backend.uploadPhoto(p.id, file)
    await put('players', [asRow({ ...p, photoUrl: url })])
  },

  /** (Re)crée le tableau d'un tournoi à partir de ses équipes. Efface les matchs et buts existants. */
  async generateBracket(t: TournamentId, teamOrder: Team[]) {
    const old = db!.matches.filter((m) => m.tournamentId === t)
    const oldIds = new Set(old.map((m) => m.id))
    const oldGoals = db!.goals.filter((g) => oldIds.has(g.matchId)).map((g) => g.id)
    if (oldGoals.length) await del('goals', oldGoals)
    if (old.length) await del('matches', [...oldIds])
    const fresh = buildBracket(t, teamOrder)
    if (fresh.length) await put('matches', fresh.map(asRow))
  },

  /** Modifie seulement les champs donnés (le reste du match, dont le score, n'est pas réécrit). */
  async updateMatch(id: string, fields: Partial<Match>) {
    await patch('matches', id, fields)
  },

  /** Lance le match (ou la 2e mi-temps). */
  async startPeriod(id: string, period: 1 | 2) {
    await actions.updateMatch(id, { status: 'live', period, periodStartedAt: new Date().toISOString() })
  },

  /** Termine le match et qualifie le vainqueur pour le tour suivant. */
  async finishMatch(id: string) {
    const m = { ...findMatch(id), status: 'finished' as const }
    if (!winnerOf(m)) throw new Error('Égalité : saisis les tirs au but avant de terminer le match.')
    await patch('matches', id, { status: 'finished' })
    // Le vainqueur prend sa place dans le match suivant.
    if (m.nextMatchId && m.nextSlot) await patch('matches', m.nextMatchId, { [m.nextSlot === 'A' ? 'teamAId' : 'teamBId']: winnerOf(m) })
  },

  /** Rouvre un match terminé (en cas d'erreur) et retire le vainqueur du tour suivant. */
  async reopenMatch(id: string) {
    const m = findMatch(id)
    await patch('matches', id, { status: 'live' })
    if (m.nextMatchId && m.nextSlot) {
      const next = findMatch(m.nextMatchId)
      if (next.status === 'upcoming') await patch('matches', next.id, { [m.nextSlot === 'A' ? 'teamAId' : 'teamBId']: null })
    }
  },

  /** Le bouton « But » : enregistre le but, met le score à jour, la célébration part chez tout le monde. */
  async addGoal(matchId: string, teamId: string, playerId: string | null, minute: number) {
    const m = findMatch(matchId)
    if (teamId !== m.teamAId && teamId !== m.teamBId) throw new Error('Cette équipe ne joue pas ce match.')
    const goal: Goal = { id: uid(), matchId, playerId, teamId, minute, createdAt: new Date().toISOString() }
    const bump = teamId === m.teamAId ? { scoreA: m.scoreA + 1 } : { scoreB: m.scoreB + 1 }
    if (backend.serverScores) {
      // Supabase : la base ajoute +1 elle-même (déclencheur SQL). On affiche le +1 tout de suite.
      setDB(apply(db!, 'matches', [{ id: m.id, ...bump }]))
    } else await patch('matches', m.id, bump)
    await put('goals', [asRow(goal)])
    return goal.id
  },

  /** Annule le dernier but du match. */
  async undoLastGoal(matchId: string, goalId?: string) {
    const m = findMatch(matchId)
    // Avec goalId : on annule CE but précis (et pas celui qu'un autre organisateur vient d'ajouter).
    const last = goalId
      ? db!.goals.find((g) => g.id === goalId)
      : db!.goals.filter((g) => g.matchId === matchId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
    if (!last) return
    const drop = last.teamId === m.teamAId ? { scoreA: Math.max(0, m.scoreA - 1) } : { scoreB: Math.max(0, m.scoreB - 1) }
    if (backend.serverScores) setDB(apply(db!, 'matches', [{ id: m.id, ...drop }]))
    await del('goals', [last.id])
    if (!backend.serverScores) await patch('matches', m.id, drop)
  },

  /** Mode local uniquement : remettre les exemples, ou tout vider pour saisir le vrai tournoi. */
  async resetDemo() {
    const fresh = demoDB()
    seenGoals.clear()
    fresh.goals.forEach((g) => seenGoals.add(g.id))
    if (backend.replaceAll) await backend.replaceAll(fresh)
    setDB(fresh)
  },
  async clearAll() {
    if (backend.mode === 'local' && backend.replaceAll) {
      const fresh = emptyDB(db!.settings)
      await backend.replaceAll(fresh)
      setDB(fresh)
      return
    }
    // Supabase : on efface tout, dans l'ordre (les buts d'abord).
    await del('goals', db!.goals.map((g) => g.id))
    await del('matches', db!.matches.map((m) => m.id))
    await del('players', db!.players.map((p) => p.id))
    await del('teams', db!.teams.map((t) => t.id))
    await actions.saveSettings({ demo: false })
  },
}
