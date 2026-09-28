import { PALETTE } from './palette.gen';

/*
 * App themes. Every colour in the stylesheets is a variable named by its role and original value
 * (--c-bg-13213a, --c-fg-f3f6fb…; see scripts/theme-palette.mjs), falling back to that value, so the original look
 * needs nothing. A theme maps each of those colours to its own palette:
 *
 *  - Neutral colours (the navy surfaces, lines and cream text) follow the theme's ramp for that role, by lightness,
 *    so panels stay panels and dim text stays dim, whatever the theme's colours are.
 *  - Accents (orange, gold, green, red, blue, purple) become the theme's colour for that family, keeping meaning:
 *    green is still good, red still bad, the orange action colour becomes the theme's action colour.
 *  - Alpha is kept, so glows and overlays keep their strength.
 *
 * The picked theme is kept in this browser (cv-theme) and applied before the first render.
 */

export type ThemeId = 'original' | 'cartridge' | 'scoreboard' | 'prodark' | 'terminal';
type Family = 'red' | 'orange' | 'gold' | 'green' | 'blue' | 'purple';
type Stop = [number, string];
type Role = 'bg' | 'fg' | 'border' | 'shadow' | 'any';

export interface ThemeSpec {
  id: ThemeId;
  name: string;
  blurb: string;
  /** Light themes flip the colour scheme for form controls and scrollbars. */
  light?: boolean;
  /** Neutral colours by role: original lightness (0 black … 1 white) → this theme's colour. */
  ramps?: Record<'bg' | 'fg' | 'border', Stop[]>;
  shadow?: string;
  /** Accent families as surfaces and lines, as text, and for tokens used both ways. */
  accent?: Record<Family, string>;
  accentText?: Record<Family, string>;
  accentAny?: Record<Family, string>;
  fonts?: Partial<Record<'display' | 'pixel' | 'body' | 'mono' | 'vt', string>>;
  /** Loads the theme's web fonts (bundled, so they work offline). */
  loadFonts?: () => Promise<unknown>;
  /** Colours for the picker's preview card. */
  preview: { bg: string; panel: string; line: string; text: string; dim: string; accent: string; onAccent: string; hi: string; display: string; body: string };
}

const ORIGINAL_PREVIEW = { bg: '#060a12', panel: '#13213a', line: '#2f4666', text: '#f3f6fb', dim: '#b6c4d6', accent: '#ff9a3a', onAccent: '#0b1018', hi: '#ffd166', display: "'Oswald', sans-serif", body: "'Inter', sans-serif" };

export const THEMES: ThemeSpec[] = [
  { id: 'original', name: 'Court Vision', blurb: 'The original: arena navy, basketball orange and pixel shadows.', preview: ORIGINAL_PREVIEW },
  {
    id: 'cartridge', name: 'Cartridge', blurb: 'Grey console plastic, thick black outlines and a red power light. The light theme.', light: true,
    ramps: {
      bg: [[0, '#bdbdbd'], [0.06, '#c8c8c8'], [0.11, '#ffffff'], [0.2, '#f3f3f3'], [0.3, '#e5e5e5'], [0.5, '#a3a3a3'], [0.75, '#2a2a2a'], [1, '#111111']],
      fg: [[0, '#ffffff'], [0.25, '#ffffff'], [0.4, '#6b6b6b'], [0.7, '#555555'], [0.85, '#3a3a3a'], [0.93, '#161616'], [1, '#111111']],
      border: [[0, '#111111'], [0.15, '#111111'], [0.24, '#c4c4c4'], [0.34, '#aaaaaa'], [0.45, '#5e5e5e'], [0.55, '#111111'], [1, '#111111']],
    },
    shadow: '#111111',
    accent: { red: '#b3261e', orange: '#e40521', gold: '#e0a100', green: '#15913f', blue: '#1d5fd1', purple: '#7b3fe4' },
    accentText: { red: '#b3261e', orange: '#c4001a', gold: '#8a5a00', green: '#0f7a36', blue: '#1a4fb8', purple: '#6a2fd0' },
    accentAny: { red: '#b3261e', orange: '#d0021b', gold: '#9a6700', green: '#12813a', blue: '#1a4fb8', purple: '#6a2fd0' },
    fonts: { display: "'Pixelify Sans', 'Oswald', sans-serif", pixel: "'Pixelify Sans', monospace", vt: "'Pixelify Sans', monospace" },
    loadFonts: () => Promise.all([import('@fontsource/pixelify-sans/latin-500.css'), import('@fontsource/pixelify-sans/latin-700.css'), import('@fontsource/pixelify-sans/latin-ext-700.css')]),
    preview: { bg: '#c8c8c8', panel: '#ffffff', line: '#111111', text: '#111111', dim: '#555555', accent: '#e40521', onAccent: '#ffffff', hi: '#c4001a', display: "'Pixelify Sans', sans-serif", body: "'Inter', sans-serif" },
  },
  {
    id: 'scoreboard', name: 'Scoreboard', blurb: 'A black LED board: amber dot-matrix text, red for what matters.',
    ramps: {
      bg: [[0, '#030303'], [0.06, '#070605'], [0.15, '#0f0d09'], [0.2, '#15120c'], [0.27, '#1c1810'], [0.4, '#2a2213'], [0.6, '#6b5316'], [0.85, '#ffb000'], [1, '#ffc433']],
      fg: [[0, '#0a0700'], [0.25, '#0a0700'], [0.4, '#7a5a12'], [0.7, '#b08120'], [0.8, '#c99320'], [0.9, '#ffae0a'], [1, '#ffc94d']],
      border: [[0, '#000000'], [0.15, '#000000'], [0.25, '#2b2213'], [0.35, '#3d3016'], [0.5, '#5c4715'], [0.65, '#8a6a18'], [1, '#ffb000']],
    },
    shadow: '#000000',
    accent: { red: '#ff4d4d', orange: '#ff3b30', gold: '#ffd23a', green: '#5dff5d', blue: '#3ac8ff', purple: '#d67bff' },
    fonts: { display: "'DotGothic16', 'Oswald', sans-serif", pixel: "'DotGothic16', monospace", body: "'IBM Plex Mono', monospace", vt: "'DotGothic16', monospace" },
    loadFonts: () => Promise.all([import('@fontsource/dotgothic16/latin-400.css'), import('@fontsource/dotgothic16/latin-ext-400.css')]),
    preview: { bg: '#050505', panel: '#0f0d09', line: '#3d3016', text: '#ffae0a', dim: '#b08120', accent: '#ff3b30', onAccent: '#0a0700', hi: '#ff3b30', display: "'DotGothic16', monospace", body: "'IBM Plex Mono', monospace" },
  },
  {
    id: 'prodark', name: 'Pro Dark', blurb: 'Quiet charcoal, thin lines and clean type. Orange only where it counts.',
    ramps: {
      bg: [[0, '#0b0d10'], [0.06, '#0d0f12'], [0.15, '#14171c'], [0.2, '#191c22'], [0.27, '#20242b'], [0.4, '#2b3039'], [0.7, '#9aa1ab'], [1, '#e6e8eb']],
      fg: [[0, '#0d0f12'], [0.25, '#14171c'], [0.4, '#5c636e'], [0.7, '#8b919c'], [0.8, '#a3a9b3'], [0.92, '#e6e8eb'], [1, '#f2f3f5']],
      border: [[0, '#050608'], [0.15, '#0a0c0f'], [0.29, '#262a32'], [0.43, '#343a44'], [0.56, '#454c58'], [1, '#c9ced6']],
    },
    shadow: '#00000000',
    accent: { red: '#e5534b', orange: '#f47b20', gold: '#e8b04a', green: '#46c28a', blue: '#5b9cf5', purple: '#a07cf0' },
    accentText: { red: '#f06b63', orange: '#ff9a4d', gold: '#f0c060', green: '#5fd39d', blue: '#79aff8', purple: '#b597f5' },
    fonts: { display: "'IBM Plex Sans', 'Inter', sans-serif", pixel: "'IBM Plex Mono', monospace", body: "'IBM Plex Sans', 'Inter', sans-serif", vt: "'IBM Plex Sans', 'Inter', sans-serif" },
    loadFonts: () => Promise.all([import('@fontsource/ibm-plex-sans/latin-400.css'), import('@fontsource/ibm-plex-sans/latin-600.css'), import('@fontsource/ibm-plex-sans/latin-ext-400.css'), import('@fontsource/ibm-plex-sans/latin-ext-600.css')]),
    preview: { bg: '#0d0f12', panel: '#14171c', line: '#262a32', text: '#e6e8eb', dim: '#8b919c', accent: '#f47b20', onAccent: '#140800', hi: '#f0c060', display: "'IBM Plex Sans', sans-serif", body: "'IBM Plex Sans', sans-serif" },
  },
  {
    id: 'terminal', name: 'Stat Terminal', blurb: 'A green-screen computer with scanlines. Monospace everything, for stat nerds.',
    ramps: {
      bg: [[0, '#010703'], [0.06, '#020b05'], [0.15, '#04140a'], [0.2, '#061a0d'], [0.27, '#092412'], [0.4, '#0d3a1c'], [0.7, '#1f9c45'], [1, '#3cff6e']],
      fg: [[0, '#020b05'], [0.25, '#031008'], [0.4, '#157a35'], [0.7, '#27b554'], [0.8, '#30cc5e'], [0.9, '#3cff6e'], [1, '#b8ffc9']],
      border: [[0, '#000000'], [0.15, '#021006'], [0.29, '#0f4f24'], [0.43, '#17803a'], [0.56, '#1f9c45'], [1, '#3cff6e']],
    },
    shadow: '#000000',
    accent: { red: '#ff5f56', orange: '#3cff6e', gold: '#e8ff6a', green: '#9dffb4', blue: '#6fe9ff', purple: '#d49bff' },
    accentText: { red: '#ff6b62', orange: '#b6ff5c', gold: '#e8ff6a', green: '#9dffb4', blue: '#6fe9ff', purple: '#d49bff' },
    fonts: { display: "'VT323', monospace", pixel: "'VT323', monospace", body: "'IBM Plex Mono', monospace", vt: "'VT323', monospace" },
    preview: { bg: '#020b05', panel: '#04140a', line: '#17803a', text: '#3cff6e', dim: '#27b554', accent: '#3cff6e', onAccent: '#020b05', hi: '#b6ff5c', display: "'VT323', monospace", body: "'IBM Plex Mono', monospace" },
  },
];
export const THEME_BY_ID = new Map(THEMES.map(t => [t.id, t]));

// ---------------------------------------------------------------- colour maths

type RGBA = [number, number, number, number];
export const parseHex = (h: string): RGBA => {
  const s = h.replace('#', '');
  return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16)).concat(s.length === 8 ? parseInt(s.slice(6, 8), 16) / 255 : 1) as RGBA;
};
const hx = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
const toHex = ([r, g, b, a]: RGBA) => `#${hx(r)}${hx(g)}${hx(b)}${a >= 1 ? '' : hx(a * 255)}`;
const mix = (a: RGBA, b: RGBA, t: number): RGBA => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3]];

/** HSL lightness, chroma (max − min) and hue of a colour, all 0..1 except hue in degrees. */
export function analyse([r, g, b]: RGBA) {
  const R = r / 255, G = g / 255, B = b / 255, max = Math.max(R, G, B), min = Math.min(R, G, B), c = max - min;
  let h = 0;
  if (c) h = max === R ? ((G - B) / c) % 6 : max === G ? (B - R) / c + 2 : (R - G) / c + 4;
  return { l: (max + min) / 2, c, h: (h * 60 + 360) % 360 };
}
export const family = (h: number): Family => (h < 15 || h >= 335 ? 'red' : h < 42 ? 'orange' : h < 70 ? 'gold' : h < 170 ? 'green' : h < 255 ? 'blue' : 'purple');
/** The lightness an accent family is usually used at in the original (so lighter/darker variants stay lighter/darker). */
const FAMILY_L: Record<Family, number> = { red: 0.7, orange: 0.61, gold: 0.7, green: 0.66, blue: 0.73, purple: 0.66 };

function ramp(stops: Stop[], l: number): RGBA {
  if (l <= stops[0][0]) return parseHex(stops[0][1]);
  for (let i = 1; i < stops.length; i++) {
    const [l1, c1] = stops[i];
    if (l <= l1) { const [l0, c0] = stops[i - 1]; return mix(parseHex(c0), parseHex(c1), l1 === l0 ? 1 : (l - l0) / (l1 - l0)); }
  }
  return parseHex(stops[stops.length - 1][1]);
}

/** One original colour (role and hex) in a theme. */
export function mapColor(t: ThemeSpec, role: Role, hex: string): string {
  if (!t.ramps || !t.accent) return hex;
  const src = parseHex(hex), a = src[3], { l, c, h } = analyse(src);
  const withAlpha = (x: RGBA): string => toHex([x[0], x[1], x[2], a]);
  if (role === 'shadow' && (c < 0.33 || l < 0.2)) {
    const s = parseHex(t.shadow ?? '#000000');
    return toHex([s[0], s[1], s[2], a * s[3]]);
  }
  if (c >= 0.33 && l > 0.12 && l < 0.92) {
    const f = family(h);
    const set = role === 'fg' ? t.accentText ?? t.accent : role === 'any' ? t.accentAny ?? t.accent : t.accent;
    let out = parseHex(set[f]);
    // A darker or lighter shade of the family (e.g. the dim orange of a pressed button) stays darker or lighter.
    const d = l - FAMILY_L[f];
    if (d < -0.12) out = mix(out, [0, 0, 0, 1], Math.min(0.55, -d * 1.1));
    else if (d > 0.12) out = mix(out, [255, 255, 255, 1], Math.min(0.5, d * 1.2));
    return withAlpha(out);
  }
  const base = ramp(t.ramps[role === 'fg' ? 'fg' : role === 'border' ? 'border' : 'bg'], l);
  // A tinted neutral (a dark red danger panel, a cream badge) keeps a little of its colour; the navy of the original
  // is the neutral itself and carries none.
  const navy = h >= 195 && h < 245;
  if (!navy && c >= 0.1) return withAlpha(mix(base, parseHex(t.accent[family(h)]), Math.min(0.35, c)));
  return withAlpha(base);
}

// ---------------------------------------------------------------- applying

export const THEME_KEY = 'cv-theme';
export const THEME_EVENT = 'courtvision:theme';
const isTheme = (v: unknown): v is ThemeId => typeof v === 'string' && THEME_BY_ID.has(v as ThemeId);

/** The theme picked in this browser, or null if none was picked yet. */
export function readTheme(): ThemeId | null {
  try { const v = localStorage.getItem(THEME_KEY); return isTheme(v) ? v : null; } catch { return null; }
}

const cssCache = new Map<ThemeId, string>();
/** The variables a theme sets: every palette colour, and its fonts. */
export function themeCss(id: ThemeId): string {
  const hit = cssCache.get(id);
  if (hit != null) return hit;
  const t = THEME_BY_ID.get(id)!;
  const vars = PALETTE.map(k => { const i = k.indexOf('-'); return `--c-${k}:${mapColor(t, k.slice(0, i) as Role, k.slice(i + 1))};`; });
  const fonts = Object.entries(t.fonts ?? {}).map(([k, v]) => `--ff-${k}:${v};`);
  const css = id === 'original' ? '' : `:root[data-cv-theme="${id}"]{${vars.join('')}${fonts.join('')}}`;
  cssCache.set(id, css);
  return css;
}

export function applyTheme(id: ThemeId): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const t = THEME_BY_ID.get(id) ?? THEMES[0];
  let style = document.getElementById('cv-theme') as HTMLStyleElement | null;
  if (t.id === 'original') { root.removeAttribute('data-cv-theme'); style?.remove(); }
  else {
    if (!style) { style = document.createElement('style'); style.id = 'cv-theme'; document.head.appendChild(style); }
    style.textContent = themeCss(t.id);
    root.dataset.cvTheme = t.id;
    void t.loadFonts?.().catch(() => { /* fonts are a nicety; the fallback stack still renders */ });
  }
  // The browser's own chrome (address bar on phones) follows the floor colour.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.id === 'original' ? '#0b1018' : t.preview.bg);
}

export function setTheme(id: ThemeId): void {
  try { localStorage.setItem(THEME_KEY, id); } catch { /* storage blocked: applies for this visit */ }
  applyTheme(id);
  window.dispatchEvent(new Event(THEME_EVENT));
}
