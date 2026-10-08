// Petits outils partagés par toute la scène 3D.
import * as THREE from 'three'

/** Générateur aléatoire « à graine » : le stade est identique à chaque visite. */
export function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
export const smooth = (t: number) => t * t * (3 - 2 * t)
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!] as const
}

/** Halo doux (dégradé radial) utilisé pour les lueurs des projecteurs et des flashs. */
export function glowTexture(inner = 'rgba(255,255,255,1)', mid = 'rgba(255,236,200,0.35)') {
  const [c, x] = canvas(128, 128)
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, inner)
  g.addColorStop(0.15, mid)
  g.addColorStop(0.45, 'rgba(255,220,170,0.08)')
  g.addColorStop(1, 'rgba(255,220,170,0)')
  x.fillStyle = g
  x.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Reflet « anamorphique » horizontal, typique des caméras de retransmission TV. */
export function streakTexture() {
  const [c, x] = canvas(256, 32)
  const g = x.createLinearGradient(0, 0, 256, 0)
  g.addColorStop(0, 'rgba(160,200,255,0)')
  g.addColorStop(0.5, 'rgba(220,235,255,1)')
  g.addColorStop(1, 'rgba(160,200,255,0)')
  x.fillStyle = g
  const v = x.createLinearGradient(0, 0, 0, 32)
  v.addColorStop(0, 'rgba(0,0,0,1)')
  v.addColorStop(0.5, 'rgba(0,0,0,0)')
  v.addColorStop(1, 'rgba(0,0,0,1)')
  x.fillRect(0, 0, 256, 32)
  x.globalCompositeOperation = 'destination-out'
  x.fillStyle = v
  x.fillRect(0, 0, 256, 32)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Bruit de valeur lissé, en GLSL, réutilisé par plusieurs shaders. */
export const GLSL_NOISE = /* glsl */ `
float sc_hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float sc_noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float a = sc_hash(i), b = sc_hash(i+vec2(1,0)), c = sc_hash(i+vec2(0,1)), d = sc_hash(i+vec2(1,1));
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float sc_fbm(vec2 p){ float v = 0.0, a = 0.5; for(int i=0;i<5;i++){ v += a*sc_noise(p); p *= 2.03; a *= 0.5; } return v; }
`

export type Tier = 'low' | 'mid' | 'high'

/** Choisit la qualité 3D selon l'appareil (on l'abaisse ensuite si les images/s chutent). */
export function detectTier(): Tier {
  const nav = navigator as Navigator & { deviceMemory?: number }
  const cores = nav.hardwareConcurrency || 4
  const mem = nav.deviceMemory ?? 8
  const small = Math.min(window.innerWidth, window.innerHeight) < 600
  const coarse = window.matchMedia?.('(pointer: coarse)').matches
  const forced = new URLSearchParams(location.search).get('qualite')
  if (forced === 'low' || forced === 'mid' || forced === 'high') return forced
  if (mem <= 3 || cores <= 4) return 'low'
  if (small || coarse) return 'mid'
  return 'high'
}
