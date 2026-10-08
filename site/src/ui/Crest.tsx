import type { Team } from '../data/types'

/** Petit écusson d'équipe aux couleurs de la classe. */
export function Crest({ team, small }: { team: Team | null | undefined; small?: boolean }) {
  if (!team) return <div className={`crestlet${small ? ' sm' : ''}`} style={{ background: 'rgba(255,255,255,.08)', color: 'var(--dim)' }} aria-hidden="true">?</div>
  return (
    <div
      className={`crestlet${small ? ' sm' : ''}`}
      style={{ background: `linear-gradient(135deg, ${team.color1}, ${shade(team.color1, -0.35)})`, color: team.color2 }}
      aria-hidden="true"
    >
      {team.short}
    </div>
  )
}

/** Assombrit (valeur négative) ou éclaircit une couleur hexadécimale. */
export function shade(hex: string, amt: number) {
  const n = parseInt(hex.replace('#', ''), 16)
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (amt < 0 ? c * amt : (255 - c) * amt))))
  const r = f((n >> 16) & 255)
  const g = f((n >> 8) & 255)
  const b = f(n & 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
