import type { TrophyKey } from '../simulation/trophies';

/* Pixel trophies: one original design per award, drawn on a 16×20 grid.
 * Each design is a shape (cup, crown, shield, star, plaque, medal…) in a metal, with an emblem. */

type Metal = 'gold' | 'silver' | 'bronze' | 'cobalt';
type Shape = 'cup' | 'crown' | 'ballColumn' | 'shield' | 'star' | 'arrow' | 'plaque' | 'clock' | 'clipboard' | 'briefcase' | 'medal' | 'rosette' | 'rack' | 'rim';
type Glyph = 'ball' | 'hand' | 'board' | 'pass' | 'bolt' | 'drop' | 'heart' | 'target' | 'general' | 'key' | 'iron' | 'miniShield' | 'star' | 'play' | '1' | '2' | '3' | '6';

const METALS: Record<Metal, { o: string; d: string; m: string; h: string }> = {
  gold: { o: '#4a2f05', d: '#c0820e', m: '#ffc53d', h: '#ffeaa0' },
  silver: { o: '#262e3b', d: '#7d889b', m: '#c3cbd8', h: '#f4f6fa' },
  bronze: { o: '#3d1f0a', d: '#8f4f22', m: '#cd7c3c', h: '#f2b98a' },
  cobalt: { o: '#0c2744', d: '#2a64a8', m: '#5fa6ea', h: '#bfe3ff' },
};

const BASE = [
  '...obBBBBBBBbo..',
  '...obbbpppbbbo..',
  '...obbbbbbbbbo..',
  '...ooooooooooo..',
];

const SHAPES: Record<Shape, { rows: string[]; base?: boolean; glyphAt?: [number, number] }> = {
  cup: { base: true, rows: [
    '................', '...ooooooooooo..', '.ooohhmmmmmmdooo', '.o.ohmmeeemmdo.o', '.o.ohmmeEemmdo.o', '.o.ohmmeeemmdo.o',
    '..ooohmmmmmdooo.', '.....ohmmmdo....', '......ohmdo.....', '.......ohd......', '.......ohd......', '......ohmdo.....',
    '.....ohhmmdo....', '....ohmmmmmdo...', '....ohhmmmmdo...', '....ooooooooo...'] },
  crown: { base: true, rows: [
    '...o....o....o..', '...oho.oho.oho..', '...ohhmmmmmmdo..', '...ohmgmmmgmdo..', '...ooooooooooo..', '.....oeeeeeo....',
    '....oeeEeeeeo...', '....oEEEEEEEo...', '....oeeeeEeeo...', '.....oeeeeeo....', '......ooooo.....', '.......ohd......',
    '.......ohd......', '......ohmdo.....', '.....ohmmmdo....', '....ooooooooo...'] },
  ballColumn: { base: true, rows: [
    '.....ooooooo....', '....ohhhmmmdo...', '...ohhmmmmmmdo..', '...ohmmmdmmmdo..', '...odddddddddo..', '...ohmmmdmmmdo..',
    '...ohmmmdmmddo..', '....ohmmdmddo...', '.....ooooooo....', '....ohhmmmmdo...', '.....ooooooo....', '......ohmdo.....',
    '......ohmdo.....', '......ohmdo.....', '.....ohhmmdo....', '....ooooooooo...'] },
  shield: { base: true, glyphAt: [6, 2], rows: [
    '...ooooooooooo..', '...ohhhhmmmmdo..', '...ohhmmmmmmdo..', '...ohmmmmmmmdo..', '...ohmmmmmmmdo..', '...ohmmmmmmmdo..',
    '...ohmmmmmmmdo..', '....ohmmmmmdo...', '.....ohmmmdo....', '......ohmdo.....', '.......ohd......', '........o.......',
    '.......ohd......', '.......ohd......', '.....ohhmmdo....', '....ooooooooo...'] },
  star: { base: true, rows: [
    '........o.......', '.......oho......', '.......ohd......', '..ooooohmdooooo.', '...ohhhmemmmdo..', '....ohmeeemdo...',
    '.....ohmemdo....', '....ohmmmmmdo...', '....ohd...ohd...', '...ohd.....ohd..', '...oo.......oo..', '.......ohd......',
    '.......ohd......', '......ohmdo.....', '.....ohhmmdo....', '....ooooooooo...'] },
  arrow: { base: true, rows: [
    '........o.......', '.......oho......', '......ohhdo.....', '.....ohhmmdo....', '....ohhmmmmdo...', '...ohhmmmmmmdo..',
    '...oooohmdoooo..', '......ohmdo.....', '......ohmdo.....', '......ohmdo.....', '......ohmdo.....', '......ohmdo.....',
    '......ohmdo.....', '.....ohhmmdo....', '....ohmmmmmdo...', '....ooooooooo...'] },
  plaque: { base: true, glyphAt: [6, 5], rows: [
    '................', '................', '...ooooooooooo..', '...ohhhhhhhhdo..', '...ohmmmmmmmdo..', '...ohmmmmmmmdo..',
    '...ohmmmmmmmdo..', '...ohmmmmmmmdo..', '...ohmmmmmmmdo..', '...ohmmmmmmmdo..', '...ohmmmmmmmdo..', '...ohmmmmmmmdo..',
    '...ohmmmmmmmdo..', '...odddddddddo..', '...ooooooooooo..', '....ooooooooo...'] },
  clock: { base: true, rows: [
    '.......ooo......', '.......ohd......', '.....ooooooo....', '....ohhmmmmdo...', '...ohwwwwwwwdo..', '...ohwwwEwwwdo..',
    '...ohwwwEwwwdo..', '...ohwwwEEEwdo..', '...ohwwwwwwwdo..', '...ohwwwwwwwdo..', '....ohwwwwwdo...', '.....ohmmmdo....',
    '......ooooo.....', '.......ohd......', '.....ohhmmdo....', '....ooooooooo...'] },
  clipboard: { base: true, glyphAt: [6, 5], rows: [
    '................', '......ooooo.....', '...ooohmmmdooo..', '...ohwwwwwwwdo..', '...ohwwwwwwwdo..', '...ohwwwwwwwdo..',
    '...ohwwwwwwwdo..', '...ohwwwwwwwdo..', '...ohwwwwwwwdo..', '...ohwwwwwwwdo..', '...ohwwwwwwwdo..', '...odddddddddo..',
    '...ooooooooooo..', '......ohmdo.....', '.....ohhmmdo....', '....ooooooooo...'] },
  briefcase: { base: true, rows: [
    '................', '........w.......', '.......www......', '......ooooo.....', '......o...o.....', '..ooooooooooooo.',
    '..ohhhhhhhhhhdo.', '..ohmmmmmmmmmdo.', '..oddddpppddddo.', '..ohmmmmmmmmmdo.', '..ohmmmmmmmmmdo.', '..odddddddddddo.',
    '..ooooooooooooo.', '.......ohd......', '.....ohhmmdo....', '....ooooooooo...'] },
  medal: { glyphAt: [6, 11], rows: [
    '................', '................', '................', '................',
    '...rrr.....RRR..', '....rrr...RRR...', '.....rrr.RRR....', '......rrRRR.....', '......ooooo.....', '.....ohhmmdo....',
    '....ohhmmmmdo...', '...ohhmmmmmmdo..', '...ohmmmmmmmdo..', '...ohmmmmmmmdo..', '...ohmmmmmmmdo..', '...ohmmmmmmddo..',
    '....ohmmmmddo...', '.....odddddo....', '......ooooo.....', '................'] },
  rosette: { glyphAt: [6, 7], rows: [
    '................', '................', '................', '................',
    '......ooooo.....', '....oorrrrroo...', '...orrRrrrRrro..', '..orrrwwwwwrrro.', '..orRwwwwwwwRro.', '..orrwwwwwwwrro.',
    '..orRwwwwwwwRro.', '..orrrwwwwwrrro.', '...orrRrrrRrro..', '....oorrrrroo...', '.....oRo.oRo....', '....oRRo.oRRo...',
    '....oRRo.oRRo...', '...oRRo...oRRo..', '...ooo.....ooo..', '................'] },
  rack: { base: true, rows: [
    '................', '................', '................', '......ooooo.....', '.....ohhmmdo....', '.....odddddo....',
    '.....ohmmmdo....', '......ooooo.....', '..ooo..ooo..ooo.', '.oeEeooeEeooeEeo', '.oeeeooeeeooeeeo', '..ooo..ooo..ooo.',
    '.ohhhhhhhhhhhhdo', '.odddddddddddddo', '..od.........od.', '..od.........od.'] },
  rim: { base: true, rows: [
    '................', '................', '..ooooooooooooo.', '..oeeeeeeeeeeeo.', '..ooooooooooooo.', '...w.w.w.w.w.w..',
    '....w.w.w.w.w...', '....w.w.w.w.w...', '.....w.w.w.w....', '.....w.w.w.w....', '......wwwww.....', '.......ohd......',
    '.......ohd......', '.......ohd......', '.....ohhmmdo....', '....ooooooooo...'] },
};

const GLYPHS: Record<Glyph, string[]> = {
  ball: ['.eee.', 'eeEee', 'EEEEE', 'eeEee', '.eee.'],
  hand: ['e.e.e', 'eeeee', 'eeeee', '.eeee', '.eee.'],
  board: ['.eee.', 'eeEee', '.eee.', 'E...E', 'EEEEE'],
  pass: ['..e..', '...e.', 'eeeee', '...e.', '..e..'],
  bolt: ['...ee', '..ee.', '.eeee', '.ee..', 'ee...'],
  drop: ['..e..', '.eee.', 'eeeee', 'eeeee', '.eee.'],
  heart: ['ee.ee', 'eeeee', 'eeeee', '.eee.', '..e..'],
  target: ['.eee.', 'e...e', 'e.E.e', 'e...e', '.eee.'],
  general: ['..e..', 'eeeee', '.eee.', '.e.e.', 'e...e'],
  key: ['..E..', '.eee.', '.e.e.', '.e.e.', 'eeeee'],
  iron: ['eeeee', '.eeee', '..ee.', '..ee.', '.eeee'],
  miniShield: ['eeeee', 'eEEEe', 'eEEEe', '.eEe.', '..e..'],
  star: ['..e..', '.eee.', 'eeeee', '.eee.', '.e.e.'],
  play: ['E.E..', '.E...', 'E.E.e', '...e.', '..e..'],
  '1': ['..e..', '.ee..', '..e..', '..e..', '..e..', '..e..', '.eee.'],
  '2': ['.eee.', 'e...e', '....e', '...e.', '..e..', '.e...', 'eeeee'],
  '3': ['eeee.', '....e', '....e', '.eee.', '....e', '....e', 'eeee.'],
  '6': ['..ee.', '.e...', 'e....', 'eeee.', 'e...e', 'e...e', '.eee.'],
};

interface Design {
  shape: Shape; metal: Metal; glyph?: Glyph;
  /** Emblem colors (e, E), ribbon (r, R) and the gem. */
  e?: string; E?: string; r?: string; R?: string; g?: string;
}

const ORANGE = { e: '#f47b20', E: '#8a3e0b' };
const DESIGNS: Record<TrophyKey, Design> = {
  champion: { shape: 'cup', metal: 'gold', ...ORANGE },
  mvp: { shape: 'crown', metal: 'gold', ...ORANGE, g: '#e85d5d' },
  fmvp: { shape: 'ballColumn', metal: 'gold' },
  dpoy: { shape: 'shield', metal: 'cobalt', glyph: 'hand', e: '#f4f0e6', E: '#0c2744' },
  roy: { shape: 'star', metal: 'silver', e: '#55c878' },
  mip: { shape: 'arrow', metal: 'bronze' },
  smoy: { shape: 'plaque', metal: 'silver', glyph: '6', e: '#f47b20' },
  cpoy: { shape: 'clock', metal: 'gold', E: '#1a2230' },
  coy: { shape: 'clipboard', metal: 'bronze', glyph: 'play', e: '#e85d5d', E: '#1f5e9e' },
  eoy: { shape: 'briefcase', metal: 'gold' },
  allLeague1: { shape: 'plaque', metal: 'gold', glyph: '1', e: '#6b4406' },
  allLeague2: { shape: 'plaque', metal: 'silver', glyph: '2', e: '#3b4556' },
  allLeague3: { shape: 'plaque', metal: 'bronze', glyph: '3', e: '#4a250c' },
  allDefense1: { shape: 'shield', metal: 'gold', glyph: 'hand', e: '#6b4406', E: '#4a2f05' },
  allDefense2: { shape: 'shield', metal: 'silver', glyph: 'hand', e: '#3b4556', E: '#262e3b' },
  allRookie1: { shape: 'plaque', metal: 'silver', glyph: 'star', e: '#55c878' },
  allRookie2: { shape: 'plaque', metal: 'bronze', glyph: 'star', e: '#55c878' },
  allStar: { shape: 'star', metal: 'gold', e: '#4da3ff' },
  allStarMvp: { shape: 'star', metal: 'gold', e: '#f47b20' },
  risingStarsMvp: { shape: 'star', metal: 'bronze', e: '#55c878' },
  threePoint: { shape: 'rack', metal: 'gold', ...ORANGE },
  dunk: { shape: 'rim', metal: 'gold', e: '#f47b20', E: '#8a3e0b' },
  scoringChamp: { shape: 'medal', metal: 'gold', glyph: 'ball', ...ORANGE, r: '#f47b20', R: '#1f5e9e' },
  reboundingChamp: { shape: 'medal', metal: 'gold', glyph: 'board', e: '#f47b20', E: '#6b4406', r: '#f47b20', R: '#1f5e9e' },
  assistsChamp: { shape: 'medal', metal: 'gold', glyph: 'pass', e: '#6b4406', r: '#f47b20', R: '#1f5e9e' },
  stealsChamp: { shape: 'medal', metal: 'gold', glyph: 'bolt', e: '#6b4406', r: '#f47b20', R: '#1f5e9e' },
  blocksChamp: { shape: 'medal', metal: 'gold', glyph: 'hand', e: '#6b4406', r: '#f47b20', R: '#1f5e9e' },
  hustle: { shape: 'medal', metal: 'silver', glyph: 'drop', e: '#4da3ff', r: '#55c878', R: '#2c7a47' },
  teammate: { shape: 'medal', metal: 'silver', glyph: 'heart', e: '#e85d5d', r: '#55c878', R: '#2c7a47' },
  sharpshooter: { shape: 'medal', metal: 'silver', glyph: 'target', e: '#e85d5d', E: '#1a2230', r: '#55c878', R: '#2c7a47' },
  floorGeneral: { shape: 'medal', metal: 'silver', glyph: 'general', e: '#1f5e9e', r: '#55c878', R: '#2c7a47' },
  paintScorer: { shape: 'medal', metal: 'silver', glyph: 'key', e: '#f47b20', r: '#55c878', R: '#2c7a47' },
  ironMan: { shape: 'medal', metal: 'silver', glyph: 'iron', e: '#3b4556', r: '#55c878', R: '#2c7a47' },
  rookieDefender: { shape: 'medal', metal: 'bronze', glyph: 'miniShield', e: '#4da3ff', E: '#0c2744', r: '#55c878', R: '#2c7a47' },
  pom: { shape: 'rosette', metal: 'gold', glyph: 'star', e: '#f47b20', r: '#ffd166', R: '#c0820e' },
  pow: { shape: 'rosette', metal: 'silver', glyph: 'ball', ...ORANGE, r: '#4da3ff', R: '#1f5e9e' },
};

export interface Rect { x: number; y: number; w: number; fill: string }

/** The trophy as horizontal color runs (one SVG rect each), built once per award. */
const cache = new Map<TrophyKey, Rect[]>();
export function trophyRects(key: TrophyKey): Rect[] {
  const hit = cache.get(key);
  if (hit) return hit;
  const d = DESIGNS[key];
  const shape = SHAPES[d.shape];
  const metal = METALS[d.metal];
  const palette: Record<string, string | undefined> = {
    o: metal.o, d: metal.d, m: metal.m, h: metal.h, w: '#f4f0e6',
    b: '#3a2a1e', B: '#5c4230', p: '#ffd166',
    e: d.e ?? '#f47b20', E: d.E ?? metal.d, r: d.r ?? '#4da3ff', R: d.R ?? '#1f5e9e', g: d.g ?? '#e85d5d',
  };
  const grid = [...shape.rows, ...(shape.base ? BASE : [])].map((row) => row.split(''));
  if (d.glyph && shape.glyphAt) {
    const [gx, gy] = shape.glyphAt;
    GLYPHS[d.glyph].forEach((line, y) => line.split('').forEach((ch, x) => { if (ch !== '.' && grid[gy + y]) grid[gy + y][gx + x] = ch; }));
  }
  const rects: Rect[] = [];
  grid.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const fill = palette[row[x]];
      let end = x + 1;
      while (end < row.length && row[end] === row[x]) end++;
      if (fill) rects.push({ x, y, w: end - x, fill });
      x = end;
    }
  });
  cache.set(key, rects);
  return rects;
}

/** For tests: every design fits the 16×20 grid. */
export function trophyGridProblems(): string[] {
  const out: string[] = [];
  for (const [name, s] of Object.entries(SHAPES)) {
    const rows = [...s.rows, ...(s.base ? BASE : [])];
    if (rows.length !== 20) out.push(`${name}: ${rows.length} rows`);
    rows.forEach((r, i) => { if (r.length !== 16) out.push(`${name} row ${i}: ${r.length} wide`); });
  }
  for (const [name, g] of Object.entries(GLYPHS)) g.forEach((r, i) => { if (r.length !== 5) out.push(`glyph ${name} row ${i}`); });
  return out;
}
