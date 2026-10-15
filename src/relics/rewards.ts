import { loadRelics, saveRelics, grantReward, grantLuckySpins, earn, type SecretId } from './relics';
import { noteSeason, markSeasonPaid, SEASON_REWARDS, type SeasonCosmetic } from '../retention/season';
import { isEvent } from '../retention/weeklyEvent';
import { activePet } from '../profile/pets';
import { totalXp, levelFor } from '../profile/profile';

/*
 * Relic Spins for finishing things. Each result pays out once (keyed by its run), so reloading a finished run, or a
 * save syncing back, never pays twice. Dailies and Weeklies earn spins too; they just don't use luck.
 */

export const huntSpins = (r: { stage: string; difficulty?: string; immortal?: boolean }) => (r.stage === 'won' ? (r.difficulty === 'legend' ? 2 : 1) + (r.immortal ? 1 : 0) : 0);
export const perfectSpins = (s: { champion: boolean; perfectSeason: boolean; perfectPlayoffs: boolean }) => (s.champion ? 1 : 0) + (s.perfectSeason ? 1 : 0) + (s.perfectSeason && s.perfectPlayoffs ? 1 : 0);
export const survivalSpins = (wins: number) => (wins >= 15 ? 3 : wins >= 10 ? 2 : wins >= 5 ? 1 : 0);
export const storySpins = (tier: string) => 1 + (tier === 'legend' ? 1 : 0);
export const careerSpins = (hallOfFame: string | undefined) => 1 + (hallOfFame && hallOfFame !== 'no' ? 1 : 0);
export const FRANCHISE_TITLE_SPINS = 1;

/** Coins for a finished run: something for every run, more for the spins it earned. */
export const runCoins = (spins: number) => 25 + 50 * Math.max(0, spins);

/** Secret relics a feat uncovers. */
export const huntSecret = (r: { stage: string; difficulty?: string; daily?: string; weekly?: string }): SecretId | undefined => (r.stage === 'won' && r.difficulty === 'legend' ? 'secondWind' : undefined);
export const survivalSecret = (wins: number): SecretId | undefined => (wins >= 15 ? 'ironWill' : undefined);
export const storySecret = (tier: string): SecretId | undefined => (tier === 'legend' ? 'clutchGene' : undefined);
export const careerSecret = (hallOfFame: string | undefined): SecretId | undefined => (hallOfFame === 'first-ballot' ? 'eternalSpin' : undefined);
export const perfectSecret = (s: { perfectSeason: boolean }): SecretId | undefined => (s.perfectSeason ? 'extraPick' : undefined);

export const categorizeSecret = (s: { won: boolean; mistakes: number }): SecretId | undefined => (s.won && s.mistakes === 0 ? 'sixthSense' : undefined);
export const guessTeamSecret = (streak: number): SecretId | undefined => (streak >= 10 ? 'filmRoom' : undefined);
/** A quick game's feat: uncovers its secret relic (once), no spins or coins. Returns whether it was new. */
export function uncoverSecret(key: string, secret: SecretId | undefined): boolean {
  if (!secret) return false;
  const before = loadRelics();
  if (before.secrets.includes(secret)) return false;
  const after = grantReward(before, key, { spins: 0, coins: 0, secret, why: 'A feat' });
  if (after === before) return false;
  saveRelics(after);
  return true;
}

/** Grants a finished run's spins, coins and feat secret (once per key) and returns how many spins were new. */
export function rewardRun(key: string, n: number, opts: { secret?: SecretId; why?: string } = {}, now = new Date()): number {
  const before = loadRelics();
  // The Weekly Event: Coin Rush doubles the coins, Spin Storm adds a spin to a run that pays spins.
  // The Dragon (a pet) hoards: +50% coins.
  const dragon = activePet(levelFor(totalXp()).level) === 'dragon' ? 1.5 : 1;
  const spins = n + (n > 0 && isEvent('spinStorm', now) ? 1 : 0), coins = Math.round(runCoins(n) * (isEvent('coinRush', now) ? 2 : 1) * dragon);
  const after = grantReward(before, key, { spins, coins, secret: opts.secret, why: opts.why });
  if (after === before) return 0;
  saveRelics(after);
  return after.spins - before.spins;
}

/** The Season Pass: one free Lucky Spin for every tier reached and not yet paid. Returns how many were paid. */
export const paySeasonSpins = (totalXp: number, now = new Date()): number => paySeasonRewards(totalXp, now).spins;
/** The same, plus the season cosmetics those new tiers unlocked (for the tier-up pop-up). */
export function paySeasonRewards(totalXp: number, now = new Date()): { spins: number; cosmetics: SeasonCosmetic[] } {
  const p = noteSeason(totalXp, now);
  const before = p.paid;
  const n = markSeasonPaid(p.season.id, p.tier);
  if (n > 0) saveRelics(grantLuckySpins(loadRelics(), n));
  const cosmetics = n > 0 ? (SEASON_REWARDS[p.season.id] ?? []).filter(r => r.tier > before && r.tier <= before + n) : [];
  return { spins: n, cosmetics };
}

/** Coins for each achievement earned before relics existed (paid once, the first time). */
export const OLD_ACHIEVEMENT_COINS = 50;
/**
 * One spin per new mode achievement (each pays once). Achievements you already had when relics arrived pay
 * OLD_ACHIEVEMENT_COINS each instead, so a long-time player doesn't get a flood of spins. Returns the new spins.
 */
export async function claimAchievementSpins(): Promise<number> {
  const { earnedModeAchievements } = await import('../profile/modeAchievements');
  const ids = earnedModeAchievements();
  let s = loadRelics();
  const before = s;
  const fresh = ids.filter(id => !s.granted.includes(`ach:${id}`));
  if (!fresh.length && s.achSeeded) return 0;
  const keys = fresh.map(id => `ach:${id}`);
  if (!s.achSeeded) s = { ...earn(s, fresh.length * OLD_ACHIEVEMENT_COINS, `${fresh.length} earlier achievement${fresh.length === 1 ? '' : 's'}`), achSeeded: true };
  else s = { ...s, spins: s.spins + fresh.length };
  s = { ...s, granted: [...s.granted, ...keys].slice(-2000) };
  saveRelics(s);
  return s.spins - before.spins;
}

/* The keys a run's reward is saved under (its end screen reads the same key). */
export const huntRewardKey = (r: { seed: number; difficulty?: string }) => `hunt:${r.seed}:${r.difficulty ?? 'pro'}`;
export const perfectRewardKey = (r: { seed: number; mode: string; daily?: string }) => `p820:${r.seed}:${r.mode}:${r.daily ?? ''}`;
export const survivalRewardKey = (r: { seed: number; level: string }) => `surv:${r.seed}:${r.level}`;
export const storyRewardKey = (s: { seed: number; flags?: string[] }) => `story:${s.seed}${s.flags?.includes('yearTwo') ? ':y2' : ''}`;
export const careerRewardKey = (m: { id: string }) => `career:${m.id}`;
