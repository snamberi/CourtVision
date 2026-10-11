import { localRead, type Read } from '../lib/kv';
import { readPass, PASS_KEY, type PassSeason } from './pass';
import { isEvent } from './weeklyEvent';

/*
 * Seasons: a named, themed Season Pass that runs for a few months. Every XP you earn while it runs (any mode) fills
 * its 100 tiers. Every tier pays a free Lucky Spin for the Relic Vault, and every 5th tier unlocks one of the
 * season's cosmetics for good: its profile icon, name colour, title, title colour, card frame, court floor, phone
 * look, app look, picture frame and a full set of character pieces. It's free for everyone; nothing is bought.
 *
 * Season 1 is GLITCH: everything comes corrupted, with cyan and magenta channel splits and torn pixels.
 * Season 2 is FROZEN: ice, frost and falling snow (January to March 2027).
 * Season 3 is INFERNO: lava, embers and heat haze (April to June 2027).
 */

export interface Season { id: string; number: number; name: string; tagline: string; /** First day (UTC). */ start: string; /** Day after the last (UTC). */ end: string }
export const SEASONS: Season[] = [
  { id: 'glitch', number: 1, name: 'Glitch', tagline: 'Reality is buffering. Your gear is corrupted. Wear it anyway.', start: '2026-10-01', end: '2027-01-01' },
  { id: 'frozen', number: 2, name: 'Frozen', tagline: 'The court froze over. Lace up your skates and play through the blizzard.', start: '2027-01-01', end: '2027-04-01' },
  { id: 'inferno', number: 3, name: 'Inferno', tagline: 'The floor is lava. The rims are glowing. Play hot or get burned.', start: '2027-04-01', end: '2027-07-01' },
];
export const SEASON_TIERS = 100, SEASON_TIER_XP = 100, SEASON_COSMETIC_EVERY = 5;

/** The season running now (after the last one ends, it stays on until the next is added). */
export function currentSeason(now = new Date()): Season {
  const day = now.toISOString().slice(0, 10);
  return [...SEASONS].reverse().find(s => s.start <= day) ?? SEASONS[0];
}
export const seasonById = (id: string) => SEASONS.find(s => s.id === id);
export const seasonEnded = (s: Season, now = new Date()) => now.toISOString().slice(0, 10) >= s.end;
export const daysLeft = (s: Season, now = new Date()) => Math.max(0, Math.ceil((Date.parse(`${s.end}T00:00:00Z`) - now.getTime()) / 86_400_000));

/** What the season's cosmetics are, by kind (each kind maps to its own list: see the profile and avatar modules). */
export type SeasonRewardKind = 'icon' | 'color' | 'title' | 'titleColor' | 'frame' | 'floor' | 'phone' | 'look' | 'avatarFrame'
  | 'skin' | 'hair' | 'hairColor' | 'beard' | 'outfit' | 'hat' | 'eyes' | 'neck' | 'shoes' | 'aura';
export interface SeasonCosmetic { tier: number; kind: SeasonRewardKind; id: string; name: string; label: string }
const c = (tier: number, kind: SeasonRewardKind, id: string, name: string, label: string): SeasonCosmetic => ({ tier, kind, id, name, label });

/** The Glitch pass: a cosmetic every 5 tiers, the whole set by tier 100. */
export const GLITCH_REWARDS: SeasonCosmetic[] = [
  c(5, 'icon', 'glitch', 'Corrupted Ball', 'Profile icon'),
  c(10, 'color', 'glitch', 'Glitch', 'Name colour'),
  c(15, 'skin', 'glitch', 'Corrupted', 'Body colour'),
  c(20, 'frame', 'glitch', 'Glitch', 'Share card frame'),
  c(25, 'hairColor', 'glitch', 'Glitch', 'Hair colour'),
  c(30, 'title', 'Glitched', 'Glitched', 'Title'),
  c(35, 'hair', 'glitchSpikes', 'Glitch spikes', 'Hair'),
  c(40, 'floor', 'glitch', 'Corrupted court', 'Court floor'),
  c(45, 'beard', 'glitchBeard', 'Pixel beard', 'Beard'),
  c(50, 'phone', 'glitch', 'Glitch', 'Menu phone'),
  c(55, 'eyes', 'glitchVisor', 'Glitch visor', 'Eyewear'),
  c(60, 'titleColor', 'glitch', 'Glitch', 'Title colour'),
  c(65, 'outfit', 'glitchSuit', 'Corrupted suit', 'Outfit'),
  c(70, 'hat', 'glitchHalo', 'Error halo', 'Headwear'),
  c(75, 'avatarFrame', 'glitch', 'Glitch', 'Picture frame'),
  c(80, 'shoes', 'glitch', 'Glitch kicks', 'Shoes'),
  c(85, 'neck', 'glitchWings', 'Data wings', 'Neck & back'),
  c(90, 'look', 'glitch', 'Glitch', 'App look'),
  c(95, 'aura', 'glitch', 'Glitch aura', 'Aura'),
  c(100, 'title', 'Corrupted Legend', 'Corrupted Legend', 'Final title'),
];
/** The Frozen pass: ice and snow, the whole set by tier 100. */
export const FROZEN_REWARDS: SeasonCosmetic[] = [
  c(5, 'icon', 'frozen', 'Frozen Ball', 'Profile icon'),
  c(10, 'color', 'frost', 'Frostbite', 'Name colour'),
  c(15, 'skin', 'frozen', 'Ice', 'Body colour'),
  c(20, 'frame', 'frozen', 'Frozen', 'Share card frame'),
  c(25, 'hairColor', 'frozen', 'Frost white', 'Hair colour'),
  c(30, 'title', 'Frostbitten', 'Frostbitten', 'Title'),
  c(35, 'hair', 'iceSpikes', 'Icicle hair', 'Hair'),
  c(40, 'floor', 'frozen', 'Frozen rink', 'Court floor'),
  c(45, 'beard', 'frostBeard', 'Frost beard', 'Beard'),
  c(50, 'phone', 'frozen', 'Frozen', 'Menu phone'),
  c(55, 'eyes', 'snowGoggles', 'Snow goggles', 'Eyewear'),
  c(60, 'titleColor', 'frozen', 'Frozen', 'Title colour'),
  c(65, 'outfit', 'frostParka', 'Frost parka', 'Outfit'),
  c(70, 'hat', 'iceCrown', 'Ice crown', 'Headwear'),
  c(75, 'avatarFrame', 'frozen', 'Frozen', 'Picture frame'),
  c(80, 'shoes', 'iceSkates', 'Ice skates', 'Shoes'),
  c(85, 'neck', 'frostCape', 'Frost cape', 'Neck & back'),
  c(90, 'look', 'frozen', 'Frozen', 'App look'),
  c(95, 'aura', 'blizzard', 'Blizzard', 'Aura'),
  c(100, 'title', 'Absolute Zero', 'Absolute Zero', 'Final title'),
];
/** The Inferno pass: lava, embers and flame, the whole set by tier 100. */
export const INFERNO_REWARDS: SeasonCosmetic[] = [
  c(5, 'icon', 'inferno', 'Molten Ball', 'Profile icon'),
  c(10, 'color', 'magma', 'Magma', 'Name colour'),
  c(15, 'skin', 'inferno', 'Molten', 'Body colour'),
  c(20, 'frame', 'inferno', 'Inferno', 'Share card frame'),
  c(25, 'hairColor', 'inferno', 'Ember', 'Hair colour'),
  c(30, 'title', 'Scorched', 'Scorched', 'Title'),
  c(35, 'hair', 'magmaSpikes', 'Magma spikes', 'Hair'),
  c(40, 'floor', 'inferno', 'Lava court', 'Court floor'),
  c(45, 'beard', 'emberBeard', 'Ember beard', 'Beard'),
  c(50, 'phone', 'inferno', 'Inferno', 'Menu phone'),
  c(55, 'eyes', 'lavaGoggles', 'Lava goggles', 'Eyewear'),
  c(60, 'titleColor', 'inferno', 'Inferno', 'Title colour'),
  c(65, 'outfit', 'magmaArmor', 'Magma armour', 'Outfit'),
  c(70, 'hat', 'flameCrown', 'Flame crown', 'Headwear'),
  c(75, 'avatarFrame', 'inferno', 'Inferno', 'Picture frame'),
  c(80, 'shoes', 'magmaBoots', 'Magma boots', 'Shoes'),
  c(85, 'neck', 'flameCape', 'Flame cape', 'Neck & back'),
  c(90, 'look', 'inferno', 'Inferno', 'App look'),
  c(95, 'aura', 'inferno', 'Inferno aura', 'Aura'),
  c(100, 'title', 'Living Inferno', 'Living Inferno', 'Final title'),
];
export const SEASON_REWARDS: Record<string, SeasonCosmetic[]> = { glitch: GLITCH_REWARDS, frozen: FROZEN_REWARDS, inferno: INFERNO_REWARDS };
/** The season after this one, if it's announced. */
export const nextSeason = (now = new Date()) => SEASONS.find(s => s.start > now.toISOString().slice(0, 10));
/** Days until a season starts. */
export const daysUntil = (s: Season, now = new Date()) => Math.max(0, Math.ceil((Date.parse(`${s.start}T00:00:00Z`) - now.getTime()) / 86_400_000));
/** The tier a season cosmetic opens at, if it is one. */
export const seasonTierOf = (kind: SeasonRewardKind, id: string, season = 'glitch') => SEASON_REWARDS[season]?.find(r => r.kind === kind && r.id === id)?.tier;
/** The unlock rule for a season cosmetic (see cosmetics.ts `isOpen`). */
export const seasonRule = (kind: SeasonRewardKind, id: string, season = 'glitch') => ({ season, tier: seasonTierOf(kind, id, season) ?? SEASON_TIERS });
export const seasonHow = (r: { season: string; tier: number }) => `Season ${seasonById(r.season)?.number ?? ''} pass tier ${r.tier}`.replace('  ', ' ');

/** Tiers reached in each season (the owner's account has everything; see cosmetics.ts). */
export function seasonTiers(read: Read = localRead): Record<string, number> {
  return Object.fromEntries(Object.entries(readPass(read).seasons ?? {}).map(([id, s]) => [id, s.tier]));
}
export const seasonTier = (id: string, read: Read = localRead) => seasonTiers(read)[id] ?? 0;
/** Titles the seasons have given you. */
export const seasonTitles = (tiers: Record<string, number>) => Object.entries(SEASON_REWARDS).flatMap(([id, list]) => list.filter(r => r.kind === 'title' && (tiers[id] ?? 0) >= r.tier).map(r => r.id));

export interface SeasonProgress { season: Season; xp: number; tier: number; into: number; need: number; paid: number; newTiers: number[] }
/** Where the current season's pass stands, given your total XP now (the first look records where it starts). */
export function noteSeason(totalXp: number, now = new Date()): SeasonProgress {
  const season = currentSeason(now);
  const p = readPass();
  const prev: PassSeason = p.seasons?.[season.id] ?? { start: totalXp, tier: 0, paid: 0 };
  const ended = seasonEnded(season, now) && SEASONS.at(-1)?.id !== season.id;
  const xp = Math.max(0, totalXp - prev.start + (prev.bonus ?? 0));
  const tier = ended ? prev.tier : Math.max(prev.tier, Math.min(SEASON_TIERS, Math.floor(xp / SEASON_TIER_XP)));
  if (!p.seasons?.[season.id] || tier !== prev.tier) {
    try { localStorage.setItem(PASS_KEY, JSON.stringify({ ...p, seasons: { ...(p.seasons ?? {}), [season.id]: { ...prev, tier } } })); } catch { /* storage blocked */ }
  }
  const into = tier >= SEASON_TIERS ? SEASON_TIER_XP : Math.max(0, xp - tier * SEASON_TIER_XP);
  return { season, xp, tier, into, need: SEASON_TIER_XP, paid: prev.paid, newTiers: Array.from({ length: Math.max(0, tier - prev.tier) }, (_, i) => prev.tier + i + 1) };
}

/** The daily streak bonus: once a day, +10 pass XP for each day of your streak (up to +100 at 10 days). */
export const STREAK_BONUS_PER_DAY = 10, STREAK_BONUS_MAX = 100;
export const streakBonus = (streak: number) => Math.min(STREAK_BONUS_MAX, Math.max(0, streak) * STREAK_BONUS_PER_DAY);
/** Pays today's streak bonus into the current season's pass (once a day). Returns the XP added. */
export function claimStreakBonus(streak: number, totalXp: number, now = new Date()): number {
  const season = currentSeason(now), day = now.toISOString().slice(0, 10);
  if (seasonEnded(season, now) || day < season.start) return 0;
  noteSeason(totalXp, now);
  const p = readPass(), s = p.seasons?.[season.id];
  const add = streakBonus(streak) * (isEvent('passBoost', now) ? 2 : 1);
  if (!s || s.bonusDay === day || add <= 0) return 0;
  try { localStorage.setItem(PASS_KEY, JSON.stringify({ ...p, seasons: { ...p.seasons, [season.id]: { ...s, bonus: (s.bonus ?? 0) + add, bonusDay: day } } })); } catch { return 0; }
  return add;
}

/** Marks a season's tiers as paid (their Lucky Spins handed out). Returns how many were new. */
export function markSeasonPaid(id: string, upTo: number): number {
  const p = readPass();
  const s = p.seasons?.[id];
  if (!s || upTo <= s.paid) return 0;
  const to = Math.min(s.tier, upTo), n = to - s.paid;
  if (n <= 0) return 0;
  try { localStorage.setItem(PASS_KEY, JSON.stringify({ ...p, seasons: { ...p.seasons, [id]: { ...s, paid: to } } })); } catch { return 0; }
  return n;
}
