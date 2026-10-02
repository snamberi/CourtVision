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
    // The scene collection is small and bundled: every look also works on the first offline switch.
    const sceneNames = new Set(['original', 'cartridge', 'scoreboard', 'prodark', 'terminal', 'frontoffice', 'hardwood', 'blacktop', 'playbook', 'handheld', 'broadcast', 'neongrid', 'arcade', 'comicpop', 'championship', 'aurora', 'royalcourt', 'galaxy', 'hallowed', 'eclipse', 'immortal', 'sovereign'])
    for (const [file, item] of Object.entries(bundle)) if (item.type === 'asset' && file.endsWith('.svg') && sceneNames.has(file.split('/').pop()!.split('-')[0])) shell.add(`/${file}`)
    const version = createHash('sha256').update(Object.keys(bundle).sort().join('|')).digest('hex').slice(0, 12)
    const source = readFileSync(new URL('./scripts/sw.template.js', import.meta.url), 'utf8')
      .replace('__VERSION__', version).replace('__SHELL__', JSON.stringify([...shell], null, 2))
    this.emitFile({ type: 'asset', fileName: 'sw.js', source })
  },
})

/** The live site, used when the build is not told another address (SITE_URL). */
const PRODUCTION_SITE = 'https://courtvisiongame.com'

/**
 * robots.txt and sitemap.xml for the web build: the game plus the crawlable guide pages (see scripts/generate-site-pages.mjs).
 * The sitemap needs the site's address: SITE_URL (set it on Cloudflare), or the production address Vercel provides at build time.
 */
const siteMaps = (): Plugin => ({
  name: 'site-maps',
  apply: 'build',
  generateBundle() {
    const raw = process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '') || PRODUCTION_SITE;
    const site = raw.replace(/\/$/, '');
    const updated = (JSON.parse(readFileSync(new URL('./src/content/sitePages.json', import.meta.url), 'utf8')) as { updated: string }).updated;
    const pages: [string, number][] = [['', 1], ['guides/', 0.8], ['guides/82-0-challenge.html', 0.8], ['guides/league-hunt.html', 0.8], ['guides/career-mode.html', 0.8],
      ['guides/all-time-draft.html', 0.7], ['guides/rebuild-challenge.html', 0.7], ['guides/real-nba-history.html', 0.7], ['guides/ratings-explained.html', 0.6],
      ['how-to-play.html', 0.8], ['faq.html', 0.8], ['about.html', 0.6], ['changelog.html', 0.5], ['privacy.html', 0.3]];
    // Search engines and AI assistants (ChatGPT, Claude, Perplexity, Gemini...) may read every page; the API is not for crawling.
    const aiBots = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended', 'Bingbot', 'DuckAssistBot', 'meta-externalagent'];
    const robots = ['User-agent: *', 'Allow: /', 'Disallow: /api/', '', ...aiBots.flatMap(b => [`User-agent: ${b}`, 'Allow: /', 'Disallow: /api/', '']), `Sitemap: ${site}/sitemap.xml`, ''].join('\n');
    this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots });
    this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(([p, pr]) => `  <url><loc>${site}/${p}</loc><lastmod>${updated}</lastmod><priority>${pr.toFixed(1)}</priority></url>`).join('\n')}\n</urlset>\n` });
  },
})

/** The production domain, for share-card footers (a preview deployment's address changes with every deploy). */
const siteHost = (process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')).replace(/^https?:\/\//, '').replace(/\/$/, '')

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  define: mode === 'desktop' ? {} : {
    'import.meta.env.VITE_SITE_HOST': JSON.stringify(siteHost),
    // Which host built this (Vercel sets VERCEL, Cloudflare Pages CF_PAGES, Cloudflare Workers Builds WORKERS_CI): Vercel's own analytics only runs there.
    'import.meta.env.VITE_HOST_PLATFORM': JSON.stringify(process.env.VERCEL ? 'vercel' : process.env.CF_PAGES || process.env.WORKERS_CI ? 'cloudflare' : ''),
    // Accounts: the Supabase address and public key (safe to ship; row level security guards the data).
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ''),
    // Passes: the Lemon Squeezy checkout links (public; see docs/BILLING_SETUP.md). Empty hides the buy buttons.
    'import.meta.env.VITE_LEMONSQUEEZY_NO_ADS_URL': JSON.stringify(process.env.VITE_LEMONSQUEEZY_NO_ADS_URL || process.env.LEMONSQUEEZY_NO_ADS_URL || ''),
    'import.meta.env.VITE_LEMONSQUEEZY_SUPPORTER_URL': JSON.stringify(process.env.VITE_LEMONSQUEEZY_SUPPORTER_URL || process.env.LEMONSQUEEZY_SUPPORTER_URL || ''),
  },
  plugins: mode === 'desktop' ? [react(), stripAdsense()] : [react(), siteMaps(), serviceWorker()],
  // `--mode desktop` is the offline Windows package: relative asset paths, its own output folder.
  base: mode === 'desktop' ? './' : '/',
  build: {
    ...(mode === 'desktop' ? { outDir: 'dist-desktop', emptyOutDir: true } : {}),
    // No <link rel=modulepreload>: once the service worker controls the page, Chrome refuses to match preloads with the
    // real script requests ("cross-world service worker resource mismatch") and warns that each one went unused. The
    // service worker serves the chunks from its cache, so the preloads bought nothing on return visits anyway.
    modulePreload: false,
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
