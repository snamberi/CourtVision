import type { NbaHistory } from './nbaHistoryData';
import type { League, LeagueTeam } from '../simulation/league';
import type { GMLeagueExtras, Contract } from '../simulation/gm';
import { computeAskingSalary } from '../simulation/gm';
import { calculateOverall } from '../simulation/engine/overall';
import { RNG } from '../simulation/engine/rng';
import { cardPool, cardPlayer } from '../hunt/cards';
import { huntTeams, teamLabel, type HuntTeam } from '../hunt/teams';

/*
 * Time Machine (a Franchise challenge): take any real team-season from NBA history (the 1996 Bulls, the 2016
 * Warriors, the 1967 76ers...) back or forward to any season you like, and run it there. The travelling team plays
 * with its real players exactly as they were that year; the rest of the league is real NBA history from the season
 * you land in, with its own rosters, draft classes and careers. Your players are their own people in the new
 * timeline ("Michael Jordan '96" can meet the 1990 Michael Jordan), so they age and develop from there.
 */

export interface TimeMachineInfo {
  /** The travelling team-season id (`${abbr}@${end}`) and its label. */
  from: string; fromLabel: string;
  /** The season it landed in (start year) and the team whose place it took. */
  year: number; teamId: string; replaced: string;
}

/** Destination teams for a start year: the real franchises of that season. */
export function destinationTeams(h: NbaHistory, startYear: number) {
  return h.teams.filter(t => t.season === startYear + 1 && (t.league === 'NBA' || t.league === 'BAA')).map(t => ({ abbr: t.abbr, name: t.name, franchise: t.franchise ?? t.abbr }));
}

/** The franchise a travelling team would replace by default: its own (moved franchises count), if it existed then. */
export function defaultReplacement(h: NbaHistory, team: HuntTeam, startYear: number): string | null {
  const franchise = h.teams.find(t => t.abbr === team.abbr && t.season === team.end)?.franchise ?? team.abbr;
  const dest = destinationTeams(h, startYear);
  return dest.find(d => d.franchise === franchise)?.abbr ?? null;
}

/** Famous teams to pick from quickly (any team-season in the data can travel). */
export const FAMOUS = ['CHI@1996', 'GSW@2016', 'LAL@1987', 'BOS@1986', 'PHI@1967', 'MIL@1971', 'LAL@2001', 'SAS@2014', 'MIA@2013', 'DET@1989', 'BOS@2008', 'DAL@2011', 'HOU@1994', 'OKC@2012', 'DEN@2023', 'BOS@2024', 'LAL@1972', 'BOS@1965', 'PHI@1983', 'SAS@1999'];

/**
 * Puts the travelling team into a freshly built historical league in place of `replaceTeamId`: that team's players
 * become free agents and the travellers sign on with fresh contracts. Returns the league, extras and your team id.
 */
export function applyTimeMachine(h: NbaHistory, league: League, extras: GMLeagueExtras, fromId: string, replaceTeamId: string, seed = 1): { league: League; extras: GMLeagueExtras; teamId: string } {
  const team = huntTeams(h).find(t => t.id === fromId);
  if (!team) throw new Error('That team is not in the history data.');
  const target = league.teams.find(t => t.teamId === replaceTeamId);
  if (!target) throw new Error(`${replaceTeamId} is not in that season's league.`);
  const pool = cardPool(h);
  const rng = new RNG(seed * 7 + 11);
  const season = league.season ?? target.seasons[0]?.season ?? '';
  const taken = new Set([...league.teams.flatMap(t => t.seasons.map(s => s.playerId)), ...extras.freeAgents.map(s => s.playerId)]);
  const travellers = team.roster.map(id => pool.byId.get(id)!).filter(Boolean).map(c => {
    const p = cardPlayer(h, c, replaceTeamId);
    let playerId = p.playerId;
    for (let n = 2; taken.has(playerId); n++) playerId = `${p.playerId} (${n})`;
    taken.add(playerId);
    return { ...p, playerId, season, teamId: replaceTeamId, rotationRole: undefined };
  });
  const contracts: Record<string, Contract> = { ...extras.contracts };
  for (const s of target.seasons) delete contracts[s.playerId];
  for (const p of travellers) contracts[p.playerId] = { playerId: p.playerId, teamId: replaceTeamId, annualSalary: computeAskingSalary(calculateOverall(p), extras.capSettings), yearsRemaining: 2 + rng.nextInt(3), playerOption: false, teamOption: false };
  const displaced = target.seasons.map(s => ({ ...s, teamId: null }));
  const sameFranchise = defaultReplacement(h, team, Number((season || '0').slice(0, 4))) === replaceTeamId;
  const renamed: LeagueTeam = { ...target, seasons: travellers, ...(sameFranchise ? {} : { name: team.name }) };
  const info: TimeMachineInfo = { from: team.id, fromLabel: teamLabel(team), year: Number((season || '0').slice(0, 4)), teamId: replaceTeamId, replaced: target.name };
  return {
    league: { ...league, teams: league.teams.map(t => (t.teamId === replaceTeamId ? renamed : t)), timeMachine: info },
    extras: { ...extras, contracts, freeAgents: [...extras.freeAgents, ...displaced] },
    teamId: replaceTeamId,
  };
}
