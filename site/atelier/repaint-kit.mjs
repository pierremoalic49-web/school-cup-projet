// Atelier : repeint la tenue d'origine (rayures, faux sponsor, liserés orange) aux couleurs School Cup.
// La peau est gardée telle quelle ; l'orange devient or ; le reste du tissu devient bleu nuit
// (on garde un peu du relief du tissu) ; les crampons deviennent noirs.
// Usage : node atelier/repaint-kit.mjs  →  public/joueurs/kit-g.webp
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const tex = (n) => fileURLToPath(new URL(`../../assets/joueur-3d/rocketbox/tex/${n}`, import.meta.url))
const outDir = fileURLToPath(new URL('../public/joueurs/', import.meta.url))
mkdirSync(outDir, { recursive: true })

const NAVY = [28, 47, 110]
const GOLD = [255, 198, 61]
const BOOT = [14, 16, 22]
// Zones des crampons dans l'image 2048 × 2048 (rectangles [x0, y0, x1, y1]).
const BOOTS = [
  [430, 1380, 650, 2048],
  [1300, 1380, 1480, 2048],
]
// Zones à effacer complètement : faux sponsor « FYA MOTORS » et ancien écusson.
const ERASE = [
  [820, 1100, 1210, 1410],
]
const inRect = (x, y, r) => x >= r[0] && x < r[2] && y >= r[1] && y < r[3]

const { data, info } = await sharp(tex('m301_body_color.png')).raw().toBuffer({ resolveWithObject: true })
const W = info.width
const ch = info.channels
for (let i = 0; i < data.length; i += ch) {
  const r = data[i]
  const g = data[i + 1]
  const b = data[i + 2]
  const p = i / ch
  const x = p % W
  const y = Math.floor(p / W)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  const skin = r > g && g > b && r - b > 40 && r > 100 && r - g < 90
  const orange = r > 170 && g < 140 && b < 100 && r - g > 80
  let c
  // Le faux sponsor et l'ancien écusson (sur le devant) disparaissent dans le bleu, même leurs bords.
  const erase = ERASE.some((rc) => inRect(x, y, rc))
  if (skin && !erase) continue
  if (orange && !erase) c = GOLD.map((v) => v * (0.75 + 0.3 * lum))
  else if (BOOTS.some((rc) => inRect(x, y, rc))) c = BOOT.map((v) => v * (0.7 + 0.8 * lum))
  // Bleu presque uni : les anciennes rayures et numéros ne doivent plus se deviner.
  else c = NAVY.map((v) => v * (0.97 + 0.02 * (lum - 0.5)))
  data[i] = Math.min(255, c[0])
  data[i + 1] = Math.min(255, c[1])
  data[i + 2] = Math.min(255, c[2])
}
await sharp(data, { raw: { width: W, height: info.height, channels: ch } }).webp({ quality: 88 }).toFile(outDir + 'kit-g.webp')
await sharp(data, { raw: { width: W, height: info.height, channels: ch } }).resize(1000).png().toFile(fileURLToPath(new URL('../../assets/joueur-3d/rocketbox/tex/kit-g-apercu.png', import.meta.url)))
console.log('ok')
