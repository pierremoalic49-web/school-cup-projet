import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// Dossier des fichiers sources des personnages 3D (hors du site, utilisé seulement par l'atelier en développement).
const assetsDir = fileURLToPath(new URL('../assets/', import.meta.url)).replace(/\\/g, '/')

// https://vite.dev/config/
export default defineConfig({
  // Sur GitHub Pages, le site vit dans /school-cup-projet/ (variable fournie par la publication automatique).
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  define: { __ASSETS_DIR__: JSON.stringify(assetsDir) },
  server: { fs: { allow: ['.', '..'] } },
  build: {
    // Le stade 3D (Three.js) fait ~170 Ko compressés ; il est chargé à part, après le reste du site.
    chunkSizeWarningLimit: 800,
  },
})
