import type { SalaryCapSettings } from './gm';
import type { LeagueTeam } from './league';
import type { PlayerSeason } from './types';
import { calculateOverall } from './engine/overall';

/*
 * Max and supermax contracts. A max deal is maxSalaryPctOfCap of the cap (30% by default). A franchise player
 * re-signing with, or extending at, his own team can get the supermax (supermaxPctOfCap, 35% by default): he has to
 * be his team's best player, rated SUPERMAX_MIN_OVERALL or more, with SUPERMAX_MIN_SEASONS seasons in the league and
 * no older than SUPERMAX_MAX_AGE. Anywhere else he tops out at the regular max.
 */

export const SUPERMAX_PCT = 0.35;
export const SUPERMAX_MIN_OVERALL = 82, SUPERMAX_MIN_SEASONS = 5, SUPERMAX_MAX_AGE = 33;
const round50k = (n: number) => Math.round(n / 50_000) * 50_000;

export const maxSalary = (cap: SalaryCapSettings) => round50k(cap.salaryCap * cap.maxSalaryPctOfCap);
export const supermaxSalary = (cap: SalaryCapSettings) => round50k(cap.salaryCap * Math.max(cap.maxSalaryPctOfCap, cap.supermaxPctOfCap ?? SUPERMAX_PCT));

/** A franchise player with his own team: the supermax is on the table. */
export function supermaxEligible(p: PlayerSeason, team: LeagueTeam | undefined, ownTeam: boolean): boolean {
  if (!ownTeam || !team) return false;
  const overall = calculateOverall(p);
  if (overall < SUPERMAX_MIN_OVERALL || p.age > SUPERMAX_MAX_AGE || (p.careerHistory?.length ?? 0) < SUPERMAX_MIN_SEASONS) return false;
  // His team's best player (he may be off the roster as its own free agent).
  return team.seasons.every(s => s.playerId === p.playerId || calculateOverall(s) <= overall);
}
/** The most this player can be paid by this team. */
export const maxFor = (p: PlayerSeason, team: LeagueTeam | undefined, ownTeam: boolean, cap: SalaryCapSettings) =>
  supermaxEligible(p, team, ownTeam) ? supermaxSalary(cap) : maxSalary(cap);

/** What kind of deal a salary is: the supermax, a max deal, or neither. */
export type ContractTier = 'supermax' | 'max' | null;
export function contractTier(salary: number, cap: SalaryCapSettings): ContractTier {
  const max = maxSalary(cap), superMax = supermaxSalary(cap);
  if (superMax > max && salary >= superMax - 25_000) return 'supermax';
  return salary >= max - 25_000 ? 'max' : null;
}
export const TIER_LABEL: Record<Exclude<ContractTier, null>, string> = { supermax: 'SUPERMAX', max: 'MAX' };
