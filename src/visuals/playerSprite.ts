/** Code-native, 40 × 52 pixel characters with a half-pixel detail layer. No image requests or saved-data changes.
 * Keep the original ID hash and trait order: existing players retain their skin,
 * hair, beard and headwear choices while receiving the more detailed artwork.
 */
import { likenessOf } from './likeness';

export const SPRITE_WIDTH = 40;
export const SPRITE_HEIGHT = 52;
export const PORTRAIT_VIEWBOX = '8 1 24 30';

export const HAIR_STYLES = [
  'bald', 'lowFade', 'buzzCut', 'short', 'shortWide', 'crop', 'cropWide',
  'medium', 'mediumWide', 'curlyShort', 'curlyMedium', 'afroSmall',
  'afroMedium', 'afroLarge', 'afroFlatTop', 'mohawkThin', 'mohawkThick',
  'mohawkFade', 'highTopFlat', 'highTopFade', 'cornrows', 'dreadsShort',
  'dreadsMedium', 'dreadsLong', 'dreadsPiled',
  'waves', 'sidePart', 'slickBack', 'undercut', 'curlyFade', 'twists', 'boxBraids',
] as const;
export const BEARD_STYLES = [
  'none', 'stubbleLight', 'stubbleFull', 'soulPatch', 'goatee', 'goateeWide',
  'vandyke', 'mustache', 'mustacheThick', 'chinstrap', 'chinstrapThick',
  'shortBoxed', 'shortRound', 'fullShort', 'fullMedium', 'fullWide',
  'fullLong', 'fullLongWide', 'lumberjack', 'lumberjackXL', 'circleBeard',
  'balboa', 'mutton', 'anchor', 'thinLine',
] as const;
export const HAT_STYLES = ['beanie', 'beanieCuffed', 'skullCap', 'cap', 'capBack', 'bucket', 'headband', 'headbandWide', 'durag', 'visor'] as const;
export const SKIN_TONES = ['#f2c9a0', '#d9a066', '#c68a5a', '#8d5a34', '#5c3a21', '#ffe0bd', '#a86b3c', '#3d2616'];
export const HAIR_COLORS = ['#0b0b0b', '#2b1a10', '#5a3a1a', '#b8860b', '#6b6b6b', '#8a3a1a', '#d8b25a', '#e8e4d8', '#f4f4f4', '#963b63', '#375eaa', '#67449c'];
export const HAT_COLORS = ['#c8102e', '#1d428a', '#007a33', '#f2a900', '#111111', '#6b21a8', '#f4f0e6', '#ed742e', '#249596', '#dc7fa0'];
export const EYE_COLORS = ['#563921', '#273549', '#467387', '#58724b', '#9b783e', '#656a76'];
export const EYE_STYLES = ['steady', 'focused', 'relaxed', 'wide'] as const;
export const EXPRESSIONS = ['smile', 'neutral', 'grin', 'determined'] as const;
const OUTLINE = '#080d19';
const WHITE = '#fff3df';
const DIGITS: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'], '9': ['111', '101', '111', '001', '111'],
};

export function hashPlayerId(value: string): number {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return hash >>> 0;
}

export type HairStyle = typeof HAIR_STYLES[number];
export type BeardStyle = typeof BEARD_STYLES[number];
export type HatStyle = typeof HAT_STYLES[number];
/** A player's look chosen in Edit Player; anything left out keeps the look his id gives him. Colours are palette indexes. */
export interface Appearance { skin?: number; hairStyle?: HairStyle; hairColor?: number; beardStyle?: BeardStyle; hatStyle?: HatStyle | 'none'; hatColor?: number;
  eyeColor?: number; eyeStyle?: typeof EYE_STYLES[number]; expression?: typeof EXPRESSIONS[number];
  /** Any skin or hair colour as #rrggbb (the profile character's fantasy colours); wins over the palette index. */
  skinHex?: string; hairHex?: string; hatHex?: string;
  /** Protective goggles (Kareem, Worthy, Horace Grant) and a shooting sleeve on the left arm (Iverson, Melo). */
  goggles?: boolean; sleeve?: boolean }

const isHex = (v: string | undefined): boolean => !!v && /^#[\da-f]{6}$/i.test(v);
const pick = <T,>(list: readonly T[], i: number | undefined, fallback: T): T => (i != null && Number.isInteger(i) && i >= 0 && i < list.length ? list[i] : fallback);
export function playerTraits(playerId: string, own?: Appearance) {
  const seed = hashPlayerId(playerId);
  const base = {
    seed,
    // Original palette sizes are intentional: new options must not reroll existing identities.
    skin: SKIN_TONES[seed % 5],
    hair: HAIR_COLORS[Math.floor(seed / 7) % 5],
    hairStyle: HAIR_STYLES[Math.floor(seed / 13) % 25] as HairStyle,
    beardStyle: (seed % 100 < 40 ? 'none' : BEARD_STYLES[1 + (Math.floor(seed / 17) % (BEARD_STYLES.length - 1))]) as BeardStyle,
    hatStyle: (Math.floor(seed / 100) % 100 < 78 ? null : HAT_STYLES[Math.floor(seed / 19) % HAT_STYLES.length]) as HatStyle | null,
    hatColor: HAT_COLORS[Math.floor(seed / 23) % 6],
    eyeColor: EYE_COLORS[Math.floor(seed / 29) % EYE_COLORS.length],
    eyeStyle: EYE_STYLES[Math.floor(seed / 31) % EYE_STYLES.length],
    expression: EXPRESSIONS[Math.floor(seed / 37) % EXPRESSIONS.length],
    goggles: false,
    sleeve: false,
  };
  // Real players look like themselves (visuals/likeness.ts); a look saved in this league goes on top.
  const real = likenessOf(playerId);
  return applyLook(real ? applyLook(base, real) : base, own);
}
type Traits = { seed: number; skin: string; hair: string; hairStyle: HairStyle; beardStyle: BeardStyle; hatStyle: HatStyle | null; hatColor: string; eyeColor: string; eyeStyle: typeof EYE_STYLES[number]; expression: typeof EXPRESSIONS[number]; goggles: boolean; sleeve: boolean };
/** A look's valid choices over the traits below it; anything invalid or missing keeps what was there. */
function applyLook<T extends Traits>(base: T, look?: Appearance): T {
  if (!look) return base;
  return {
    ...base,
    skin: isHex(look.skinHex) ? look.skinHex! : pick(SKIN_TONES, look.skin, base.skin),
    hair: isHex(look.hairHex) ? look.hairHex! : pick(HAIR_COLORS, look.hairColor, base.hair),
    hairStyle: look.hairStyle && HAIR_STYLES.includes(look.hairStyle) ? look.hairStyle : base.hairStyle,
    beardStyle: look.beardStyle && BEARD_STYLES.includes(look.beardStyle) ? look.beardStyle : base.beardStyle,
    hatStyle: look.hatStyle === 'none' ? null : look.hatStyle && HAT_STYLES.includes(look.hatStyle) ? look.hatStyle : base.hatStyle,
    hatColor: isHex(look.hatHex) ? look.hatHex! : pick(HAT_COLORS, look.hatColor, base.hatColor),
    eyeColor: pick(EYE_COLORS, look.eyeColor, base.eyeColor),
    eyeStyle: look.eyeStyle && EYE_STYLES.includes(look.eyeStyle) ? look.eyeStyle : base.eyeStyle,
    expression: look.expression && EXPRESSIONS.includes(look.expression) ? look.expression : base.expression,
    goggles: look.goggles ?? base.goggles,
    sleeve: look.sleeve ?? base.sleeve,
  };
}

/** Normalize custom kit colors before generating shades; invalid imports stay renderable. */
function hexColor(value: string, fallback: string): string {
  if (/^#[\da-f]{6}$/i.test(value)) return value;
  if (/^#[\da-f]{3}$/i.test(value)) return '#' + value.slice(1).split('').map((v) => v + v).join('');
  return fallback;
}

export function mix(a: string, b: string, amount: number): string {
  const channels = [1, 3, 5].map((i) => Math.round(
    parseInt(a.slice(i, i + 2), 16) * (1 - amount) + parseInt(b.slice(i, i + 2), 16) * amount,
  ));
  return '#' + channels.map((n) => n.toString(16).padStart(2, '0')).join('');
}

export interface SpriteOptions {
  playerId: string;
  jerseyStyle?: 'classic' | 'stripe' | 'split';
  primary: string;
  secondary: string;
  jerseyNumber?: number | null;
  age?: number;
  /** 'raise': both arms up (celebrations, holding a trophy overhead); 'none': no arms (the court animations draw their own). */
  pose?: 'stand' | 'raise' | 'none';
  /** false: no legs or shoes (the court animations draw their own). */
  legs?: boolean;
  appearance?: Appearance;
}
export interface SpritePath { fill: string; d: string }

/** Rasterize the layers, then batch horizontal runs by color into a small SVG path set. */
export function buildPlayerSprite(opts: SpriteOptions): SpritePath[] {
  return detailedSpritePaths(outlineGrid(buildPlayerGrid(opts)));
}

export type SpriteGrid = (string | null)[][];
/** The avatar as a colour grid (no outline yet): the court animations reuse its head, face, hair and jersey. */
export function buildPlayerGrid({ playerId, primary, secondary, jerseyNumber, age, jerseyStyle, pose, legs = true, appearance }: SpriteOptions): SpriteGrid {
  const t = playerTraits(playerId, appearance);
  const grid: (string | null)[][] = Array.from({ length: SPRITE_HEIGHT }, () => Array(SPRITE_WIDTH).fill(null));
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    for (let yy = Math.max(0, y); yy < Math.min(SPRITE_HEIGHT, y + h); yy++)
      for (let xx = Math.max(0, x); xx < Math.min(SPRITE_WIDTH, x + w); xx++) grid[yy][xx] = color;
  };
  const skin = t.skin;
  const skinLight = mix(skin, '#ffe9cb', 0.25);
  const skinDark = mix(skin, '#542c30', 0.35);
  const skinDeep = mix(skin, '#351c29', 0.55);
  const hair = t.hair;
  const hairLight = mix(hair, '#a8a0b4', 0.3);
  const hairDark = mix(hair, OUTLINE, 0.4);
  const kit = hexColor(primary, '#4a5160');
  const trim = hexColor(secondary, '#c9ccd1');
  const kitLight = mix(kit, WHITE, 0.23);
  const kitDark = mix(kit, OUTLINE, 0.45);
  const trimLight = mix(trim, WHITE, 0.4);
  const trimDark = mix(trim, OUTLINE, 0.3);

  // Legs, separate sock cuffs, ankle shading, high-top sneakers and two-tone soles.
  if (legs) {
  for (const x of [12, 23]) {
    rect(x, 39, 5, 8, skin);
    rect(x + 3, 40, 2, 5, skinDark);
    rect(x, 43, 5, 4, WHITE);
    rect(x, 43, 5, 1, trim);
    rect(x + 3, 44, 2, 3, '#abb5c6');
    rect(x - 1, 47, 7, 3, OUTLINE);
    rect(x - 1, 46, 7, 3, kit);
    rect(x - 1, 46, 3, 2, kitLight);
    rect(x + 1, 46, 3, 1, WHITE);
    rect(x + 3, 47, 2, 1, trimLight);
    rect(x - 1, 49, 7, 1, WHITE);
    rect(x + 4, 49, 1, 1, '#a4aec1');
  }
  rect(10, 48, 3, 1, trim);
  rect(28, 48, 3, 1, trim);
  rect(10, 49, 2, 1, WHITE);
  rect(29, 49, 2, 1, WHITE);
  }

  // Arms have angled, stepped silhouettes. Accessories are stable ID traits.
  if (pose === 'raise') {
    // Both arms straight up beside the head, hands open at the top (holding a trophy overhead).
    for (const [x, light, dark] of [[8, 8, 11], [28, 28, 31]] as const) {
      rect(x, 9, 4, 19, skin);
      rect(light, 9, 1, 19, skinLight);
      rect(dark, 9, 1, 19, skinDark);
      rect(x - 1, 4, 6, 5, skin);
      rect(x - 1, 4, 6, 1, skinLight);
      rect(x, 15, 4, 2, trim);
    }
  } else if (pose !== 'none') {
  rect(9, 26, 4, 7, skin);
  rect(7, 29, 4, 5, skin);
  rect(4, 31, 5, 4, skin);
  rect(3, 33, 3, 3, skinDark);
  rect(9, 26, 3, 2, skinLight);
  rect(5, 31, 4, 1, skinLight);
  rect(7, 34, 2, 1, skinDeep);
  rect(27, 26, 4, 7, skinDark);
  rect(29, 29, 4, 5, skin);
  rect(31, 32, 5, 4, skin);
  rect(34, 35, 2, 2, skinDark);
  rect(32, 32, 3, 1, skinLight);
  rect(27, 27, 2, 4, skin);
  if (t.seed % 3 === 0) {
    rect(9, 28, 3, 5, kitDark);
    rect(9, 28, 2, 4, kitLight);
    rect(8, 31, 3, 2, trim);
  } else {
    rect(7, 31, 3, 2, trim);
    rect(7, 31, 2, 1, trimLight);
  }
  if (t.seed % 4 < 2) {
    rect(30, 32, 3, 2, trim);
    rect(30, 32, 3, 1, trimLight);
  }
  }

  // Uniform: armholes, side panels, neckline, chest fold, waistband and shorts.
  rect(12, 25, 16, 14, kit);
  rect(12, 26, 2, 12, trimDark);
  rect(14, 27, 2, 10, kitLight);
  rect(25, 26, 3, 12, kitDark);
  rect(27, 28, 1, 9, trim);
  rect(11, 25, 5, 2, trim);
  rect(24, 25, 5, 2, trim);
  rect(12, 25, 3, 1, trimLight);
  rect(24, 25, 3, 1, trimLight);
  rect(16, 24, 8, 4, OUTLINE);
  rect(17, 24, 6, 3, skinDark);
  rect(18, 24, 3, 2, skin);
  rect(17, 27, 6, 1, trimLight);
  rect(18, 28, 4, 1, trim);
  rect(17, 29, 3, 1, kitLight);
  rect(12, 38, 16, 2, OUTLINE);
  rect(13, 38, 14, 1, trim);
  rect(12, 40, 7, 3, kit);
  rect(21, 40, 7, 3, kit);
  rect(14, 40, 3, 2, kitLight);
  rect(25, 40, 3, 2, kitDark);
  rect(12, 42, 7, 1, trim);
  rect(21, 42, 7, 1, trim);
  rect(12, 40, 2, 2, trimDark);
  rect(26, 40, 2, 2, trimDark);
  // Sewn panels, shoulder piping, a small chest patch and fabric folds.
  rect(13, 28, 1, 9, trimLight);
  rect(24, 34, 1, 3, kitLight);
  rect(22, 36, 3, 1, kitDark);
  rect(15, 36, 3, 1, kitDark);
  rect(24, 28, 2, 2, trim);
  rect(24, 28, 1, 1, WHITE);
  rect(18, 38, 4, 1, trimLight);
  rect(19, 39, 1, 2, WHITE);
  rect(21, 39, 1, 1, WHITE);

  if (jerseyStyle === 'stripe') rect(14, 30, 12, 3, trim);
  if (jerseyStyle === 'split') rect(21, 29, 5, 8, trim);

  // One-pixel digits remain legible at 2×/3×/4×, including two-digit numbers.
  if (jerseyNumber != null && Number.isFinite(jerseyNumber)) {
    const number = String(Math.max(0, Math.min(99, Math.round(jerseyNumber))));
    const start = number.length === 1 ? 18 : 16;
    for (let i = 0; i < number.length; i++) {
      DIGITS[number[i]].forEach((row, y) => [...row].forEach((bit, x) => {
        if (bit === '1') rect(start + i * 4 + x, 31 + y, 1, 1, WHITE);
      }));
    }
  }

  // Head and ears: generous face area with a directional light, not a mirrored mask.
  rect(13, 7, 14, 16, skin);
  rect(11, 10, 18, 11, skin);
  rect(12, 20, 16, 2, skin);
  rect(15, 22, 10, 2, skinDark);
  rect(11, 10, 2, 10, skinLight);
  rect(13, 9, 11, 2, skinLight);
  rect(26, 11, 3, 9, skinDark);
  rect(25, 20, 3, 2, skinDark);
  rect(14, 21, 4, 1, skinLight);
  rect(9, 14, 2, 5, skinDark);
  rect(9, 14, 2, 3, skin);
  rect(29, 14, 2, 5, skinDeep);
  rect(29, 15, 1, 2, skin);

  // Eyes: white sclera, dark iris, a small light catch; brows and nose give expression.
  const eyeY = 14 + (t.seed % 7 === 0 ? 1 : 0);
  const eyeH = t.eyeStyle === 'wide' ? 4 : t.eyeStyle === 'relaxed' ? 2 : 3;
  for (const x of [13, 23]) {
    rect(x, eyeY - 2, 4, 1, hairDark);
    rect(x, eyeY, 4, eyeH, WHITE);
    rect(x + 2, eyeY, 2, eyeH, t.eyeColor);
    rect(x + 3, eyeY + 1, 1, eyeH - 1, OUTLINE);
    rect(x + 2, eyeY, 1, 1, '#dae2dc');
    rect(x, eyeY + eyeH, 4, 1, skinDark);
  }
  if (t.eyeStyle === 'focused') { rect(16, eyeY - 1, 2, 1, hairDark); rect(22, eyeY - 1, 2, 1, hairDark); }
  rect(18, 13, 1, 3, skinLight);
  rect(20, 16, 2, 3, skinDark);
  rect(19, 18, 2, 1, skinLight);
  rect(13, 19, 2, 1, skinLight);
  rect(23, 19, 3, 1, skinLight);
  rect(21, 18, 1, 1, skinDeep);

  // Facial hair stays inside the jaw. Full styles layer around a readable mouth.
  const beard = t.beardStyle;
  if (beard !== 'none') {
    if (beard.startsWith('stubble')) {
      for (let x = 14; x < 27; x += 2) rect(x, 21 + x % 3, 1, 1, mix(skin, hair, 0.5));
    } else if (beard === 'mustache' || beard === 'mustacheThick') {
      rect(17, 19, 7, beard === 'mustacheThick' ? 2 : 1, hair);
    } else if (beard === 'soulPatch') rect(19, 22, 3, 1, hair);
    else if (['goatee', 'goateeWide', 'vandyke', 'circleBeard', 'anchor', 'balboa'].includes(beard)) {
      rect(18, 21, beard === 'goateeWide' ? 6 : 4, 3, hair);
      if (beard !== 'goatee' && beard !== 'goateeWide') rect(17, 19, 7, 1, hair);
      rect(18, 23, 2, 1, hairLight);
    } else {
      rect(12, 19, 3, 2, hair);
      rect(25, 19, 3, 2, hairDark);
      if (beard !== 'mutton') {
        const long = /Long|lumberjack|fullMedium/.test(beard);
        rect(14, 21, 12, long ? 4 : 2, hair);
        rect(16, 23, 8, long ? 3 : 1, hairDark);
        rect(14, 21, 2, 2, hairLight);
        if (!/chinstrap|thinLine/.test(beard)) rect(16, 19, 9, 1, hair);
      }
    }
  }
  rect(17, 20, 7, 1, skinDeep);
  if (t.expression === 'grin') { rect(18, 20, 5, 1, WHITE); rect(18, 21, 5, 1, skinDeep); }
  else if (t.expression === 'smile') { rect(18, 20, 5, 1, WHITE); rect(19, 22, 3, 1, skinLight); }
  else if (t.expression === 'determined') { rect(17, 20, 2, 1, skin); rect(22, 20, 2, 1, skin); rect(18, 21, 5, 1, skinDeep); }
  else rect(19, 21, 3, 1, skinLight);

  // Hair silhouettes are individually built and shaded, with texture only on hair pixels.
  const style = t.hairStyle;
  const h = (x: number, y: number, w: number, height: number) => rect(x, y, w, height, hair);
  if (style !== 'bald') {
    if (style === 'waves') {
      h(13, 6, 14, 4); h(11, 9, 2, 4); h(27, 9, 2, 4);
      for (let x = 13; x < 27; x += 4) { rect(x, 7, 2, 1, hairLight); rect(x + 1, 9, 2, 1, hairLight); }
    } else if (style === 'sidePart' || style === 'slickBack' || style === 'undercut') {
      h(13, 4, 14, 6); h(11, 7, 18, 3);
      h(11, 10, 2, style === 'undercut' ? 1 : 3); h(27, 10, 2, 2);
      for (let x = 14; x < 27; x += 3) rect(x, 5, 1, 3, hairLight);
      if (style === 'sidePart') { rect(24, 5, 1, 5, skinDark); h(14, 9, 9, 2); }
    } else if (style === 'twists' || style === 'boxBraids') {
      h(12, 5, 16, 5);
      for (let x = 10; x <= 28; x += 3) {
        h(x, 5 + x % 2, 2, x < 14 || x > 25 ? (style === 'boxBraids' ? 16 : 9) : 5);
        rect(x, 7, 1, 2, hairLight);
        if (style === 'boxBraids' && (x < 14 || x > 25)) rect(x, 18, 2, 1, trimLight);
      }
    } else if (style === 'curlyFade') {
      h(12, 5, 16, 6); h(14, 3, 12, 3);
      for (let x = 12; x < 28; x += 3) { h(x, 4 + x % 2, 2, 3); rect(x, 7, 1, 1, hairLight); }
      rect(11, 11, 2, 2, mix(skin, hair, .5)); rect(27, 11, 2, 2, mix(skin, hair, .5));
    } else if (['lowFade', 'buzzCut'].includes(style)) {
      h(13, 7, 14, style === 'buzzCut' ? 3 : 1);
      h(11, 10, 2, 3); h(27, 10, 2, 3);
    } else if (style.startsWith('afro') || style.startsWith('curly')) {
      const large = ['afroMedium', 'afroLarge', 'afroFlatTop'].includes(style);
      const top = large ? 2 : style === 'curlyShort' ? 6 : 4;
      h(11, top + 2, 18, 8 - top); h(13, top, 14, 3);
      h(9, top + 4, 4, 7); h(27, top + 4, 4, 7);
      for (let x = 12; x < 29; x += 4) h(x, top - (x % 3 === 0 && style !== 'afroFlatTop' ? 1 : 0), 3, 3);
    } else if (style.startsWith('mohawk')) {
      h(style === 'mohawkThick' ? 17 : 18, 2, style === 'mohawkThick' ? 6 : 4, 10);
      if (style === 'mohawkFade') { h(11, 10, 2, 2); h(27, 10, 2, 2); }
    } else if (style.startsWith('highTop')) {
      h(14, 2, 12, 8); h(12, 7, 16, 4);
      if (style === 'highTopFlat') { h(12, 3, 2, 4); h(26, 3, 2, 4); }
    } else if (style === 'cornrows') {
      h(12, 7, 16, 4);
      for (let x = 13; x < 28; x += 3) rect(x, 7, 1, 4, skinDark);
      h(11, 10, 2, 4); h(27, 10, 2, 4);
    } else if (style.startsWith('dreads')) {
      const top = style === 'dreadsShort' ? 6 : 4;
      h(12, top, 16, 7);
      for (let x = 10; x < 30; x += 4) h(x, top + 2, 3, x < 14 || x > 25 ? (style === 'dreadsLong' ? 15 : 8) : 5 + x % 3);
      if (style === 'dreadsPiled') { h(16, 2, 10, 3); h(19, 1, 4, 2); }
    } else {
      const medium = style.startsWith('medium');
      const crop = style.startsWith('crop');
      const top = medium ? 3 : crop ? 5 : 6;
      h(13, top, 14, 10 - top); h(11, top + 2, 18, 8 - top);
      h(11, 10, 2, medium ? 5 : 2); h(27, 10, 2, medium ? 4 : 2);
      if (style.endsWith('Wide')) { h(10, top + 3, 2, 4); h(28, top + 3, 2, 4); }
      h(14, 9, crop ? 11 : 6, 2);
    }
    // Broken highlights follow the silhouette and never draw outside it.
    for (let y = 1; y < 18; y++) for (let x = 9; x < 32; x++) {
      if (grid[y][x] !== hair) continue;
      if ((x * 3 + y * 7 + t.seed) % 11 < 2 && x < 27) grid[y][x] = hairLight;
      else if (x > 25 || (x + y) % 9 === 0) grid[y][x] = hairDark;
    }
  }

  drawHat(rect, t.hatStyle, t.hatColor, skin);

  // Goggles: a strap and two tinted lenses over the eyes.
  if (t.goggles) {
    rect(10, eyeY - 1, 20, 1, OUTLINE);
    for (const x of [12, 22]) { rect(x, eyeY - 1, 6, eyeH + 2, OUTLINE); rect(x + 1, eyeY, 4, eyeH, '#9fd3e6'); rect(x + 1, eyeY, 1, 1, WHITE); }
    rect(18, eyeY, 4, 1, OUTLINE);
  }
  // A shooting sleeve from the shoulder to the wrist on the left arm (standing pose).
  if (t.sleeve && pose !== 'raise' && pose !== 'none') {
    rect(9, 26, 4, 7, WHITE); rect(7, 29, 4, 5, WHITE); rect(4, 31, 5, 3, WHITE);
    rect(9, 26, 1, 7, '#c9ccd1'); rect(7, 33, 4, 1, '#c9ccd1');
  }

  if (age != null && age >= 36) {
    const gray = age >= 43 ? '#c6bec4' : '#a79caa';
    for (const x of [11, 27]) for (let y = 11; y < 15; y++)
      if ([hair, hairDark, hairLight].includes(grid[y][x] ?? '')) rect(x, y, 1, 1, gray);
    if (age >= 40) { rect(12, 18, 2, 1, skinDark); rect(26, 18, 2, 1, skinDeep); }
  }
  if (t.seed % 6 === 0) { rect(9, 18, 1, 2, '#ffd166'); rect(9, 18, 1, 1, WHITE); }

  return grid;
}

/** Hats sit over the crown while exposed curls/dreads remain visible at the sides (the profile character draws them over its own hair). */
export function drawHat(rect: (x: number, y: number, w: number, h: number, color: string) => void, style: HatStyle | null, hatColor: string, skin: string): void {
  const hat = style;
  const hatLight = mix(hatColor, WHITE, 0.35);
  const hatDark = mix(hatColor, OUTLINE, 0.4);
  if (hat === 'headband' || hat === 'headbandWide' || hat === 'visor') {
    rect(11, 10, 18, hat === 'headbandWide' ? 3 : 2, hatColor);
    rect(12, 10, 16, 1, hatLight);
    if (hat === 'visor') rect(23, 12, 9, 1, hatDark);
  } else if (hat) {
    const top = hat.startsWith('beanie') ? 3 : 5;
    rect(13, top, 14, 7 - top, hatColor);
    rect(11, top + 2, 18, 10 - top - 2, hatColor);
    rect(11, 9, 18, 2, hatDark);
    rect(13, top + 1, 3, 7 - top, hatLight);
    rect(26, top + 2, 3, 8 - top, hatDark);
    if (hat === 'cap' || hat === 'bucket') rect(hat === 'bucket' ? 9 : 19, 11, hat === 'bucket' ? 22 : 13, 2, hatColor);
    if (hat === 'capBack') { rect(8, 11, 9, 2, hatDark); rect(18, 9, 4, 2, skin); }
    if (hat === 'beanieCuffed') { rect(10, 9, 20, 3, hatLight); rect(22, 10, 3, 2, hatDark); }
    if (hat === 'durag') { rect(28, 11, 3, 3, hatDark); rect(29, 13, 2, 6, hatColor); }
    if (hat === 'skullCap') rect(12, 10, 16, 1, hatLight);
  }
}

/** A one-pixel outline follows the final silhouette, including fingers and hair. */
export function outlineGrid(grid: SpriteGrid): SpriteGrid {
  const H = grid.length, W = grid[0]?.length ?? 0;
  const outlined = grid.map((row) => [...row]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!grid[y][x]) continue;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && xx < W && yy >= 0 && yy < H && !grid[yy][xx]) outlined[yy][xx] = OUTLINE;
    }
  }
  return outlined;
}

/** Batches horizontal runs by colour into a small SVG path set. */
export function gridToPaths(outlined: SpriteGrid, pixel = 1): SpritePath[] {
  const H = outlined.length, W = outlined[0]?.length ?? 0;
  const paths = new Map<string, string[]>();
  for (let y = 0; y < H; y++) for (let x = 0; x < W;) {
    const fill = outlined[y][x];
    if (!fill) { x++; continue; }
    let end = x + 1;
    while (end < W && outlined[y][end] === fill) end++;
    const runs = paths.get(fill) ?? [];
    runs.push(`M${x * pixel} ${y * pixel}h${(end - x) * pixel}v${pixel}h-${(end - x) * pixel}z`);
    paths.set(fill, runs);
    x = end;
  }
  return [...paths].map(([fill, runs]) => ({ fill, d: runs.join('') }));
}

/** Half-pixel material edges add definition at portrait size without changing the
 * logical grid, silhouette, animation anchors, or saved appearance. No blur/noise.
 * One extra shade per colour keeps SVGs batched and the palette deliberately small. */
export function detailedSpritePaths(grid: SpriteGrid): SpritePath[] {
  const H = grid.length, W = grid[0]?.length ?? 0;
  const detail: SpriteGrid = Array.from({ length: H * 2 }, () => Array(W * 2).fill(null));
  const shades = new Map<string, string>();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = grid[y][x];
    if (!c) continue;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) detail[y * 2 + dy][x * 2 + dx] = c;
    // Leave ink, eyes and isolated single-pixel embroidery crisp.
    if (c === OUTLINE || !/^#[\da-f]{6}$/i.test(c)) continue;
    const sameRight = grid[y][x + 1] === c, sameBelow = grid[y + 1]?.[x] === c;
    if (grid[y - 1]?.[x] !== c && sameRight && sameBelow) {
      let light = shades.get(c);
      if (!light) { light = mix(c, WHITE, .18); shades.set(c, light); }
      detail[y * 2][x * 2] = light;
      detail[y * 2][x * 2 + 1] = light;
    }
  }
  return gridToPaths(detail, .5);
}
