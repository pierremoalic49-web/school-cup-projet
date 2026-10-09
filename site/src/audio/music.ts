// La musique du site : « Arena Hype Anthem » de BudgetPixel AI (licence CC BY 4.0, crédit dans le pied de page).
// - Elle démarre au clic sur « Entrer dans le stade », réglée pour que l'entrée de la batterie
//   (le moment le plus fort, à 9,56 s dans le morceau) tombe pile sur l'arrivée au bord du terrain.
// - Ensuite elle tourne en boucle sans coupure, plus bas, sous la rumeur de la foule.
// - Elle s'efface quelques secondes sur chaque « BUUUT ! » pour laisser passer la clameur.
import { audioGraph } from './sound'

const URL = '/sons/arena-hype-anthem.mp3'
/** Entrée de la batterie, mesurée sur la forme d'onde du morceau (en secondes). */
export const MUSIC_DROP = 9.56
// La boucle va de l'entrée de la batterie jusqu'avant la fin du morceau, avec 1,5 s de fondu enchaîné.
const LOOP_START = MUSIC_DROP
const LOOP_END = 47.4
const XFADE = 1.5

const LEVEL_INTRO = 0.6 // pendant la cinématique
const LEVEL_BED = 0.24 // après l'arrivée, sous la foule
const LEVEL_FAR = 0.12 // après 2 minutes : simple ambiance

let buffer: AudioBuffer | null = null
let loading: Promise<AudioBuffer | null> | null = null
let bus: GainNode | null = null // volume de la musique (baisse pendant les buts)
let current: { node: AudioBufferSourceNode; gain: GainNode } | null = null
let t0 = 0 // instant (horloge audio) où le morceau serait à 0 s
let base = LEVEL_INTRO
let farTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Prépare la boucle sans coupure : les 1,5 dernières secondes de la boucle sont fondues avec
 * les 1,5 secondes qui précèdent son début. Quand la lecture saute de la fin au début, on n'entend rien.
 */
function bakeLoop(src: AudioBuffer, off: OfflineAudioContext): AudioBuffer {
  const sr = src.sampleRate
  // createBuffer marche aussi sur les vieux Safari (le constructeur « new AudioBuffer » non).
  const out = off.createBuffer(src.numberOfChannels, src.length, sr)
  const n = Math.floor(XFADE * sr)
  const end = Math.floor(LOOP_END * sr)
  const start = Math.floor(LOOP_START * sr)
  for (let ch = 0; ch < src.numberOfChannels; ch++) {
    const a = src.getChannelData(ch)
    const o = out.getChannelData(ch)
    o.set(a)
    for (let i = 0; i < n; i++) {
      const f = i / n
      // Fondu « à puissance constante » : le volume ne creuse pas au milieu.
      o[end - n + i] = a[end - n + i] * Math.cos((f * Math.PI) / 2) + a[start - n + i] * Math.sin((f * Math.PI) / 2)
    }
  }
  return out
}

/** Télécharge et prépare la musique à l'avance (pendant la vue du ciel), sans rien jouer. */
export function preloadMusic(): Promise<AudioBuffer | null> {
  loading ??= (async () => {
    try {
      const res = await fetch(URL)
      if (!res.ok) throw new Error(`Musique introuvable (${res.status})`)
      const data = await res.arrayBuffer()
      // Un contexte « hors ligne » décode sans avoir besoin d'un clic de l'utilisateur.
      const OAC = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext
      if (!OAC) return null
      const off = new OAC(2, 1, 44100)
      // Vieux Safari : decodeAudioData ne renvoie pas de promesse, on passe par les rappels.
      const decoded = await new Promise<AudioBuffer>((ok, ko) => {
        const p = off.decodeAudioData(data, ok, ko)
        if (p && typeof p.then === 'function') p.then(ok, ko)
      })
      buffer = bakeLoop(decoded, off)
      return buffer
    } catch (e) {
      console.warn('Musique indisponible', e)
      return null
    }
  })()
  return loading
}

function ensureBus() {
  const g = audioGraph()
  if (!g) return null
  if (!bus) {
    bus = g.ctx.createGain()
    bus.gain.value = base
    bus.connect(g.master)
  }
  return g
}

/** Lance une lecture à la position `offset` du morceau (négatif = démarrer un peu plus tard). */
function play(offset: number, fadeIn: number) {
  const g = ensureBus()
  if (!g || !buffer || !bus) return
  const { ctx } = g
  // Position au-delà de la boucle (fichier arrivé très en retard) : on la ramène dans la boucle.
  if (offset > LOOP_END) offset = LOOP_START + ((offset - LOOP_START) % (LOOP_END - LOOP_START))
  const node = ctx.createBufferSource()
  node.buffer = buffer
  node.loop = true
  node.loopStart = LOOP_START
  node.loopEnd = LOOP_END
  const gain = ctx.createGain()
  const now = ctx.currentTime
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(1, now + Math.max(0.02, fadeIn))
  node.connect(gain)
  gain.connect(bus)
  if (offset >= 0) node.start(now, offset)
  else node.start(now - offset, 0)
  t0 = now - offset
  // L'ancienne lecture s'efface en douceur (fondu enchaîné).
  if (current) {
    const old = current
    old.gain.gain.cancelScheduledValues(now)
    old.gain.gain.setTargetAtTime(0.0001, now, 0.05)
    old.node.stop(now + 0.4)
  }
  current = { node, gain }
}

export const music = {
  /** Où en est la lecture dans le morceau (en secondes), ou null si la musique ne joue pas. */
  position(): number | null {
    const g = audioGraph()
    if (!g || !current) return null
    const p = g.ctx.currentTime - t0
    return p < LOOP_END ? p : LOOP_START + ((p - LOOP_START) % (LOOP_END - LOOP_START))
  },

  /** Au clic : la batterie entrera dans `dropIn` secondes (la durée du vol). */
  start(dropIn: number) {
    if (!ensureBus()) return
    base = LEVEL_INTRO
    bus!.gain.value = base
    const clickedAt = performance.now()
    void preloadMusic().then(() => {
      // Si le fichier arrive en retard, on rattrape : la batterie tombe quand même à l'arrivée.
      const late = (performance.now() - clickedAt) / 1000
      play(MUSIC_DROP - dropIn + late, 1.2)
    })
  },

  /** Arrivée dans le stade : si on a passé la cinématique, on saute directement à la batterie. Puis la musique baisse. */
  arrived() {
    const g = audioGraph()
    if (!g || !bus) return
    const pos = g.ctx.currentTime - t0
    if (current && pos < MUSIC_DROP - 0.35) play(MUSIC_DROP - 0.04, 0.08)
    const now = g.ctx.currentTime
    base = LEVEL_BED
    bus.gain.cancelScheduledValues(now)
    bus.gain.setTargetAtTime(base, now + 4, 1.6)
    if (farTimer) clearTimeout(farTimer)
    farTimer = setTimeout(() => {
      base = LEVEL_FAR
      const c = audioGraph()
      if (c && bus) bus.gain.setTargetAtTime(base, c.ctx.currentTime, 4)
    }, 120_000)
  },

  /** Son activé plus tard (lien direct vers une section) : la musique démarre doucement, déjà en fond. */
  ambient() {
    if (!ensureBus() || current) return
    base = LEVEL_BED
    bus!.gain.value = base
    void preloadMusic().then(() => play(LOOP_START, 3))
  },

  /** Volume actuel de la musique (pour vérifier la baisse pendant les buts). */
  level(): number | null {
    return bus ? bus.gain.value : null
  },

  /** « BUUUT ! » : la musique s'efface 3,5 s pour laisser passer la foule, puis revient. */
  duck() {
    const g = audioGraph()
    if (!g || !bus) return
    const now = g.ctx.currentTime
    bus.gain.cancelScheduledValues(now)
    bus.gain.setTargetAtTime(0.03, now, 0.08)
    bus.gain.setTargetAtTime(base, now + 3.5, 0.9)
  },
}

// En développement, la musique est accessible dans la console (window.__music) pour la vérifier.
if (import.meta.env.DEV) (window as unknown as { __music: typeof music }).__music = music
