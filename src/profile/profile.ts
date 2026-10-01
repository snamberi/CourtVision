import { readLegacy, legacyTotals } from '../storage/gmLegacy';
import { avatarItem, type AvatarCategory } from './avatar';
import { loadRecords } from '../hunt/storage';
import { loadRebuildRecords } from '../simulation/rebuildChallenge';
import { loadWeeklyRecords } from '../retention/weekly';
import { dailyGoalXp } from './dailyGoals';
import { localRead, type Read } from '../lib/kv';
import { TITLE_COLORS, titleColorOpen } from './trophyRoad';
import { ICONS, NAME_COLORS, LEVEL_ROAD, ROAD_TITLES, ROAD_LOOK_NAMES, roadLevel, unlockContext, isOpen, earnedExtraTitles, iconDef, type IconId, type ColorId, type RewardKind } from './cosmetics';

/*
 * The GM Profile: one level across every mode. XP is worked out from the records each mode already keeps (GM
 * legacy, League Hunt, Rebuild, Career, weekly results, daily goals), so nothing can be counted twice, old progress
 * counts from day one, and a restored backup brings the level back with it. Levels unlock cosmetics: share-card
 * frames, court floors for Watch Game, and GM titles.
 */

export interface XpPart { id: string; label: string; xp: number; detail: string }

/** Career Mode lives in IndexedDB; its totals are cached here whenever careers are listed. */
export interface CareerXpCache {
  careers: number; retired: number; legacy: number; hallOfFame: number;
  /** For the Career achievements: first-ballot Hall of Famers, all-time Top 10 finishes, careers with an MVP, and one career's most titles and points. */
  firstBallot?: number; top10?: number; mvpCareers?: number; mostTitles?: number; mostPoints?: number;
}
const CAREER_KEY = 'cv-profile-careers';
type CareerLike = { retired?: { legacy: number; hallOfFame: string; rank?: number | null }; years?: { stats?: { points?: number }; awards?: { key: string }[] }[] };
/** The career summary behind XP and the Career achievements (the server builds the same one from synced careers). */
export function careerCacheOf(metas: CareerLike[]): CareerXpCache {
  const retired = metas.filter(m => m.retired);
  const awards = (m: CareerLike, key: string) => (m.years ?? []).reduce((n, y) => n + (y.awards ?? []).filter(a => a.key === key).length, 0);
  const points = (m: CareerLike) => (m.years ?? []).reduce((n, y) => n + (y.stats?.points ?? 0), 0);
  return {
    careers: metas.length, retired: retired.length, legacy: retired.reduce((n, m) => n + Math.max(0, m.retired!.legacy), 0), hallOfFame: retired.filter(m => m.retired!.hallOfFame !== 'no').length,
    firstBallot: retired.filter(m => m.retired!.hallOfFame === 'first-ballot').length, top10: retired.filter(m => m.retired!.rank != null && m.retired!.rank <= 10).length,
    mvpCareers: retired.filter(m => awards(m, 'mvp') > 0).length, mostTitles: Math.max(0, ...retired.map(m => awards(m, 'champion'))), mostPoints: Math.max(0, ...retired.map(points)),
  };
}
export function noteCareers(metas: CareerLike[]): void {
  const next = JSON.stringify(careerCacheOf(metas));
  try {
    if (localStorage.getItem(CAREER_KEY) === next) return;
    localStorage.setItem(CAREER_KEY, next);
    window.dispatchEvent(new Event('courtvision:progress'));
  } catch { /* storage blocked */ }
}
export function careerCache(read: Read): CareerXpCache {
  try { return { careers: 0, retired: 0, legacy: 0, hallOfFame: 0, ...(JSON.parse(read(CAREER_KEY) ?? '{}') as Partial<CareerXpCache>) }; } catch { return { careers: 0, retired: 0, legacy: 0, hallOfFame: 0 }; }
}

export const XP = {
  gmSeason: 60, gmWin: 1, gmTitle: 300, achievement: 50,
  huntRun: 40, huntWin: 300, huntDaily: 40,
  rebuildAttempt: 100, rebuildStar: 75, rebuildTitle: 250,
  careerRetired: 150, careerHof: 150,
  weekly: 150,
} as const;

export function xpParts(read: Read = localRead): XpPart[] {
  const gm = legacyTotals(readLegacy(read));
  const hunt = loadRecords(read);
  const daily = Object.keys(hunt.daily ?? {}).length;
  const rebuild = Object.values(loadRebuildRecords(read));
  const rbAttempts = rebuild.reduce((n, r) => n + r.attempts, 0), rbStars = rebuild.reduce((n, r) => n + r.stars, 0), rbTitles = rebuild.filter(r => r.titleIn != null).length;
  const c = careerCache(read);
  const weeks = Object.values(loadWeeklyRecords(read)).reduce((n, w) => n + (w.rebuild ? 1 : 0) + (w.career ? 1 : 0), 0);
  const goals = dailyGoalXp(read);
  return [
    { id: 'gm', label: 'GM leagues', xp: gm.seasons * XP.gmSeason + gm.wins * XP.gmWin + gm.titles * XP.gmTitle + gm.achievements * XP.achievement, detail: `${gm.seasons} season${gm.seasons === 1 ? '' : 's'} · ${gm.wins} wins · ${gm.titles} title${gm.titles === 1 ? '' : 's'} · ${gm.achievements} achievement${gm.achievements === 1 ? '' : 's'}` },
    { id: 'career', label: 'Career Mode', xp: c.retired * XP.careerRetired + c.legacy + c.hallOfFame * XP.careerHof, detail: `${c.retired} retired · ${c.hallOfFame} Hall of Famer${c.hallOfFame === 1 ? '' : 's'} · Legacy ${c.legacy} in all` },
    { id: 'hunt', label: 'League Hunt', xp: hunt.runs * XP.huntRun + hunt.wins * XP.huntWin + daily * XP.huntDaily, detail: `${hunt.runs} run${hunt.runs === 1 ? '' : 's'} · ${hunt.wins} won · ${daily} Daily Legend${daily === 1 ? '' : 's'}` },
    { id: 'rebuild', label: 'Rebuild Challenge', xp: rbAttempts * XP.rebuildAttempt + rbStars * XP.rebuildStar + rbTitles * XP.rebuildTitle, detail: `${rbAttempts} finished · ${rbStars} star${rbStars === 1 ? '' : 's'} · ${rbTitles} rebuilt to a title` },
    { id: 'weekly', label: 'Weekly challenges', xp: weeks * XP.weekly, detail: `${weeks} weekly result${weeks === 1 ? '' : 's'}` },
    { id: 'daily', label: 'Daily goals', xp: goals.xp, detail: `${goals.done} goal${goals.done === 1 ? '' : 's'} done` },
  ];
}

export const totalXp = (parts = xpParts()) => parts.reduce((n, p) => n + p.xp, 0);

/** XP needed to go from `level` to the next: 175, 200, 225… (the level road runs to 750; see cosmetics.ts). */
export const levelCost = (level: number) => 150 + 25 * level;
export const MAX_LEVEL = 750;
export function levelFor(xp: number): { level: number; into: number; need: number } {
  let level = 1, left = xp;
  while (level < MAX_LEVEL && left >= levelCost(level)) { left -= levelCost(level); level++; }
  return { level, into: left, need: level >= MAX_LEVEL ? 0 : levelCost(level) };
}

// ---------------------------------------------------------------- cosmetics

export type FrameId = 'classic' | 'gold' | 'hardwood' | 'neon' | 'banner' | 'fire';
export type FloorId = 'team' | 'planks' | 'parquet' | 'blonde' | 'midnight' | 'asphalt';
export interface Unlock<T extends string> { id: T; name: string; level: number; blurb: string }

// Levels come from the level road (cosmetics.ts), so each reward is listed in one place.
const road = (kind: RewardKind, id: string) => roadLevel(kind, id) ?? 1;
export const FRAMES: Unlock<FrameId>[] = [
  { id: 'classic', name: 'Classic', level: 1, blurb: 'The orange Court Vision border.' },
  { id: 'gold', name: 'Gold', level: road('frame', 'gold'), blurb: 'A double gold border.' },
  { id: 'hardwood', name: 'Hardwood', level: road('frame', 'hardwood'), blurb: 'Maple planks top and bottom.' },
  { id: 'neon', name: 'Neon', level: road('frame', 'neon'), blurb: 'Arcade cyan and magenta.' },
  { id: 'banner', name: 'Banner', level: road('frame', 'banner'), blurb: 'Championship banners in the rafters.' },
  { id: 'fire', name: 'On Fire', level: road('frame', 'fire'), blurb: 'Pixel flames. For the heaters.' },
];
export const FLOORS: Unlock<FloorId>[] = [
  { id: 'team', name: "Home team's floor", level: 1, blurb: 'Each arena keeps its own floor.' },
  { id: 'planks', name: 'Classic maple', level: road('floor', 'planks'), blurb: 'Long maple planks, every arena.' },
  { id: 'parquet', name: 'Parquet', level: road('floor', 'parquet'), blurb: 'The old Garden look.' },
  { id: 'blonde', name: 'Blonde maple', level: road('floor', 'blonde'), blurb: 'Pale, bright 90s wood.' },
  { id: 'midnight', name: 'Midnight', level: road('floor', 'midnight'), blurb: 'Dark stained wood.' },
  { id: 'asphalt', name: 'Street court', level: road('floor', 'asphalt'), blurb: 'Blacktop, outdoors.' },
];
export const TITLES: Unlock<string>[] = ROAD_TITLES.map(id => ({ id, name: id, level: id === 'Rookie GM' ? 1 : road('title', id), blurb: '' }));

/** Titles earned in ranked seasons (the best tier you have reached; kept in this browser after each sync). */
export const RANK_TITLES: { id: string; tier: string; order: number }[] = [
  { id: 'Gold GM', tier: 'gold', order: 2 }, { id: 'Platinum GM', tier: 'platinum', order: 3 }, { id: 'Diamond GM', tier: 'diamond', order: 4 }, { id: 'Legend GM', tier: 'legend', order: 5 },
];
const TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'legend'];
export const RANKED_BEST_KEY = 'cv-ranked-best';
export function rankTitles(read: Read = localRead): string[] {
  const best = TIER_ORDER.indexOf(read(RANKED_BEST_KEY) ?? '');
  return RANK_TITLES.filter(t => best >= t.order).map(t => t.id);
}

export interface Equipped { frame: FrameId; floor: FloorId; title: string; icon: IconId; color: ColorId; titleColor: string }
const EQUIP_KEY = 'cv-profile-equip';
export const PROFILE_EVENT = 'courtvision:profile';

/** What is equipped, never beyond what is unlocked (a lower level after a reset falls back to what is open). */
export function equipped(level = levelFor(totalXp()).level): Equipped {
  let raw: Partial<Equipped> = {};
  try { raw = JSON.parse(localStorage.getItem(EQUIP_KEY) ?? '{}') as Partial<Equipped>; } catch { /* default */ }
  const ok = <T extends string>(list: Unlock<T>[], v: T | undefined, fallback: T): T => { const u = list.find(x => x.id === v); return u && u.level <= level ? u.id : fallback; };
  const ctx = unlockContext(level);
  const openTitles = TITLES.filter(t => t.level <= level);
  const special = [...rankTitles(), ...earnedExtraTitles(ctx)];
  const title = raw.title && special.includes(raw.title) ? raw.title : ok(TITLES, raw.title, openTitles[openTitles.length - 1].id);
  const icon = ICONS.find(i => i.id === raw.icon && isOpen(i.rule, ctx))?.id ?? 'ball';
  const color = NAME_COLORS.find(c => c.id === raw.color && isOpen(c.rule, ctx))?.id ?? 'cream';
  const titleColor = TITLE_COLORS.find(c => c.id === raw.titleColor && titleColorOpen(c, ctx))?.id ?? 'plain';
  return { frame: ok(FRAMES, raw.frame, 'classic'), floor: ok(FLOORS, raw.floor, 'team'), title, icon, color, titleColor };
}

/** The name shown on your profile card when you are not signed in (signed in, it is your GM name). */
const NAME_KEY = 'cv-profile-name';
export const localName = () => { try { return localStorage.getItem(NAME_KEY) || 'You'; } catch { return 'You'; } };
export function setLocalName(name: string): void {
  try { localStorage.setItem(NAME_KEY, name.slice(0, 18)); window.dispatchEvent(new Event(PROFILE_EVENT)); } catch { /* storage blocked */ }
}
export function equip(patch: Partial<Equipped>): void {
  let raw: Partial<Equipped> = {};
  try { raw = JSON.parse(localStorage.getItem(EQUIP_KEY) ?? '{}') as Partial<Equipped>; } catch { /* default */ }
  try { localStorage.setItem(EQUIP_KEY, JSON.stringify({ ...raw, ...patch })); window.dispatchEvent(new Event(PROFILE_EVENT)); } catch { /* storage blocked */ }
}

/** The equipped floor for Watch Game ('team' keeps each arena's own). Cheap: reads storage only. */
export function equippedFloor(): FloorId { try { return equipped().floor; } catch { return 'team'; } }

/** Unlocks reached between two levels (the level road), for the level-up note. */
export function unlocksBetween(from: number, to: number): string[] {
  const name: Record<RewardKind, (id: string) => string> = {
    icon: id => `the ${iconDef(id).name} icon`, color: id => `the ${NAME_COLORS.find(c => c.id === id)?.name ?? id} name colour`,
    title: id => `the "${id}" title`, frame: id => `the ${FRAMES.find(f => f.id === id)?.name ?? id} card frame`, floor: id => `the ${FLOORS.find(f => f.id === id)?.name ?? id} court`,
    look: id => `the ${ROAD_LOOK_NAMES[id] ?? id} app look`,
    avatar: id => { const [cat, piece] = id.split(':') as [AvatarCategory, string]; return `${avatarItem(cat, piece)?.name ?? piece} for your character`; },
  };
  return LEVEL_ROAD.filter(([l]) => l > from && l <= to).map(([, k, id]) => name[k](id));
}

const SEEN_KEY = 'cv-profile-seen-level';
/** The level last shown to the player; the first call records the current level without a celebration. */
export function takeLevelUp(level: number): { from: number; to: number } | null {
  try {
    const seen = Number(localStorage.getItem(SEEN_KEY) ?? 0);
    localStorage.setItem(SEEN_KEY, String(level));
    return seen && level > seen ? { from: seen, to: level } : null;
  } catch { return null; }
}
