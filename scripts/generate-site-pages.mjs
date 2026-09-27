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
<meta property="og:title" content="${esc(page.title)}">
<meta property="og:description" content="${esc(page.description)}">
<meta property="og:type" content="article">
<link rel="icon" type="image/png" href="${prefix}favicon.png">
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
console.log(`Wrote ${written.length} pages: ${written.join(', ')}`);
