import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Le stade 3D (Three.js) fait ~170 Ko compressés ; il est chargé à part, après le reste du site.
    chunkSizeWarningLimit: 800,
  },
})
