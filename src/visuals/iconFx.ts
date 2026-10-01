import type { SpriteGrid } from './playerSprite';

/*
 * The moving parts of the animated profile icons (Trophy Road), drawn as pixels around the 10 x 10 sprite on the
 * 12 x 12 tile: flames that lick around the shape (two frames that alternate), sparkles in the corners, bolt sparks,
 * and a halo. `under` sits behind the sprite, `a` and `b` are the two alternating frames on top of it.
 */
export interface IconFx { under?: SpriteGrid; a?: SpriteGrid; b?: SpriteGrid }
export type IconAnimKind = 'flicker' | 'shine' | 'spin' | 'twinkle' | 'flash' | 'glow' | 'bob';

const N = 12;
const blank = (): SpriteGrid => Array.from({ length: N }, () => Array<string | null>(N).fill(null));
const OUTLINE = '#0b1018';

/** The sprite's shape on the 12 x 12 tile (one pixel of margin all round). */
function silhouette(sprite: SpriteGrid): boolean[][] {
  const s = Array.from({ length: N }, () => Array<boolean>(N).fill(false));
  sprite.forEach((row, y) => row.forEach((c, x) => { if (c) s[y + 1][x + 1] = true; }));
  return s;
}
const near = (s: boolean[][], x: number, y: number) => {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (s[y + dy]?.[x + dx]) return true;
  return false;
};

/** Flames around the shape: a hot rim and tongues rising off the top, in two alternating frames. */
function flames(s: boolean[][], hot: [string, string, string, string]): IconFx {
  const [red, orange, yellow, white] = hot;
  const top = Array.from({ length: N }, (_, x) => s.findIndex(row => row[x]));
  const bottom = s.reduce((m, row, y) => (row.some(Boolean) ? y : m), 0);
  const frame = (phase: number): SpriteGrid => {
    const g = blank();
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (s[y][x] || !near(s, x, y) || y >= bottom) continue;
      // The rim burns on the sides and top; it flickers between frames low down.
      if (y > bottom - 3 && (x + y + phase) % 2) continue;
      g[y][x] = y < N / 2 ? orange : red;
    }
    for (let x = 0; x < N; x++) {
      const t = top[x];
      if (t < 1) continue;
      const tall = (x + phase) % 2 === 0 ? 3 : 1;
      for (let k = 1; k <= tall && t - k >= 0; k++) g[t - k][x] = k === tall ? (tall > 1 ? white : yellow) : k === 1 ? orange : yellow;
    }
    return g;
  };
  // Embers behind the shape give the flames a hot core.
  const under = blank();
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!s[y][x] && near(s, x, y) && y < bottom) under[y][x] = red;
  return { under, a: frame(0), b: frame(1) };
}

const plus = (g: SpriteGrid, x: number, y: number, core: string, arm: string) => {
  const set = (xx: number, yy: number, c: string) => { if (xx >= 0 && xx < N && yy >= 0 && yy < N) g[yy][xx] = c; };
  set(x, y, core); set(x - 1, y, arm); set(x + 1, y, arm); set(x, y - 1, arm); set(x, y + 1, arm);
};

/** The brightest colour in the sprite (the halo's colour). */
function brightest(sprite: SpriteGrid): string {
  let best = '#ffd166', score = -1;
  for (const row of sprite) for (const c of row) {
    if (!c || c === OUTLINE || !/^#[\da-f]{6}$/i.test(c)) continue;
    const v = parseInt(c.slice(1, 3), 16) + parseInt(c.slice(3, 5), 16) + parseInt(c.slice(5, 7), 16);
    if (v > score) { score = v; best = c; }
  }
  return best;
}

export function iconFx(sprite: SpriteGrid, anim: IconAnimKind | undefined, palette: 'fire' | 'gold' | 'blue' = 'fire'): IconFx {
  if (!anim) return {};
  const s = silhouette(sprite);
  switch (anim) {
    case 'flicker': return flames(s, palette === 'gold' ? ['#c9971f', '#ffb300', '#ffe066', '#fffbe6'] : palette === 'blue' ? ['#1f4fd9', '#4da3ff', '#9fe7ff', '#ffffff'] : ['#e8322e', '#ff9d3d', '#ffd166', '#fff3c4']);
    case 'twinkle': {
      const a = blank(), b = blank();
      plus(a, 1, 1, '#ffffff', '#ffd166'); plus(a, 10, 10, '#ffffff', '#ffd166');
      plus(b, 10, 1, '#ffffff', '#ffd166'); plus(b, 1, 10, '#ffffff', '#ffd166');
      return { a, b };
    }
    case 'flash': {
      const a = blank(), b = blank();
      for (const [x, y] of [[0, 2], [1, 3], [0, 4], [1, 5]]) a[y][x] = '#fff3a0';
      for (const [x, y] of [[11, 6], [10, 7], [11, 8], [10, 9]]) b[y][x] = '#fff3a0';
      a[0][9] = '#ffffff'; b[11][2] = '#ffffff';
      return { a, b };
    }
    case 'glow': {
      const under = blank(), c = brightest(sprite);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!s[y][x] && near(s, x, y)) under[y][x] = c;
      return { under };
    }
    case 'shine': {
      // A sparkle at the corner when the glint has crossed.
      const a = blank();
      plus(a, 9, 2, '#ffffff', '#fff3c4');
      return { a };
    }
    case 'bob': {
      const under = blank();
      for (let x = 3; x < 9; x++) under[11][x] = '#05080e';
      return { under };
    }
    default: return {};
  }
}
