// Adresse de base du site : « / » en local ou sur un nom de domaine, « /school-cup-projet/ » sur GitHub Pages.
// Tous les fichiers du dossier public/ (logo, sons, joueurs) passent par asset() pour fonctionner partout.
export const BASE = import.meta.env.BASE_URL

/** Chemin d'un fichier de public/ : asset('logo/icone.webp') → '/school-cup-projet/logo/icone.webp' sur GitHub Pages. */
export const asset = (p: string) => BASE + p.replace(/^\//, '')

/** Chemin de la page courante sans l'adresse de base : '/admin' même sur GitHub Pages. */
export const route = () => '/' + location.pathname.slice(BASE.length).replace(/\/+$/, '')
