import type { League } from './league';
import { computeStandings } from './league';
import type { GMLeagueExtras } from './gm';
import { computeAskingSalary } from './gm';
import type { PlayerSeason } from './types';
import { calculateOverall } from './engine/overall';
import { currentSeasonAdvanced, type PlayerAdvanced } from './advancedStats';
import { strengthRanking } from './freeAgentDecision';
import { expectedGrowth } from './growth';

/* How front offices value trade assets. Separate from computeTradeValue (which still drives salaries) so that:
 *  - production matters, not just ratings (PER and win shares per 48 blend into a player's worth),
 *  - contracts matter (a cheap productive deal is an asset, an overpaid one a burden),
 *  - teams see deals through their own situation (contenders pay for now, rebuilders for youth and picks),
 *  - one star is worth more than several role players (value grows steeply with quality). */

export type TeamDirection = 'contender' | 'rebuilding' | 'middle';

const directionCache = new WeakMap<League, Map<string, TeamDirection>>();
export function teamDirection(league: League, teamId: string): TeamDirection {
  let map = directionCache.get(league);
  if (!map) {
    map = new Map();
    const ranking = strengthRanking(league), n = Math.max(1, ranking.length);
    const standings = new Map(computeStandings(league).map(r => [r.teamId, r]));
    for (const [i, id] of ranking.entries()) {
      const row = standings.get(id), games = row ? row.wins + row.losses : 0;
      const pct = games >= 10 ? row!.winPct : null;
      // Contending and rebuilding only mean something in a real league; tiny sandboxes stay neutral.
      if (n < 6) { map.set(id, 'middle'); continue; }
      const byStrength = i < Math.round(n * 0.27) ? 'contender' : i >= n - Math.round(n * 0.3) ? 'rebuilding' : 'middle';
      map.set(id, pct == null ? byStrength : pct >= 0.6 ? 'contender' : pct <= 0.38 ? 'rebuilding' : byStrength);
    }
    directionCache.set(league, map);
  }
  return map.get(teamId) ?? 'middle';
}

const advancedCache = new WeakMap<League, Map<string, PlayerAdvanced>>();
function recentProduction(p: PlayerSeason, league: League): PlayerAdvanced | null {
  let current = advancedCache.get(league);
  if (!current) { current = currentSeasonAdvanced(league); advancedCache.set(league, current); }
  const now = current.get(p.playerId);
  if (now && (p.seasonStats?.minutes ?? 0) >= 400) return now;
  // Imported early-era seasons can lack PER/WS48 (NaN): only a season that recorded them counts.
  const last = [...(p.careerHistory ?? [])].reverse().find(h => h.advanced && h.stats.minutes >= 800 && Number.isFinite(h.advanced.per) && Number.isFinite(h.advanced.ws48));
  return last?.advanced ?? null;
}

/** A player's worth in Overall-like units, before team-specific adjustments. */
export function playerTradeScore(p: PlayerSeason, league: League): number {
  const overall = calculateOverall(p);
  const adv = recentProduction(p, league);
  // Production on an Overall scale: PER 15 / .100 WS48 ≈ 66, PER 25 / .200 ≈ 85.
  const production = adv ? Math.max(40, Math.min(99, 40 + adv.per * 1.5 + adv.ws48 * 40)) : overall;
  return overall * 0.65 + production * 0.35;
}

/** Steep curve: a 90 is worth several 70s. Scores are in Overall-like units. */
export const assetCurve = (score: number) => 100 * Math.pow(Math.max(0, score - 35) / 55, 2.7);

export function tradeAssetValue(p: PlayerSeason, league: League, extras: GMLeagueExtras, perspectiveTeamId: string): number {
  const dir = teamDirection(league, perspectiveTeamId);
  let score = playerTradeScore(p, league);
  // Youth: the growth he can really be expected to add (growth.ts), which rebuilding teams prize and contenders discount.
  score += expectedGrowth(p) * (dir === 'rebuilding' ? 1.3 : dir === 'contender' ? 0.5 : 0.9);
  if (p.age > 30) score -= (p.age - 30) * (dir === 'contender' ? 0.8 : 1.6);
  if (dir === 'rebuilding' && p.age >= 28) score -= Math.min(10, (p.age - 27) * 2);
  // Contract: salary below a player's fair price is surplus value, above it is a burden.
  const contract = extras.contracts[p.playerId];
  if (contract) {
    const fair = computeAskingSalary(Math.round(score), extras.capSettings);
    const years = Math.min(3, Math.max(1, contract.yearsRemaining));
    score += Math.max(-8, Math.min(8, (fair - contract.annualSalary) / 1e6 * 0.25 * years));
  }
  // A player who asked out is worth less to the team stuck with him: everyone knows they have to move him.
  if (p.morale?.tradeRequest && p.morale.teamId === perspectiveTeamId) return assetCurve(score) * 0.85;
  return assetCurve(score);
}

/**
 * Draft picks on the same curve. Pick "scores" come from the existing pick valuations (0-125, where the first
 * overall pick is 125), so they are first mapped onto the Overall scale: the top pick is worth roughly a 77
 * Overall young player, a mid first-rounder a mid-60s player, a second-rounder about a fringe prospect.
 */
export const pickScoreToOverall = (pickScore: number) => 45 + Math.max(0, Math.min(125, pickScore)) * 0.26;
export function pickAssetValue(pickScore: number, league: League, perspectiveTeamId: string): number {
  const dir = teamDirection(league, perspectiveTeamId);
  return assetCurve(pickScoreToOverall(pickScore)) * (dir === 'rebuilding' ? 1.3 : dir === 'contender' ? 0.75 : 1);
}

/**
 * What a package of incoming players is worth to the team receiving them. Only as many players as the team sends
 * back count fully; each extra body is worth less because it takes a roster spot from someone already there.
 */
export function packageValue(values: number[], outgoingCount: number): number {
  return [...values].sort((a, b) => b - a).reduce((sum, v, i) => sum + v * (i < Math.max(1, outgoingCount) ? 1 : 0.55), 0);
}
