import { describe, expect, it } from 'vitest';
import content from '../content/sitePages.json';

// The generated pages, as text, keyed by their path under public/.
const files = Object.fromEntries(Object.entries(import.meta.glob('../../public/**/*.html', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)
  .map(([k, v]) => [k.replace('../../public/', ''), v]));
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Resolves a relative href from a page to a path under public/. */
function resolve(from: string, href: string): string {
  const parts = from.split('/').slice(0, -1);
  for (const seg of href.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg && seg !== '.') parts.push(seg);
  }
  return parts.join('/') + (href.endsWith('/') || href === '' ? '/' : '');
}

describe('crawlable site pages', () => {
  it('every page is generated and up to date with its content (run npm run generate:pages)', () => {
    for (const page of content.pages) {
      const html = files[page.path];
      expect(html, page.path).toBeTruthy();
      expect(html).toContain(`<title>${esc(page.title)}</title>`);
      expect(html).toContain(`<meta name="description" content="${esc(page.description)}">`);
      expect(html).toContain(`<h1>${esc(page.h1)}</h1>`);
      for (const s of page.sections) expect(html, `${page.path}: ${s.h2}`).toContain(esc(s.h2));
      // Real text for readers (and reviewers): no thin pages.
      expect(html.replace(/<[^>]+>/g, ' ').split(/\s+/).length, page.path).toBeGreaterThan(300);
    }
  });

  it('every internal link resolves to a page or file', () => {
    const known = new Set([...Object.keys(files), 'favicon.png', 'downloads/CourtVision-Windows.zip']);
    for (const [path, html] of Object.entries(files)) {
      for (const [, href] of html.matchAll(/href="([^"#]*)(?:#[^"]*)?"/g)) {
        if (/^(https?:|mailto:)/.test(href)) continue;
        const target = resolve(path, href);
        const ok = target === '/' || target === '' || (target.endsWith('/') ? known.has(`${target}index.html`) : known.has(target));
        expect(ok, `${path} -> ${href}`).toBe(true);
      }
    }
  });
});
