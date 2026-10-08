// Icônes SVG au trait (pas d'émojis, comme demandé dans la direction artistique).
import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }
const base = (size = 18) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
})

export const Play = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M8 5l11 7-11 7z" fill="currentColor" />
  </svg>
)
export const SoundOn = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 9v6h4l5 4V5L8 9z" />
    <path d="M16.5 8.5a5 5 0 0 1 0 7" />
    <path d="M19 6a8.5 8.5 0 0 1 0 12" />
  </svg>
)
export const SoundOff = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 9v6h4l5 4V5L8 9z" />
    <path d="M17 9l5 6M22 9l-5 6" />
  </svg>
)
export const Lock = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="4" y="11" width="16" height="9" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
)
export const Trophy = ({ size, ...p }: P) => (
  <svg {...base(size)} strokeWidth={1.4} {...p}>
    <path d="M7 4h10v4a5 5 0 0 1-10 0z" />
    <path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" />
    <path d="M12 13v4M8 21h8M9 17h6v4H9z" />
  </svg>
)
export const Calendar = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
)
export const Pin = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </svg>
)
export const Clock = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
)
export const Whistle = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M3 11h11a5 5 0 1 1-5 5" />
    <path d="M14 11V7h7" />
    <circle cx="9" cy="16" r="1.5" />
  </svg>
)
export const Chat = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 5h16v11H9l-5 4z" />
  </svg>
)
export const Live = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    <path d="M7.5 7.5a6.4 6.4 0 0 0 0 9M16.5 7.5a6.4 6.4 0 0 1 0 9M4.6 4.6a10.5 10.5 0 0 0 0 14.8M19.4 4.6a10.5 10.5 0 0 1 0 14.8" />
  </svg>
)
export const Bracket = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M3 5h5v5H3M3 14h5v5H3M8 7.5h4v9H8M12 12h4M16 9h5v6h-5z" />
  </svg>
)
export const Boot = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M5 4h6v7l7 3a3 3 0 0 1 3 3v2H3v-3l2-1z" />
    <path d="M6 19v2M10 19v2M14 19v2M18 19v2" />
  </svg>
)
export const Users = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M16 14.2a5 5 0 0 1 6 4.8" />
  </svg>
)
export const Info = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6M12 7.5v.5" />
  </svg>
)
export const Close = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)
export const Plus = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
export const Minus = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M5 12h14" />
  </svg>
)
export const Undo = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
  </svg>
)
export const Camera = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
)
export const Trash = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
  </svg>
)
export const Gear = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
)
export const Check = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
)
export const ArrowLeft = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
)

/** Silhouette de joueur, affichée quand il n'y a pas de photo autorisée. */
export const Silhouette = () => (
  <svg viewBox="0 0 140 150" aria-hidden="true">
    <defs>
      <linearGradient id="sil" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="currentColor" stopOpacity=".95" />
        <stop offset="1" stopColor="currentColor" stopOpacity=".35" />
      </linearGradient>
    </defs>
    {/* épaules et maillot */}
    <path d="M8 150c2-24 10-38 26-45 9-4 18-6 24-9l12 10 12-10c6 3 15 5 24 9 16 7 24 21 26 45z" fill="url(#sil)" />
    {/* col en V */}
    <path d="M58 96l12 12 12-12" fill="none" stroke="rgba(0,0,0,.4)" strokeWidth="3.5" strokeLinejoin="round" />
    {/* cou */}
    <path d="M60 74h20v16c-3 5-7 8-10 8s-7-3-10-8z" fill="url(#sil)" opacity=".85" />
    {/* tête et cheveux */}
    <path d="M70 18c15 0 24 11 24 27 0 19-11 34-24 34S46 64 46 45c0-16 9-27 24-27z" fill="url(#sil)" />
    <path d="M46 42c0-17 10-27 24-27s25 9 24 26c-4-7-11-11-24-11s-20 4-24 12z" fill="rgba(0,0,0,.28)" />
  </svg>
)
