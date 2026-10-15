/*
 * Clan flags: a 15 x 10 pixel flag, fully made by the clan leader. A pattern (or a hand-painted grid), three colours,
 * an emblem with its own colour, size and place. Stored as a short text code on the clan row (at most 200 characters)
 * and always read back through cleanFlag, so a bad code draws the default flag instead of failing.
 */

export const FLAG_W = 15, FLAG_H = 10, FLAG_CELLS = FLAG_W * FLAG_H;
export const FLAG_PATTERNS = ['solid', 'h2', 'h3', 'v2', 'v3', 'diag', 'cross', 'nordic', 'chevron', 'border', 'quarters', 'stripes', 'circle', 'paint'] as const;
export type FlagPattern = typeof FLAG_PATTERNS[number];
export const PATTERN_NAME: Record<FlagPattern, string> = {
  solid: 'Plain', h2: 'Two bands', h3: 'Three bands', v2: 'Two halves', v3: 'Three stripes', diag: 'Diagonal', cross: 'Cross', nordic: 'Nordic cross',
  chevron: 'Chevron', border: 'Border', quarters: 'Quarters', stripes: 'Stripes', circle: 'Circle', paint: 'Paint it yourself',
};

/** Emblems: 7 x 7 pixel art ('#' is filled). */
export const EMBLEMS: Record<string, { name: string; art: string[] }> = {
  ball: { name: 'Ball', art: ['..###..', '.#.#.#.', '#..#..#', '#######', '#..#..#', '.#.#.#.', '..###..'] },
  star: { name: 'Star', art: ['...#...', '...#...', '#######', '.#####.', '..###..', '.##.##.', '##...##'] },
  crown: { name: 'Crown', art: ['.......', '#..#..#', '##.#.##', '#######', '#######', '#######', '.......'] },
  flame: { name: 'Flame', art: ['...#...', '..##...', '..###.#', '.#####.', '#######', '#######', '.#####.'] },
  bolt: { name: 'Bolt', art: ['....##.', '...##..', '..##...', '.######', '....##.', '...##..', '..##...'] },
  shield: { name: 'Shield', art: ['#######', '#######', '#######', '#######', '.#####.', '..###..', '...#...'] },
  heart: { name: 'Heart', art: ['.##.##.', '#######', '#######', '#######', '.#####.', '..###..', '...#...'] },
  moon: { name: 'Moon', art: ['..###..', '.##....', '##.....', '##.....', '##.....', '.##....', '..###..'] },
  diamond: { name: 'Diamond', art: ['...#...', '..###..', '.#####.', '#######', '.#####.', '..###..', '...#...'] },
  sun: { name: 'Sun', art: ['#..#..#', '.#####.', '.#####.', '#######', '.#####.', '.#####.', '#..#..#'] },
  hoop: { name: 'Hoop', art: ['#######', '.#####.', '.#.#.#.', '..#.#..', '..###..', '..#.#..', '.......'] },
  paw: { name: 'Paw', art: ['.#...#.', '.#.#.#.', '...#...', '.......', '..###..', '.#####.', '.#####.'] },
};
export const EMBLEM_IDS = ['none', ...Object.keys(EMBLEMS)];
export type EmblemPlace = 'c' | 'l' | 'tl';
export const PLACE_NAME: Record<EmblemPlace, string> = { c: 'Middle', l: 'Left', tl: 'Top corner' };

export interface ClanFlag {
  pattern: FlagPattern;
  colors: [string, string, string];
  emblem: string;
  emblemColor: string;
  place: EmblemPlace;
  /** 1 small, 2 medium, 3 large. */
  size: 1 | 2 | 3;
  /** The painted grid (pattern 'paint'): FLAG_CELLS entries, 0-2 the three colours, 3 the emblem colour. */
  paint: number[];
}

export const DEFAULT_FLAG: ClanFlag = { pattern: 'h3', colors: ['#f47b20', '#f4f0e6', '#121926'], emblem: 'ball', emblemColor: '#121926', place: 'c', size: 2, paint: [] };

const HEX = /^#[0-9a-f]{6}$/i;
const hex = (s: unknown, d: string) => (typeof s === 'string' && HEX.test(s) ? s.toLowerCase() : d);
/** A flag that is safe to draw: unknown values fall back to the default's. */
export function cleanFlag(f: Partial<ClanFlag> | null | undefined): ClanFlag {
  const x = f ?? {};
  const pattern = FLAG_PATTERNS.includes(x.pattern as FlagPattern) ? x.pattern as FlagPattern : DEFAULT_FLAG.pattern;
  const c = Array.isArray(x.colors) ? x.colors : [];
  const paint = pattern === 'paint' && Array.isArray(x.paint) ? Array.from({ length: FLAG_CELLS }, (_, i) => { const v = Number(x.paint![i]); return v >= 0 && v <= 3 ? Math.floor(v) : 0; }) : [];
  return {
    pattern, colors: [hex(c[0], DEFAULT_FLAG.colors[0]), hex(c[1], DEFAULT_FLAG.colors[1]), hex(c[2], DEFAULT_FLAG.colors[2])],
    emblem: EMBLEM_IDS.includes(String(x.emblem)) ? String(x.emblem) : DEFAULT_FLAG.emblem, emblemColor: hex(x.emblemColor, DEFAULT_FLAG.emblemColor),
    place: (['c', 'l', 'tl'] as const).includes(x.place as EmblemPlace) ? x.place as EmblemPlace : 'c', size: ([1, 2, 3] as const).includes(x.size as 1) ? x.size as 1 | 2 | 3 : 2, paint,
  };
}

/** The flag as a short code: "1|pattern|c1,c2,c3|emblem|emblemColor|place|size|painted cells (2 bits each, as hex)". */
export function encodeFlag(f: ClanFlag): string {
  const c = cleanFlag(f);
  let paint = '';
  if (c.pattern === 'paint') {
    for (let i = 0; i < FLAG_CELLS; i += 2) paint += ((c.paint[i] << 2) | (c.paint[i + 1] ?? 0)).toString(16);
  }
  return ['1', c.pattern, c.colors.map(h => h.slice(1)).join(','), c.emblem, c.emblemColor.slice(1), c.place, String(c.size), paint].join('|');
}
export function decodeFlag(code: string | null | undefined): ClanFlag {
  if (!code || typeof code !== 'string' || code.length > 200) return DEFAULT_FLAG;
  const [v, pattern, colors, emblem, emblemColor, place, size, paint] = code.split('|');
  if (v !== '1') return DEFAULT_FLAG;
  const cells: number[] = [];
  if (pattern === 'paint' && /^[0-9a-f]*$/i.test(paint ?? '')) for (const ch of paint) { const n = parseInt(ch, 16); cells.push(n >> 2, n & 3); }
  return cleanFlag({ pattern: pattern as FlagPattern, colors: (colors ?? '').split(',').map(h => `#${h}`) as [string, string, string], emblem, emblemColor: `#${emblemColor}`, place: place as EmblemPlace, size: Number(size) as 1, paint: cells });
}

/** The pattern drawn into the paint grid (a starting point when switching to Paint it yourself). */
export function patternCells(f: ClanFlag): number[] {
  const out: number[] = [];
  for (let y = 0; y < FLAG_H; y++) for (let x = 0; x < FLAG_W; x++) out.push(cellOf(f.pattern, x + 0.5, y + 0.5, f.paint[y * FLAG_W + x] ?? 0));
  return out;
}
/** Which colour (0-2) a pattern puts at a point of the 15 x 10 flag. */
export function cellOf(p: FlagPattern, x: number, y: number, painted = 0): number {
  switch (p) {
    case 'solid': return 0;
    case 'h2': return y < 5 ? 0 : 1;
    case 'h3': return y < 3 ? 0 : y < 7 ? 1 : 2;
    case 'v2': return x < 7.5 ? 0 : 1;
    case 'v3': return x < 5 ? 0 : x < 10 ? 1 : 2;
    case 'diag': return x / FLAG_W + y / FLAG_H < 1 ? 0 : 1;
    case 'cross': return (y >= 4 && y < 6) || (x >= 6.5 && x < 8.5) ? 1 : 0;
    case 'nordic': return (y >= 4 && y < 6) || (x >= 4 && x < 6) ? 1 : 0;
    case 'chevron': return x < 7.5 * (1 - Math.abs(y - 5) / 5) ? 1 : y < 5 ? 0 : 2;
    case 'border': return x < 1 || x >= 14 || y < 1 || y >= 9 ? 1 : 0;
    case 'quarters': return (x < 7.5) === (y < 5) ? 0 : 1;
    case 'stripes': return Math.floor(y / 2) % 2;
    case 'circle': return (x - 7.5) ** 2 + (y - 5) ** 2 < 3.6 ** 2 ? 1 : 0;
    case 'paint': return painted;
  }
}

/** Where the emblem sits and how big each of its pixels is, in flag units. */
export function emblemBox(f: ClanFlag): { x: number; y: number; px: number } {
  const px = [0.6, 0.9, 1.2][f.size - 1], side = 7 * px;
  const cx = f.place === 'c' ? 7.5 : f.place === 'l' ? 4 : 3.4, cy = f.place === 'tl' ? 2.6 : 5;
  const s = f.place === 'tl' ? Math.min(side, 4.4) : side, p = s / 7;
  const fit = (v: number, room: number) => Math.max(0, Math.min(room - s, v));
  return { x: fit(cx - s / 2, FLAG_W), y: fit(cy - s / 2, FLAG_H), px: p };
}

/** A random flag (a fresh starting point in the editor). */
export function randomFlag(rand = Math.random): ClanFlag {
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
  const PALETTE = ['#f47b20', '#f4f0e6', '#121926', '#e85d5d', '#55c878', '#4da3ff', '#ffd166', '#c18cff', '#0b1018', '#ffffff', '#1d428a', '#552583', '#007a33', '#ce1141'];
  const a = pick(PALETTE); let b = pick(PALETTE); while (b === a) b = pick(PALETTE);
  let c = pick(PALETTE); while (c === a || c === b) c = pick(PALETTE);
  return cleanFlag({ pattern: pick(FLAG_PATTERNS.filter(p => p !== 'paint')), colors: [a, b, c], emblem: pick(EMBLEM_IDS), emblemColor: pick([a, b, c, '#ffffff', '#0b1018']), place: pick(['c', 'l', 'tl'] as const), size: pick([1, 2, 3] as const) });
}
