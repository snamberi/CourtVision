import type { League } from './league';
import type { GMLeagueExtras } from './gm';
import { computeAskingSalary } from './gm';
import { calculateOverall } from './engine/overall';
import { RNG } from './engine/rng';
import { appendHistoryEvent } from './playerHistory';

/* Holdouts: a star badly underpaid on his current deal can refuse to report when the season starts, sitting out his
 * team's first games. A trade or a contract extension ends it. Unhappy players hold out more often, happy ones never. */

export interface Holdout { teamId: string; season: string; games: number; reason: string }

const MAX_PER_LEAGUE = 3;

/** True when this player sits out his team's game number `gameNumber` (1-based) this season. */
export function isHoldingOut(league: Pick<League, 'holdouts' | 'season'>, playerId: string, teamId: string, gameNumber: number): boolean {
  const h = league.holdouts?.[playerId];
  return !!h && h.teamId === teamId && h.season === (league.season ?? '') && gameNumber <= h.games;
}

/** Ends a holdout (after an extension, or when the player is traded). */
export function endHoldout(league: League, playerId: string): League {
  if (!league.holdouts?.[playerId]) return league;
  const { [playerId]: _gone, ...rest } = league.holdouts;
  return { ...league, holdouts: rest };
}

/** At the start of a regular season: decides who holds out. Older holdouts are cleared. */
export function assignHoldouts(league: League, extras: GMLeagueExtras, seed: number): League {
  const rng = new RNG(seed);
  const season = league.season ?? '';
  const holdouts: Record<string, Holdout> = {};
  const candidates: { id: string; teamId: string; gap: number; unhappy: boolean }[] = [];
  for (const t of league.teams) for (const p of t.seasons) {
    const c = extras.contracts[p.playerId];
    if (!c || c.yearsRemaining < 1 || p.stick || p.importedFrom || p.careerPlayer) continue;
    const ovr = calculateOverall(p);
    if (ovr < 72 || p.age > 32) continue;
    const market = computeAskingSalary(ovr, extras.capSettings);
    const gap = market / Math.max(1, c.annualSalary);
    const morale = p.morale?.season === season || p.morale?.teamId === t.teamId ? p.morale?.score ?? 60 : 60;
    if (gap < 1.6 || morale >= 75) continue;
    candidates.push({ id: p.playerId, teamId: t.teamId, gap, unhappy: morale < 40 });
  }
  candidates.sort((a, b) => b.gap - a.gap);
  for (const c of candidates) {
    if (Object.keys(holdouts).length >= MAX_PER_LEAGUE) break;
    if (rng.next() > (c.unhappy ? 0.6 : 0.3)) continue;
    const games = 3 + Math.floor(rng.next() * 8);
    holdouts[c.id] = { teamId: c.teamId, season, games, reason: `Wants a new deal: worth about ${Math.round(c.gap * 10) / 10}x what he is paid` };
  }
  const ids = new Set(Object.keys(holdouts));
  const teams = ids.size ? league.teams.map(t => ({ ...t, seasons: t.seasons.map(p => (ids.has(p.playerId)
    ? appendHistoryEvent(p, 'trade_request', `Held out of training camp: wants a new contract (out up to ${holdouts[p.playerId].games} games)`, t.teamId) : p)) })) : league.teams;
  return { ...league, teams, holdouts };
}
