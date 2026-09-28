import type { League } from '../simulation/league';

/*
 * Real players who retired before a historical league began ("Load every real player"). There are thousands, so a
 * save keeps only who they are (name, real id, final team); their careers are rebuilt from the NBA history data when
 * the league loads (see hydrateRetirees in historicalLeague.ts).
 */

const rebuildable = (r: NonNullable<League['retiredPlayers']>[number]) => !!r.preStart && !!r.realId && !r.keepData;

/** Pre-start retirees whose data was left out of the save and still needs rebuilding. */
export const needsRetireeData = (league: Pick<League, 'retiredPlayers'>) => (league.retiredPlayers ?? []).some(r => rebuildable(r) && !r.finalSeasonData);

/** What a save stores: pre-start retirees without their rebuildable data. */
export function slimRetirees(league: League): League {
  const list = league.retiredPlayers;
  if (!list?.some(r => rebuildable(r) && r.finalSeasonData)) return league;
  return { ...league, retiredPlayers: list.map(r => (rebuildable(r) && r.finalSeasonData ? { ...r, finalSeasonData: undefined } : r)) };
}

/** Puts back the rebuildable data a slimmed league left out, from the full league it was slimmed from. */
export function restoreRetirees(league: League, from: League): League {
  const list = league.retiredPlayers;
  if (!list?.some(r => rebuildable(r) && !r.finalSeasonData)) return league;
  const data = new Map((from.retiredPlayers ?? []).filter(r => r.finalSeasonData).map(r => [r.playerId, r.finalSeasonData!]));
  return { ...league, retiredPlayers: list.map(r => (rebuildable(r) && !r.finalSeasonData && data.has(r.playerId) ? { ...r, finalSeasonData: data.get(r.playerId) } : r)) };
}

/** How many real players retired before the start are loaded. */
export const preStartCount = (league: Pick<League, 'retiredPlayers'>) => (league.retiredPlayers ?? []).reduce((n, r) => n + (r.preStart ? 1 : 0), 0);
