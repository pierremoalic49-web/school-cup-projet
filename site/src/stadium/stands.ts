// Les 4 tribunes, à l'anglaise : gradins avec sièges, escaliers, vomitoires, loges vitrées,
// toits métalliques sur charpente, rampe lumineuse, façade éclairée en or. Plus le tunnel des
// joueurs et les bancs de touche dans la tribune principale.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { buildCrowd, buildFlags, buildPhoneFlashes, type Fan } from './crowd'
import { canvas, type Tier } from './util'

interface Rake {
  rows: number
  rise: number
  depth: number
  y0: number // hauteur du premier rang
  z0: number // distance du premier rang au bord de la tribune
  front: number // hauteur du muret devant le premier rang
}
interface StandSpec {
  len: number
  rakes: Rake[]
  x: number
  z: number
  rotY: number
  roofY: number
  boxes?: boolean // loges vitrées entre deux étages
  tunnel?: boolean
  tifo?: boolean
  ultras?: boolean // tribune derrière le but : plus de drapeaux
}

const SEAT = 0.55

/* --------------------------- Textures --------------------------- */

function seatTexture() {
  const [c, x] = canvas(64, 64)
  // contremarche en béton (bas de l'image)
  x.fillStyle = '#3b3f49'
  x.fillRect(0, 44, 64, 20)
  x.fillStyle = 'rgba(0,0,0,0.25)'
  x.fillRect(0, 44, 64, 3)
  // marche (haut de l'image) : béton + siège bleu nuit
  x.fillStyle = '#2c3039'
  x.fillRect(0, 0, 64, 44)
  x.fillStyle = '#1a2350'
  x.fillRect(5, 6, 54, 30)
  x.fillStyle = '#26326e'
  x.fillRect(5, 6, 54, 9)
  x.fillStyle = 'rgba(255,255,255,0.08)'
  x.fillRect(5, 6, 54, 2)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 4
  return t
}

function roofTexture() {
  const [c, x] = canvas(256, 256)
  x.fillStyle = '#7d8492'
  x.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 256; i += 8) {
    x.fillStyle = 'rgba(255,255,255,0.10)'
    x.fillRect(i, 0, 3, 256)
    x.fillStyle = 'rgba(0,0,0,0.22)'
    x.fillRect(i + 4, 0, 2, 256)
  }
  for (let i = 0; i < 40; i++) {
    x.fillStyle = `rgba(30,30,35,${Math.random() * 0.12})`
    x.fillRect(Math.random() * 256, Math.random() * 256, 30 + Math.random() * 80, 10 + Math.random() * 40)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/** Fenêtres des loges : intérieurs chauds, montants, silhouettes. */
function boxesTexture() {
  const [c, x] = canvas(512, 64)
  x.fillStyle = '#05060a'
  x.fillRect(0, 0, 512, 64)
  for (let i = 0; i < 16; i++) {
    const g = x.createLinearGradient(0, 8, 0, 60)
    const warm = Math.random() > 0.25
    g.addColorStop(0, warm ? '#ffd9a0' : '#bcd3ff')
    g.addColorStop(1, warm ? '#7a4a1c' : '#2a3b66')
    x.fillStyle = g
    x.globalAlpha = 0.45 + Math.random() * 0.55
    x.fillRect(i * 32 + 2, 8, 28, 52)
    x.globalAlpha = 1
    // silhouettes de personnes
    for (let k = 0; k < 3; k++) {
      if (Math.random() > 0.55) continue
      x.fillStyle = 'rgba(10,8,6,0.85)'
      const px = i * 32 + 6 + k * 8
      x.fillRect(px, 34, 5, 26)
      x.beginPath()
      x.arc(px + 2.5, 31, 3, 0, Math.PI * 2)
      x.fill()
    }
  }
  x.fillStyle = '#ffc63d'
  x.fillRect(0, 0, 512, 2)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = THREE.RepeatWrapping
  return t
}

/** Lumière de façade : un dégradé or qui « lèche » le mur depuis le sol. */
function washTexture() {
  const [c, x] = canvas(8, 128)
  const g = x.createLinearGradient(0, 128, 0, 0)
  g.addColorStop(0, 'rgba(255,190,70,0.9)')
  g.addColorStop(0.35, 'rgba(255,170,50,0.25)')
  g.addColorStop(1, 'rgba(255,170,50,0)')
  x.fillStyle = g
  x.fillRect(0, 0, 8, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/* ------------------------- Géométrie des gradins ------------------------- */

class Builder {
  pos: number[] = []
  nor: number[] = []
  uv: number[] = []
  idx: number[] = []
  quad(a: number[], b: number[], c: number[], d: number[], n: number[], uv: [number, number, number, number]) {
    const i = this.pos.length / 3
    this.pos.push(...a, ...b, ...c, ...d)
    for (let k = 0; k < 4; k++) this.nor.push(...n)
    const [u0, v0, u1, v1] = uv
    this.uv.push(u0, v0, u1, v0, u1, v1, u0, v1)
    this.idx.push(i, i + 2, i + 1, i, i + 3, i + 2)
  }
  geo() {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2))
    g.setIndex(this.idx)
    return g
  }
}

/** Les marches d'un étage de tribune (contremarche verticale + marche horizontale, rang par rang). */
function rakeGeometry(x0: number, x1: number, r: Rake, steps = 1) {
  const b = new Builder()
  const u0 = x0 / SEAT
  const u1 = x1 / SEAT
  for (let i = 0; i < r.rows; i++) {
    for (let s = 0; s < steps; s++) {
      const rise = r.rise / steps
      const dep = r.depth / steps
      const y = r.y0 + i * r.rise + s * rise
      const yPrev = i === 0 && s === 0 ? r.y0 - r.front : y - rise
      const z = r.z0 + i * r.depth + s * dep
      b.quad([x0, yPrev, z], [x1, yPrev, z], [x1, y, z], [x0, y, z], [0, 0, -1], [u0, 0, u1, 0.3])
      b.quad([x0, y, z], [x1, y, z], [x1, y, z + dep], [x0, y, z + dep], [0, 1, 0], [u0, 0.3, u1, 1])
    }
  }
  return b.geo()
}

const rakeTop = (r: Rake) => r.y0 + (r.rows - 1) * r.rise
const rakeBack = (r: Rake) => r.z0 + r.rows * r.depth

/* ------------------------------ Tribune ------------------------------ */

const shirtPalette: [string, number][] = [
  ['#1b2140', 20],
  ['#0e0f14', 15],
  ['#e9e9ee', 14],
  ['#ffc63d', 18],
  ['#5b6070', 8],
  ['#2e4a7a', 7],
  ['#3fe3ff', 5],
  ['#ff6fb0', 5],
  ['#c8343c', 4],
  ['#2f7a4a', 3],
  ['#8a5a2b', 3],
]
const paletteTotal = shirtPalette.reduce((a, [, w]) => a + w, 0)
function shirtColor(rand: () => number) {
  let r = rand() * paletteTotal
  for (const [c, w] of shirtPalette) {
    r -= w
    if (r <= 0) return new THREE.Color(c)
  }
  return new THREE.Color('#1b2140')
}

/** Masque du tifo : pour chaque place (colonne, rang), la couleur de la pancarte. */
function tifoMask(cols: number, rows: number) {
  // On dessine en grand (8 pixels par place) puis on lit la couleur au centre de chaque place.
  const K = 8
  const W = cols * K
  const H = rows * K
  const [, x] = canvas(W, H)
  x.fillStyle = '#2342a8'
  x.fillRect(0, 0, W, H)
  x.fillStyle = '#f2f2f6'
  x.fillRect(0, 0, W, K)
  x.fillRect(0, H - K, W, K)
  x.fillStyle = '#ffcc3a'
  x.textAlign = 'center'
  x.textBaseline = 'alphabetic'
  const size = (rows - 3) * K * 1.32
  x.font = `400 ${size}px Anton, Impact, sans-serif`
  const text = 'SCHOOL CUP'
  const m = x.measureText(text)
  const textH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent
  // Les lettres s'étirent sur 82 % de la largeur de la tribune.
  x.save()
  x.translate(W / 2, H / 2 + textH / 2 - m.actualBoundingBoxDescent)
  x.scale((W * 0.82) / m.width, ((rows - 3.4) * K) / textH)
  x.fillText(text, 0, 0)
  x.restore()
  const d = x.getImageData(0, 0, W, H).data
  return (col: number, row: number) => {
    const i = ((row * K + K / 2) * W + col * K + K / 2) * 4
    return new THREE.Color(`rgb(${d[i]},${d[i + 1]},${d[i + 2]})`)
  }
}

interface Mats {
  seats: THREE.Material
  concrete: THREE.Material
  steps: THREE.Material
  wall: THREE.Material
  steel: THREE.Material
  roof: THREE.Material
  light: THREE.Material
  dark: THREE.Material
  boxes: THREE.Material
  wash: THREE.Material
  gold: THREE.Material
  glass: THREE.Material
  canopy: THREE.Material
  red: THREE.Material
}

function buildStand(spec: StandSpec, mats: Mats, tier: Tier, rand: () => number, fansOut: Fan[][], scene: THREE.Scene) {
  const g = new THREE.Group()
  g.position.set(spec.x, 0, spec.z)
  g.rotation.y = spec.rotY
  scene.add(g)
  const L = spec.len
  const hx = L / 2
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, shadow = true) => {
    const mesh = new THREE.Mesh(geo, m)
    mesh.castShadow = shadow
    mesh.receiveShadow = true
    g.add(mesh)
    return mesh
  }

  // Escaliers tous les ~13 m.
  const nAisles = Math.max(2, Math.round(L / 13))
  const aisles: number[] = []
  for (let i = 1; i < nAisles; i++) aisles.push(-hx + (L * i) / nAisles)
  const lastRake = spec.rakes[spec.rakes.length - 1]
  const backZ = rakeBack(lastRake)
  const topY = rakeTop(lastRake)

  // Gradins.
  const stairs: THREE.BufferGeometry[] = []
  const rails: THREE.BufferGeometry[] = []
  spec.rakes.forEach((r) => {
    add(rakeGeometry(-hx, hx, r), mats.seats)
    for (const ax of aisles) {
      stairs.push(rakeGeometry(ax - 0.6, ax + 0.6, { ...r, y0: r.y0 + 0.004, front: r.front - 0.01 }, 2))
      const len = Math.hypot(r.rows * r.depth, r.rows * r.rise)
      const rail = new THREE.CylinderGeometry(0.025, 0.025, len, 5)
      rail.rotateX(Math.PI / 2 - Math.atan2(r.rise, r.depth))
      rail.translate(ax, r.y0 + 0.9 + (r.rows * r.rise) / 2 - r.rise / 2, r.z0 + (r.rows * r.depth) / 2)
      rails.push(rail)
    }
    // Muret avant (avec une fine ligne dorée).
    add(new THREE.BoxGeometry(L, r.front + 0.15, 0.25).translate(0, r.y0 - r.front + (r.front + 0.15) / 2, r.z0 - 0.12), mats.wall)
    add(new THREE.BoxGeometry(L, 0.05, 0.27).translate(0, r.y0 + 0.13, r.z0 - 0.12), mats.gold, false)
  })
  add(mergeGeometries(stairs)!, mats.steps, false)
  add(mergeGeometries(rails)!, mats.steel, false)

  // Vomitoires (sorties vers les coursives) dans l'étage du bas.
  const low = spec.rakes[0]
  const vomRow = Math.floor(low.rows * 0.4)
  const vomXs = aisles.slice(0, -1).map((a, i) => (a + aisles[i + 1]) / 2).filter((_, i) => i % 2 === 0)
  for (const vx of vomXs) {
    const yb = low.y0 + (vomRow - 1) * low.rise
    const yt = low.y0 + (vomRow + 4) * low.rise
    const zb = low.z0 + vomRow * low.depth
    add(new THREE.BoxGeometry(3.4, yt - yb + 0.3, 5 * low.depth).translate(vx, (yt + yb) / 2 - 0.15, zb + 2.5 * low.depth), mats.concrete)
    add(new THREE.PlaneGeometry(2.6, Math.min(2.3, yt - yb)).rotateY(Math.PI).translate(vx, yb + Math.min(2.3, yt - yb) / 2 + 0.1, zb - 0.01), mats.dark, false)
  }

  // Loges vitrées entre les deux étages.
  if (spec.boxes && spec.rakes.length > 1) {
    const r0 = spec.rakes[0]
    const r1 = spec.rakes[1]
    const yb = rakeTop(r0) + 0.25
    const yt = r1.y0 - r1.front
    const z = rakeBack(r0) + 0.6
    const tex = (mats.boxes as THREE.MeshStandardMaterial).emissiveMap!
    tex.repeat.set(L / 16, 1)
    add(new THREE.PlaneGeometry(L, yt - yb).rotateY(Math.PI).translate(0, (yb + yt) / 2, z), mats.boxes, false)
    add(new THREE.BoxGeometry(L, 0.3, r1.z0 - z + 0.4).translate(0, yt - 0.15, (z + r1.z0) / 2), mats.wall)
    add(new THREE.BoxGeometry(L, yt - yb + 0.6, 0.5).translate(0, (yb + yt) / 2, z + 1.4), mats.wall)
  }

  // Mur arrière et façade extérieure avec lumière dorée.
  const roofBack = spec.roofY
  add(new THREE.BoxGeometry(L + 1, roofBack + 0.4, 0.6).translate(0, (roofBack + 0.4) / 2, backZ + 0.3), mats.wall)
  const fins: THREE.BufferGeometry[] = []
  for (let x = -hx; x <= hx; x += 2.4) fins.push(new THREE.BoxGeometry(0.35, roofBack, 0.9).translate(x, roofBack / 2, backZ + 1.0))
  add(mergeGeometries(fins)!, mats.wall)
  add(new THREE.PlaneGeometry(L, roofBack * 0.85).translate(0, (roofBack * 0.85) / 2, backZ + 0.62), mats.wash, false)
  add(new THREE.BoxGeometry(L, 0.18, 0.3).translate(0, 0.25, backZ + 1.5), mats.gold, false)

  // Pignons sur les côtés.
  const shape = new THREE.Shape()
  shape.moveTo(-0.3, 0)
  shape.lineTo(-0.3, low.y0 + 1.1)
  shape.lineTo(backZ, topY + 1.4)
  shape.lineTo(backZ, roofBack)
  shape.lineTo(backZ + 0.6, roofBack)
  shape.lineTo(backZ + 0.6, 0)
  const gable = new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false }).rotateY(-Math.PI / 2)
  add(gable.clone().translate(hx + 0.5, 0, 0), mats.wall)
  add(gable.clone().translate(-hx, 0, 0), mats.wall)

  // Toit : tôle métallique sur une charpente en treillis, qui monte légèrement vers le terrain.
  const roofFront = Math.max(-0.5, backZ * 0.08)
  const roofLen = backZ + 1.2 - roofFront
  const rise = 1.6
  const slope = Math.atan2(rise, roofLen)
  const roofMesh = add(new THREE.BoxGeometry(L + 2, 0.3, Math.hypot(roofLen, rise)), mats.roof)
  roofMesh.rotation.x = -slope
  roofMesh.position.set(0, roofBack + 0.6 + rise / 2, roofFront + roofLen / 2)
  const truss: THREE.BufferGeometry[] = []
  const frontY = roofBack + 0.6 + rise
  for (let x = -hx; x <= hx + 0.01; x += L / Math.round(L / 9)) {
    const bottomBack = roofBack - 3.2
    const chord = (y0: number, z0: number, y1: number, z1: number, t = 0.22) => {
      const len = Math.hypot(z1 - z0, y1 - y0)
      const geo = new THREE.BoxGeometry(t, t, len)
      geo.rotateX(-Math.atan2(y1 - y0, z1 - z0))
      geo.translate(x, (y0 + y1) / 2, (z0 + z1) / 2)
      truss.push(geo)
    }
    chord(roofBack + 0.45, backZ + 0.6, frontY - 0.15, roofFront, 0.3)
    chord(bottomBack, backZ + 0.6, frontY - 0.9, roofFront + 0.4, 0.25)
    const n = 7
    for (let k = 0; k < n; k++) {
      const t0 = k / n
      const t1 = (k + 1) / n
      const zA = backZ + 0.6 + (roofFront - backZ - 0.6) * t0
      const zB = backZ + 0.6 + (roofFront - backZ - 0.6) * t1
      const topA = roofBack + 0.45 + (frontY - 0.15 - roofBack - 0.45) * t0
      const botB = bottomBack + (frontY - 0.9 - bottomBack) * t1
      chord(topA, zA, botB, zB, 0.12)
    }
  }
  add(mergeGeometries(truss)!, mats.steel)
  // Bord du toit côté terrain + rampe de lumière.
  add(new THREE.BoxGeometry(L + 2, 1.2, 0.35).translate(0, frontY - 0.2, roofFront - 0.1), mats.wall)
  add(new THREE.BoxGeometry(L + 1.6, 0.12, 0.25).translate(0, frontY - 0.9, roofFront + 0.05), mats.light, false)
  const lamps: THREE.BufferGeometry[] = []
  for (let x = -hx + 5; x < hx; x += 10) lamps.push(new THREE.BoxGeometry(0.7, 0.1, 0.4).translate(x, frontY - 1.0, roofFront + 2))
  add(mergeGeometries(lamps)!, mats.light, false)

  // Tunnel des joueurs et bancs de touche.
  if (spec.tunnel) {
    add(new THREE.BoxGeometry(5, low.y0 + 6 * low.rise + 0.4, 6 * low.depth).translate(0, (low.y0 + 6 * low.rise + 0.4) / 2, low.z0 + 3 * low.depth), mats.concrete)
    add(new THREE.PlaneGeometry(3.4, 2.4).rotateY(Math.PI).translate(0, 1.2, low.z0 - 0.02), mats.dark, false)
    const canopy = new THREE.CylinderGeometry(1.75, 1.75, 3.6, 18, 1, true, -Math.PI / 2, Math.PI)
    canopy.rotateX(-Math.PI / 2).translate(0, 0.6, -1.85)
    add(canopy, mats.canopy)
    for (const side of [-1, 1]) {
      const dg = new THREE.Group()
      const base = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.25, 2.4), mats.concrete)
      base.position.y = 0.12
      const seats: THREE.BufferGeometry[] = []
      for (let i = 0; i < 9; i++) {
        seats.push(new THREE.BoxGeometry(0.62, 0.45, 0.55).translate(-3.3 + i * 0.82, 0.48, 0.5))
        seats.push(new THREE.BoxGeometry(0.62, 0.7, 0.1).translate(-3.3 + i * 0.82, 0.95, 0.85))
      }
      const seatMesh = new THREE.Mesh(mergeGeometries(seats)!, mats.red)
      // Coque transparente : de l'arrière (en bas) jusqu'au-dessus de l'avant.
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 7.6, 20, 1, true, -0.41, 2.85).rotateZ(Math.PI / 2), mats.glass)
      shell.position.set(0, 0.6, 0)
      dg.add(base, seatMesh, shell)
      dg.position.set(side * 12, 0, -1.6)
      g.add(dg)
    }
  }

  // La foule, rang par rang.
  const sp = tier === 'high' ? 0.55 : tier === 'mid' ? 0.64 : 0.78
  const fans: Fan[] = []
  const cols = Math.floor((L - 0.8) / sp)
  // Le tifo occupe uniquement l'étage du haut (sinon les loges coupent les lettres en deux).
  const tifoRake = spec.rakes.length - 1
  const tifoRows = spec.rakes[tifoRake].rows
  const tifo = spec.tifo ? tifoMask(cols, tifoRows) : null
  spec.rakes.forEach((r, ri) => {
    for (let i = 0; i < r.rows; i++) {
      for (let c = 0; c < cols; c++) {
        const x = -hx + 0.4 + c * sp + sp / 2
        if (aisles.some((a) => Math.abs(a - x) < 0.75)) continue
        if (ri === 0 && i >= vomRow - 1 && i <= vomRow + 4 && vomXs.some((v) => Math.abs(v - x) < 1.9)) continue
        if (spec.tunnel && ri === 0 && i < 7 && Math.abs(x) < 2.8) continue
        // Vu depuis le terrain, le x local va de droite à gauche : on lit le masque à l'envers.
        const tifoColor = tifo && ri === tifoRake ? tifo(cols - 1 - c, tifoRows - 1 - i) : null
        if (!tifoColor && rand() < 0.07) continue
        fans.push({
          x: x + (rand() - 0.5) * 0.12,
          y: r.y0 + i * r.rise,
          z: r.z0 + i * r.depth + r.depth * 0.42,
          shirt: tifoColor ?? shirtColor(rand),
          mode: tifoColor ? 1 : 0,
        })
      }
    }
  })
  buildCrowd(fans, g, tier !== 'low', rand)
  // Coordonnées « monde » (pour les drapeaux et les flashs).
  g.updateMatrixWorld(true)
  const world = fans.map((f) => ({ ...f, ...new THREE.Vector3(f.x, f.y, f.z).applyMatrix4(g.matrixWorld) }))
  fansOut.push(world)
  return { group: g, ultras: !!spec.ultras, tifo: !!spec.tifo }
}

export function buildStands(scene: THREE.Scene, tier: Tier, rand: () => number) {
  const seats = seatTexture()
  const roofTex = roofTexture()
  const boxTex = boxesTexture()
  const mats: Mats = {
    seats: new THREE.MeshStandardMaterial({ map: seats, roughness: 0.85 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0x30343e, roughness: 0.92 }),
    steps: new THREE.MeshStandardMaterial({ color: 0x575c68, roughness: 0.9 }),
    wall: new THREE.MeshStandardMaterial({ color: 0x1b1f2a, roughness: 0.6, metalness: 0.35 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x3a404d, roughness: 0.45, metalness: 0.8 }),
    roof: new THREE.MeshStandardMaterial({ map: roofTex, color: 0x4a505c, roughness: 0.45, metalness: 0.7 }),
    light: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.1, 1.95, 1.7), toneMapped: false }),
    dark: new THREE.MeshBasicMaterial({ color: 0x010102 }),
    boxes: new THREE.MeshStandardMaterial({ color: 0x050608, emissive: 0xffffff, emissiveMap: boxTex, emissiveIntensity: 1.6, roughness: 0.15, metalness: 0.5 }),
    wash: new THREE.MeshBasicMaterial({ map: washTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55, side: THREE.DoubleSide }),
    gold: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.25, 0.82, 0.2), toneMapped: false }),
    glass: new THREE.MeshStandardMaterial({ color: 0x9fb7d6, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.2, side: THREE.DoubleSide, depthWrite: false }),
    canopy: new THREE.MeshStandardMaterial({ color: 0x18204a, roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide }),
    red: new THREE.MeshStandardMaterial({ color: 0xa8222c, roughness: 0.6 }),
  }

  const lower = (rows: number): Rake => ({ rows, rise: 0.42, depth: 0.82, y0: 1.35, z0: 0, front: 1.35 })
  const big: Rake[] = [
    lower(14),
    { rows: 16, rise: 0.5, depth: 0.8, y0: 1.35 + 13 * 0.42 + 4.6, z0: 14 * 0.82 + 1.6, front: 1.1 },
  ]
  const specs: StandSpec[] = [
    // Grande tribune en face de la caméra d'arrivée (côté -z) : deux étages, loges, tifo.
    { len: 112, rakes: big, x: 0, z: -40, rotY: Math.PI, roofY: 1.35 + 13 * 0.42 + 4.6 + 15 * 0.5 + 4.2, boxes: true, tifo: true },
    // Tribune principale (côté +z) avec tunnel et bancs.
    { len: 112, rakes: [lower(24)], x: 0, z: 40, rotY: 0, roofY: 1.35 + 23 * 0.42 + 5.8, tunnel: true },
    // Virages derrière les buts.
    { len: 74, rakes: [lower(20)], x: 59, z: 0, rotY: Math.PI / 2, roofY: 1.35 + 19 * 0.42 + 5.4, ultras: true },
    { len: 74, rakes: [lower(20)], x: -59, z: 0, rotY: -Math.PI / 2, roofY: 1.35 + 19 * 0.42 + 5.4, ultras: true },
  ]
  const fansByStand: Fan[][] = []
  const stands = specs.map((s) => buildStand(s, mats, tier, rand, fansByStand, scene))

  // Drapeaux (surtout derrière les buts) et flashs de téléphones.
  const flagSpots: THREE.Vector3[] = []
  const flashSpots: THREE.Vector3[] = []
  const nFlags = tier === 'high' ? 70 : tier === 'mid' ? 36 : 14
  const nFlash = tier === 'high' ? 500 : tier === 'mid' ? 260 : 120
  stands.forEach((s, i) => {
    const fans = fansByStand[i].filter((f) => f.mode === 0)
    const share = s.ultras ? 0.32 : s.tifo ? 0.08 : 0.28
    for (let k = 0; k < nFlags * share; k++) {
      const f = fans[Math.floor(rand() * fans.length)]
      if (f) flagSpots.push(new THREE.Vector3(f.x, f.y, f.z))
    }
  })
  const all = fansByStand.flat()
  for (let k = 0; k < nFlash; k++) {
    const f = all[Math.floor(rand() * all.length)]
    flashSpots.push(new THREE.Vector3(f.x, f.y, f.z))
  }
  buildFlags(flagSpots, scene, rand)
  buildPhoneFlashes(flashSpots, scene, rand)
  return { fanCount: all.length }
}
