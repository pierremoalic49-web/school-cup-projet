// Les panneaux LED qui défilent autour du terrain et l'écran géant (qui affiche le vrai score).
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { canvas, loadImage } from './util'

export interface ScreenInfo {
  mode: 'logo' | 'score' | 'goal'
  a?: { short: string; color: string }
  b?: { short: string; color: string }
  scoreA?: number
  scoreB?: number
  label?: string // « 63' · Demi-finale 2 »
  scorer?: string
}

const LED_PERIOD = 46 // mètres de panneau pour un tour complet du message

/** Le bandeau LED : les messages, séparés par l'icône School Cup (ou un point doré tant qu'elle n'est pas chargée). */
function ledCanvas(messages: [string, string][], icon: HTMLImageElement | null) {
  const [c, x] = canvas(2048, 64)
  x.fillStyle = '#04050a'
  x.fillRect(0, 0, 2048, 64)
  x.textBaseline = 'middle'
  x.font = '400 42px Anton, Impact, sans-serif'
  const iconH = 56
  const iconW = icon ? (iconH * icon.naturalWidth) / icon.naturalHeight : 10
  const sep = iconW + 56 // place réservée au séparateur
  const widths = messages.map(([t]) => x.measureText(t).width)
  // Seul le texte est étiré pour que le message fasse exactement le tour du panneau (l'icône garde ses proportions).
  const scale = (2048 - messages.length * sep) / widths.reduce((a, w) => a + w, 0)
  let px = 0
  messages.forEach(([t, col], i) => {
    if (icon) x.drawImage(icon, px + 28, (64 - iconH) / 2, iconW, iconH)
    else {
      x.fillStyle = '#ffc63d'
      x.fillRect(px + 28, 28, 9, 9)
    }
    px += sep
    x.save()
    x.translate(px, 0)
    x.scale(scale, 1)
    x.fillStyle = col
    x.fillText(t, 0, 35)
    x.restore()
    px += widths[i] * scale
  })
  // Trame de pixels LED.
  x.fillStyle = 'rgba(0,0,0,0.35)'
  for (let i = 0; i < 2048; i += 3) x.fillRect(i, 0, 1, 64)
  for (let j = 0; j < 64; j += 3) x.fillRect(0, j, 2048, 1)
  return c
}

export function buildScreens(scene: THREE.Scene) {
  const defaultMsgs: [string, string][] = [
    ['LYCÉE SACRÉ-CŒUR LA SALLE', '#ffffff'],
    ['ANGERS', '#3fe3ff'],
    ['UNE SEULE ÉCOLE', '#ffe7a3'],
    ['FAIR-PLAY', '#ff6fb0'],
  ]
  let icon: HTMLImageElement | null = null
  const tex = new THREE.CanvasTexture(ledCanvas(defaultMsgs, null))
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.anisotropy = 8
  const ledMat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.7, 1.7, 1.7), toneMapped: false })
  const backMat = new THREE.MeshStandardMaterial({ color: 0x0b0d14, roughness: 0.6, metalness: 0.4 })

  // Panneaux par segments de 8 m (avec un trou devant le tunnel des joueurs).
  const segs: THREE.BufferGeometry[] = []
  const backs: THREE.BufferGeometry[] = []
  const addRun = (x0: number, x1: number, place: (g: THREE.BufferGeometry) => THREE.BufferGeometry, skip?: (a: number, b: number) => boolean) => {
    for (let a = x0; a < x1 - 0.5; a += 8) {
      const b = Math.min(x1, a + 7.9)
      if (skip?.(a, b)) continue
      const len = b - a
      const g = new THREE.PlaneGeometry(len, 0.9)
      const uv = g.attributes.uv as THREE.BufferAttribute
      for (let i = 0; i < uv.count; i++) uv.setX(i, (a + uv.getX(i) * len) / LED_PERIOD)
      g.translate((a + b) / 2, 0.55, 0)
      segs.push(place(g))
      backs.push(place(new THREE.BoxGeometry(len, 1.0, 0.25).translate((a + b) / 2, 0.5, -0.14)))
    }
  }
  // côté -z (face à la caméra d'arrivée) et +z
  addRun(-56, 56, (g) => g.translate(0, 0, -36))
  addRun(-56, 56, (g) => g.rotateY(Math.PI).translate(0, 0, 36), (a, b) => a < 2.5 && b > -2.5)
  // derrière les buts
  addRun(-30, 30, (g) => g.rotateY(Math.PI / 2).translate(-56, 0, 0), (a, b) => a < 5 && b > -5)
  addRun(-30, 30, (g) => g.rotateY(-Math.PI / 2).translate(56, 0, 0), (a, b) => a < 5 && b > -5)
  scene.add(new THREE.Mesh(mergeGeometries(segs)!, ledMat))
  const backMesh = new THREE.Mesh(mergeGeometries(backs)!, backMat)
  backMesh.castShadow = true
  scene.add(backMesh)

  // Écran géant, posé dans le coin ouvert, tourné vers le terrain.
  const [sc, sx] = canvas(1024, 576)
  const screenTex = new THREE.CanvasTexture(sc)
  screenTex.colorSpace = THREE.SRGBColorSpace
  const screen = new THREE.Group()
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), new THREE.MeshBasicMaterial({ map: screenTex, color: new THREE.Color(1.5, 1.5, 1.5), toneMapped: false }))
  const frame = new THREE.Mesh(new THREE.BoxGeometry(16.8, 9.8, 0.8), backMat)
  frame.position.z = -0.45
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.8, 14, 0.8), backMat)
  legs.position.set(-5, -11, -0.6)
  const legs2 = legs.clone()
  legs2.position.x = 5
  screen.add(panel, frame, legs, legs2)
  screen.position.set(-63, 18.5, -48)
  screen.lookAt(0, 6, 10)
  scene.add(screen)

  let info: ScreenInfo = { mode: 'logo' }
  let pendingInfo: ScreenInfo | null = null
  let flashT = 0
  function draw(t: number) {
    const W = 1024
    const H = 576
    const g = sx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, '#0b1030')
    g.addColorStop(1, '#03040c')
    sx.fillStyle = g
    sx.fillRect(0, 0, W, H)
    sx.textAlign = 'center'
    sx.textBaseline = 'middle'
    if (info.mode === 'goal' && flashT > 0) {
      sx.fillStyle = Math.floor(t * 6) % 2 ? '#ffc63d' : '#fff3c4'
      sx.font = '400 250px Anton, Impact, sans-serif'
      sx.fillText('BUT !', W / 2, H / 2 - 30)
      sx.fillStyle = '#ffffff'
      sx.font = '700 54px "Barlow Condensed", sans-serif'
      sx.fillText((info.scorer ?? '').toUpperCase(), W / 2, H - 80)
    } else if (info.mode === 'score' && info.a && info.b) {
      sx.font = '700 40px "Barlow Condensed", sans-serif'
      sx.fillStyle = '#ffe7a3'
      sx.fillText((info.label ?? '').toUpperCase(), W / 2, 70)
      const crest = (cx: number, col: string, txt: string) => {
        sx.fillStyle = col
        // Carré à coins arrondis, tracé à la main (roundRect n'existe pas sur les vieux Safari).
        const x0 = cx - 95
        const y0 = 160
        const s = 190
        const r = 36
        sx.beginPath()
        sx.moveTo(x0 + r, y0)
        sx.arcTo(x0 + s, y0, x0 + s, y0 + s, r)
        sx.arcTo(x0 + s, y0 + s, x0, y0 + s, r)
        sx.arcTo(x0, y0 + s, x0, y0, r)
        sx.arcTo(x0, y0, x0 + s, y0, r)
        sx.closePath()
        sx.fill()
        sx.fillStyle = '#05060c'
        sx.font = '400 96px Anton, Impact, sans-serif'
        sx.fillText(txt, cx, 258)
      }
      crest(190, info.a.color, info.a.short)
      crest(W - 190, info.b.color, info.b.short)
      sx.fillStyle = '#ffffff'
      sx.font = '400 210px Anton, Impact, sans-serif'
      sx.fillText(`${info.scoreA ?? 0}-${info.scoreB ?? 0}`, W / 2, 262)
      if (icon) {
        const h = 96
        const w = (h * icon.naturalWidth) / icon.naturalHeight
        sx.drawImage(icon, W / 2 - w / 2, H - 40 - h, w, h)
      }
    } else if (icon) {
      // Écran d'attente : l'icône School Cup en grand, avec un halo doré.
      const glow = sx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 300)
      glow.addColorStop(0, 'rgba(255,198,61,0.28)')
      glow.addColorStop(1, 'rgba(255,198,61,0)')
      sx.fillStyle = glow
      sx.fillRect(0, 0, W, H)
      const h = 470
      const w = (h * icon.naturalWidth) / icon.naturalHeight
      sx.drawImage(icon, W / 2 - w / 2, (H - h) / 2, w, h)
    }
    // Trame de pixels.
    sx.fillStyle = 'rgba(0,0,0,0.28)'
    for (let i = 0; i < W; i += 4) sx.fillRect(i, 0, 1, H)
    for (let j = 0; j < H; j += 4) sx.fillRect(0, j, W, 1)
    screenTex.needsUpdate = true
  }
  draw(0)
  const redrawLed = () => {
    ;(tex.image as HTMLCanvasElement).getContext('2d')!.drawImage(ledCanvas(defaultMsgs, icon), 0, 0)
    tex.needsUpdate = true
  }
  document.fonts?.ready.then(() => {
    draw(0)
    redrawLed()
  })
  loadImage('/logo/icone.webp')
    .then((img) => {
      icon = img
      draw(0)
      redrawLed()
    })
    .catch(() => {
      /* sans icône, les panneaux gardent un point doré */
    })

  let lastDraw = 0
  return {
    setInfo(next: ScreenInfo) {
      if (next.mode === 'goal') flashT = 5
      info = next.mode === 'goal' || flashT <= 0 ? next : info
      if (next.mode !== 'goal') pendingInfo = next
      draw(lastDraw)
    },
    update(t: number, dt: number) {
      tex.offset.x = (t * 0.045) % 1
      if (flashT > 0) {
        flashT -= dt
        if (t - lastDraw > 0.16) {
          lastDraw = t
          draw(t)
        }
        if (flashT <= 0 && pendingInfo) {
          info = pendingInfo
          draw(t)
        }
      }
    },
  }
}
