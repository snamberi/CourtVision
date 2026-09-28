import { localRead, type Read } from '../lib/kv';

/*
 * Profile cosmetics: pixel profile icons, name colours, titles, card frames and court floors. Everything is earned by
 * playing (the level road, ranked tiers, achievements, leaderboard placements) or, for a small separate set, comes
 * with the Supporter pass. Nothing here changes a result, so none of it can make anyone stronger.
 *
 * The level road (LEVEL_ROAD) hands out a reward every 5 levels up to 250; the level each road cosmetic opens at is
 * read from it. Leaderboard honors come from the server and are kept in this browser; mode-achievement titles read the
 * achievements this browser has already announced (modeUnlocks.ts); Supporter items read the entitlements (billing).
 */

export type RewardKind = 'icon' | 'color' | 'title' | 'frame' | 'floor';
export type Rule = { level: number } | { rank: number } | { honor: string } | { mode: string } | { anyHonor: true } | { supporter: true };
export interface Cosmetic<T extends string = string> { id: T; name: string; rule: Rule; how: string }

/** Every 5 levels, one or two rewards (levels 5 to 250). */
export const LEVEL_ROAD: [number, RewardKind, string][] = [
  [5, 'icon', 'sneaker'], [5, 'color', 'orange'],
  [10, 'title', 'Scout'], [10, 'floor', 'planks'],
  [15, 'icon', 'whistle'], [15, 'color', 'red'],
  [20, 'title', 'Assistant GM'], [20, 'frame', 'gold'],
  [25, 'icon', 'jersey-red'], [25, 'color', 'sky'],
  [30, 'floor', 'parquet'], [30, 'icon', 'ball-classic'],
  [35, 'title', 'Floor General'], [35, 'color', 'pink'],
  [40, 'icon', 'clipboard'], [40, 'frame', 'hardwood'],
  [45, 'color', 'mint'], [45, 'icon', 'jersey-blue'],
  [50, 'title', 'Executive'], [50, 'icon', 'star'],
  [55, 'color', 'teal'], [55, 'icon', 'sneaker-red'],
  [60, 'floor', 'blonde'], [60, 'icon', 'lightning'],
  [65, 'title', 'Draft Guru'], [65, 'color', 'lime'],
  [70, 'icon', 'jersey-green'], [70, 'frame', 'neon'],
  [75, 'color', 'violet'], [75, 'icon', 'flame'],
  [80, 'title', 'Architect'], [80, 'icon', 'shotclock'],
  [85, 'color', 'silver'], [85, 'icon', 'sneaker-blue'],
  [90, 'floor', 'midnight'], [90, 'icon', 'jersey-purple'],
  [95, 'title', 'Trade Machine'], [95, 'color', 'bronze'],
  [100, 'icon', 'trophy'], [100, 'frame', 'banner'], [100, 'title', 'Dynasty Builder'],
  [105, 'color', 'sand'], [105, 'icon', 'headband'],
  [110, 'icon', 'jersey-teal'], [110, 'title', 'Cap Wizard'],
  [115, 'color', 'coral'], [115, 'icon', 'ball-aba'],
  [120, 'icon', 'rocket'], [120, 'floor', 'asphalt'],
  [125, 'title', 'Basketball Mind'], [125, 'color', 'gold'],
  [130, 'icon', 'jersey-black'], [130, 'color', 'lavender'],
  [135, 'title', 'Tactician'], [135, 'icon', 'shield'],
  [140, 'icon', 'sneaker-gold'], [140, 'color', 'crimson'],
  [145, 'icon', 'megaphone'], [145, 'title', 'Showrunner'],
  [150, 'icon', 'crown'], [150, 'frame', 'fire'],
  [155, 'color', 'emerald'], [155, 'icon', 'jersey-white'],
  [160, 'title', 'Mastermind'], [160, 'icon', 'sun'],
  [165, 'icon', 'snowflake'], [165, 'color', 'ice'],
  [170, 'icon', 'ball-ice'], [170, 'title', 'Hall of Fame Executive'],
  [175, 'icon', 'moon'], [175, 'color', 'platinum'],
  [180, 'title', 'Commissioner'], [180, 'icon', 'trophy-bronze'],
  [185, 'icon', 'ball-neon'],
  [190, 'icon', 'trophy-silver'], [190, 'title', 'Hoops Historian'],
  [195, 'title', 'Franchise Savior'],
  [200, 'title', 'Legend'], [200, 'icon', 'crown-ruby'],
  [205, 'title', 'Kingmaker'],
  [210, 'color', 'obsidian'],
  [215, 'title', 'Visionary'],
  [220, 'title', 'Dynasty Architect'],
  [225, 'title', 'Living Legend'],
  [230, 'title', 'Hall of Famer'],
  [235, 'title', 'Icon'],
  [240, 'title', 'Immortal'],
  [245, 'title', 'Court Visionary'],
  [250, 'title', 'GOAT GM'], [250, 'color', 'inferno'],
];
/** The level a road reward opens at (undefined when it isn't on the road). */
export const roadLevel = (kind: RewardKind, id: string) => LEVEL_ROAD.find(([, k, i]) => k === kind && i === id)?.[0];
const byRoad = (kind: RewardKind, id: string, fallback = 1): Rule => ({ level: roadLevel(kind, id) ?? fallback });
const levelHow = (r: Rule) => ('level' in r ? (r.level <= 1 ? 'Everyone' : `Level ${r.level}`) : '');

const TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'legend'];

// ---------------------------------------------------------------- icons

export interface IconDef extends Cosmetic { base: string; recolor?: Record<string, string> }
const icon = (id: string, name: string, base = id, recolor?: Record<string, string>, rule: Rule = byRoad('icon', id)): IconDef =>
  ({ id, name, base, recolor, rule, how: levelHow(rule) });
const jersey = (id: string, name: string, main: string, dark: string, trim = '#f4f0e6') => icon(id, name, 'jersey', { j: main, J: dark, w: trim });

export const ICONS: IconDef[] = [
  icon('ball', 'Basketball', 'ball', undefined, { level: 1 }),
  icon('hoop', 'Hoop', 'hoop', undefined, { level: 1 }),
  icon('sneaker', 'Sneaker'), icon('whistle', 'Whistle'), icon('clipboard', 'Clipboard'), icon('star', 'All-Star'), icon('flame', 'Heater'),
  icon('trophy', 'Trophy'), icon('crown', 'Crown'),
  // The level road's 26 new icons.
  jersey('jersey-red', 'Red jersey', '#e85d5d', '#a83232'), jersey('jersey-blue', 'Blue jersey', '#4da3ff', '#2f6fb8'),
  jersey('jersey-green', 'Green jersey', '#55c878', '#2f8a4f'), jersey('jersey-purple', 'Purple jersey', '#b983ff', '#7e4fc9'),
  jersey('jersey-teal', 'Teal jersey', '#3fc1c9', '#23828a'), jersey('jersey-black', 'Black jersey', '#2a3546', '#121926'),
  jersey('jersey-white', 'Home whites', '#f4f0e6', '#c9ced8', '#f47b20'),
  icon('ball-classic', 'Leather ball', 'ball', { o: '#a0522d', O: '#6b3515' }), icon('ball-aba', 'ABA ball', 'ball', { o: '#e85d5d', O: '#4da3ff' }),
  icon('ball-ice', 'Ice ball', 'ball', { o: '#bfe6ff', O: '#4da3ff' }), icon('ball-neon', 'Neon ball', 'ball', { o: '#6fdc93', O: '#ff4dd2' }),
  icon('sneaker-red', 'Red sneaker', 'sneaker', { w: '#e85d5d', o: '#f4f0e6' }), icon('sneaker-blue', 'Blue sneaker', 'sneaker', { w: '#4da3ff', o: '#f4f0e6' }),
  icon('sneaker-gold', 'Gold sneaker', 'sneaker', { w: '#ffd166', o: '#0b1018' }),
  icon('trophy-silver', 'Silver trophy', 'trophy', { g: '#d7dde6', G: '#94a0b2' }), icon('trophy-bronze', 'Bronze trophy', 'trophy', { g: '#d08a4a', G: '#8c5a2b' }),
  icon('crown-ruby', 'Ruby crown', 'crown', { g: '#e85d5d', G: '#a83232', r: '#ffd166' }),
  icon('lightning', 'Lightning'), icon('shotclock', 'Shot clock'), icon('rocket', 'Rocket'), icon('headband', 'Headband'), icon('shield', 'Shield'),
  icon('megaphone', 'Megaphone'), icon('sun', 'Sun'), icon('moon', 'Moon'), icon('snowflake', 'Snowflake'),
  // Earned elsewhere.
  { ...icon('diamond', 'Diamond', 'diamond', undefined, { rank: 4 }), how: 'Reach Diamond in a ranked season' },
  { ...icon('ghost', 'Ghost', 'ghost', undefined, { mode: 'pvp-1200' }), how: 'Reach a 1200 PvP rating' },
  { ...icon('medal', 'Medal', 'medal', undefined, { anyHonor: true }), how: 'Place on a leaderboard (see titles)' },
  // The Supporter pass.
  { ...icon('ball-gold', 'Gold ball', 'ball', { o: '#ffd166', O: '#c9971f' }, { supporter: true }), how: 'Supporter pass' },
  { ...icon('sneaker-black', 'Blackout sneaker', 'sneaker', { w: '#2a3546', o: '#ff9d3d', O: '#f4f0e6' }, { supporter: true }), how: 'Supporter pass' },
  { ...jersey('jersey-gold', 'Gold jersey', '#ffd166', '#c9971f', '#0b1018'), rule: { supporter: true }, how: 'Supporter pass' },
  { ...icon('heart', 'Heart', 'heart', undefined, { supporter: true }), how: 'Supporter pass' },
];
export type IconId = string;

// ---------------------------------------------------------------- name colours

export type ColorId = string;
const color = (id: string, name: string, css: string, rule: Rule = byRoad('color', id)) => ({ id, name, css, rule, how: levelHow(rule) });
export const NAME_COLORS: (Cosmetic & { css: string })[] = [
  color('cream', 'Cream', '#f4f0e6', { level: 1 }),
  color('orange', 'Court orange', '#ff9d3d'), color('red', 'Red', '#ff6b6b'), color('sky', 'Sky', '#6db8ff'), color('pink', 'Pink', '#ff8fc8'),
  color('mint', 'Mint', '#6fdc93'), color('teal', 'Teal', '#4fd6d6'), color('lime', 'Lime', '#b8e05a'), color('violet', 'Violet', '#c79bff'),
  color('silver', 'Silver', '#d7dde6'), color('bronze', 'Bronze', '#d99a5c'), color('sand', 'Sand', '#e6cf9a'), color('coral', 'Coral', '#ff8a6b'),
  color('gold', 'Gold', '#ffd166'), color('lavender', 'Lavender', '#b8a8ff'), color('crimson', 'Crimson', '#ff4d6a'), color('emerald', 'Emerald', '#3fd98a'),
  color('ice', 'Ice', '#bfe6ff'), color('platinum', 'Platinum', 'linear-gradient(90deg, #e8edf3, #9fb0c4, #e8edf3)'),
  color('obsidian', 'Obsidian', 'linear-gradient(90deg, #8a93a6, #f4f0e6, #8a93a6)'),
  color('inferno', 'Inferno', 'linear-gradient(90deg, #ff4d2e, #ff9d3d, #ffd166, #ff9d3d, #ff4d2e)'),
  { ...color('ember', 'Ember', '#ff6b3d', { rank: 5 }), how: 'Reach Legend in a ranked season' },
  { ...color('prism', 'Prism', 'linear-gradient(90deg, #ff9d3d, #ffd166, #6fdc93, #6db8ff, #c79bff)', { honor: 'first' }), how: 'Finish #1 on a leaderboard' },
  { ...color('aurora', 'Aurora', 'linear-gradient(90deg, #6fdc93, #4fd6d6, #b8a8ff, #ff8fc8)', { supporter: true }), how: 'Supporter pass' },
  { ...color('supporter', 'Supporter pink', '#ff5fa2', { supporter: true }), how: 'Supporter pass' },
];

/** Titles on the level road, in order (Rookie GM is everyone's first). */
export const ROAD_TITLES = ['Rookie GM', ...LEVEL_ROAD.filter(([, k]) => k === 'title').map(([, , id]) => id)];
export const SUPPORTER_TITLE = 'Supporter';

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
/** Passes bought (written from the account by src/billing/billing.ts). */
export const ENTITLEMENTS_KEY = 'cv-entitlements';
const json = <T>(read: Read, key: string, fallback: T): T => { try { return (JSON.parse(read(key) ?? 'null') as T) ?? fallback; } catch { return fallback; } };
/** Leaderboard honors kept in this browser (granted by the server at sync). */
export const readHonors = (read: Read = localRead): string[] => json<string[]>(read, HONORS_KEY, []).filter(h => HONORS.some(x => x.id === h));
export function noteHonors(honors: unknown): void {
  if (!Array.isArray(honors)) return;
  const next = [...new Set([...readHonors(), ...honors.filter((h): h is string => typeof h === 'string')])].filter(h => HONORS.some(x => x.id === h)).sort();
  try { if (JSON.stringify(next) !== localStorage.getItem(HONORS_KEY)) localStorage.setItem(HONORS_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
}
/** Whether this browser's account has an active pass (`noAds`, `supporter`). */
export function hasEntitlement(kind: 'noAds' | 'supporter', read: Read = localRead): boolean {
  const e = json<{ noAds?: boolean; supporter?: boolean; supporterUntil?: string | null }>(read, ENTITLEMENTS_KEY, {});
  // A lapsed subscription ends on its date even before the game next hears from the server.
  const supporter = !!e.supporter && (!e.supporterUntil || Date.parse(e.supporterUntil) > Date.now());
  return kind === 'noAds' ? !!e.noAds || supporter : supporter;
}

export interface UnlockContext { level: number; rank: number; honors: string[]; modes: string[]; supporter: boolean }
/** What unlocks read: the level is passed in; the rest comes from this browser. */
export function unlockContext(level: number, read: Read = localRead): UnlockContext {
  return { level, rank: TIERS.indexOf(read('cv-ranked-best') ?? ''), honors: readHonors(read), modes: json<string[]>(read, 'cv-mode-ach-seen', []), supporter: hasEntitlement('supporter', read) };
}
export function isOpen(rule: Rule, c: UnlockContext): boolean {
  if ('level' in rule) return c.level >= rule.level;
  if ('rank' in rule) return c.rank >= rule.rank;
  if ('mode' in rule) return c.modes.includes(rule.mode);
  if ('anyHonor' in rule) return c.honors.length > 0;
  if ('supporter' in rule) return c.supporter;
  return rule.honor === 'first' ? c.honors.some(h => HONORS.find(x => x.id === h)?.first) : c.honors.includes(rule.honor);
}

/** Titles from the leaderboards, the modes and the Supporter pass that are open. */
export const earnedExtraTitles = (c: UnlockContext): string[] => [
  ...HONORS.filter(h => c.honors.includes(h.id)).map(h => h.title),
  ...MODE_TITLES.filter(t => c.modes.includes(t.mode)).map(t => t.title),
  ...(c.supporter ? [SUPPORTER_TITLE] : []),
];
export const colorCss = (id: string | null | undefined) => (NAME_COLORS.find(c => c.id === id) ?? NAME_COLORS[0]).css;
export const iconDef = (id: string | null | undefined) => ICONS.find(i => i.id === id) ?? ICONS[0];

// ---------------------------------------------------------------- the pixel sprites (10 x 10)

/** The palette letters ('.' is empty); an icon's `recolor` swaps letters for its own colours. */
export const PALETTE: Record<string, string> = {
  k: '#0b1018', o: '#f47b20', O: '#b8561a', w: '#f4f0e6', s: '#94a0b2', g: '#ffd166', G: '#c9971f', r: '#e85d5d', b: '#4da3ff', B: '#2f6fb8', n: '#55c878', p: '#b983ff', P: '#7e4fc9', d: '#5b6b82',
  j: '#f47b20', J: '#b8561a',
};
export const SPRITES: Record<string, string[]> = {
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
  jersey: ['..kk..kk..', '.kjjkkjjk.', 'kjjjwwjjjk', 'kjjjjjjjjk', '.kjjwwjjk.', '.kjjjwjjk.', '.kjjwwjjk.', '.kjjjjjjk.', '.kJJJJJJk.', '.kkkkkkkk.'],
  lightning: ['.....kkkk.', '....kggk..', '...kggk...', '..kgggkkk.', '.kggggggk.', '.kkkkgggk.', '....kggk..', '...kggk...', '..kgk.....', '..kk......'],
  shotclock: ['kkkkkkkkkk', 'kddddddddk', 'kdrrdrrrdk', 'kddrdrdrdk', 'kdrrdrrrdk', 'kdrddddrdk', 'kdrrdddrdk', 'kddddddddk', 'kkkkkkkkkk', '...kkkk...'],
  rocket: ['....kk....', '...kwwk...', '...kwwk...', '..kwbbwk..', '..kwbbwk..', '..kwwwwk..', '.kkwwwwkk.', '.krkwwkrk.', '..k.oo.k..', '....oo....'],
  headband: ['..........', '...kkkk...', '..kwwwwk..', '.kkkkkkkk.', 'krrrrrrrrk', 'kwwwwwwwwk', 'krrrrrrrrk', '.kkkkkkkk.', '..........', '..........'],
  shield: ['.kkkkkkkk.', 'kbbbbwbbbk', 'kbbbbwbbbk', 'kwwwwwwwwk', 'kbbbbwbbbk', '.kbbbwbbk.', '.kbbbwbbk.', '..kbbwbk..', '...kbbk...', '....kk....'],
  megaphone: ['.......kk.', '.....kkok.', '...kkooOk.', 'kkkooooOk.', 'kwkooooOk.', 'kkkooooOk.', '...kkooOk.', '.....kkok.', '.......kk.', '..........'],
  sun: ['....kk....', '.k.kggk.k.', '..kggggk..', '.kggwwggk.', 'kgggwwgggk', 'kgggggggGk', '.kggggggk.', '..kgGGgk..', '.k.kGGk.k.', '....kk....'],
  moon: ['...kkkk...', '..kwwwk...', '.kwwwk....', '.kwwk.....', 'kwwwk.....', 'kwwwk.....', '.kwwk.....', '.kwwwk....', '..kwwwk...', '...kkkk...'],
  snowflake: ['....b.....', '.b..b..b..', '..b.b.b...', '...bbb....', 'bbbbwbbbb.', '...bbb....', '..b.b.b...', '.b..b..b..', '....b.....', '..........'],
  heart: ['..........', '.kkk..kkk.', 'krrrkkrrrk', 'krwrrrrrrk', 'krrrrrrrrk', '.krrrrrrk.', '..krrrrk..', '...krrk...', '....kk....', '..........'],
};
