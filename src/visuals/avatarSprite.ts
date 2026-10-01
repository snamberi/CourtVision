import { buildPlayerGrid, outlineGrid, detailedSpritePaths, gridToPaths, drawHat, mix, HAIR_STYLES, BEARD_STYLES, HAT_STYLES, type SpriteGrid, type SpritePath, type HairStyle, type BeardStyle, type HatStyle } from './playerSprite';
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

function drawOutfit(r: Rect, o: Outfit, team: AvatarOptions['team'], skin: Shade) {
  const main = shade(o.id === 'jersey-fav' && team ? team.primary : o.main), trim = shade(o.id === 'jersey-fav' && team ? team.secondary : o.trim);
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
  }
}

function drawBeard(r: Rect, id: string, hair: Shade) {
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
    case 'capeRed': case 'capeBlack': r(11, 24, 3, 2, id === 'capeRed' ? '#b0122a' : '#1a1f2a'); r(26, 24, 3, 2, id === 'capeRed' ? '#b0122a' : '#1a1f2a'); r(19, 25, 2, 1, '#ffd166'); return;
    case 'jetpack': r(12, 26, 2, 1, '#5b6b82'); r(26, 26, 2, 1, '#5b6b82'); return;
  }
}

/** Pieces worn behind the body (drawn only where the body isn't). */
function drawBack(grid: SpriteGrid, id: string) {
  const back: Rect = (x, y, w, h, c) => { for (let yy = Math.max(0, y); yy < Math.min(grid.length, y + h); yy++) for (let xx = Math.max(0, x); xx < Math.min(grid[0].length, x + w); xx++) if (!grid[yy][xx]) grid[yy][xx] = c; };
  switch (id) {
    case 'capeRed': case 'capeBlack': { const c = shade(id === 'capeRed' ? '#c8102e' : '#1a1f2a'); for (let y = 25; y < 49; y++) { const s = Math.floor((y - 25) / 5); back(10 - s, y, 20 + s * 2, 1, (y + s) % 7 === 0 ? c.d : c.c); } return; }
    case 'angelWings': for (const [x0, dir] of [[9, -1], [30, 1]] as const) for (let i = 0; i < 9; i++) { const x = dir < 0 ? x0 - i : x0 + i; back(x, 20 + Math.floor(i / 2), 1, 16 - i, i % 3 === 2 ? '#dfe6f0' : '#f8fbff'); } return;
    case 'batWings': for (const [x0, dir] of [[9, -1], [30, 1]] as const) for (let i = 0; i < 9; i++) { const x = dir < 0 ? x0 - i : x0 + i; back(x, 20 + i, 1, 10 - (i % 3) * 2, i % 3 === 0 ? '#3b1d5a' : '#5a2d82'); } return;
    case 'jetpack': back(7, 26, 5, 12, '#8a93a3'); back(28, 26, 5, 12, '#8a93a3'); back(8, 26, 3, 1, '#c9d1dc'); back(29, 26, 3, 1, '#c9d1dc'); back(8, 38, 3, 3, '#ff9d3d'); back(29, 38, 3, 3, '#ff9d3d'); back(9, 41, 1, 2, '#ffd166'); back(30, 41, 1, 2, '#ffd166'); return;
    case 'backpack': back(11, 26, 18, 12, '#e8322e'); return;
  }
}

// ---------------------------------------------------------------- auras

const AURA_COLORS: Record<string, string[]> = {
  fire: ['#ff4d2e', '#ff9d3d', '#ffd166'], golden: ['#ffe14d', '#fff3a0', '#ffc400'], lightning: ['#6fd3ff', '#ffffff', '#4da3ff'],
  shadow: ['#3b1d5a', '#6a3fb5', '#1a1030'], ice: ['#bfe6ff', '#ffffff', '#6db8ff'], toxic: ['#7dff5a', '#3fae5f', '#d0ff8a'],
  cosmic: ['#6a45c0', '#ff7ad9', '#6fd3ff', '#ffffff'], rainbow: RAINBOW, sparkles: ['#ffd166', '#ffffff'], hearts: ['#ff4d8d', '#ff9fc8'],
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
  const rising = kind === 'fire' || kind === 'golden' || kind === 'lightning';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (grid[y][x]) continue;
    if (kind === 'sparkles' || kind === 'hearts') {
      // Bits floating in the margin around the body.
      if (near(x, y, 1, 1, 1) || !near(x, y, 3, 3, 3) || noise(x, y) % 9) continue;
      out[y][x] = colors[noise(y, x) % colors.length];
      if (kind === 'hearts' && x + 1 < W && !grid[y][x + 1]) out[y][x + 1] = colors[0];
      continue;
    }
    // Flames and bolts rise: the aura reaches higher above the body than beside it, in tongues.
    if (!near(x, y, 2, 1, rising ? 3 : 2)) continue;
    if (rising && !near(x, y, 1, 1, 1) && noise(x, Math.floor(y / 2)) % 3 === 0) continue;
    const band = rising ? Math.min(colors.length - 1, near(x, y, 1, 1, 1) ? 0 : 1 + (noise(x, y) % (colors.length - 1))) : (kind === 'rainbow' ? Math.floor((x + y) / 3) : x + y * 2) % colors.length;
    out[y][x] = colors[band];
  }
  return out;
}

// ---------------------------------------------------------------- the whole character

const rainbowAt = (x: number, y: number) => RAINBOW[Math.floor((x + y) / 4) % RAINBOW.length];

export function buildAvatarGrid({ look, team }: AvatarOptions): { grid: SpriteGrid; aura: SpriteGrid } {
  const o = outfitDef(look.outfit);
  const skinHex = colorHex(SKINS, look.skin), hairHex = colorHex(HAIR_COLORS, look.hairColor);
  const skinBase = skinHex === 'rainbow' ? SKIN_KEY : skinHex, hairBase = hairHex === 'rainbow' ? HAIR_KEY : hairHex;
  const classicHair = (HAIR_STYLES as readonly string[]).includes(look.hair), classicBeard = (BEARD_STYLES as readonly string[]).includes(look.beard);
  const kitMain = o.id === 'jersey-fav' && team ? team.primary : o.main, kitTrim = o.id === 'jersey-fav' && team ? team.secondary : o.trim;
  const grid = buildPlayerGrid({
    playerId: BODY_ID, primary: kitMain, secondary: kitTrim, jerseyNumber: o.kind === 'jersey' ? o.number ?? null : null, jerseyStyle: o.style,
    appearance: { skinHex: skinBase, hairHex: hairBase, hairStyle: (classicHair ? look.hair : 'bald') as HairStyle, beardStyle: (classicBeard ? look.beard : 'none') as BeardStyle, hatStyle: 'none' },
  });
  const r: Rect = (x, y, w, h, c) => {
    for (let yy = Math.max(0, y); yy < Math.min(grid.length, y + h); yy++) for (let xx = Math.max(0, x); xx < Math.min(grid[0].length, x + w); xx++) grid[yy][xx] = c;
  };
  const skin = shade(skinBase), hair: Shade = { c: hairBase, l: mix(hairBase, '#a8a0b4', 0.3), d: mix(hairBase, OUTLINE, 0.4) };

  drawOutfit(r, o, team, skin);
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
