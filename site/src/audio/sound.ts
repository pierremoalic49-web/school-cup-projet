// Le son du stade, fabriqué par le navigateur (Web Audio) : rumeur de foule, applaudissements
// rythmés, clameur, coup de sifflet, coup grave. Si de vrais fichiers sont déposés dans
// public/sons/ (foule.mp3, but.mp3, sifflet.mp3), ils sont utilisés à la place.
// Rien ne démarre tout seul : tout commence au clic sur « Entrer dans le stade ».

type Ctx = AudioContext

let ctx: Ctx | null = null
let master: GainNode
let crowdGain: GainNode
let crowdFilter: BiquadFilterNode
let roarGain: GainNode
let roarFilter: BiquadFilterNode
let muted = false
const files: Partial<Record<'foule' | 'but' | 'sifflet', AudioBuffer>> = {}

function noiseBuffer(c: Ctx, seconds: number) {
  const len = Math.floor(c.sampleRate * seconds)
  const buf = c.createBuffer(2, len, c.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    let b0 = 0
    let b1 = 0
    let b2 = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      b0 = 0.99765 * b0 + w * 0.099046
      b1 = 0.963 * b1 + w * 0.2965164
      b2 = 0.57 * b2 + w * 1.0526913
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.11
    }
  }
  return buf
}

async function tryLoad(name: 'foule' | 'but' | 'sifflet') {
  // Jamais plus de 6 s d'attente (4G lente) : sinon on garde le son généré.
  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), 6000)
  try {
    const r = await fetch(`/sons/${name}.mp3`, { signal: abort.signal })
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('audio')) return
    files[name] = await ctx!.decodeAudioData(await r.arrayBuffer())
  } catch {
    /* pas de fichier : on garde le son généré */
  } finally {
    clearTimeout(timer)
  }
}

/** Charge les vrais sons en arrière-plan ; la rumeur générée laisse la place au vrai enregistrement. */
async function loadFiles() {
  await Promise.all([tryLoad('foule'), tryLoad('but'), tryLoad('sifflet')])
  if (files.foule && ctx && procCrowd) {
    const s = ctx.createBufferSource()
    s.buffer = files.foule
    s.loop = true
    s.connect(crowdGain)
    s.start()
    procCrowd.gain.setTargetAtTime(0, ctx.currentTime, 0.5)
  }
}
let procCrowd: GainNode | null = null

/** Une « chorale » de voix (oscillateurs filtrés comme une voyelle « ooo / aaa ») : le cœur d'une clameur. */
function buildRoar(c: Ctx, out: AudioNode) {
  roarGain = c.createGain()
  roarGain.gain.value = 0
  roarFilter = c.createBiquadFilter()
  roarFilter.type = 'bandpass'
  roarFilter.frequency.value = 700
  roarFilter.Q.value = 0.7
  const formant = c.createBiquadFilter()
  formant.type = 'peaking'
  formant.frequency.value = 1100
  formant.gain.value = 8
  roarFilter.connect(formant)
  formant.connect(roarGain)
  roarGain.connect(out)
  for (let i = 0; i < 26; i++) {
    const o = c.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = 150 + Math.random() * 260
    const vib = c.createOscillator()
    vib.frequency.value = 3 + Math.random() * 4
    const vg = c.createGain()
    vg.gain.value = 4 + Math.random() * 6
    vib.connect(vg)
    vg.connect(o.frequency)
    const g = c.createGain()
    g.gain.value = 0.018
    const pan = c.createStereoPanner()
    pan.pan.value = Math.random() * 2 - 1
    o.connect(g)
    g.connect(pan)
    pan.connect(roarFilter)
    o.start()
    vib.start()
  }
  // Un souffle de bruit en plus pour le côté « foule ».
  const n = c.createBufferSource()
  n.buffer = noiseBuffer(c, 2.5)
  n.loop = true
  const ng = c.createGain()
  ng.gain.value = 0.9
  n.connect(ng)
  ng.connect(roarFilter)
  n.start()
}

function buildCrowd(c: Ctx, out: AudioNode) {
  crowdGain = c.createGain()
  crowdGain.gain.value = 0
  crowdFilter = c.createBiquadFilter()
  crowdFilter.type = 'bandpass'
  crowdFilter.frequency.value = 800
  crowdFilter.Q.value = 0.55
  // La rumeur générée passe par procCrowd, qu'on peut éteindre si un vrai enregistrement arrive.
  const proc = c.createGain()
  procCrowd = proc
  proc.connect(crowdGain)
  crowdFilter.connect(proc)
  crowdGain.connect(out)
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, 4)
  src.loop = true
  src.connect(crowdFilter)
  src.start()
  // Bavardages : des formants qui s'allument et s'éteignent au hasard.
  const chatter = c.createBufferSource()
  chatter.buffer = noiseBuffer(c, 3)
  chatter.loop = true
  for (const f of [420, 1250, 2600]) {
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = f
    bp.Q.value = 4
    const g = c.createGain()
    g.gain.value = 0.25
    chatter.connect(bp)
    bp.connect(g)
    g.connect(proc)
    setInterval(() => {
      if (!ctx) return
      g.gain.setTargetAtTime(0.1 + Math.random() * 0.45, ctx.currentTime, 0.12)
    }, 180 + Math.random() * 200)
  }
  chatter.start()
  setInterval(() => {
    if (!ctx) return
    crowdFilter.frequency.setTargetAtTime(650 + Math.random() * 450, ctx.currentTime, 0.5)
  }, 700)
  // Applaudissements rythmés de temps en temps : « clap clap, clap clap clap ».
  setInterval(() => {
    if (!ctx || Math.random() < 0.45) return
    const t0 = ctx.currentTime + 0.1
    ;[0, 0.32, 0.84, 1.08, 1.32].forEach((d) => clap(t0 + d, 0.3))
  }, 7000)
}

function clap(when: number, level: number) {
  if (!ctx) return
  // Des centaines de mains jamais parfaitement synchronisées : plusieurs petits bruits décalés.
  for (let k = 0; k < 6; k++) {
    const s = ctx.createBufferSource()
    const len = Math.floor(ctx.sampleRate * 0.05)
    const b = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = b.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3)
    s.buffer = b
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 900 + Math.random() * 800
    const g = ctx.createGain()
    g.gain.value = level * 0.5
    s.connect(hp)
    hp.connect(g)
    g.connect(master)
    s.start(when + Math.random() * 0.045)
  }
}

export const sound = {
  get muted() {
    return muted
  },
  get started() {
    return !!ctx
  },

  /**
   * À appeler au clic (les navigateurs interdisent le son avant une action de l'utilisateur).
   * Ne bloque jamais : le son démarre tout de suite, les vrais fichiers éventuels arrivent ensuite.
   * Si le son est impossible (vieux navigateur, mode économie), le site continue en silence.
   */
  start() {
    try {
      if (ctx) {
        if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
        return
      }
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return
      const c = new AC()
      master = c.createGain()
      master.gain.value = muted ? 0 : 0.9
      const comp = c.createDynamicsCompressor()
      master.connect(comp)
      comp.connect(c.destination)
      ctx = c
      buildCrowd(c, master)
      buildRoar(c, master)
      if (c.state === 'suspended') void c.resume().catch(() => {})
      void loadFiles()
    } catch (e) {
      console.warn('Son indisponible', e)
      ctx = null
    }
  },

  /** Volume de la rumeur (0 à 1), avec une transition douce. */
  crowd(level: number, seconds = 0.8) {
    if (!ctx) return
    crowdGain.gain.cancelScheduledValues(ctx.currentTime)
    crowdGain.gain.setTargetAtTime(level, ctx.currentTime, seconds / 3)
  },

  /** La clameur d'un but ou de l'arrivée. */
  roar(strength = 1) {
    if (!ctx) return
    const t = ctx.currentTime
    if (files.but) {
      const s = ctx.createBufferSource()
      s.buffer = files.but
      const g = ctx.createGain()
      g.gain.value = strength
      s.connect(g)
      g.connect(master)
      s.start()
    }
    roarGain.gain.cancelScheduledValues(t)
    roarGain.gain.setTargetAtTime(0.75 * strength, t, 0.12)
    roarGain.gain.setTargetAtTime(0, t + 2.6, 1.1)
    roarFilter.frequency.cancelScheduledValues(t)
    roarFilter.frequency.setTargetAtTime(1150, t, 0.2)
    roarFilter.frequency.setTargetAtTime(650, t + 2.2, 1.2)
    crowdGain.gain.setTargetAtTime(0.7, t, 0.15)
    crowdGain.gain.setTargetAtTime(0.18, t + 2.8, 1.4)
    ;[0.3, 0.62, 0.94].forEach((d) => clap(t + 1.6 + d, 0.6))
  },

  whistle(pattern: [number, number][] = [[0, 0.22], [0.32, 0.75]]) {
    if (!ctx) return
    const t = ctx.currentTime
    if (files.sifflet) {
      const s = ctx.createBufferSource()
      s.buffer = files.sifflet
      s.connect(master)
      s.start()
      return
    }
    for (const [start, dur] of pattern) {
      const o = ctx.createOscillator()
      const lfo = ctx.createOscillator()
      const lg = ctx.createGain()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = 3050
      lfo.frequency.value = 34
      lg.gain.value = 150
      lfo.connect(lg)
      lg.connect(o.frequency)
      o.connect(g)
      g.connect(master)
      g.gain.setValueAtTime(0.0001, t + start)
      g.gain.exponentialRampToValueAtTime(0.13, t + start + 0.02)
      g.gain.setValueAtTime(0.13, t + start + dur - 0.04)
      g.gain.exponentialRampToValueAtTime(0.0001, t + start + dur)
      o.start(t + start)
      lfo.start(t + start)
      o.stop(t + start + dur + 0.05)
      lfo.stop(t + start + dur + 0.05)
    }
  },

  boom() {
    if (!ctx) return
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(110, t)
    o.frequency.exponentialRampToValueAtTime(34, t + 1)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.6, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3)
    o.connect(g)
    g.connect(master)
    o.start(t)
    o.stop(t + 1.4)
  },

  setMuted(m: boolean) {
    muted = m
    if (ctx) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05)
  },
}
