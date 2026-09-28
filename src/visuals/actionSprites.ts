import { playerTraits } from './playerSprite';
import type { SpritePath } from './playerSprite';

/*
 * Frame-by-frame court animations. Every frame is a pose model: a small skeleton (head, shoulders, hips, elbows,
 * hands, knees, feet) drawn side-on and facing right. The rasterizer fills a model with a player's own look (skin,
 * hair, beard, headwear, kit colours, number) as pixel art with a one-pixel outline, like the avatars. So every
 * player gets real run cycles, jump shots, layups and dunks, not an avatar with lines for arms.
 *
 * Coordinates are sprite pixels from the point on the floor under the player: x forward, y up is negative.
 */

type P = readonly [number, number];
export interface Pose {
  head: P; sh: P; hip: P;
  nE: P; nH: P; fE: P; fH: P; // near and far elbow and hand
  nK: P; nF: P; fK: P; fF: P; // near and far knee and foot
  /** Feet off the floor: toes point down. */
  air?: boolean;
}

export const SPRITE_W = 56, SPRITE_H = 80, ORIGIN_X = 26, ORIGIN_Y = 76;

const pose = (p: Pose): Pose => p;
/** The same pose with the near and far limbs swapped (the other half of a stride). */
const swap = (p: Pose): Pose => ({ ...p, nE: p.fE, nH: p.fH, fE: p.nE, fH: p.nH, nK: p.fK, nF: p.fF, fK: p.nK, fF: p.nF });

// ---------------------------------------------------------------- the pose models

const STAND = pose({ head: [1, -45], sh: [0, -38], hip: [0, -24], nE: [2, -31], nH: [3, -24], fE: [-2, -31], fH: [-1, -24], nK: [2, -12], nF: [3, 0], fK: [-2, -12], fF: [-3, 0] });
const BREATH = pose({ ...STAND, head: [1, -44], sh: [0, -37] });
/** Triple threat: knees bent, the ball held at the hip. */
const READY = pose({ head: [3, -43], sh: [1, -36], hip: [0, -22], nE: [4, -30], nH: [7, -27], fE: [2, -31], fH: [6, -28], nK: [4, -11], nF: [4, 0], fK: [-3, -11], fF: [-4, 0] });

const RUN_A = pose({ head: [5, -44], sh: [3, -37], hip: [0, -23], nE: [-2, -30], nH: [-4, -24], fE: [5, -31], fH: [8, -35], nK: [5, -13], nF: [9, -1], fK: [-3, -12], fF: [-8, -5] });
const RUN_B = pose({ head: [5, -43], sh: [3, -36], hip: [0, -22], nE: [0, -30], nH: [1, -24], fE: [2, -31], fH: [5, -27], nK: [3, -11], nF: [2, 0], fK: [1, -15], fF: [-4, -9] });
const RUN_C = pose({ head: [5, -46], sh: [3, -39], hip: [0, -25], nE: [5, -31], nH: [8, -35], fE: [-2, -30], fH: [-4, -24], nK: [-1, -12], nF: [-6, -3], fK: [6, -17], fF: [5, -8] });
const RUN = [RUN_A, RUN_B, RUN_C, swap(RUN_A), swap(RUN_B), swap(RUN_C)];

/** Standing dribble: athletic stance, the off arm out front, the dribble hand by ball height (high, mid, low). */
const DRIBBLE_BASE = { head: [4, -42], sh: [2, -35], hip: [0, -21], fE: [5, -31], fH: [9, -33], nK: [5, -11], nF: [6, 0], fK: [-4, -11], fF: [-6, 0] } as const;
const DRIBBLE = [
  pose({ ...DRIBBLE_BASE, nE: [5, -28], nH: [9, -24] }),
  pose({ ...DRIBBLE_BASE, nE: [5, -27], nH: [10, -19] }),
  pose({ ...DRIBBLE_BASE, nE: [6, -25], nH: [11, -15] }),
];
/** A run frame with the near hand on the ball and the off arm protecting it. */
function runDribble(run: Pose, level: number): Pose {
  const x = run.sh[0];
  const hands: P[] = [[x + 7, -24], [x + 8, -19], [x + 9, -15]];
  return { ...run, nE: [x + 3, -28], nH: hands[level], fE: [x + 3, -31], fH: [x + 6, -33] };
}
const RUN_DRIBBLE = [0, 1, 2].map(level => RUN.map(r => runDribble(r, level)));

const JUMPER = [
  pose({ head: [4, -40], sh: [2, -33], hip: [0, -19], nE: [3, -27], nH: [6, -29], fE: [1, -27], fH: [5, -30], nK: [5, -10], nF: [3, 0], fK: [-2, -10], fF: [-3, 0] }),
  pose({ head: [2, -46], sh: [1, -39], hip: [0, -25], nE: [5, -39], nH: [5, -46], fE: [2, -40], fH: [3, -47], nK: [2, -13], nF: [2, -1], fK: [-1, -12], fF: [-3, -2], air: true }),
  pose({ head: [2, -46], sh: [1, -39], hip: [0, -25], nE: [4, -44], nH: [4, -51], fE: [1, -44], fH: [2, -52], nK: [2, -13], nF: [2, -1], fK: [-1, -12], fF: [-3, -2], air: true }),
  pose({ head: [2, -46], sh: [1, -39], hip: [0, -25], nE: [4, -47], nH: [6, -55], fE: [0, -44], fH: [2, -51], nK: [2, -13], nF: [2, -1], fK: [-1, -12], fF: [-3, -2], air: true }),
  pose({ head: [2, -46], sh: [1, -39], hip: [0, -25], nE: [4, -47], nH: [8, -53], fE: [-1, -42], fH: [0, -47], nK: [2, -13], nF: [0, -1], fK: [-1, -13], fF: [-2, 0], air: true }),
  pose({ head: [3, -42], sh: [1, -35], hip: [0, -21], nE: [5, -40], nH: [7, -45], fE: [-2, -32], fH: [-1, -26], nK: [4, -11], nF: [3, 0], fK: [-3, -11], fF: [-3, 0] }),
];
const LAYUP = [
  pose({ head: [5, -43], sh: [3, -36], hip: [0, -22], nE: [4, -29], nH: [7, -31], fE: [3, -30], fH: [7, -32], nK: [5, -12], nF: [8, -1], fK: [-3, -11], fF: [-7, -3] }),
  pose({ head: [4, -47], sh: [2, -40], hip: [0, -26], nE: [5, -41], nH: [7, -47], fE: [3, -38], fH: [6, -45], nK: [-1, -13], nF: [-3, -1], fK: [6, -25], fF: [4, -15], air: true }),
  pose({ head: [4, -47], sh: [2, -40], hip: [0, -26], nE: [6, -46], nH: [9, -55], fE: [-2, -33], fH: [-4, -28], nK: [0, -13], nF: [-2, -2], fK: [5, -23], fF: [3, -14], air: true }),
  pose({ head: [4, -47], sh: [2, -40], hip: [0, -26], nE: [6, -46], nH: [10, -53], fE: [-2, -33], fH: [-4, -28], nK: [0, -13], nF: [-2, -2], fK: [4, -19], fF: [2, -9], air: true }),
  JUMPER[5],
];
const DUNK = [
  pose({ head: [4, -40], sh: [2, -33], hip: [0, -19], nE: [3, -26], nH: [5, -22], fE: [1, -26], fH: [4, -23], nK: [5, -10], nF: [3, 0], fK: [-2, -10], fF: [-3, 0] }),
  pose({ head: [3, -48], sh: [1, -41], hip: [0, -27], nE: [-1, -49], nH: [-3, -56], fE: [-2, -48], fH: [-4, -55], nK: [4, -17], nF: [0, -9], fK: [-2, -16], fF: [-6, -8], air: true }),
  pose({ head: [4, -48], sh: [2, -41], hip: [0, -27], nE: [6, -49], nH: [11, -52], fE: [5, -48], fH: [10, -50], nK: [1, -15], nF: [-5, -9], fK: [-2, -14], fF: [-7, -6], air: true }),
  pose({ head: [2, -47], sh: [1, -40], hip: [0, -26], nE: [5, -50], nH: [7, -56], fE: [3, -50], fH: [5, -56], nK: [1, -13], nF: [0, -1], fK: [-1, -13], fF: [-2, -1], air: true }),
  pose({ ...JUMPER[5], nE: [6, -38], nH: [9, -44], fE: [-3, -38], fH: [-6, -43] }),
];
const PASS = [
  pose({ ...READY, nE: [3, -30], nH: [6, -31], fE: [2, -31], fH: [6, -32] }),
  pose({ ...READY, head: [5, -43], sh: [3, -36], nE: [8, -33], nH: [13, -33], fE: [7, -34], fH: [12, -34], nK: [5, -11], nF: [7, 0] }),
  pose({ ...READY, head: [5, -43], sh: [3, -36], nE: [8, -31], nH: [13, -30], fE: [7, -32], fH: [12, -31], nK: [5, -11], nF: [7, 0] }),
];
/** Defensive stance and its shuffle step: low, wide, one hand up and one in the passing lane. */
const GUARD = [
  pose({ head: [4, -40], sh: [2, -33], hip: [0, -19], nE: [6, -28], nH: [11, -24], fE: [2, -39], fH: [4, -46], nK: [6, -10], nF: [9, 0], fK: [-5, -10], fF: [-8, 0] }),
  pose({ head: [4, -40], sh: [2, -33], hip: [0, -19], nE: [6, -33], nH: [10, -38], fE: [3, -28], fH: [7, -24], nK: [4, -10], nF: [6, 0], fK: [-3, -10], fF: [-5, 0] }),
];
const REACH = pose({ head: [2, -46], sh: [1, -39], hip: [0, -25], nE: [5, -48], nH: [6, -57], fE: [1, -48], fH: [2, -57], nK: [2, -13], nF: [2, -1], fK: [-1, -12], fF: [-3, -2], air: true });
const REBOUND = [
  pose({ ...REACH, nK: [3, -15], nF: [1, -6], fK: [0, -15], fF: [-3, -6] }),
  pose({ head: [3, -43], sh: [1, -36], hip: [0, -22], nE: [5, -36], nH: [6, -41], fE: [3, -36], fH: [5, -41], nK: [4, -11], nF: [4, 0], fK: [-3, -11], fF: [-4, 0] }),
];
const SCREEN = pose({ head: [2, -44], sh: [1, -37], hip: [0, -22], nE: [4, -31], nH: [-1, -26], fE: [-2, -31], fH: [3, -26], nK: [4, -11], nF: [6, 0], fK: [-4, -11], fF: [-6, 0] });
const CELEBRATE = [
  pose({ ...STAND, nE: [5, -45], nH: [6, -53], fE: [-2, -32], fH: [1, -28] }),
  pose({ ...STAND, head: [1, -46], sh: [0, -39], nE: [4, -47], nH: [5, -55], fE: [-1, -47], fH: [-2, -55] }),
];

/** Raised shooting arms sit in front of the forehead, not across the face. */
const forward = (list: Pose[], from: number, to: number, dx = 2): Pose[] => list.map((p, i) => (i >= from && i <= to ? { ...p, nE: [p.nE[0] + dx, p.nE[1]], nH: [p.nH[0] + dx, p.nH[1]] } : p));
JUMPER.splice(0, JUMPER.length, ...forward(JUMPER, 1, 4));
LAYUP.splice(0, LAYUP.length, ...forward(LAYUP, 1, 3));
DUNK.splice(0, DUNK.length, ...forward(DUNK, 3, 3));
CELEBRATE.splice(0, CELEBRATE.length, ...forward(CELEBRATE, 0, 1));

export const POSES = { STAND, BREATH, READY, RUN, DRIBBLE, RUN_DRIBBLE, JUMPER, LAYUP, DUNK, PASS, GUARD, REACH, REBOUND, SCREEN, CELEBRATE } as const;

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
  const runAt = Math.floor(frac(a.cycle ?? 0) * 6) % 6;
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
        const j = JUMPER[i + 1];
        return { id: `F${i}`, pose: { ...j, nK: STAND.nK, nF: STAND.nF, fK: STAND.fK, fF: STAND.fF, hip: [0, -24], air: false } };
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

// ---------------------------------------------------------------- the rasterizer

type Mat = 'skin' | 'skinFar' | 'kit' | 'kitFar' | 'trim' | 'sock' | 'shoe' | 'sole' | 'hair' | 'hat' | 'white' | 'eye' | 'mouth' | 'brow';
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

const DIGITS: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'], '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'], '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'], '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
};

export interface ActionLook { playerId: string; primary: string; secondary: string; jerseyNumber?: number | null }

/** Draws one pose model filled with one player: side-on, facing right, as run-length SVG paths. */
export function rasterizePose(p: Pose, look: ActionLook): SpritePath[] {
  const t = playerTraits(look.playerId);
  const mat: (Mat | null)[][] = Array.from({ length: SPRITE_H }, () => Array(SPRITE_W).fill(null));
  // Which body part each pixel belongs to (back to front), for the inner outlines where parts overlap.
  const part: number[][] = Array.from({ length: SPRITE_H }, () => Array(SPRITE_W).fill(-1));
  let layer = 0;
  const X = (x: number) => Math.round(x + ORIGIN_X), Y = (y: number) => Math.round(y + ORIGIN_Y);
  const set = (x: number, y: number, m: Mat) => { if (x >= 0 && x < SPRITE_W && y >= 0 && y < SPRITE_H) { mat[y][x] = m; part[y][x] = layer; } };
  /** A limb segment: every pixel within w/2 of the line from a to b. */
  const seg = (a: P, b: P, w: number, m: Mat) => {
    const ax = a[0] + ORIGIN_X, ay = a[1] + ORIGIN_Y, bx = b[0] + ORIGIN_X, by = b[1] + ORIGIN_Y, r = w / 2;
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy || 1;
    for (let y = Math.floor(Math.min(ay, by) - r); y <= Math.ceil(Math.max(ay, by) + r); y++)
      for (let x = Math.floor(Math.min(ax, bx) - r); x <= Math.ceil(Math.max(ax, bx) + r); x++) {
        const u = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
        const ex = ax + dx * u - x, ey = ay + dy * u - y;
        if (ex * ex + ey * ey <= r * r) set(x, y, m);
      }
  };
  const lerp = (a: P, b: P, u: number): P => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];

  const leg = (hip: P, knee: P, foot: P, far: boolean) => {
    const skin: Mat = far ? 'skinFar' : 'skin', kit: Mat = far ? 'kitFar' : 'kit';
    seg(hip, knee, 6, skin);
    seg(knee, foot, 5, skin);
    seg(lerp(knee, foot, .6), lerp(knee, foot, .92), 5, 'sock');
    // Shorts over the thigh, to just above the knee.
    seg(hip, lerp(hip, knee, .66), 9, kit);
    // Sneaker: flat and pointing forward on the floor, toe down in the air.
    const [fx, fy] = foot;
    if (p.air) { seg([fx - 1, fy - 1], [fx + 2, fy + 1], 4, 'shoe'); set(X(fx + 2), Y(fy + 2), 'sole'); set(X(fx + 1), Y(fy + 2), 'sole'); }
    else { for (let x = -2; x <= 4; x++) for (let y = -2; y <= 0; y++) set(X(fx + x), Y(fy + y), y === 0 ? 'sole' : 'shoe'); set(X(fx + 4), Y(fy - 2), 'white'); }
  };
  const arm = (sh: P, elbow: P, hand: P, far: boolean) => {
    const skin: Mat = far ? 'skinFar' : 'skin';
    seg(sh, elbow, 5.2, skin);
    seg(elbow, hand, 4.4, skin);
    if (t.seed % 3 === 0) seg(lerp(elbow, hand, .62), lerp(elbow, hand, .7), 4.4, 'trim');
    seg(hand, hand, 5, skin);
  };

  const shoulder = p.sh, hip = p.hip;
  // Far side first, then the body, then the near side on top.
  layer = 0; arm([shoulder[0] - 1, shoulder[1] + 1], p.fE, p.fH, true);
  layer = 1; leg([hip[0] - 1, hip[1]], p.fK, p.fF, true);
  layer = 2;
  // Torso: the jersey from hips to shoulders, a little wider at the chest; trim at the neck and armhole.
  seg([hip[0], hip[1] - 1], [shoulder[0], shoulder[1] + 2], 11, 'kit');
  seg([shoulder[0] - 1, shoulder[1] + 1], [shoulder[0] + 2, shoulder[1] + 1], 10, 'kit');
  seg([hip[0] - 1, hip[1] + 1], [hip[0] + 1, hip[1] + 1], 10, 'kit');
  seg([hip[0] - 4, hip[1] - 1], [shoulder[0] - 4, shoulder[1] + 3], 1.2, 'trim');
  seg([shoulder[0] - 1, shoulder[1] - 1], [shoulder[0] + 2, shoulder[1] - 1], 1.5, 'trim');
  // The number on the chest.
  if (look.jerseyNumber != null && Number.isFinite(look.jerseyNumber)) {
    const n = String(Math.max(0, Math.min(99, Math.round(look.jerseyNumber))));
    const cx = Math.round((shoulder[0] + hip[0]) / 2) + (n.length === 1 ? 0 : -2), cy = Math.round(shoulder[1] + (hip[1] - shoulder[1]) * .28);
    [...n].forEach((d, i) => DIGITS[d].forEach((row, y) => [...row].forEach((bit, x) => { if (bit === '1') set(X(cx + i * 4 + x - 1), Y(cy + y), 'white'); })));
  }
  layer = 3; leg([hip[0] + 1, hip[1]], p.nK, p.nF, false);
  layer = 4;
  // Neck and head.
  seg([shoulder[0] + .5, shoulder[1]], [p.head[0] - .5, p.head[1] + 4], 3.6, 'skinFar');
  drawHead(p.head, t, set, X, Y);
  layer = 5; arm([shoulder[0] + 1, shoulder[1] + 1], p.nE, p.nH, false);

  // Palette: light from the front and above.
  const skin = t.skin, kit = hex(look.primary, '#4a5160'), trim = hex(look.secondary, '#c9ccd1');
  const colors: Record<Mat, [string, string, string]> = {
    skin: [mix(skin, '#ffe9cb', .25), skin, mix(skin, '#542c30', .3)],
    skinFar: [mix(skin, '#542c30', .15), mix(skin, '#542c30', .3), mix(skin, '#351c29', .45)],
    kit: [mix(kit, WHITE, .22), kit, mix(kit, OUTLINE, .3)],
    kitFar: [mix(kit, OUTLINE, .18), mix(kit, OUTLINE, .3), mix(kit, OUTLINE, .45)],
    trim: [mix(trim, WHITE, .3), trim, mix(trim, OUTLINE, .25)],
    sock: [WHITE, '#e6e0d2', '#b9b4aa'],
    shoe: [mix(kit, WHITE, .35), mix(kit, OUTLINE, .15), mix(kit, OUTLINE, .4)],
    sole: [WHITE, WHITE, '#c9c3b6'],
    hair: [mix(t.hair, '#a8a0b4', .3), t.hair, mix(t.hair, OUTLINE, .4)],
    hat: [mix(t.hatColor, WHITE, .35), t.hatColor, mix(t.hatColor, OUTLINE, .4)],
    white: [WHITE, WHITE, WHITE],
    eye: ['#182338', '#182338', '#182338'],
    mouth: [mix(skin, '#351c29', .55), mix(skin, '#351c29', .55), mix(skin, '#351c29', .55)],
    brow: [mix(t.hair, OUTLINE, .4), mix(t.hair, OUTLINE, .4), mix(t.hair, OUTLINE, .4)],
  };
  const out: (string | null)[][] = mat.map(row => row.map(() => null));
  for (let y = 0; y < SPRITE_H; y++) for (let x = 0; x < SPRITE_W; x++) {
    const m = mat[y][x];
    if (!m) continue;
    const up = y > 0 ? mat[y - 1][x] : null, down = y < SPRITE_H - 1 ? mat[y + 1][x] : null, front = x < SPRITE_W - 1 ? mat[y][x + 1] : null;
    const tone = up !== m && (up == null || front == null) ? 0 : down == null || (front == null && up === m && x % 2 === 0) ? 2 : 1;
    out[y][x] = colors[m][tone === 0 && (m === 'eye' || m === 'white') ? 1 : tone];
  }
  // Inner outlines: where a part in front meets a part behind it in the same colour family (an arm across the face, a
  // hand over the chest), the pixel behind becomes a line, so limbs never melt into the body.
  const family = (m: Mat | null) => (m === 'skin' || m === 'skinFar' ? 1 : m === 'kit' || m === 'kitFar' ? 2 : m === 'hair' ? 3 : 0);
  for (let y = 0; y < SPRITE_H; y++) for (let x = 0; x < SPRITE_W; x++) {
    const m = mat[y][x];
    if (!m || !family(m)) continue;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || xx >= SPRITE_W || yy < 0 || yy >= SPRITE_H) continue;
      if (part[yy][xx] > part[y][x] && family(mat[yy][xx]) === family(m)) { out[y][x] = mix(out[y][x]!, OUTLINE, .7); break; }
    }
  }
  // A one-pixel outline around the whole silhouette.
  const lined = out.map(row => [...row]);
  for (let y = 0; y < SPRITE_H; y++) for (let x = 0; x < SPRITE_W; x++) {
    if (!out[y][x]) continue;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && xx < SPRITE_W && yy >= 0 && yy < SPRITE_H && !out[yy][xx]) lined[yy][xx] = OUTLINE;
    }
  }
  const paths = new Map<string, string[]>();
  for (let y = 0; y < SPRITE_H; y++) for (let x = 0; x < SPRITE_W;) {
    const fill = lined[y][x];
    if (!fill) { x++; continue; }
    let end = x + 1;
    while (end < SPRITE_W && lined[y][end] === fill) end++;
    const runs = paths.get(fill) ?? [];
    runs.push(`M${x} ${y}h${end - x}v1h-${end - x}z`);
    paths.set(fill, runs);
    x = end;
  }
  return [...paths].map(([fill, runs]) => ({ fill, d: runs.join('') }));
}

type Traits = ReturnType<typeof playerTraits>;
/** A side-on head facing right: face, ear, eye, nose and mouth, then hair, beard and headwear by the player's traits. */
function drawHead(c: P, t: Traits, set: (x: number, y: number, m: Mat) => void, X: (x: number) => number, Y: (y: number) => number) {
  const [hx, hy] = c;
  const inHead = (x: number, y: number) => ((x - hx) / 5) ** 2 + ((y - hy) / 5.6) ** 2 <= 1;
  for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) if (inHead(hx + x, hy + y)) set(X(hx + x), Y(hy + y), 'skin');
  // Jaw and chin forward, nose.
  set(X(hx + 4), Y(hy + 3), 'skin'); set(X(hx + 3), Y(hy + 5), 'skin'); set(X(hx + 5), Y(hy), 'skin'); set(X(hx + 5), Y(hy + 1), 'skin');
  set(X(hx - 1), Y(hy), 'skinFar'); set(X(hx - 1), Y(hy + 1), 'skinFar'); set(X(hx - 2), Y(hy), 'skinFar');
  set(X(hx + 2), Y(hy - 1), 'white'); set(X(hx + 3), Y(hy - 1), 'eye'); set(X(hx + 3), Y(hy), 'eye'); set(X(hx + 2), Y(hy), 'white');
  set(X(hx + 2), Y(hy - 2), 'brow'); set(X(hx + 3), Y(hy - 2), 'brow');
  set(X(hx + 3), Y(hy + 3), 'mouth'); set(X(hx + 4), Y(hy + 3), 'mouth');

  const style = t.hairStyle;
  const hair = (x: number, y: number) => set(X(hx + x), Y(hy + y), 'hair');
  const cap = (rows: number, back: number) => { // hair over the crown and down the back of the head
    for (let y = -7; y <= 6; y++) for (let x = -6; x <= 6; x++) {
      if (!inHead(hx + x, hy + y) && !(y <= -4 && Math.abs(x) <= 4 && y >= -5 - rows)) continue;
      if (y <= -6 + rows || (x <= -2 && y <= back)) hair(x, y);
    }
  };
  if (style === 'bald') { /* nothing */ }
  else if (style === 'lowFade' || style === 'buzzCut') cap(style === 'buzzCut' ? 2 : 1, -1);
  else if (style.startsWith('afro') || style.startsWith('curly')) {
    const r = style === 'afroLarge' ? 7.5 : style === 'afroMedium' || style === 'afroFlatTop' ? 6.8 : style === 'curlyShort' ? 5.6 : 6.2;
    for (let y = -10; y <= 4; y++) for (let x = -9; x <= 6; x++) {
      const inside = ((x + 1) / r) ** 2 + ((y + 2.5) / (r * .85)) ** 2 <= 1;
      const face = x >= 1 && y >= -2;
      if (inside && !face && !(style === 'afroFlatTop' && y < -2 - r * .7)) hair(x, y);
    }
  } else if (style.startsWith('mohawk')) {
    for (let x = -4; x <= 3; x++) for (let y = -9; y <= -5; y++) if (y >= -9 + Math.abs(x + 0.5) * .5) hair(x, y);
    if (style === 'mohawkFade') cap(0, -2);
  } else if (style.startsWith('highTop')) {
    for (let x = -4; x <= 3; x++) for (let y = -12; y <= -4; y++) hair(x, y);
    cap(1, -1);
  } else if (style === 'cornrows') {
    cap(2, 0);
    for (let x = -5; x <= 3; x += 2) set(X(hx + x), Y(hy - 5), 'brow');
  } else if (style.startsWith('dreads')) {
    cap(2, 1);
    const len = style === 'dreadsLong' ? 11 : style === 'dreadsShort' ? 5 : 8;
    for (const [x, extra] of [[-5, 0], [-3, 1], [-1, -1]] as const) for (let y = -2; y <= len + extra; y++) hair(x - (y > 4 ? 1 : 0), y);
    if (style === 'dreadsPiled') for (let x = -3; x <= 1; x++) for (let y = -10; y <= -7; y++) hair(x, y);
  } else {
    const medium = style.startsWith('medium'), crop = style.startsWith('crop');
    cap(medium ? 3 : crop ? 2 : 2, medium ? 2 : 0);
    if (style.endsWith('Wide')) for (let y = -5; y <= -3; y++) hair(-6, y);
  }

  const beard = t.beardStyle;
  if (beard !== 'none') {
    if (beard.startsWith('stubble')) { for (const [x, y] of [[1, 4], [3, 5], [0, 3], [2, 2]] as const) hair(x, y); }
    else if (beard === 'mustache' || beard === 'mustacheThick') { hair(3, 2); hair(4, 2); if (beard === 'mustacheThick') hair(2, 2); }
    else if (beard === 'soulPatch') hair(3, 4);
    else if (['goatee', 'goateeWide', 'vandyke', 'circleBeard', 'anchor', 'balboa'].includes(beard)) { hair(3, 4); hair(3, 5); hair(2, 5); if (beard !== 'goatee') { hair(3, 2); hair(4, 2); } }
    else if (beard !== 'mutton') {
      const long = /Long|lumberjack|fullMedium/.test(beard);
      for (let y = 1; y <= (long ? 8 : 6); y++) for (let x = -1; x <= 5; x++) if (inHead(hx + x, hy + y) || (long && y > 5 && x <= 3 && x >= 0)) { if (!(x >= 3 && y === 3)) hair(x, y); }
    } else { hair(-1, 2); hair(0, 2); hair(0, 3); }
  }

  const hat = t.hatStyle;
  const hatPx = (x: number, y: number) => set(X(hx + x), Y(hy + y), 'hat');
  if (hat === 'headband' || hat === 'headbandWide' || hat === 'visor') {
    for (let x = -5; x <= 5; x++) { if (inHead(hx + x, hy - 3)) hatPx(x, -3); if (hat === 'headbandWide' && inHead(hx + x, hy - 4)) hatPx(x, -4); }
    if (hat === 'visor') for (let x = 4; x <= 8; x++) hatPx(x, -3);
  } else if (hat) {
    const top = hat.startsWith('beanie') ? -8 : -7;
    for (let y = top; y <= -3; y++) for (let x = -6; x <= 5; x++) if (inHead(hx + x, hy + y) || (y <= -5 && Math.abs(x + .5) <= 4.5)) hatPx(x, y);
    if (hat === 'cap') for (let x = 3; x <= 8; x++) hatPx(x, -3);
    if (hat === 'capBack') for (let x = -9; x <= -4; x++) hatPx(x, -3);
    if (hat === 'bucket') for (let x = -7; x <= 7; x++) hatPx(x, -3);
    if (hat === 'durag') for (let y = -3; y <= 3; y++) hatPx(-6 - (y > 0 ? 1 : 0), y);
  }
}

// ---------------------------------------------------------------- cache

const cache = new Map<string, SpritePath[]>();
/** One player in one frame, drawn once and reused. */
export function actionSprite(frameId: string, pose: Pose, look: ActionLook): SpritePath[] {
  const key = `${frameId}|${look.playerId}|${look.primary}|${look.secondary}|${look.jerseyNumber ?? ''}`;
  let hit = cache.get(key);
  if (!hit) {
    if (cache.size > 4000) cache.clear();
    hit = rasterizePose(pose, look);
    cache.set(key, hit);
  }
  return hit;
}
