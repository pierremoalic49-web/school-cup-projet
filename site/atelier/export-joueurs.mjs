// Atelier : copie dans public/joueurs/ ce que le site charge au clic sur un joueur
// (modèle, animations, textures en WebP). Usage : node atelier/export-joueurs.mjs
import { copyFileSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const src = (n) => fileURLToPath(new URL(`../../assets/joueur-3d/rocketbox/${n}`, import.meta.url))
const out = (n) => fileURLToPath(new URL(`../public/joueurs/${n}`, import.meta.url))
mkdirSync(out(''), { recursive: true })

copyFileSync(src('Sports_Male_02.fbx'), out('g.fbx'))
for (const a of ['m_idle_breathe_01', 'm_walk_start', 'm_walk_stop', 'm_cheer_03', 'm_cheer_04', 'm_cheer_05']) copyFileSync(src(`${a}.max.fbx`), out(`${a}.fbx`))
const webp = (n, o, size, q = 82) => sharp(src(`tex/${n}.png`)).resize(size).webp({ quality: q }).toFile(out(o))
await webp('m301_body_normal', 'g-body-normal.webp', 1024, 85)
await webp('m301_head_color', 'g-head.webp', 1024)
await webp('m301_head_normal', 'g-head-normal.webp', 1024, 85)
// Licence MIT des personnages (obligatoire quand on les redistribue).
writeFileSync(out('LICENSE-rocketbox.txt'), 'Personnages 3D : Microsoft Rocketbox Avatar Library (https://github.com/microsoft/Microsoft-Rocketbox), modifiés.\n\n' + readFileSync(src('LICENSE.md'), 'utf8'))
console.log('ok')
