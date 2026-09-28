// Makes every colour and font in the stylesheets themeable, without changing how the original look renders.
//
//   color: #f4f0e6            →  color: var(--c-fg-f4f0e6, #f4f0e6)
//   box-shadow: 0 0 0 rgba(0,0,0,.4)  →  box-shadow: 0 0 0 var(--c-shadow-00000066, rgba(0,0,0,.4))
//   font: 16px 'Oswald', sans-serif   →  font: 16px var(--ff-display, 'Oswald', sans-serif)
//
// The name carries the colour's role (bg, fg, border, shadow, or a token's role), because a theme maps a dark navy
// used as a panel very differently from the same navy used as text on an orange button. With no theme set, every
// var() falls back to the literal, so the original look is unchanged. Themes (src/theme/themes.ts) set the variables.
//
//   node scripts/theme-palette.mjs          rewrite src/**/*.css and regenerate src/theme/palette.gen.ts
//   node scripts/theme-palette.mjs --check  exit 1 if a stylesheet has a colour or font that isn't themeable yet

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// Under a test runner's browser-like environment the module URL isn't a file URL; the tests run from the repo root.
const here = (() => { try { return fileURLToPath(import.meta.url); } catch { return null; } })();
const ROOT = here ? join(here, '..', '..') : process.cwd();

const ROLE_BY_PROPERTY = [
  [/^(box-shadow|text-shadow|filter|--.*(shadow|glow).*)$/, 'shadow'],
  [/^(border.*|outline.*|column-rule.*|stroke|scrollbar-color|--.*(line|edge|border|rule|grid).*)$/, 'border'],
  [/^(color|-webkit-text-fill-color|caret-color|text-decoration.*|-webkit-text-stroke.*|accent-color|text-emphasis-color|--.*(text|court|dim|label|muted).*)$/, 'fg'],
  [/^(background|background-color|background-image|fill|--.*(bg|panel|ink|surface|floor|team-1|paper|card|well|field|chip|pill|tile|rail).*)$/, 'bg'],
];
export const roleOf = prop => ROLE_BY_PROPERTY.find(([re]) => re.test(prop))?.[1] ?? 'any';

const FONTS = { Oswald: 'display', 'Press Start 2P': 'pixel', 'IBM Plex Mono': 'mono', VT323: 'vt', Inter: 'body' };

const hex2 = n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
/** A colour literal as 6 (opaque) or 8 (with alpha) lowercase hex digits. */
export function keyOf(literal) {
  const s = literal.toLowerCase();
  if (s.startsWith('#')) {
    let h = s.slice(1);
    if (h.length <= 4) h = [...h].map(c => c + c).join('');
    return h.length === 8 && h.endsWith('ff') ? h.slice(0, 6) : h;
  }
  const m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)(%?)\s*)?\)/);
  const a = m[4] == null ? 1 : Number(m[4]) / (m[5] ? 100 : 1);
  return hex2(+m[1]) + hex2(+m[2]) + hex2(+m[3]) + (a >= 1 ? '' : hex2(a * 255));
}

// A literal that is already the fallback of a theme variable is left alone (so running this twice changes nothing);
// the fallback of any other variable (var(--cv-surface, #121926)) is converted like any literal.
const NOT_FALLBACK = String.raw`(?<!var\(--(?:c|ff)-[\w-]+,\s*)`;
const COLOR = new RegExp(`${NOT_FALLBACK}(#[0-9a-fA-F]{8}\\b|#[0-9a-fA-F]{6}\\b|#[0-9a-fA-F]{3,4}\\b|rgba?\\(\\s*\\d+\\s*,\\s*\\d+\\s*,\\s*\\d+\\s*(?:,\\s*[\\d.]+%?\\s*)?\\))`, 'g');
const FONT = new RegExp(`${NOT_FALLBACK}'(${Object.keys(FONTS).join('|')})'((?:\\s*,\\s*[^,;)]+)*)`, 'g');
// A declaration: a property right after "{" or ";" (or the start of the file), and its value up to the next ; { or }.
const DECL = /(^|[{;])(\s*)(--[\w-]+|-?[a-z][a-z-]*)(\s*:)([^;{}]*)/g;

/** Rewrites one stylesheet; returns the new text and the palette keys it uses. */
export function transform(css) {
  // Blank out comments (same length) so nothing inside them is touched or mistaken for a declaration.
  const blank = css.replace(/\/\*[\s\S]*?\*\//g, c => c.replace(/[^\n]/g, ' '));
  const keys = new Set();
  let out = '', last = 0;
  for (const m of blank.matchAll(DECL)) {
    const [, lead, ws, prop, colon, ] = m;
    const start = m.index + lead.length + ws.length + prop.length + colon.length;
    const value = css.slice(start, start + m[5].length);
    const role = roleOf(prop);
    let next = value.replace(COLOR, lit => { const k = `${role}-${keyOf(lit)}`; keys.add(k); return `var(--c-${k}, ${lit})`; });
    if (/^(font|font-family|--font.*|--ff.*)$/.test(prop)) next = next.replace(FONT, (all, name, rest) => `var(--ff-${FONTS[name]}, '${name}'${rest})`);
    // Keys of colours already converted (a rerun) count too.
    for (const k of value.matchAll(/var\(--c-([\w-]+),/g)) keys.add(k[1]);
    out += css.slice(last, start) + next;
    last = start + value.length;
  }
  return { out: out + css.slice(last), keys };
}

export const readCss = file => readFileSync(file, 'utf8');

export function cssFiles(dir = join(ROOT, 'src')) {
  return readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    // src/theme holds the themes themselves (their colours are the point, not something to map).
    if (p === join(ROOT, 'src/theme')) return [];
    return statSync(p).isDirectory() ? cssFiles(p) : p.endsWith('.css') ? [p] : [];
  });
}

if (here && process.argv[1] === here) {
  const check = process.argv.includes('--check');
  const all = new Set();
  let dirty = [];
  for (const file of cssFiles()) {
    const css = readFileSync(file, 'utf8');
    const { out, keys } = transform(css);
    keys.forEach(k => all.add(k));
    if (out !== css) { dirty.push(relative(ROOT, file)); if (!check) writeFileSync(file, out); }
  }
  const palette = `// Generated by scripts/theme-palette.mjs. Do not edit; run npm run theme:palette.\n// Every themeable colour in the stylesheets, as role-hex (the variable is --c-<key>).\nexport const PALETTE: readonly string[] = ${JSON.stringify([...all].sort(), null, 0).replace(/","/g, '", "')};\n`;
  const genPath = join(ROOT, 'src/theme/palette.gen.ts');
  let old = '';
  try { old = readFileSync(genPath, 'utf8'); } catch { /* new */ }
  if (check) {
    if (dirty.length || old !== palette) { console.error(`Not themeable yet: ${[...dirty, ...(old !== palette ? ['src/theme/palette.gen.ts'] : [])].join(', ')}. Run npm run theme:palette.`); process.exit(1); }
    console.log(`theme palette ok: ${all.size} colours`);
  } else {
    if (old !== palette) writeFileSync(genPath, palette);
    console.log(`${dirty.length} stylesheet(s) updated; ${all.size} themeable colours`);
  }
}
