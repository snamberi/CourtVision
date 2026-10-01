import { buildPlayerGrid, outlineGrid, detailedSpritePaths, playerTraits, type Appearance, type SpriteGrid, type SpritePath } from './playerSprite';

/*
 * Frame-by-frame court animations for the players everyone already knows: the head, face, hair, beard, headwear and
 * jersey come straight from the player's avatar (so he looks exactly like his portrait), and each frame is a pose
 * model that places his arms and legs, drawn in the same pixel style. Run cycles, dribbles, jump shots, layups,
 * dunks, passes, defence, rebounds, screens and celebrations are all separate models.
 *
 * Coordinates are avatar pixels (the 40 × 52 avatar grid, feet on row 49). Poses face right (the ball side is the
 * right hand); a player facing left gets the mirrored pose, but his face and jersey number are never mirrored.
 */

type P = readonly [number, number];
export interface Pose {
  /** Shift of the head and torso (a crouch is +y). */
  body: P;
  lE: P; lH: P; rE: P; rH: P; // left and right elbow and hand, relative to the body
  lK: P; lF: P; rK: P; rF: P; // knees and feet, on the floor grid
  air?: boolean;
}

const PAD_X = 6, PAD_TOP = 18, AV_W = 40, AV_H = 52;
export const SPRITE_W = AV_W + PAD_X * 2, SPRITE_H = AV_H + PAD_TOP + 2;
/** The point on the floor under the player, in sprite pixels. */
export const ORIGIN_X = 20 + PAD_X, ORIGIN_Y = 50 + PAD_TOP;
const FOOT = 49;

const pose = (p: Pose): Pose => p;

// ---------------------------------------------------------------- the pose models (facing right)

const LEGS_STAND = { lK: [14, 44], lF: [14, 49], rK: [26, 44], rF: [26, 49] } as const;
const LEGS_BENT = { lK: [13, 45], lF: [13, 49], rK: [27, 45], rF: [27, 49] } as const;
const LEGS_WIDE = { lK: [12, 45], lF: [11, 49], rK: [28, 45], rF: [29, 49] } as const;
const LEGS_TOGETHER = { lK: [16, 44], lF: [16, 49], rK: [24, 44], rF: [24, 49] } as const;
const LEGS_TUCK = { lK: [15, 43], lF: [14, 47], rK: [25, 43], rF: [26, 47] } as const;

const STAND = pose({ body: [0, 0], lE: [8, 32], lH: [6, 37], rE: [32, 32], rH: [34, 37], ...LEGS_STAND });
const BREATH = pose({ ...STAND, body: [0, 1] });
/** Triple threat: knees bent, the ball on the right hip. */
const READY = pose({ body: [0, 2], lE: [11, 34], lH: [20, 36], rE: [31, 34], rH: [27, 37], ...LEGS_BENT });

const RUN_A = pose({ body: [1, 0], lE: [9, 32], lH: [15, 31], rE: [32, 34], rH: [34, 39], lK: [15, 41], lF: [14, 44], rK: [26, 45], rF: [27, 49] });
const RUN_B = pose({ body: [1, 1], lE: [8, 33], lH: [8, 37], rE: [32, 33], rH: [32, 37], lK: [14, 45], lF: [15, 49], rK: [26, 45], rF: [25, 49] });
const RUN_C = pose({ body: [1, 0], lE: [8, 34], lH: [6, 39], rE: [31, 32], rH: [25, 31], lK: [14, 45], lF: [13, 49], rK: [25, 41], rF: [26, 44] });
const RUN_D = pose({ ...RUN_B, body: [1, 0] });
const RUN = [RUN_A, RUN_B, RUN_C, RUN_D];

/** The dribble hand by ball height (high, mid, low) and the off arm out as a bar. */
const DRIBBLE_HAND: [P, P][] = [[[33, 33], [35, 37]], [[34, 35], [36, 41]], [[34, 36], [37, 44]]];
const DRIBBLE = DRIBBLE_HAND.map(([rE, rH]) => pose({ body: [0, 2], lE: [7, 31], lH: [4, 33], rE, rH, ...LEGS_WIDE }));
const RUN_DRIBBLE = DRIBBLE_HAND.map(([rE, rH]) => RUN.map(r => pose({ ...r, lE: [7, 31], lH: [4, 32], rE, rH })));

const JUMPER = [
  pose({ body: [0, 3], lE: [12, 35], lH: [18, 34], rE: [29, 35], rH: [24, 34], lK: [12, 46], lF: [13, 49], rK: [28, 46], rF: [27, 49] }),
  pose({ body: [0, -1], lE: [7, 18], lH: [10, 8], rE: [33, 18], rH: [30, 8], ...LEGS_TOGETHER, air: true }),
  pose({ body: [0, -1], lE: [8, 15], lH: [11, 4], rE: [33, 15], rH: [30, 3], ...LEGS_TOGETHER, air: true }),
  pose({ body: [0, -1], lE: [8, 16], lH: [11, 6], rE: [33, 13], rH: [33, 1], ...LEGS_TOGETHER, air: true }),
  pose({ body: [0, -1], lE: [7, 22], lH: [8, 14], rE: [33, 13], rH: [35, 3], ...LEGS_TOGETHER, air: true }),
  pose({ body: [0, 2], lE: [8, 33], lH: [7, 38], rE: [33, 20], rH: [34, 12], ...LEGS_BENT }),
];
const LAYUP = [
  pose({ body: [1, 1], lE: [14, 34], lH: [22, 33], rE: [32, 33], rH: [28, 33], lK: [14, 42], lF: [13, 45], rK: [26, 44], rF: [27, 49] }),
  pose({ body: [0, -1], lE: [8, 27], lH: [4, 22], rE: [33, 19], rH: [33, 9], lK: [15, 44], lF: [15, 49], rK: [25, 40], rF: [26, 44], air: true }),
  pose({ body: [0, -1], lE: [8, 29], lH: [5, 26], rE: [33, 13], rH: [34, 1], lK: [15, 44], lF: [15, 49], rK: [25, 41], rF: [26, 45], air: true }),
  pose({ body: [0, -1], lE: [8, 30], lH: [6, 34], rE: [33, 13], rH: [35, 2], lK: [15, 44], lF: [15, 49], rK: [25, 43], rF: [26, 47], air: true }),
  JUMPER[5],
];
const DUNK = [
  pose({ body: [0, 3], lE: [13, 36], lH: [19, 38], rE: [28, 36], rH: [23, 38], lK: [12, 46], lF: [13, 49], rK: [28, 46], rF: [27, 49] }),
  pose({ body: [0, -2], lE: [7, 15], lH: [9, 3], rE: [33, 15], rH: [31, 3], lK: [14, 41], lF: [13, 45], rK: [26, 41], rF: [27, 45], air: true }),
  pose({ body: [0, -2], lE: [8, 13], lH: [11, 0], rE: [32, 13], rH: [29, 0], ...LEGS_TUCK, air: true }),
  pose({ body: [0, -1], lE: [8, 14], lH: [10, 1], rE: [32, 14], rH: [30, 1], ...LEGS_TOGETHER, air: true }),
  pose({ body: [0, 2], lE: [5, 24], lH: [6, 16], rE: [35, 24], rH: [34, 16], ...LEGS_BENT }),
];
const PASS = [
  pose({ ...READY, lE: [12, 34], lH: [18, 33], rE: [28, 34], rH: [23, 33] }),
  pose({ ...READY, body: [1, 2], lE: [18, 32], lH: [30, 30], rE: [33, 31], rH: [38, 30] }),
  pose({ ...READY, body: [1, 2], lE: [20, 33], lH: [33, 33], rE: [34, 32], rH: [39, 33] }),
];
/** Defensive stance and its shuffle: low and wide, one hand up and one in the passing lane. */
const GUARD = [
  pose({ body: [0, 3], lE: [6, 22], lH: [6, 13], rE: [34, 31], rH: [38, 33], lK: [11, 46], lF: [9, 49], rK: [29, 46], rF: [31, 49] }),
  pose({ body: [0, 3], lE: [6, 31], lH: [2, 33], rE: [34, 22], rH: [34, 13], lK: [12, 46], lF: [11, 49], rK: [28, 46], rF: [29, 49] }),
];
const REACH = pose({ body: [0, -1], lE: [8, 14], lH: [9, 1], rE: [32, 14], rH: [31, 1], ...LEGS_TOGETHER, air: true });
const REBOUND = [
  pose({ ...REACH, ...LEGS_TUCK }),
  pose({ body: [0, 2], lE: [7, 26], lH: [16, 20], rE: [33, 26], rH: [24, 20], ...LEGS_BENT }),
];
const SCREEN = pose({ body: [0, 2], lE: [11, 34], lH: [24, 36], rE: [29, 34], rH: [16, 37], ...LEGS_WIDE });
const CELEBRATE = [
  pose({ ...STAND, lE: [8, 32], lH: [10, 27], rE: [33, 16], rH: [34, 5] }),
  pose({ ...STAND, body: [0, -1], lE: [6, 15], lH: [5, 4], rE: [34, 15], rH: [35, 4] }),
];

export const POSES = { STAND, BREATH, READY, RUN, DRIBBLE, RUN_DRIBBLE, JUMPER, LAYUP, DUNK, PASS, GUARD, REACH, REBOUND, SCREEN, CELEBRATE } as const;

/** How far above the feet the highest hand reaches, in avatar pixels (for meeting the rim on a dunk). */
export const handReach = (p: Pose) => FOOT - Math.min(p.lH[1], p.rH[1]) - p.body[1];
/** How far above the feet the top of the head is, in avatar pixels. */
export const headTop = (p: Pose) => FOOT - 2 - p.body[1];

// ---------------------------------------------------------------- choosing a frame

export type AnimKind = 'jumper' | 'layup' | 'dunk' | 'ft' | 'pass' | 'rebound' | 'celebrate';
export interface AnimInput {
  pose: string; anim?: { kind: AnimKind; t: number }; cycle?: number; carrier: boolean; moving: boolean;
  /** Ball height while dribbling: picks the hand (high, mid, low). */
  ballZ: number;
}
const step = (t: number, cuts: number[]) => { let i = 0; while (i < cuts.length && t >= cuts[i]) i++; return i; };
const frac = (v: number) => ((v % 1) + 1) % 1;

/** The pose model and a stable id for this moment of this player's action. */
export function pickFrame(a: AnimInput): { id: string; pose: Pose } {
  const level = a.ballZ > 20 ? 0 : a.ballZ > 11 ? 1 : 2;
  const runAt = Math.floor(frac(a.cycle ?? 0) * RUN.length) % RUN.length;
  if (a.anim) {
    const t = a.anim.t;
    switch (a.anim.kind) {
      case 'jumper': { const i = step(t, [.12, .3, .45, .58, .85]); return { id: `J${i}`, pose: JUMPER[i] }; }
      case 'layup': { const i = step(t, [.12, .3, .5, .8]); return { id: `L${i}`, pose: LAYUP[i] }; }
      case 'dunk': { const i = step(t, [.12, .35, .55, .85]); return { id: `K${i}`, pose: DUNK[i] }; }
      case 'ft': {
        if (t < .15) return { id: `D${level}`, pose: DRIBBLE[level] };
        const i = step(t, [.22, .3, .4, .75]);
        if (i >= 4) return { id: 'S', pose: STAND };
        // A set shot: the jump shot's arms with the feet on the floor.
        return { id: `F${i}`, pose: { ...JUMPER[i + 1], ...LEGS_STAND, body: [0, 0], air: false } };
      }
      case 'pass': { const i = step(t, [.3, .7]); return { id: `P${i}`, pose: PASS[i] }; }
      case 'rebound': { const i = t < .55 ? 0 : 1; return { id: `B${i}`, pose: REBOUND[i] }; }
      case 'celebrate': { const i = Math.floor(t * 6) % 2; return { id: `C${i}`, pose: CELEBRATE[i] }; }
    }
  }
  switch (a.pose) {
    case 'shoot': return { id: 'J3', pose: JUMPER[3] };
    case 'reach': return { id: 'R', pose: REACH };
    case 'rebound': return { id: 'B0', pose: REBOUND[0] };
    case 'screen': return { id: 'SC', pose: SCREEN };
    case 'celebrate': return { id: 'C1', pose: CELEBRATE[1] };
    case 'pass': return { id: 'P1', pose: PASS[1] };
    case 'guard': { const i = Math.floor(frac(a.cycle ?? 0) * 2) % 2; return { id: `G${i}`, pose: GUARD[i] }; }
    case 'dribble': return a.moving ? { id: `RD${level}${runAt}`, pose: RUN_DRIBBLE[level][runAt] } : { id: `D${level}`, pose: DRIBBLE[level] };
    case 'run': return a.carrier ? { id: `RD${level}${runAt}`, pose: RUN_DRIBBLE[level][runAt] } : { id: `R${runAt}`, pose: RUN[runAt] };
    default: {
      if (a.carrier) return { id: 'RDY', pose: READY };
      const i = Math.floor(frac(a.cycle ?? 0) * 2) % 2;
      return { id: `I${i}`, pose: i ? BREATH : STAND };
    }
  }
}

/** The pose for a player facing left: arms and legs mirrored and swapped (the head and jersey are drawn unmirrored). */
export function mirrorPose(p: Pose): Pose {
  const m = (v: P): P => [AV_W - v[0], v[1]];
  return { body: [-p.body[0], p.body[1]], lE: m(p.rE), lH: m(p.rH), rE: m(p.lE), rH: m(p.lH), lK: m(p.rK), lF: m(p.rF), rK: m(p.lK), rF: m(p.lF), air: p.air };
}

// ---------------------------------------------------------------- the rasterizer

const OUTLINE = '#080d19';
const WHITE = '#fff3df';
function hex(value: string, fallback: string): string {
  if (/^#[\da-f]{6}$/i.test(value)) return value;
  if (/^#[\da-f]{3}$/i.test(value)) return '#' + value.slice(1).split('').map(v => v + v).join('');
  return fallback;
}
function mix(a: string, b: string, t: number): string {
  const c = [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t));
  return '#' + c.map(n => n.toString(16).padStart(2, '0')).join('');
}

export interface ActionLook { playerId: string; primary: string; secondary: string; jerseyNumber?: number | null; age?: number; jerseyStyle?: 'classic' | 'stripe' | 'split'; appearance?: Appearance }

const upperCache = new Map<string, SpriteGrid>();
const lookKey = (l: ActionLook) => `${l.playerId}|${l.primary}|${l.secondary}|${l.jerseyNumber ?? ''}|${l.age ?? ''}|${l.jerseyStyle ?? ''}|${l.appearance ? JSON.stringify(l.appearance) : ''}`;
/** The avatar without its arms and legs: head, face, hair, headwear, jersey and shorts. */
function upperBody(look: ActionLook): SpriteGrid {
  const key = lookKey(look);
  let g = upperCache.get(key);
  if (!g) {
    if (upperCache.size > 600) upperCache.clear();
    g = buildPlayerGrid({ playerId: look.playerId, primary: look.primary, secondary: look.secondary, jerseyNumber: look.jerseyNumber, age: look.age, jerseyStyle: look.jerseyStyle, appearance: look.appearance, pose: 'none', legs: false });
    upperCache.set(key, g);
  }
  return g;
}

/** Draws one pose model filled with one player, as run-length SVG paths. `facing` -1 mirrors the pose (not the face). */
export function rasterizePose(input: Pose, look: ActionLook, facing = 1): SpritePath[] {
  const p = facing < 0 ? mirrorPose(input) : input;
  const t = playerTraits(look.playerId, look.appearance);
  const grid: SpriteGrid = Array.from({ length: SPRITE_H }, () => Array(SPRITE_W).fill(null));
  const part: number[][] = Array.from({ length: SPRITE_H }, () => Array(SPRITE_W).fill(-1));
  const skinSet = new Set<string>();
  let layer = 0;
  const set = (x: number, y: number, c: string) => {
    const gx = Math.round(x) + PAD_X, gy = Math.round(y) + PAD_TOP;
    if (gx >= 0 && gx < SPRITE_W && gy >= 0 && gy < SPRITE_H) { grid[gy][gx] = c; part[gy][gx] = layer; }
  };
  const seg = (a: P, b: P, w: number, c: string) => {
    const r = w / 2, dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy || 1;
    for (let y = Math.floor(Math.min(a[1], b[1]) - r); y <= Math.ceil(Math.max(a[1], b[1]) + r); y++)
      for (let x = Math.floor(Math.min(a[0], b[0]) - r); x <= Math.ceil(Math.max(a[0], b[0]) + r); x++) {
        const u = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / len2));
        const ex = a[0] + dx * u - x, ey = a[1] + dy * u - y;
        if (ex * ex + ey * ey <= r * r) set(x, y, c);
      }
  };
  const lerp = (a: P, b: P, u: number): P => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];

  // The avatar's own colours and shading.
  const skin = t.skin, skinLight = mix(skin, '#ffe9cb', .25), skinDark = mix(skin, '#542c30', .35);
  const kit = hex(look.primary, '#4a5160'), trim = hex(look.secondary, '#c9ccd1'), kitLight = mix(kit, WHITE, .23);
  for (const c of [skin, skinLight, skinDark]) skinSet.add(c);
  const [bx, by] = p.body;

  // Legs (behind the shorts): skin, sock with a trim band, high-top sneaker with a white sole, like the avatar's.
  const leg = (hip: P, knee: P, foot: P, outer: 1 | -1) => {
    const ankle: P = [foot[0], foot[1] - 3];
    seg(hip, knee, 5, skin);
    seg(knee, ankle, 5, skin);
    seg(lerp(hip, knee, .2), lerp(knee, ankle, .5), 1.4, skinDark); // shading down the leg
    seg([ankle[0], ankle[1] - 3], ankle, 5, WHITE);
    seg([ankle[0] - 2, ankle[1] - 3], [ankle[0] + 2, ankle[1] - 3], 1, trim);
    const fx = Math.round(foot[0]), fy = Math.round(foot[1]);
    for (let x = -3; x <= 3; x++) for (let y = -3; y <= 0; y++) {
      const c = y === 0 ? WHITE : y === -3 && x < 0 ? kitLight : x === outer * 2 && y === -2 ? WHITE : kit;
      set(fx + x, fy + y, c);
    }
    if (!p.air) set(fx + outer * 4, fy - 1, WHITE);
  };
  layer = 0;
  leg([15 + bx, 41 + by], p.lK, p.lF, -1);
  leg([25 + bx, 41 + by], p.rK, p.rF, 1);

  // Head and torso straight from the avatar, shifted with the body.
  layer = 1;
  const up = upperBody(look);
  for (let y = 0; y < AV_H; y++) for (let x = 0; x < AV_W; x++) {
    const c = up[y][x];
    if (c) set(x + bx, y + by, c);
  }

  // Arms: upper arm, forearm and hand in the avatar's style, a wristband when the avatar has one.
  const arm = (sh: P, e: P, h: P, band: boolean) => {
    const E: P = [e[0] + bx, e[1] + by], H: P = [h[0] + bx, h[1] + by];
    seg(sh, E, 4.4, skin);
    seg(E, H, 4, skin);
    seg(sh, lerp(sh, E, .7), 1.2, skinLight);
    if (band) { const b = lerp(E, H, .5); seg(b, b, 3.6, trim); }
    seg(H, H, 4.6, skin);
    set(H[0] - 1, H[1] - 1, skinLight);
  };
  // The arm crossing in front of the body is drawn last.
  const leftFront = p.lH[0] > 20 && p.rH[0] >= 20;
  const left = () => { layer = leftFront ? 3 : 2; arm([11 + bx, 27 + by], p.lE, p.lH, t.seed % 3 === 0); };
  const right = () => { layer = leftFront ? 2 : 3; arm([29 + bx, 27 + by], p.rE, p.rH, t.seed % 4 < 2); };
  if (leftFront) { right(); left(); } else { left(); right(); }

  // Inner outlines where a limb in front meets skin behind it (an arm across the face, over the other arm).
  const out = grid.map(row => [...row]);
  for (let y = 0; y < SPRITE_H; y++) for (let x = 0; x < SPRITE_W; x++) {
    const c = grid[y][x];
    if (!c || !skinSet.has(c)) continue;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || xx >= SPRITE_W || yy < 0 || yy >= SPRITE_H) continue;
      const n = grid[yy][xx];
      if (n && part[yy][xx] > part[y][x] && part[yy][xx] >= 2 && skinSet.has(n)) { out[y][x] = mix(c, OUTLINE, .75); break; }
    }
  }
  return detailedSpritePaths(outlineGrid(out));
}

// ---------------------------------------------------------------- cache

const cache = new Map<string, SpritePath[]>();
/** One player in one frame (and facing), drawn once and reused. */
export function actionSprite(frameId: string, pose: Pose, look: ActionLook, facing = 1): SpritePath[] {
  const key = `${frameId}|${facing < 0 ? 'L' : 'R'}|${lookKey(look)}`;
  let hit = cache.get(key);
  if (!hit) {
    if (cache.size > 4000) cache.clear();
    hit = rasterizePose(pose, look, facing);
    cache.set(key, hit);
  }
  return hit;
}
