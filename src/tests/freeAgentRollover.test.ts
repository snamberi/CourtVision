import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { beginNewSeasonRoster, rollFreeAgentsForward } from '../simulation/seasonTransition';
import { waiveToFreeAgency } from '../simulation/gm';
import { emptySeasonStatTotals } from '../simulation/types';

describe('unsigned free agents at the season rollover', () => {
  it('archives their games, resets totals, ages them and moves them into the new season', () => {
    const { league, extras } = generateFullLeague(111, 4, 13, 10, '2026', { priorSeasons: false });
    const team = league.teams[0];
    const target = team.seasons[0];
    const played = { ...league, teams: league.teams.map(t => t.teamId !== team.teamId ? t : { ...t, seasons: t.seasons.map(s => s.playerId !== target.playerId ? s : {
      ...s, age: 27, seasonStats: { ...emptySeasonStatTotals(), gamesPlayed: 4, minutes: 80, points: 36 } }) }) };
    const waived = waiveToFreeAgency(played, { ...extras, capSettings: { ...extras.capSettings, minRosterSize: 0 } }, target.playerId, team.teamId);
    const { league: next, extras: nextExtras } = beginNewSeasonRoster(waived.league, waived.extras, 5, { minGames: 1 });

    const fa = nextExtras.freeAgents.find(p => p.playerId === target.playerId);
    const retired = next.retiredPlayers?.find(r => r.playerId === target.playerId);
    expect(!!fa !== !!retired).toBe(true); // exactly one fate
    const p = fa ?? retired!.finalSeasonData!;
    expect(p.age).toBe(28);
    expect(p.season).toBe(next.season);
    expect(p.seasonStats).toBeUndefined();
    const line = p.careerHistory?.find(h => h.season === '2026');
    expect(line?.stats.gamesPlayed).toBe(4);
    expect(line?.stats.points).toBe(36);
    expect(line?.teamId).toBe(team.teamId);
  });

  it('is idempotent and lets fringe veterans leave the pool', () => {
    const { league, extras } = generateFullLeague(112, 4, 13, 10, '2026', { priorSeasons: false });
    const pool = extras.freeAgents.length ? extras.freeAgents : league.teams[1].seasons.map(s => ({ ...s, teamId: null }));
    const once = rollFreeAgentsForward(league, pool, '2026', '2027', 9);
    const twice = rollFreeAgentsForward(league, once.freeAgents, '2026', '2027', 9);
    expect(twice.freeAgents).toEqual(once.freeAgents);
    expect(twice.retired).toHaveLength(0);
    // Old, low-rated free agents don't linger forever.
    const vets = pool.slice(0, 20).map(s => ({ ...s, age: 36 }));
    const rolled = rollFreeAgentsForward(league, vets, '2026', '2027', 3);
    expect(rolled.retired.length).toBeGreaterThan(0);
    expect(rolled.freeAgents.length + rolled.retired.length).toBe(vets.length);
  });
});
