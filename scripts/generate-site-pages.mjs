// Renders src/content/sitePages.json into plain, crawlable HTML pages in public/ (About, How to Play, the guides, FAQ,
// Changelog): readable without JavaScript, for players, search engines and ad reviewers. Edit the JSON, not the pages.
//   npm run generate:pages
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const content = JSON.parse(readFileSync(join(root, 'src', 'content', 'sitePages.json'), 'utf8'));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** **bold** and [label](url); site links are made relative to the page's folder. */
function inline(text, prefix) {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => /^https?:/.test(url)
      ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`
      : `<a href="${prefix}${url}">${label}</a>`);
}

function block(b, prefix, from) {
  switch (b.type) {
    case 'p': return `<p>${inline(b.text, prefix)}</p>`;
    case 'ul': return `<ul>\n${b.items.map((i) => `  <li>${inline(i, prefix)}</li>`).join('\n')}\n</ul>`;
    case 'ol': return `<ol>\n${b.items.map((i) => `  <li>${inline(i, prefix)}</li>`).join('\n')}\n</ol>`;
    case 'table':
      return `<div class="table-wrap"><table>\n<thead><tr>${b.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>\n<tbody>\n${
        b.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('\n')}\n</tbody></table></div>`;
    default: throw new Error(`Unknown block type ${b.type} in ${from}`);
  }
}

const STYLE = `
  :root { color-scheme: dark; }
  body { margin: 0; background: #0b1018; color: #f4f0e6; font: 17px/1.65 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  header.site { border-bottom: 2px solid #f47b20; background: #121926; }
  header.site .in { max-width: 900px; margin: 0 auto; padding: 12px 20px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 18px; }
  header.site .brand { font-weight: 800; letter-spacing: .06em; color: #f47b20; text-decoration: none; margin-right: auto; }
  header.site nav a { color: #c9ced8; text-decoration: none; font-size: 15px; }
  header.site nav a[aria-current="page"], header.site nav a:hover { color: #ffd166; }
  header.site nav { display: flex; flex-wrap: wrap; gap: 6px 16px; }
  .play { display: inline-block; background: #f47b20; color: #140c02; font-weight: 800; padding: 8px 16px; text-decoration: none; box-shadow: 3px 3px 0 #03070d; }
  main { max-width: 820px; margin: 0 auto; padding: 28px 20px 56px; }
  h1 { font-size: 2.1rem; line-height: 1.2; margin: 8px 0 12px; }
  .lead { font-size: 1.12rem; color: #e7e3d8; }
  h2 { font-size: 1.3rem; margin: 34px 0 8px; padding-top: 10px; border-top: 1px solid #2a3546; color: #ffd166; }
  p, li { color: #d3d7df; }
  ul, ol { padding-left: 1.3rem; } li { margin: 6px 0; }
  a { color: #ff9d3d; }
  .table-wrap { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; font-size: .95rem; margin: 10px 0; }
  th, td { text-align: left; padding: 8px 10px; border: 1px solid #2a3546; vertical-align: top; }
  th { background: #192333; }
  nav.toc { background: #121926; border: 1px solid #2a3546; padding: 10px 16px; margin: 18px 0; font-size: .95rem; }
  nav.toc ol { margin: 6px 0 0; }
  .cta { margin: 36px 0 0; padding: 18px; background: #192333; border: 2px solid #f47b20; }
  footer.site { border-top: 1px solid #2a3546; color: #94a0b2; font-size: 14px; }
  footer.site .in { max-width: 820px; margin: 0 auto; padding: 18px 20px 40px; }
  footer.site a { color: #c9ced8; }
  .guides { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; padding: 0; list-style: none; }
  .guides li { margin: 0; padding: 12px 14px; background: #121926; border: 1px solid #2a3546; }
  .guides a { font-weight: 700; }
  @media (max-width: 560px) { h1 { font-size: 1.7rem; } body { font-size: 16px; } }`;

const pages = content.pages;
const guides = pages.filter((p) => p.path.startsWith('guides/'));
const top = pages.filter((p) => !p.path.startsWith('guides/'));

const SITE = (content.url || 'https://courtvisiongame.com').replace(/\/$/, '');
const abs = (path) => `${SITE}/${path.replace(/index\.html$/, '')}`;
/** Plain text of **bold** and [label](url) markup (for structured data and llms.txt). */
const plain = (s) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '$1');
const blockText = (b) => b.type === 'p' ? plain(b.text) : b.type === 'table' ? b.rows.map((r) => r.join(': ')).join('; ') : b.items.map(plain).join(' ');

/** schema.org data: FAQ answers on the FAQ, an article and its breadcrumb on the guides, a web page otherwise. */
function structuredData(page) {
  const url = abs(page.path);
  const publisher = { '@type': 'Organization', name: 'Court Vision', url: `${SITE}/`, logo: `${SITE}/icons/icon-512.png` };
  const graph = [];
  if (page.path === 'faq.html') {
    graph.push({ '@type': 'FAQPage', '@id': `${url}#faq`, url, mainEntity: page.sections.map((s) => ({ '@type': 'Question', name: s.h2, acceptedAnswer: { '@type': 'Answer', text: s.blocks.map(blockText).join(' ') } })) });
  } else if (page.path.startsWith('guides/') && page.sections) {
    graph.push({ '@type': 'Article', '@id': `${url}#article`, headline: page.h1, description: page.description, url, dateModified: content.updated, author: publisher, publisher, image: `${SITE}/og-image.png`, about: { '@type': 'VideoGame', name: 'Court Vision', url: `${SITE}/` } });
  } else {
    graph.push({ '@type': 'WebPage', '@id': url, url, name: page.title, description: page.description, dateModified: content.updated, isPartOf: { '@type': 'WebSite', name: 'Court Vision', url: `${SITE}/` } });
  }
  const crumbs = [{ name: 'Court Vision', item: `${SITE}/` }];
  if (page.path.startsWith('guides/')) crumbs.push({ name: 'Guides', item: `${SITE}/guides/` });
  if (page.path !== 'guides/index.html') crumbs.push({ name: page.nav ?? page.title, item: url });
  graph.push({ '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, ...c })) });
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
}

function layout(page, prefix, body) {
  const nav = [...top.slice(0, 2), { path: 'guides/', nav: 'Guides' }, ...top.slice(2)]
    .map((p) => `<a href="${prefix}${p.path}"${p.path === page.path || (p.path === 'guides/' && page.path.startsWith('guides/')) ? ' aria-current="page"' : ''}>${esc(p.nav)}</a>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
<link rel="canonical" href="${abs(page.path)}">
<meta property="og:site_name" content="Court Vision">
<meta property="og:title" content="${esc(page.title)}">
<meta property="og:description" content="${esc(page.description)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${abs(page.path)}">
<meta property="og:image" content="${SITE}/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(page.title)}">
<meta name="twitter:description" content="${esc(page.description)}">
<meta name="twitter:image" content="${SITE}/og-image.png">
<link rel="icon" type="image/png" href="${prefix}favicon.png">
<script type="application/ld+json">${structuredData(page)}</script>
<!-- GENERATED by scripts/generate-site-pages.mjs from src/content/sitePages.json. Edit the JSON, not this file. -->
<style>${STYLE}
</style>
</head>
<body>
<header class="site"><div class="in"><a class="brand" href="${prefix}">COURT VISION</a><nav aria-label="Site">${nav}</nav><a class="play" href="${prefix}">Play free</a></div></header>
<main>
${body}
<div class="cta"><strong>Ready to play?</strong> Court Vision is free and runs in your browser. <a href="${prefix}">Start a league</a>, or join the <a href="https://discord.gg/5uGK5HDS8e" target="_blank" rel="noopener noreferrer">Discord</a>.</div>
</main>
<footer class="site"><div class="in">
<p><a href="${prefix}about.html">About</a> · <a href="${prefix}how-to-play.html">How to Play</a> · <a href="${prefix}guides/">Guides</a> · <a href="${prefix}faq.html">FAQ</a> · <a href="${prefix}changelog.html">Changelog</a> · <a href="${prefix}privacy.html">Privacy Policy</a></p>
<p>NBA history data: <a href="https://www.basketball-reference.com/" target="_blank" rel="noopener noreferrer">Basketball-Reference.com</a> via <a href="https://github.com/sumitrodatta/bball-reference-datasets" target="_blank" rel="noopener noreferrer">bball-reference-datasets</a> and <a href="https://www.nba.com/news/history-all-time-awards" target="_blank" rel="noopener noreferrer">NBA.com</a>. Court Vision is an independent fan project, not affiliated with or endorsed by the NBA, its teams or players. Last updated ${esc(content.updated)}.</p>
</div></footer>
</body>
</html>
`;
}

const written = [];
for (const page of pages) {
  const prefix = page.path.includes('/') ? '../' : '';
  const toc = page.sections.length >= 4 ? `<nav class="toc" aria-label="On this page"><strong>On this page</strong><ol>${page.sections.map((s) => `<li><a href="#${slug(s.h2)}">${esc(s.h2)}</a></li>`).join('')}</ol></nav>\n` : '';
  const body = `<h1>${esc(page.h1)}</h1>\n<p class="lead">${inline(page.lead, prefix)}</p>\n${toc}${page.sections.map((s) => `<h2 id="${slug(s.h2)}">${esc(s.h2)}</h2>\n${s.blocks.map((b) => block(b, prefix, page.path)).join('\n')}`).join('\n')}`;
  const out = join(root, 'public', page.path);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, layout(page, prefix, body));
  written.push(page.path);
}
// The guides index.
const index = { path: 'guides/index.html', title: 'Court Vision guides: every game mode explained', description: 'Guides to every Court Vision game mode: Career Mode, League Hunt, Rebuild Challenge, real NBA history, and how ratings work.' };
const indexBody = `<h1>Guides</h1>\n<p class="lead">Everything you need to know about each way to play Court Vision.</p>\n<ul class="guides">${[...guides, top.find((p) => p.path === 'how-to-play.html')].map((g) => `<li><a href="../${g.path}">${esc(g.nav)}</a><br><span>${esc(g.description)}</span></li>`).join('')}</ul>`;
writeFileSync(join(root, 'public', index.path), layout(index, '../', indexBody));
written.push(index.path);

// llms.txt (https://llmstxt.org): a plain summary for AI assistants and answer engines (ChatGPT, Claude, Perplexity),
// and llms-full.txt with every page's text, so they can describe the game accurately and link to the right page.
const md = (s) => s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => `[${label}](${/^https?:/.test(url) ? url : `${SITE}/${url}`})`);
const pageLine = (pg) => `- [${pg.nav}](${abs(pg.path)}): ${pg.description}`;
const llms = `# Court Vision

> Court Vision is a free basketball GM and simulation game that runs in the browser (and as an installable app). Run an NBA franchise from any season since 1946-47 with real players, or play quick modes: the 82-0 Challenge, League Hunt, Career Mode, the Rebuild Challenge and the All-Time Draft. Every game is simulated possession by possession. No download or account needed.

- Play free: ${SITE}/
- Price: free on the web (ad-supported); a free offline Windows edition has no ads.
- Platforms: any modern browser on desktop, phone or tablet; installable as an app; offline Windows edition.
- Data: real NBA statistics from Basketball-Reference.com; Court Vision computes its own ratings. Independent fan project, not affiliated with the NBA.
- Community: https://discord.gg/5uGK5HDS8e

## Game modes

| Mode | Time | What it is |
| --- | --- | --- |
| 82-0 Challenge | 5-10 min | Build a ten-man team from all of NBA history and try to go 82-0, then 16-0 in the playoffs, against real teams and boss teams like the 72-10 Bulls. |
| Career Mode | 5-15 min | Create one player and live his whole career, from draft night to the Hall of Fame and the all-time Top 100. |
| Rebuild Challenge | 10-20 min | Take over a real team at its lowest point in NBA history and win a title before time runs out. |
| All-Time Draft | 10-20 min | Thirty teams draft every player in history at his best, then play a full season. |
| League Hunt | 15-30 min a run | Spin a six-man squad and a coach from all of history and win ten best-of-seven series against great teams from every era. |
| Real League | Unlimited | Run a real NBA franchise from any season since 1946-47: draft, trade, sign, coach. |
| Random Players | Unlimited | A generated 30-team league for pure franchise building. |

## Guides

${guides.map(pageLine).join('\n')}

## About and help

${top.map(pageLine).join('\n')}

## Full text

- [llms-full.txt](${SITE}/llms-full.txt): every guide and help page as plain text.
`;
writeFileSync(join(root, 'public', 'llms.txt'), llms);
const full = [`# Court Vision: full guide text\n\nSource: ${SITE}/ (updated ${content.updated}). Court Vision is a free browser basketball GM and simulation game.`,
  ...pages.map((pg) => [`\n---\n\n# ${pg.h1}\n\nURL: ${abs(pg.path)}\n\n${md(pg.lead)}`, ...pg.sections.map((s) => `\n## ${s.h2}\n\n${s.blocks.map((b) => b.type === 'p' ? md(b.text) : b.type === 'table' ? [`| ${b.columns.join(' | ')} |`, `| ${b.columns.map(() => '---').join(' | ')} |`, ...b.rows.map((r) => `| ${r.join(' | ')} |`)].join('\n') : b.items.map((i, n) => `${b.type === 'ol' ? `${n + 1}.` : '-'} ${md(i)}`).join('\n')).join('\n\n')}`)].join('\n'))].join('\n');
writeFileSync(join(root, 'public', 'llms-full.txt'), `${full}\n`);
written.push('llms.txt', 'llms-full.txt');
console.log(`Wrote ${written.length} pages: ${written.join(', ')}`);
