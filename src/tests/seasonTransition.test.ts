import { describe, it, expect } from 'vitest';
import { nextSeasonLabel, advanceToNextSeason } from '../simulation/seasonTransition';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRemainingSeason, totalGamesForTeam } from '../simulation/league';
import { emptySeasonStatTotals } from '../simulation/types';

describe('nextSeasonLabel', () => {
  it('advances a standard "YYYY-YY" range label', () => {
    expect(nextSeasonLabel('2026-27')).toBe('2027-28');
    expect(nextSeasonLabel('1999-00')).toBe('2000-01');
  });
  it('advances a plain 4-digit year', () => {
    expect(nextSeasonLabel('2026')).toBe('2027');
  });
  it('falls back gracefully for unrecognized labels instead of throwing', () => {
    expect(nextSeasonLabel('legend-1990s')).toBe('legend-1990s-next');
  });
  it('defaults sensibly when there is no prior label at all', () => {
    expect(nextSeasonLabel(undefined)).toBe('2025');
  });
});

describe('advanceToNextSeason', () => {
  it('bumps the league season label forward', () => {
    const { league } = generateFullLeague(1, 4, 8, 12, '2026-27');
    const played = simulateRemainingSeason(league, 1);
    const { league: next } = advanceToNextSeason(played, generateFullLeague(1, 4, 8, 12, '2026-27').extras, 1);
    expect(next.season).toBe('2027-28');
  });

  it('archives the finished season into careerHistory and resets seasonStats, without touching earlier career entries', () => {
    const { league, extras } = generateFullLeague(2, 6, 8, 14, '2026-27', { priorSeasons: false }); // exact history-length assertions below assume no pre-generated seasons
    const played = simulateRemainingSeason(league, 2);
    const somePlayer = played.teams[0].seasons[0];
    expect(somePlayer.seasonStats?.gamesPlayed).toBeGreaterThan(0);

    const { league: afterOne, extras: extrasOne } = advanceToNextSeason(played, extras, 2);
    const rolledOnce = afterOne.teams.flatMap((t) => t.seasons).find((s) => s.playerId === somePlayer.playerId);
    // Player might have retired or hit free agency; only assert when they're still on a roster.
    if (rolledOnce) {
      expect(rolledOnce.careerHistory?.length).toBe(1);
      expect(rolledOnce.careerHistory?.[0].season).toBe('2026-27');
      expect(rolledOnce.careerHistory?.[0].stats.gamesPlayed).toBe(somePlayer.seasonStats?.gamesPlayed);
      expect(rolledOnce.seasonStats).toBeUndefined();
    }

    // Simulate a second season and advance again — history should accumulate, never overwrite.
    const playedTwo = simulateRemainingSeason(afterOne, 3);
    const { league: afterTwo } = advanceToNextSeason(playedTwo, extrasOne, 3);
    const rolledTwice = afterTwo.teams.flatMap((t) => t.seasons).find((s) => s.playerId === somePlayer.playerId);
    if (rolledTwice) {
      expect(rolledTwice.careerHistory?.length).toBe(2);
      expect(rolledTwice.careerHistory?.map((c) => c.season)).toEqual(['2026-27', '2027-28']);
    }
  }, 20000);

  it('ages every surviving player by exactly one year', () => {
    const { league, extras } = generateFullLeague(3, 4, 8, 12, '2026-27');
    const played = simulateRemainingSeason(league, 3);
    const agesBefore = new Map(played.teams.flatMap((t) => t.seasons).map((s) => [s.playerId, s.age]));
    const { league: next } = advanceToNextSeason(played, extras, 3);
    for (const s of next.teams.flatMap((t) => t.seasons)) {
      expect(s.age).toBe((agesBefore.get(s.playerId) ?? s.age - 1) + 1);
    }
  });

  it('regenerates a fresh, fully-unplayed schedule with the same games-per-team as before', () => {
    const { league, extras } = generateFullLeague(4, 4, 8, 12, '2026-27');
    const played = simulateRemainingSeason(league, 4);
    const before = totalGamesForTeam(played, played.teams[0].teamId);
    const { league: next } = advanceToNextSeason(played, extras, 4);
    expect(next.schedule.every((g) => !g.played)).toBe(true);
    expect(totalGamesForTeam(next, next.teams[0].teamId)).toBe(before);
  });

  it('reopens free agency and closes the draft window/trade block for the new season', () => {
    const { league, extras } = generateFullLeague(5, 4, 8, 12, '2026-27');
    const played = simulateRemainingSeason(league, 5);
    const dirtyExtras = { ...extras, draftDayOpen: true, freeAgencyOpen: false, tradeBlock: ['someone'] };
    const { extras: next } = advanceToNextSeason(played, dirtyExtras, 5);
    expect(next.draftDayOpen).toBe(false);
    expect(next.freeAgencyOpen).toBe(true);
    expect(next.tradeBlock).toEqual([]);
    expect(next.draftClass.length).toBeGreaterThan(0);
  });

  it('retires a player who is guaranteed too old regardless of ability', () => {
    const { league, extras } = generateFullLeague(6, 4, 6, 10, '2026-27');
    const oldPlayerTeam = league.teams[0];
    const oldPlayer = { ...oldPlayerTeam.seasons[0], age: 45, seasonStats: emptySeasonStatTotals() };
    const tweakedLeague = {
      ...league,
      teams: league.teams.map((t, i) => (i === 0 ? { ...t, seasons: [oldPlayer, ...t.seasons.slice(1)] } : t)),
    };
    const { summary, league: next } = advanceToNextSeason(tweakedLeague, extras, 6);
    expect(summary.retiredPlayerIds).toContain(oldPlayer.playerId);
    expect(next.teams[0].seasons.some((s) => s.playerId === oldPlayer.playerId)).toBe(false);
  });

  it('expires a contract with 1 year remaining into free agency', () => {
    const { league, extras } = generateFullLeague(7, 4, 6, 10, '2026-27');
    const targetTeam = league.teams[0];
    const targetPlayerId = targetTeam.seasons[0].playerId;
    const extrasWithExpiringContract = {
      ...extras,
      contracts: { ...extras.contracts, [targetPlayerId]: { ...extras.contracts[targetPlayerId], yearsRemaining: 1 } },
    };
    const { summary, league: next, extras: nextExtras } = advanceToNextSeason(league, extrasWithExpiringContract, 7);
    expect(summary.expiredToFreeAgencyIds).toContain(targetPlayerId);
    expect(next.teams[0].seasons.some((s) => s.playerId === targetPlayerId)).toBe(false);
    expect(nextExtras.freeAgents.some((s) => s.playerId === targetPlayerId)).toBe(true);
    expect(nextExtras.contracts[targetPlayerId]).toBeUndefined();
  });
});
