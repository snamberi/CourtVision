import { playerTraits, mix, outlineGrid, gridToPaths, type HairStyle, type BeardStyle, type HatStyle, type SpriteGrid, type SpritePath } from './playerSprite';
import type { ActionLook, Pose } from './actionSprites';

/*
 * CourtVision v2 characters: 44 px tall, slightly cartoonish (a big head on a compact body), drawn from four
 * directions — front, angled (three-quarter), side and back.
 *
 * Nothing new is saved: the player's skin, hair, beard, headwear, eyes and expression all come from playerTraits(), so a
 * v2 character is the same person as his classic avatar. The poses come from the classic animation sheet
 * (actionSprites.ts) and are re-projected for each view, so every court action works in every direction.
 *
 * Coordinates are v2 avatar pixels: 44 × 44, feet on row 43. Poses face right; a player facing left gets a mirrored
 * body, but his jersey number always reads the right way round.
 */

export type CourtView = 'front' | 'angled' | 'side' | 'back';
export const COURT_VIEWS: readonly CourtView[] = ['front', 'angled', 'side', 'back'];

const W = 44, H = 44, FOOT = 43;
const PAD_X = 18, PAD_TOP = 16;
export const CHIBI_SIZE = 44;
export const CHIBI_W = W + PAD_X * 2, CHIBI_H = H + PAD_TOP + 3;
/** The point on the floor under the player, in sprite pixels. */
export const CHIBI_ORIGIN_X = 22 + PAD_X, CHIBI_ORIGIN_Y = FOOT + 1 + PAD_TOP;

const OUTLINE = '#080d19';
const WHITE = '#fff3df';
const SOLE = '#e9edf3';
const DIGITS: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'], '9': ['111', '101', '111', '001', '111'],
};
const hex = (v: string, fallback: string) => /^#[\da-f]{6}$/i.test(v) ? v
  : /^#[\da-f]{3}$/i.test(v) ? '#' + v.slice(1).split('').map(c => c + c).join('') : fallback;

// ---------------------------------------------------------------- the head and body (no arms or legs)

type Grid = (string | null)[][];
const blank = (): Grid => Array.from({ length: H }, () => Array(W).fill(null));
interface Upper { grid: Grid; digits: [number, number][] }

/** Head silhouette by row: [left, right] columns (front, angled and back views). */
const HEAD_ROWS: Record<number, [number, number]> = { 4: [15, 28], 5: [14, 29], 18: [14, 29], 19: [14, 29], 20: [15, 28], 21: [17, 26] };
const headSpan = (y: number): [number, number] | null => y < 4 || y > 21 ? null : HEAD_ROWS[y] ?? [13, 30];
/** Side profile facing right: the back of the skull on the left, nose and chin forward. */
const SIDE_ROWS: Record<number, [number, number]> = { 4: [16, 27], 5: [14, 28], 18: [14, 29], 19: [15, 29], 20: [16, 28], 21: [19, 27] };
const sideSpan = (y: number): [number, number] | null => y < 4 || y > 21 ? null : SIDE_ROWS[y] ?? [13, 29];

interface HairShape { extra: number; bulge: number; front: number; side: number; back: number; bumpy?: boolean; flat?: boolean; strands?: number }
function hairShape(style: HairStyle): HairShape | null {
  switch (style) {
    case 'bald': return null;
    case 'lowFade': case 'buzzCut': return { extra: .4, bulge: 0, front: 6, side: 8, back: 12 };
    case 'medium': case 'mediumWide': return { extra: 2, bulge: style === 'mediumWide' ? 1.6 : 1, front: 8, side: 14, back: 18 };
    case 'shortWide': case 'cropWide': return { extra: 1.6, bulge: 1.2, front: 7, side: 10, back: 14 };
    case 'curlyShort': case 'curlyFade': return { extra: 2, bulge: 1, front: 7, side: style === 'curlyFade' ? 8 : 10, back: 14, bumpy: true };
    case 'curlyMedium': case 'afroSmall': return { extra: 3.5, bulge: 2.5, front: 7, side: 12, back: 16, bumpy: true };
    case 'afroMedium': return { extra: 5, bulge: 4, front: 7, side: 13, back: 17, bumpy: true };
    case 'afroLarge': return { extra: 6.5, bulge: 5.5, front: 7, side: 14, back: 18, bumpy: true };
    case 'afroFlatTop': return { extra: 5, bulge: 3, front: 7, side: 12, back: 16, flat: true };
    case 'highTopFlat': case 'highTopFade': return { extra: 6, bulge: style === 'highTopFlat' ? 1 : 0, front: 7, side: 9, back: 13, flat: true };
    case 'mohawkThin': case 'mohawkThick': case 'mohawkFade': return { extra: 4, bulge: 0, front: 7, side: 7, back: 13 };
    case 'dreadsShort': return { extra: 2, bulge: 1, front: 7, side: 10, back: 14, strands: 6 };
    case 'dreadsMedium': case 'twists': return { extra: 2, bulge: 1, front: 7, side: 10, back: 14, strands: 10 };
    case 'dreadsLong': case 'boxBraids': return { extra: 2, bulge: 1, front: 7, side: 10, back: 14, strands: 16 };
    case 'dreadsPiled': return { extra: 6, bulge: 1, front: 7, side: 10, back: 14, strands: 6 };
    default: return { extra: 1.5, bulge: .5, front: 7, side: 10, back: 14 };
  }
}

function buildUpper(look: ActionLook, view: CourtView): Upper {
  const t = playerTraits(look.playerId, look.appearance);
  const g = blank();
  const digits: [number, number][] = [];
  const set = (x: number, y: number, c: string | null) => { if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = c; };
  const rect = (x: number, y: number, w: number, h: number, c: string | null) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) set(xx, yy, c); };
  const at = (x: number, y: number) => (x >= 0 && x < W && y >= 0 && y < H ? g[y][x] : null);

  const skin = t.skin, skinLight = mix(skin, '#ffe9cb', .28), skinDark = mix(skin, '#542c30', .32), skinDeep = mix(skin, '#351c29', .55);
  const blush = mix(skin, '#e8705f', .3);
  const hair = t.hair, hairLight = mix(hair, '#b4acc0', .32), hairDark = mix(hair, OUTLINE, .4);
  const kit = hex(look.primary, '#4a5160'), trim = hex(look.secondary, '#c9ccd1');
  const kitLight = mix(kit, WHITE, .22), kitDark = mix(kit, OUTLINE, .4), trimLight = mix(trim, WHITE, .4);
  const front = view === 'front', side = view === 'side', angled = view === 'angled', back = view === 'back';

  // ---- shorts and jersey
  const [jl, jr] = side ? [17, 26] : [15, 28];
  rect(jl - 1, 31, jr - jl + 3, 5, kit);
  rect(jl - 1, 31, jr - jl + 3, 1, trim);
  rect(jl - 1, 35, jr - jl + 3, 1, trim);
  if (!side) { rect(21, 34, 2, 2, null); rect(jl - 1, 32, 1, 3, trim); rect(jr + 1, 32, 1, 3, trim); rect(jl, 32, 2, 2, kitLight); rect(jr - 1, 32, 2, 3, kitDark); }
  else { rect(21, 32, 1, 3, trim); rect(jr, 32, 2, 3, kitDark); }
  rect(jl, 22, jr - jl + 1, 9, kit);
  rect(jl, 23, 1, 8, kitLight);
  rect(jr - 1, 23, 2, 8, kitDark);
  if (!side) {
    // Tank straps and armholes, a V (front) or round (back) collar.
    rect(jl, 22, 3, 1, trim); rect(jr - 2, 22, 3, 1, trim);
    rect(jl, 23, 1, 2, trim); rect(jr, 23, 1, 2, trim);
    if (back) { rect(19, 22, 6, 1, trim); }
    else {
      const cx = angled ? 23 : 21;
      rect(cx - 1, 22, 4, 1, skinDark); rect(cx, 23, 2, 1, skinDark); rect(cx - 2, 22, 1, 1, trim); rect(cx + 3, 22, 1, 1, trim); rect(cx - 1, 23, 1, 1, trim); rect(cx + 2, 23, 1, 1, trim); rect(cx, 24, 2, 1, trim);
    }
    if (look.jerseyStyle === 'stripe') rect(jl + 1, 29, jr - jl - 1, 1, trim);
    if (look.jerseyStyle === 'split') rect(angled ? 24 : 22, 25, 1, 6, trim);
    if (angled) rect(jl, 23, 2, 8, kitDark); // the far side turns away
  } else {
    rect(jl, 22, jr - jl + 1, 1, trim);
    rect(jr - 3, 23, 2, 1, skinDark);
    rect(21, 23, 1, 8, trim);
  }
  rect(jl, 30, jr - jl + 1, 1, kitDark);

  // The number (front, angled, back); drawn last by the rasterizer so it is never mirrored.
  if (!side && look.jerseyNumber != null && Number.isFinite(look.jerseyNumber)) {
    const n = String(Math.max(0, Math.min(99, Math.round(look.jerseyNumber))));
    const top = back ? 24 : 25;
    const start = (angled ? 23 : 22) - (n.length === 1 ? 1 : 4);
    for (let i = 0; i < n.length; i++) DIGITS[n[i]].forEach((row, y) => [...row].forEach((b, x) => { if (b === '1') digits.push([start + i * 4 + x, top + y]); }));
  }

  // ---- head
  const span = side ? sideSpan : headSpan;
  for (let y = 4; y <= 21; y++) { const s = span(y)!; rect(s[0], y, s[1] - s[0] + 1, 1, skin); }
  // Neck under the chin.
  rect(19, 21, 6, 1, skinDark);
  if (side) { rect(30, 14, 1, 2, skin); rect(30, 16, 1, 1, skinDark); } // nose
  // Light from the upper left; the jaw and far side in shade.
  for (let y = 6; y <= 13; y++) { const s = span(y)!; set(s[0] + 1, y, skinLight); }
  for (let y = 7; y <= 19; y++) { const s = span(y)!; set(s[1], y, skinDark); if (!side) set(s[1] - 1, y, y > 16 ? skinDark : at(s[1] - 1, y)!); }
  rect(17, 20, 10, 1, skinDark);
  // Ears.
  const ear = (x: number) => { rect(x, 12, 2, 4, skin); set(x + (x < 22 ? 0 : 1), 13, skinDark); set(x + (x < 22 ? 0 : 1), 14, skinDark); };
  if (front || back) { ear(11); ear(31); }
  else if (angled) ear(12);
  else { rect(18, 11, 3, 5, skinDark); rect(19, 12, 1, 3, skin); }

  // ---- face
  const eyeRows = t.eyeStyle === 'relaxed' ? [12, 14] : t.eyeStyle === 'wide' ? [10, 14] : [11, 14];
  const eye = (x: number, w: number, lookRight: boolean) => {
    for (let y = eyeRows[0]; y <= eyeRows[1]; y++) rect(x, y, w, 1, WHITE);
    const ix = lookRight ? x + w - 2 : x;
    rect(ix, eyeRows[0] + 1, 2, eyeRows[1] - eyeRows[0], t.eyeColor);
    rect(lookRight ? ix + 1 : ix, eyeRows[0] + 1, 1, eyeRows[1] - eyeRows[0], OUTLINE);
    set(lookRight ? ix + 1 : ix, eyeRows[0] + 1, WHITE);
    rect(x, eyeRows[0] - 1, w, 1, OUTLINE);
    rect(x, eyeRows[1] + 1, w, 1, skinDark);
  };
  const brow = (x: number, w: number, inner: number) => {
    rect(x, 9, w, 1, hairDark);
    if (t.eyeStyle === 'focused') set(inner, 10, hairDark);
  };
  const mouth = (x: number, w: number) => {
    if (t.expression === 'grin') { rect(x, 18, w, 1, WHITE); rect(x, 19, w, 1, skinDeep); set(x - 1, 17, skinDeep); set(x + w, 17, skinDeep); }
    else if (t.expression === 'smile') { rect(x, 18, w, 1, skinDeep); set(x - 1, 17, skinDeep); set(x + w, 17, skinDeep); rect(x + 1, 19, w - 2, 1, skinLight); }
    else if (t.expression === 'determined') { rect(x, 18, w, 1, skinDeep); set(x - 1, 19, skinDeep); set(x + w, 19, skinDeep); }
    else rect(x + 1, 18, w - 2, 1, skinDeep);
  };
  if (front) {
    eye(15, 4, false); eye(25, 4, true);
    brow(15, 4, 18); brow(25, 4, 25);
    rect(21, 15, 2, 1, skinLight); rect(21, 16, 2, 1, skinDark);
    rect(15, 16, 2, 1, blush); rect(27, 16, 2, 1, blush);
    mouth(19, 6);
  } else if (angled) {
    eye(18, 4, true); eye(26, 3, true);
    brow(18, 4, 21); brow(26, 3, 26);
    rect(28, 15, 2, 2, skinDark); set(28, 15, skinLight); set(30, 16, skinDark);
    rect(18, 16, 2, 1, blush);
    mouth(23, 5);
  } else if (side) {
    eye(26, 3, true);
    brow(25, 4, 26);
    rect(23, 16, 2, 1, blush);
    rect(26, 18, 3, 1, skinDeep);
    if (t.expression === 'smile' || t.expression === 'grin') set(25, 17, skinDeep);
  }

  // ---- facial hair (not on the back of the head)
  const beard = t.beardStyle;
  if (!back && beard !== 'none') drawBeard(beard, view, rect, set, skin, hair, hairLight, hairDark);
  if (!back && t.beardStyle !== 'none' && !/stubble|chinstrap|thinLine|mutton|soulPatch/.test(beard)) {
    // Redraw the mouth inside the beard so the face stays readable.
    if (front) rect(20, 18, 4, 1, skinDeep); else if (angled) rect(24, 18, 3, 1, skinDeep); else rect(27, 18, 2, 1, skinDeep);
  }

  // ---- hair
  const shape = hairShape(t.hairStyle);
  if (shape) {
    const cx = side ? 20.5 : 21.5, rx = 9.5 + shape.bulge, ry = 7.5 + shape.extra, cy = 11.5;
    const limit = (x: number) => {
      // Where the hair stops, by column and view: a hairline at the face, sideburns, and lower at the back.
      if (back) return shape.back;
      if (front) return x <= 14 || x >= 29 ? shape.side : x <= 15 || x >= 28 ? shape.side - 2 : shape.front;
      if (angled) return x <= 15 ? shape.back - 2 : x <= 18 ? shape.side : x >= 30 ? shape.side - 1 : shape.front;
      return x <= 17 ? shape.back : x <= 21 ? shape.side + 1 : x <= 23 ? shape.side - 1 : shape.front; // side, facing right
    };
    const flatTop = Math.round(cy - ry) + 1;
    for (let y = 0; y < 26; y++) for (let x = 0; x < W; x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      const inCap = y <= cy && dx * dx + dy * dy <= 1;
      const s = span(y);
      const onHead = !!s && x >= s[0] - (shape.bulge > 1 ? Math.round(shape.bulge) : 0) && x <= s[1] + (shape.bulge > 1 ? Math.round(shape.bulge) : 0);
      if (!(inCap || onHead)) continue;
      if (y > limit(x)) continue;
      if (shape.flat && y < flatTop) continue;
      if (shape.bumpy && inCap && dx * dx + dy * dy > .78 && (x * 2 + y * 3) % 5 < 2) continue;
      if (side && x >= 30) continue;
      set(x, y, hair);
    }
    if (shape.flat) for (let x = 0; x < W; x++) if (g[flatTop]?.[x] === hair) set(x, flatTop, hairLight);
    const style = t.hairStyle;
    if (style.startsWith('mohawk')) {
      // Shave the sides back to skin (a shadow of stubble), keep a crest.
      const [c0, c1] = side ? [14, 27] : style === 'mohawkThick' ? [18, 25] : [19, 24];
      for (let y = 0; y < 26; y++) for (let x = 0; x < W; x++) if (g[y][x] === hair && (side ? y > 8 + (x < 18 ? 2 : 0) : x < c0 || x > c1)) {
        g[y][x] = y < 4 ? null : style === 'mohawkFade' ? mix(skin, hair, .45) : skinDark;
      }
      if (side) for (let x = c0; x <= c1; x++) set(x, x % 3 === 0 ? 1 : 0, null);
    }
    if (style === 'cornrows') for (let y = 2; y < 16; y++) for (let x = 0; x < W; x++) if (g[y][x] === hair && (back || side ? y % 3 === 0 : x % 3 === 0)) g[y][x] = skinDark;
    if (style === 'waves') for (let y = 2; y < 16; y++) for (let x = 0; x < W; x++) if (g[y][x] === hair && (x + y * 2) % 5 === 0) g[y][x] = hairLight;
    if (style === 'sidePart' && !back) { const px = side ? 22 : angled ? 21 : 18; for (let y = 3; y < 8; y++) if (g[y][px] === hair) g[y][px] = skinDark; }
    if (style === 'lowFade') for (let y = 0; y < 26; y++) for (let x = 0; x < W; x++) if (g[y][x] === hair && y >= 6) g[y][x] = mix(skin, hair, .55);
    if (style === 'dreadsPiled') { rect(17, 0, 10, 3, hair); rect(19, 0, 5, 1, hairLight); }
    if (shape.strands) {
      const len = shape.strands;
      const xs = back ? [12, 15, 18, 21, 24, 27, 30] : front ? [11, 31] : angled ? [11, 14] : [13, 16, 19];
      for (const x of xs) {
        const top = 8;
        const bottom = Math.min(30, (back ? 12 : 10) + len - ((x * 7) % 3));
        for (let y = top; y <= bottom; y++) { set(x, y, (y + x) % 4 === 0 ? hairLight : hair); set(x + 1, y, hairDark); }
        if (t.hairStyle === 'boxBraids') set(x, bottom, trimLight);
      }
      if (front) { rect(12, 9, 2, 6, hair); rect(30, 9, 2, 6, hair); }
    }
    // Texture: broken highlights on the upper left, shade on the far side.
    for (let y = 0; y < 26; y++) for (let x = 0; x < W; x++) {
      if (g[y][x] !== hair) continue;
      if ((x * 3 + y * 7 + t.seed) % 11 < 2 && x < 26 && y < 8) g[y][x] = hairLight;
      else if (x > (side ? 25 : 27)) g[y][x] = hairDark;
    }
  }
  if (look.age != null && look.age >= 36) {
    const gray = look.age >= 43 ? '#c6bec4' : '#a79caa';
    for (let y = 8; y < 16; y++) for (const x of [13, 14, 29, 30]) if ([hair, hairDark, hairLight].includes(g[y][x] ?? '')) set(x, y, gray);
  }

  // ---- headwear
  drawHat(t.hatStyle, t.hatColor, view, rect, skin);

  // ---- goggles
  if (t.goggles && !back) {
    if (front) { rect(12, 10, 20, 1, OUTLINE); for (const x of [14, 24]) { rect(x, 10, 6, 6, OUTLINE); rect(x + 1, 11, 4, 4, '#9fd3e6'); set(x + 1, 11, WHITE); } }
    else if (angled) { rect(12, 10, 19, 1, OUTLINE); rect(17, 10, 6, 6, OUTLINE); rect(18, 11, 4, 4, '#9fd3e6'); rect(25, 10, 5, 6, OUTLINE); rect(26, 11, 3, 4, '#9fd3e6'); }
    else { rect(14, 11, 12, 1, OUTLINE); rect(25, 10, 5, 6, OUTLINE); rect(26, 11, 3, 4, '#9fd3e6'); }
  }
  // A small earring on one ear for some players (a stable trait).
  if (t.seed % 6 === 0 && (front || back)) set(11, 16, '#ffd166');

  return { grid: g, digits };
}

type RectFn = (x: number, y: number, w: number, h: number, c: string | null) => void;
type SetFn = (x: number, y: number, c: string | null) => void;

function drawBeard(beard: BeardStyle, view: CourtView, rect: RectFn, set: SetFn, skin: string, hair: string, hairLight: string, hairDark: string) {
  const front = view === 'front', side = view === 'side';
  // Jaw columns by view: [left, right] at the chin.
  const [l, r] = front ? [14, 29] : side ? [20, 29] : [16, 30];
  const mx = front ? 19 : side ? 26 : 23, mw = front ? 6 : side ? 3 : 5; // mouth
  if (beard.startsWith('stubble')) {
    const c = mix(skin, hair, beard === 'stubbleFull' ? .45 : .32);
    for (let y = 17; y <= 21; y++) for (let x = l; x <= r; x++) if ((x * 2 + y) % 3 === 0 && !(y === 18 && x >= mx && x < mx + mw)) set(x, y, c);
    return;
  }
  if (beard === 'mustache' || beard === 'mustacheThick') { rect(mx - 1, 17, mw + 2, beard === 'mustacheThick' ? 1 : 1, hair); if (beard === 'mustacheThick') { set(mx - 1, 18, hair); set(mx + mw, 18, hair); } return; }
  if (beard === 'soulPatch') { rect(mx + Math.floor(mw / 2) - 1, 20, 2, 1, hair); return; }
  if (['goatee', 'goateeWide', 'vandyke', 'circleBeard', 'anchor', 'balboa'].includes(beard)) {
    const w = beard === 'goateeWide' || beard === 'circleBeard' ? mw + 2 : mw;
    rect(mx + (mw - w) / 2, 19, w, 3, hair);
    rect(mx + (mw - w) / 2, 21, w, 1, hairDark);
    if (beard !== 'goatee' && beard !== 'goateeWide') rect(mx - 1, 17, mw + 2, 1, hair);
    if (beard === 'circleBeard') { set(mx - 1, 18, hair); set(mx + mw, 18, hair); }
    set(mx + 1, 19, hairLight);
    return;
  }
  if (beard === 'chinstrap' || beard === 'chinstrapThick' || beard === 'thinLine') {
    const thick = beard === 'chinstrapThick' ? 2 : 1;
    if (!side) rect(l - (front ? 1 : 0), 13, thick, 6, hair);
    rect(r - thick + 1, 13, thick, 6, hair);
    rect(l + 1, 20, r - l - 1, thick, hair);
    return;
  }
  if (beard === 'mutton') {
    if (!side) rect(l - (front ? 1 : 0), 12, 3, 7, hair);
    rect(r - 2, 12, 3, 7, hair);
    return;
  }
  // Full beards: sideburns into a jaw band, a moustache, longer styles grow down over the collar.
  const long = /Long|lumberjack|fullMedium/.test(beard), xl = /XL|LongWide/.test(beard);
  if (!side) rect(l - (front ? 1 : 0), 12, 2, 7, hair);
  rect(r - 1, 12, 2, 7, hair);
  rect(l, 18, r - l + 1, 4, hair);
  rect(l + 2, 22, r - l - 3, long ? (xl ? 4 : 3) : 1, hair);
  if (beard !== 'shortBoxed') rect(mx - 1, 17, mw + 2, 1, hair);
  rect(l, 20, 2, 2, hairLight);
  rect(r - 2, 19, 2, 3, hairDark);
  if (long) rect(l + 3, 23, r - l - 5, 1, hairDark);
}

function drawHat(style: HatStyle | null, color: string, view: CourtView, rect: RectFn, skin: string) {
  if (!style) return;
  const light = mix(color, WHITE, .35), dark = mix(color, OUTLINE, .4);
  const side = view === 'side', back = view === 'back', front = view === 'front';
  const [l, r] = side ? [13, 29] : [13, 30];
  if (style === 'headband' || style === 'headbandWide' || style === 'visor') {
    const top = style === 'headbandWide' ? 6 : 7;
    rect(l, top, r - l + 1, 9 - top, color);
    rect(l + 1, top, r - l - 1, 1, light);
    if (style === 'visor' && !back) { if (front) { rect(l + 1, 9, r - l - 1, 1, dark); } else rect(26, 9, 8, 1, dark); }
    return;
  }
  // Caps and beanies cover the crown down to the brow.
  const top = style.startsWith('beanie') ? 0 : 2;
  for (let y = top; y <= 8; y++) {
    const half = y < 4 ? 6 + (y - top) * 1.4 : 9;
    const cx = side ? 21 : 21.5;
    rect(Math.ceil(cx - half), y, Math.floor(half * 2) + 1, 1, color);
  }
  rect(l, 8, r - l + 1, 1, dark);
  rect(16, top + 1, 3, 3, light);
  if (style === 'beanieCuffed') { rect(l, 6, r - l + 1, 3, light); rect(l, 8, r - l + 1, 1, dark); }
  if (style === 'skullCap') rect(l + 1, 7, r - l - 1, 1, light);
  if (style === 'beanie') { rect(20, top - 1 < 0 ? 0 : top - 1, 4, 1, light); }
  if (style === 'cap') {
    if (front) { rect(12, 9, 20, 1, dark); rect(13, 8, 18, 1, color); }
    else if (view === 'angled') rect(23, 8, 10, 2, dark);
    else if (side) rect(25, 8, 10, 2, dark);
  }
  if (style === 'capBack') {
    if (side) rect(8, 8, 8, 2, dark); else if (view === 'angled') rect(9, 8, 7, 2, dark); else if (back) { rect(15, 7, 14, 2, dark); }
    if (front) rect(19, 7, 6, 2, skin);
  }
  if (style === 'bucket') { rect(10, 8, 24, 2, color); rect(10, 9, 24, 1, dark); }
  if (style === 'durag') {
    if (side) { rect(11, 8, 3, 3, dark); rect(11, 11, 2, 9, color); }
    else if (back) { rect(20, 8, 4, 12, color); rect(21, 8, 2, 12, dark); }
    else if (view === 'angled') { rect(11, 9, 2, 8, color); }
  }
}

const upperCache = new Map<string, Upper>();
const lookKey = (l: ActionLook) => `${l.playerId}|${l.primary}|${l.secondary}|${l.jerseyNumber ?? ''}|${l.age ?? ''}|${l.jerseyStyle ?? ''}|${l.appearance ? JSON.stringify(l.appearance) : ''}`;
function upper(look: ActionLook, view: CourtView): Upper {
  const key = `${view}|${lookKey(look)}`;
  let u = upperCache.get(key);
  if (!u) {
    if (upperCache.size > 800) upperCache.clear();
    u = buildUpper(look, view);
    upperCache.set(key, u);
  }
  return u;
}

// ---------------------------------------------------------------- projecting the classic poses into each view

type P = readonly [number, number];
type V = [number, number];
/** Shoulders and hips per view (facing right; the near side is his right). */
const JOINTS: Record<CourtView, { lS: V; rS: V; lHip: V; rHip: V }> = {
  front: { lS: [15, 24], rS: [28, 24], lHip: [18, 35], rHip: [25, 35] },
  back: { lS: [15, 24], rS: [28, 24], lHip: [18, 35], rHip: [25, 35] },
  angled: { lS: [16, 24], rS: [27, 24], lHip: [19, 35], rHip: [25, 35] },
  side: { lS: [20, 24], rS: [23, 24], lHip: [20, 35], rHip: [23, 35] },
};
/** How much of the classic sprite's sideways spread each view keeps, and how a forward reach reads (toward camera in front views). */
const LENS: Record<CourtView, { lat: number; fwd: number; rise: number }> = {
  front: { lat: 1, fwd: .3, rise: .3 }, back: { lat: 1, fwd: .3, rise: .3 }, angled: { lat: .6, fwd: .7, rise: .12 }, side: { lat: .12, fwd: 1, rise: 0 },
};
const OLD = { lS: [11, 27] as P, rS: [29, 27] as P, lHip: [15, 41] as P, rHip: [25, 41] as P };
const REST = { lE: -3, lH: -5, rE: 3, rH: 5, lK: -1, lF: -1, rK: 1, rF: 1 };
const ARM_K = .85;

interface Projected { body: V; lean: number; lie: number; air: boolean; lS: V; rS: V; lE: V; lH: V; rE: V; rH: V; lHip: V; rHip: V; lK: V; lF: V; rK: V; rF: V }
/** A classic pose (40 × 52, facing right) in v2 pixels for one view, still facing right. */
export function projectPose(p: Pose, view: CourtView): Projected {
  const J = JOINTS[view], L = LENS[view];
  const body: V = [Math.round(p.body[0] * .85), Math.round(p.body[1] * .85)];
  const lie = p.lie ?? 0;
  const abs = (q: P): V => [22 + (q[0] - 20) * .85, FOOT - (49 - q[1]) * .85];
  const limb = (q: P, from: P, to: V, rest: number, k: number): V => {
    if (lie) return abs(q);
    const fwd = q[0] - from[0] - rest;
    return [to[0] + body[0] + (rest * L.lat + fwd * L.fwd) * k, to[1] + body[1] + (q[1] - from[1]) * k - Math.abs(fwd) * L.rise * k];
  };
  const lHip: V = lie ? [22 + body[0], 32 + body[1]] : [J.lHip[0] + body[0], J.lHip[1] + body[1]];
  const rHip: V = lie ? [22 + body[0], 36 + body[1]] : [J.rHip[0] + body[0], J.rHip[1] + body[1]];
  // Legs stand on the floor: knees and feet are floor coordinates, not moved by the body shift.
  const leg = (q: P, hip: P, to: V, rest: number): V => {
    if (lie) return abs(q);
    const fwd = q[0] - hip[0] - rest;
    return [to[0] + rest * L.lat + fwd * L.fwd, to[1] + (q[1] - hip[1]) - Math.abs(fwd) * L.rise * .5];
  };
  return {
    body, lean: Math.round((p.lean ?? 0) * .85), lie, air: !!p.air,
    lS: J.lS, rS: J.rS,
    lE: limb(p.lE, OLD.lS, J.lS, REST.lE, ARM_K), lH: limb(p.lH, OLD.lS, J.lS, REST.lH, ARM_K),
    rE: limb(p.rE, OLD.rS, J.rS, REST.rE, ARM_K), rH: limb(p.rH, OLD.rS, J.rS, REST.rH, ARM_K),
    lHip, rHip,
    lK: leg(p.lK, OLD.lHip, J.lHip, REST.lK), lF: leg(p.lF, OLD.lHip, J.lHip, REST.lF),
    rK: leg(p.rK, OLD.rHip, J.rHip, REST.rK), rF: leg(p.rF, OLD.rHip, J.rHip, REST.rF),
  };
}

/** How far above the feet the highest hand reaches, in v2 pixels (for meeting the rim on a dunk). */
export function chibiHandReach(p: Pose, view: CourtView = 'side'): number {
  const q = projectPose(p, view);
  return FOOT - Math.min(q.lH[1], q.rH[1]);
}
/** How far above the feet the top of the head is, in v2 pixels. */
export const chibiHeadTop = (p: Pose) => FOOT - 4 - Math.round(p.body[1] * .85);

// ---------------------------------------------------------------- the rasterizer

/** Draws one pose for one player from one direction, as run-length SVG paths. `facing` -1 turns him to the left. */
export function rasterizeChibi(pose: Pose, look: ActionLook, view: CourtView = 'side', facing = 1): SpritePath[] {
  const t = playerTraits(look.playerId, look.appearance);
  const q = projectPose(pose, view);
  const left = facing < 0;
  const grid: SpriteGrid = Array.from({ length: CHIBI_H }, () => Array(CHIBI_W).fill(null));
  const part: number[][] = Array.from({ length: CHIBI_H }, () => Array(CHIBI_W).fill(-1));
  const skinSet = new Set<string>();
  let layer = 0;
  // Facing left mirrors the whole figure about its centre column (the number is put back the right way round below).
  const mx = (x: number) => left ? 43 - x : x;
  const set = (x: number, y: number, c: string) => {
    const gx = Math.round(mx(x)) + PAD_X, gy = Math.round(y) + PAD_TOP;
    if (gx >= 0 && gx < CHIBI_W && gy >= 0 && gy < CHIBI_H) { grid[gy][gx] = c; part[gy][gx] = layer; }
  };
  const seg = (a: V, b: V, w: number, c: string) => {
    const r = w / 2, dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy || 1;
    for (let y = Math.floor(Math.min(a[1], b[1]) - r); y <= Math.ceil(Math.max(a[1], b[1]) + r); y++)
      for (let x = Math.floor(Math.min(a[0], b[0]) - r); x <= Math.ceil(Math.max(a[0], b[0]) + r); x++) {
        const u = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / len2));
        const ex = a[0] + dx * u - x, ey = a[1] + dy * u - y;
        if (ex * ex + ey * ey <= r * r) set(x, y, c);
      }
  };
  const lerp = (a: V, b: V, u: number): V => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];

  const skin = t.skin, skinLight = mix(skin, '#ffe9cb', .28), skinDark = mix(skin, '#542c30', .32), skinFar = mix(skin, '#542c30', .22);
  const kit = hex(look.primary, '#4a5160'), trim = hex(look.secondary, '#c9ccd1'), kitLight = mix(kit, WHITE, .22), kitDark = mix(kit, OUTLINE, .4);
  for (const c of [skin, skinLight, skinDark, skinFar]) skinSet.add(c);
  const [bx, by] = q.body;
  const lean = q.lean, lie = q.lie;
  const shear = (y: number) => Math.round(lean * Math.max(0, 34 - y) / 30);
  const place = (x: number, y: number): V => lie ? [22 + bx + lie * (33 - y), 33 + by + Math.round((x - 22) * .5)] : [x + bx + shear(y), y + by];

  // Poses are projected facing right, so his right side is nearer the camera; the mirror handles facing left.
  const profile = view === 'side' || view === 'angled';

  // Legs: skin, a white sock with a trim band, a two-tone high-top with a white sole that points the way he faces.
  const leg = (hip: V, knee: V, foot: V, far: boolean) => {
    const sk = far && profile ? skinFar : skin;
    const ankle: V = [foot[0], foot[1] - 2];
    seg(hip, knee, 4, sk);
    seg(knee, ankle, 4, sk);
    if (!far) seg(lerp(hip, knee, .3), lerp(knee, ankle, .6), 1, skinDark);
    seg([ankle[0], ankle[1] - 2], ankle, 4, WHITE);
    seg([ankle[0] - 1.5, ankle[1] - 2], [ankle[0] + 1.5, ankle[1] - 2], 1, trim);
    const fx = Math.round(foot[0]), fy = Math.round(foot[1]);
    const shoe = far && profile ? kitDark : kit;
    const [x0, x1] = view === 'front' || view === 'back' ? [-2, 2] : view === 'angled' ? [-2, 3] : [-2, 4];
    for (let x = x0; x <= x1; x++) for (let y = -2; y <= 0; y++) {
      const c = y === 0 ? SOLE : y === -2 && x <= 0 ? (far ? shoe : kitLight) : x === x1 - 1 && y === -1 && view !== 'back' ? WHITE : shoe;
      set(fx + x, fy + y, c);
    }
  };
  const legs = () => {
    if (profile) { layer = 0; leg(q.lHip, q.lK, q.lF, true); layer = 1; leg(q.rHip, q.rK, q.rF, false); }
    else { layer = 1; leg(q.lHip, q.lK, q.lF, false); leg(q.rHip, q.rK, q.rF, false); }
  };

  // Arms: upper arm, forearm and a round hand; a wristband or the shooting sleeve when he wears one.
  const arm = (shoulder: V, e: V, h: V, band: boolean, sleeve: boolean, far: boolean) => {
    const sh = lie ? place(shoulder[0], shoulder[1]) : [shoulder[0] + bx + shear(24), shoulder[1] + by] as V;
    const lift = lie ? 0 : shear(24) - shear(34);
    const E: V = [e[0] + lift, e[1]], Hd: V = [h[0] + lift, h[1]];
    const sk = far && profile ? skinFar : skin;
    seg(sh, E, 3.6, sleeve ? WHITE : sk);
    seg(E, Hd, 3.4, sleeve ? WHITE : sk);
    if (!far && !sleeve) seg(sh, lerp(sh, E, .6), 1, skinLight);
    if (band && !sleeve) { const b = lerp(E, Hd, .55); seg(b, b, 3.2, trim); }
    seg(Hd, Hd, 4, sk);
    if (!far) set(Hd[0] - 1, Hd[1] - 1, skinLight);
  };
  const leftArm = (far: boolean) => arm(q.lS, q.lE, q.lH, t.seed % 3 === 0, t.sleeve, far);
  const rightArm = (far: boolean) => arm(q.rS, q.rE, q.rH, t.seed % 4 < 2, false, far);

  // The head and body from the cached view, shifted, leaned or laid down with the pose.
  const u = upper(look, view);
  const torso = () => {
    layer = 2;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = u.grid[y][x];
      if (!c) continue;
      const [px, py] = place(x, y);
      set(px, py, c);
    }
  };

  if (view === 'side') {
    layer = 0; leftArm(true);
    legs();
    torso();
    layer = 3; rightArm(false);
  } else if (view === 'angled') {
    layer = 0; leftArm(true);
    legs();
    torso();
    layer = 3; rightArm(false);
  } else if (view === 'back') {
    // From behind, arms in front of the chest are hidden by the body; raised arms show.
    const raised = (h: V) => h[1] < 24;
    legs();
    layer = 0; if (!raised(q.lH)) leftArm(false); if (!raised(q.rH)) rightArm(false);
    torso();
    layer = 3; if (raised(q.lH)) leftArm(false); if (raised(q.rH)) rightArm(false);
  } else {
    legs();
    torso();
    // The arm crossing in front of the body is drawn last.
    const leftFront = q.lH[0] > 22 && q.rH[0] >= 22;
    layer = 3;
    if (leftFront) { rightArm(false); layer = 4; leftArm(false); } else { leftArm(false); layer = 4; rightArm(false); }
  }

  // The jersey number, placed with the body but never mirrored.
  if (u.digits.length && !lie) {
    const placed = u.digits.map(([x, y]) => place(x, y));
    const minX = Math.min(...placed.map(p => p[0])), maxX = Math.max(...placed.map(p => p[0]));
    for (const [x, y] of placed) {
      const gx = (left ? (43 - maxX) + (x - minX) : x) + PAD_X, gy = y + PAD_TOP;
      if (gx >= 0 && gx < CHIBI_W && gy >= 0 && gy < CHIBI_H) grid[gy][gx] = WHITE;
    }
  }

  // Inner outlines where a limb in front meets skin behind it.
  const out = grid.map(row => [...row]);
  for (let y = 0; y < CHIBI_H; y++) for (let x = 0; x < CHIBI_W; x++) {
    const c = grid[y][x];
    if (!c || !skinSet.has(c)) continue;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || xx >= CHIBI_W || yy < 0 || yy >= CHIBI_H) continue;
      const n = grid[yy][xx];
      if (n && part[yy][xx] > part[y][x] && part[yy][xx] >= 3 && skinSet.has(n)) { out[y][x] = mix(c, OUTLINE, .7); break; }
    }
  }
  return gridToPaths(outlineGrid(out));
}

const cache = new Map<string, SpritePath[]>();
/** One player in one frame, view and facing, drawn once and reused. */
export function chibiSprite(frameId: string, pose: Pose, look: ActionLook, view: CourtView = 'side', facing = 1): SpritePath[] {
  const key = `${frameId}|${view}|${facing < 0 ? 'L' : 'R'}|${lookKey(look)}`;
  let hit = cache.get(key);
  if (!hit) {
    if (cache.size > 5000) cache.clear();
    hit = rasterizeChibi(pose, look, view, facing);
    cache.set(key, hit);
  }
  return hit;
}

// ---------------------------------------------------------------- which way he is seen from

export interface ViewInput { vx?: number; vy?: number; pose: string; anim?: { kind: string; t: number } }
/** Actions that read best in profile: shots at the rim and passes go toward a basket or a teammate along the court. */
const PROFILE_ANIMS = new Set(['jumper', 'layup', 'dunk', 'ft', 'stepback', 'fadeaway', 'floater', 'alleyOop', 'chestPass', 'bouncePass', 'overheadPass', 'pass', 'dive', 'charge', 'fall', 'steal']);
/**
 * The direction to draw a player from: moving down the screen he is seen from the front, up the screen from the back,
 * along it in profile, and on a diagonal (or standing, guarding, waiting) at an angle. `prev` adds hysteresis so a
 * player running near a boundary does not flicker between two views.
 */
export function courtView(a: ViewInput, prev?: CourtView): CourtView {
  if (a.anim && PROFILE_ANIMS.has(a.anim.kind)) return 'side';
  const vx = a.vx ?? 0, vy = a.vy ?? 0, speed = Math.hypot(vx, vy);
  if (speed < 30) return a.pose === 'shoot' || a.pose === 'pass' ? 'side' : 'angled';
  const angle = Math.atan2(Math.abs(vy), Math.abs(vx)) * 180 / Math.PI; // 0 = along the court, 90 = toward/away from camera
  const slack = prev ? 6 : 0;
  const vertical = vy > 0 ? 'front' : 'back';
  const pick = (deg: number): CourtView => deg >= 62 ? vertical : deg >= 28 ? (vy > 0 ? 'angled' : 'side') : 'side';
  const now = pick(angle);
  if (prev && prev !== now && (pick(angle + slack) === prev || pick(angle - slack) === prev)) return prev;
  return now;
}
