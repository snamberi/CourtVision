import { describe, it, expect, beforeAll } from 'vitest';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import type { NbaHistory } from '../history/nbaHistoryData';
import { buildHistoricalLeague } from '../history/historicalLeague';
import { applyHistoricalRosters } from '../history/realRollover';
import { realJerseyNumber, assignRosterNumbers, JERSEY_TABLE_IDS } from '../history/jerseyNumbers';
import { runTradeMarketAI } from '../simulation/aiGM';
import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';

let h: NbaHistory;
let built: { league: League; extras: GMLeagueExtras };
beforeAll(async () => { h = await loadHistoryForTests(); built = buildHistoricalLeague(h, 2016, { realDevelopment: true, forceRosters: true, difficulty: 'normal', seed: 3 }); }, 120_000);
const player = (l: League, name: string) => l.teams.flatMap(t => t.seasons).find(p => p.playerId === name);

describe('real jersey numbers', () => {
  it('every id in the number table is a real player in the dataset', () => {
    for (const id of JERSEY_TABLE_IDS) expect(h.byId.has(id), id).toBe(true);
  });
  it('knows number changes by team and season', () => {
    expect(realJerseyNumber('bryanko01', 'LAL', 2006)).toBe(8);
    expect(realJerseyNumber('bryanko01', 'LAL', 2007)).toBe(24);
    expect(realJerseyNumber('jamesle01', 'MIA', 2012)).toBe(6);
    expect(realJerseyNumber('jamesle01', 'CLE', 2017)).toBe(23);
    expect(realJerseyNumber('jordami01', 'CHI', 1995)).toBe(45);
    expect(realJerseyNumber('jordami01', 'CHI', 1996)).toBe(23);
  });
  it('stars wear their real numbers in a historical league, and no teammates share one', () => {
    const { league } = built;
    expect(player(league, 'Stephen Curry')!.jerseyNumber).toBe(30);
    expect(player(league, 'Kevin Durant')!.jerseyNumber).toBe(35);
    expect(player(league, 'LeBron James')!.jerseyNumber).toBe(23);
    expect(player(league, 'Russell Westbrook')!.jerseyNumber).toBe(0);
    for (const t of league.teams) { const nums = t.seasons.map(p => p.jerseyNumber); expect(new Set(nums).size, t.teamId).toBe(nums.length); }
  });
  it('a clash goes to the less established player', () => {
    const [a, b] = built.league.teams.find(t => t.teamId === 'GSW')!.seasons;
    const out = assignRosterNumbers([{ ...a, jerseyNumber: 30, real: undefined }, { ...b }], 'GSW', 2017);
    expect(new Set(out.map(p => p.jerseyNumber)).size).toBe(2);
  });
});

describe('historical rosters', () => {
  it('each AI team gets its real roster at the next season, and your team is left alone', () => {
    const { league, extras } = built;
    expect(league.historical!.forceRosters).toBe(true);
    expect(league.historical!.realRosters!['2017']).toBeDefined();
    // Move on to 2017-18: Kyrie Irving was traded to Boston and Chris Paul to Houston that summer.
    const next = { ...league, season: '2017' };
    const mine = 'NYK';
    const before = league.teams.find(t => t.teamId === mine)!.seasons.map(p => p.playerId).sort();
    const res = applyHistoricalRosters(next, extras, mine);
    expect(res.moved).toBeGreaterThan(10);
    const kyrie = res.league.teams.find(t => t.seasons.some(p => p.playerId === 'Kyrie Irving'))!;
    expect(kyrie.teamId).toBe('BOS');
    expect(player(res.league, 'Kyrie Irving')!.jerseyNumber).toBe(11);
    expect(res.league.teams.find(t => t.seasons.some(p => p.playerId === 'Chris Paul'))!.teamId).toBe('HOU');
    expect(res.league.teams.find(t => t.teamId === mine)!.seasons.map(p => p.playerId).sort()).toEqual(before);
    for (const t of res.league.teams) for (const p of t.seasons) { expect(res.extras.contracts[p.playerId]?.teamId).toBe(t.teamId); expect(p.teamId).toBe(t.teamId); }
    const onTeams = new Set(res.league.teams.flatMap(t => t.seasons.map(p => p.playerId)));
    expect(res.extras.freeAgents.some(p => onTeams.has(p.playerId))).toBe(false);
  });
  it('AI teams make no trades among themselves while rosters are historical', () => {
    const r = runTradeMarketAI(built.league, built.extras, null, 5, 5);
    expect(r.trades).toHaveLength(0);
  });
});
