// La scène de révélation d'un joueur : dans le noir, un projecteur s'allume au-dessus d'un sol sombre et
// brillant, deux contre-jours dessinent la silhouette, de la fumée traîne au sol, des particules dorées montent.
import * as THREE from 'three'
import { loadCharacter, type Character } from './character'
import type { KitOptions } from './kit'

function softDisc(inner: string, outer = 'rgba(255,255,255,0)') {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const x = c.getContext('2d')!
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, inner)
  g.addColorStop(1, outer)
  x.fillStyle = g
  x.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function smokeTex() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const x = c.getContext('2d')!
  for (let i = 0; i < 22; i++) {
    const px = 30 + Math.random() * 68
    const py = 40 + Math.random() * 48
    const r = 16 + Math.random() * 26
    const g = x.createRadialGradient(px, py, 0, px, py, r)
    g.addColorStop(0, 'rgba(255,255,255,0.18)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = g
    x.fillRect(0, 0, 128, 128)
  }
  return new THREE.CanvasTexture(c)
}

export class Reveal {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(26, 1, 0.1, 60)
  private timer = new THREE.Timer()
  private raf = 0
  private character: Character | null = null
  private smoke: THREE.Sprite[] = []
  private dust!: THREE.Points
  private spot!: THREE.SpotLight
  private pool!: THREE.Mesh
  private t = 0
  yaw = 0

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75))
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.0
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.scene.background = new THREE.Color(0x020308)
    // Le brouillard fond le bord du sol dans le noir : pas de ligne d'horizon.
    this.scene.fog = new THREE.Fog(0x020308, 5, 11)
    this.build()
  }

  private build() {
    const s = this.scene
    // Fond : un léger halo bleu nuit derrière le joueur, le reste dans le noir.
    const halo = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 9),
      new THREE.MeshBasicMaterial({ map: softDisc('rgba(40,60,130,0.55)'), transparent: true, depthWrite: false }),
    )
    halo.position.set(0, 2.2, -5)
    s.add(halo)

    // Sol sombre et brillant (il reflète les contre-jours).
    const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 64), new THREE.MeshStandardMaterial({ color: 0x06080f, roughness: 0.32, metalness: 0.55 }))
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    s.add(floor)
    // Flaque de lumière sous le projecteur.
    this.pool = new THREE.Mesh(
      new THREE.CircleGeometry(1.6, 48),
      new THREE.MeshBasicMaterial({ map: softDisc('rgba(255,236,200,0.5)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    )
    this.pool.rotation.x = -Math.PI / 2
    this.pool.position.y = 0.005
    s.add(this.pool)

    // Lumière « douche » au-dessus du joueur : elle éclaire épaules et maillot, laisse le visage dans l'ombre.
    this.spot = new THREE.SpotLight(0xfff1dc, 95, 14, 0.36, 0.55, 1.4)
    this.spot.position.set(0, 6.2, 0.9)
    this.spot.target.position.set(0, 0.9, 0)
    this.spot.castShadow = true
    this.spot.shadow.mapSize.set(1024, 1024)
    this.spot.shadow.bias = -0.0005
    s.add(this.spot, this.spot.target)
    // Contre-jours : froid à gauche, chaud à droite, légèrement derrière le joueur.
    for (const [x, z, col, k] of [
      [-2.2, -2.0, 0xcfe0ff, 260],
      [2.2, -1.8, 0xffe2b0, 220],
    ] as const) {
      const l = new THREE.SpotLight(col, k, 10, 0.4, 0.6, 1.6)
      l.position.set(x, 2.3, z)
      l.target.position.set(0, 1.2, 0)
      s.add(l, l.target)
    }
    // Faible lumière de face, pour lire le numéro et les couleurs du maillot.
    const fill = new THREE.DirectionalLight(0xb8c6ff, 0.14)
    fill.position.set(0, 0.6, 5)
    s.add(fill)
    s.add(new THREE.HemisphereLight(0x1c2f6e, 0x000000, 0.12))

    // Fumée qui traîne au sol.
    const sm = smokeTex()
    for (let i = 0; i < 9; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: sm, color: 0x8a98c4, transparent: true, opacity: 0.13, depthWrite: false }))
      const r = 0.5 + Math.random() * 1.6
      const a = Math.random() * Math.PI * 2
      sp.position.set(Math.cos(a) * r, 0.12 + Math.random() * 0.15, Math.sin(a) * r * 0.6 - 0.6)
      sp.scale.set(1.8, 0.6, 1)
      sp.userData.v = (Math.random() - 0.5) * 0.12
      this.smoke.push(sp)
      s.add(sp)
    }
    // Poussière dorée qui monte dans la lumière.
    const n = 220
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) pos.set([(Math.random() - 0.5) * 3.2, Math.random() * 3.6, (Math.random() - 0.5) * 2.4], i * 3)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.dust = new THREE.Points(
      g,
      new THREE.PointsMaterial({ map: softDisc('rgba(255,210,110,1)'), size: 0.035, color: 0xffc63d, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }),
    )
    s.add(this.dust)
  }

  /** Affiche un joueur (tenue à son numéro et son prénom). */
  async show(kit: KitOptions) {
    const c = await loadCharacter()
    c.setKit(kit)
    if (!this.character) this.scene.add(c.root)
    this.character = c
    c.mixer.stopAllAction()
    c.mixer.clipAction(c.clips.idle).play()
    await this.renderer.compileAsync(this.scene, this.camera)
    this.start()
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    // En portrait, on recule pour garder le joueur entier.
    const dist = w < h ? 8.2 : 5.2
    this.camera.position.set(0, 1.1, dist)
    this.camera.lookAt(0, 0.98, 0)
    this.camera.updateProjectionMatrix()
  }

  private frame = () => {
    this.raf = requestAnimationFrame(this.frame)
    this.timer.update()
    const dt = Math.min(0.05, this.timer.getDelta())
    this.t += dt
    this.character?.mixer.update(dt)
    if (this.character) this.character.root.rotation.y = this.yaw
    for (const sp of this.smoke) {
      sp.position.x += sp.userData.v * dt
      if (Math.abs(sp.position.x) > 3.2) sp.userData.v *= -1
    }
    const p = this.dust.geometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) + dt * (0.12 + (i % 7) * 0.02)
      if (y > 3.6) y = 0
      p.setY(i, y)
    }
    p.needsUpdate = true
    this.renderer.render(this.scene, this.camera)
  }

  start() {
    cancelAnimationFrame(this.raf)
    this.timer.update()
    this.frame()
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.renderer.dispose()
  }
}
