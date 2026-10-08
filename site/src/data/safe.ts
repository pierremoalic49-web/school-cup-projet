// Petits outils « qui ne plantent jamais », pour que le site marche sur tous les téléphones.

type Store = 'local' | 'session'

/** Lire le stockage du navigateur. En navigation privée (Safari), il peut être bloqué : on renvoie null. */
export function storeGet(where: Store, key: string): string | null {
  try {
    return (where === 'local' ? localStorage : sessionStorage).getItem(key)
  } catch {
    return null
  }
}

/** Écrire dans le stockage du navigateur, sans jamais faire planter la page. Renvoie false si impossible. */
export function storeSet(where: Store, key: string, value: string | null): boolean {
  try {
    const s = where === 'local' ? localStorage : sessionStorage
    if (value === null) s.removeItem(key)
    else s.setItem(key, value)
    return true
  } catch {
    return false
  }
}

/**
 * Un identifiant unique au format UUID (celui qu'attend la base Supabase).
 * crypto.randomUUID n'existe qu'en HTTPS ; getRandomValues marche partout.
 */
export function uuid(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') {
    try {
      return c.randomUUID()
    } catch {
      /* contexte non sécurisé : on passe à la méthode suivante */
    }
  }
  const b = new Uint8Array(16)
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(b)
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256)
  b[6] = (b[6] & 0x0f) | 0x40 // version 4
  b[8] = (b[8] & 0x3f) | 0x80 // variante RFC 4122
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
