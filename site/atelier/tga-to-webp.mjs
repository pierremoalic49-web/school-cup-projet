// Atelier : convertit les textures TGA des personnages Rocketbox en PNG (sans perte, pour retravailler)
// et en WebP (léger). Usage : node atelier/tga-to-webp.mjs
import { readdirSync, readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const dir = new URL('../../assets/joueur-3d/rocketbox/', import.meta.url)
const out = new URL('tex/', dir)
mkdirSync(out, { recursive: true })

/** Lit un TGA non compressé (types 2 et 3) ou compressé RLE (types 10 et 11) et renvoie des pixels RGBA. */
function readTga(buf) {
  const idLen = buf[0]
  const type = buf[2]
  const w = buf.readUInt16LE(12)
  const h = buf.readUInt16LE(14)
  const bpp = buf[16]
  const topDown = (buf[17] & 0x20) !== 0
  const px = bpp / 8
  let p = 18 + idLen + (buf[1] ? buf.readUInt16LE(5) * Math.ceil(buf[7] / 8) : 0)
  const src = Buffer.alloc(w * h * px)
  if (type === 2 || type === 3) buf.copy(src, 0, p, p + w * h * px)
  else if (type === 10 || type === 11) {
    let o = 0
    while (o < src.length) {
      const c = buf[p++]
      const n = (c & 0x7f) + 1
      if (c & 0x80) {
        for (let i = 0; i < n; i++) buf.copy(src, o + i * px, p, p + px)
        p += px
      } else {
        buf.copy(src, o, p, p + n * px)
        p += n * px
      }
      o += n * px
    }
  } else throw new Error(`TGA de type ${type} non géré`)
  const rgba = Buffer.alloc(w * h * 4)
  for (let y = 0; y < h; y++) {
    const sy = topDown ? y : h - 1 - y
    for (let x = 0; x < w; x++) {
      const s = (sy * w + x) * px
      const d = (y * w + x) * 4
      if (px === 1) {
        rgba[d] = rgba[d + 1] = rgba[d + 2] = src[s]
        rgba[d + 3] = 255
      } else {
        rgba[d] = src[s + 2]
        rgba[d + 1] = src[s + 1]
        rgba[d + 2] = src[s]
        rgba[d + 3] = px === 4 ? src[s + 3] : 255
      }
    }
  }
  return { w, h, rgba, info: `type ${type}, ${bpp} bits, ${topDown ? 'haut→bas' : 'bas→haut'}` }
}

for (const f of readdirSync(dir).filter((n) => n.endsWith('.tga'))) {
  const { w, h, rgba, info } = readTga(readFileSync(new URL(f, dir)))
  const base = f.replace(/\.tga$/, '')
  const img = sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
  await img.clone().png().toFile(fileURLToPath(new URL(base + '.png', out)))
  console.log(`${f} : ${w}×${h}, ${info}`)
}
