import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/** The offline Windows edition shows no network ads, so its page drops the AdSense tag. */
const stripAdsense = (): Plugin => ({
  name: 'strip-adsense',
  transformIndexHtml: html => html.replace(/\s*<!-- AdSense publisher tag[\s\S]*?<\/script>/, ''),
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: mode === 'desktop' ? [react(), stripAdsense()] : [react()],
  // `--mode desktop` is the offline Windows package: relative asset paths, its own output folder.
  base: mode === 'desktop' ? './' : '/',
  build: {
    ...(mode === 'desktop' ? { outDir: 'dist-desktop', emptyOutDir: true } : {}),
    // Libraries get their own chunks: they change rarely, so returning players keep them cached across game updates.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'dexie', test: /node_modules[\\/]dexie[\\/]/ },
          ],
        },
      },
    },
  },
}))
