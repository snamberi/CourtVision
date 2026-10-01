import { readLegacy, legacyTotals } from '../storage/gmLegacy';
import { loadRecords } from '../hunt/storage';
import { loadRebuildRecords } from '../simulation/rebuildChallenge';
import { loadWeeklyRecords } from '../retention/weekly';
import { dailyGoalXp } from './dailyGoals';
import { localRead, type Read } from '../lib/kv';
import { AVATAR_TROPHY_ROAD } from './avatar';
import { readStreak, streakTrophies } from '../retention/streak';
import { loadPerfectRecords, perfectTrophies } from '../perfect/storage';
import { readPass, passTrophies } from '../retention/pass';

/*
 * Trophies and the Trophy Road. Trophies are counted from the same records as XP (GM legacy, careers, League Hunt,
 * Rebuilds, weekly results, daily goals, Legend Challenges and the card album), so nothing is counted twice and a
 * restored backup brings them back. Wins and titles weigh far more than simply playing. Every 5,000 trophies up to
 * 200,000 opens a reward, and the road's rewards are the legendary ones: animated name colours and profile icons,
 * title colours, app looks and titles.
 */

/** A stop every 5,000 trophies up to 200,000, then every 50,000 up to 750,000. */
export const TROPHY_STEP = 5_000, TROPHY_BIG_STEP = 50_000, TROPHY_BIG_FROM = 200_000, TROPHY_MAX = 750_000;
export const TROPHIES = {
  gmWin: 12, gmSeason: 200, gmTitle: 2_500, achievement: 250,
  careerRetired: 500, careerLegacy: 2, careerHof: 1_000,
  huntRun: 80, huntWin: 1_800, huntDaily: 120,
  rebuildAttempt: 150, rebuildStar: 450, rebuildTitle: 1_200,
  weekly: 600, dailyGoal: 40, legendStar: 350, card: 25, ownerSeason: 150, ownerLegacy: 40,
} as const;

export interface TrophyPart { id: string; label: string; trophies: number }
const json = <T>(read: Read, key: string, fallback: T): T => { try { return (JSON.parse(read(key) ?? 'null') as T) ?? fallback; } catch { return fallback; } };

export function trophyParts(read: Read = localRead): TrophyPart[] {
  const gm = legacyTotals(readLegacy(read));
  const c = json<{ retired?: number; legacy?: number; hallOfFame?: number }>(read, 'cv-profile-careers', {});
  const hunt = loadRecords(read);
  const rebuild = Object.values(loadRebuildRecords(read));
  const weeks = Object.values(loadWeeklyRecords(read)).reduce((n, w) => n + (w.rebuild ? 1 : 0) + (w.career ? 1 : 0), 0);
  const legend = Object.values(json<Record<string, { stars: number }>>(read, 'cv-legend-records', {}));
  const cards = Object.keys(json<Record<string, unknown>>(read, 'cv-card-album', {})).length;
  const owners = json<{ seasons?: number; legacy?: number }[]>(read, 'cv-owner-records', []);
  const T = TROPHIES;
  return [
    { id: 'gm', label: 'GM leagues', trophies: gm.wins * T.gmWin + gm.seasons * T.gmSeason + gm.titles * T.gmTitle + gm.achievements * T.achievement },
    { id: 'career', label: 'Career Mode', trophies: (c.retired ?? 0) * T.careerRetired + Math.max(0, c.legacy ?? 0) * T.careerLegacy + (c.hallOfFame ?? 0) * T.careerHof },
    { id: 'hunt', label: 'League Hunt', trophies: hunt.runs * T.huntRun + hunt.wins * T.huntWin + Object.keys(hunt.daily ?? {}).length * T.huntDaily },
    { id: 'rebuild', label: 'Rebuild Challenge', trophies: rebuild.reduce((n, r) => n + r.attempts * T.rebuildAttempt + r.stars * T.rebuildStar + (r.titleIn != null ? T.rebuildTitle : 0), 0) },
    { id: 'weekly', label: 'Weekly challenges', trophies: weeks * T.weekly },
    { id: 'daily', label: 'Daily goals', trophies: dailyGoalXp(read).done * T.dailyGoal },
    { id: 'legend', label: 'Legend Challenges', trophies: legend.reduce((n, r) => n + r.stars, 0) * T.legendStar },
    { id: 'cards', label: 'Card album', trophies: cards * T.card },
    { id: 'owner', label: "Owner's Box", trophies: owners.reduce((n, r) => n + (r.seasons ?? 0) * T.ownerSeason + Math.max(0, r.legacy ?? 0) * T.ownerLegacy, 0) },
    { id: 'streak', label: 'Daily streak', trophies: streakTrophies(readStreak(read)) },
    { id: 'perfect', label: '82-0 Challenge', trophies: perfectTrophies(loadPerfectRecords(read)) },
    { id: 'pass', label: 'Season Pass', trophies: passTrophies(readPass(read)) },
  ];
}
export const totalTrophies = (read: Read = localRead) => trophyParts(read).reduce((n, p) => n + p.trophies, 0);

export type TrophyRewardKind = 'title' | 'color' | 'icon' | 'titleColor' | 'look' | 'avatar' | 'frame' | 'floor' | 'avatarFrame';
/** One or two rewards every 5,000 trophies. The last stops are the rarest things in the game. */
export const TROPHY_ROAD: [number, TrophyRewardKind, string][] = [
  [5_000, 'title', 'Contender'], [5_000, 'titleColor', 'amber'],
  [10_000, 'color', 'emberflow'],
  [15_000, 'icon', 'fireball'],
  [20_000, 'title', 'Trophy Hunter'], [20_000, 'titleColor', 'gold'],
  [25_000, 'look', 'aurora'],
  [30_000, 'color', 'neonwave'],
  [35_000, 'icon', 'trophy-shine'],
  [40_000, 'title', 'Banner Raiser'], [40_000, 'titleColor', 'ice'],
  [45_000, 'color', 'lava'],
  [50_000, 'look', 'royalcourt'], [50_000, 'icon', 'crown-spin'],
  [55_000, 'title', 'Ring Collector'],
  [60_000, 'titleColor', 'rainbow'],
  [65_000, 'icon', 'star-twinkle'],
  [70_000, 'color', 'galaxy'],
  [75_000, 'look', 'galaxy'], [75_000, 'title', 'Franchise Icon'],
  [80_000, 'icon', 'bolt-strike'],
  [85_000, 'titleColor', 'fire'],
  [90_000, 'color', 'goldrush'],
  [95_000, 'title', 'Legend of the Game'],
  [100_000, 'icon', 'ring'], [100_000, 'title', 'Six Figures'], [100_000, 'color', 'dsheen'],
  [105_000, 'titleColor', 'emerald'],
  [110_000, 'icon', 'diamond-pulse'],
  [115_000, 'title', 'Hardwood Royalty'],
  [120_000, 'color', 'sunset'],
  [125_000, 'look', 'hallowed'], [125_000, 'titleColor', 'platinum'],
  [130_000, 'icon', 'phoenix'],
  [135_000, 'title', 'The Chosen One'],
  [140_000, 'color', 'phantom'],
  [145_000, 'titleColor', 'aurora'],
  [150_000, 'icon', 'meteor'], [150_000, 'title', 'Mythic GM'], [150_000, 'color', 'solar'],
  [155_000, 'titleColor', 'bloodmoon'],
  [160_000, 'title', 'Architect of Eras'],
  [165_000, 'icon', 'crown-flame'],
  [170_000, 'color', 'nebula'],
  [175_000, 'look', 'eclipse'], [175_000, 'title', 'Untouchable'],
  [180_000, 'titleColor', 'starlight'],
  [185_000, 'icon', 'goat'],
  [190_000, 'color', 'celestial'], [190_000, 'title', 'Eternal'],
  [195_000, 'titleColor', 'molten'],
  [200_000, 'title', 'Court Vision Immortal'], [200_000, 'icon', 'goat-crown'], [200_000, 'color', 'immortal'], [200_000, 'titleColor', 'immortal'], [200_000, 'look', 'immortal'],
  // Past 200,000: a stop every 50,000 up to 750,000 (the character's pieces join below).
  [250_000, 'title', 'Beyond Legendary'], [250_000, 'color', 'plasma'],
  [300_000, 'title', 'Galactic GM'], [300_000, 'icon', 'fireball-blue'],
  [350_000, 'titleColor', 'plasma'],
  [400_000, 'title', 'Unstoppable'], [400_000, 'icon', 'trophy-diamond-shine'],
  [450_000, 'color', 'borealis'],
  [500_000, 'title', 'Half a Million'], [500_000, 'icon', 'crown-blueflame'], [500_000, 'titleColor', 'supernova'],
  [550_000, 'color', 'starfire'],
  [600_000, 'title', 'Myth Maker'], [600_000, 'icon', 'phoenix-gold'],
  [650_000, 'titleColor', 'cosmos'],
  [700_000, 'title', 'Living Myth'], [700_000, 'icon', 'ball-galaxy'], [700_000, 'color', 'eternalflame'],
  [750_000, 'title', 'Court Vision God'], [750_000, 'titleColor', 'divine'], [750_000, 'color', 'divine'],
];
// Share-card frames and Watch Game floors.
TROPHY_ROAD.push(
  [10_000, 'floor', 'cherry'], [15_000, 'frame', 'diamond'], [25_000, 'frame', 'jade'], [30_000, 'floor', 'sand'], [35_000, 'frame', 'pixel'],
  [40_000, 'floor', 'retro'], [45_000, 'frame', 'ice'], [55_000, 'floor', 'herringbone'], [65_000, 'frame', 'lightning'], [80_000, 'floor', 'ebony'],
  [85_000, 'frame', 'ember'], [95_000, 'floor', 'ice'], [105_000, 'frame', 'royal'], [120_000, 'floor', 'neon'], [140_000, 'frame', 'galaxy'],
  [160_000, 'floor', 'lava'], [180_000, 'frame', 'rainbow'], [250_000, 'floor', 'gold'], [300_000, 'frame', 'legend'], [400_000, 'floor', 'galaxy'],
);
// Your character's pieces ride the same road (ids are "category:piece"; see AVATAR_TROPHY_ROAD in avatar.ts).
for (const [t, cat, id] of AVATAR_TROPHY_ROAD) TROPHY_ROAD.push([t, 'avatar', `${cat}:${id}`]);
// Profile-picture frames (avatarFrames.ts).
TROPHY_ROAD.push([75_000, 'avatarFrame', 'blaze'], [250_000, 'avatarFrame', 'dragon'], [600_000, 'avatarFrame', 'celestial']);
TROPHY_ROAD.sort((a, b) => a[0] - b[0]);
export const trophyNeed = (kind: TrophyRewardKind, id: string) => TROPHY_ROAD.find(([, k, i]) => k === kind && i === id)?.[0];
export const TROPHY_TITLES = TROPHY_ROAD.filter(([, k]) => k === 'title').map(([t, , id]) => ({ id, trophies: t }));

// ---------------------------------------------------------------- title colours
/** A title's colour: flat, a gradient, or animated (flow/shimmer/pulse; see features.css `.anim-*`). */
export interface TitleColor { id: string; name: string; css: string; anim?: 'flow' | 'shimmer' | 'pulse'; /** Opened by an owner legacy (the Owner's Box) instead of the Trophy Road. */ ownerLegacy?: number; /** Game Owner only. */ staff?: boolean }
export const TITLE_COLORS: TitleColor[] = [
  { id: 'plain', name: 'Plain', css: '#94a0b2' },
  { id: 'amber', name: 'Amber', css: '#ffb347' },
  { id: 'gold', name: 'Gold', css: 'linear-gradient(90deg, #c9971f, #ffe38a, #c9971f)' },
  { id: 'ice', name: 'Ice', css: 'linear-gradient(90deg, #bfe6ff, #ffffff, #6db8ff, #bfe6ff)', anim: 'shimmer' },
  { id: 'rainbow', name: 'Rainbow', css: 'linear-gradient(90deg, #ff6b6b, #ffd166, #6fdc93, #6db8ff, #c79bff, #ff6b6b)', anim: 'flow' },
  { id: 'fire', name: 'Fire', css: 'linear-gradient(90deg, #ff3d1f, #ff9d3d, #ffe066, #ff9d3d, #ff3d1f)', anim: 'flow' },
  { id: 'emerald', name: 'Emerald glow', css: 'linear-gradient(90deg, #1f9e5c, #6fffb0, #1f9e5c)', anim: 'pulse' },
  { id: 'platinum', name: 'Platinum', css: 'linear-gradient(90deg, #9fb0c4, #ffffff, #9fb0c4, #e8edf3)', anim: 'shimmer' },
  { id: 'aurora', name: 'Aurora', css: 'linear-gradient(90deg, #6fdc93, #4fd6d6, #b8a8ff, #ff8fc8, #6fdc93)', anim: 'flow' },
  { id: 'bloodmoon', name: 'Blood moon', css: 'linear-gradient(90deg, #5a0010, #ff2d4a, #ffb3b3, #ff2d4a, #5a0010)', anim: 'pulse' },
  { id: 'starlight', name: 'Starlight', css: 'linear-gradient(90deg, #1b1f4a, #ffffff, #8fa8ff, #ffffff, #1b1f4a)', anim: 'shimmer' },
  { id: 'molten', name: 'Molten gold', css: 'linear-gradient(90deg, #7a4a00, #ffd166, #fff3c4, #ffb300, #7a4a00)', anim: 'flow' },
  { id: 'tycoon', name: 'Tycoon gold', css: 'linear-gradient(90deg, #8a6a12, #ffd166, #fffbe6, #ffd166, #3a9a5b, #ffd166, #8a6a12)', anim: 'shimmer', ownerLegacy: 60 },
  { id: 'plasma', name: 'Plasma', css: 'linear-gradient(90deg, #3fc8ff, #ffffff, #b983ff, #ffffff, #3fc8ff)', anim: 'flow' },
  { id: 'supernova', name: 'Supernova', css: 'linear-gradient(90deg, #ff4d2e, #ffd166, #ffffff, #ffd166, #ff4d2e)', anim: 'pulse' },
  { id: 'cosmos', name: 'Cosmos', css: 'linear-gradient(90deg, #1b1f4a, #6a45c0, #ff7ad9, #6fd3ff, #1b1f4a)', anim: 'flow' },
  { id: 'divine', name: 'Divine', css: 'linear-gradient(90deg, #fff3c4, #ffd166, #ffffff, #9fe7ff, #ffffff, #ffd166, #fff3c4)', anim: 'shimmer' },
  { id: 'sovereign', name: 'Sovereign', css: 'linear-gradient(90deg, #0a1f7a, #4da3ff, #ffffff, #ffd166, #ffffff, #4da3ff, #0a1f7a)', anim: 'flow', staff: true },
  { id: 'immortal', name: 'Immortal', css: 'linear-gradient(90deg, #ff4d2e, #ffd166, #6fdc93, #4fd6d6, #c79bff, #ff4dd2, #ff4d2e)', anim: 'flow' },
];
/** Whether a title colour is open: the Trophy Road's, or an owner legacy for the Owner's Box one. */
export const titleColorOpen = (c: TitleColor, ctx: { trophies: number; owner?: number; staff?: boolean }) =>
  c.id === 'plain' || !!ctx.staff || (!c.staff && (c.ownerLegacy != null ? (ctx.owner ?? 0) >= c.ownerLegacy : ctx.trophies >= (trophyNeed('titleColor', c.id) ?? Infinity)));
export const titleColorDef = (id: string | null | undefined) => TITLE_COLORS.find(c => c.id === id) ?? TITLE_COLORS[0];

// ---------------------------------------------------------------- stored as "nameColour|titleColour"
/** The profile's colour field carries both colours ("gold|fire") so the boards need no new column. */
export const packColors = (color: string, titleColor: string) => titleColor && titleColor !== 'plain' ? `${color}|${titleColor}`.slice(0, 20) : color;
export const unpackColors = (v: string | null | undefined): { color: string; titleColor: string } => {
  const [color, titleColor] = (v ?? 'cream').split('|');
  return { color: color || 'cream', titleColor: titleColor || 'plain' };
};

const SEEN_KEY = 'cv-trophy-seen';
/** Trophy Road stops passed since the last time they were shown (the first call records the count quietly). */
export function takeTrophyUp(trophies: number): { from: number; to: number; rewards: [number, TrophyRewardKind, string][] } | null {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    localStorage.setItem(SEEN_KEY, String(trophies));
    if (raw == null) return null;
    const seen = Number(raw);
    const rewards = TROPHY_ROAD.filter(([t]) => t > seen && t <= trophies);
    return rewards.length ? { from: seen, to: trophies, rewards } : null;
  } catch { return null; }
}
