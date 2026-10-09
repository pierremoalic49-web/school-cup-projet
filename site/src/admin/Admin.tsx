// L'espace organisateurs (/admin) : connexion, puis 5 onglets.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { storeGet, storeSet } from '../data/safe'
import { auth, getBackendMode, initStore, useDB } from '../data/store'
import { Boot, Bracket, Gear, Info, Live, Users } from '../ui/Icons'
import './admin.css'
import LiveTab from './LiveTab'
import { MatchesTab, PlayersTab, SettingsTab, TeamsTab } from './ManageTabs'

/* ------------------------- Notifications et confirmations ------------------------- */

interface Toast {
  id: number
  text: string
  bad?: boolean
  action?: { label: string; run: () => void }
}
interface ConfirmReq {
  title: string
  text: string
  ok: string
  danger?: boolean
  resolve: (v: boolean) => void
}
interface Ui {
  toast: (text: string, opts?: { bad?: boolean; action?: Toast['action'] }) => void
  confirm: (title: string, text: string, ok: string, danger?: boolean) => Promise<boolean>
  /** Lance une action d'écriture et affiche l'erreur si elle échoue. */
  run: (fn: () => Promise<unknown>, success?: string) => Promise<boolean>
}
const UiCtx = createContext<Ui | null>(null)
export const useUi = () => useContext(UiCtx)!

function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [confirmReq, setConfirmReq] = useState<ConfirmReq | null>(null)
  const okRef = useRef<HTMLButtonElement>(null)
  const toast = useCallback<Ui['toast']>((text, opts) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t.slice(-2), { id, text, ...opts }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts?.action ? 6000 : 3200)
  }, [])
  const confirm = useCallback<Ui['confirm']>((title, text, ok, danger) => new Promise((resolve) => setConfirmReq({ title, text, ok, danger, resolve })), [])
  const run = useCallback<Ui['run']>(
    async (fn, success) => {
      try {
        await fn()
        if (success) toast(success)
        return true
      } catch (e) {
        toast(e instanceof Error ? e.message : 'L’enregistrement a échoué. Vérifie la connexion internet.', { bad: true })
        return false
      }
    },
    [toast],
  )
  useEffect(() => {
    if (confirmReq) okRef.current?.focus()
  }, [confirmReq])
  const close = (v: boolean) => {
    confirmReq?.resolve(v)
    setConfirmReq(null)
  }
  return (
    <UiCtx.Provider value={{ toast, confirm, run }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.bad ? ' bad' : ''}`}>
            <span>{t.text}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action!.run()
                  setToasts((x) => x.filter((y) => y.id !== t.id))
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
      {confirmReq && (
        <div className="sheet-bg" onClick={() => close(false)} onKeyDown={(e) => e.key === 'Escape' && close(false)}>
          <div className="sheet" role="alertdialog" aria-modal="true" aria-labelledby="cf-t" aria-describedby="cf-d" onClick={(e) => e.stopPropagation()}>
            <h2 id="cf-t">{confirmReq.title}</h2>
            <p id="cf-d" className="muted" style={{ fontSize: 16 }}>
              {confirmReq.text}
            </p>
            <div className="actions">
              <button type="button" className="b b-line" onClick={() => close(false)}>
                Annuler
              </button>
              <button type="button" ref={okRef} className={`b ${confirmReq.danger ? 'b-danger' : 'b-gold'}`} onClick={() => close(true)}>
                {confirmReq.ok}
              </button>
            </div>
          </div>
        </div>
      )}
    </UiCtx.Provider>
  )
}

/* ----------------------------------- Connexion ----------------------------------- */

function Login({ onDone }: { onDone: (who: string) => void }) {
  const local = getBackendMode() === 'local'
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr('')
    if (!local && (!email.includes('@') || pw.length < 6)) {
      setErr('Saisis ton email d’organisateur et ton mot de passe (6 caractères minimum).')
      return
    }
    setBusy(true)
    try {
      await auth.signIn(email, pw)
      onDone((await auth.currentUser()) ?? email)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Connexion impossible.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="login">
      <form className="card" onSubmit={submit} noValidate>
        <h1 className="login-logo">
          <img src="/logo/ecusson.webp" alt="School Cup" width={120} height={139} />
        </h1>
        <p className="muted" style={{ marginTop: 0, textAlign: 'center' }}>
          Espace organisateurs
        </p>
        {local && (
          <p className="adm-banner">
            <Info />
            <span>Mode démo : le site n&rsquo;est pas encore relié à Supabase. Clique sur « Se connecter », les changements restent dans ce navigateur.</span>
          </p>
        )}
        {!local && (
          <>
            <label className="field">
              <span>Email</span>
              <input className="in" type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!err} />
            </label>
            <label className="field">
              <span>Mot de passe</span>
              <input className="in" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} aria-invalid={!!err} />
            </label>
          </>
        )}
        {err && (
          <p className="err" role="alert">
            {err}
          </p>
        )}
        <button className="b b-gold b-block" type="submit" disabled={busy} style={{ marginTop: 10 }}>
          {busy ? 'Connexion…' : 'Se connecter'}
        </button>
        <p style={{ margin: '16px 0 0', textAlign: 'center' }}>
          <a href="/" style={{ color: 'var(--dim)' }}>
            Retour au site
          </a>
        </p>
      </form>
    </div>
  )
}

/* ------------------------------------ Coquille ------------------------------------ */

type Tab = 'live' | 'matches' | 'teams' | 'players' | 'settings'
const TABS: [Tab, string, ReactNode][] = [
  ['live', 'Direct', <Live key="i" size={22} />],
  ['matches', 'Matchs', <Bracket key="i" size={22} />],
  ['teams', 'Équipes', <Users key="i" size={22} />],
  ['players', 'Joueurs', <Boot key="i" size={22} />],
  ['settings', 'Réglages', <Gear key="i" size={22} />],
]

function Shell({ who, onOut }: { who: string; onOut: () => void }) {
  const db = useDB()
  const [tab, setTab] = useState<Tab>(() => {
    const saved = storeGet('session', 'schoolcup-tab') as Tab | null
    return saved && TABS.some(([id]) => id === saved) ? saved : 'live'
  })
  useEffect(() => {
    storeSet('session', 'schoolcup-tab', tab)
    window.scrollTo(0, 0)
  }, [tab])
  if (!db) return null
  return (
    <div className="adm">
      <header className="adm-head">
        <span className="brand">
          <img src="/logo/horizontal-plat.svg" alt="School Cup" width={79} height={34} />
          <small>Admin</small>
        </span>
        <div className="adm-head-actions">
          <a className="adm-link" href="/" target="_blank" rel="noreferrer">
            Voir le site
          </a>
          <button
            className="adm-link"
            type="button"
            onClick={async () => {
              await auth.signOut()
              onOut()
            }}
            title={`Connecté : ${who}`}
          >
            Sortir
          </button>
        </div>
      </header>
      <main className="adm-main">
        {getBackendMode() === 'local' && (
          <p className="adm-banner">
            <Info />
            <span>
              Mode démo local. Pour tester le direct, ouvre le site dans un autre onglet : chaque but validé ici y déclenche la célébration. Pour le vrai tournoi, relie Supabase (voir le guide).
            </span>
          </p>
        )}
        {tab === 'live' && <LiveTab db={db} />}
        {tab === 'matches' && <MatchesTab db={db} />}
        {tab === 'teams' && <TeamsTab db={db} />}
        {tab === 'players' && <PlayersTab db={db} />}
        {tab === 'settings' && <SettingsTab db={db} />}
      </main>
      <nav className="adm-tabs" aria-label="Sections de l'admin">
        {TABS.map(([id, label, icon]) => (
          <button key={id} type="button" aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>
            {icon}
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}

export default function Admin() {
  const [who, setWho] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    document.title = 'Admin · School Cup'
    initStore()
      .then(() => auth.currentUser())
      .then(setWho)
  }, [])
  if (who === undefined) return <div className="login" aria-busy="true" />
  return <UiProvider>{who ? <Shell who={who} onOut={() => setWho(null)} /> : <Login onDone={setWho} />}</UiProvider>
}
