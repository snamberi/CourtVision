import { RUN16, WALK16, SPRINT16, JUMPER16, LAYUP16, DUNK16, RUN_DRIBBLE16, DRIBBLE16, SLIDE16, expose, ACTION_EXPOSURE, LOOP_EXPOSURE } from './athleteFrames';
import { buildPlayerGrid, athleticGrid, athleticY, outlineGrid, gridToPaths, playerTraits, type Appearance, type SpriteGrid, type SpritePath } from './playerSprite';

/*
 * Frame-by-frame court animations for the players everyone already knows: the head, face, hair, beard, headwear and
 * jersey come straight from the player's avatar (so he looks exactly like his portrait), and each frame is a pose
 * model that places his arms and legs, drawn in the same pixel style. Run cycles, dribbles, jump shots, layups,
 * dunks, passes, defence, rebounds, screens and celebrations are all separate models.
 *
 * Coordinates are avatar pixels (the 40 × 52 avatar grid, feet on row 49). Poses face right (the ball side is the
 * right hand); a player facing left gets the mirrored pose, but his face and jersey number are never mirrored.
 */

export type P = readonly [number, number];
export interface Pose {
  /** Shift of the head and torso (a crouch is +y). */
  body: P;
  lE: P; lH: P; rE: P; rH: P; // left and right elbow and hand, relative to the body
  lK: P; lF: P; rK: P; rF: P; // knees and feet, on the floor grid
  air?: boolean;
  /** Authored sagittal stride; projected into the court camera direction. */
  travel?: boolean;
  dribbling?: boolean;
  /** Shoe pitch in degrees, drawn with the foot instead of sliding a flat rectangle. */
  lToe?: number; rToe?: number;
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

const STAND = pose({ body: [0, 0], lE: [10, 28], lH: [9, 36], rE: [30, 28], rH: [31, 36], ...LEGS_STAND });
const BREATH = pose({ ...STAND, body: [0, 1] });
/** Triple threat: knees bent, the ball on the right hip. */
const READY = pose({ body: [0, 2], lE: [11, 34], lH: [20, 36], rE: [31, 34], rH: [27, 37], ...LEGS_BENT });

const RUN_A = pose({ body: [1, 0], lean: 3, lE: [12, 27], lH: [20, 24], rE: [28, 34], rH: [22, 39], lK: [12, 43], lF: [7, 49], rK: [30, 38], rF: [33, 44] });
const RUN_B = pose({ body: [1, 2], lean: 2, lE: [10, 31], lH: [15, 32], rE: [31, 30], rH: [29, 28], lK: [18, 44], lF: [21, 49], rK: [23, 42], rF: [16, 45] });
const RUN_C = pose({ body: [1, 0], lean: 3, lE: [10, 34], lH: [5, 38], rE: [29, 27], rH: [24, 23], lK: [22, 38], lF: [28, 44], rK: [22, 44], rF: [16, 49] });
const RUN_D = pose({ body: [1, 2], lean: 2, lE: [11, 30], lH: [16, 28], rE: [30, 32], rH: [26, 35], lK: [16, 42], lF: [9, 45], rK: [26, 44], rF: [30, 49] });
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

// ---------------------------------------------------------------- secondary gesture drawings and exposures

/** Secondary gestures use their deliberately held drawings. They are never morphed.
 * Short passes/gestures have fewer unique drawings than a full run cycle. */
function six(keys: Pose[]): Pose[] {
  return Array.from({length:6},(_,i)=>keys[Math.round(i/5*(keys.length-1))]);
}
function loop(keys: Pose[]): Pose[] {
  return Array.from({length:6},(_,i)=>keys[Math.floor(i/6*keys.length)]);
}
const with_ = (p: Pose, q: Partial<Pose>): Pose => ({ ...p, ...q });

const IDLE6 = loop([STAND, with_(STAND, { body: [0, 1], lH: [9, 36.5], rH: [31, 36.5] }), BREATH]);
const SLIDE6 = loop([
  pose({ body: [0, 3], lE: [6, 27], lH: [3, 21], rE: [34, 30], rH: [38, 31], lK: [11, 46], lF: [9, 49], rK: [29, 46], rF: [31, 49] }),
  pose({ body: [0, 4], lE: [6, 28], lH: [3, 23], rE: [34, 31], rH: [38, 32], lK: [14, 46], lF: [14, 49], rK: [26, 46], rF: [26, 49] }),
  pose({ body: [0, 3], lE: [6, 27], lH: [3, 21], rE: [34, 30], rH: [38, 31], lK: [10, 46], lF: [7, 49], rK: [30, 46], rF: [33, 49] }),
]);
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
const STEPBACK6 = [
  DRIBBLE[1],
  pose({ body: [-3, 2], lE: [9, 33], lH: [16, 36], rE: [31, 34], rH: [26, 37], lK: [10, 44], lF: [7, 47], rK: [24, 45], rF: [22, 49], air: true }),
  pose({ body: [-4, 3], lE: [12, 35], lH: [18, 34], rE: [29, 35], rH: [24, 34], lK: [8, 46], lF: [7, 49], rK: [22, 46], rF: [21, 49] }),
  with_(JUMPER[1], { body: [-4, -1] }), with_(JUMPER[3], { body: [-4, -1] }), with_(JUMPER[5], { body: [-4, 2] }),
];
const FT6 = [
  DRIBBLE[0], DRIBBLE[2],
  pose({ body: [0, 2], lE: [12, 34], lH: [18, 31], rE: [29, 34], rH: [24, 31], ...LEGS_STAND }),
  with_(JUMPER[2], { ...LEGS_STAND, body: [0, 0], air: false }),
  with_(JUMPER[4], { ...LEGS_STAND, body: [0, 0], air: false }),
  with_(JUMPER[5], { ...LEGS_STAND, body: [0, 0] }),
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
  SPRINT16[4],
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

// Curry brings both hands to his cheek, tilts, and holds the night-night pose.
const NIGHT_NIGHT6 = six([
  STAND,
  pose({ ...STAND, lE: [12, 24], lH: [29, 17], rE: [35, 23], rH: [31, 16] }),
  pose({ ...STAND, body: [1, 2], lean: 5, lE: [15, 22], lH: [30, 12], rE: [34, 23], rH: [31, 13] }),
  pose({ ...STAND, body: [1, 2], lean: 5, lE: [15, 22], lH: [30, 12], rE: [34, 23], rH: [31, 13] }),
]);
const CLAP6 = loop([
  pose({ ...STAND, lE: [9, 28], lH: [15, 24], rE: [31, 28], rH: [26, 24] }),
  pose({ ...STAND, lE: [11, 28], lH: [20, 24], rE: [29, 28], rH: [21, 24] }),
  pose({ ...STAND, body: [0, -1], lE: [9, 28], lH: [14, 23], rE: [31, 28], rH: [27, 23] }),
]);
export const POSES = { STAND, BREATH, READY, RUN, DRIBBLE, RUN_DRIBBLE, JUMPER, LAYUP, DUNK, PASS, GUARD, REACH, REBOUND, SCREEN, CELEBRATE } as const;
/** The exposure sheet: 16 discrete drawing slots; the main cycles are individually authored. */
export const ANIMATIONS = {
  idle: expose(IDLE6, LOOP_EXPOSURE), walk: WALK16, run: RUN16, sprint: SPRINT16,
  backpedal: [...WALK16].reverse().map(p=>({...p, lH:[12,31] as P,rH:[28,31] as P})),
  slide: SLIDE16, dribble: DRIBBLE16,
  crossover: expose(CROSSOVER6,ACTION_EXPOSURE), behindBack: expose(BEHIND6,ACTION_EXPOSURE), spin: expose(SPIN6,ACTION_EXPOSURE),
  jab: expose(JAB6,ACTION_EXPOSURE), pumpFake: expose(PUMP6,ACTION_EXPOSURE), jumper: JUMPER16,
  stepback: [STEPBACK6[0],STEPBACK6[1],STEPBACK6[2],STEPBACK6[2],...JUMPER16.slice(4).map(p=>({...p,body:[-3,p.body[1]] as P}))],
  fadeaway: JUMPER16.map((p,i)=>({...p,body:[i<4?0:i<12?-2:-3,p.body[1]] as P,lean:i>=5&&i<=11?-2:0})),
  ft: [FT6[0],FT6[1],FT6[2],JUMPER16[4],JUMPER16[6],JUMPER16[8],...JUMPER16.slice(9),STAND,STAND,STAND].map(p=>({...p,...LEGS_STAND,body:[0,0] as P,air:false})),
  layup: LAYUP16, floater: LAYUP16.map((p,i)=>i>=4&&i<11?{...p,rH:[p.rH[0]+1,p.rH[1]+5] as P}:p),
  dunk: DUNK16, alleyOop: DUNK16.map((p,i)=>i<4?{...p,lE:[10,22] as P,lH:[15,13] as P,rE:[30,19] as P,rH:[28,7] as P}:p),
  chestPass: expose(CHEST6,ACTION_EXPOSURE), bouncePass: expose(BOUNCE6,ACTION_EXPOSURE), overheadPass: expose(OVERHEAD6,ACTION_EXPOSURE),
  catch: expose(CATCH6,ACTION_EXPOSURE), rebound: expose(REBOUND6,ACTION_EXPOSURE), block: expose(BLOCK6,ACTION_EXPOSURE),
  contest: expose(CONTEST6,ACTION_EXPOSURE), steal: expose(STEAL6,ACTION_EXPOSURE), boxOut: expose(BOXOUT6,LOOP_EXPOSURE),
  screen: expose(SCREEN6,LOOP_EXPOSURE), dive: expose(DIVE6,ACTION_EXPOSURE), charge: expose(CHARGE6,ACTION_EXPOSURE),
  fall: expose(FALL6,ACTION_EXPOSURE), land: expose(LAND6,ACTION_EXPOSURE), celebrate: expose(CELEBRATE6,ACTION_EXPOSURE),
  nightNight: expose(NIGHT_NIGHT6,ACTION_EXPOSURE), clap: expose(CLAP6,LOOP_EXPOSURE),
} as const;
export type AnimationName = keyof typeof ANIMATIONS;

/** How far above the feet the highest hand reaches, in avatar pixels (for meeting the rim on a dunk). */
export const handReach = (p: Pose) => FOOT - Math.min(p.lH[1], p.rH[1]) - p.body[1];
/** How far above the feet the top of the head is, in avatar pixels. */
export const headTop = (p: Pose) => FOOT - 2 - p.body[1];

// ---------------------------------------------------------------- choosing a frame

export type AnimKind = 'jumper' | 'layup' | 'dunk' | 'ft' | 'pass' | 'rebound' | 'celebrate' | 'nightNight' | 'clap'
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
const frac = (v: number) => ((v % 1) + 1) % 1;
const at16 = (t: number) => Math.max(0, Math.min(15, Math.floor(t * 16)));
// Release/landing must coincide with the recorded ball flight, not an arbitrary
// evenly spaced animation percentage. These are drawing exposure times.
const SHOT_TIMES = [0,.03,.06,.09,.12,.15,.18,.21,.23,.26,.32,.38,.5,.56,.65,.82];
const LAYUP_TIMES = [0,.025,.05,.08,.11,.14,.18,.23,.28,.34,.42,.5,.56,.65,.78,.9];
const DUNK_TIMES = [0,.08,.16,.24,.29,.33,.38,.43,.48,.55,.62,.71,.8,.84,.9,.97];
function actionIndex(name:AnimationName,t:number):number {
  const times=['jumper','stepback','fadeaway'].includes(name)?SHOT_TIMES:['layup','floater'].includes(name)?LAYUP_TIMES:['dunk','alleyOop'].includes(name)?DUNK_TIMES:undefined;
  return times?Math.max(0,times.findLastIndex(cut=>t>=cut)):at16(t);
}
/** Frame ids by animation (two letters, then the frame), so a sprite drawn once is reused everywhere. */
const CODE: Record<AnimationName, string> = {
  idle: 'ID', walk: 'WK', run: 'RN', sprint: 'SP', backpedal: 'BP', slide: 'SL', dribble: 'DB', crossover: 'CX', behindBack: 'BB', spin: 'SN',
  jab: 'JB', pumpFake: 'PF', jumper: 'JS', stepback: 'SB', fadeaway: 'FA', ft: 'FT', layup: 'LU', floater: 'FL', dunk: 'DK', alleyOop: 'AO',
  chestPass: 'CP', bouncePass: 'BO', overheadPass: 'OP', catch: 'CA', rebound: 'RB', block: 'BL', contest: 'CT', steal: 'ST', boxOut: 'BX',
  screen: 'SC', dive: 'DV', charge: 'CH', fall: 'FG', land: 'LD', celebrate: 'CE', nightNight: 'NN', clap: 'CL',
};
const frameOf = (name: AnimationName, i: number) => ({ id: `${CODE[name]}${i}`, pose: ANIMATIONS[name][i] });

/** The pose model and a stable id for this moment of this player's action (`flip` turns him the other way: the spin). */
export function pickFrame(a: AnimInput): { id: string; pose: Pose; flip?: boolean } {
  const i=at16(frac(a.cycle??0));
  if(a.anim){
    const name=a.anim.kind==='pass'?'chestPass':a.anim.kind, index=actionIndex(name,a.anim.t);
    return {...frameOf(name,index), ...(name==='spin'?{flip:index>=6&&index<=10}:{})};
  }
  switch(a.pose){
    case 'shoot': return frameOf('jumper',9);
    case 'reach': return {id:'R',pose:REACH};
    case 'rebound': return frameOf('rebound',7);
    case 'screen': return frameOf('screen',i);
    case 'celebrate': return frameOf('celebrate',8);
    case 'pass': return frameOf('chestPass',8);
    case 'boxout': return frameOf('boxOut',i);
    case 'guard': return frameOf('slide',a.moving||a.onBall||a.gait==='slide'?i:0);
    case 'dribble': case 'run': {
      if(a.carrier||a.pose==='dribble'){
        if(a.moving)return {id:`RD${i}`,pose:RUN_DRIBBLE16[i]};
        return frameOf('dribble',i);
      }
      return frameOf(a.gait??'run',i);
    }
    default: return a.carrier?{id:'RDY',pose:READY}:frameOf('idle',i);
  }
}

/** Kept as an API alias: presentation must expose the authored drawing unchanged. */
export const smoothFrame = pickFrame;

/** Position of the upper hand relative to the sprite's foot anchor. */
export function upperHand(input: Pose, facing: number): P {
  const p = facing < 0 ? mirrorPose(input) : input;
  const h = p.lH[1] === p.rH[1] ? (facing < 0 ? p.lH : p.rH) : p.lH[1] < p.rH[1] ? p.lH : p.rH;
  return [h[0]+p.body[0]+Math.round((p.lean ?? 0)*14/34)-20,
    h[1]+p.body[1]-50];
}

/** The pose for a player facing left: arms and legs mirrored and swapped (the head and jersey are drawn unmirrored). */
export function mirrorPose(p: Pose): Pose {
  const m = (v: P): P => [AV_W - v[0], v[1]];
  return { ...p, body: [-p.body[0], p.body[1]], lToe:-(p.rToe??0),rToe:-(p.lToe??0), lE: m(p.rE), lH: m(p.rH), rE: m(p.lE), rH: m(p.lH), lK: m(p.rK), lF: m(p.rF), rK: m(p.lK), rF: m(p.lF), air: p.air,
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

export type CourtView = 'front' | 'frontLeft' | 'frontRight' | 'left' | 'right' | 'backLeft' | 'backRight' | 'back';
export interface ActionLook { view?: CourtView; playerId: string; primary: string; secondary: string; jerseyNumber?: number | null; age?: number; jerseyStyle?: 'classic' | 'stripe' | 'split'; appearance?: Appearance }

const upperCache = new Map<string, SpriteGrid>();
const lookKey = (l: ActionLook) => `${l.view ?? 'front'}|${l.playerId}|${l.primary}|${l.secondary}|${l.jerseyNumber ?? ''}|${l.age ?? ''}|${l.jerseyStyle ?? ''}|${l.appearance ? JSON.stringify(l.appearance) : ''}`;
/** The avatar without its arms and legs: head, face, hair, headwear, jersey and shorts. */
function upperBody(look: ActionLook): SpriteGrid {
  const key = lookKey(look);
  let g = upperCache.get(key);
  if (!g) {
    if (upperCache.size > 600) upperCache.clear();
    g = buildPlayerGrid({ playerId: look.playerId, primary: look.primary, secondary: look.secondary, jerseyNumber: look.jerseyNumber, age: look.age, jerseyStyle: look.jerseyStyle, appearance: look.appearance, pose: 'none', legs: false });
    if (look.view && look.view !== 'front') g = turnUpperBody(g, look);
    g = athleticGrid(g,0,{traits:playerTraits(look.playerId,look.appearance),view:look.view});
    upperCache.set(key, g);
  }
  return g;
}

/** Directional court-only body views preserve the avatar's hair silhouette, kit and number. */
function turnUpperBody(front: SpriteGrid, look: ActionLook): SpriteGrid {
  const view = look.view!, back = view.startsWith('back'), profile = view === 'left' || view === 'right';
  const side = view.toLowerCase().endsWith('left') ? -1 : view.toLowerCase().endsWith('right') ? 1 : 0;
  const t = playerTraits(look.playerId, look.appearance), source = front.map(row => [...row]);
  if (back) {
    // Cover facial features with the back of the skull, leaving the crown/headwear intact.
    for (let y=11;y<=23;y++) for (let x=11;x<=28;x++) if(source[y][x]) {
      const hair = t.hairStyle !== 'bald' && y < (t.hairStyle.includes('Long') ? 23 : 19);
      source[y][x] = hair ? mix(t.hair, (x+y)%5===0?WHITE:OUTLINE, (x+y)%5===0?.12:x>24?.2:0) : mix(t.skin, OUTLINE, x>24?.22:.06);
    }
    // Higher rear collar and a little nameplate above the number.
    for(let y=24;y<=29;y++)for(let x=16;x<=24;x++)source[y][x]=y===25||y===28?hex(look.secondary,WHITE):hex(look.primary,'#4a5160');
  }
  if(profile){
    // Rebuild a single-eye profile inside the same hair silhouette and skin palette.
    for(let y=12;y<=23;y++)for(let x=11;x<=28;x++){
      if(!source[y][x])continue;
      const backEdge=side>0?x<15:x>25;
      source[y][x]=backEdge&&y<17&&t.hairStyle!=='bald'?mix(t.hair,OUTLINE,.1):mix(t.skin,OUTLINE,backEdge?.18:.03);
    }
    const eye=side>0?23:14;
    for(let x=eye-1;x<=eye+2;x++)source[13][x]=t.hair;
    for(let y=14;y<=15;y++)for(let x=eye;x<=eye+1;x++)source[y][x]=t.eyeColor;
    source[14][eye+(side>0?1:0)]=OUTLINE;source[15][eye+(side>0?1:0)]=OUTLINE;
    const nose=side>0?27:11;source[18][nose]=mix(t.skin,WHITE,.2);source[19][nose]=mix(t.skin,OUTLINE,.2);
    for(let x=eye;x<=eye+2;x++)source[21][x]=t.beardStyle==='none'?mix(t.skin,OUTLINE,.35):t.hair;
    if(t.beardStyle!=='none')for(let x=eye-2;x<=eye+3;x++)source[23][x]=t.hair;
    if(t.goggles)for(let x=eye-1;x<=eye+3;x++){source[14][x]=WHITE;source[17][x]=WHITE;}
  }
  const out: SpriteGrid = Array.from({length:AV_H},()=>Array(AV_W).fill(null));
  for(let y=0;y<AV_H;y++)for(let x=0;x<AV_W;x++){
    const color=source[y][x];if(!color)continue;
    const head=y<24;
    // Compress the side profile while retaining the player's beard and goggles.
    const width=head?(profile?.78:side?.88:1):(profile?.72:side?.9:1);
    const shifted=x;
    const xx=Math.round(20+(shifted-20)*width+(head?side:0));
    if(xx>=0&&xx<AV_W)out[y][xx]=color;
  }
  return out;
}

/** Draws one pose model filled with one player, as run-length SVG paths. `facing` -1 mirrors the pose (not the face). */
export function rasterizePose(input: Pose, look: ActionLook, facing = 1): SpritePath[] {
  let p = facing < 0 ? mirrorPose(input) : input;
  const view=look.view??'front', profile=view==='left'||view==='right', diagonal=view.includes('Left')||view.includes('Right');
  const spread=profile?.28:diagonal?.65:1, stride=profile?1:diagonal?.72:.22;
  if(p.travel){
    const project=(q:P,side:number,arm=false):P=>[20+(q[0]-20)*stride+side*(arm?8:5)*spread,q[1]];
    p={...p,lK:project(p.lK,-1),lF:project(p.lF,-1),rK:project(p.rK,1),rF:project(p.rF,1),
      ...(!p.dribbling?{lE:project(p.lE,-1,true),lH:project(p.lH,-1,true),rE:project(p.rE,1,true),rH:project(p.rH,1,true)}:{})};
  }
  const t = playerTraits(look.playerId, look.appearance);
  const width = SPRITE_W * 2, height = SPRITE_H * 2;
  const grid: SpriteGrid = Array.from({ length: height }, () => Array(width).fill(null));
  const part: number[][] = Array.from({ length: height }, () => Array(width).fill(-1));
  const skinSet = new Set<string>();
  let layer = 0;
  const set = (x: number, y: number, c: string) => {
    const gx = Math.round(x * 2) + PAD_X * 2, gy = Math.round(y * 2) + PAD_TOP * 2;
    if (gx >= 0 && gx < width && gy >= 0 && gy < height) { grid[gy][gx] = c; part[gy][gx] = layer; }
  };
  const seg = (a: P, b: P, w: number, c: string) => {
    const r = w / 2, dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy || 1;
    for (let y = Math.floor((Math.min(a[1], b[1]) - r) * 2) / 2; y <= Math.ceil((Math.max(a[1], b[1]) + r) * 2) / 2; y += .5)
      for (let x = Math.floor((Math.min(a[0], b[0]) - r) * 2) / 2; x <= Math.ceil((Math.max(a[0], b[0]) + r) * 2) / 2; x += .5) {
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

  // Anatomical clusters: a rounded thigh, narrower calf, visible kneecap and ankle.
  const leg = (hip: P, knee: P, foot: P, outer: 1 | -1, toe=0) => {
    const ankle: P = [foot[0], foot[1] - 3];
    seg(hip, knee, 4.6, skinDark);
    seg([hip[0]-.5,hip[1]], [knee[0]-.5,knee[1]],3.6,skin);
    seg(knee, ankle, 3.2, skin);
    seg([hip[0]-.8,hip[1]+1], [knee[0]-.8,knee[1]-1],1.1,skinLight);
    seg([knee[0]+.8,knee[1]+1], [ankle[0]+.7,ankle[1]],.8,skinDark);
    seg([knee[0]-.5,knee[1]], [knee[0]+.5,knee[1]],1,skinLight);
    seg(lerp(knee,ankle,.68),ankle,3.2,WHITE);
    seg(lerp(knee,ankle,.68),lerp(knee,ankle,.72),3.2,trim);
    // Shoe pitch is authored per exposure. The sole and toe box rotate together.
    const angle=toe*Math.PI/180, co=Math.cos(angle),si=Math.sin(angle),direction=facing<0?-1:1;
    for(let y=-3;y<=0;y+=.5)for(let x=-2;x<=4;x+=.5){
      if((x>1.5&&y< -2)||(x>3&&y< -1))continue;
      const c=y>=-.5?WHITE:x< -1?mix(kit,OUTLINE,.35):y<=-2.5?kitLight:(Math.abs(x)<1&&y===-2)?WHITE:(x>2&&y===-1.5)?trim:kit;
      // Rotate about the grounded heel/toe; a planted shoe cannot cut through the floor.
      const pivot=toe*direction>0?4:-2,xx=(x-pivot)*direction;
      set(foot[0]+pivot*direction+xx*co-y*si,foot[1]+xx*si+y*co,c);
    }
    if(!p.air&&toe===0)set(foot[0]+outer*3.5,foot[1],WHITE);
  };
  // Leaning: the upper body shears toward the lean, most at the head. Lying: it pivots flat at the waist.
  const lean = p.lean ?? 0, lie = p.lie ?? 0;
  const shear = (y: number) => Math.round(lean * Math.max(0, 41 - y) / 34 * 2) / 2;
  const place = (x: number, y: number): P => lie ? [20 + bx + lie * (41 - y), 41 + by + Math.round((x - 20) * .5)] : [x + bx + shear(y), y + by];
  layer = 0;
  const hipSpread=p.travel?5*spread:5;
  leg(lie ? [20 + bx, 39 + by] : [20-hipSpread+bx, athleticY(41)+by],p.lK,p.lF,-1,p.lToe);
  leg(lie ? [20 + bx, 43 + by] : [20+hipSpread+bx, athleticY(41)+by],p.rK,p.rF,1,p.rToe);

  const torso=()=>{
    layer=1;
    const up=upperBody(look);
    for(let y=0;y<up.length;y++)for(let x=0;x<up[0].length;x++){
      const c=up[y][x];if(!c)continue;
      const [px,py]=place(x/2,y/2);set(px,py,c);
    }
  };

  // Arms: upper arm, forearm and hand in the avatar's style, a wristband when the avatar has one.
  const arm = (shoulder: P, e: P, h: P, band: boolean, sleeve = false) => {
    // The shoulder rides the lean (or the lying torso); elbows and hands lean with it.
    const sh = lie ? place(shoulder[0] - bx, shoulder[1] - by) : [shoulder[0] + Math.round(lean * 14 / 34), shoulder[1]] as P;
    const lift = lie ? 0 : Math.round(lean * 14 / 34);
    // Lying poses give their elbows and hands on the floor grid, like the knees and feet.
    const E: P = lie ? e : [e[0] + bx + lift, e[1] + by], H: P = lie ? h : [h[0] + bx + lift, h[1] + by];
    seg(sh, E, 4, sleeve ? WHITE : skin);
    seg(E, H, 2.8, sleeve ? WHITE : skin);
    seg([sh[0] - .5, sh[1]], lerp(sh, E, .7), .8, sleeve ? '#c9ccd1' : skinLight);
    seg([E[0] + 1, E[1]], [H[0] + 1, H[1] - .5], .6, sleeve ? '#c9ccd1' : skinDark);
    if (band) { const b = lerp(E, H, .5); seg(b, b, 3.6, trim); }
    seg(H, H, 3.6, skin);
    seg([H[0] - .5, H[1] - 1], [H[0] + .5, H[1] - 1], .5, skinLight);
    set(H[0] + 1, H[1] + .5, skinDark);
  };
  // The far arm goes behind the jersey. The near arm overlaps it naturally.
  const shoulderSpan=p.travel?8*spread:profile?6:8;
  const left=()=>{layer=2;arm([20-shoulderSpan+bx,athleticY(27)+by],p.lE,p.lH,t.seed%3===0,t.sleeve);};
  const right=()=>{layer=3;arm([20+shoulderSpan+bx,athleticY(27)+by],p.rE,p.rH,t.seed%4<2);};
  if(p.travel&&(profile||diagonal)){
    if(view.toLowerCase().endsWith('left')){right();torso();left();}else{left();torso();right();}
  }else{torso();if(p.lH[0]>20&&p.rH[0]>=20){right();left();}else{left();right();}}

  // Inner outlines where a limb in front meets skin behind it (an arm across the face, over the other arm).
  const out = grid.map(row => [...row]);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const c = grid[y][x];
    if (!c || !skinSet.has(c)) continue;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || xx >= width || yy < 0 || yy >= height) continue;
      const n = grid[yy][xx];
      if (n && part[yy][xx] > part[y][x] && part[yy][xx] >= 2 && skinSet.has(n)) { out[y][x] = mix(c, OUTLINE, .75); break; }
    }
  }
  return gridToPaths(outlineGrid(out), .5);
}

// ---------------------------------------------------------------- cache

const cache = new Map<string, SpritePath[]>();
/** One player in one frame (and facing), drawn once and reused. */
export function actionSprite(frameId: string, pose: Pose, look: ActionLook, facing = 1): SpritePath[] {
  const key = `${frameId}|${facing < 0 ? 'L' : 'R'}|${lookKey(look)}`;
  let hit = cache.get(key);
  if (!hit) {
    if (cache.size >= 4000) cache.delete(cache.keys().next().value!);
    hit = rasterizePose(pose, look, facing);
    cache.set(key, hit);
  }
  return hit;
}
