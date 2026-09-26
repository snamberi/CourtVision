import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // `--mode desktop` is the offline Windows package: relative asset paths, its own output folder.
  base: mode === 'desktop' ? './' : '/',
  build: mode === 'desktop' ? { outDir: 'dist-desktop', emptyOutDir: true } : undefined,
}))
