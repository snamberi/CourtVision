import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRounds, type League } from '../simulation/league';
import { executeTrade, waiveToFreeAgency, signFreeAgent, type GMLeagueExtras } from '../simulation/gm';
import { seasonAdvancedWithStints, regularSeasonContext } from '../simulation/advancedStats';
import { buildTeamSeasonSummaries, beginNewSeasonRoster } from '../simulation/seasonTransition';
import { openStintStats, seasonStintsFor } from '../simulation/stints';

const relaxed = (e: GMLeagueExtras): GMLeagueExtras => ({ ...e, capSettings: { ...e.capSettings, enforceCapOnTrades: false, minRosterSize: 0, maxRosterSize: 99 } });

describe('team-specific season stints', () => {
  it('a mid-season trade splits the season between both teams everywhere it matters', () => {
    const { league: base, extras: e0 } = generateFullLeague(121, 6, 13, 30, '2026', { priorSeasons: false });
    let league: League = simulateRounds({ ...base, seasonPhase: 'regular_season' }, 10, 3);
    let extras = relaxed(e0);
    const [a, b] = league.teams;
    const moverA = a.seasons.find(s => (s.seasonStats?.gamesPlayed ?? 0) > 3)!;
    const moverB = b.seasons.find(s => (s.seasonStats?.gamesPlayed ?? 0) > 3)!;
    const gpBefore = moverA.seasonStats!.gamesPlayed;
    ({ league, extras } = executeTrade(league, extras, { teamAId: a.teamId, teamBId: b.teamId, playersFromA: [moverA.playerId], playersFromB: [moverB.playerId] }));
    league = simulateRounds(league, 10, 4);

    const now = league.teams.find(t => t.teamId === b.teamId)!.seasons.find(s => s.playerId === moverA.playerId)!;
    expect(now.seasonStints).toHaveLength(1);
    expect(now.seasonStints![0]).toMatchObject({ teamId: a.teamId });
    expect(now.seasonStints![0].stats.gamesPlayed).toBe(gpBefore);
    const rows = seasonStintsFor(now, b.teamId);
    expect(rows.map(r => r.teamId)).toEqual([a.teamId, b.teamId]);
    expect(rows.reduce((n, r) => n + r.stats.points, 0)).toBe(now.seasonStats!.points); // season total is conserved
    expect(openStintStats(now).gamesPlayed).toBe(now.seasonStats!.gamesPlayed - gpBefore);

    // Advanced: rated per team, Win Shares add up to the season line.
    const ctx = regularSeasonContext(league);
    const { combined, stints } = seasonAdvancedWithStints(league, ctx);
    const split = stints.get(moverA.playerId)!;
    expect(split.map(s => s.teamId)).toEqual([a.teamId, b.teamId]);
    expect(split.reduce((n, s) => n + (s.advanced?.ws ?? 0), 0)).toBeCloseTo(combined.get(moverA.playerId)!.ws, 6);

    // Team history: both teams list him with only their games.
    const summaries = buildTeamSeasonSummaries(league, ctx, combined, null, [], stints);
    const lineA = summaries.find(s => s.teamId === a.teamId)!.roster.find(r => r.playerId === moverA.playerId)!;
    const lineB = summaries.find(s => s.teamId === b.teamId)!.roster.find(r => r.playerId === moverA.playerId)!;
    expect(lineA.gp).toBe(gpBefore);
    expect(lineA.gp + lineB.gp).toBe(now.seasonStats!.gamesPlayed);
  }, 60_000);

  it('a waived player keeps his stint with the team that let him go, archived at the rollover', () => {
    const { league: base, extras: e0 } = generateFullLeague(122, 6, 13, 30, '2026', { priorSeasons: false });
    let league: League = simulateRounds({ ...base, seasonPhase: 'regular_season' }, 8, 5);
    let extras = relaxed(e0);
    const team = league.teams[2], cut = team.seasons.find(s => (s.seasonStats?.gamesPlayed ?? 0) > 2)!;
    ({ league, extras } = waiveToFreeAgency(league, extras, cut.playerId, team.teamId));
    const fa = extras.freeAgents.find(p => p.playerId === cut.playerId)!;
    expect(fa.seasonStints?.[0].teamId).toBe(team.teamId);
    // Another team signs him and he plays more.
    const other = league.teams[3];
    ({ league, extras } = signFreeAgent(league, { ...extras, freeAgencyOpen: true }, cut.playerId, other.teamId, { annualSalary: extras.capSettings.minSalary, yearsRemaining: 1, playerOption: false, teamOption: false }));
    league = simulateRounds(league, 8, 6);
    const { league: next, extras: nextExtras } = beginNewSeasonRoster(league, extras, 7, { minGames: 1 });
    const record = next.franchiseHistory!.at(-1)!;
    const cutLine = record.teamSeasons!.find(t => t.teamId === team.teamId)!.roster.find(r => r.playerId === cut.playerId);
    expect(cutLine?.gp).toBe(fa.seasonStints![0].stats.gamesPlayed);
    const player = [...next.teams.flatMap(t => t.seasons), ...nextExtras.freeAgents].find(p => p.playerId === cut.playerId) ?? next.retiredPlayers?.find(r => r.playerId === cut.playerId)?.finalSeasonData;
    const career = player!.careerHistory!.at(-1)!;
    expect(career.stints?.map(s => s.teamId)).toEqual([team.teamId, other.teamId]);
    expect(player!.seasonStints).toBeUndefined(); // reset for the new season
  }, 60_000);
});
