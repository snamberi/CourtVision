import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/** The offline Windows edition shows no network ads, so its page drops the AdSense tag. */
const stripAdsense = (): Plugin => ({
  name: 'strip-adsense',
  transformIndexHtml: html => html.replace(/\s*<!-- AdSense publisher tag[\s\S]*?<\/script>/, '').replace(/\s*<!-- AMP auto ads \(keep[\s\S]*?<\/script>/, '').replace(/\s*<!-- AMP auto ads tag -->[\s\S]*?<!-- \/AMP auto ads tag -->/, ''),
})

/**
 * robots.txt and sitemap.xml for the web build: the game plus the crawlable guide pages (see scripts/generate-site-pages.mjs).
 * The sitemap needs the site's address: SITE_URL, or the production address Vercel provides at build time.
 */
const siteMaps = (): Plugin => ({
  name: 'site-maps',
  apply: 'build',
  generateBundle() {
    const raw = process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
    const site = raw.replace(/\/$/, '');
    const pages = ['', 'about.html', 'how-to-play.html', 'guides/', 'guides/career-mode.html', 'guides/league-hunt.html', 'guides/rebuild-challenge.html',
      'guides/real-nba-history.html', 'guides/ratings-explained.html', 'faq.html', 'changelog.html', 'privacy.html'];
    this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\n${site ? `\nSitemap: ${site}/sitemap.xml\n` : ''}` });
    if (site) this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(p => `  <url><loc>${site}/${p}</loc></url>`).join('\n')}\n</urlset>\n` });
  },
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: mode === 'desktop' ? [react(), stripAdsense()] : [react(), siteMaps()],
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
