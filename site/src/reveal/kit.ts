// La tenue School Cup d'un joueur : on part de la texture repeinte (kit-g.webp : maillot bleu nuit,
// liserés or) et on y imprime le numéro, le prénom au dos, « SCHOOL CUP » et l'écusson.
// Les positions sont celles de l'image d'origine (2048 × 2048) : le dos y est dessiné à l'envers.

export interface KitOptions {
  number: number
  name: string // prénom, imprimé en majuscules au dos
}

const GOLD = '#FFC63D'
const GOLD_DEEP = '#A8740A'
const OFFWHITE = '#F6F4EC'

/** Prénom imprimable : majuscules, 12 lettres maximum. */
export function shirtName(firstName: string) {
  return firstName.trim().toUpperCase().slice(0, 12)
}

function printText(x: CanvasRenderingContext2D, text: string, cx: number, cy: number, size: number, maxW: number, fill: string, upsideDown: boolean) {
  x.save()
  x.translate(cx, cy)
  if (upsideDown) x.rotate(Math.PI)
  x.font = `400 ${size}px Anton, Impact, sans-serif`
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  const w = x.measureText(text).width
  if (w > maxW) x.scale(maxW / w, 1) // les longs prénoms sont resserrés plutôt que coupés
  // Liseré sombre (impression thermocollée), puis remplissage or avec un léger dégradé.
  x.lineJoin = 'round'
  x.lineWidth = size * 0.07
  x.strokeStyle = '#070D24'
  x.strokeText(text, 0, 0)
  if (fill === GOLD) {
    const g = x.createLinearGradient(0, -size / 2, 0, size / 2)
    g.addColorStop(0, '#FFE7A3')
    g.addColorStop(0.5, GOLD)
    g.addColorStop(1, GOLD_DEEP)
    x.fillStyle = g
  } else x.fillStyle = fill
  x.fillText(text, 0, 0)
  x.restore()
}

/** Dessine la tenue complète d'un joueur dans un canvas 2048 × 2048. */
export function paintKit(base: HTMLImageElement, crest: HTMLImageElement | null, o: KitOptions) {
  const c = document.createElement('canvas')
  c.width = c.height = 2048
  const x = c.getContext('2d')!
  x.drawImage(base, 0, 0, 2048, 2048)
  const num = String(o.number)
  // Dos (à l'envers dans l'image) : prénom puis grand numéro.
  printText(x, shirtName(o.name), 980, 725, 92, 430, OFFWHITE, true)
  printText(x, num, 980, 450, 330, 420, GOLD, true)
  // Devant : écusson côté cœur, « SCHOOL CUP » en travers de la poitrine, numéro au centre.
  if (crest) {
    const h = 120
    const w = (h * crest.naturalWidth) / crest.naturalHeight
    x.drawImage(crest, 1075 - w / 2, 1155 - h / 2, w, h)
  }
  printText(x, 'SCHOOL CUP', 975, 1290, 92, 400, OFFWHITE, false)
  printText(x, num, 975, 1500, 210, 300, GOLD, false)
  // Numéro sur le short (cuisse gauche).
  printText(x, num, 335, 330, 120, 160, GOLD, false)
  return c
}
