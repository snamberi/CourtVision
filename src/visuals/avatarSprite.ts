import { buildPlayerGrid, outlineGrid, detailedSpritePaths, gridToPaths, drawHat, mix, HAIR_STYLES, BEARD_STYLES, HAT_STYLES, type SpriteGrid, type SpritePath, type HairStyle, type BeardStyle, type HatStyle } from './playerSprite';
import { teamColors } from '../simulation/teamColors';
import { SKINS, HAIR_COLORS, SHOES, RAINBOW, outfitDef, colorHex, type AvatarLook, type Outfit } from '../profile/avatar';

/*
 * Draws the profile character (src/profile/avatar.ts) on the same 40 × 52 pixel body as every player, then dresses it:
 * outfit, shoes, new hair and beards, headwear, eyewear, neck and back pieces, and an aura around the outline. The
 * finished grid has a 3-pixel margin for the aura (46 × 58).
 */

export const AVATAR_PAD = 3;
export const AVATAR_W = 40 + AVATAR_PAD * 2;
export const AVATAR_H = 52 + AVATAR_PAD * 2;
/** The head and shoulders, in the padded grid. */
export const AVATAR_PORTRAIT_VIEWBOX = `${8 + AVATAR_PAD - 2} ${AVATAR_PAD - 2} 28 32`;
/** A fixed body seed: steady eyes, a smile, no earring. */
const BODY_ID = 'cv-you-4';
const OUTLINE = '#080d19';
const WHITE = '#fff3df';
/** Stand-ins for rainbow skin and hair, recoloured row by row at the end. */
const SKIN_KEY = '#fe01fe', HAIR_KEY = '#01fefe';

type Rect = (x: number, y: number, w: number, h: number, c: string) => void;
interface Shade { c: string; l: string; d: string }
const shade = (c: string): Shade => ({ c, l: mix(c, WHITE, 0.25), d: mix(c, OUTLINE, 0.4) });

export interface AvatarOptions { look: AvatarLook; /** Your favourite team's colours for "Your team" pieces. */ team?: { primary: string; secondary: string } | null }
export interface AvatarSprite { paths: SpritePath[]; aura: SpritePath[]; auraKind: string }

// ---------------------------------------------------------------- the body parts

function torso(r: Rect, s: Shade) {
  r(12, 25, 4, 13, s.c); r(24, 25, 4, 13, s.c); r(16, 27, 8, 11, s.c);
  r(11, 25, 5, 2, s.c); r(24, 25, 5, 2, s.c);
  r(14, 27, 2, 10, s.l); r(25, 26, 3, 12, s.d);
  r(16, 27, 8, 1, s.d);
}
function longSleeves(r: Rect, s: Shade) { r(9, 26, 4, 6, s.c); r(7, 29, 4, 3, s.c); r(9, 26, 2, 3, s.l); r(27, 26, 4, 6, s.d); r(29, 29, 4, 3, s.c); r(7, 31, 3, 1, s.d); r(30, 31, 3, 1, s.d); }
function shortSleeves(r: Rect, s: Shade) { r(9, 26, 4, 3, s.c); r(9, 26, 2, 2, s.l); r(27, 26, 4, 3, s.d); }
function pants(r: Rect, s: Shade) {
  r(12, 38, 16, 3, s.c); r(12, 41, 6, 5, s.c); r(22, 41, 6, 5, s.c);
  r(16, 41, 2, 5, s.d); r(26, 41, 2, 5, s.d); r(12, 38, 16, 1, s.d); r(13, 41, 2, 4, s.l);
}
/** A coat's skirt to the knees, open in the middle. */
function coatSkirt(r: Rect, s: Shade, inner: string) { r(11, 38, 18, 7, s.c); r(18, 38, 4, 7, inner); r(11, 44, 18, 1, s.d); r(26, 38, 3, 7, s.d); }

function drawOutfit(r: Rect, o: Outfit, team: { primary: string; secondary: string }, skin: Shade) {
  const main = shade(team.primary), trim = shade(team.secondary);
  const white = shade('#f4f6fa'), black = shade('#161a24'), gold = '#ffd166';
  switch (o.kind) {
    case 'jersey': return; // the body's own uniform, in these colours
    case 'tee': torso(r, main); shortSleeves(r, main); pants(r, trim); return;
    case 'hoodie':
      torso(r, main); longSleeves(r, main); pants(r, trim);
      r(12, 23, 4, 3, main.d); r(24, 23, 4, 3, main.d); r(15, 32, 10, 4, main.d); r(16, 33, 8, 2, main.c);
      r(18, 28, 1, 3, WHITE); r(21, 28, 1, 3, WHITE); return;
    case 'track':
      torso(r, main); longSleeves(r, main); pants(r, main);
      r(12, 26, 1, 12, trim.c); r(27, 26, 1, 12, trim.c); r(9, 27, 1, 5, trim.c); r(30, 27, 1, 5, trim.c);
      r(20, 28, 1, 10, trim.l); r(12, 41, 1, 5, trim.c); r(27, 41, 1, 5, trim.c); return;
    case 'suit': case 'tux': {
      torso(r, main); longSleeves(r, main); pants(r, main);
      r(18, 27, 4, 9, WHITE); r(17, 27, 1, 8, main.d); r(22, 27, 1, 8, main.d);
      if (o.kind === 'suit') r(19, 28, 2, 7, trim.c); else { r(17, 27, 6, 2, black.c); r(19, 27, 2, 2, black.l); }
      r(20, 36, 1, 1, main.l); return;
    }
    case 'varsity':
      torso(r, main); longSleeves(r, trim); pants(r, shade('#3b5b8f'));
      r(21, 29, 4, 5, trim.c); r(22, 30, 2, 3, main.c); r(12, 36, 16, 1, trim.c); r(20, 28, 1, 8, trim.d); return;
    case 'overalls':
      torso(r, trim); shortSleeves(r, trim); pants(r, main);
      r(15, 29, 10, 9, main.c); r(15, 25, 2, 4, main.c); r(23, 25, 2, 4, main.c); r(16, 30, 1, 1, gold); r(23, 30, 1, 1, gold); r(18, 31, 4, 3, main.d); return;
    case 'labcoat':
      torso(r, main); longSleeves(r, main); pants(r, shade('#3a3f4a'));
      r(17, 27, 6, 11, trim.c); r(19, 28, 2, 8, shade('#c8102e').c); coatSkirt(r, main, '#3a3f4a'); r(13, 33, 3, 3, main.d); return;
    case 'chef':
      torso(r, main); longSleeves(r, main); pants(r, trim);
      for (const y of [29, 32, 35]) { r(17, y, 1, 1, trim.c); r(22, y, 1, 1, trim.c); } return;
    case 'referee':
      torso(r, main); shortSleeves(r, main); pants(r, trim);
      for (let x = 12; x < 28; x += 3) r(x, 26, 1, 12, trim.c);
      r(9, 26, 1, 3, trim.c); r(30, 26, 1, 3, trim.c); return;
    case 'hawaiian':
      torso(r, main); shortSleeves(r, main); pants(r, trim);
      for (const [x, y, c] of [[13, 28, '#ff6fb8'], [22, 27, '#ffd166'], [17, 32, '#ffd166'], [24, 34, '#ff6fb8'], [14, 35, '#f4f6fa'], [20, 30, '#f4f6fa'], [10, 27, '#ff6fb8']] as const) r(x, y, 2, 2, c);
      r(20, 27, 1, 11, main.d); return;
    case 'santa':
      torso(r, main); longSleeves(r, main); pants(r, main);
      r(19, 27, 2, 11, trim.c); r(12, 36, 16, 2, trim.c); r(12, 34, 16, 2, black.c); r(19, 34, 2, 2, gold); r(7, 31, 3, 1, trim.c); r(30, 31, 3, 1, trim.c); return;
    case 'astronaut':
      torso(r, main); longSleeves(r, main); pants(r, main);
      r(16, 29, 8, 5, trim.c); r(17, 30, 2, 1, '#e85d5d'); r(20, 30, 2, 1, '#6fdc93'); r(17, 32, 5, 1, '#4da3ff'); r(12, 38, 16, 1, trim.d); r(12, 43, 6, 1, trim.c); r(22, 43, 6, 1, trim.c); return;
    case 'armor':
      torso(r, main); longSleeves(r, shade(o.trim)); pants(r, shade(o.trim));
      r(9, 24, 5, 3, main.l); r(26, 24, 5, 3, main.c); r(12, 30, 16, 1, main.d); r(12, 34, 16, 1, main.d); r(19, 27, 2, 10, main.l); r(12, 42, 6, 2, main.c); r(22, 42, 6, 2, main.c); return;
    // ------------------------------------------------ anime-inspired
    case 'warriorArmor':
      // A blue bodysuit under a white chest plate, with gold shoulder straps and white gloves.
      torso(r, shade('#1f3a8a')); longSleeves(r, shade('#1f3a8a')); pants(r, shade('#1f3a8a'));
      r(12, 27, 16, 9, '#f4f6fa'); r(12, 27, 2, 9, '#ffffff'); r(25, 27, 3, 9, '#c9d1dc'); r(14, 31, 12, 1, '#c9d1dc');
      r(10, 24, 5, 4, '#e8b84a'); r(25, 24, 5, 4, '#c9971f'); r(14, 25, 3, 2, '#e8b84a'); r(23, 25, 3, 2, '#c9971f');
      r(12, 36, 7, 4, '#e8b84a'); r(21, 36, 7, 4, '#c9971f'); r(18, 36, 4, 2, '#1f3a8a');
      r(4, 31, 5, 4, '#f4f6fa'); r(3, 33, 3, 3, '#e3e7ee'); r(31, 32, 5, 4, '#f4f6fa'); r(34, 35, 2, 2, '#e3e7ee'); return;
    // ------------------------------------------------ anime and TV-inspired, part two
    case 'trainer':
      // A blue vest over a black tee, green gloves and jeans.
      torso(r, black); shortSleeves(r, black); pants(r, shade('#2f4f8f'));
      r(12, 25, 4, 13, main.c); r(24, 25, 4, 13, main.d); r(12, 25, 2, 13, main.l); r(14, 30, 2, 1, WHITE); r(24, 30, 2, 1, WHITE);
      r(7, 30, 4, 3, '#3fae5f'); r(29, 30, 4, 3, '#2f8a4a'); return;
    case 'arcade80s':
      torso(r, main); shortSleeves(r, main); pants(r, shade('#3b5b8f'));
      r(16, 25, 8, 1, trim.c); r(9, 28, 4, 1, trim.c); r(27, 28, 4, 1, trim.c);
      r(17, 29, 6, 4, '#1a1f2a'); r(18, 30, 1, 2, '#ff6fb8'); r(20, 30, 1, 2, '#4fd6d6'); r(22, 30, 1, 2, '#ffd166'); return;
    case 'contestant':
      torso(r, main); longSleeves(r, main); pants(r, main);
      r(12, 26, 1, 12, trim.c); r(27, 26, 1, 12, trim.c); r(9, 27, 1, 5, trim.c); r(30, 27, 1, 5, trim.c); r(20, 27, 1, 11, main.d);
      r(21, 28, 6, 4, WHITE); for (const x of [22, 24, 26]) r(x, 29, 1, 2, OUTLINE); r(12, 41, 1, 5, trim.c); r(27, 41, 1, 5, trim.c); return;
    case 'guard':
      torso(r, main); longSleeves(r, main); pants(r, main);
      r(20, 25, 1, 11, main.d); r(12, 36, 16, 2, trim.c); r(19, 36, 2, 2, '#8a93a3'); r(7, 30, 4, 3, trim.c); r(29, 30, 4, 3, trim.c);
      r(12, 43, 6, 3, trim.c); r(22, 43, 6, 3, trim.c); r(15, 27, 1, 2, main.l); return;
    case 'demonHunter':
      torso(r, main); longSleeves(r, main); pants(r, main);
      r(16, 25, 8, 2, main.l); for (const y of [29, 32]) r(20, y, 1, 1, '#ffd166'); r(12, 36, 16, 1, trim.c); r(19, 36, 2, 1, '#ffd166');
      r(12, 42, 6, 4, trim.c); r(22, 42, 6, 4, trim.c); for (const y of [43, 45]) { r(12, y, 6, 1, '#c9d1dc'); r(22, y, 6, 1, '#c9d1dc'); } return;
    case 'webHero': {
      torso(r, main); longSleeves(r, main); pants(r, trim);
      r(12, 31, 3, 7, trim.c); r(25, 31, 3, 7, trim.c); r(9, 29, 4, 3, trim.c); r(27, 29, 4, 3, trim.c);
      for (let x = 13; x < 28; x += 3) r(x, 26, 1, 5, main.d);
      for (let y = 27; y < 31; y += 2) r(12, y, 16, 1, main.d);
      r(19, 29, 2, 4, OUTLINE); r(17, 30, 6, 1, OUTLINE); r(17, 32, 6, 1, OUTLINE); r(7, 30, 3, 2, main.c); r(30, 30, 3, 2, main.c);
      r(12, 43, 6, 3, main.c); r(22, 43, 6, 3, main.c); return;
    }
    case 'soulReaper':
      torso(r, main); longSleeves(r, main); coatSkirt(r, main, main.d); r(12, 41, 6, 5, main.c); r(22, 41, 6, 5, main.c);
      r(18, 27, 4, 3, WHITE); for (let i = 0; i < 5; i++) { r(16 + i, 27 + i, 1, 1, WHITE); r(23 - i, 27 + i, 1, 1, WHITE); }
      r(12, 35, 16, 2, trim.c); r(12, 36, 16, 1, '#c9d1dc'); r(7, 31, 3, 1, main.l); r(30, 31, 3, 1, main.l); return;
    case 'capedHero':
      torso(r, main); longSleeves(r, main); pants(r, main);
      r(20, 27, 1, 9, main.d); r(12, 36, 16, 2, black.c); r(19, 36, 2, 2, '#ffd166');
      r(7, 30, 4, 3, trim.c); r(29, 30, 4, 3, trim.c); r(12, 42, 6, 4, trim.c); r(22, 42, 6, 4, trim.c); r(12, 42, 6, 1, trim.l); r(22, 42, 6, 1, trim.l); return;
    case 'sorcerer':
      torso(r, main); longSleeves(r, main); pants(r, main);
      r(14, 23, 12, 4, main.d); r(15, 23, 10, 1, main.l); r(19, 25, 2, 2, trim.c); r(19, 25, 1, 1, trim.l);
      r(11, 41, 7, 5, main.c); r(22, 41, 7, 5, main.c); r(12, 38, 16, 1, main.d); return;
    case 'airNomad':
      torso(r, main); longSleeves(r, main); pants(r, trim);
      for (let i = 0; i < 13; i++) r(11 + i, 25 + i, 3, 1, trim.c);
      r(11, 24, 6, 2, trim.c); r(12, 36, 16, 1, trim.d); r(7, 31, 3, 1, main.l); r(30, 31, 3, 1, main.l); return;
    case 'gi':
      torso(r, main); shortSleeves(r, main); pants(r, main);
      r(17, 27, 6, 4, trim.c); r(18, 27, 4, 2, skin.c); r(12, 35, 16, 2, trim.c); r(7, 31, 3, 2, trim.c); r(30, 32, 3, 2, trim.c);
      r(22, 29, 3, 3, WHITE); r(23, 30, 1, 1, OUTLINE); return;
    case 'ninja':
      torso(r, main); longSleeves(r, main); pants(r, main);
      r(11, 25, 18, 3, trim.c); r(9, 26, 4, 2, trim.c); r(27, 26, 4, 2, trim.c); r(20, 28, 1, 9, WHITE); r(12, 44, 6, 2, trim.c); r(22, 44, 6, 2, trim.c); return;
    case 'pirate':
      torso(r, main); pants(r, shade('#2f5fb3'));
      r(17, 27, 6, 10, skin.c); r(17, 27, 1, 10, skin.d); r(12, 36, 16, 2, trim.c); r(12, 38, 16, 1, trim.d); r(20, 27, 1, 1, main.d); return;
    case 'scout':
      torso(r, white); longSleeves(r, main); pants(r, white);
      r(12, 25, 4, 9, trim.c); r(24, 25, 4, 9, trim.c); r(12, 34, 16, 1, trim.d); r(16, 30, 8, 1, trim.d); r(12, 40, 16, 1, trim.d); r(13, 43, 5, 1, trim.d); r(22, 43, 5, 1, trim.d); return;
    case 'haori': {
      torso(r, main); longSleeves(r, main); pants(r, black);
      const checker = (x0: number, y0: number, w: number, h: number) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (((x >> 1) + (y >> 1)) % 2) r(x, y, 1, 1, trim.c); };
      checker(12, 26, 16, 12); checker(7, 26, 6, 6); checker(27, 26, 6, 6);
      r(18, 27, 4, 11, black.c); coatSkirt(r, main, black.c); checker(11, 38, 7, 6); checker(22, 38, 7, 6); return;
    }
    case 'gakuran':
      torso(r, main); longSleeves(r, main); pants(r, main);
      r(16, 25, 8, 2, main.d); for (const y of [29, 32, 35]) r(20, y, 1, 1, trim.c); r(12, 38, 16, 1, trim.d); return;
    case 'hero':
      torso(r, main); longSleeves(r, main); pants(r, main);
      r(18, 29, 5, 4, gold); r(19, 30, 3, 2, trim.c); r(12, 37, 16, 2, trim.c); r(19, 37, 2, 2, gold); r(7, 30, 3, 2, trim.c); r(30, 30, 3, 2, trim.c); return;
    case 'plugsuit':
      torso(r, main); longSleeves(r, main); pants(r, main);
      r(11, 25, 18, 2, trim.c); r(12, 31, 16, 1, trim.c); r(19, 27, 2, 4, trim.l); r(12, 42, 6, 1, trim.c); r(22, 42, 6, 1, trim.c); r(9, 29, 4, 1, trim.c); r(27, 29, 4, 1, trim.c); return;
    case 'cloudrobe':
      torso(r, main); longSleeves(r, main); pants(r, main); coatSkirt(r, main, main.d);
      r(16, 25, 8, 2, trim.c);
      for (const [x, y] of [[13, 29], [22, 33], [13, 40], [23, 41], [8, 27]] as const) { r(x, y, 4, 2, trim.c); r(x + 1, y - 1, 2, 1, trim.c); r(x, y + 1, 4, 1, WHITE); } return;
    case 'kimono':
      torso(r, main); longSleeves(r, main); coatSkirt(r, main, main.d);
      for (let i = 0; i < 6; i++) { r(17 + i, 27 + i, 1, 1, main.d); }
      r(12, 34, 16, 3, trim.c); r(18, 34, 4, 3, trim.d); r(12, 41, 6, 5, main.c); r(22, 41, 6, 5, main.c); return;
    case 'sailor':
      torso(r, main); shortSleeves(r, main); pants(r, trim);
      r(11, 25, 18, 3, trim.c); r(16, 28, 8, 1, trim.c); r(18, 28, 4, 2, '#e8322e'); r(19, 30, 2, 2, '#e8322e'); r(12, 36, 16, 1, trim.c); return;
    case 'captain':
      torso(r, black); longSleeves(r, main); pants(r, black);
      r(12, 25, 5, 13, main.c); r(23, 25, 5, 13, main.c); r(10, 25, 4, 1, gold); r(26, 25, 4, 1, gold); r(10, 24, 4, 1, gold); r(26, 24, 4, 1, gold);
      r(11, 38, 7, 7, main.c); r(22, 38, 7, 7, main.c); r(11, 44, 7, 1, main.d); r(22, 44, 7, 1, main.d); r(18, 27, 4, 1, gold); return;
    case 'flamecloak':
      torso(r, shade('#1f2f55')); longSleeves(r, main); pants(r, shade('#1f2f55'));
      r(12, 25, 5, 13, main.c); r(23, 25, 5, 13, main.c); r(11, 38, 7, 7, main.c); r(22, 38, 7, 7, main.c);
      for (let x = 11; x < 29; x++) { if (x >= 18 && x < 22) continue; const h = 1 + ((x * 7) % 3); r(x, 45 - h, 1, h, x % 2 ? trim.c : '#ff9d3d'); }
      r(7, 30, 3, 2, trim.c); r(30, 30, 3, 2, trim.c); return;
    case 'sovereign':
      // A sapphire robe in gold: gold pauldrons and collar, a gold sash and belt, a blue jewel, gold-trimmed hems.
      torso(r, main); longSleeves(r, main); pants(r, main); coatSkirt(r, main, main.d);
      r(9, 24, 6, 3, trim.c); r(25, 24, 6, 3, trim.c); r(9, 24, 6, 1, trim.l); r(25, 26, 6, 1, trim.d);
      r(15, 24, 10, 2, trim.c); r(16, 25, 8, 1, trim.d);
      for (let i = 0; i < 11; i++) r(14 + i, 27 + i, 2, 1, trim.c);
      r(11, 37, 18, 2, trim.c); r(11, 38, 18, 1, trim.d); r(19, 36, 3, 3, '#6fd3ff'); r(19, 36, 1, 1, '#9fe7ff');
      r(11, 44, 18, 1, trim.c); r(7, 31, 3, 1, trim.c); r(30, 31, 3, 1, trim.c); r(18, 39, 4, 6, '#0e1a5a'); return;
    case 'royal':
      torso(r, main); longSleeves(r, main); pants(r, main); coatSkirt(r, main, main.d);
      r(11, 24, 18, 3, WHITE); for (const x of [13, 17, 22, 26]) r(x, 25, 1, 1, OUTLINE);
      r(19, 27, 2, 18, trim.c); r(11, 44, 18, 1, trim.c); r(7, 31, 3, 1, WHITE); r(30, 31, 3, 1, WHITE); return;
    case 'wizard':
      torso(r, main); longSleeves(r, main); coatSkirt(r, main, main.d); r(12, 41, 6, 5, main.c); r(22, 41, 6, 5, main.c);
      for (const [x, y] of [[13, 28], [24, 30], [16, 34], [22, 40], [13, 42], [26, 36], [9, 28], [30, 29]] as const) r(x, y, 1, 1, gold);
      r(12, 35, 16, 1, trim.c); return;
  }
}

function drawShoes(r: Rect, id: string, o: Outfit, skin: Shade) {
  if (id === 'team') return;
  for (const x of [12, 23]) {
    if (id === 'sandals') { r(x - 1, 46, 7, 2, skin.c); r(x - 1, 48, 7, 1, '#8a5a2b'); r(x - 1, 49, 7, 1, '#5a3a1a'); r(x + 1, 46, 1, 2, '#c8102e'); continue; }
    if (id === 'cosmicBoots') { r(x - 1, 41, 7, 8, '#0e1a5a'); r(x - 1, 41, 7, 1, '#ffd166'); r(x, 43, 1, 5, '#4da3ff'); r(x + 4, 42, 2, 7, '#060b2a'); r(x - 1, 49, 7, 1, '#6fd3ff'); r(x, 50, 5, 1, '#9fe7ff'); continue; }
    if (id === 'warriorBoots') { r(x - 1, 41, 7, 8, '#f4f6fa'); r(x - 1, 41, 7, 2, '#e8b84a'); r(x + 4, 43, 2, 6, '#c9d1dc'); r(x - 1, 49, 7, 1, '#5b6b82'); continue; }
    if (id === 'boots' || id === 'heroBoots') {
      const c = shade(id === 'boots' ? '#6b4423' : '#e8322e');
      r(x - 1, 41, 7, 8, c.c); r(x - 1, 41, 2, 7, c.l); r(x + 4, 41, 2, 8, c.d); r(x - 1, 49, 7, 1, id === 'boots' ? '#2b1a10' : '#ffd166'); continue;
    }
    const c = shade(id === 'rocket' ? '#c9d1dc' : colorHex(SHOES, id) ?? o.main);
    r(x - 1, 46, 7, 3, c.c); r(x - 1, 46, 3, 2, c.l); r(x + 1, 46, 3, 1, WHITE); r(x + 4, 47, 2, 1, c.d); r(x - 1, 49, 7, 1, id === 'black' ? '#f4f6fa' : WHITE);
    if (id === 'rocket') { r(x, 50, 5, 1, '#ff9d3d'); r(x + 1, 51, 3, 1, '#ffd166'); }
  }
}

/** The new hair styles (the 25 classic ones are the body's own). */
function drawHair(r: Rect, id: string, hair: Shade) {
  const h = (x: number, y: number, w: number, hh: number) => r(x, y, w, hh, hair.c);
  switch (id) {
    case 'spikyWarrior':
      // Big spikes every way, and three bangs falling over the forehead.
      h(11, 5, 18, 6); h(9, 7, 4, 7); h(27, 7, 4, 7);
      for (const [x, y, w, hh] of [[10, 1, 3, 5], [13, 0, 3, 6], [17, 1, 3, 5], [21, 0, 3, 6], [25, 2, 3, 4], [6, 5, 4, 3], [30, 5, 4, 3], [5, 9, 4, 2], [31, 9, 4, 2], [7, 3, 3, 3], [29, 3, 3, 3]] as const) h(x, y, w, hh);
      h(13, 10, 3, 3); h(18, 10, 3, 4); h(23, 10, 3, 3); h(14, 13, 1, 1); h(19, 14, 1, 1); h(24, 13, 1, 1);
      r(14, 2, 1, 4, hair.l); r(22, 2, 1, 4, hair.l); r(28, 8, 2, 4, hair.d); return;
    case 'flameWarrior':
      // Swept straight up like a flame, with a sharp widow's peak.
      h(12, 3, 16, 8); h(11, 7, 2, 5); h(27, 7, 2, 5);
      for (const [x, top] of [[12, 1], [15, 0], [18, 0], [21, 0], [24, 1], [26, 2]] as const) h(x, top, 3, 4);
      h(19, 10, 3, 2); h(20, 12, 1, 1);
      r(16, 1, 1, 6, hair.l); r(22, 1, 1, 6, hair.l); r(26, 4, 2, 6, hair.d); return;
    case 'spikyNinja':
      // Spikes every way and choppy bangs.
      h(11, 5, 18, 6); h(9, 7, 4, 6); h(27, 7, 4, 6);
      for (const [x, top] of [[9, 3], [12, 1], [16, 0], [20, 1], [24, 0], [27, 2]] as const) h(x, top, 3, 5);
      h(6, 7, 4, 2); h(30, 7, 4, 2); h(7, 10, 3, 2); h(30, 10, 3, 2);
      h(13, 10, 2, 3); h(17, 10, 2, 2); h(22, 10, 2, 3); h(25, 10, 2, 2);
      r(13, 2, 1, 4, hair.l); r(21, 2, 1, 4, hair.l); r(28, 5, 2, 4, hair.d); return;
    case 'sorcererSpikes':
      // Swept up and back, leaning to one side, with a few strands over the forehead.
      h(12, 5, 16, 6); h(11, 7, 2, 6); h(27, 7, 2, 6); h(9, 6, 3, 2); h(29, 6, 3, 2);
      for (const [x, top] of [[12, 2], [15, 0], [18, 1], [21, 0], [24, 1], [27, 3]] as const) { h(x, top + 1, 2, 5 - top); h(x + 1, top, 1, 1); }
      h(14, 10, 2, 3); h(19, 10, 2, 4); h(24, 10, 2, 3);
      r(16, 1, 1, 4, hair.l); r(22, 1, 1, 4, hair.l); r(27, 6, 1, 4, hair.d); return;
    case 'superSpikes':
      h(11, 6, 18, 5); h(10, 8, 3, 7); h(27, 8, 3, 7);
      for (const [x, top] of [[11, 1], [15, 0], [19, 0], [23, 0], [26, 2], [8, 4], [30, 4]] as const) { h(x, top, 3, 7 - top); h(x + 1, top - 1 < 0 ? 0 : top - 1, 1, 1); }
      r(16, 2, 1, 5, hair.l); r(20, 1, 1, 5, hair.l); return;
    case 'wildSpikes':
      h(11, 5, 18, 6); h(10, 8, 3, 5); h(27, 8, 3, 5);
      for (const [x, top] of [[10, 2], [14, 1], [18, 2], [22, 1], [26, 3]] as const) h(x, top, 3, 5);
      h(29, 5, 3, 2); h(8, 5, 3, 2); return;
    case 'longStraight': h(12, 5, 16, 5); h(10, 7, 4, 16); h(26, 7, 4, 16); h(10, 22, 3, 4); h(27, 22, 3, 4); r(11, 8, 1, 14, hair.l); return;
    case 'flowingLong': h(12, 4, 16, 6); h(9, 7, 5, 18); h(26, 7, 5, 18); h(8, 20, 4, 8); h(28, 20, 4, 8); r(10, 9, 1, 14, hair.l); r(29, 9, 1, 14, hair.d); return;
    case 'ponytail': h(12, 5, 16, 5); h(11, 8, 2, 4); h(27, 8, 2, 4); h(28, 9, 3, 3); h(30, 11, 3, 10); h(31, 20, 2, 3); return;
    case 'topknot': h(12, 6, 16, 4); h(11, 8, 2, 3); h(27, 8, 2, 3); h(17, 2, 6, 4); h(18, 1, 4, 1); r(17, 5, 6, 1, '#c8102e'); return;
    case 'spaceBuns': h(12, 6, 16, 4); h(11, 8, 2, 4); h(27, 8, 2, 4); h(9, 2, 6, 5); h(25, 2, 6, 5); r(10, 3, 2, 1, hair.l); r(26, 3, 2, 1, hair.l); return;
    case 'twinTails': h(12, 5, 16, 5); h(11, 7, 2, 5); h(27, 7, 2, 5); h(7, 8, 4, 14); h(29, 8, 4, 14); h(6, 12, 2, 8); h(32, 12, 2, 8); r(9, 8, 2, 2, '#ff6fb8'); r(29, 8, 2, 2, '#ff6fb8'); return;
    case 'sideSwept': h(12, 5, 16, 5); h(11, 8, 3, 3); h(27, 8, 2, 3); h(12, 9, 9, 3); h(12, 12, 5, 2); r(13, 6, 8, 1, hair.l); return;
    case 'pompadour': h(12, 6, 16, 4); h(11, 8, 2, 3); h(27, 8, 2, 3); h(12, 2, 16, 5); h(14, 1, 12, 1); r(14, 3, 10, 1, hair.l); return;
    case 'bowlCut': h(11, 5, 18, 7); h(10, 8, 2, 6); h(28, 8, 2, 6); r(12, 11, 16, 1, hair.d); r(13, 6, 10, 1, hair.l); return;
    case 'punkSpikes': h(12, 7, 16, 3); for (let x = 12; x < 28; x += 3) { h(x, 2, 2, 5); h(x, 1, 1, 1); } return;
    case 'sovereignFlame':
      // Swept back like a blue flame, long at the back, with streaks of white fire.
      h(11, 4, 18, 7); h(9, 7, 4, 10); h(27, 7, 4, 10); h(8, 14, 3, 8); h(29, 14, 3, 8); h(7, 20, 2, 4); h(31, 20, 2, 4);
      for (const [x, top] of [[10, 2], [13, 0], [17, 0], [21, 0], [25, 1], [28, 3]] as const) { h(x, top + 1, 3, 5 - top); h(x + 1, top, 1, 1); }
      r(14, 1, 1, 6, '#ffffff'); r(22, 1, 1, 6, '#9fe7ff'); r(10, 9, 1, 10, hair.l); r(29, 9, 1, 10, hair.d); r(18, 3, 1, 4, '#ffffff'); return;
  }
}

function drawBeard(r: Rect, id: string, hair: Shade) {
  if (id === 'stardust') { for (const [x, y] of [[14, 20], [17, 22], [20, 21], [23, 22], [25, 20], [19, 24], [16, 25], [22, 25]] as const) r(x, y, 1, 1, (x + y) % 2 ? '#9fe7ff' : '#ffffff'); return; }
  if (id === 'flameBeard') {
    r(12, 19, 3, 3, '#ff9d3d'); r(25, 19, 3, 3, '#ff9d3d'); r(14, 21, 12, 5, '#ff9d3d'); r(15, 23, 10, 5, '#e8322e'); r(17, 26, 6, 3, '#ffd166'); r(19, 28, 2, 2, '#ff9d3d');
    r(17, 20, 7, 1, '#351c29'); return;
  }
  const h = (x: number, y: number, w: number, hh: number) => r(x, y, w, hh, hair.c);
  if (id === 'wizard') { h(12, 18, 3, 4); h(25, 18, 3, 4); h(14, 21, 12, 6); h(15, 26, 10, 5); h(17, 30, 6, 4); h(19, 33, 2, 2); r(16, 19, 9, 1, hair.c); r(16, 23, 1, 8, hair.l); r(17, 20, 7, 1, '#351c29'); return; }
  if (id === 'viking') { h(12, 18, 3, 4); h(25, 18, 3, 4); h(14, 21, 12, 3); r(16, 19, 9, 1, hair.c); for (const x of [15, 22]) { h(x, 24, 3, 6); r(x, 26, 3, 1, '#c9d1dc'); r(x, 29, 3, 1, '#c9d1dc'); } r(17, 20, 7, 1, '#351c29'); return; }
  if (id === 'handlebar') { h(15, 19, 11, 1); h(14, 18, 2, 1); h(25, 18, 2, 1); h(13, 17, 1, 1); h(27, 17, 1, 1); return; }
  if (id === 'sideburns') { h(11, 11, 2, 9); h(27, 11, 2, 9); h(12, 18, 3, 3); h(25, 18, 3, 3); }
}

function drawCustomHat(r: Rect, id: string, hairHex: string) {
  const gold = shade('#ffd166');
  switch (id) {
    case 'crown': r(12, 4, 16, 4, gold.c); r(12, 2, 2, 2, gold.c); r(16, 1, 2, 3, gold.c); r(22, 1, 2, 3, gold.c); r(26, 2, 2, 2, gold.c); r(19, 0, 2, 4, gold.c);
      r(12, 7, 16, 1, gold.d); r(15, 5, 2, 1, '#e8322e'); r(19, 5, 2, 1, '#4da3ff'); r(23, 5, 2, 1, '#6fdc93'); r(13, 4, 6, 1, gold.l); return;
    case 'foxMask':
      // A white fox mask with red markings.
      r(13, 9, 14, 11, '#f4f6fa'); r(13, 6, 3, 3, '#f4f6fa'); r(24, 6, 3, 3, '#f4f6fa'); r(14, 7, 1, 2, '#e8322e'); r(25, 7, 1, 2, '#e8322e');
      r(14, 13, 4, 1, '#e8322e'); r(22, 13, 4, 1, '#e8322e'); r(15, 14, 3, 1, OUTLINE); r(22, 14, 3, 1, OUTLINE);
      r(14, 17, 2, 1, '#e8322e'); r(24, 17, 2, 1, '#e8322e'); r(18, 17, 4, 3, '#e3e7ee'); r(19, 17, 2, 1, OUTLINE); r(19, 10, 2, 2, '#e8322e'); return;
    case 'guardMask':
      // A black mask with a white shape, and a black hood.
      r(11, 5, 18, 6, '#e8508a'); r(10, 8, 3, 12, '#e8508a'); r(27, 8, 3, 12, '#e8508a');
      r(12, 9, 16, 12, '#161a24'); r(13, 9, 3, 1, '#3a3f4a');
      for (const [x, y] of [[19, 12], [20, 12], [18, 13], [21, 13], [17, 14], [22, 14], [17, 15], [22, 15], [18, 16], [21, 16], [19, 17], [20, 17]] as const) r(x, y, 1, 1, '#f4f6fa'); return;
    case 'blueCrown': {
      // A king's crown in sapphire and gold, with a white-hot jewel.
      const b = shade('#2f6fff');
      r(11, 4, 18, 5, b.c); r(11, 1, 2, 3, b.c); r(15, 0, 2, 4, b.c); r(19, 0, 2, 4, '#ffd166'); r(23, 0, 2, 4, b.c); r(27, 1, 2, 3, b.c);
      r(11, 8, 18, 1, '#ffd166'); r(11, 4, 18, 1, '#ffd166'); r(12, 5, 6, 1, b.l);
      r(14, 6, 2, 1, '#9fe7ff'); r(19, 5, 2, 2, '#ffffff'); r(24, 6, 2, 1, '#9fe7ff'); r(19, 0, 2, 1, '#ffffff'); return;
    }
    case 'halo': r(13, 1, 14, 1, '#ffe066'); r(15, 0, 10, 1, '#fff6c4'); r(15, 2, 10, 1, '#e6b800'); return;
    case 'ninjaBand': r(11, 9, 18, 3, '#1d428a'); r(15, 9, 10, 3, '#c9ccd1'); r(15, 9, 10, 1, '#eef1f6'); r(19, 10, 2, 1, '#5b6b82'); r(18, 11, 4, 1, '#8a93a3'); r(28, 10, 4, 2, '#1d428a'); r(30, 12, 2, 6, '#1d428a'); return;
    case 'strawHat': r(12, 3, 16, 6, '#f2d27a'); r(13, 3, 14, 1, '#fff0b3'); r(12, 7, 16, 2, '#c8102e'); r(6, 9, 28, 2, '#e8c46a'); r(6, 10, 28, 1, '#b8923a'); return;
    case 'catEars': for (const x of [12, 23]) { r(x, 5, 5, 4, hairHex); r(x + 1, 3, 3, 2, hairHex); r(x + 2, 2, 1, 1, hairHex); r(x + 1, 5, 3, 3, '#ff9fc8'); } return;
    case 'devilHorns': r(12, 4, 3, 4, '#d0202e'); r(12, 2, 2, 2, '#d0202e'); r(12, 1, 1, 1, '#ff6b6b'); r(25, 4, 3, 4, '#d0202e'); r(26, 2, 2, 2, '#d0202e'); r(27, 1, 1, 1, '#ff6b6b'); return;
    case 'bunnyEars': r(13, 0, 4, 8, '#f4f6fa'); r(23, 0, 4, 8, '#f4f6fa'); r(14, 1, 2, 6, '#ff9fc8'); r(24, 1, 2, 6, '#ff9fc8'); r(11, 8, 18, 2, '#f4f6fa'); return;
    case 'wizardHat': { const c = shade('#5a2d91'); for (let y = 0; y < 9; y++) r(20 - Math.ceil(y * 0.9), y, 1 + Math.ceil(y * 1.8), 1, c.c); r(8, 9, 24, 2, c.d); r(19, 2, 1, 1, '#ffd166'); r(16, 6, 1, 1, '#ffd166'); r(22, 5, 1, 1, '#ffd166'); return; }
    case 'topHat': r(13, 0, 14, 9, '#161a24'); r(14, 0, 3, 8, '#2b3040'); r(13, 6, 14, 2, '#c8102e'); r(9, 9, 22, 2, '#161a24'); return;
    case 'vikingHelmet': r(12, 4, 16, 6, '#b8c0cc'); r(13, 4, 5, 2, '#eef1f6'); r(11, 9, 18, 2, '#5b6b82'); r(19, 4, 2, 6, '#8a93a3');
      r(8, 4, 3, 5, '#f4f0e6'); r(7, 1, 2, 4, '#f4f0e6'); r(29, 4, 3, 5, '#f4f0e6'); r(31, 1, 2, 4, '#f4f0e6'); return;
    case 'partyHat': for (let y = 0; y < 9; y++) r(20 - Math.floor(y * 0.7), y, 1 + Math.floor(y * 1.4), 1, y % 3 === 0 ? '#ffd166' : y % 3 === 1 ? '#ff6fb8' : '#4da3ff'); r(19, 0, 2, 1, '#f4f6fa'); return;
    case 'chefHat': r(12, 0, 16, 7, '#f4f6fa'); r(11, 1, 3, 5, '#f4f6fa'); r(26, 1, 3, 5, '#f4f6fa'); r(12, 7, 16, 3, '#e3e7ee'); r(14, 1, 3, 1, '#ffffff'); return;
    case 'propeller': drawHat(r, 'cap', '#4da3ff', '#000'); r(19, 2, 2, 2, '#ffd166'); r(13, 1, 7, 1, '#e8322e'); r(20, 1, 7, 1, '#6fdc93'); return;
    case 'santaHat': r(12, 4, 16, 6, '#c8102e'); r(22, 2, 6, 3, '#c8102e'); r(27, 3, 3, 5, '#c8102e'); r(29, 7, 3, 3, '#f4f6fa'); r(11, 8, 18, 3, '#f4f6fa'); return;
  }
}

function drawEyes(r: Rect, id: string) {
  const y = 14;
  switch (id) {
    case 'glasses': for (const [x, w] of [[12, 7], [22, 6]] as const) { r(x, y - 1, w, 1, OUTLINE); r(x, y + 4, w, 1, OUTLINE); r(x, y - 1, 1, 6, OUTLINE); r(x + w - 1, y - 1, 1, 6, OUTLINE); } r(19, y + 1, 3, 1, OUTLINE); return;
    case 'shades': r(12, y, 7, 4, '#111827'); r(22, y, 6, 4, '#111827'); r(19, y + 1, 3, 1, '#111827'); r(13, y, 2, 1, '#8a93a3'); r(23, y, 2, 1, '#8a93a3'); return;
    case 'goggles': r(10, y, 20, 4, '#1a1f2a'); r(12, y, 6, 4, '#6fd3ff'); r(22, y, 6, 4, '#6fd3ff'); r(13, y, 2, 1, WHITE); r(23, y, 2, 1, WHITE); return;
    case 'threeD': r(12, y - 1, 16, 6, '#f4f6fa'); r(13, y, 5, 4, '#e8322e'); r(22, y, 5, 4, '#2fd6e6'); return;
    case 'heartShades': for (const x of [12, 22]) { r(x, y, 6, 3, '#ff4d8d'); r(x + 1, y + 3, 4, 1, '#ff4d8d'); r(x + 2, y + 4, 2, 1, '#ff4d8d'); r(x + 2, y - 1, 1, 1, '#ff4d8d'); r(x + 4, y - 1, 1, 1, '#ff4d8d'); r(x + 1, y, 1, 1, WHITE); } r(18, y + 1, 4, 1, '#ff4d8d'); return;
    case 'monocle': r(22, y - 1, 6, 1, '#ffd166'); r(22, y + 4, 6, 1, '#ffd166'); r(22, y - 1, 1, 6, '#ffd166'); r(27, y - 1, 1, 6, '#ffd166'); r(27, y + 5, 1, 6, '#ffd166'); return;
    case 'eyepatch': r(12, y - 1, 7, 6, '#111827'); r(11, 11, 2, 1, '#111827'); r(18, 11, 11, 1, '#111827'); return;
    case 'skiGoggles': r(10, y - 2, 20, 6, '#2b2f3a'); r(12, y - 1, 16, 4, '#ff9d3d'); r(12, y - 1, 16, 1, '#ffd166'); r(14, y + 1, 3, 1, WHITE); return;
    case 'cyberVisor': r(11, y, 19, 3, '#ff2d4a'); r(11, y + 1, 19, 1, '#ffb3b3'); r(29, y - 1, 2, 5, '#5b6b82'); return;
    case 'starEyes': for (const x of [16, 25]) { r(x - 1, y + 1, 4, 1, '#ffd166'); r(x, y, 2, 3, '#ffd166'); r(x, y + 3, 1, 1, '#ffd166'); r(x + 1, y + 3, 1, 1, '#ffd166'); r(x, y + 1, 2, 1, WHITE); } return;
    case 'sharingan': for (const x of [16, 25]) { r(x - 1, y, 3, 4, '#d0202e'); r(x, y + 1, 1, 2, OUTLINE); r(x - 1, y, 1, 1, OUTLINE); r(x + 1, y + 3, 1, 1, OUTLINE); r(x + 1, y, 1, 1, '#ff8080'); } return;
    case 'voidFace':
      // No face: a void of night sky where the face should be, edged in blue light.
      r(12, 10, 16, 12, '#04061a'); r(13, 9, 14, 1, '#04061a'); r(14, 22, 12, 1, '#04061a');
      r(12, 10, 1, 12, '#1f4fd9'); r(27, 10, 1, 12, '#1f4fd9');
      for (const [x, yy, c] of [[15, 12, '#ffffff'], [24, 13, '#9fe7ff'], [19, 16, '#b8a8ff'], [17, 19, '#ffffff'], [23, 18, '#6fd3ff'], [21, 11, '#ffffff']] as const) r(x, yy, 1, 1, c);
      return;
    case 'blindfold': r(11, y - 1, 18, 5, '#161a24'); r(11, y - 1, 18, 1, '#3a3f4a'); r(28, y + 3, 2, 3, '#161a24'); return;
    case 'scouter': r(22, y - 1, 6, 5, '#7dff9b'); r(22, y - 1, 6, 1, '#b8ffcc'); r(28, 11, 3, 8, '#e8322e'); r(29, 12, 1, 6, '#ff9d9d'); return;
    case 'glowRed': for (const x of [16, 25]) { r(x, y, 2, 4, '#ff2d2d'); r(x, y, 1, 1, '#ffd166'); } r(13, y + 1, 1, 1, '#ff2d2d'); return;
    case 'sparkle': for (const [x, w] of [[13, 5], [23, 4]] as const) { r(x, y - 1, w, 5, WHITE); r(x + w - 3, y - 1, 3, 5, '#2f5fb3'); r(x + w - 3, y - 1, 1, 1, WHITE); r(x + w - 1, y + 2, 1, 1, '#9fc3ff'); } return;
  }
}

function drawNeck(r: Rect, id: string) {
  switch (id) {
    case 'goldChain': case 'silverChain': { const c = id === 'goldChain' ? '#ffd166' : '#d7dde6'; r(16, 27, 1, 3, c); r(23, 27, 1, 3, c); r(17, 30, 1, 1, c); r(22, 30, 1, 1, c); r(18, 31, 4, 1, c); r(19, 32, 2, 2, c); return; }
    case 'headphones': r(13, 24, 14, 2, '#2b2f3a'); r(12, 24, 3, 3, '#e8322e'); r(25, 24, 3, 3, '#e8322e'); return;
    case 'whistle': r(18, 27, 1, 4, '#c8102e'); r(21, 27, 1, 4, '#c8102e'); r(19, 31, 3, 2, '#c9d1dc'); return;
    case 'bowtie': r(17, 26, 3, 2, '#c8102e'); r(21, 26, 3, 2, '#c8102e'); r(20, 26, 1, 2, '#8a0f20'); return;
    case 'medal': r(17, 27, 1, 4, '#1d428a'); r(22, 27, 1, 4, '#c8102e'); r(18, 31, 4, 1, '#1d428a'); r(18, 32, 4, 4, '#ffd166'); r(19, 33, 2, 2, '#fff0b3'); return;
    case 'backpack': r(13, 25, 2, 13, '#3a3f4a'); r(25, 25, 2, 13, '#3a3f4a'); return;
    case 'scarf': r(14, 24, 12, 3, '#e8322e'); r(15, 24, 10, 1, '#ff8080'); r(23, 26, 3, 9, '#e8322e'); r(24, 35, 2, 2, '#e8322e'); r(26, 27, 4, 2, '#e8322e'); return;
    case 'capeRed': case 'capeBlack': case 'capeGold': { const c = id === 'capeRed' ? '#b0122a' : id === 'capeGold' ? '#c9971f' : '#1a1f2a'; r(11, 24, 3, 2, c); r(26, 24, 3, 2, c); r(19, 25, 2, 1, id === 'capeGold' ? '#fff3c4' : '#ffd166'); return; }
    case 'jetpack': r(12, 26, 2, 1, '#5b6b82'); r(26, 26, 2, 1, '#5b6b82'); return;
    case 'katana': for (let i = 0; i < 12; i++) r(14 + i, 26 + i, 2, 1, '#5a3a1a'); return;
    case 'weightedCape':
      // Square shoulder pads and a high collar.
      r(7, 23, 7, 4, '#f4f6fa'); r(26, 23, 7, 4, '#e3e7ee'); r(7, 23, 7, 1, '#ffffff'); r(7, 26, 7, 1, '#c9d1dc'); r(26, 26, 7, 1, '#b8c0cc');
      r(13, 23, 3, 2, '#f4f6fa'); r(24, 23, 3, 2, '#e3e7ee'); return;
  }
}

/** Pieces worn behind the body (drawn only where the body isn't). */
function drawBack(grid: SpriteGrid, id: string) {
  const back: Rect = (x, y, w, h, c) => { for (let yy = Math.max(0, y); yy < Math.min(grid.length, y + h); yy++) for (let xx = Math.max(0, x); xx < Math.min(grid[0].length, x + w); xx++) if (!grid[yy][xx]) grid[yy][xx] = c; };
  switch (id) {
    case 'capeRed': case 'capeBlack': case 'capeGold': { const c = shade(id === 'capeRed' ? '#c8102e' : id === 'capeGold' ? '#e8b84a' : '#1a1f2a'); for (let y = 25; y < 49; y++) { const s = Math.floor((y - 25) / 5); back(10 - s, y, 20 + s * 2, 1, (y + s) % 7 === 0 ? c.d : c.c); } return; }
    case 'blackWings':
      // Big black angel wings, feathers edged in blue fire.
      for (const [x0, dir] of [[9, -1], [30, 1]] as const) for (let i = 0; i < 11; i++) {
        const x = dir < 0 ? x0 - i : x0 + i, top = 14 + Math.floor(i * 0.6), len = 22 - Math.floor(i * 1.2);
        back(x, top, 1, len, i % 3 === 2 ? '#2a2f3f' : '#0b0e16');
        back(x, top + len, 1, 1, i % 2 ? '#4da3ff' : '#9fe7ff');
        if (i % 3 === 0) back(x, top, 1, 1, '#3a4258');
      }
      return;
    case 'sovereignCape':
      // The Sovereign's golden cape, edged in blue, widening to the floor.
      for (let y = 24; y < 50; y++) {
        const s = Math.floor((y - 24) / 4), x0 = 9 - s, w = 22 + s * 2;
        back(x0, y, 1, 1, '#1f4fd9'); back(x0 + w - 1, y, 1, 1, '#1f4fd9');
        for (let x = x0 + 1; x < x0 + w - 1; x++) back(x, y, 1, 1, (x + y) % 7 === 0 ? '#ffe08a' : (y + s) % 6 === 0 ? '#c9971f' : '#ffd166');
      }
      return;
    case 'angelWings': for (const [x0, dir] of [[9, -1], [30, 1]] as const) for (let i = 0; i < 9; i++) { const x = dir < 0 ? x0 - i : x0 + i; back(x, 20 + Math.floor(i / 2), 1, 16 - i, i % 3 === 2 ? '#dfe6f0' : '#f8fbff'); } return;
    case 'batWings': for (const [x0, dir] of [[9, -1], [30, 1]] as const) for (let i = 0; i < 9; i++) { const x = dir < 0 ? x0 - i : x0 + i; back(x, 20 + i, 1, 10 - (i % 3) * 2, i % 3 === 0 ? '#3b1d5a' : '#5a2d82'); } return;
    case 'jetpack': back(7, 26, 5, 12, '#8a93a3'); back(28, 26, 5, 12, '#8a93a3'); back(8, 26, 3, 1, '#c9d1dc'); back(29, 26, 3, 1, '#c9d1dc'); back(8, 38, 3, 3, '#ff9d3d'); back(29, 38, 3, 3, '#ff9d3d'); back(9, 41, 1, 2, '#ffd166'); back(30, 41, 1, 2, '#ffd166'); return;
    case 'backpack': back(11, 26, 18, 12, '#e8322e'); return;
    case 'katana':
      // A sword on the back, the hilt over the right shoulder.
      for (let i = 0; i < 30; i++) {
        const x = 32 - i, y = 15 + i;
        if (i < 6) { back(x, y, 2, 1, i % 2 ? '#c8102e' : '#161a24'); continue; }
        if (i === 6) { back(x - 1, y - 1, 4, 3, '#ffd166'); continue; }
        back(x, y, 2, 1, '#c9d1dc'); back(x + 1, y, 1, 1, '#eef1f6');
      }
      return;

    case 'weightedCape': for (let y = 24; y < 50; y++) { const s = Math.floor((y - 24) / 4); back(8 - s, y, 24 + s * 2, 1, (y + s) % 6 === 0 ? '#c9d1dc' : '#eef1f6'); } return;
    case 'tail': {
      // A furry tail curling out from behind the waist.
      const fur = '#8a5a2b', dark = '#5a3a1a';
      for (const [x, y] of [[28, 38], [29, 38], [30, 37], [31, 36], [32, 35], [33, 34], [34, 33], [34, 32], [34, 31], [33, 30], [32, 30], [31, 31]] as const) { back(x, y, 2, 2, fur); back(x + 1, y + 1, 1, 1, dark); }
      return;
    }
  }
}

// ---------------------------------------------------------------- auras

const AURA_COLORS: Record<string, string[]> = {
  fire: ['#ff4d2e', '#ff9d3d', '#ffd166'], golden: ['#ffe14d', '#fff3a0', '#ffc400'], lightning: ['#6fd3ff', '#ffffff', '#4da3ff'],
  shadow: ['#3b1d5a', '#6a3fb5', '#1a1030'], ice: ['#bfe6ff', '#ffffff', '#6db8ff'], toxic: ['#7dff5a', '#3fae5f', '#d0ff8a'],
  cosmic: ['#6a45c0', '#ff7ad9', '#6fd3ff', '#ffffff'], rainbow: RAINBOW, sparkles: ['#ffd166', '#ffffff'], hearts: ['#ff4d8d', '#ff9fc8'],
  superWarrior: ['#ffe14d', '#fff6b0', '#ffc400', '#ffffff'], storm: ['#7b4dff', '#c9b3ff', '#3b1d9a'],
  sakura: ['#ffb7d5', '#ff8fc0', '#fff0f6'], hunter: ['#e8322e', '#ffd166', '#ff9d3d', '#7a1010'], cursed: ['#2a2f8a', '#4d6bff', '#9fb3ff', '#0b0f3a'],
  cosmicFire: ['#9fe7ff', '#1f4fd9', '#6fd3ff', '#ffffff', '#4a2fbf', '#0a1f7a'],
};
function auraCells(grid: SpriteGrid, kind: string): SpriteGrid {
  const H = grid.length, W = grid[0].length;
  const out: SpriteGrid = grid.map(row => row.map(() => null));
  const colors = AURA_COLORS[kind];
  if (!colors) return out;
  const noise = (x: number, y: number) => ((x * 73856093) ^ (y * 19349663)) >>> 0;
  /** Body within `side` pixels across and `below` pixels under (or `above` over) this cell. */
  const near = (x: number, y: number, side: number, above: number, below: number) => {
    for (let dy = -above; dy <= below; dy++) for (let dx = -side; dx <= side; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && xx < W && yy >= 0 && yy < H && grid[yy][xx]) return true;
    }
    return false;
  };
  const rising = kind === 'fire' || kind === 'golden' || kind === 'lightning' || kind === 'superWarrior' || kind === 'storm' || kind === 'cursed' || kind === 'hunter' || kind === 'cosmicFire';
  const crackle = kind === 'superWarrior' || kind === 'storm' || kind === 'cursed' || kind === 'cosmicFire';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (grid[y][x]) continue;
    if (kind === 'sparkles' || kind === 'hearts' || kind === 'sakura') {
      // Bits floating in the margin around the body.
      if (near(x, y, 1, 1, 1) || !near(x, y, 3, 3, 3) || noise(x, y) % 9) continue;
      out[y][x] = colors[noise(y, x) % colors.length];
      if ((kind === 'hearts' || kind === 'sakura') && x + 1 < W && !grid[y][x + 1]) out[y][x + 1] = colors[0];
      continue;
    }
    // Flames and bolts rise: the aura reaches higher above the body than beside it, in tongues.
    if (!near(x, y, 2, 1, rising ? 3 : 2)) {
      // The super warrior's power crackles with little bolts further out.
      if (crackle && near(x, y, 3, 3, 4) && noise(x, y) % 11 === 0) out[y][x] = kind === 'storm' ? '#ffffff' : '#9fe7ff';
      // Cosmic fire scatters stars further out.
      else if (kind === 'cosmicFire' && near(x, y, 5, 5, 5) && noise(x, y) % 17 === 0) out[y][x] = noise(y, x) % 3 ? '#ffffff' : '#b8a8ff';
      continue;
    }
    if (rising && !near(x, y, 1, 1, 1) && noise(x, Math.floor(y / 2)) % 3 === 0) continue;
    const band = rising ? Math.min(colors.length - 1, near(x, y, 1, 1, 1) ? 0 : 1 + (noise(x, y) % (colors.length - 1))) : (kind === 'rainbow' ? Math.floor((x + y) / 3) : x + y * 2) % colors.length;
    out[y][x] = colors[band];
  }
  return out;
}

// ---------------------------------------------------------------- the whole character

const rainbowAt = (x: number, y: number) => RAINBOW[Math.floor((x + y) / 4) % RAINBOW.length];

/** An outfit's colours and number: a jersey can wear any team's colours and any number (your favourite team's for "Your team"). */
export function outfitKit(look: AvatarLook, team?: AvatarOptions['team']): { primary: string; secondary: string; number: number | null } {
  const o = outfitDef(look.outfit);
  if (o.kind !== 'jersey') return { primary: o.main, secondary: o.trim, number: null };
  const colors = look.kitTeam ? teamColors(look.kitTeam) : o.id === 'jersey-fav' && team ? team : { primary: o.main, secondary: o.trim };
  return { ...colors, number: look.kitNumber ?? o.number ?? null };
}

export function buildAvatarGrid({ look, team }: AvatarOptions): { grid: SpriteGrid; aura: SpriteGrid } {
  const o = outfitDef(look.outfit);
  const skinHex = colorHex(SKINS, look.skin), hairHex = colorHex(HAIR_COLORS, look.hairColor);
  const skinBase = skinHex === 'rainbow' ? SKIN_KEY : skinHex, hairBase = hairHex === 'rainbow' ? HAIR_KEY : hairHex;
  const classicHair = (HAIR_STYLES as readonly string[]).includes(look.hair), classicBeard = (BEARD_STYLES as readonly string[]).includes(look.beard);
  const kit = outfitKit(look, team);
  const kitMain = kit.primary, kitTrim = kit.secondary;
  const grid = buildPlayerGrid({
    playerId: BODY_ID, primary: kitMain, secondary: kitTrim, jerseyNumber: kit.number, jerseyStyle: o.style,
    appearance: { skinHex: skinBase, hairHex: hairBase, hairStyle: (classicHair ? look.hair : 'bald') as HairStyle, beardStyle: (classicBeard ? look.beard : 'none') as BeardStyle, hatStyle: 'none' },
  });
  const r: Rect = (x, y, w, h, c) => {
    for (let yy = Math.max(0, y); yy < Math.min(grid.length, y + h); yy++) for (let xx = Math.max(0, x); xx < Math.min(grid[0].length, x + w); xx++) grid[yy][xx] = c;
  };
  const skin = shade(skinBase), hair: Shade = { c: hairBase, l: mix(hairBase, '#a8a0b4', 0.3), d: mix(hairBase, OUTLINE, 0.4) };

  drawOutfit(r, o, kit, skin);
  drawShoes(r, look.shoes, o, skin);
  if (!classicBeard) drawBeard(r, look.beard, hair);
  if (!classicHair) drawHair(r, look.hair, hair);
  if ((HAT_STYLES as readonly string[]).includes(look.hat)) drawHat(r, look.hat as HatStyle, kitMain, skinBase);
  else drawCustomHat(r, look.hat, hairBase);
  drawEyes(r, look.eyes);
  drawNeck(r, look.neck);
  drawBack(grid, look.neck);

  // Rainbow skin and hair: every shade of the stand-in colour takes the rainbow at that spot, keeping its shading.
  if (skinHex === 'rainbow' || hairHex === 'rainbow') {
    const shades = new Map<string, (c: string) => string>();
    const add = (key: string, toward: string, amt: number) => shades.set(mix(key, toward, amt), c => mix(c, toward, amt));
    if (skinHex === 'rainbow') { shades.set(SKIN_KEY, c => c); add(SKIN_KEY, '#ffe9cb', 0.25); add(SKIN_KEY, '#542c30', 0.35); add(SKIN_KEY, '#351c29', 0.55); add(SKIN_KEY, WHITE, 0.25); add(SKIN_KEY, OUTLINE, 0.4); }
    if (hairHex === 'rainbow') { shades.set(HAIR_KEY, c => c); add(HAIR_KEY, '#a8a0b4', 0.3); add(HAIR_KEY, OUTLINE, 0.4); }
    // Stubble blends skin and hair.
    shades.set(mix(skinBase, hairBase, 0.5), c => mix(skinHex === 'rainbow' ? c : skinBase, hairHex === 'rainbow' ? c : hairBase, 0.5));
    for (let y = 0; y < grid.length; y++) for (let x = 0; x < grid[0].length; x++) {
      const c = grid[y][x];
      const f = c ? shades.get(c) : undefined;
      if (f) grid[y][x] = f(rainbowAt(x, y));
    }
  }

  const padded: SpriteGrid = Array.from({ length: AVATAR_H }, (_, y) => Array.from({ length: AVATAR_W }, (_, x) => {
    const gy = y - AVATAR_PAD, gx = x - AVATAR_PAD;
    return gy >= 0 && gy < grid.length && gx >= 0 && gx < grid[0].length ? grid[gy][gx] : null;
  }));
  const outlined = outlineGrid(padded);
  return { grid: outlined, aura: auraCells(outlined, look.aura) };
}
export function buildAvatarSprite(opts: AvatarOptions): AvatarSprite {
  const { grid, aura } = buildAvatarGrid(opts);
  return { paths: detailedSpritePaths(grid), aura: gridToPaths(aura), auraKind: opts.look.aura };
}

// ---------------------------------------------------------------- coaches and referees

export type FigurePose = 'down' | 'cross' | 'point' | 'up' | 'whistle';
export interface FigureOptions {
  id: string; skin: string; hair: string; hairStyle?: HairStyle; beard?: BeardStyle; glasses?: boolean;
  /** The outfit kind (suit, track, referee…) in its colours. */
  kind: Outfit['kind']; main: string; trim: string; pose?: FigurePose;
}
/**
 * A sideline figure (a head coach, a referee) on the same detailed body as the players: the face, hair and beard come
 * from the player renderer, the clothes from the character outfits, and the arms are posed for the sideline.
 */
export function buildFigureGrid({ id, skin, hair, hairStyle = 'short', beard = 'none', glasses = false, kind, main, trim, pose = 'down' }: FigureOptions): SpriteGrid {
  const grid = buildPlayerGrid({ playerId: id, primary: main, secondary: trim, jerseyNumber: null, appearance: { skinHex: skin, hairHex: hair, hairStyle, beardStyle: beard, hatStyle: 'none' } });
  const r: Rect = (x, y, w, h, c) => {
    for (let yy = Math.max(0, y); yy < Math.min(grid.length, y + h); yy++) for (let xx = Math.max(0, x); xx < Math.min(grid[0].length, x + w); xx++) grid[yy][xx] = c;
  };
  const skinShade = shade(skin);
  const outfit = { id: 'figure', name: '', rule: { level: 1 }, kind, main, trim } as Outfit;
  drawOutfit(r, outfit, { primary: main, secondary: trim }, skinShade);
  drawShoes(r, 'black', outfit, skinShade);
  if (glasses) drawEyes(r, 'glasses');
  if (pose !== 'down') {
    // Clear the hanging arms, then pose new ones in the outfit's sleeve colour.
    for (let y = 25; y < 38; y++) for (let x = 0; x < 40; x++) if (x < 12 || x > 27) grid[y][x] = null;
    const sleeve = kind === 'referee' || kind === 'tee' || kind === 'hawaiian' ? skinShade : shade(main);
    const cuff = kind === 'referee' ? '#f4f6fa' : sleeve.c;
    const armDown = (x: number) => { r(x, 25, 3, 9, sleeve.c); r(x, 25, 3, 3, cuff); r(x, 34, 3, 3, skin); };
    const armUp = (x: number) => { r(x, 12, 3, 14, sleeve.c); r(x, 22, 3, 4, cuff); r(x, 9, 3, 3, skin); };
    if (pose === 'cross') {
      r(9, 25, 3, 6, cuff); r(28, 25, 3, 6, cuff);
      r(11, 29, 18, 3, sleeve.c); r(11, 32, 18, 2, sleeve.d); r(10, 29, 2, 2, skin); r(28, 32, 2, 2, skin);
    } else if (pose === 'point') { armDown(9); r(28, 26, 9, 3, sleeve.c); r(28, 26, 3, 3, cuff); r(37, 26, 3, 3, skin); }
    else if (pose === 'up') { armUp(9); armUp(28); }
    else { armDown(9); armUp(28); }
  }
  return outlineGrid(grid);
}
const figureCache = new Map<string, SpritePath[]>();
export function buildFigureSprite(opts: FigureOptions): SpritePath[] {
  const key = JSON.stringify(opts);
  let hit = figureCache.get(key);
  if (!hit) { if (figureCache.size > 300) figureCache.clear(); hit = detailedSpritePaths(buildFigureGrid(opts)); figureCache.set(key, hit); }
  return hit;
}
