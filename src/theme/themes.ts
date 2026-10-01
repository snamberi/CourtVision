import { hasOwnerAccess } from '../profile/ownerAccess';
import { PALETTE } from './palette.gen';
import { roadLevel } from '../profile/cosmetics';
import { trophyNeed } from '../profile/trophyRoad';

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

export type ThemeId = 'original' | 'cartridge' | 'scoreboard' | 'prodark' | 'terminal'
  // Unlocked on the Level Road (LEVEL_ROAD in profile/cosmetics.ts, reward kind 'look').
  | 'frontoffice' | 'hardwood' | 'blacktop' | 'playbook' | 'handheld' | 'broadcast' | 'neongrid' | 'arcade' | 'comicpop' | 'championship'
  // Unlocked on the Trophy Road (profile/trophyRoad.ts).
  | 'aurora' | 'royalcourt' | 'galaxy' | 'hallowed' | 'eclipse' | 'immortal'
  // The game owner's (hidden from everyone else).
  | 'sovereign';
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
  /** Game Owner only (profile/ownerAccess.ts): hidden from everyone else. */
  staff?: boolean;
  /** Colours for the picker's preview card. */
  preview: { bg: string; panel: string; line: string; text: string; dim: string; accent: string; onAccent: string; hi: string; display: string; body: string };
}

const ORIGINAL_PREVIEW = { bg: '#060a12', panel: '#13213a', line: '#2f4666', text: '#f3f6fb', dim: '#b6c4d6', accent: '#ff9a3a', onAccent: '#0b1018', hi: '#ffd166', display: "'Oswald', sans-serif", body: "'Inter', sans-serif" };

export const THEMES: ThemeSpec[] = [
  { id: 'original', name: 'Court Vision', blurb: 'The original: arena navy, orange and pixel shadows.', preview: ORIGINAL_PREVIEW },
  {
    id: 'cartridge', name: 'Cartridge', blurb: 'The light theme: grey plastic, black outlines, red light.', light: true,
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
    id: 'scoreboard', name: 'Scoreboard', blurb: 'A black LED board: amber dots, red for what matters.',
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
    id: 'prodark', name: 'Pro Dark', blurb: 'Quiet charcoal, thin lines, orange only where it counts.',
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
    id: 'terminal', name: 'Stat Terminal', blurb: 'Green screen with scanlines. Monospace, for stat nerds.',
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

/** Ramps for a light look: a coloured floor, pale panels, dark text; lines by strength. */
function lightRamps(c: { floor: string; panel: string; panel2: string; panel3: string; mid: string; text: string; dim: string; line: string; lineMid: string; lineStrong: string; onAccent?: string }): ThemeSpec['ramps'] {
  const on = c.onAccent ?? '#ffffff';
  return {
    bg: [[0, c.floor], [0.06, c.floor], [0.11, c.panel], [0.2, c.panel2], [0.3, c.panel3], [0.5, c.mid], [0.75, c.dim], [1, c.text]],
    fg: [[0, on], [0.25, on], [0.4, c.dim], [0.7, c.dim], [0.85, c.dim], [0.93, c.text], [1, c.text]],
    border: [[0, c.lineStrong], [0.15, c.lineStrong], [0.24, c.line], [0.34, c.line], [0.45, c.lineMid], [0.55, c.lineStrong], [1, c.lineStrong]],
  };
}
/** Ramps for a dark look: a floor, three panel shades, lines, dim and bright text. */
function darkRamps(c: { floor: string; panel: string; panel2: string; panel3: string; raised: string; line: string; lineMid: string; lineStrong: string; dim: string; text: string; bright: string; ink: string }): ThemeSpec['ramps'] {
  return {
    bg: [[0, c.floor], [0.06, c.floor], [0.15, c.panel], [0.2, c.panel2], [0.27, c.panel3], [0.4, c.raised], [0.7, c.lineStrong], [1, c.text]],
    fg: [[0, c.ink], [0.25, c.ink], [0.4, c.lineStrong], [0.7, c.dim], [0.8, c.dim], [0.92, c.text], [1, c.bright]],
    border: [[0, '#000000'], [0.15, c.floor], [0.29, c.line], [0.43, c.lineMid], [0.56, c.lineStrong], [1, c.bright]],
  };
}
const fontsOf = (...loads: (() => Promise<unknown>)[]) => () => Promise.all(loads.map(l => l()));

THEMES.push(
  {
    id: 'frontoffice', name: 'Front Office', blurb: 'Bright spreadsheet light mode with navy-blue actions.', light: true,
    ramps: lightRamps({ floor: '#e9edf2', panel: '#ffffff', panel2: '#f5f7fa', panel3: '#e6ebf1', mid: '#9aa6b5', text: '#16202c', dim: '#4a5666', line: '#dde2e8', lineMid: '#aab4c1', lineStrong: '#44505f' }),
    shadow: '#16202c26',
    accent: { red: '#c62828', orange: '#1d5fd1', gold: '#c98a00', green: '#15803d', blue: '#0e7490', purple: '#6d28d9' },
    accentText: { red: '#b3261e', orange: '#1a4fb8', gold: '#855b00', green: '#11692f', blue: '#0b5e74', purple: '#5b21b6' },
    accentAny: { red: '#b3261e', orange: '#1a4fb8', gold: '#855b00', green: '#11692f', blue: '#0b5e74', purple: '#5b21b6' },
    fonts: { display: "'Barlow Semi Condensed', 'Oswald', sans-serif", pixel: "'Barlow Semi Condensed', sans-serif", vt: "'Barlow Semi Condensed', sans-serif" },
    loadFonts: fontsOf(() => import('@fontsource/barlow-semi-condensed/latin-600.css'), () => import('@fontsource/barlow-semi-condensed/latin-700.css'), () => import('@fontsource/barlow-semi-condensed/latin-ext-600.css')),
    preview: { bg: '#e9edf2', panel: '#ffffff', line: '#aab4c1', text: '#16202c', dim: '#4a5666', accent: '#1d5fd1', onAccent: '#ffffff', hi: '#11692f', display: "'Barlow Semi Condensed', sans-serif", body: "'Inter', sans-serif" },
  },
  {
    id: 'hardwood', name: 'Hardwood', blurb: 'Warm maple floorboards, painted lines and key-blue actions.', light: true,
    ramps: lightRamps({ floor: '#dcb485', panel: '#fbf3e6', panel2: '#f5e8d3', panel3: '#ecd9bb', mid: '#b08a5c', text: '#2b1a10', dim: '#5a3f2a', line: '#dcc6a4', lineMid: '#a88660', lineStrong: '#4a3120' }),
    shadow: '#5b3517',
    accent: { red: '#b3261e', orange: '#1f5fbf', gold: '#b27a00', green: '#1f7a3a', blue: '#1f5fbf', purple: '#6b3fa0' },
    accentText: { red: '#9e1f18', orange: '#194f9e', gold: '#7a5200', green: '#17602d', blue: '#194f9e', purple: '#5a3288' },
    accentAny: { red: '#9e1f18', orange: '#194f9e', gold: '#7a5200', green: '#17602d', blue: '#194f9e', purple: '#5a3288' },
    fonts: { display: "'Anton', 'Oswald', sans-serif", pixel: "'Anton', sans-serif", vt: "'Anton', sans-serif" },
    loadFonts: fontsOf(() => import('@fontsource/anton/latin-400.css'), () => import('@fontsource/anton/latin-ext-400.css')),
    preview: { bg: '#dcb485', panel: '#fbf3e6', line: '#4a3120', text: '#2b1a10', dim: '#5a3f2a', accent: '#1f5fbf', onAccent: '#ffffff', hi: '#9e1f18', display: "'Anton', sans-serif", body: "'Inter', sans-serif" },
  },
  {
    id: 'blacktop', name: 'Blacktop', blurb: 'Streetball asphalt, chalk lines and spray-paint orange.',
    ramps: darkRamps({ floor: '#1c1e21', panel: '#26292d', panel2: '#2c2f34', panel3: '#34373c', raised: '#3f4248', line: '#45484e', lineMid: '#6b6f75', lineStrong: '#9a9d98', dim: '#bdbdb4', text: '#f1f1ec', bright: '#ffffff', ink: '#1a0b00' }),
    shadow: '#000000',
    accent: { red: '#ff5a52', orange: '#ff6a00', gold: '#ffd400', green: '#7bd88f', blue: '#5cc8ff', purple: '#c9a2ff' },
    fonts: { display: "'Permanent Marker', 'Oswald', cursive", pixel: "'Permanent Marker', cursive", vt: "'Permanent Marker', cursive" },
    loadFonts: fontsOf(() => import('@fontsource/permanent-marker/latin-400.css')),
    preview: { bg: '#1c1e21', panel: '#26292d', line: '#9a9d98', text: '#f1f1ec', dim: '#bdbdb4', accent: '#ff6a00', onAccent: '#1a0b00', hi: '#ffd400', display: "'Permanent Marker', cursive", body: "'Inter', sans-serif" },
  },
  {
    id: 'playbook', name: 'Playbook', blurb: 'The coach\'s chalkboard: green slate and yellow chalk.',
    ramps: darkRamps({ floor: '#16291f', panel: '#1f3b2d', panel2: '#244434', panel3: '#2a4d3b', raised: '#335a46', line: '#3f6451', lineMid: '#6f8f7c', lineStrong: '#a7b9aa', dim: '#c3cfbd', text: '#f3f1e7', bright: '#ffffff', ink: '#16291f' }),
    shadow: '#0a140e',
    accent: { red: '#ff8a80', orange: '#f5d76e', gold: '#ffe9a0', green: '#b6f5c8', blue: '#9ad7ff', purple: '#e0b3ff' },
    fonts: { display: "'Caveat Brush', 'Oswald', cursive", pixel: "'Caveat Brush', cursive", vt: "'Caveat Brush', cursive" },
    loadFonts: fontsOf(() => import('@fontsource/caveat-brush/latin-400.css'), () => import('@fontsource/caveat-brush/latin-ext-400.css')),
    preview: { bg: '#16291f', panel: '#1f3b2d', line: '#a7b9aa', text: '#f3f1e7', dim: '#c3cfbd', accent: '#f5d76e', onAccent: '#16291f', hi: '#f5d76e', display: "'Caveat Brush', cursive", body: "'Inter', sans-serif" },
  },
  {
    id: 'handheld', name: 'Handheld', blurb: 'Four shades of green, like a 1989 pocket console.', light: true,
    ramps: lightRamps({ floor: '#a4c21f', panel: '#c3d95a', panel2: '#b9d149', panel3: '#adc73a', mid: '#6f8a1a', text: '#0a260a', dim: '#1d421d', line: '#8fa82a', lineMid: '#4d6b1c', lineStrong: '#0f380f' }),
    shadow: '#0f380f',
    accent: { red: '#8b1a1a', orange: '#0f380f', gold: '#5a5a00', green: '#1d5c1d', blue: '#1b4d5c', purple: '#4a2d5c' },
    accentText: { red: '#7a1414', orange: '#0f380f', gold: '#454500', green: '#174d17', blue: '#163f4b', purple: '#3d244c' },
    accentAny: { red: '#7a1414', orange: '#0f380f', gold: '#454500', green: '#174d17', blue: '#163f4b', purple: '#3d244c' },
    fonts: { display: "'Silkscreen', monospace", pixel: "'Silkscreen', monospace", body: "'IBM Plex Mono', monospace" },
    loadFonts: fontsOf(() => import('@fontsource/silkscreen/latin-400.css'), () => import('@fontsource/silkscreen/latin-700.css')),
    preview: { bg: '#a4c21f', panel: '#c3d95a', line: '#0f380f', text: '#0a260a', dim: '#1d421d', accent: '#0f380f', onAccent: '#c3d95a', hi: '#7a1414', display: "'Silkscreen', monospace", body: "'IBM Plex Mono', monospace" },
  },
  {
    id: 'broadcast', name: '90s Broadcast', blurb: 'Friday-night TV: glossy blue bars and gold lettering.',
    ramps: darkRamps({ floor: '#050f3d', panel: '#0c2470', panel2: '#102b80', panel3: '#16338f', raised: '#1d3fa6', line: '#2a4fb8', lineMid: '#4a74d6', lineStrong: '#8fb0ff', dim: '#c6d4ff', text: '#ffffff', bright: '#ffffff', ink: '#0b1a4f' }),
    shadow: '#020824',
    accent: { red: '#ff5a5a', orange: '#f9c80e', gold: '#ffe066', green: '#5dfc8d', blue: '#6cc6ff', purple: '#d09bff' },
    fonts: { display: "'Teko', 'Oswald', sans-serif", pixel: "'Teko', sans-serif", vt: "'Teko', sans-serif" },
    loadFonts: fontsOf(() => import('@fontsource/teko/latin-500.css'), () => import('@fontsource/teko/latin-600.css'), () => import('@fontsource/teko/latin-ext-600.css')),
    preview: { bg: '#050f3d', panel: '#0c2470', line: '#4a74d6', text: '#ffffff', dim: '#c6d4ff', accent: '#f9c80e', onAccent: '#0b1a4f', hi: '#f9c80e', display: "'Teko', sans-serif", body: "'Inter', sans-serif" },
  },
  {
    id: 'neongrid', name: 'Neon Grid', blurb: 'Synthwave night: pink grid, sunset glow, cyan lights.',
    ramps: darkRamps({ floor: '#0d0221', panel: '#170536', panel2: '#1d0744', panel3: '#250a55', raised: '#300e6b', line: '#3d1466', lineMid: '#6a2aa6', lineStrong: '#b06ee0', dim: '#d8bff2', text: '#fdf2ff', bright: '#ffffff', ink: '#0d0221' }),
    shadow: '#05000f',
    accent: { red: '#ff3d7f', orange: '#00f0ff', gold: '#ffe46b', green: '#5dffb0', blue: '#4da3ff', purple: '#ff2ec4' },
    accentText: { red: '#ff5c93', orange: '#5ff6ff', gold: '#ffe46b', green: '#5dffb0', blue: '#7dbbff', purple: '#ff6ad6' },
    fonts: { display: "'Orbitron', 'Oswald', sans-serif", pixel: "'Orbitron', sans-serif", vt: "'Orbitron', sans-serif" },
    loadFonts: fontsOf(() => import('@fontsource/orbitron/latin-600.css'), () => import('@fontsource/orbitron/latin-700.css')),
    preview: { bg: '#0d0221', panel: '#170536', line: '#b06ee0', text: '#fdf2ff', dim: '#d8bff2', accent: '#00f0ff', onAccent: '#0d0221', hi: '#ff5c93', display: "'Orbitron', sans-serif", body: "'Inter', sans-serif" },
  },
  {
    id: 'arcade', name: '16-bit Arcade', blurb: 'A 90s cabinet: purple dusk, bevelled panels, gold coins.',
    ramps: darkRamps({ floor: '#12062b', panel: '#241052', panel2: '#2a135f', panel3: '#31176e', raised: '#3b1d82', line: '#4a2a8f', lineMid: '#6a45c0', lineStrong: '#a58ef0', dim: '#d2c1ff', text: '#fff4dc', bright: '#ffffff', ink: '#1a0b3a' }),
    shadow: '#070214',
    accent: { red: '#ff5c7a', orange: '#ffcf33', gold: '#ffe38a', green: '#7dff9b', blue: '#6fd3ff', purple: '#ff7ad9' },
    fonts: { display: "'Bungee', 'Oswald', sans-serif", pixel: "'Bungee', sans-serif", body: "'Chakra Petch', 'Inter', sans-serif", vt: "'Chakra Petch', sans-serif" },
    loadFonts: fontsOf(() => import('@fontsource/bungee/latin-400.css'), () => import('@fontsource/chakra-petch/latin-400.css'), () => import('@fontsource/chakra-petch/latin-600.css'), () => import('@fontsource/chakra-petch/latin-ext-400.css')),
    preview: { bg: '#12062b', panel: '#241052', line: '#6a45c0', text: '#fff4dc', dim: '#d2c1ff', accent: '#ffcf33', onAccent: '#1a0b3a', hi: '#ff7ad9', display: "'Bungee', sans-serif", body: "'Chakra Petch', sans-serif" },
  },
  {
    id: 'comicpop', name: 'Comic Pop', blurb: 'Yellow halftone, thick ink outlines, a loud red pop.', light: true,
    ramps: lightRamps({ floor: '#ffe14d', panel: '#ffffff', panel2: '#fffaf0', panel3: '#fff1b0', mid: '#b8a24a', text: '#111111', dim: '#333333', line: '#bdbdbd', lineMid: '#444444', lineStrong: '#111111' }),
    shadow: '#111111',
    accent: { red: '#c8102e', orange: '#e0103a', gold: '#b58100', green: '#0a7f3f', blue: '#1e5fff', purple: '#7a2cff' },
    accentText: { red: '#b00e28', orange: '#c40e33', gold: '#7d5900', green: '#086b35', blue: '#174fd6', purple: '#6522d8' },
    accentAny: { red: '#b00e28', orange: '#c40e33', gold: '#7d5900', green: '#086b35', blue: '#174fd6', purple: '#6522d8' },
    fonts: { display: "'Bangers', 'Oswald', cursive", pixel: "'Bangers', cursive", vt: "'Bangers', cursive" },
    loadFonts: fontsOf(() => import('@fontsource/bangers/latin-400.css'), () => import('@fontsource/bangers/latin-ext-400.css')),
    preview: { bg: '#ffe14d', panel: '#ffffff', line: '#111111', text: '#111111', dim: '#333333', accent: '#e0103a', onAccent: '#ffffff', hi: '#174fd6', display: "'Bangers', cursive", body: "'Inter', sans-serif" },
  },
  {
    id: 'championship', name: 'Championship', blurb: 'Black and gold, engraved like a trophy. The last reward.',
    ramps: darkRamps({ floor: '#0a0a0b', panel: '#141311', panel2: '#191815', panel3: '#211f1a', raised: '#2a2720', line: '#3a3222', lineMid: '#6e5a2a', lineStrong: '#b8964a', dim: '#c4b595', text: '#f5ecd5', bright: '#fff8e4', ink: '#1a1405' }),
    shadow: '#000000',
    accent: { red: '#e5675a', orange: '#d4af37', gold: '#f0d27a', green: '#7ccf8f', blue: '#8fb8e8', purple: '#c9a0e8' },
    fonts: { display: "'Cinzel', 'Oswald', serif", pixel: "'Cinzel', serif", vt: "'Cinzel', serif" },
    loadFonts: fontsOf(() => import('@fontsource/cinzel/latin-600.css'), () => import('@fontsource/cinzel/latin-700.css'), () => import('@fontsource/cinzel/latin-ext-700.css')),
    preview: { bg: '#0a0a0b', panel: '#141311', line: '#6e5a2a', text: '#f5ecd5', dim: '#c4b595', accent: '#d4af37', onAccent: '#1a1405', hi: '#f0d27a', display: "'Cinzel', serif", body: "'Inter', sans-serif" },
  },
  // ---- The Trophy Road looks (each has a moving backdrop in themes.css) ----
  {
    id: 'aurora', name: 'Aurora', blurb: 'Northern lights: green and violet curtains drifting over a polar night.',
    ramps: darkRamps({ floor: '#04121a', panel: '#0a1f2b', panel2: '#0d2634', panel3: '#112e3e', raised: '#15384b', line: '#1d4a5c', lineMid: '#2f7a86', lineStrong: '#6fd6c2', dim: '#bfe8e0', text: '#effffb', bright: '#ffffff', ink: '#04121a' }),
    shadow: '#010609',
    accent: { red: '#ff6b9a', orange: '#6fffb0', gold: '#e8ff8a', green: '#6fffb0', blue: '#6fd3ff', purple: '#c79bff' },
    preview: { bg: '#04121a', panel: '#0a1f2b', line: '#2f7a86', text: '#effffb', dim: '#bfe8e0', accent: '#6fffb0', onAccent: '#04121a', hi: '#c79bff', display: "'Oswald', sans-serif", body: "'Inter', sans-serif" },
  },
  {
    id: 'royalcourt', name: 'Royal Court', blurb: 'Deep purple velvet and polished gold trim. For basketball royalty.',
    ramps: darkRamps({ floor: '#12061f', panel: '#1f0c33', panel2: '#26103e', panel3: '#2e144a', raised: '#381a58', line: '#4a2468', lineMid: '#7d4aa6', lineStrong: '#d4af37', dim: '#e6d3f5', text: '#fff6e0', bright: '#ffffff', ink: '#12061f' }),
    shadow: '#07020d',
    accent: { red: '#ff5c7a', orange: '#d4af37', gold: '#f0d27a', green: '#7ccf8f', blue: '#8fb8e8', purple: '#c9a0e8' },
    fonts: { display: "'Cinzel', 'Oswald', serif", pixel: "'Cinzel', serif", vt: "'Cinzel', serif" },
    loadFonts: fontsOf(() => import('@fontsource/cinzel/latin-600.css'), () => import('@fontsource/cinzel/latin-700.css')),
    preview: { bg: '#12061f', panel: '#1f0c33', line: '#7d4aa6', text: '#fff6e0', dim: '#e6d3f5', accent: '#d4af37', onAccent: '#12061f', hi: '#c9a0e8', display: "'Cinzel', serif", body: "'Inter', sans-serif" },
  },
  {
    id: 'galaxy', name: 'Galaxy', blurb: 'Deep space: a drifting starfield, nebula pink and comet blue.',
    ramps: darkRamps({ floor: '#05030f', panel: '#0e0a24', panel2: '#130e2e', panel3: '#19123a', raised: '#211848', line: '#2c2060', lineMid: '#5a44a8', lineStrong: '#9f8cff', dim: '#d2caff', text: '#f5f2ff', bright: '#ffffff', ink: '#05030f' }),
    shadow: '#020108',
    accent: { red: '#ff5c93', orange: '#ff7ad9', gold: '#ffe38a', green: '#7dff9b', blue: '#6fd3ff', purple: '#b983ff' },
    fonts: { display: "'Orbitron', 'Oswald', sans-serif", pixel: "'Orbitron', sans-serif", vt: "'Orbitron', sans-serif" },
    loadFonts: fontsOf(() => import('@fontsource/orbitron/latin-600.css'), () => import('@fontsource/orbitron/latin-700.css')),
    preview: { bg: '#05030f', panel: '#0e0a24', line: '#5a44a8', text: '#f5f2ff', dim: '#d2caff', accent: '#ff7ad9', onAccent: '#05030f', hi: '#6fd3ff', display: "'Orbitron', sans-serif", body: "'Inter', sans-serif" },
  },
  {
    id: 'hallowed', name: 'Hallowed Hall', blurb: 'White marble and gold leaf, like the Hall of Fame itself.', light: true,
    ramps: lightRamps({ floor: '#ece6d8', panel: '#fbf8f1', panel2: '#f5f0e4', panel3: '#ede5d2', mid: '#b9a77a', text: '#1d1706', dim: '#4a3f24', line: '#d8ccb0', lineMid: '#a8925a', lineStrong: '#7a5c14' }),
    shadow: '#7a5c14',
    accent: { red: '#a8323a', orange: '#b8860b', gold: '#b8860b', green: '#2f7a4a', blue: '#2f5fa8', purple: '#6b3fa0' },
    accentText: { red: '#8f242c', orange: '#7a5808', gold: '#7a5808', green: '#1f6038', blue: '#244c8a', purple: '#56308a' },
    accentAny: { red: '#8f242c', orange: '#8a6408', gold: '#8a6408', green: '#1f6038', blue: '#244c8a', purple: '#56308a' },
    fonts: { display: "'Cinzel', 'Oswald', serif", pixel: "'Cinzel', serif", vt: "'Cinzel', serif" },
    loadFonts: fontsOf(() => import('@fontsource/cinzel/latin-600.css'), () => import('@fontsource/cinzel/latin-700.css')),
    preview: { bg: '#ece6d8', panel: '#fbf8f1', line: '#a8925a', text: '#1d1706', dim: '#4a3f24', accent: '#b8860b', onAccent: '#ffffff', hi: '#6b3fa0', display: "'Cinzel', serif", body: "'Inter', sans-serif" },
  },
  {
    id: 'eclipse', name: 'Eclipse', blurb: 'A black sun with a burning corona: ember red on total darkness.',
    ramps: darkRamps({ floor: '#050303', panel: '#120808', panel2: '#170a0a', panel3: '#1e0d0c', raised: '#281210', line: '#3a1814', lineMid: '#7a2e1e', lineStrong: '#ff7a3d', dim: '#f0c4a8', text: '#fff1e6', bright: '#ffffff', ink: '#050303' }),
    shadow: '#000000',
    accent: { red: '#ff3d3d', orange: '#ff7a3d', gold: '#ffc266', green: '#8fe38f', blue: '#8fb8e8', purple: '#e08fff' },
    preview: { bg: '#050303', panel: '#120808', line: '#7a2e1e', text: '#fff1e6', dim: '#f0c4a8', accent: '#ff7a3d', onAccent: '#050303', hi: '#ffc266', display: "'Oswald', sans-serif", body: "'Inter', sans-serif" },
  },
  {
    id: 'immortal', name: 'Immortal', blurb: 'The final reward: a living rainbow edge around a night-black arena.',
    ramps: darkRamps({ floor: '#07070c', panel: '#101018', panel2: '#14141f', panel3: '#191926', raised: '#20202f', line: '#2c2c40', lineMid: '#55557a', lineStrong: '#c8c8ff', dim: '#d8d8ee', text: '#ffffff', bright: '#ffffff', ink: '#07070c' }),
    shadow: '#000000',
    accent: { red: '#ff4d6a', orange: '#ffb347', gold: '#ffe066', green: '#6fffb0', blue: '#6fd3ff', purple: '#d38cff' },
    fonts: { display: "'Bungee', 'Oswald', sans-serif", pixel: "'Bungee', sans-serif" },
    loadFonts: fontsOf(() => import('@fontsource/bungee/latin-400.css')),
    preview: { bg: '#07070c', panel: '#101018', line: '#55557a', text: '#ffffff', dim: '#d8d8ee', accent: '#ffb347', onAccent: '#07070c', hi: '#6fd3ff', display: "'Bungee', sans-serif", body: "'Inter', sans-serif" },
  },
  {
    id: 'sovereign', name: 'Celestial Sovereign', blurb: 'Deep space, blue fire and royal gold. Game Owner only.', staff: true,
    ramps: darkRamps({ floor: '#03061a', panel: '#071033', panel2: '#0a1640', panel3: '#0e1c4e', raised: '#13245e', line: '#1c3480', lineMid: '#3a62d8', lineStrong: '#9fe7ff', dim: '#c4d6ff', text: '#f4f8ff', bright: '#ffffff', ink: '#03061a' }),
    shadow: '#01030d',
    accent: { red: '#ff5c7a', orange: '#ffd166', gold: '#ffd166', green: '#6fffb0', blue: '#6fd3ff', purple: '#9f8cff' },
    fonts: { display: "'Cinzel', 'Oswald', serif", pixel: "'Cinzel', serif", vt: "'Cinzel', serif" },
    loadFonts: fontsOf(() => import('@fontsource/cinzel/latin-600.css'), () => import('@fontsource/cinzel/latin-700.css')),
    preview: { bg: '#03061a', panel: '#071033', line: '#3a62d8', text: '#f4f8ff', dim: '#c4d6ff', accent: '#ffd166', onAccent: '#03061a', hi: '#6fd3ff', display: "'Cinzel', serif", body: "'Inter', sans-serif" },
  },
);

/** The level a look opens at: the Level Road for the ten road looks, everyone for the rest. */
export const themeLevel = (id: ThemeId) => roadLevel('look', id) ?? 1;
/** Trophies a look needs (the Trophy Road looks), or 0. */
export const themeTrophies = (id: ThemeId) => trophyNeed('look', id) ?? 0;
/** Whether a look is open at this level and trophy count. */
export const themeOpen = (id: ThemeId, level: number, trophies: number) => hasOwnerAccess() || (!THEME_BY_ID.get(id)?.staff && level >= themeLevel(id) && trophies >= themeTrophies(id));
/** The looks this browser can see (Game Owner looks only for the owner). */
export const visibleThemes = () => (hasOwnerAccess() ? THEMES : THEMES.filter(t => !t.staff));

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
  const found = THEME_BY_ID.get(id) ?? THEMES[0];
  // A Game Owner look on someone else's device falls back to the original.
  const t = found.staff && !hasOwnerAccess() ? THEMES[0] : found;
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
