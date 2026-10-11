// Le site public : le stade 3D en fond, l'intro, la cinématique, puis les sections par-dessus.
import { useCallback, useEffect, useRef, useState } from 'react'
import { music, preloadMusic } from '../audio/music'
import { asset } from '../base'
import { sound } from '../audio/sound'
import { featuredMatch, isLive, matchTitle, minuteLabel, playerName } from '../data/bracket'
import { storeGet, storeSet } from '../data/safe'
import { onGoal, useDB } from '../data/store'
import type { DB, Goal } from '../data/types'
import type { Stadium } from '../stadium/Stadium'
import { Bracket, Boot, Info, Live, Play, SoundOff, SoundOn, Users } from '../ui/Icons'
import { BracketSection, InfoSection, LiveSection, ScorersSection, TeamsSection, Ticker } from './sections'

type Phase = 'intro' | 'flight' | 'arrived'

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

const SECTIONS = ['direct', 'tableau', 'buteurs', 'equipes', 'infos']
// Durée du vol (la même que dans stadium/Stadium.ts ; recopiée ici pour ne pas charger la 3D avec le reste).
const FLIGHT_SECONDS = 7.2
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
let stadiumPromise: Promise<Stadium> | null = null

export default function PublicSite() {
  const db = useDB()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stadiumRef = useRef<Stadium | null>(null)
  const [ready, setReady] = useState(false)
  const [noGL, setNoGL] = useState(false)
  const [phase, setPhase] = useState<Phase>('intro')
  const [caption, setCaption] = useState<{ html: string; key: number } | null>(null)
  const [muted, setMuted] = useState(sound.muted)
  const [soundOn, setSoundOn] = useState(false)
  const [goal, setGoal] = useState<{ who: string; team: string; key: number } | null>(null)
  const [lastScorer, setLastScorer] = useState<string | null>(null)
  const [current, setCurrent] = useState('direct')
  const flashRef = useRef<HTMLDivElement>(null)
  // Copies « immédiates » de l'étape en cours, lisibles dans les rappels (évite les doubles déclenchements).
  const phaseRef = useRef<Phase>('intro')
  const arrivedRef = useRef<(withSound: boolean) => void>(() => {})
  const goalTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const returning = useRef(storeGet('local', 'schoolcup-visited') === '1')
  const dbRef = useRef<DB | null>(db)
  dbRef.current = db

  const flash = () => {
    const el = flashRef.current
    if (!el) return
    el.classList.remove('go')
    void el.offsetWidth
    el.classList.add('go')
  }

  /* ---------- Création du stade 3D ---------- */
  useEffect(() => {
    if (!canvasRef.current) return
    if (!hasWebGL()) {
      setNoGL(true)
      setReady(true)
      return
    }
    let cancelled = false
    // Le stade est chargé à part (code découpé) : le reste du site s'affiche sans l'attendre.
    // Un seul stade par page, même si React monte le composant deux fois en développement.
    stadiumPromise ??= import('../stadium/Stadium').then(({ Stadium }) => Stadium.create(canvasRef.current!, { reducedMotion: reducedMotion() }))
    stadiumPromise
      .then((s) => {
        if (cancelled) return
        stadiumRef.current = s
        // Si la 3D lâche en cours de route, on passe sur le fond fixe sans bloquer le site.
        s.onFatal = () => {
          stadiumRef.current = null
          setNoGL(true)
          if (phaseRef.current !== 'arrived') arrivedRef.current(phaseRef.current === 'flight')
        }
        setReady(true)
        // Pendant que le visiteur regarde la vue du ciel, on prépare la musique (aucun retard au clic).
        if (phaseRef.current === 'intro') void preloadMusic()
      })
      .catch((e) => {
        console.error('Stade 3D indisponible', e)
        if (cancelled) return
        setNoGL(true)
        setReady(true)
      })
    // Si le stade met trop de temps, on laisse entrer quand même.
    const t = setTimeout(() => setReady(true), 9000)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [])

  /* ---------- Arrivée dans le stade ---------- */
  const arrived = useCallback((withSound: boolean) => {
    if (phaseRef.current === 'arrived') return
    phaseRef.current = 'arrived'
    setPhase('arrived')
    setCaption(null)
    document.body.classList.remove('cine', 'locked')
    document.body.classList.add('arrived')
    storeSet('local', 'schoolcup-visited', '1')
    flash()
    music.arrived()
    if (withSound) {
      sound.roar(1)
      sound.whistle()
      sound.boom()
      setTimeout(() => sound.crowd(0.16, 3), 2500)
    }
  }, [])
  arrivedRef.current = arrived

  // Lien direct vers une section (ex. /#direct) : on saute l'intro.
  useEffect(() => {
    document.body.classList.add('locked')
    const h = location.hash.slice(1)
    if (SECTIONS.includes(h)) {
      phaseRef.current = 'arrived'
      setPhase('arrived')
      document.body.classList.remove('locked')
      document.body.classList.add('arrived')
      requestAnimationFrame(() => document.getElementById(h)?.scrollIntoView())
    }
    return () => document.body.classList.remove('locked', 'arrived', 'cine')
  }, [])

  useEffect(() => {
    const s = stadiumRef.current
    if (!s || !ready) return
    if (phase === 'arrived' && s.phase !== 'arrived') {
      s.onArrive = undefined
      s.arrive()
    }
  }, [ready, phase])

  const enter = (short = false) => {
    if (phaseRef.current !== 'intro') return
    sound.start()
    setSoundOn(true)
    sound.crowd(0.05, 0.6)
    const s = stadiumRef.current
    const instant = !s || noGL || short || reducedMotion()
    // La musique part maintenant ; la batterie tombera pile à l'arrivée dans le stade.
    music.start(instant ? (short ? 0.15 : 0.5) : FLIGHT_SECONDS)
    if (instant) {
      phaseRef.current = 'flight'
      setTimeout(() => arrived(true), short ? 150 : 500)
      return
    }
    phaseRef.current = 'flight'
    setPhase('flight')
    document.body.classList.add('cine')
    // Filet de sécurité : quoi qu'il arrive, on entre dans le site après la durée du vol + 4 s.
    setTimeout(() => arrived(true), (FLIGHT_SECONDS + 4) * 1000)
    const city = escapeHtml(dbRef.current?.settings.city ?? 'Angers')
    const caps: [number, string][] = [
      [0.4, city],
      [2.0, 'Un stade.'],
      [3.3, 'Deux jours.'],
      [4.6, 'Une seule <span class="g">école</span>.'],
    ]
    let idx = -1
    s.onFlightTime = (sec) => {
      let c = -1
      for (let i = caps.length - 1; i >= 0; i--)
        if (sec >= caps[i][0]) {
          c = i
          break
        }
      if (c !== idx) {
        idx = c
        if (c >= 0) setCaption({ html: caps[c][1], key: c })
        sound.crowd(0.05 + c * 0.11, 0.8)
      }
    }
    s.onArrive = () => {
      s.onFlightTime = undefined
      arrived(true)
    }
    s.startFlight()
  }

  const skip = () => {
    const s = stadiumRef.current
    if (s) s.arrive()
    else arrived(true)
  }

  /* ---------- Défilement : la caméra monte comme un drone ---------- */
  useEffect(() => {
    if (phase !== 'arrived') return
    const onScroll = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - innerHeight)
      stadiumRef.current?.setScroll(Math.min(1, scrollY / max) * 1.4)
      // Le stade s'assombrit doucement une fois le titre dépassé.
      const dim = Math.min(1, Math.max(0, (scrollY - innerHeight * 0.35) / (innerHeight * 0.5)))
      document.documentElement.style.setProperty('--dim-top', dim.toFixed(3))
      // Onglet actif de la barre du bas.
      let cur = 'direct'
      for (const id of SECTIONS) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top < innerHeight * 0.45) cur = id
      }
      setCurrent(cur)
    }
    onScroll()
    addEventListener('scroll', onScroll, { passive: true })
    return () => removeEventListener('scroll', onScroll)
  }, [phase])

  /* ---------- Écran géant et joueurs aux couleurs du match du moment ---------- */
  const fm = db ? featuredMatch(db) : null
  const fa = fm && db ? db.teams.find((t) => t.id === fm.teamAId) : null
  const fb = fm && db ? db.teams.find((t) => t.id === fm.teamBId) : null
  const screenKey = fm ? `${fm.id}:${fm.scoreA}:${fm.scoreB}:${fm.status}:${fa?.color1}:${fb?.color1}` : 'none'
  useEffect(() => {
    const s = stadiumRef.current
    if (!s || !db) return
    const update = () => {
      if (fm && fa && fb) {
        const min = minuteLabel(fm, db.settings.halfLength)
        const label = `${fm.status === 'live' && min ? `${min} · ` : ''}${matchTitle(db, fm)}`
        s.setScreen({ mode: fm.status === 'upcoming' ? 'logo' : 'score', a: { short: fa.short, color: fa.color1 }, b: { short: fb.short, color: fb.color1 }, scoreA: fm.scoreA, scoreB: fm.scoreB, label })
        s.setTeams([fa.color1, fa.color2], [fb.color1, fb.color2])
      } else s.setScreen({ mode: 'logo' })
    }
    update()
    const id = setInterval(update, 30000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, screenKey])

  /* ---------- « BUUUT ! » chez tout le monde ---------- */
  useEffect(
    () =>
      onGoal((g: Goal) => {
        const d = dbRef.current
        if (!d) return
        const m = d.matches.find((x) => x.id === g.matchId)
        const team = d.teams.find((t) => t.id === g.teamId)
        const p = g.playerId ? d.players.find((x) => x.id === g.playerId) : null
        setGoal({ who: p ? playerName(p) : 'But', team: team?.name ?? '', key: Date.now() })
        setLastScorer(p?.id ?? null)
        flash()
        music.duck()
        sound.roar(1)
        sound.boom()
        sound.whistle([
          [0, 0.15],
          [0.22, 0.15],
          [0.44, 0.15],
        ])
        const s = stadiumRef.current
        if (s) {
          s.celebrateGoal(m && g.teamId === m.teamBId ? 1 : -1)
          s.setScreen({ mode: 'goal', scorer: p ? playerName(p) : team?.name })
        }
        // Deux buts rapprochés : on annule les minuteries du précédent pour ne pas couper le suivant.
        goalTimers.current.forEach(clearTimeout)
        goalTimers.current = [setTimeout(() => setGoal(null), 3100), setTimeout(() => setLastScorer(null), 4000)]
      }),
    [],
  )

  const toggleSound = () => {
    if (!soundOn) {
      sound.start()
      sound.setMuted(false)
      sound.crowd(0.16, 2)
      music.ambient()
      setSoundOn(true)
      setMuted(false)
      return
    }
    sound.setMuted(!muted)
    setMuted(!muted)
  }

  const demo = db?.settings.demo
  const live = db?.matches.some(isLive)
  const soundLabel = !soundOn || muted ? 'Activer le son du stade' : 'Couper le son'

  return (
    <>
      <a className="skip-link" href="#direct" onClick={() => phase !== 'arrived' && skip()}>
        Aller aux scores
      </a>
      <canvas ref={canvasRef} className="stage" aria-hidden="true" hidden={noGL} />
      {noGL && <div className="fallback-bg" />}
      <div className="vignette" />
      <div className="scrim" />
      <div className="cine-bar top" />
      <div className="cine-bar bottom" />
      <div className="flash" ref={flashRef} />

      {phase !== 'arrived' && (
        <section className={`intro${phase === 'flight' ? ' leaving' : ''}`} aria-label="Accueil School Cup">
          <div className="crest">
            <div className="crest-halo" />
            <p className="crest-kicker">
              {db?.settings.school ?? 'Lycée Sacré-Cœur La Salle'} · {db?.settings.city ?? 'Angers'}
            </p>
            <h1 className="crest-logo">
              <img src={asset('logo/ecusson.webp')} alt="School Cup" width={760} height={881} decoding="async" fetchPriority="high" />
              {/* Reflet de lumière qui balaie l'or, découpé à la forme exacte du logo. */}
              <span className="crest-shine" aria-hidden="true" />
              <span className="crest-sparkle s1" aria-hidden="true" />
              <span className="crest-sparkle s2" aria-hidden="true" />
            </h1>
            <p className="crest-rule">Tournoi de football</p>
          </div>
          <button className="enter" type="button" onClick={() => enter()} disabled={!ready || phase !== 'intro'}>
            <Play />
            {ready ? 'Entrer dans le stade' : 'Le stade s’allume…'}
          </button>
          {!ready && <div className="loading-line" aria-hidden="true" />}
          {ready && (
            <p className="intro-hint">
              <SoundOn size={15} /> Monte le son
            </p>
          )}
          {ready && returning.current && (
            <button className="intro-short" type="button" onClick={() => enter(true)}>
              Déjà venu ? Aller directement aux scores
            </button>
          )}
        </section>
      )}

      <div className="captions" aria-live="polite">
        {caption && <p key={caption.key} className="caption on" dangerouslySetInnerHTML={{ __html: caption.html }} />}
      </div>
      {phase === 'flight' && (
        <button className="skip" type="button" onClick={skip}>
          Passer
        </button>
      )}

      <header className="topbar">
        <div className="topbar-in">
          <a className="brand" href="#top" aria-label="School Cup, haut de page">
            <img src={asset('logo/horizontal-plat.svg')} alt="School Cup" width={92} height={40} />
          </a>
          <nav className="nav" aria-label="Navigation principale">
            {demo && (
              <span className="demo-flag" title="Les équipes et scores affichés sont des exemples">
                Données d&rsquo;exemple
              </span>
            )}
            <a href="#direct" className="hide-sm live-link">
              {live && <span className="dot" />}Direct
            </a>
            <a href="#tableau" className="hide-sm">
              Tableau
            </a>
            <a href="#buteurs" className="hide-sm">
              Buteurs
            </a>
            <a href="#equipes" className="hide-sm">
              Équipes
            </a>
            <a href="#infos" className="hide-sm">
              Infos
            </a>
            <button type="button" className="icon-btn" onClick={toggleSound} aria-label={soundLabel} title={soundLabel}>
              {!soundOn || muted ? <SoundOff /> : <SoundOn />}
            </button>
          </nav>
        </div>
      </header>

      <main className="site" id="top">
        <section className="hero wrap">
          <div className="hero-in">
            {live ? (
              <p className="eyebrow">
                <span className="dot" />
                Match en cours
              </p>
            ) : (
              <p className="eyebrow">{db?.settings.dates}</p>
            )}
            <h1>
              Bienvenue dans <span className="gold">l&rsquo;arène</span>
            </h1>
            <p>
              Deux jours, deux tournois, une seule école. Jour&nbsp;1&nbsp;: les garçons. Jour&nbsp;2&nbsp;: les filles. Élimination directe&nbsp;: tu perds, tu sors. Scores, buteurs et tableau en direct sur ton téléphone.
            </p>
            <div className="ctas">
              <a className="btn btn-gold" href="#direct">
                Voir le direct
              </a>
              <a className="btn btn-glass" href="#tableau">
                Voir le tableau
              </a>
            </div>
          </div>
        </section>
        {db && (
          <>
            <Ticker db={db} />
            <LiveSection db={db} />
            <BracketSection db={db} />
            <ScorersSection db={db} lastScorer={lastScorer} />
            <TeamsSection db={db} />
            <InfoSection db={db} />
          </>
        )}
        <footer className="footer wrap">
          <div className="footer-in">
            <span>
              {db?.settings.name ?? 'School Cup'} · {db?.settings.school ?? 'Lycée Sacré-Cœur La Salle'}, {db?.settings.city ?? 'Angers'}
            </span>
            <span>
              Site réalisé par Pierre MOALIC · <a href={asset('admin')}>Espace organisateurs</a>
            </span>
          </div>
          {/* Crédit obligatoire de la licence CC BY 4.0 de la musique. */}
          <p className="credits">
            Musique : «&nbsp;
            <a href="https://budgetpixel.com/background-music/arena-hype-anthem-2a10f6b2" target="_blank" rel="noopener noreferrer">
              Arena Hype Anthem
            </a>
            &nbsp;» par BudgetPixel AI —{' '}
            <a href="https://creativecommons.org/licenses/by/4.0/deed.fr" target="_blank" rel="noopener noreferrer">
              CC BY 4.0
            </a>{' '}
            — modifié (coupé, bouclé, mixé)
          </p>
        </footer>
      </main>

      <nav className="tabbar" aria-label="Navigation">
        {(
          [
            ['direct', 'Direct', <Live key="i" size={20} />],
            ['tableau', 'Tableau', <Bracket key="i" size={20} />],
            ['buteurs', 'Buteurs', <Boot key="i" size={20} />],
            ['equipes', 'Équipes', <Users key="i" size={20} />],
            ['infos', 'Infos', <Info key="i" size={20} />],
          ] as const
        ).map(([id, label, icon]) => (
          <a key={id} href={`#${id}`} aria-current={current === id}>
            {id === 'direct' && live && <span className="dot" />}
            {icon}
            {label}
          </a>
        ))}
      </nav>

      {goal && (
        <div className="goal" key={goal.key} role="status" aria-live="assertive">
          <img className="goal-crest" src={asset('logo/ecusson.webp')} alt="" aria-hidden="true" />
          <p className="goal-word">BUUUT !</p>
          <p className="goal-who">
            {goal.who}
            <small>{goal.team}</small>
          </p>
        </div>
      )}
    </>
  )
}
