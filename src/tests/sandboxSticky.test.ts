import { describe, it, expect, beforeAll } from 'vitest';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import type { NbaHistory } from '../history/nbaHistoryData';
import { buildHistoricalLeague } from '../history/historicalLeague';
import { applyHistoricalRosters } from '../history/realRollover';
import { importHistoricalPlayer, searchHistoryPlayers, importableSeasons } from '../history/importPlayer';
import { setStick, enforceSticky } from '../simulation/sticky';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { validateTrade, executeTrade, waiveToFreeAgency } from '../simulation/gm';
import { beginNewSeasonRoster } from '../simulation/seasonTransition';
import { calculateOverall } from '../simulation/engine/overall';
import type { League } from '../simulation/league';

let h: NbaHistory;
beforeAll(async () => { h = await loadHistoryForTests(); }, 120_000);
const teamOf = (l: League, id: string) => l.teams.find(t => t.seasons.some(p => p.playerId === id))?.teamId ?? null;

describe('sandbox: import any player from any era', () => {
  it('brings 1996 Michael Jordan into a generated 2027 league with his number', () => {
    const { league, extras } = generateFullLeague(5, 8, 13, 10, '2027', { priorSeasons: false });
    const mj = searchHistoryPlayers(h, 'michael jordan')[0];
    expect(mj.id).toBe('jordami01');
    expect(importableSeasons(h, mj).map(s => s.end)).toContain(1996);
    const team = league.teams[2].teamId;
    const r = importHistoricalPlayer(h, 'jordami01', 1996, league, extras, team);
    const p = r.league.teams.find(t => t.teamId === team)!.seasons.find(s => s.playerId === r.playerId)!;
    expect(r.playerId).toBe('Michael Jordan');
    expect(p.jerseyNumber).toBe(23);
    expect(p.age).toBe(32);
    expect(p.importedFrom).toEqual({ season: 1996, realId: 'jordami01' });
    expect(calculateOverall(p)).toBeGreaterThanOrEqual(Math.max(...league.teams.flatMap(t => t.seasons.map(calculateOverall))) - 5);
    expect(r.extras.contracts[r.playerId].teamId).toBe(team);
    // A second copy gets a distinct id.
    const again = importHistoricalPlayer(h, 'jordami01', 1991, r.league, r.extras, null);
    expect(again.playerId).not.toBe('Michael Jordan');
    expect(again.extras.freeAgents.some(f => f.playerId === again.playerId)).toBe(true);
  });
});

describe('sandbox: sticking players', () => {
  it('Curry stuck with Klay follows him to Dallas, even with Historical rosters on', () => {
    const built = buildHistoricalLeague(h, 2023, { realDevelopment: true, forceRosters: true, difficulty: 'normal', seed: 2 });
    expect(teamOf(built.league, 'Stephen Curry')).toBe('GSW');
    const stuck = setStick(built.league, built.extras, 'Stephen Curry', { withPlayerId: 'Klay Thompson' });
    const next = applyHistoricalRosters({ ...stuck.league, season: '2024' }, stuck.extras, null);
    expect(teamOf(next.league, 'Klay Thompson')).toBe('DAL');
    expect(teamOf(next.league, 'Stephen Curry')).toBe('DAL');
    expect(next.extras.contracts['Stephen Curry'].teamId).toBe('DAL');
  });

  it('a player stuck to a team cannot be traded or waived, and never retires', () => {
    const { league, extras } = generateFullLeague(8, 6, 13, 10, '2026', { priorSeasons: false });
    const [a, b] = league.teams;
    const star = a.seasons[0];
    const s = setStick(league, extras, star.playerId, { teamId: a.teamId });
    const trade = validateTrade(s.league, s.extras, { teamAId: a.teamId, teamBId: b.teamId, playersFromA: [star.playerId], playersFromB: [b.seasons[0].playerId] });
    expect(trade.valid).toBe(false);
    expect(trade.reasons.join(' ')).toMatch(/stuck/);
    expect(waiveToFreeAgency(s.league, s.extras, star.playerId, a.teamId).league).toBe(s.league);
    const old = { ...s.league, teams: s.league.teams.map(t => t.teamId !== a.teamId ? t : { ...t, seasons: t.seasons.map(p => p.playerId === star.playerId ? { ...p, age: 46 } : p) }) };
    const rolled = beginNewSeasonRoster(old, s.extras, 9);
    expect(rolled.summary.retiredPlayerIds).not.toContain(star.playerId);
    expect(teamOf(rolled.league, star.playerId)).toBe(a.teamId);
  });

  it('a follower goes with his anchor in a trade, and back if moved away alone', () => {
    const { league, extras } = generateFullLeague(9, 6, 13, 10, '2026', { priorSeasons: false });
    const [a, b] = league.teams;
    const anchor = a.seasons[0].playerId, follower = a.seasons[1].playerId;
    const s = setStick(league, extras, follower, { withPlayerId: anchor });
    const relaxed = { ...s.extras, capSettings: { ...s.extras.capSettings, enforceCapOnTrades: false } };
    const traded = executeTrade(s.league, relaxed, { teamAId: a.teamId, teamBId: b.teamId, playersFromA: [anchor], playersFromB: [b.seasons[0].playerId] });
    expect(teamOf(traded.league, anchor)).toBe(b.teamId);
    expect(teamOf(traded.league, follower)).toBe(b.teamId);
    expect(enforceSticky(traded.league, traded.extras).moved).toHaveLength(0);
    const unstuck = setStick(traded.league, traded.extras, follower, null);
    expect(unstuck.league.teams.flatMap(t => t.seasons).find(p => p.playerId === follower)!.stick).toBeUndefined();
  });
});
