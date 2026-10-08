// Le chef d'orchestre de la 3D : il construit le stade, fait tourner l'animation (60 fois par
// seconde) et dirige la caméra comme un réalisateur : vue du ciel → cinématique → bord du terrain
// → vue drone quand on fait défiler la page.
import * as THREE from 'three'
import { crowdUniforms, flashUniforms } from './crowd'
import { buildConfetti, buildSmoke } from './effects'
import { beamUniforms, buildLights } from './lights'
import { buildPitch } from './pitch'
import { buildLineup } from './players'
import { buildPost } from './post'
import { buildScreens, type ScreenInfo } from './screens'
import { buildStands } from './stands'
import { clamp01, detectTier, seeded, smooth, type Tier } from './util'
import { buildCity, buildEnvironment, buildSky, worldUniforms } from './world'

export type Phase = 'aerial' | 'flight' | 'arrived'

/** Courbe lisse qui passe par des « images clés » (temps, valeur). */
function track(keys: [number, number][], t: number) {
  if (t <= keys[0][0]) return keys[0][1]
  const last = keys[keys.length - 1]
  if (t >= last[0]) return last[1]
  let i = 0
  while (keys[i + 1][0] < t) i++
  const [t0, v0] = keys[i]
  const [t1, v1] = keys[i + 1]
  const slope = (j: number) => {
    const a = keys[Math.max(0, j - 1)]
    const b = keys[Math.min(keys.length - 1, j + 1)]
    return (b[1] - a[1]) / (b[0] - a[0] || 1)
  }
  const h = t1 - t0
  const s = (t - t0) / h
  const m0 = slope(i) * h
  const m1 = slope(i + 1) * h
  const s2 = s * s
  const s3 = s2 * s
  return (2 * s3 - 3 * s2 + 1) * v0 + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * v1 + (s3 - s2) * m1
}

export const FLIGHT_SECONDS = 7.2
// Position d'arrivée : au bord de la touche, devant les panneaux LED, à hauteur d'homme.
const ARRIVE = new THREE.Vector3(0, 1.75, 35.4)

export class Stadium {
  readonly tier: Tier
  phase: Phase = 'aerial'
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private post: ReturnType<typeof buildPost> | null = null
  private pitch!: ReturnType<typeof buildPitch>
  private screens!: ReturnType<typeof buildScreens>
  private confetti!: ReturnType<typeof buildConfetti>
  private smoke!: ReturnType<typeof buildSmoke>
  private lineup!: ReturnType<typeof buildLineup>
  private timer = new THREE.Timer()
  private time = 0
  private raf = 0
  private flightStart = 0
  private flightFrom = { a: 0, r: 80, h: 235 }
  private flightSweep = 0
  private scroll = 0
  private scrollTarget = 0
  private shake = 0
  private celebrate = 0
  private flashPhase = 0
  private pixelRatio: number
  private frameTimes: number[] = []
  private reduced: boolean
  onFlightTime?: (sec: number) => void
  onArrive?: () => void
  /** Appelé si la 3D ne peut plus fonctionner : le site passe alors sur le fond fixe. */
  onFatal?: () => void
  private renderErrors = 0
  private dead = false

  private canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement, opts: { reducedMotion: boolean }) {
    this.canvas = canvas
    this.reduced = opts.reducedMotion
    this.tier = detectTier()
    const t = this.tier
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false })
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, t === 'high' ? 1.5 : t === 'mid' ? 1.5 : 1)
    this.renderer.setPixelRatio(this.pixelRatio)
    this.renderer.setSize(window.innerWidth, window.innerHeight, false)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.shadowMap.enabled = t !== 'low'
    // PCF : ombres douces (PCFSoftShadowMap a été retiré de Three.js, la douceur vient de shadow.radius).
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.shadowMap.autoUpdate = false

    this.camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.3, 4000)
    this.scene.fog = new THREE.FogExp2(0x0a0e1c, 0.00075)
    this.scene.environment = buildEnvironment(this.renderer)
    this.scene.environmentIntensity = 0.6

    const rand = seeded(2027)
    buildSky(this.scene)
    buildCity(this.scene, t, rand)
    this.pitch = buildPitch(this.scene, this.renderer, t)
    buildStands(this.scene, t, rand)
    buildLights(this.scene, t)
    this.screens = buildScreens(this.scene)
    this.lineup = buildLineup(this.scene)
    this.confetti = buildConfetti(this.scene, t)
    this.smoke = buildSmoke(this.scene, t)
    if (t !== 'low') this.post = buildPost(this.renderer, this.scene, this.camera, t)

    this.renderer.shadowMap.needsUpdate = true
    // En développement, le stade est accessible dans la console (window.__stadium) pour le déboguer.
    if (import.meta.env.DEV) (window as unknown as { __stadium: Stadium }).__stadium = this
    this.aerialPose(0)
    window.addEventListener('resize', this.resize)
    document.addEventListener('visibilitychange', this.onVisibility)
    // Sur téléphone, le système peut reprendre la carte graphique (appel, autre appli lourde…).
    canvas.addEventListener('webglcontextlost', this.onContextLost)
    this.loop()
  }

  private onContextLost = (e: Event) => {
    e.preventDefault()
    this.fail()
  }

  /** La 3D abandonne proprement : on arrête l'animation et on prévient le site. */
  private fail() {
    if (this.dead) return
    this.dead = true
    cancelAnimationFrame(this.raf)
    this.onFatal?.()
  }

  /** Attend la police Anton (pour le logo peint et le tifo), mais jamais plus d'1,5 s. */
  static async create(canvas: HTMLCanvasElement, opts: { reducedMotion: boolean }) {
    await Promise.race([document.fonts?.load('400 64px Anton'), new Promise((r) => setTimeout(r, 1500))]).catch(() => {})
    const s = new Stadium(canvas, opts)
    // On prépare TOUS les programmes de dessin maintenant (pendant « Le stade s'allume… »),
    // sinon le navigateur les prépare en plein vol et l'image se fige plusieurs secondes.
    await Promise.race([s.renderer.compileAsync(s.scene, s.camera), new Promise((r) => setTimeout(r, 6000))]).catch(() => {})
    s.checkPost()
    return s
  }

  /**
   * Certaines cartes graphiques ratent les effets d'image et affichent un écran noir.
   * On dessine une image avec et sans effets : si la version « avec » est noire, on s'en passe.
   */
  private checkPost() {
    if (!this.post) return
    const gl = this.renderer.getContext()
    const sample = () => {
      const w = gl.drawingBufferWidth
      const h = gl.drawingBufferHeight
      const px = new Uint8Array(4)
      let sum = 0
      for (const [fx, fy] of [
        [0.5, 0.5],
        [0.35, 0.45],
        [0.65, 0.45],
        [0.5, 0.35],
        [0.5, 0.62],
      ]) {
        gl.readPixels(Math.floor(w * fx), Math.floor(h * fy), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
        sum += px[0] + px[1] + px[2]
      }
      return sum
    }
    try {
      this.renderer.setRenderTarget(null)
      this.renderer.render(this.scene, this.camera)
      const direct = sample()
      this.post.composer.render(0)
      const withPost = sample()
      if (direct > 150 && withPost < direct * 0.2) {
        console.warn('Effets d’image désactivés : ils donnent un écran noir sur cet appareil.')
        this.post = null
      }
    } catch {
      this.post = null
    }
  }

  /* ----------------------------- Caméra ----------------------------- */

  private aerialAngle(t: number) {
    return t * (this.reduced ? 0.01 : 0.03) + 0.7
  }
  /** Angle de vue au bord du terrain : plus large en portrait pour voir la tribune entière. */
  private arrivalFov() {
    const a = this.camera.aspect
    if (a >= 1) return 50
    const v = (2 * Math.atan(Math.tan((55 * Math.PI) / 360) / a) * 180) / Math.PI
    return Math.min(72, Math.max(50, v))
  }
  /** Sur un téléphone en portrait, on monte plus haut pour voir tout le stade. */
  private aerialHeight() {
    return 235 * Math.min(1.6, Math.max(1, 0.8 / this.camera.aspect))
  }
  private aerialPose(t: number) {
    const a = this.aerialAngle(t)
    this.camera.position.set(Math.sin(a) * 80, this.aerialHeight(), Math.cos(a) * 80)
    this.camera.up.set(0, 1, 0)
    this.camera.fov = 42
    this.camera.updateProjectionMatrix()
    this.camera.lookAt(0, 0, 0)
  }

  startFlight() {
    if (this.phase !== 'aerial') return
    if (this.reduced) {
      this.arrive()
      return
    }
    const a0 = this.aerialAngle(this.time)
    // On tourne vers l'angle d'arrivée (côté +z) par le chemin le plus court.
    let sweep = (((-a0 % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2))
    if (sweep > Math.PI) sweep -= Math.PI * 2
    if (Math.abs(sweep) < 0.6) sweep += sweep >= 0 ? 0.9 : -0.9
    this.flightFrom = { a: a0, r: 80, h: this.aerialHeight() }
    this.flightSweep = sweep
    this.flightStart = this.time
    this.phase = 'flight'
  }

  private flightPose(sec: number) {
    const u = clamp01(sec / FLIGHT_SECONDS)
    const T = FLIGHT_SECONDS
    const { a: a0 } = this.flightFrom
    const s = this.flightSweep
    const a = track([[0, a0], [0.12 * T, a0 + s * 0.12], [0.46 * T, a0 + s * 0.88], [0.64 * T, a0 + s * 0.985], [T, a0 + s]], sec)
    const r = track([[0, 80], [0.3 * T, 155], [0.46 * T, 72], [0.64 * T, 47], [T, ARRIVE.z]], sec)
    const h = track([[0, this.flightFrom.h], [0.3 * T, 118], [0.46 * T, 31], [0.64 * T, 8.5], [0.86 * T, 3.2], [T, ARRIVE.y]], sec)
    const ly = track([[0, 0], [0.5 * T, 0], [0.7 * T, 2.2], [T, 1.4]], sec)
    const lz = track([[0, 0], [0.5 * T, -2], [T, -2]], sec)
    const end = this.arrivalFov()
    const fov = track([[0, 42], [0.25 * T, 56], [0.5 * T, Math.max(70, end + 8)], [0.75 * T, Math.max(62, end + 4)], [T, end]], sec)
    this.camera.position.set(Math.sin(a) * r, h, Math.cos(a) * r)
    this.camera.up.set(Math.sin(u * Math.PI) * 0.09 * Math.sign(s), 1, 0).normalize()
    this.camera.lookAt(0, ly, lz)
    this.camera.fov = fov
    this.camera.updateProjectionMatrix()
    // Flou de vitesse : fort au milieu du vol, nul à l'arrivée.
    if (this.post) this.post.grade.uBlur.value = Math.sin(u * Math.PI) ** 2 * 0.09
  }

  private arrivedPose(dt: number) {
    this.scroll += (this.scrollTarget - this.scroll) * Math.min(1, dt * 3)
    const s = smooth(clamp01(this.scroll))
    const t = this.time
    const drift = Math.sin(t * 0.09) * 5
    // Vue drone : on monte et on tourne autour du stade en faisant défiler.
    const a = Math.atan2(drift, ARRIVE.z) - s * 0.85
    const r = ARRIVE.z + 58 * s
    const h = ARRIVE.y + 74 * Math.pow(s, 1.15)
    const hand = this.reduced ? 0 : 1
    this.camera.position.set(Math.sin(a) * r, h + Math.sin(t * 0.7) * 0.03 * hand, Math.cos(a) * r)
    this.camera.up.set(0, 1, 0)
    this.camera.lookAt(drift * 0.25 * (1 - s), 1.4 * (1 - s), -2 * (1 - s))
    const fov = this.arrivalFov()
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 2)
      this.camera.updateProjectionMatrix()
    }
  }

  /** Arrivée au bord du terrain : flash, confettis des 4 coins, fumigènes. */
  arrive() {
    if (this.phase === 'arrived') return
    this.phase = 'arrived'
    this.shake = this.reduced ? 0 : 0.35
    this.celebrate = 3.5
    if (!this.reduced) {
      for (const [x, z] of [
        [-50, 32],
        [50, 32],
        [-50, -32],
        [50, -32],
      ])
        this.confetti.burst(x, 1, z, this.tier === 'low' ? 110 : 260, 24)
      this.smoke.ignite(5)
    }
    if (this.post) this.post.grade.uBlur.value = 0
    this.arrivedPose(1)
    this.onArrive?.()
  }

  setScroll(t: number) {
    this.scrollTarget = t
  }

  /** La célébration d'un but, du côté de l'équipe qui marque (-1 = gauche, 1 = droite). */
  celebrateGoal(side: -1 | 1) {
    this.celebrate = 5
    this.shake = this.reduced ? 0 : 0.5
    if (this.reduced) return
    const x = side * 46
    this.confetti.burst(x, 2, 30, this.tier === 'low' ? 160 : 420, 26)
    this.confetti.burst(x, 2, -30, this.tier === 'low' ? 160 : 420, 26)
    this.confetti.burst(0, 2, 34, this.tier === 'low' ? 80 : 240, 20)
    this.smoke.ignite(4)
  }

  setScreen(info: ScreenInfo) {
    this.screens.setInfo(info)
  }
  setTeams(a: [string, string], b: [string, string]) {
    this.lineup.setTeams(a, b)
  }

  /* --------------------------- Boucle d'animation --------------------------- */

  private loop = () => {
    if (this.dead) return
    this.raf = requestAnimationFrame(this.loop)
    try {
      this.frame()
      this.renderErrors = 0
    } catch (e) {
      // Une image ratée n'est pas grave ; si ça se répète, on retire les effets, puis on abandonne la 3D.
      console.error(e)
      this.renderErrors++
      if (this.renderErrors === 3 && this.post) {
        this.post = null
        this.renderErrors = 0
      } else if (this.renderErrors >= 3) this.fail()
    }
  }

  private frame() {
    this.timer.update()
    // Le temps avance « pour de vrai » (la cinématique dure 7 s même si l'appareil rame),
    // mais on évite les sauts énormes au retour d'un autre onglet.
    const dt = Math.min(0.12, this.timer.getDelta())
    this.time += dt
    const t = this.time

    if (this.phase === 'aerial') this.aerialPose(t)
    else if (this.phase === 'flight') {
      const sec = t - this.flightStart
      this.flightPose(sec)
      this.onFlightTime?.(sec)
      if (sec >= FLIGHT_SECONDS) this.arrive()
    } else this.arrivedPose(dt)

    if (this.shake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.6
      this.shake = Math.max(0, this.shake - dt * 0.7)
    }

    // La foule s'excite pendant le vol et explose sur un but.
    const hypeTarget = this.celebrate > 0 ? 1 : this.phase === 'flight' ? 0.6 : 0.3
    crowdUniforms.uHype.value += (hypeTarget - crowdUniforms.uHype.value) * Math.min(1, dt * 2)
    const jumpTarget = this.celebrate > 0 ? 1 : 0
    crowdUniforms.uJump.value += (jumpTarget - crowdUniforms.uJump.value) * Math.min(1, dt * 4)
    crowdUniforms.uOla.value = this.reduced ? 0 : 1
    crowdUniforms.uTime.value = this.reduced ? 0 : t
    this.flashPhase += dt * (this.celebrate > 0 ? 7 : 1)
    flashUniforms.uPhase.value = this.flashPhase
    flashUniforms.uScale.value = window.innerHeight * this.pixelRatio * 0.9
    beamUniforms.uTime.value = t
    beamUniforms.uBoost.value = 1 + (this.celebrate > 0 ? 0.25 * Math.max(0, Math.sin(t * 18)) : 0)
    worldUniforms.uTime.value = t
    if (this.celebrate > 0) this.celebrate -= dt

    this.pitch.update(t)
    this.screens.update(t, dt)
    this.confetti.update(t, dt)
    this.smoke.update(t, dt)

    if (this.post) {
      const g = this.post.grade
      g.uTime.value = t
    }

    if (this.post) this.post.composer.render(dt)
    else this.renderer.render(this.scene, this.camera)
    this.adapt(dt)
  }

  /** Si l'appareil peine (moins de ~40 images/s), on baisse un peu la résolution. */
  private adapt(dt: number) {
    // On ignore les 3 premières secondes (chargement) et les à-coups isolés (changement d'onglet…).
    if (this.time < 3 || dt >= 0.1) return
    this.frameTimes.push(dt)
    if (this.frameTimes.length < 90) return
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
    this.frameTimes.length = 0
    if (avg > 1 / 40 && this.pixelRatio > 0.7) {
      this.pixelRatio = Math.max(0.7, this.pixelRatio * 0.82)
      this.resize()
    }
  }

  private resize = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    this.renderer.setPixelRatio(this.pixelRatio)
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    if (this.post) {
      this.post.composer.setPixelRatio(this.pixelRatio)
      this.post.composer.setSize(w, h)
    }
  }

  private onVisibility = () => {
    // On arrête toujours la boucle en cours avant d'en relancer une (sinon elle tournerait en double).
    cancelAnimationFrame(this.raf)
    if (!document.hidden) {
      this.timer.update()
      this.loop()
    }
  }

  dispose() {
    this.dead = true
    cancelAnimationFrame(this.raf)
    window.removeEventListener('resize', this.resize)
    document.removeEventListener('visibilitychange', this.onVisibility)
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost)
    this.renderer.dispose()
  }

  get canvasElement() {
    return this.canvas
  }
}
