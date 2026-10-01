import { localRead, type Read } from '../lib/kv';
import { hasOwnerAccess, OWNER_TITLE } from './ownerAccess';
import { totalTrophies, trophyNeed, TROPHY_TITLES } from './trophyRoad';
import { AVATAR_LEVEL_ROAD } from './avatar';
import { readStreak, streakTitles } from '../retention/streak';
import { readPass, passBestTier, passTitles } from '../retention/pass';

/** Complete team sets and legendary cards in the album (read straight from storage; see cards/cards.ts). */
function albumCounts(read: Read): { sets: number; legendary: number } {
  try {
    const album = JSON.parse(read('cv-card-album') ?? '{}') as Record<string, { rarity: string }>;
    const sets = Object.values(JSON.parse(read('cv-card-sets') ?? '{}') as Record<string, { ids: string[] }>);
    return { sets: sets.filter(s => s.ids.every(id => album[id])).length, legendary: Object.values(album).filter(c => c.rarity === 'legendary').length };
  } catch { return { sets: 0, legendary: 0 }; }
}

/*
 * Profile cosmetics: pixel profile icons, name colours, titles, card frames and court floors. Everything is earned by
 * playing (the level road, ranked tiers, achievements, leaderboard placements) or, for a small separate set, comes
 * with the Supporter pass. Nothing here changes a result, so none of it can make anyone stronger.
 *
 * The level road (LEVEL_ROAD) hands out a reward every 5 levels up to 250; the level each road cosmetic opens at is
 * read from it. Leaderboard honors come from the server and are kept in this browser; mode-achievement titles read the
 * achievements this browser has already announced (modeUnlocks.ts); Supporter items read the entitlements (billing).
 */

export type RewardKind = 'icon' | 'color' | 'title' | 'frame' | 'floor' | 'look' | 'avatar' | 'avatarFrame';
export type Rule = { level: number } | { rank: number } | { honor: string } | { mode: string } | { anyHonor: true } | { supporter: true } | { trophies: number } | { album: 'sets' | 'legendary'; n: number } | { owner: number };
/** Animated cosmetics (the Trophy Road): see features.css `.anim-*` and `.icon-anim-*`. */
export type IconAnim = 'flicker' | 'shine' | 'spin' | 'twinkle' | 'flash' | 'glow' | 'bob';
export type ColorAnim = 'flow' | 'shimmer' | 'pulse';
const byTrophies = (kind: 'icon' | 'color', id: string): Rule => ({ trophies: trophyNeed(kind, id) ?? 5_000 });
/** Owner's Box rewards, by your best owner legacy anywhere (see ownerBox.ts). */
export const OWNER_REWARD = { title: 15, skybox: 35, goldSuit: 50, tycoon: 60 } as const;
export const OWNER_TITLES: { title: string; legacy: number }[] = [{ title: 'Team Owner', legacy: OWNER_REWARD.title }, { title: 'Tycoon', legacy: OWNER_REWARD.tycoon }];
/** Your best owner legacy in this browser (the records ownerBox.ts keeps). */
const trophyHow = (r: Rule) => ('trophies' in r ? `${r.trophies.toLocaleString()} trophies` : '');
const ownerHow = (r: Rule) => ('owner' in r ? `Owner legacy ${r.owner}` : '');
const albumHow = (r: Rule) => ('album' in r ? r.album === 'sets' ? `Complete ${r.n} team card set${r.n === 1 ? '' : 's'}` : `Collect ${r.n} legendary cards` : '');
export interface Cosmetic<T extends string = string> { id: T; name: string; rule: Rule; how: string }

/** Every 5 levels, one or two rewards (levels 5 to 250); every 25 levels also an app look (src/theme/themes.ts). */
export const LEVEL_ROAD: [number, RewardKind, string][] = [
  [5, 'icon', 'sneaker'], [5, 'color', 'orange'],
  [10, 'title', 'Scout'], [10, 'floor', 'planks'],
  [15, 'icon', 'whistle'], [15, 'color', 'red'],
  [20, 'title', 'Assistant GM'], [20, 'frame', 'gold'],
  [25, 'icon', 'jersey-red'], [25, 'color', 'sky'], [25, 'look', 'frontoffice'],
  [30, 'floor', 'parquet'], [30, 'icon', 'ball-classic'],
  [35, 'title', 'Floor General'], [35, 'color', 'pink'],
  [40, 'icon', 'clipboard'], [40, 'frame', 'hardwood'],
  [45, 'color', 'mint'], [45, 'icon', 'jersey-blue'],
  [50, 'title', 'Executive'], [50, 'icon', 'star'], [50, 'look', 'hardwood'],
  [55, 'color', 'teal'], [55, 'icon', 'sneaker-red'],
  [60, 'floor', 'blonde'], [60, 'icon', 'lightning'],
  [65, 'title', 'Draft Guru'], [65, 'color', 'lime'],
  [70, 'icon', 'jersey-green'], [70, 'frame', 'neon'],
  [75, 'color', 'violet'], [75, 'icon', 'flame'], [75, 'look', 'blacktop'],
  [80, 'title', 'Architect'], [80, 'icon', 'shotclock'],
  [85, 'color', 'silver'], [85, 'icon', 'sneaker-blue'],
  [90, 'floor', 'midnight'], [90, 'icon', 'jersey-purple'],
  [95, 'title', 'Trade Machine'], [95, 'color', 'bronze'],
  [100, 'icon', 'trophy'], [100, 'frame', 'banner'], [100, 'title', 'Dynasty Builder'], [100, 'look', 'playbook'],
  [105, 'color', 'sand'], [105, 'icon', 'headband'],
  [110, 'icon', 'jersey-teal'], [110, 'title', 'Cap Wizard'],
  [115, 'color', 'coral'], [115, 'icon', 'ball-aba'],
  [120, 'icon', 'rocket'], [120, 'floor', 'asphalt'],
  [125, 'title', 'Basketball Mind'], [125, 'color', 'gold'], [125, 'look', 'handheld'],
  [130, 'icon', 'jersey-black'], [130, 'color', 'lavender'],
  [135, 'title', 'Tactician'], [135, 'icon', 'shield'],
  [140, 'icon', 'sneaker-gold'], [140, 'color', 'crimson'],
  [145, 'icon', 'megaphone'], [145, 'title', 'Showrunner'],
  [150, 'icon', 'crown'], [150, 'frame', 'fire'], [150, 'look', 'broadcast'],
  [155, 'color', 'emerald'], [155, 'icon', 'jersey-white'],
  [160, 'title', 'Mastermind'], [160, 'icon', 'sun'],
  [165, 'icon', 'snowflake'], [165, 'color', 'ice'],
  [170, 'icon', 'ball-ice'], [170, 'title', 'Hall of Fame Executive'],
  [175, 'icon', 'moon'], [175, 'color', 'platinum'], [175, 'look', 'neongrid'],
  [180, 'title', 'Commissioner'], [180, 'icon', 'trophy-bronze'],
  [185, 'icon', 'ball-neon'],
  [190, 'icon', 'trophy-silver'], [190, 'title', 'Hoops Historian'],
  [195, 'title', 'Franchise Savior'],
  [200, 'title', 'Legend'], [200, 'icon', 'crown-ruby'], [200, 'look', 'arcade'],
  [205, 'title', 'Kingmaker'],
  [210, 'color', 'obsidian'],
  [215, 'title', 'Visionary'],
  [220, 'title', 'Dynasty Architect'],
  [225, 'title', 'Living Legend'], [225, 'look', 'comicpop'],
  [230, 'title', 'Hall of Famer'],
  [235, 'title', 'Icon'],
  [240, 'title', 'Immortal'],
  [245, 'title', 'Court Visionary'],
  [250, 'title', 'GOAT GM'], [250, 'color', 'inferno'], [250, 'look', 'championship'],
  // Past 250, a stop every 50 levels up to 750.
  [300, 'title', 'Basketball Sage'], [300, 'icon', 'jersey-rainbow'], [300, 'color', 'cobalt'],
  [350, 'title', 'Court Philosopher'], [350, 'icon', 'crown-diamond'],
  [400, 'title', 'Era Definer'], [400, 'color', 'ultraviolet'], [400, 'icon', 'trophy-diamond'],
  [450, 'title', 'Grandmaster GM'], [450, 'icon', 'shield-gold'],
  [500, 'title', 'Five Hundred Club'], [500, 'color', 'moltencore'], [500, 'icon', 'ball-diamond'],
  [550, 'title', 'Dynasty Emperor'], [550, 'icon', 'rocket-gold'],
  [600, 'title', 'Timeless'], [600, 'color', 'sunrise'],
  [650, 'title', 'Architect of Legends'], [650, 'icon', 'star-rainbow'],
  [700, 'title', 'Legendary Ascendant'], [700, 'color', 'celestialblue'],
  [750, 'title', 'The Final Boss'], [750, 'color', 'infinity'], [750, 'icon', 'goat-gold'],
];
// Profile-picture frames (avatarFrames.ts).
LEVEL_ROAD.push([30, 'avatarFrame', 'rookie'], [120, 'avatarFrame', 'courtside'], [300, 'avatarFrame', 'neon']);
// Your character's pieces on the road (ids are "category:piece"; see AVATAR_LEVEL_ROAD in avatar.ts).
for (const [l, cat, id] of AVATAR_LEVEL_ROAD) LEVEL_ROAD.push([l, 'avatar', `${cat}:${id}`]);
LEVEL_ROAD.sort((a, b) => a[0] - b[0]);
/** The app looks on the road, by id (their colours live in src/theme/themes.ts; a test keeps the names in step). */
export const ROAD_LOOK_NAMES: Record<string, string> = {
  frontoffice: 'Front Office', hardwood: 'Hardwood', blacktop: 'Blacktop', playbook: 'Playbook', handheld: 'Handheld',
  broadcast: '90s Broadcast', neongrid: 'Neon Grid', arcade: '16-bit Arcade', comicpop: 'Comic Pop', championship: 'Championship',
};
/** The level a road reward opens at (undefined when it isn't on the road). */
export const roadLevel = (kind: RewardKind, id: string) => LEVEL_ROAD.find(([, k, i]) => k === kind && i === id)?.[0];
const byRoad = (kind: RewardKind, id: string, fallback = 1): Rule => ({ level: roadLevel(kind, id) ?? fallback });
const levelHow = (r: Rule) => ('level' in r ? (r.level <= 1 ? 'Everyone' : `Level ${r.level}`) : '');

const TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'legend'];

// ---------------------------------------------------------------- icons

export interface IconDef extends Cosmetic { base: string; recolor?: Record<string, string>; anim?: IconAnim; /** Flame colours for the flicker (fire by default; gold on crowns). */ fx?: 'fire' | 'gold' | 'blue' }
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
  // Levels 300 to 750.
  jersey('jersey-rainbow', 'Rainbow jersey', '#b983ff', '#ff6fd8', '#ffd166'),
  icon('crown-diamond', 'Diamond crown', 'crown', { g: '#bfe9ff', G: '#6db8ff', r: '#ffffff', b: '#b983ff' }),
  icon('trophy-diamond', 'Diamond trophy', 'trophy', { g: '#bfe9ff', G: '#6db8ff' }), icon('ball-diamond', 'Diamond ball', 'ball', { o: '#bfe9ff', O: '#6db8ff' }),
  icon('shield-gold', 'Gold shield', 'shield', { b: '#ffd166', B: '#c9971f', w: '#fff3c4' }), icon('rocket-gold', 'Gold rocket', 'rocket', { w: '#ffd166', b: '#ff6fd8' }),
  icon('star-rainbow', 'Rainbow star', 'star', { g: '#ff6fd8', G: '#6db8ff' }), icon('goat-gold', 'Golden GOAT', 'goat', { w: '#ffd166', s: '#c9971f' }),
  // Earned elsewhere.
  { ...icon('diamond', 'Diamond', 'diamond', undefined, { rank: 4 }), how: 'Reach Diamond in a ranked season' },
  { ...icon('ghost', 'Ghost', 'ghost', undefined, { mode: 'pvp-1200' }), how: 'Reach a 1200 PvP rating' },
  { ...icon('medal', 'Medal', 'medal', undefined, { anyHonor: true }), how: 'Place on a leaderboard (see titles)' },
  // The Supporter pass.
  { ...icon('ball-gold', 'Gold ball', 'ball', { o: '#ffd166', O: '#c9971f' }, { supporter: true }), how: 'Supporter pass' },
  { ...icon('sneaker-black', 'Blackout sneaker', 'sneaker', { w: '#2a3546', o: '#ff9d3d', O: '#f4f0e6' }, { supporter: true }), how: 'Supporter pass' },
  { ...jersey('jersey-gold', 'Gold jersey', '#ffd166', '#c9971f', '#0b1018'), rule: { supporter: true }, how: 'Supporter pass' },
  { ...icon('heart', 'Heart', 'heart', undefined, { supporter: true }), how: 'Supporter pass' },
  // The Trophy Road: animated icons.
  ...([
    ['fireball', 'Fireball', 'fireball', undefined, 'flicker'], ['trophy-shine', 'Gleaming trophy', 'trophy', undefined, 'shine'],
    ['crown-spin', 'Spinning crown', 'crown', undefined, 'spin'], ['star-twinkle', 'Twinkling star', 'star', undefined, 'twinkle'],
    ['bolt-strike', 'Lightning strike', 'lightning', undefined, 'flash'], ['ring', 'Championship ring', 'ring', undefined, 'shine'],
    ['diamond-pulse', 'Pulsing diamond', 'diamond', undefined, 'glow'], ['phoenix', 'Phoenix', 'phoenix', undefined, 'flicker'],
    ['meteor', 'Meteor', 'meteor', undefined, 'bob'], ['crown-flame', 'Crown of fire', 'crown', { g: '#ff9d3d', G: '#e85d5d', r: '#ffd166', b: '#ffe066' }, 'flicker'],
    ['goat', 'The GOAT', 'goat', undefined, 'bob'], ['goat-crown', 'Crowned GOAT', 'goatcrown', undefined, 'glow'],
    ['fireball-blue', 'Blue fireball', 'fireball', { o: '#4da3ff', O: '#1f4fd9' }, 'flicker'], ['trophy-diamond-shine', 'Gleaming diamond trophy', 'trophy', { g: '#bfe9ff', G: '#6db8ff' }, 'shine'],
    ['crown-blueflame', 'Crown of blue fire', 'crown', { g: '#9fe7ff', G: '#1f4fd9', r: '#ffffff', b: '#ffffff' }, 'flicker'], ['phoenix-gold', 'Golden phoenix', 'phoenix', { r: '#ffd166', o: '#ffb300' }, 'flicker'],
    ['ball-galaxy', 'Galaxy ball', 'ball', { o: '#6a45c0', O: '#ff7ad9' }, 'twinkle'],
  ] as [string, string, string, Record<string, string> | undefined, IconAnim][]).map(([id, name, base, recolor, anim]) => { const rule = byTrophies('icon', id); return { id, name, base, recolor, anim, rule, how: trophyHow(rule), ...(/blue/.test(id) ? { fx: 'blue' as const } : /gold/.test(id) ? { fx: 'gold' as const } : {}) }; }),
  // The card album.
  { id: 'card-holo', name: 'Holo card', base: 'card', anim: 'shine' as IconAnim, rule: { album: 'sets', n: 3 } as Rule, how: albumHow({ album: 'sets', n: 3 }) },
  // The Owner's Box.
  { id: 'skybox', name: 'Skybox', base: 'skybox', anim: 'glow' as IconAnim, rule: { owner: OWNER_REWARD.skybox } as Rule, how: ownerHow({ owner: OWNER_REWARD.skybox }) },
  { id: 'card-legend', name: 'Legendary card', base: 'card', recolor: { b: '#ffd166', B: '#c9971f' }, anim: 'glow' as IconAnim, rule: { album: 'legendary', n: 10 } as Rule, how: albumHow({ album: 'legendary', n: 10 }) },
];
export type IconId = string;

// ---------------------------------------------------------------- name colours

export type ColorId = string;
const color = (id: string, name: string, css: string, rule: Rule = byRoad('color', id)) => ({ id, name, css, rule, how: levelHow(rule) });
const animated = (id: string, name: string, css: string, anim: ColorAnim) => { const rule = byTrophies('color', id); return { id, name, css, anim, rule, how: trophyHow(rule) }; };
export const NAME_COLORS: (Cosmetic & { css: string; anim?: ColorAnim })[] = [
  color('cream', 'Cream', '#f4f0e6', { level: 1 }),
  color('orange', 'Court orange', '#ff9d3d'), color('red', 'Red', '#ff6b6b'), color('sky', 'Sky', '#6db8ff'), color('pink', 'Pink', '#ff8fc8'),
  color('mint', 'Mint', '#6fdc93'), color('teal', 'Teal', '#4fd6d6'), color('lime', 'Lime', '#b8e05a'), color('violet', 'Violet', '#c79bff'),
  color('silver', 'Silver', '#d7dde6'), color('bronze', 'Bronze', '#d99a5c'), color('sand', 'Sand', '#e6cf9a'), color('coral', 'Coral', '#ff8a6b'),
  color('gold', 'Gold', '#ffd166'), color('lavender', 'Lavender', '#b8a8ff'), color('crimson', 'Crimson', '#ff4d6a'), color('emerald', 'Emerald', '#3fd98a'),
  color('ice', 'Ice', '#bfe6ff'), color('platinum', 'Platinum', 'linear-gradient(90deg, #e8edf3, #9fb0c4, #e8edf3)'),
  color('obsidian', 'Obsidian', 'linear-gradient(90deg, #8a93a6, #f4f0e6, #8a93a6)'),
  color('inferno', 'Inferno', 'linear-gradient(90deg, #ff4d2e, #ff9d3d, #ffd166, #ff9d3d, #ff4d2e)'),
  color('cobalt', 'Cobalt', '#5b84ff'), color('ultraviolet', 'Ultraviolet', '#a66bff'),
  color('moltencore', 'Molten core', 'linear-gradient(90deg, #7a1200, #ff6b2d, #ffd166, #ff6b2d, #7a1200)'),
  color('sunrise', 'Sunrise', 'linear-gradient(90deg, #ff8a6b, #ffd166, #fff3c4, #ffd166, #ff8a6b)'),
  color('celestialblue', 'Celestial blue', 'linear-gradient(90deg, #6db8ff, #ffffff, #b8a8ff, #ffffff, #6db8ff)'),
  color('infinity', 'Infinity', 'linear-gradient(90deg, #ff4d4d, #ffd166, #6fdc93, #6db8ff, #b983ff, #ff6fd8, #ff4d4d)'),
  { ...color('ember', 'Ember', '#ff6b3d', { rank: 5 }), how: 'Reach Legend in a ranked season' },
  { ...color('prism', 'Prism', 'linear-gradient(90deg, #ff9d3d, #ffd166, #6fdc93, #6db8ff, #c79bff)', { honor: 'first' }), how: 'Finish #1 on a leaderboard' },
  { ...color('aurora', 'Aurora', 'linear-gradient(90deg, #6fdc93, #4fd6d6, #b8a8ff, #ff8fc8)', { supporter: true }), how: 'Supporter pass' },
  { ...color('supporter', 'Supporter pink', '#ff5fa2', { supporter: true }), how: 'Supporter pass' },
  // The Trophy Road: animated name colours.
  animated('emberflow', 'Ember flow', 'linear-gradient(90deg, #ff4d2e, #ff9d3d, #ffd166, #ff9d3d, #ff4d2e)', 'flow'),
  animated('neonwave', 'Neon wave', 'linear-gradient(90deg, #ff4dd2, #6fd3ff, #7dff9b, #6fd3ff, #ff4dd2)', 'flow'),
  animated('lava', 'Lava', 'linear-gradient(90deg, #7a1200, #ff3d1f, #ffb347, #ff3d1f, #7a1200)', 'pulse'),
  animated('galaxy', 'Galaxy', 'linear-gradient(90deg, #6a45c0, #ff7ad9, #6fd3ff, #ffffff, #6a45c0)', 'flow'),
  animated('goldrush', 'Gold rush', 'linear-gradient(90deg, #c9971f, #fff3c4, #ffd166, #fff3c4, #c9971f)', 'shimmer'),
  animated('dsheen', 'Diamond sheen', 'linear-gradient(90deg, #6db8ff, #ffffff, #bfe6ff, #ffffff, #6db8ff)', 'shimmer'),
  animated('sunset', 'Sunset', 'linear-gradient(90deg, #ff5f6d, #ffc371, #ff8fc8, #ffc371, #ff5f6d)', 'flow'),
  animated('phantom', 'Phantom', 'linear-gradient(90deg, #5b6b82, #ffffff, #b8a8ff, #ffffff, #5b6b82)', 'pulse'),
  animated('solar', 'Solar flare', 'linear-gradient(90deg, #ff3d1f, #ffe066, #ffffff, #ffe066, #ff3d1f)', 'flow'),
  animated('nebula', 'Nebula', 'linear-gradient(90deg, #3b1d82, #ff4dd2, #4fd6d6, #b983ff, #3b1d82)', 'flow'),
  animated('celestial', 'Celestial', 'linear-gradient(90deg, #ffd166, #ffffff, #8fa8ff, #ffffff, #ffd166)', 'shimmer'),
  { ...animated('holo', 'Holo foil', 'linear-gradient(90deg, #ff8fc8, #6fd3ff, #7dff9b, #ffe38a, #ff8fc8)', 'flow'), rule: { album: 'legendary', n: 5 } as Rule, how: albumHow({ album: 'legendary', n: 5 }) },
  animated('plasma', 'Plasma', 'linear-gradient(90deg, #3fc8ff, #ffffff, #b983ff, #ffffff, #3fc8ff)', 'flow'),
  animated('borealis', 'Borealis', 'linear-gradient(90deg, #1f9e5c, #6fffb0, #4fd6d6, #b8a8ff, #1f9e5c)', 'flow'),
  animated('starfire', 'Starfire', 'linear-gradient(90deg, #ff4d2e, #ffffff, #ffd166, #ffffff, #ff4d2e)', 'shimmer'),
  animated('eternalflame', 'Eternal flame', 'linear-gradient(90deg, #1f4fd9, #4da3ff, #ffffff, #ffd166, #ff4d2e, #1f4fd9)', 'flow'),
  animated('divine', 'Divine', 'linear-gradient(90deg, #fff3c4, #ffd166, #ffffff, #9fe7ff, #ffffff, #ffd166, #fff3c4)', 'shimmer'),
  animated('immortal', 'Immortal', 'linear-gradient(90deg, #ff4d2e, #ffd166, #6fdc93, #4fd6d6, #c79bff, #ff4dd2, #ff4d2e)', 'flow'),
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
  { id: 'ranked-1', title: 'Season Champion', how: '#1 when a ranked season ends', first: true },
  { id: 'ranked-2', title: 'Season Runner-up', how: '#2 when a ranked season ends' },
  { id: 'ranked-3', title: 'Season Podium', how: '#3 when a ranked season ends' },
  { id: 'hunt-week-10', title: 'Weekly Hunter', how: 'Top 10% of a finished Weekly Hunt' },
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
  { mode: 'perfect-82', title: 'Undefeated', how: 'Go 82-0 in the 82-0 Challenge' },
  { mode: 'perfect-98', title: 'Perfection', how: 'Go 82-0 and 16-0 in the 82-0 Challenge' },
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

export interface UnlockContext { level: number; rank: number; honors: string[]; modes: string[]; supporter: boolean; trophies: number; album?: { sets: number; legendary: number }; owner?: number; /** Best daily streak and best Season Pass tier. */ streak?: number; pass?: number; /** The game owner's account: everything is open (ownerAccess.ts). */ staff?: boolean }
/** What unlocks read: the level is passed in; the rest comes from this browser. */
export function unlockContext(level: number, read: Read = localRead): UnlockContext {
  if (hasOwnerAccess(read)) return { level: Math.max(level, 100_000), rank: TIERS.length - 1, honors: HONORS.map(h => h.id), modes: MODE_TITLES.map(t => t.mode), supporter: true, trophies: 1e9, album: { sets: 1e6, legendary: 1e6 }, owner: 1e6, streak: 1e6, pass: 1e6, staff: true };
  return { level, rank: TIERS.indexOf(read('cv-ranked-best') ?? ''), honors: readHonors(read), modes: json<string[]>(read, 'cv-mode-ach-seen', []), supporter: hasEntitlement('supporter', read), trophies: totalTrophies(read), album: albumCounts(read), owner: ownerBest(read), streak: readStreak(read).best, pass: passBestTier(readPass(read)) };
}
export function isOpen(rule: Rule, c: UnlockContext): boolean {
  if (c.staff) return true;
  if ('level' in rule) return c.level >= rule.level;
  if ('rank' in rule) return c.rank >= rule.rank;
  if ('mode' in rule) return c.modes.includes(rule.mode);
  if ('anyHonor' in rule) return c.honors.length > 0;
  if ('supporter' in rule) return c.supporter;
  if ('trophies' in rule) return c.trophies >= rule.trophies;
  if ('owner' in rule) return (c.owner ?? 0) >= rule.owner;
  if ('album' in rule) return (rule.album === 'sets' ? c.album?.sets ?? 0 : c.album?.legendary ?? 0) >= rule.n;
  return rule.honor === 'first' ? c.honors.some(h => HONORS.find(x => x.id === h)?.first) : c.honors.includes(rule.honor);
}

/** Titles from the leaderboards, the modes and the Supporter pass that are open. */
export const earnedExtraTitles = (c: UnlockContext): string[] => [
  ...HONORS.filter(h => c.honors.includes(h.id)).map(h => h.title),
  ...MODE_TITLES.filter(t => c.modes.includes(t.mode)).map(t => t.title),
  ...(c.supporter ? [SUPPORTER_TITLE] : []),
  ...TROPHY_TITLES.filter(t => c.trophies >= t.trophies).map(t => t.id),
  ...ALBUM_TITLES.filter(t => ((t.kind === 'sets' ? c.album?.sets : c.album?.legendary) ?? 0) >= t.n).map(t => t.title),
  ...OWNER_TITLES.filter(t => (c.owner ?? 0) >= t.legacy).map(t => t.title),
  ...streakTitles(c.streak ?? 0), ...passTitles(c.pass ?? 0),
  ...(c.staff ? [OWNER_TITLE] : []),
];
export function ownerBest(read: Read = localRead): number {
  try { return ((JSON.parse(read('cv-owner-records') ?? '[]') as { legacy: number }[]) ?? []).reduce((m, r) => Math.max(m, r.legacy ?? 0), 0); } catch { return 0; }
}
/** Titles from the card album. */
export const ALBUM_TITLES: { title: string; kind: 'sets' | 'legendary'; n: number }[] = [
  { title: 'Collector', kind: 'sets', n: 1 }, { title: 'Set Master', kind: 'sets', n: 10 }, { title: 'Legendary Collector', kind: 'legendary', n: 15 },
];
/** A name colour (the profile field may also carry the title colour after a "|"; see trophyRoad.ts). */
export const colorDef = (id: string | null | undefined) => NAME_COLORS.find(c => c.id === (id ?? '').split('|')[0]) ?? NAME_COLORS[0];
export const colorCss = (id: string | null | undefined) => colorDef(id).css;
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
  fireball: ['..........', '..........', '...kkkk...', '..kooOok..', '.koOoOoOk.', '.kOOOOOOk.', '.kooOoOok.', '.koOooOok.', '..kooOok..', '...kkkk...'],
  ring: ['...kkkk...', '..kbwbBk..', '.kgkbbkGk.', 'kgk.kk.kGk', 'kgk....kGk', 'kgk....kGk', 'kgk....kGk', '.kgk..kGk.', '..kggGGk..', '...kkkk...'],
  phoenix: ['k........k', 'rk......kr', 'ork.kk.kro', '.orkggkro.', '..okgwko..', '...kggk...', '..orggro..', '.or.rr.ro.', '.r..or..r.', '....r.....'],
  meteor: ['o.........', '.oo.......', '..ooo.....', '...ookkk..', '....kgggk.', '...kgwgGGk', '...kggGGGk', '...kgGGGGk', '....kGGGk.', '.....kkk..'],
  goat: ['k.......k.', 'kk.....kk.', '.kwkkkkwk.', '.kwwwwwwk.', 'kwkwwwwkwk', '.kwwwwwwk.', '..kwwwwk..', '..kwkkwk..', '...kwwk...', '...kssk...'],
  goatcrown: ['.g.g..g.g.', '.gggggggg.', '.kGGGGGGk.', '.kwkkkkwk.', '.kwwwwwwk.', 'kwkwwwwkwk', '.kwwwwwwk.', '..kwwwwk..', '..kwkkwk..', '...kssk...'],
  skybox: ['kkkkkkkkkk', 'kggggggggk', 'kgbwgbwgGk', 'kgbbgbbgGk', 'kggggggggk', 'kkkkkkkkkk', '.kdddddddk', '.kdwdwdwdk', '.kdddddddk', '.kkkkkkkk.'],
  card: ['.kkkkkkkk.', 'kbbbbbbbbk', 'kbwwwwwwBk', 'kbwoowwwBk', 'kbwoowwwBk', 'kbwwwwwwBk', 'kbwkkkkwBk', 'kbwwwwwwBk', 'kBBBBBBBBk', '.kkkkkkkk.'],
  heart: ['..........', '.kkk..kkk.', 'krrrkkrrrk', 'krwrrrrrrk', 'krrrrrrrrk', '.krrrrrrk.', '..krrrrk..', '...krrk...', '....kk....', '..........'],
};
