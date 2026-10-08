// Branchement à Supabase (base de données en ligne + temps réel + connexion admin + photos).
// Utilisé automatiquement quand VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont dans le fichier .env.
import { createClient } from '@supabase/supabase-js'
import { defaultSettings } from './demo'
import type { Backend, Table } from './store'
import type { DB } from './types'

// Le site écrit « teamAId », la base écrit « team_a_id » : on traduit dans les deux sens.
const toSnake = (k: string) => k.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase())
const toCamel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
const mapKeys = (o: Record<string, unknown>, f: (k: string) => string) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [f(k), v]))

const TABLES: Table[] = ['teams', 'players', 'matches', 'goals']

/** Traduit les erreurs techniques de la base en phrases compréhensibles. */
function explain(message: string) {
  if (/row-level security|permission denied/i.test(message))
    return 'Ce compte n’a pas le droit de modifier : il n’est pas dans la liste des admins (voir le guide Supabase, étape 6).'
  if (/photo_needs_consent/.test(message)) return 'Photo refusée : l’autorisation droit à l’image n’est pas cochée.'
  if (/Failed to fetch|NetworkError/i.test(message)) return 'Pas de connexion internet : réessaie dans un instant.'
  return `Enregistrement impossible : ${message}`
}

export function supabaseBackend(url: string, key: string): Backend {
  const sb = createClient(url, key)

  async function fetchTable(t: Table) {
    const { data, error } = await sb.from(t).select('*')
    if (error) throw error
    return (data ?? []).map((r) => mapKeys(r, toCamel))
  }
  async function fetchAll(): Promise<DB> {
    const [teams, players, matches, goals, settingsRows] = await Promise.all([
      ...TABLES.map(fetchTable),
      fetchTable('settings'),
    ])
    const s = settingsRows[0] ?? {}
    delete s.id
    return {
      settings: { ...defaultSettings, demo: false, ...s },
      tournaments: [
        { id: 'g', name: 'Garçons', day: 1, date: 'Jour 1' },
        { id: 'f', name: 'Filles', day: 2, date: 'Jour 2' },
      ],
      teams,
      players,
      matches,
      goals,
    } as unknown as DB
  }

  return {
    mode: 'supabase',
    serverScores: true,
    load: fetchAll,
    listen(onDB) {
      // À chaque changement dans la base, on recharge (petit volume : c'est simple et fiable).
      let timer: ReturnType<typeof setTimeout> | null = null
      let seq = 0
      const refresh = () => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
          // Si deux rechargements se croisent, seul le plus récent compte (sinon un vieux score pourrait revenir).
          const mine = ++seq
          fetchAll()
            .then((d) => mine === seq && onDB(d))
            .catch(console.error)
        }, 120)
      }
      const ch = sb.channel('schoolcup-live')
      for (const t of [...TABLES, 'settings']) ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, refresh)
      // Si le temps réel se reconnecte après une coupure, on recharge pour rattraper ce qu'on a manqué.
      ch.subscribe((status) => status === 'SUBSCRIBED' && refresh())
      // Filet de sécurité : même si le temps réel ne passe pas (4G capricieuse, Wi-Fi du lycée…),
      // on recharge toutes les 30 s tant que la page est affichée.
      const poll = setInterval(() => document.visibilityState === 'visible' && refresh(), 30000)
      // Téléphone qui sort de veille ou qui retrouve le réseau : on recharge tout de suite.
      const onVis = () => document.visibilityState === 'visible' && refresh()
      document.addEventListener('visibilitychange', onVis)
      window.addEventListener('online', refresh)
      return () => {
        clearInterval(poll)
        sb.removeChannel(ch)
        document.removeEventListener('visibilitychange', onVis)
        window.removeEventListener('online', refresh)
      }
    },
    async put(table, rows) {
      const { error } = await sb.from(table).upsert(rows.map((r) => mapKeys(r, toSnake)))
      if (error) throw new Error(explain(error.message))
    },
    async patch(table, id, fields) {
      const { error } = await sb.from(table).update(mapKeys(fields, toSnake)).eq('id', table === 'settings' ? 1 : id)
      if (error) throw new Error(explain(error.message))
    },
    async del(table, ids) {
      if (!ids.length) return
      const { error } = await sb.from(table).delete().in('id', ids)
      if (error) throw new Error(explain(error.message))
    },
    async uploadPhoto(playerId, file) {
      const path = `${playerId}.jpg`
      const { error } = await sb.storage.from('photos').upload(path, file, { upsert: true, contentType: 'image/jpeg' })
      if (error) throw new Error(explain(error.message))
      const { data } = sb.storage.from('photos').getPublicUrl(path)
      return `${data.publicUrl}?v=${Date.now()}`
    },
    async removePhoto(playerId) {
      await sb.storage.from('photos').remove([`${playerId}.jpg`])
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password })
      if (error) throw new Error('Email ou mot de passe incorrect.')
    },
    async signOut() {
      await sb.auth.signOut()
    },
    async currentUser() {
      const { data } = await sb.auth.getUser()
      return data.user?.email ?? null
    },
  }
}
