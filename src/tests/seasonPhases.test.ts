import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRemainingSeason, gamesRemainingForTeam, totalGamesForTeam } from '../simulation/league';
import { beginNewSeasonRoster, finalizeNewSeasonSchedule } from '../simulation/seasonTransition';
import { pickPlayoffBracketSize } from '../simulation/playoffs';

describe('beginNewSeasonRoster', () => {
  it('ages the roster and opens the draft without touching the schedule', () => {
    const { league, extras } = generateFullLeague(1, 4, 8, 10, '2026-27');
    const played = simulateRemainingSeason(league, 1);
    const { league: next, extras: nextExtras } = beginNewSeasonRoster(played, extras, 1);
    expect(next.seasonPhase).toBe('draft');
    expect(nextExtras.draftDayOpen).toBe(true);
    expect(nextExtras.freeAgencyOpen).toBe(false);
    // Schedule is untouched (still the old, fully-played one) - finalizeNewSeasonSchedule hasn't run yet.
    expect(next.schedule).toBe(played.schedule);
  });

  it('produces a fresh draft class and resets the pick index', () => {
    const { league, extras } = generateFullLeague(2, 4, 8, 10, '2026-27');
    const played = simulateRemainingSeason(league, 2);
    const { extras: nextExtras } = beginNewSeasonRoster(played, extras, 2);
    expect(nextExtras.draftClass.length).toBeGreaterThan(0);
    expect(nextExtras.draftPickIndex).toBe(0);
  });
});

describe('finalizeNewSeasonSchedule', () => {
  it('regenerates a fully-unplayed schedule and returns to regular_season phase, clearing injuries', () => {
    const { league, extras } = generateFullLeague(3, 4, 8, 10, '2026-27');
    const played = simulateRemainingSeason(league, 3);
    const injured = { ...played, injuries: { somePlayer: { playerId: 'somePlayer', teamId: played.teams[0].teamId, severity: 'minor' as const, gamesRemaining: 3, totalGames: 3 } } };
    const { league: rosterLeague } = beginNewSeasonRoster(injured, extras, 3);
    const finalized = finalizeNewSeasonSchedule(rosterLeague);
    expect(finalized.seasonPhase).toBe('regular_season');
    expect(finalized.schedule.every((g) => !g.played)).toBe(true);
    expect(finalized.injuries).toEqual({});
    expect(gamesRemainingForTeam(finalized, finalized.teams[0].teamId)).toBe(totalGamesForTeam(played, played.teams[0].teamId));
  });
});

describe('pickPlayoffBracketSize', () => {
  it('scales the forced bracket size to how many teams the league actually has', () => {
    expect(pickPlayoffBracketSize(30)).toBe(16);
    expect(pickPlayoffBracketSize(16)).toBe(16);
    expect(pickPlayoffBracketSize(10)).toBe(8);
    expect(pickPlayoffBracketSize(8)).toBe(8);
    expect(pickPlayoffBracketSize(5)).toBe(4);
    expect(pickPlayoffBracketSize(2)).toBe(4);
  });
});
