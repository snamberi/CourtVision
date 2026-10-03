import type { Appearance } from './playerSprite';

/*
 * Real players look like themselves: a pixel likeness (skin tone, hair, facial hair, headband, goggles, sleeve) for
 * the best-known players of every era. The sprite reads it for every player whose name matches, in every mode; a
 * look saved on a player in a league still wins. Players can fix any likeness on this device ("use this look
 * everywhere"), and share it as a short code.
 *
 * Palette indices (playerSprite.ts): skin 0 light, 1 tan, 2 medium, 3 brown, 4 dark brown, 5 very light, 6 bronze,
 * 7 very dark. Hair 0 black, 1 dark brown, 2 brown, 3 dark blond, 4 grey, 5 auburn, 6 blond. Hat colour 0 red,
 * 1 blue, 2 green, 3 gold, 4 black, 5 purple, 6 white.
 */

type L = Appearance;
const hb = (hatColor = 6): L => ({ hatStyle: 'headband', hatColor });
const noHat: L = { hatStyle: 'none' };

/** Keyed by the normalized name (lowercase, no accents, no Jr./year tag). */
export const REAL_LOOKS: Record<string, L> = {
  // Today
  'stephen curry': { skin: 1, hairStyle: 'short', hairColor: 0, beardStyle: 'stubbleLight', ...noHat, expression: 'grin' },
  'lebron james': { skin: 3, hairStyle: 'lowFade', hairColor: 0, beardStyle: 'fullShort', ...hb(6), expression: 'determined' },
  'kevin durant': { skin: 3, hairStyle: 'lowFade', hairColor: 0, beardStyle: 'shortBoxed', ...noHat },
  'giannis antetokounmpo': { skin: 4, hairStyle: 'short', hairColor: 0, beardStyle: 'stubbleFull', ...noHat, expression: 'determined' },
  'luka doncic': { skin: 0, hairStyle: 'medium', hairColor: 2, beardStyle: 'stubbleFull', ...noHat, eyeColor: 1 },
  'nikola jokic': { skin: 0, hairStyle: 'buzzCut', hairColor: 1, beardStyle: 'stubbleLight', ...noHat, expression: 'neutral' },
  'ja morant': { skin: 3, hairStyle: 'twists', hairColor: 0, beardStyle: 'thinLine', ...noHat, expression: 'grin' },
  'joel embiid': { skin: 4, hairStyle: 'buzzCut', hairColor: 0, beardStyle: 'shortRound', ...noHat },
  'jayson tatum': { skin: 2, hairStyle: 'buzzCut', hairColor: 0, beardStyle: 'goatee', ...noHat },
  'anthony edwards': { skin: 3, hairStyle: 'dreadsShort', hairColor: 0, beardStyle: 'none', ...noHat, expression: 'grin' },
  'shai gilgeous-alexander': { skin: 3, hairStyle: 'curlyShort', hairColor: 0, beardStyle: 'thinLine', ...noHat },
  'victor wembanyama': { skin: 4, hairStyle: 'curlyShort', hairColor: 0, beardStyle: 'none', ...noHat, expression: 'neutral' },
  'kawhi leonard': { skin: 3, hairStyle: 'cornrows', hairColor: 0, beardStyle: 'fullShort', ...noHat, expression: 'neutral' },
  'james harden': { skin: 2, hairStyle: 'afroMedium', hairColor: 0, beardStyle: 'lumberjackXL', ...noHat },
  'russell westbrook': { skin: 3, hairStyle: 'lowFade', hairColor: 0, beardStyle: 'goatee', ...noHat, expression: 'determined' },
  'damian lillard': { skin: 3, hairStyle: 'dreadsMedium', hairColor: 0, beardStyle: 'fullShort', ...hb(6) },
  'kyrie irving': { skin: 2, hairStyle: 'curlyShort', hairColor: 0, beardStyle: 'fullShort', ...noHat },
  'anthony davis': { skin: 3, hairStyle: 'lowFade', hairColor: 0, beardStyle: 'goatee', ...noHat },
  'devin booker': { skin: 2, hairStyle: 'short', hairColor: 0, beardStyle: 'stubbleLight', ...noHat },
  'trae young': { skin: 3, hairStyle: 'waves', hairColor: 0, beardStyle: 'none', ...noHat, expression: 'grin' },
  'zion williamson': { skin: 3, hairStyle: 'buzzCut', hairColor: 0, beardStyle: 'stubbleLight', ...noHat },
  'jimmy butler': { skin: 3, hairStyle: 'lowFade', hairColor: 0, beardStyle: 'goatee', ...noHat, expression: 'determined' },
  'paul george': { skin: 3, hairStyle: 'short', hairColor: 0, beardStyle: 'stubbleFull', ...noHat },
  'chris paul': { skin: 3, hairStyle: 'lowFade', hairColor: 0, beardStyle: 'goatee', ...noHat },
  'klay thompson': { skin: 2, hairStyle: 'short', hairColor: 0, beardStyle: 'stubbleLight', ...noHat },
  'draymond green': { skin: 4, hairStyle: 'buzzCut', hairColor: 0, beardStyle: 'goatee', ...noHat, expression: 'determined' },
  'donovan mitchell': { skin: 3, hairStyle: 'buzzCut', hairColor: 0, beardStyle: 'fullShort', ...noHat },
  'jalen brunson': { skin: 2, hairStyle: 'lowFade', hairColor: 0, beardStyle: 'goatee', ...noHat },
  'tyrese haliburton': { skin: 2, hairStyle: 'curlyShort', hairColor: 0, beardStyle: 'none', ...noHat, expression: 'smile' },
  'cade cunningham': { skin: 3, hairStyle: 'short', hairColor: 0, beardStyle: 'none', ...noHat },
  'paolo banchero': { skin: 2, hairStyle: 'curlyShort', hairColor: 0, beardStyle: 'none', ...noHat },
  'chet holmgren': { skin: 0, hairStyle: 'short', hairColor: 2, beardStyle: 'none', ...noHat, expression: 'neutral' },
  'lauri markkanen': { skin: 0, hairStyle: 'short', hairColor: 6, beardStyle: 'stubbleLight', ...noHat, eyeColor: 2 },
  'domantas sabonis': { skin: 0, hairStyle: 'buzzCut', hairColor: 1, beardStyle: 'stubbleFull', ...noHat },
  'karl-anthony towns': { skin: 2, hairStyle: 'curlyShort', hairColor: 0, beardStyle: 'shortRound', ...noHat },
  "de'aaron fox": { skin: 3, hairStyle: 'short', hairColor: 0, beardStyle: 'thinLine', ...noHat },
  'lamelo ball': { skin: 2, hairStyle: 'curlyMedium', hairHex: '#d8b25a', beardStyle: 'none', ...noHat, expression: 'grin' },
  'bronny james': { skin: 3, hairStyle: 'lowFade', hairColor: 0, beardStyle: 'none', ...noHat },
  'rudy gobert': { skin: 3, hairStyle: 'short', hairColor: 0, beardStyle: 'stubbleLight', ...noHat },
  'jamal murray': { skin: 2, hairStyle: 'curlyShort', hairColor: 0, beardStyle: 'goatee', ...noHat },
  'bam adebayo': { skin: 4, hairStyle: 'buzzCut', hairColor: 0, beardStyle: 'stubbleLight', ...noHat },
  'jaylen brown': { skin: 4, hairStyle: 'buzzCut', hairColor: 0, beardStyle: 'fullShort', ...noHat },
  'tyrese maxey': { skin: 3, hairStyle: 'buzzCut', hairColor: 0, beardStyle: 'none', ...noHat, expression: 'smile' },
  'pascal siakam': { skin: 4, hairStyle: 'twists', hairColor: 0, beardStyle: 'goatee', ...noHat },
  'kristaps porzingis': { skin: 0, hairStyle: 'short', hairColor: 2, beardStyle: 'stubbleLight', ...noHat },
  'kevin love': { skin: 0, hairStyle: 'short', hairColor: 2, beardStyle: 'fullShort', ...noHat },
  'blake griffin': { skin: 2, hairStyle: 'buzzCut', hairColor: 0, beardStyle: 'fullShort', ...noHat },
  'derrick rose': { skin: 3, hairStyle: 'buzzCut', hairColor: 0, beardStyle: 'goatee', ...noHat },
  'kemba walker': { skin: 3, hairStyle: 'buzzCut', hairColor: 0, beardStyle: 'goatee', ...noHat },
  'carmelo anthony': { skin: 2, hairStyle: 'cornrows', hairColor: 0, beardStyle: 'goatee', ...hb(6), sleeve: true },
  'dwight howard': { skin: 4, hairStyle: 'buzzCut', hairColor: 0, beardStyle: 'none', ...noHat, expression: 'smile' },
  'yao ming': { skin: 5, hairStyle: 'short', hairColor: 0, beardStyle: 'none', ...noHat, expression: 'neutral' },
  'manu ginobili': { skin: 0, hairStyle: 'short', hairColor: 2, beardStyle: 'none', ...noHat },
  'tony parker': { skin: 2, hairStyle: 'buzzCut', hairColor: 0, beardStyle: 'stubbleLight', ...noHat },
  'pau gasol': { skin: 0, hairStyle: 'medium', hairColor: 1, beardStyle: 'fullShort', ...noHat },
  'steve nash': { skin: 0, hairStyle: 'medium', hairColor: 2, beardStyle: 'stubbleLight', ...noHat },
  'dirk nowitzki': { skin: 5, hairStyle: 'medium', hairColor: 3, beardStyle: 'stubbleLight', ...noHat, eyeColor: 2 },
  'dwyane wade': { skin: 3, hairStyle: 'buzzCut', hairColor: 0, beardStyle: 'goatee', ...noHat },
  'chris bosh': { skin: 3, hairStyle: 'buzzCut', hairColor: 0, beardStyle: 'goatee', ...noHat },
  'paul pierce': { skin: 3, hairStyle: 'buzzCut', hairColor: 0, beardStyle: 'goatee', ...noHat },
  'ray allen': { skin: 3, hairStyle: 'bald', beardStyle: 'none', ...noHat },
  'kevin garnett': { skin: 3, hairStyle: 'bald', beardStyle: 'none', ...noHat, expression: 'determined' },
  'jason kidd': { skin: 3, hairStyle: 'bald', beardStyle: 'none', ...noHat },
  'tracy mcgrady': { skin: 3, hairStyle: 'buzzCut', hairColor: 0, beardStyle: 'goatee', ...noHat, eyeStyle: 'relaxed' },
  'vince carter': { skin: 3, hairStyle: 'buzzCut', hairColor: 0, beardStyle: 'goatee', ...noHat },
  'allen iverson': { skin: 3, hairStyle: 'cornrows', hairColor: 0, beardStyle: 'thinLine', ...noHat, sleeve: true, expression: 'determined' },
  'rasheed wallace': { skin: 4, hairStyle: 'buzzCut', hairColor: 0, beardStyle: 'goatee', ...hb(4) },
  'ben wallace': { skin: 4, hairStyle: 'afroLarge', hairColor: 0, beardStyle: 'goatee', ...hb(0), expression: 'determined' },
  'tim duncan': { skin: 3, hairStyle: 'buzzCut', hairColor: 0, beardStyle: 'none', ...noHat, expression: 'neutral' },
  'kobe bryant': { skin: 2, hairStyle: 'buzzCut', hairColor: 0, beardStyle: 'stubbleLight', ...noHat, expression: 'determined' },
  "shaquille o'neal": { skin: 4, hairStyle: 'bald', beardStyle: 'goatee', ...noHat, expression: 'grin' },
  'gary payton': { skin: 3, hairStyle: 'buzzCut', hairColor: 0, beardStyle: 'goatee', ...noHat },
  'reggie miller': { skin: 3, hairStyle: 'buzzCut', hairColor: 0, beardStyle: 'none', ...noHat },
  'grant hill': { skin: 3, hairStyle: 'buzzCut', hairColor: 0, beardStyle: 'none', ...noHat },
  'alonzo mourning': { skin: 4, hairStyle: 'buzzCut', hairColor: 0, beardStyle: 'goatee', ...noHat },
  'dikembe mutombo': { skin: 7, hairStyle: 'buzzCut', hairColor: 0, beardStyle: 'none', ...noHat, expression: 'smile' },
  // The 80s and 90s
  'michael jordan': { skin: 3, hairStyle: 'bald', beardStyle: 'none', ...noHat, expression: 'determined' },
  'scottie pippen': { skin: 3, hairStyle: 'buzzCut', hairColor: 0, beardStyle: 'mustache', ...noHat },
  'dennis rodman': { skin: 3, hairStyle: 'buzzCut', hairHex: '#3fd16a', beardStyle: 'none', ...noHat },
  'charles barkley': { skin: 3, hairStyle: 'bald', beardStyle: 'none', ...noHat, expression: 'grin' },
  'karl malone': { skin: 3, hairStyle: 'buzzCut', hairColor: 0, beardStyle: 'none', ...noHat },
  'john stockton': { skin: 0, hairStyle: 'short', hairColor: 2, beardStyle: 'none', ...noHat },
  'hakeem olajuwon': { skin: 4, hairStyle: 'afroFlatTop', hairColor: 0, beardStyle: 'goatee', ...noHat },
  'patrick ewing': { skin: 4, hairStyle: 'buzzCut', hairColor: 0, beardStyle: 'mustache', ...noHat },
  'david robinson': { skin: 3, hairStyle: 'buzzCut', hairColor: 0, beardStyle: 'mustache', ...noHat },
  'clyde drexler': { skin: 3, hairStyle: 'buzzCut', hairColor: 0, beardStyle: 'mustache', ...noHat },
  'isiah thomas': { skin: 3, hairStyle: 'afroSmall', hairColor: 0, beardStyle: 'none', ...noHat, expression: 'smile' },
  'magic johnson': { skin: 3, hairStyle: 'afroSmall', hairColor: 0, beardStyle: 'none', ...noHat, expression: 'grin' },
  'larry bird': { skin: 5, hairStyle: 'medium', hairColor: 6, beardStyle: 'mustache', ...noHat, eyeColor: 2 },
  'kevin mchale': { skin: 0, hairStyle: 'medium', hairColor: 1, beardStyle: 'none', ...noHat },
  'james worthy': { skin: 3, hairStyle: 'afroSmall', hairColor: 0, beardStyle: 'none', ...noHat, goggles: true },
  'horace grant': { skin: 4, hairStyle: 'buzzCut', hairColor: 0, beardStyle: 'none', ...noHat, goggles: true },
  'kurt rambis': { skin: 0, hairStyle: 'medium', hairColor: 1, beardStyle: 'mustache', ...noHat, goggles: true },
  'dominique wilkins': { skin: 3, hairStyle: 'afroFlatTop', hairColor: 0, beardStyle: 'none', ...noHat },
  'moses malone': { skin: 4, hairStyle: 'afroSmall', hairColor: 0, beardStyle: 'mustache', ...noHat },
  // The greats before
  'kareem abdul-jabbar': { skin: 3, hairStyle: 'bald', beardStyle: 'none', ...noHat, goggles: true, expression: 'neutral' },
  'julius erving': { skin: 3, hairStyle: 'afroLarge', hairColor: 0, beardStyle: 'goatee', ...noHat },
  'wilt chamberlain': { skin: 3, hairStyle: 'buzzCut', hairColor: 0, beardStyle: 'goatee', ...hb(6) },
  'bill russell': { skin: 4, hairStyle: 'bald', beardStyle: 'goatee', ...noHat },
  'oscar robertson': { skin: 3, hairStyle: 'buzzCut', hairColor: 0, beardStyle: 'none', ...noHat },
  'jerry west': { skin: 0, hairStyle: 'short', hairColor: 2, beardStyle: 'none', ...noHat },
  'elgin baylor': { skin: 3, hairStyle: 'buzzCut', hairColor: 0, beardStyle: 'none', ...noHat },
  'pete maravich': { skin: 0, hairStyle: 'mediumWide', hairColor: 2, beardStyle: 'none', ...noHat },
  'walt frazier': { skin: 3, hairStyle: 'afroSmall', hairColor: 0, beardStyle: 'mustache', ...noHat },
  'bill walton': { skin: 0, hairStyle: 'curlyMedium', hairColor: 5, beardStyle: 'fullShort', ...hb(6) },
  'george gervin': { skin: 3, hairStyle: 'afroMedium', hairColor: 0, beardStyle: 'none', ...noHat, eyeStyle: 'relaxed' },
  'bob cousy': { skin: 0, hairStyle: 'short', hairColor: 1, beardStyle: 'none', ...noHat },
  'george mikan': { skin: 0, hairStyle: 'short', hairColor: 1, beardStyle: 'none', ...noHat, goggles: true },
};

/** Lowercase, no accents, no "Jr."/"III"/year tag: "Luka Dončić" → "luka doncic". */
export function likenessKey(playerId: string): string {
  return playerId.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/ '\d+$/, '').replace(/\s*\(\d{4}\)$/, '').replace(/\s+(Jr\.?|Sr\.?|II|III|IV)$/i, '')
    .replace(/[‘’`]/g, "'").trim().toLowerCase();
}

// ---------------------------------------------------------------- your fixes, on this device

export const LIKENESS_KEY = 'cv-likeness';
export const LIKENESS_EVENT = 'courtvision:likeness';
let overrides: Record<string, L> | null = null;
function readOverrides(): Record<string, L> {
  if (overrides) return overrides;
  try { overrides = JSON.parse(localStorage.getItem(LIKENESS_KEY) ?? '{}') as Record<string, L>; } catch { overrides = {}; }
  if (!overrides || typeof overrides !== 'object') overrides = {};
  return overrides;
}

/** A real player's likeness: your fix for him if you made one, else the built-in one, else none. */
export function likenessOf(playerId: string): L | undefined {
  const k = likenessKey(playerId);
  return readOverrides()[k] ?? REAL_LOOKS[k];
}
export const hasBuiltInLikeness = (playerId: string) => likenessKey(playerId) in REAL_LOOKS;

/** Uses this look for the player everywhere on this device (every league and mode); undefined goes back to the built-in. */
export function setLikeness(playerId: string, look: L | undefined): void {
  const all = { ...readOverrides() };
  const k = likenessKey(playerId);
  if (look) all[k] = look; else delete all[k];
  overrides = all;
  try { localStorage.setItem(LIKENESS_KEY, JSON.stringify(all)); } catch { /* storage blocked */ }
  try { window.dispatchEvent(new Event(LIKENESS_EVENT)); } catch { /* no window */ }
}

// ---------------------------------------------------------------- sharing a look as a code

const FIELDS: (keyof L)[] = ['skin', 'hairStyle', 'hairColor', 'beardStyle', 'hatStyle', 'hatColor', 'eyeColor', 'eyeStyle', 'expression', 'skinHex', 'hairHex', 'hatHex', 'goggles', 'sleeve'];
/** A short shareable code for a look ("CVL1." + base64 of its fields). */
export function likenessCode(look: L): string {
  const compact = FIELDS.map(f => look[f] ?? null);
  while (compact.length && compact[compact.length - 1] == null) compact.pop();
  return `CVL1.${btoa(JSON.stringify(compact)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')}`;
}
/** Reads a look code; null if it isn't one. */
export function readLikenessCode(code: string): L | null {
  const m = /^CVL1\.([A-Za-z0-9_-]+)$/.exec(code.trim());
  if (!m) return null;
  try {
    const arr = JSON.parse(atob(m[1].replace(/-/g, '+').replace(/_/g, '/'))) as unknown[];
    if (!Array.isArray(arr) || arr.length > FIELDS.length) return null;
    const out: Record<string, unknown> = {};
    arr.forEach((v, i) => { if (v != null && (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean')) out[FIELDS[i]] = v; });
    return out as L;
  } catch { return null; }
}
