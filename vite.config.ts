import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { defineConfig, type Plugin } from 'vite'

/** The offline Windows edition shows no network ads, so its page drops the AdSense tag. */
const stripAdsense = (): Plugin => ({
  name: 'strip-adsense',
  transformIndexHtml: html => html.replace(/\s*<!-- AdSense publisher tag[\s\S]*?<\/script>/, '').replace(/\s*<!-- AMP auto ads \(keep[\s\S]*?<\/script>/, '').replace(/\s*<!-- AMP auto ads tag -->[\s\S]*?<!-- \/AMP auto ads tag -->/, '')
    .replace(/\s*<!-- PWA -->[\s\S]*?<!-- \/PWA -->/, ''),
})

/**
 * The service worker for the web build (installable app, plays offline): scripts/sw.template.js with the app shell
 * (the page, its entry script, the chunks it imports and their styles) and a version that changes with every build.
 */
const serviceWorker = (): Plugin => ({
  name: 'service-worker',
  apply: 'build',
  generateBundle(_options, bundle) {
    const shell = new Set<string>(['/', '/manifest.webmanifest', '/icons/icon-192.png', '/favicon.png'])
    const add = (file: string) => {
      const item = bundle[file]
      if (!item || shell.has(`/${file}`)) return
      shell.add(`/${file}`)
      if (item.type === 'chunk') {
        for (const css of item.viteMetadata?.importedCss ?? []) shell.add(`/${css}`)
        item.imports.forEach(add)
      }
    }
    for (const [file, item] of Object.entries(bundle)) if (item.type === 'chunk' && item.isEntry) add(file)
    const version = createHash('sha256').update(Object.keys(bundle).sort().join('|')).digest('hex').slice(0, 12)
    const source = readFileSync(new URL('./scripts/sw.template.js', import.meta.url), 'utf8')
      .replace('__VERSION__', version).replace('__SHELL__', JSON.stringify([...shell], null, 2))
    this.emitFile({ type: 'asset', fileName: 'sw.js', source })
  },
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

/** The production domain, for share-card footers (a preview deployment's address changes with every deploy). */
const siteHost = (process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')).replace(/^https?:\/\//, '').replace(/\/$/, '')

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  define: mode === 'desktop' ? {} : {
    'import.meta.env.VITE_SITE_HOST': JSON.stringify(siteHost),
    // Accounts: the Supabase address and public key (safe to ship; row level security guards the data).
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ''),
  },
  plugins: mode === 'desktop' ? [react(), stripAdsense()] : [react(), siteMaps(), serviceWorker()],
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
