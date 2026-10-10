import { loadRelics, saveRelics, grantReward, earn, type SecretId } from './relics';

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

/** Grants a finished run's spins, coins and feat secret (once per key) and returns how many spins were new. */
export function rewardRun(key: string, n: number, opts: { secret?: SecretId; why?: string } = {}): number {
  const before = loadRelics();
  const after = grantReward(before, key, { spins: n, coins: runCoins(n), secret: opts.secret, why: opts.why });
  if (after === before) return 0;
  saveRelics(after);
  return after.spins - before.spins;
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
