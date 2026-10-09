// La pelouse : couleur, bandes de tonte qui changent selon l'angle de vue, lignes, logo peint,
// usure devant les buts. Plus les buts avec leurs filets qui bougent et les drapeaux de coin.
import * as THREE from 'three'
import { canvas, GLSL_NOISE, loadImage, seeded, type Tier } from './util'

export const PITCH_L = 105
export const PITCH_W = 68
export const GRASS_L = 122
export const GRASS_W = 84

/** Dessine la pelouse (couleur de base, usure, lignes, logo) dans une image. */
function pitchCanvas(tier: Tier) {
  const W = tier === 'high' ? 4096 : 2048
  const H = Math.round((W * GRASS_W) / GRASS_L)
  const PX = W / GRASS_L
  const [c, x] = canvas(W, H)
  const rand = seeded(7)

  // Base verte légèrement irrégulière.
  x.fillStyle = '#2f6b2b'
  x.fillRect(0, 0, W, H)
  // Grandes taches (zones plus sèches ou plus vertes), dessinées en petit puis agrandies = flou naturel.
  const [n, nx] = canvas(48, 34)
  const img = nx.createImageData(48, 34)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = rand()
    img.data[i] = v > 0.5 ? 70 : 20
    img.data[i + 1] = v > 0.5 ? 110 : 60
    img.data[i + 2] = v > 0.5 ? 40 : 25
    img.data[i + 3] = Math.floor(rand() * 60)
  }
  nx.putImageData(img, 0, 0)
  x.imageSmoothingEnabled = true
  x.globalAlpha = 0.55
  x.drawImage(n, 0, 0, W, H)
  x.globalAlpha = 1

  const ox = ((GRASS_L - PITCH_L) / 2) * PX
  const oy = ((GRASS_W - PITCH_W) / 2) * PX
  const L = PITCH_L * PX
  const Hh = PITCH_W * PX
  const cx = ox + L / 2
  const cy = oy + Hh / 2

  // Usure : surfaces de but, rond central, couloirs des arbitres de touche.
  const wear = (wx: number, wy: number, rx: number, ry: number, a: number) => {
    x.save()
    x.translate(wx, wy)
    x.scale(1, ry / rx)
    const g = x.createRadialGradient(0, 0, 0, 0, 0, rx)
    g.addColorStop(0, `rgba(122,108,62,${a})`)
    g.addColorStop(0.6, `rgba(100,100,55,${a * 0.45})`)
    g.addColorStop(1, 'rgba(100,100,55,0)')
    x.fillStyle = g
    x.beginPath()
    x.arc(0, 0, rx, 0, Math.PI * 2)
    x.fill()
    x.restore()
  }
  wear(ox + 2.5 * PX, cy, 7 * PX, 6 * PX, 0.5)
  wear(ox + L - 2.5 * PX, cy, 7 * PX, 6 * PX, 0.5)
  wear(ox + 11 * PX, cy, 4 * PX, 3 * PX, 0.28)
  wear(ox + L - 11 * PX, cy, 4 * PX, 3 * PX, 0.28)
  wear(cx, cy, 3 * PX, 3 * PX, 0.22)

  // Grain fin : petites touffes plus claires / plus foncées.
  const blades = tier === 'high' ? 220000 : 60000
  for (let i = 0; i < blades; i++) {
    const v = rand()
    x.fillStyle = v > 0.5 ? `rgba(150,190,90,${0.05 + rand() * 0.08})` : `rgba(10,30,8,${0.06 + rand() * 0.1})`
    x.fillRect(rand() * W, rand() * H, 1 + rand() * 2, 1 + rand() * 3)
  }

  // Lignes blanches réglementaires.
  x.strokeStyle = 'rgba(245,245,238,0.93)'
  x.fillStyle = 'rgba(245,245,238,0.93)'
  x.lineWidth = 0.12 * PX
  x.lineJoin = 'round'
  x.shadowColor = 'rgba(255,255,255,0.5)'
  x.shadowBlur = PX * 0.06
  x.strokeRect(ox, oy, L, Hh)
  x.beginPath()
  x.moveTo(cx, oy)
  x.lineTo(cx, oy + Hh)
  x.stroke()
  x.beginPath()
  x.arc(cx, cy, 9.15 * PX, 0, Math.PI * 2)
  x.stroke()
  const dot = (dx: number, dy: number, r = 0.22) => {
    x.beginPath()
    x.arc(dx, dy, r * PX, 0, Math.PI * 2)
    x.fill()
  }
  dot(cx, cy, 0.3)
  for (const side of [0, 1]) {
    const x0 = side ? ox + L : ox
    const dir = side ? -1 : 1
    x.strokeRect(side ? x0 - 16.5 * PX : x0, cy - 20.16 * PX, 16.5 * PX, 40.32 * PX)
    x.strokeRect(side ? x0 - 5.5 * PX : x0, cy - 9.16 * PX, 5.5 * PX, 18.32 * PX)
    dot(x0 + dir * 11 * PX, cy)
    const a0 = Math.acos(5.5 / 9.15)
    x.beginPath()
    if (side) x.arc(x0 - 11 * PX, cy, 9.15 * PX, Math.PI - a0, Math.PI + a0)
    else x.arc(x0 + 11 * PX, cy, 9.15 * PX, -a0, a0)
    x.stroke()
    for (const [cyy, k] of [
      [oy, 0],
      [oy + Hh, 1],
    ] as const) {
      const start = side ? (k ? Math.PI : Math.PI / 2) : k ? Math.PI * 1.5 : 0
      x.beginPath()
      x.arc(x0, cyy, PX, start, start + Math.PI / 2)
      x.stroke()
    }
  }
  x.shadowBlur = 0
  return { c, PX, cx, cy }
}

/** Peint l'écusson blanc au rond central, comme de la peinture sur l'herbe (on voit un peu le gazon au travers). */
function paintLogo(x: CanvasRenderingContext2D, PX: number, cx: number, cy: number, img: HTMLImageElement) {
  const h = 13 * PX // 13 m de haut : tient dans le rond central (18,30 m de diamètre)
  const w = (h * img.naturalWidth) / img.naturalHeight
  x.save()
  x.globalAlpha = 0.7
  x.drawImage(img, cx - w / 2, cy - h / 2, w, h)
  x.restore()
}

/** Petite carte de relief (normal map) pour que l'herbe accroche la lumière. */
function grassNormal() {
  const S = 256
  const [c, x] = canvas(S, S)
  const rand = seeded(3)
  const h = new Float32Array(S * S)
  for (let i = 0; i < 9000; i++) {
    const px = Math.floor(rand() * S)
    const py = Math.floor(rand() * S)
    const len = 2 + Math.floor(rand() * 5)
    const v = rand()
    for (let k = 0; k < len; k++) h[((py + k) % S) * S + px] += v
  }
  const img = x.createImageData(S, S)
  for (let y = 0; y < S; y++)
    for (let xx = 0; xx < S; xx++) {
      const l = h[y * S + ((xx - 1 + S) % S)]
      const r = h[y * S + ((xx + 1) % S)]
      const u = h[((y - 1 + S) % S) * S + xx]
      const d = h[((y + 1) % S) * S + xx]
      const nx = (l - r) * 0.8
      const ny = (u - d) * 0.8
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1)
      const i = (y * S + xx) * 4
      img.data[i] = (nx * inv * 0.5 + 0.5) * 255
      img.data[i + 1] = (ny * inv * 0.5 + 0.5) * 255
      img.data[i + 2] = (inv * 0.5 + 0.5) * 255
      img.data[i + 3] = 255
    }
  x.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(GRASS_L / 1.6, GRASS_W / 1.6)
  return t
}

export function buildPitch(scene: THREE.Scene, renderer: THREE.WebGLRenderer, tier: Tier) {
  const { c, PX, cx, cy } = pitchCanvas(tier)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = Math.min(tier === 'low' ? 4 : 12, renderer.capabilities.getMaxAnisotropy())
  const x = c.getContext('2d')!
  // L'écusson arrive un peu après le stade : on le peint dès qu'il est chargé.
  loadImage('/logo/ecusson-blanc.png')
    .then((img) => {
      paintLogo(x, PX, cx, cy, img)
      tex.needsUpdate = true
    })
    .catch(() => {
      /* pas de logo au rond central : la pelouse reste belle sans */
    })

  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    normalMap: grassNormal(),
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughness: 0.92,
    metalness: 0,
    // L'herbe ne reflète presque pas le ciel (sinon elle blanchit quand on la regarde de près du sol).
    envMapIntensity: 0.12,
  })
  // Les bandes de tonte : l'herbe couchée dans un sens paraît claire ou foncée selon l'endroit d'où on la regarde.
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed,1.0)).xyz;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWP;\n${GLSL_NOISE}`)
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        {
          float stripeW = 5.25;
          float idx = floor((vWP.x + 200.0) / stripeW);
          float s = mod(idx, 2.0) * 2.0 - 1.0;
          vec3 V = normalize(cameraPosition - vWP);
          // Chaque bande est tondue dans un sens (le long de z) : on voit l'herbe « de face » ou « de dos ».
          float lean = s * (0.6 * V.z + 0.1);
          float inPitch = step(abs(vWP.x), 61.0) * step(abs(vWP.z), 42.0);
          diffuseColor.rgb *= 1.0 + 0.2 * lean * inPitch;
          float n = sc_fbm(vWP.xz * 0.08);
          diffuseColor.rgb *= 0.9 + 0.2 * n;
        }`,
      )
  }
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(GRASS_L, GRASS_W), mat)
  pitch.rotation.x = -Math.PI / 2
  pitch.receiveShadow = true
  scene.add(pitch)

  const goals = buildGoals(scene)
  const flags = buildCornerFlags(scene)
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 14), new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.45 }))
  ball.position.set(0, 0.11, 0)
  ball.castShadow = true
  scene.add(ball)

  return {
    update(t: number) {
      goals.uniforms.uTime.value = t
      flags.uniforms.uTime.value = t
    },
  }
}

/* -------------------------------- Buts -------------------------------- */

function netTexture() {
  const [c, x] = canvas(128, 128)
  x.clearRect(0, 0, 128, 128)
  x.strokeStyle = 'rgba(255,255,255,1)'
  x.lineWidth = 3
  for (let i = 0; i <= 128; i += 16) {
    x.beginPath()
    x.moveTo(i, 0)
    x.lineTo(i, 128)
    x.stroke()
    x.beginPath()
    x.moveTo(0, i)
    x.lineTo(128, i)
    x.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

function buildGoals(scene: THREE.Scene) {
  const uniforms = { uTime: { value: 0 } }
  const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.1, emissive: 0x222222 })
  const tex = netTexture()
  const netMat = new THREE.MeshStandardMaterial({
    map: tex,
    alphaMap: tex,
    transparent: true,
    alphaTest: 0.25,
    side: THREE.DoubleSide,
    color: 0xe8eef8,
    roughness: 0.9,
    depthWrite: false,
  })
  // Le filet ondule doucement (vent, rumeur du stade).
  netMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uniforms.uTime
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec4 w = modelMatrix * vec4(position, 1.0);
        float sway = sin(uTime * 1.7 + w.z * 0.9 + w.y * 1.3) * 0.04 + sin(uTime * 3.1 + w.z * 2.1) * 0.015;
        transformed.x += sway * clamp(position.y / 2.44, 0.0, 1.0);`,
      )
  }
  const H = 2.44
  const Wd = 7.32
  const D = 2.0
  for (const s of [-1, 1]) {
    const g = new THREE.Group()
    const post = new THREE.CylinderGeometry(0.06, 0.06, H, 12)
    const p1 = new THREE.Mesh(post, postMat)
    p1.position.set(0, H / 2, -Wd / 2)
    const p2 = p1.clone()
    p2.position.z = Wd / 2
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, Wd + 0.12, 12), postMat)
    bar.rotation.x = Math.PI / 2
    bar.position.y = H
    const rearBar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, Wd, 6), postMat)
    rearBar.rotation.x = Math.PI / 2
    rearBar.position.set(s * D, 0.05, 0)
    for (const m of [p1, p2, bar]) m.castShadow = true
    g.add(p1, p2, bar, rearBar)
    // Filet : fond, toit, côtés.
    const back = new THREE.Mesh(new THREE.PlaneGeometry(Wd, H * 0.92, 24, 10), netMat)
    tex.repeat.set(Wd * 7, H * 7)
    back.rotation.y = Math.PI / 2
    back.position.set(s * D, H * 0.46, 0)
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(Wd, Math.hypot(D, H * 0.08), 24, 6), netMat)
    roof.rotation.set(-Math.PI / 2, 0, Math.PI / 2)
    roof.position.set((s * D) / 2, H - 0.06, 0)
    const sideGeo = new THREE.BufferGeometry()
    const sv = new Float32Array([0, 0, 0, s * D, 0, 0, s * D, H * 0.92, 0, 0, 0, 0, s * D, H * 0.92, 0, 0, H, 0])
    sideGeo.setAttribute('position', new THREE.BufferAttribute(sv, 3))
    sideGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 0.27, 0, 0.27, 0.92, 0, 0, 0.27, 0.92, 0, 1]), 2))
    sideGeo.computeVertexNormals()
    const sideA = new THREE.Mesh(sideGeo, netMat)
    sideA.position.z = -Wd / 2
    const sideB = sideA.clone()
    sideB.position.z = Wd / 2
    g.add(back, roof, sideA, sideB)
    g.position.x = s * (PITCH_L / 2)
    scene.add(g)
  }
  return { uniforms }
}

function buildCornerFlags(scene: THREE.Scene) {
  const uniforms = { uTime: { value: 0 } }
  const flagMat = new THREE.MeshStandardMaterial({ color: 0xffc63d, side: THREE.DoubleSide, roughness: 0.7, emissive: 0x3a2400 })
  flagMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uniforms.uTime
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float k = position.x + 0.2;
        transformed.z += sin(uTime * 6.0 - k * 9.0) * 0.07 * k * 2.5;`,
      )
  }
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const g = new THREE.Group()
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 6), poleMat)
      pole.position.y = 0.75
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3, 8, 2), flagMat)
      flag.position.set(0.2, 1.33, 0)
      g.add(pole, flag)
      g.position.set((sx * PITCH_L) / 2, 0, (sz * PITCH_W) / 2)
      g.rotation.y = Math.atan2(sz, -sx) * 0.3
      scene.add(g)
    }
  return { uniforms }
}
