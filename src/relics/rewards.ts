import { awardSpins } from './relics';

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

/** Grants the spins for a result (once per key) and returns how many were new. */
export const rewardRun = (key: string, n: number) => (n > 0 ? awardSpins(key, n) : 0);

/** One spin per mode achievement you've earned (each pays once). Returns how many spins were new. */
export async function claimAchievementSpins(): Promise<number> {
  const { earnedModeAchievements } = await import('../profile/modeAchievements');
  let got = 0;
  for (const id of earnedModeAchievements()) got += awardSpins(`ach:${id}`, 1);
  return got;
}
