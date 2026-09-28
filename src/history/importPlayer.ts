import type { NbaHistory, HistPlayer } from './nbaHistoryData';
import { NBA_HISTORY_DATASET } from './datasetInfo';
import { seedFor } from './historicalLeague';
import { buildRealPlayer } from './realPlayers';
import { realJerseyNumber, plausibleJerseyNumber } from './jerseyNumbers';
import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import { computeAskingSalary } from '../simulation/gm';
import { calculateOverall } from '../simulation/engine/overall';
import { collectPlayerIds, uniquePlayerId } from '../simulation/playerIds';
import { appendHistoryEvent } from '../simulation/playerHistory';
import type { PlayerSeason } from '../simulation/types';

/*
 * Sandbox: bring any real player into any league, as he was in any season he played (e.g. 1996 Michael Jordan into
 * a 2027 league). His ratings come from that season's reference rating; from then on he lives in your league like
 * anyone else (he does not follow his real trajectory and Historical rosters leave him alone).
 */

const NBA = new Set(['BAA', 'NBA']);
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Players whose name matches the query, best known first (by career length and honours). */
export function searchHistoryPlayers(h: NbaHistory, query: string, limit = 12): HistPlayer[] {
  const q = fold(query.trim());
  if (q.length < 2) return [];
  const matches = h.players.filter(p => fold(p.displayName).includes(q) || p.aliases.some(a => fold(a).includes(q)));
  const weight = (p: HistPlayer) => (p.hallOfFame ? 40 : 0) + ((p.lastSeason ?? 0) - (p.firstSeason ?? 0)) + (fold(p.displayName).startsWith(q) ? 20 : 0);
  return matches.sort((a, b) => weight(b) - weight(a)).slice(0, limit);
}

export interface ImportableSeason { end: number; team: string; age: number | null; ovr: number | null; ppg: number | null }
/** Seasons he played in the NBA/BAA (END years), with team, age and his reference rating. */
export function importableSeasons(h: NbaHistory, p: HistPlayer): ImportableSeason[] {
  const rows = (h.seasonsByPlayer.get(p.idx) ?? []).filter(r => NBA.has(r.league));
  const ends = [...new Set(rows.map(r => r.season))].sort((a, b) => a - b);
  return ends.map(end => {
    const rs = rows.filter(r => r.season === end);
    const agg = rs.find(r => r.isAggregate) ?? rs[0];
    const g = agg.stats.g ?? 0;
    return { end, team: rs.filter(r => !r.isAggregate).map(r => r.team).join('/') || agg.team, age: agg.age, ovr: h.ratingsByPlayer.get(p.idx)?.get(end)?.ovr ?? null,
      ppg: g ? Math.round(((agg.stats.pts ?? 0) / g) * 10) / 10 : null };
  });
}

/** Adds the player (as of END year `end`) to `teamId`'s roster, or to free agency when `teamId` is null. */
export function importHistoricalPlayer(h: NbaHistory, realId: string, end: number, league: League, extras: GMLeagueExtras, teamId: string | null): { league: League; extras: GMLeagueExtras; playerId: string } {
  const hp = h.byId.get(realId);
  if (!hp) throw new Error(`No player ${realId} in the NBA history data.`);
  const season = importableSeasons(h, hp).find(s => s.end === end);
  if (!season) throw new Error(`${hp.displayName} did not play in ${end - 1}-${String(end).slice(2)}.`);
  const seed = { ...seedFor(h, hp, end, [end - 1, end, end - 2]), frames: [] };
  const age = season.age ?? 27;
  const built = buildRealPlayer(seed, league.season ?? String(end - 1), teamId, age, seed.rating.ovr, NBA_HISTORY_DATASET);
  const playerId = uniquePlayerId(hp.displayName, collectPlayerIds(league, extras));
  const team = teamId ? league.teams.find(t => t.teamId === teamId) : undefined;
  const firstTeam = season.team.split('/')[0];
  const taken = new Set(team?.seasons.map(p => p.jerseyNumber) ?? []);
  let jersey = realJerseyNumber(realId, firstTeam, end) ?? plausibleJerseyNumber(realId);
  for (let bump = 0; taken.has(jersey) && bump < 100; bump++) jersey = (jersey + 1) % 100;
  const player: PlayerSeason = appendHistoryEvent({
    ...built, playerId, firstName: built.firstName, lastName: built.lastName, teamId, jerseyNumber: jersey,
    importedFrom: { season: end, realId },
    real: built.real ? { ...built.real, frames: [], coverageEndYear: Number(league.season) } : built.real,
  }, 'created', `Brought in from ${end - 1}-${String(end).slice(2)} (${season.team}) by Sandbox import`, teamId ?? undefined);
  if (!team) return { league, extras: { ...extras, freeAgents: [...extras.freeAgents, player] }, playerId };
  const contracts = { ...extras.contracts, [playerId]: { playerId, teamId: team.teamId, annualSalary: computeAskingSalary(calculateOverall(player), extras.capSettings), yearsRemaining: 2, playerOption: false, teamOption: false } };
  return { league: { ...league, teams: league.teams.map(t => t.teamId === team.teamId ? { ...t, seasons: [...t.seasons, player] } : t) }, extras: { ...extras, contracts }, playerId };
}
