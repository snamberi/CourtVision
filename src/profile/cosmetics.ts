import { localRead, type Read } from '../lib/kv';

/*
 * Profile cosmetics beyond frames and floors: a pixel profile icon, a name colour, and titles earned on the
 * leaderboards and in the modes. Everything is earned by playing (levels, ranked tiers, achievements, board
 * placements); nothing here changes a result, so none of it can make anyone stronger.
 *
 * Leaderboard honors come from the server (it compares you with everyone at sync time) and are kept in this browser;
 * mode-achievement titles read the achievements this browser has already announced (modeUnlocks.ts).
 */

export type IconId = 'ball' | 'hoop' | 'sneaker' | 'whistle' | 'clipboard' | 'star' | 'flame' | 'trophy' | 'crown' | 'diamond' | 'ghost' | 'medal';
export type ColorId = 'cream' | 'orange' | 'sky' | 'mint' | 'violet' | 'gold' | 'ember' | 'prism';
export type Rule = { level: number } | { rank: number } | { honor: string } | { mode: string } | { anyHonor: true };
export interface Cosmetic<T extends string> { id: T; name: string; rule: Rule; how: string }

const TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'legend'];

export const ICONS: Cosmetic<IconId>[] = [
  { id: 'ball', name: 'Basketball', rule: { level: 1 }, how: 'Everyone' },
  { id: 'hoop', name: 'Hoop', rule: { level: 1 }, how: 'Everyone' },
  { id: 'sneaker', name: 'Sneaker', rule: { level: 3 }, how: 'Level 3' },
  { id: 'whistle', name: 'Whistle', rule: { level: 5 }, how: 'Level 5' },
  { id: 'clipboard', name: 'Clipboard', rule: { level: 8 }, how: 'Level 8' },
  { id: 'star', name: 'All-Star', rule: { level: 12 }, how: 'Level 12' },
  { id: 'flame', name: 'Heater', rule: { level: 18 }, how: 'Level 18' },
  { id: 'trophy', name: 'Trophy', rule: { level: 25 }, how: 'Level 25' },
  { id: 'crown', name: 'Crown', rule: { level: 35 }, how: 'Level 35' },
  { id: 'diamond', name: 'Diamond', rule: { rank: 4 }, how: 'Reach Diamond in a ranked season' },
  { id: 'ghost', name: 'Ghost', rule: { mode: 'pvp-1200' }, how: 'Reach a 1200 PvP rating' },
  { id: 'medal', name: 'Medal', rule: { anyHonor: true }, how: 'Place on a leaderboard (see titles)' },
];

export const NAME_COLORS: (Cosmetic<ColorId> & { css: string })[] = [
  { id: 'cream', name: 'Cream', css: '#f4f0e6', rule: { level: 1 }, how: 'Everyone' },
  { id: 'orange', name: 'Court orange', css: '#ff9d3d', rule: { level: 4 }, how: 'Level 4' },
  { id: 'sky', name: 'Sky', css: '#6db8ff', rule: { level: 8 }, how: 'Level 8' },
  { id: 'mint', name: 'Mint', css: '#6fdc93', rule: { level: 12 }, how: 'Level 12' },
  { id: 'violet', name: 'Violet', css: '#c79bff', rule: { level: 18 }, how: 'Level 18' },
  { id: 'gold', name: 'Gold', css: '#ffd166', rule: { level: 25 }, how: 'Level 25' },
  { id: 'ember', name: 'Ember', css: '#ff6b3d', rule: { rank: 5 }, how: 'Reach Legend in a ranked season' },
  { id: 'prism', name: 'Prism', css: 'linear-gradient(90deg, #ff9d3d, #ffd166, #6fdc93, #6db8ff, #c79bff)', rule: { honor: 'first' }, how: 'Finish #1 on a leaderboard' },
];

/** Leaderboard honors the server can grant (see server/honors.ts). `first` is any #1. */
export const HONORS: { id: string; title: string; how: string; first?: boolean }[] = [
  { id: 'gm-1', title: '#1 GM', how: '#1 on the GM leaderboard', first: true },
  { id: 'gm-10', title: 'Top 10 GM', how: 'Top 10 on the GM leaderboard' },
  { id: 'gm-100', title: 'Top 100 GM', how: 'Top 100 on the GM leaderboard' },
  { id: 'weekly-1', title: 'Weekly Champion', how: '#1 on a finished weekly board', first: true },
  { id: 'daily-1', title: 'Daily Legend Champion', how: '#1 on a finished Daily Legend board', first: true },
  { id: 'ranked-10', title: 'Ranked Top 10', how: 'Top 10 in a ranked season' },
  { id: 'pvp-10', title: 'PvP Elite', how: 'Top 10 in Hunt PvP' },
];

/** Titles earned by mode achievements. */
export const MODE_TITLES: { mode: string; title: string; how: string }[] = [
  { mode: 'career-hof', title: 'Hall of Fame Maker', how: 'Put a created player in the Hall of Fame' },
  { mode: 'career-top10', title: 'Pantheon', how: 'Retire a created player in the all-time Top 10' },
  { mode: 'hunt-legend', title: 'Legend Slayer', how: 'Win a League Hunt on Legend' },
  { mode: 'rebuild-architect', title: 'Master Builder', how: 'Three stars in five rebuilds' },
  { mode: 'draft-title', title: 'All-Time Champion', how: 'Win a title with an All-Time Draft team' },
  { mode: 'pvp-ten', title: 'Ghost Hunter', how: 'Win ten PvP series' },
  { mode: 'goals-streak', title: 'The Grinder', how: 'Daily goals seven days in a row' },
];

export const HONORS_KEY = 'cv-board-honors';
const json = <T>(read: Read, key: string, fallback: T): T => { try { return (JSON.parse(read(key) ?? 'null') as T) ?? fallback; } catch { return fallback; } };
/** Leaderboard honors kept in this browser (granted by the server at sync). */
export const readHonors = (read: Read = localRead): string[] => json<string[]>(read, HONORS_KEY, []).filter(h => HONORS.some(x => x.id === h));
export function noteHonors(honors: unknown): void {
  if (!Array.isArray(honors)) return;
  const next = [...new Set([...readHonors(), ...honors.filter((h): h is string => typeof h === 'string')])].filter(h => HONORS.some(x => x.id === h)).sort();
  try { if (JSON.stringify(next) !== localStorage.getItem(HONORS_KEY)) localStorage.setItem(HONORS_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
}

export interface UnlockContext { level: number; rank: number; honors: string[]; modes: string[] }
/** What unlocks read: the level is passed in; the rest comes from this browser. */
export function unlockContext(level: number, read: Read = localRead): UnlockContext {
  return { level, rank: TIERS.indexOf(read('cv-ranked-best') ?? ''), honors: readHonors(read), modes: json<string[]>(read, 'cv-mode-ach-seen', []) };
}
export function isOpen(rule: Rule, c: UnlockContext): boolean {
  if ('level' in rule) return c.level >= rule.level;
  if ('rank' in rule) return c.rank >= rule.rank;
  if ('mode' in rule) return c.modes.includes(rule.mode);
  if ('anyHonor' in rule) return c.honors.length > 0;
  return rule.honor === 'first' ? c.honors.some(h => HONORS.find(x => x.id === h)?.first) : c.honors.includes(rule.honor);
}

/** Titles from the leaderboards and the modes that are open. */
export const earnedExtraTitles = (c: UnlockContext): string[] => [
  ...HONORS.filter(h => c.honors.includes(h.id)).map(h => h.title),
  ...MODE_TITLES.filter(t => c.modes.includes(t.mode)).map(t => t.title),
];
export const colorCss = (id: string | null | undefined) => (NAME_COLORS.find(c => c.id === id) ?? NAME_COLORS[0]).css;

// ---------------------------------------------------------------- the pixel icons (10 x 10)

/** Each icon as rows of palette letters ('.' is empty). */
export const PALETTE: Record<string, string> = {
  k: '#0b1018', o: '#f47b20', O: '#b8561a', w: '#f4f0e6', s: '#94a0b2', g: '#ffd166', G: '#c9971f', r: '#e85d5d', b: '#4da3ff', B: '#2f6fb8', n: '#55c878', p: '#b983ff', P: '#7e4fc9', d: '#5b6b82',
};
export const ICON_PIXELS: Record<IconId, string[]> = {
  ball: ['...kkkk...', '..kooOok..', '.koOoOooOk', 'kooOoOoook', 'kOOOOOOOOk', 'koooOoOook', 'kooOooOook', '.kooOooOk.', '..kooOok..', '...kkkk...'],
  hoop: ['kkkkkkkkkk', 'kwwwwwwwwk', 'kwwkkkkwwk', 'kwwkwwkwwk', 'kkkkkkkkkk', '.oooooooo.', '.kwkwkwkw.', '..wkwkwk..', '..kwkwkw..', '...wkwk...'],
  sneaker: ['..........', '..kkkk....', '..kwwk....', '..kwwkkk..', '.kwwwwwwk.', 'kwwoowwwwk', 'kwwoowwwwk', 'kkkkkkkkkk', 'kOOOOOOOOk', '.kkkkkkkk.'],
  whistle: ['....kkkkk.', '...kssssk.', 'kkkksswssk', 'kssssssssk', 'kssssssssk', '.kssswssk.', '..kssssk..', '...kkkk...', '....k.....', '...ooo....'],
  clipboard: ['...kkkk...', '.kkssssk..', 'kOOkkkkOOk', 'kOwwwwwwOk', 'kOwkkkwwOk', 'kOwwwwwwOk', 'kOwkkkkwOk', 'kOwwwwwwOk', 'kOwkkwwwOk', 'kkkkkkkkkk'],
  star: ['....kk....', '....gk....', '...kggk...', 'kkkggggkkk', 'kgggggggGk', '.kgggggGk.', '..kggggk..', '.kggkkgGk.', '.kgk..kGk.', '.kk....kk.'],
  flame: ['....k.....', '...kok....', '...koOk.k.', '..koOok.ok', '.koOgOokok', '.koggOOoOk', 'koggwgOoOk', 'kogwwwgOok', '.kogwgOok.', '..kkkkkk..'],
  trophy: ['.kkkkkkkk.', 'kgggggggGk', 'kgkggggkGk', 'kgkggggkGk', '.kgggggGk.', '..kgggGk..', '...kgGk...', '...kgGk...', '..kGGGGk..', '.kkkkkkkk.'],
  crown: ['..........', 'k...kk...k', 'kg.kggk.gk', 'kgkgggGkGk', 'kgggrggGGk', 'kgggggggGk', 'kgbgggbgGk', 'kggggggGGk', 'kGGGGGGGGk', 'kkkkkkkkkk'],
  diamond: ['..........', '..kkkkkk..', '.kbwbbBbk.', 'kbwbbbbBBk', 'kkkkkkkkkk', '.kbbbbBBk.', '..kbbbBk..', '...kbBk...', '....kk....', '..........'],
  ghost: ['...kkkk...', '..kwwwwk..', '.kwwwwwwk.', '.kwkwwkwk.', '.kwkwwkwk.', '.kwwwwwwk.', '.kwwwwwwk.', '.kwwwwwwk.', '.kwkwwkwk.', '.kk.kk.kk.'],
  medal: ['.kkk..kkk.', '.kBk..krk.', '..kBkkrk..', '...kkkk...', '..kggggk..', '.kggwggGk.', '.kgwgggGk.', '.kggggGGk.', '..kgGGGk..', '...kkkk...'],
};
