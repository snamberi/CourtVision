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
  /** The upper body leans this many pixels (at the top of the head) toward the way he faces; negative leans back. */
  lean?: number;
  /** Lying on the floor: 1 head first the way he faces (a dive), -1 on his back (a charge, a fall). The body pivots at the waist. */
  lie?: 1 | -1;
}

const PAD_X = 10, PAD_TOP = 18, AV_W = 40, AV_H = 52;
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

// ---------------------------------------------------------------- the full animation set (six frames each)

/** A pose between two others (points, body and lean blend; the second's flags take over halfway). */
function blend(a: Pose, b: Pose, u: number): Pose {
  const m = (x: P, y: P): P => [Math.round(x[0] + (y[0] - x[0]) * u), Math.round(x[1] + (y[1] - x[1]) * u)];
  const late = u >= .5 ? b : a;
  return { body: m(a.body, b.body), lE: m(a.lE, b.lE), lH: m(a.lH, b.lH), rE: m(a.rE, b.rE), rH: m(a.rH, b.rH), lK: m(a.lK, b.lK), lF: m(a.lF, b.lF), rK: m(a.rK, b.rK), rF: m(a.rF, b.rF),
    air: late.air, lean: Math.round((a.lean ?? 0) + ((b.lean ?? 0) - (a.lean ?? 0)) * u) || undefined, lie: late.lie };
}
/** Six frames through a list of key poses (the last frame is the last key). */
function six(keys: Pose[]): Pose[] {
  return Array.from({ length: 6 }, (_, i) => {
    const at = i / 5 * (keys.length - 1), k = Math.min(keys.length - 2, Math.floor(at));
    return blend(keys[k], keys[k + 1], at - k);
  });
}
/** Six frames of a loop through the keys (back to the first after the last). */
function loop(keys: Pose[]): Pose[] {
  return Array.from({ length: 6 }, (_, i) => {
    const at = i / 6 * keys.length, k = Math.floor(at) % keys.length;
    return blend(keys[k], keys[(k + 1) % keys.length], at - Math.floor(at));
  });
}
const with_ = (p: Pose, q: Partial<Pose>): Pose => ({ ...p, ...q });

const IDLE6 = loop([STAND, with_(STAND, { body: [0, 1], lH: [6, 38], rH: [34, 38] }), BREATH]);
const WALK6 = loop([
  pose({ body: [0, 0], lE: [9, 32], lH: [11, 36], rE: [31, 32], rH: [30, 38], lK: [16, 44], lF: [17, 49], rK: [24, 44], rF: [22, 49] }),
  pose({ body: [0, 1], lE: [8, 32], lH: [7, 37], rE: [32, 32], rH: [33, 37], lK: [15, 44], lF: [15, 49], rK: [25, 44], rF: [25, 49] }),
  pose({ body: [0, 0], lE: [8, 32], lH: [5, 37], rE: [32, 32], rH: [35, 36], lK: [14, 44], lF: [12, 49], rK: [26, 44], rF: [28, 49] }),
]);
const RUN6 = loop([RUN_A, RUN_B, RUN_C, RUN_D]);
const SPRINT6 = loop([
  pose({ body: [2, 1], lean: 6, lE: [10, 30], lH: [18, 27], rE: [30, 35], rH: [27, 41], lK: [18, 40], lF: [17, 44], rK: [25, 45], rF: [21, 49] }),
  pose({ body: [2, 2], lean: 6, lE: [9, 33], lH: [10, 38], rE: [31, 32], rH: [33, 36], lK: [15, 45], lF: [12, 49], rK: [27, 44], rF: [29, 47] }),
  pose({ body: [2, 1], lean: 6, lE: [8, 35], lH: [5, 40], rE: [31, 30], rH: [26, 27], lK: [13, 45], lF: [9, 49], rK: [28, 40], rF: [30, 44] }),
  pose({ body: [2, 2], lean: 6, lE: [9, 33], lH: [10, 38], rE: [31, 32], rH: [33, 36], lK: [15, 44], lF: [16, 47], rK: [26, 45], rF: [26, 49] }),
]);
const BACKPEDAL6 = loop([
  pose({ body: [-1, 1], lean: -3, lE: [7, 31], lH: [3, 35], rE: [33, 31], rH: [37, 35], lK: [14, 45], lF: [11, 49], rK: [26, 44], rF: [26, 49] }),
  pose({ body: [-1, 2], lean: -3, lE: [7, 31], lH: [4, 36], rE: [33, 31], rH: [36, 36], lK: [15, 45], lF: [15, 49], rK: [25, 45], rF: [24, 49] }),
  pose({ body: [-1, 1], lean: -3, lE: [7, 31], lH: [3, 35], rE: [33, 31], rH: [37, 35], lK: [15, 44], lF: [15, 49], rK: [25, 45], rF: [22, 49] }),
]);
const SLIDE6 = loop([
  pose({ body: [0, 3], lE: [6, 27], lH: [3, 21], rE: [34, 30], rH: [38, 31], lK: [11, 46], lF: [9, 49], rK: [29, 46], rF: [31, 49] }),
  pose({ body: [0, 4], lE: [6, 28], lH: [3, 23], rE: [34, 31], rH: [38, 32], lK: [14, 46], lF: [14, 49], rK: [26, 46], rF: [26, 49] }),
  pose({ body: [0, 3], lE: [6, 27], lH: [3, 21], rE: [34, 30], rH: [38, 31], lK: [10, 46], lF: [7, 49], rK: [30, 46], rF: [33, 49] }),
]);
const DRIBBLE6 = [0, 1, 2, 2, 1, 0].map(l => DRIBBLE[l]);
/** Ball crosses from the right hand to the left in front, low. */
const CROSSOVER6 = six([
  DRIBBLE[1],
  pose({ body: [0, 3], lE: [9, 33], lH: [10, 39], rE: [32, 37], rH: [30, 45], ...LEGS_WIDE }),
  pose({ body: [-1, 4], lE: [10, 36], lH: [14, 45], rE: [30, 37], rH: [24, 44], ...LEGS_WIDE }),
  pose({ body: [-2, 3], lE: [7, 36], lH: [5, 44], rE: [33, 31], rH: [36, 33], ...LEGS_WIDE }),
  pose({ body: [-1, 2], lE: [7, 35], lH: [5, 41], rE: [33, 31], rH: [36, 33], ...LEGS_WIDE }),
]);
/** Ball goes behind the back from the right hand to the left. */
const BEHIND6 = six([
  DRIBBLE[1],
  pose({ body: [0, 2], lE: [7, 31], lH: [4, 33], rE: [31, 36], rH: [26, 42], ...LEGS_WIDE }),
  pose({ body: [0, 3], lE: [9, 36], lH: [14, 41], rE: [29, 36], rH: [21, 41], ...LEGS_WIDE }),
  pose({ body: [0, 2], lE: [7, 36], lH: [4, 43], rE: [33, 31], rH: [37, 33], ...LEGS_WIDE }),
  pose({ body: [0, 2], lE: [7, 35], lH: [5, 41], rE: [33, 31], rH: [36, 33], ...LEGS_WIDE }),
]);
/** A spin: plant, turn your back (the frames flip), come out the other side. */
const SPIN6 = six([
  DRIBBLE[1],
  pose({ body: [1, 3], lE: [9, 31], lH: [12, 35], rE: [33, 35], rH: [36, 41], lK: [15, 46], lF: [16, 49], rK: [26, 46], rF: [28, 49] }),
  pose({ body: [0, 3], lE: [7, 30], lH: [4, 31], rE: [33, 33], rH: [37, 38], ...LEGS_TOGETHER }),
  pose({ body: [0, 3], lE: [7, 30], lH: [4, 31], rE: [33, 33], rH: [37, 38], ...LEGS_TOGETHER }),
  pose({ body: [1, 2], lE: [7, 31], lH: [4, 33], rE: [34, 35], rH: [36, 41], ...LEGS_WIDE }),
]);
/** Jab step: triple threat, the lead foot jabs out and back. */
const JAB6 = six([READY, with_(READY, { rK: [30, 45], rF: [33, 49], body: [1, 3] }), READY, with_(READY, { rK: [31, 45], rF: [34, 49], body: [2, 3] }), READY]);
/** Pump fake: the ball comes up to the forehead and back down; the feet never leave the floor. */
const PUMP6 = six([READY, pose({ body: [0, 0], lE: [9, 25], lH: [15, 17], rE: [31, 25], rH: [25, 17], ...LEGS_STAND }), pose({ body: [0, -1], lE: [8, 21], lH: [13, 12], rE: [32, 21], rH: [27, 12], ...LEGS_STAND }), READY]);
const JUMPER6 = JUMPER;
const STEPBACK6 = [
  DRIBBLE[1],
  pose({ body: [-3, 2], lE: [9, 33], lH: [16, 36], rE: [31, 34], rH: [26, 37], lK: [10, 44], lF: [7, 47], rK: [24, 45], rF: [22, 49], air: true }),
  pose({ body: [-4, 3], lE: [12, 35], lH: [18, 34], rE: [29, 35], rH: [24, 34], lK: [8, 46], lF: [7, 49], rK: [22, 46], rF: [21, 49] }),
  with_(JUMPER[1], { body: [-4, -1] }), with_(JUMPER[3], { body: [-4, -1] }), with_(JUMPER[5], { body: [-4, 2] }),
];
const FADE6 = [
  JUMPER[0],
  with_(JUMPER[1], { lean: -3, lK: [17, 43], lF: [19, 47], rK: [26, 43], rF: [29, 46] }),
  with_(JUMPER[2], { lean: -6, body: [-2, -1], lK: [18, 43], lF: [21, 46], rK: [27, 42], rF: [31, 45] }),
  with_(JUMPER[3], { lean: -7, body: [-3, -1], lK: [18, 43], lF: [21, 46], rK: [27, 42], rF: [31, 45] }),
  with_(JUMPER[4], { lean: -6, body: [-4, -1], lK: [17, 44], lF: [19, 48], rK: [26, 44], rF: [28, 48] }),
  with_(JUMPER[5], { body: [-4, 2] }),
];
const FT6 = [
  DRIBBLE[0], DRIBBLE[2],
  pose({ body: [0, 2], lE: [12, 34], lH: [18, 31], rE: [29, 34], rH: [24, 31], ...LEGS_STAND }),
  with_(JUMPER[2], { ...LEGS_STAND, body: [0, 0], air: false }),
  with_(JUMPER[4], { ...LEGS_STAND, body: [0, 0], air: false }),
  with_(JUMPER[5], { ...LEGS_STAND, body: [0, 0] }),
];
const LAYUP6 = [LAYUP[0], blend(LAYUP[0], LAYUP[1], .5), LAYUP[1], LAYUP[2], LAYUP[3], LAYUP[4]];
/** A floater: one-foot take-off, the ball pushed up and forward with one hand. */
const FLOATER6 = [
  LAYUP[0],
  pose({ body: [1, 0], lE: [10, 31], lH: [18, 27], rE: [32, 27], rH: [28, 22], lK: [15, 44], lF: [15, 49], rK: [25, 41], rF: [26, 45], air: true }),
  pose({ body: [1, -1], lE: [8, 28], lH: [5, 25], rE: [33, 19], rH: [35, 11], lK: [15, 43], lF: [15, 48], rK: [25, 40], rF: [26, 44], air: true }),
  pose({ body: [1, -1], lE: [8, 29], lH: [5, 27], rE: [35, 18], rH: [39, 10], lK: [15, 43], lF: [15, 48], rK: [25, 40], rF: [26, 44], air: true }),
  pose({ body: [1, 0], lE: [8, 31], lH: [6, 33], rE: [34, 21], rH: [38, 16], lK: [15, 44], lF: [15, 49], rK: [25, 43], rF: [26, 47], air: true }),
  JUMPER[5],
];
const DUNK6 = [DUNK[0], DUNK[1], DUNK[2], DUNK[3], blend(DUNK[3], DUNK[4], .5), DUNK[4]];
/** Alley-oop: in at full speed, up, one hand back for the lob, then the slam. */
const OOP6 = [
  SPRINT6[0],
  DUNK[0],
  pose({ body: [0, -2], lE: [8, 18], lH: [10, 8], rE: [31, 13], rH: [27, -1], ...LEGS_TUCK, air: true }),
  pose({ body: [0, -2], lE: [8, 18], lH: [9, 8], rE: [32, 12], rH: [31, -2], ...LEGS_TUCK, air: true }),
  DUNK[2], DUNK[4],
];
const CHEST6 = six([
  pose({ ...READY, lE: [12, 32], lH: [19, 30], rE: [28, 32], rH: [23, 30] }),
  pose({ ...READY, body: [1, 2], lE: [16, 31], lH: [27, 30], rE: [31, 31], rH: [33, 30] }),
  pose({ ...READY, body: [2, 2], lE: [21, 31], lH: [36, 31], rE: [34, 31], rH: [40, 31] }),
  pose({ ...READY, body: [1, 2], lE: [19, 32], lH: [33, 34], rE: [33, 32], rH: [38, 35] }),
  READY,
]);
const BOUNCE6 = six([
  pose({ ...READY, lE: [12, 32], lH: [19, 31], rE: [28, 32], rH: [23, 31] }),
  pose({ ...READY, body: [1, 3], lE: [16, 34], lH: [26, 35], rE: [31, 34], rH: [33, 35] }),
  pose({ ...READY, body: [2, 4], lE: [20, 36], lH: [33, 41], rE: [33, 36], rH: [38, 42] }),
  pose({ ...READY, body: [1, 3], lE: [19, 36], lH: [31, 42], rE: [33, 36], rH: [37, 43] }),
  READY,
]);
const OVERHEAD6 = six([
  pose({ body: [0, 1], lE: [10, 20], lH: [17, 9], rE: [30, 20], rH: [24, 9], ...LEGS_STAND }),
  pose({ body: [-1, 1], lean: -2, lE: [10, 19], lH: [15, 7], rE: [30, 19], rH: [22, 7], ...LEGS_WIDE }),
  pose({ body: [1, 1], lean: 3, lE: [16, 20], lH: [30, 15], rE: [32, 20], rH: [38, 15], ...LEGS_WIDE }),
  pose({ body: [1, 2], lean: 2, lE: [18, 25], lH: [34, 24], rE: [33, 25], rH: [39, 25], ...LEGS_WIDE }),
  STAND,
]);
/** Catch: target hands out, the ball arrives, pull it in to the chest, triple threat. */
const CATCH6 = six([
  pose({ body: [0, 1], lE: [16, 30], lH: [30, 28], rE: [32, 30], rH: [37, 30], ...LEGS_STAND }),
  pose({ body: [1, 1], lE: [18, 30], lH: [33, 29], rE: [33, 30], rH: [39, 31], ...LEGS_STAND }),
  pose({ body: [0, 2], lE: [14, 32], lH: [24, 31], rE: [31, 32], rH: [29, 32], ...LEGS_BENT }),
  READY,
]);
const REBOUND6 = [
  pose({ body: [0, 4], lE: [10, 35], lH: [14, 31], rE: [30, 35], rH: [26, 31], lK: [12, 46], lF: [12, 49], rK: [28, 46], rF: [28, 49] }),
  REACH, with_(REACH, { ...LEGS_TUCK, body: [0, -2] }),
  pose({ body: [0, -1], lE: [6, 22], lH: [14, 15], rE: [34, 22], rH: [26, 15], ...LEGS_TUCK, air: true }),
  pose({ body: [0, 3], lE: [5, 28], lH: [15, 25], rE: [35, 28], rH: [25, 25], ...LEGS_WIDE }),
  pose({ body: [0, 2], lE: [7, 29], lH: [15, 27], rE: [33, 29], rH: [25, 27], ...LEGS_WIDE }),
];
const BLOCK6 = [
  GUARD[0],
  pose({ body: [0, 4], lE: [8, 34], lH: [8, 38], rE: [32, 30], rH: [33, 24], lK: [12, 46], lF: [12, 49], rK: [28, 46], rF: [28, 49] }),
  pose({ body: [0, -2], lE: [8, 30], lH: [6, 34], rE: [32, 14], rH: [32, 1], ...LEGS_TOGETHER, air: true }),
  pose({ body: [1, -2], lE: [8, 30], lH: [6, 34], rE: [33, 13], rH: [35, -2], ...LEGS_TOGETHER, air: true }),
  pose({ body: [1, -1], lE: [8, 30], lH: [6, 34], rE: [35, 18], rH: [40, 14], ...LEGS_TOGETHER, air: true }),
  GUARD[1],
];
/** Contest: close out under control, a high hand at the shooter's eyes. */
const CONTEST6 = six([
  SLIDE6[0],
  pose({ body: [2, 2], lean: 3, lE: [8, 32], lH: [6, 36], rE: [33, 18], rH: [37, 7], ...LEGS_STAND }),
  pose({ body: [2, 1], lean: 4, lE: [8, 32], lH: [6, 36], rE: [33, 15], rH: [37, 3], lK: [14, 44], lF: [14, 49], rK: [27, 44], rF: [29, 49] }),
  pose({ body: [1, 2], lean: 2, lE: [8, 32], lH: [6, 35], rE: [33, 17], rH: [36, 6], ...LEGS_STAND }),
]);
/** Steal: a quick swipe at the ball, low and long, then away with it. */
const STEAL6 = six([
  GUARD[1],
  pose({ body: [2, 4], lean: 5, lE: [8, 33], lH: [6, 38], rE: [34, 37], rH: [41, 42], lK: [12, 46], lF: [10, 49], rK: [28, 45], rF: [32, 49] }),
  pose({ body: [2, 4], lean: 5, lE: [10, 36], lH: [14, 42], rE: [33, 39], rH: [37, 44], lK: [12, 46], lF: [10, 49], rK: [28, 45], rF: [32, 49] }),
  RUN_B,
]);
/** Box out: low and wide, backside into the man, forearms out. */
const BOXOUT6 = loop([
  pose({ body: [-1, 4], lean: -2, lE: [5, 29], lH: [1, 26], rE: [35, 29], rH: [39, 26], lK: [11, 46], lF: [9, 49], rK: [29, 46], rF: [31, 49] }),
  pose({ body: [-2, 5], lean: -3, lE: [5, 30], lH: [1, 27], rE: [35, 30], rH: [39, 27], lK: [11, 47], lF: [9, 49], rK: [29, 47], rF: [31, 49] }),
]);
/** Set screen: a wide base, arms crossed over the chest, braced for contact. */
const SCREEN6 = loop([SCREEN, with_(SCREEN, { body: [0, 3] }), with_(SCREEN, { body: [-1, 3], lean: -1 })]);
/** Loose-ball dive: run, launch, full stretch on the floor, push up. */
const DIVE6 = [
  SPRINT6[2],
  pose({ body: [3, 2], lean: 12, lE: [16, 28], lH: [30, 24], rE: [32, 28], rH: [42, 26], lK: [12, 43], lF: [6, 44], rK: [20, 44], rF: [14, 47], air: true }),
  pose({ body: [-16, 6], lie: 1, lE: [30, 44], lH: [42, 44], rE: [30, 50], rH: [43, 50], lK: [-2, 45], lF: [-10, 46], rK: [-2, 50], rF: [-10, 51] }),
  pose({ body: [-16, 6], lie: 1, lE: [28, 44], lH: [38, 43], rE: [28, 50], rH: [39, 49], lK: [-2, 45], lF: [-10, 46], rK: [-2, 50], rF: [-10, 51] }),
  pose({ body: [-6, 6], lean: 14, lE: [16, 40], lH: [22, 48], rE: [30, 40], rH: [34, 49], lK: [8, 46], lF: [2, 49], rK: [18, 47], rF: [12, 49] }),
  pose({ body: [0, 5], lean: 4, lE: [10, 37], lH: [16, 44], rE: [31, 37], rH: [32, 44], ...LEGS_WIDE }),
];
/** Take a charge: square up, absorb the hit, go down on your back, get up. */
const CHARGE6 = [
  SCREEN,
  pose({ body: [-2, 1], lean: -5, lE: [12, 29], lH: [24, 31], rE: [28, 29], rH: [16, 31], lK: [16, 44], lF: [18, 48], rK: [26, 43], rF: [29, 47], air: true }),
  pose({ body: [16, 6], lie: -1, lE: [6, 40], lH: [0, 36], rE: [6, 50], rH: [-1, 53], lK: [38, 44], lF: [44, 47], rK: [38, 50], rF: [44, 51] }),
  pose({ body: [16, 6], lie: -1, lE: [4, 42], lH: [-2, 40], rE: [6, 50], rH: [1, 52], lK: [37, 43], lF: [42, 46], rK: [38, 50], rF: [44, 51] }),
  pose({ body: [4, 6], lean: -10, lE: [14, 42], lH: [12, 49], rE: [28, 42], rH: [30, 49], lK: [18, 44], lF: [24, 49], rK: [28, 45], rF: [34, 49] }),
  pose({ body: [0, 3], lE: [10, 34], lH: [13, 40], rE: [30, 34], rH: [27, 40], ...LEGS_BENT }),
];
/** Fall and get up: knocked off balance, down, back up through a crouch. */
const FALL6 = [
  pose({ body: [-2, 1], lean: -6, lE: [6, 24], lH: [1, 18], rE: [34, 24], rH: [39, 18], lK: [16, 44], lF: [19, 48], rK: [26, 44], rF: [30, 47], air: true }),
  pose({ body: [16, 6], lie: -1, lE: [4, 40], lH: [-3, 37], rE: [6, 50], rH: [-1, 54], lK: [38, 44], lF: [44, 47], rK: [38, 50], rF: [44, 51] }),
  pose({ body: [16, 6], lie: -1, lE: [6, 42], lH: [1, 39], rE: [6, 50], rH: [0, 52], lK: [37, 43], lF: [42, 46], rK: [38, 50], rF: [44, 51] }),
  pose({ body: [4, 7], lean: -9, lE: [12, 42], lH: [10, 49], rE: [28, 42], rH: [30, 49], lK: [17, 45], lF: [22, 49], rK: [27, 45], rF: [32, 49] }),
  pose({ body: [0, 5], lean: 3, lE: [10, 37], lH: [15, 43], rE: [30, 37], rH: [26, 43], lK: [13, 47], lF: [12, 49], rK: [27, 47], rF: [28, 49] }),
  STAND,
];
/** Land and recover: absorb the landing in a deep crouch, then stand tall. */
const LAND6 = six([
  with_(REACH, { ...LEGS_TUCK }),
  pose({ body: [0, 6], lE: [8, 36], lH: [9, 42], rE: [32, 36], rH: [31, 42], lK: [12, 47], lF: [12, 49], rK: [28, 47], rF: [28, 49] }),
  pose({ body: [0, 4], lE: [8, 35], lH: [8, 40], rE: [32, 35], rH: [32, 40], ...LEGS_BENT }),
  STAND,
]);
const CELEBRATE6 = [
  CELEBRATE[0],
  pose({ ...STAND, lE: [8, 32], lH: [12, 26], rE: [33, 22], rH: [36, 14] }),
  with_(CELEBRATE[1], { body: [0, -1], ...LEGS_TUCK, air: true }),
  CELEBRATE[1],
  pose({ ...STAND, lE: [6, 24], lH: [10, 20], rE: [34, 24], rH: [30, 20] }),
  pose({ ...STAND, lE: [8, 32], lH: [6, 37], rE: [34, 24], rH: [40, 18] }),
];

export const POSES = { STAND, BREATH, READY, RUN, DRIBBLE, RUN_DRIBBLE, JUMPER, LAYUP, DUNK, PASS, GUARD, REACH, REBOUND, SCREEN, CELEBRATE } as const;
/** The full animation sheet: six frames per action (the court and the animation sheet test read these). */
export const ANIMATIONS = {
  idle: IDLE6, walk: WALK6, run: RUN6, sprint: SPRINT6, backpedal: BACKPEDAL6, slide: SLIDE6, dribble: DRIBBLE6,
  crossover: CROSSOVER6, behindBack: BEHIND6, spin: SPIN6, jab: JAB6, pumpFake: PUMP6, jumper: JUMPER6, stepback: STEPBACK6,
  fadeaway: FADE6, ft: FT6, layup: LAYUP6, floater: FLOATER6, dunk: DUNK6, alleyOop: OOP6, chestPass: CHEST6, bouncePass: BOUNCE6,
  overheadPass: OVERHEAD6, catch: CATCH6, rebound: REBOUND6, block: BLOCK6, contest: CONTEST6, steal: STEAL6, boxOut: BOXOUT6,
  screen: SCREEN6, dive: DIVE6, charge: CHARGE6, fall: FALL6, land: LAND6, celebrate: CELEBRATE6,
} as const;
export type AnimationName = keyof typeof ANIMATIONS;

/** How far above the feet the highest hand reaches, in avatar pixels (for meeting the rim on a dunk). */
export const handReach = (p: Pose) => FOOT - Math.min(p.lH[1], p.rH[1]) - p.body[1];
/** How far above the feet the top of the head is, in avatar pixels. */
export const headTop = (p: Pose) => FOOT - 2 - p.body[1];

// ---------------------------------------------------------------- choosing a frame

export type AnimKind = 'jumper' | 'layup' | 'dunk' | 'ft' | 'pass' | 'rebound' | 'celebrate'
  | 'stepback' | 'fadeaway' | 'floater' | 'alleyOop' | 'chestPass' | 'bouncePass' | 'overheadPass' | 'catch' | 'block' | 'contest'
  | 'steal' | 'boxOut' | 'screen' | 'dive' | 'charge' | 'fall' | 'land' | 'crossover' | 'behindBack' | 'spin' | 'jab' | 'pumpFake';
export type Gait = 'walk' | 'run' | 'sprint' | 'backpedal' | 'slide';
export interface AnimInput {
  pose: string; anim?: { kind: AnimKind; t: number }; cycle?: number; carrier: boolean; moving: boolean;
  /** Ball height while dribbling: picks the hand (high, mid, low). */
  ballZ: number;
  /** How he's moving off the ball (from his speed and direction): walk, run, sprint, backpedal, defensive slide. */
  gait?: Gait;
  /** Guarding the ball: a low stance with a hand up, feet always shuffling. */
  onBall?: boolean;
}
const step = (t: number, cuts: number[]) => { let i = 0; while (i < cuts.length && t >= cuts[i]) i++; return i; };
const frac = (v: number) => ((v % 1) + 1) % 1;
const at6 = (t: number) => Math.max(0, Math.min(5, Math.floor(t * 6)));
/** Frame ids by animation (two letters, then the frame), so a sprite drawn once is reused everywhere. */
const CODE: Record<AnimationName, string> = {
  idle: 'ID', walk: 'WK', run: 'RN', sprint: 'SP', backpedal: 'BP', slide: 'SL', dribble: 'DB', crossover: 'CX', behindBack: 'BB', spin: 'SN',
  jab: 'JB', pumpFake: 'PF', jumper: 'JS', stepback: 'SB', fadeaway: 'FA', ft: 'FT', layup: 'LU', floater: 'FL', dunk: 'DK', alleyOop: 'AO',
  chestPass: 'CP', bouncePass: 'BO', overheadPass: 'OP', catch: 'CA', rebound: 'RB', block: 'BL', contest: 'CT', steal: 'ST', boxOut: 'BX',
  screen: 'SC', dive: 'DV', charge: 'CH', fall: 'FG', land: 'LD', celebrate: 'CE',
};
const frameOf = (name: AnimationName, i: number) => ({ id: `${CODE[name]}${i}`, pose: ANIMATIONS[name][i] });

/** The pose model and a stable id for this moment of this player's action (`flip` turns him the other way: the spin). */
export function pickFrame(a: AnimInput): { id: string; pose: Pose; flip?: boolean } {
  const level = a.ballZ > 20 ? 0 : a.ballZ > 11 ? 1 : 2;
  const runAt = Math.floor(frac(a.cycle ?? 0) * RUN.length) % RUN.length;
  const cyc6 = Math.floor(frac(a.cycle ?? 0) * 6) % 6;
  if (a.anim) {
    const t = a.anim.t;
    switch (a.anim.kind) {
      // The shot frames keep their timing: the release lands with the ball leaving the hand.
      case 'jumper': { const i = step(t, [.12, .3, .45, .58, .85]); return { id: `J${i}`, pose: JUMPER[i] }; }
      case 'layup': { const i = step(t, [.1, .2, .3, .5, .8]); return { id: `L${i}`, pose: LAYUP6[i] }; }
      case 'dunk': { const i = step(t, [.12, .35, .55, .78, .9]); return { id: `K${i}`, pose: DUNK6[i] }; }
      case 'ft': { const i = step(t, [.08, .15, .22, .4, .75]); return frameOf('ft', i); }
      case 'pass': case 'chestPass': return frameOf('chestPass', at6(t));
      case 'rebound': return frameOf('rebound', at6(t));
      case 'celebrate': return frameOf('celebrate', Math.floor(t * 9) % 6);
      case 'spin': { const i = at6(t); return { ...frameOf('spin', i), flip: i >= 2 && i <= 3 }; }
      default: return frameOf(a.anim.kind as AnimationName, at6(t));
    }
  }
  switch (a.pose) {
    case 'shoot': return { id: 'J3', pose: JUMPER[3] };
    case 'reach': return { id: 'R', pose: REACH };
    case 'rebound': return { id: 'B0', pose: REBOUND[0] };
    case 'screen': return frameOf('screen', Math.floor(frac(a.cycle ?? 0) * 3) % 3);
    case 'celebrate': return { id: 'C1', pose: CELEBRATE[1] };
    case 'pass': return { id: 'P1', pose: PASS[1] };
    case 'boxout': return frameOf('boxOut', cyc6 % 2);
    case 'guard': {
      if (a.moving || a.gait === 'slide' || a.onBall) return frameOf('slide', cyc6);
      const i = Math.floor(frac(a.cycle ?? 0) * 2) % 2; return { id: `G${i}`, pose: GUARD[i] };
    }
    case 'dribble': return a.moving ? { id: `RD${level}${runAt}`, pose: RUN_DRIBBLE[level][runAt] } : { id: `D${level}`, pose: DRIBBLE[level] };
    case 'run': {
      if (a.carrier) return { id: `RD${level}${runAt}`, pose: RUN_DRIBBLE[level][runAt] };
      const g = a.gait ?? 'run';
      return frameOf(g === 'walk' ? 'walk' : g === 'sprint' ? 'sprint' : g === 'backpedal' ? 'backpedal' : g === 'slide' ? 'slide' : 'run', cyc6);
    }
    default: {
      if (a.carrier) return { id: 'RDY', pose: READY };
      return frameOf('idle', cyc6);
    }
  }
}

/** The pose for a player facing left: arms and legs mirrored and swapped (the head and jersey are drawn unmirrored). */
export function mirrorPose(p: Pose): Pose {
  const m = (v: P): P => [AV_W - v[0], v[1]];
  return { body: [-p.body[0], p.body[1]], lE: m(p.rE), lH: m(p.rH), rE: m(p.lE), rH: m(p.lH), lK: m(p.rK), lF: m(p.rF), rK: m(p.lK), rF: m(p.lF), air: p.air,
    ...(p.lean ? { lean: -p.lean } : {}), ...(p.lie ? { lie: (-p.lie) as 1 | -1 } : {}) };
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
  // Leaning: the upper body shears toward the lean, most at the head. Lying: it pivots flat at the waist.
  const lean = p.lean ?? 0, lie = p.lie ?? 0;
  const shear = (y: number) => Math.round(lean * Math.max(0, 41 - y) / 34);
  const place = (x: number, y: number): P => lie ? [20 + bx + lie * (41 - y), 41 + by + Math.round((x - 20) * .5)] : [x + bx + shear(y), y + by];
  layer = 0;
  leg(lie ? [20 + bx, 39 + by] : [15 + bx, 41 + by], p.lK, p.lF, -1);
  leg(lie ? [20 + bx, 43 + by] : [25 + bx, 41 + by], p.rK, p.rF, 1);

  // Head and torso straight from the avatar, shifted with the body.
  layer = 1;
  const up = upperBody(look);
  for (let y = 0; y < AV_H; y++) for (let x = 0; x < AV_W; x++) {
    const c = up[y][x];
    if (!c) continue;
    const [px, py] = place(x, y);
    set(px, py, c);
  }

  // Arms: upper arm, forearm and hand in the avatar's style, a wristband when the avatar has one.
  const arm = (shoulder: P, e: P, h: P, band: boolean) => {
    // The shoulder rides the lean (or the lying torso); elbows and hands lean with it.
    const sh = lie ? place(shoulder[0] - bx, shoulder[1] - by) : [shoulder[0] + shear(27), shoulder[1]] as P;
    const lift = lie ? 0 : shear(27);
    // Lying poses give their elbows and hands on the floor grid, like the knees and feet.
    const E: P = lie ? e : [e[0] + bx + lift, e[1] + by], H: P = lie ? h : [h[0] + bx + lift, h[1] + by];
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
