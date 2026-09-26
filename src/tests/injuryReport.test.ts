import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import type { InjuryRecord } from '../simulation/league';
import { listLeagueInjuries, listTeamInjuries, redistributeMinutesForInjuries, healthyRotationMinutes, restoreMinutesIfHealthy } from '../simulation/injuryReport';

describe('listLeagueInjuries / listTeamInjuries', () => {
  it('lists active injuries with the right player/team joined in, sorted by games remaining', () => {
    const { league } = generateFullLeague(1, 4, 8, 10, '2026-27');
    const teamA = league.teams[0];
    const teamB = league.teams[1];
    const injuries: Record<string, InjuryRecord> = {
      [teamA.seasons[0].playerId]: { playerId: teamA.seasons[0].playerId, teamId: teamA.teamId, severity: 'minor', gamesRemaining: 2, totalGames: 2 },
      [teamB.seasons[0].playerId]: { playerId: teamB.seasons[0].playerId, teamId: teamB.teamId, severity: 'severe', gamesRemaining: 20, totalGames: 25 },
    };
    const injuredLeague = { ...league, injuries };

    const all = listLeagueInjuries(injuredLeague);
    expect(all.length).toBe(2);
    expect(all[0].record.gamesRemaining).toBe(20); // sorted worst-first
    expect(all[0].teamName).toBe(teamB.name);

    const onlyA = listTeamInjuries(injuredLeague, teamA.teamId);
    expect(onlyA.length).toBe(1);
    expect(onlyA[0].player.playerId).toBe(teamA.seasons[0].playerId);
  });

  it('returns an empty list when nobody is hurt', () => {
    const { league } = generateFullLeague(2, 4, 8, 10, '2026-27');
    expect(listLeagueInjuries(league)).toEqual([]);
  });
});

describe('redistributeMinutesForInjuries', () => {
  it('is a no-op when the (healthy) rotation already covers a full game, injuries or not', () => {
    const { league } = generateFullLeague(3, 4, 8, 10, '2026-27');
    const team = league.teams[0];
    const fullyRotated = { ...team, seasons: team.seasons.map((s) => ({ ...s, minutes: { ...s.minutes, target: 40 } })) };
    const result = redistributeMinutesForInjuries(fullyRotated, undefined);
    expect(result).toBe(fullyRotated);
  });

  it('raises healthy players\' minute targets to cover an injured starter\'s minutes, without touching the injured player', () => {
    const { league } = generateFullLeague(4, 4, 8, 10, '2026-27');
    const team = league.teams[0];
    // Force a clean, predictable starting rotation: 5 players at 40 min target (200 total, 40 short of 240).
    const seeded = {
      ...team,
      seasons: team.seasons.map((s, i) => ({ ...s, minutes: { ...s.minutes, target: i < 5 ? 40 : 10 } })),
    };
    const injuredId = seeded.seasons[0].playerId;
    const injuries: Record<string, InjuryRecord> = {
      [injuredId]: { playerId: injuredId, teamId: seeded.teamId, severity: 'severe', gamesRemaining: 10, totalGames: 10 },
    };

    const before = healthyRotationMinutes(seeded, injuries);
    const result = redistributeMinutesForInjuries(seeded, injuries);
    const after = healthyRotationMinutes(result, injuries);

    expect(after).toBeGreaterThan(before);
    const injuredPlayerAfter = result.seasons.find((s) => s.playerId === injuredId)!;
    expect(injuredPlayerAfter.minutes.target).toBe(40); // untouched, even though they're sidelined
  });

  it('never pushes any single player past the configured cap', () => {
    const { league } = generateFullLeague(5, 4, 6, 8, '2026-27');
    const team = league.teams[0];
    // Injure everyone but one player, so the deficit is huge relative to one healthy body.
    const [healthyPlayer, ...rest] = team.seasons;
    const injuries: Record<string, InjuryRecord> = {};
    for (const s of rest) injuries[s.playerId] = { playerId: s.playerId, teamId: team.teamId, severity: 'severe', gamesRemaining: 5, totalGames: 5 };

    const result = redistributeMinutesForInjuries(team, injuries, { maxPerPlayer: 40 });
    const healthyAfter = result.seasons.find((s) => s.playerId === healthyPlayer.playerId)!;
    expect(healthyAfter.minutes.target).toBeLessThanOrEqual(40);
  });

  it('does nothing when the healthy rotation already covers a full game', () => {
    const { league } = generateFullLeague(6, 4, 6, 8, '2026-27');
    const team = league.teams[0];
    const seeded = { ...team, seasons: team.seasons.map((s) => ({ ...s, minutes: { ...s.minutes, target: 40 } })) };
    const result = redistributeMinutesForInjuries(seeded, undefined);
    expect(result).toBe(seeded);
  });

  it('is idempotent: calling it twice while the same players are hurt does not compound the deficit', () => {
    const { league } = generateFullLeague(7, 4, 8, 10, '2026-27');
    const team = league.teams[0];
    const seeded = { ...team, seasons: team.seasons.map((s, i) => ({ ...s, minutes: { ...s.minutes, target: i < 5 ? 40 : 10 } })) };
    const injuredId = seeded.seasons[0].playerId;
    const injuries: Record<string, InjuryRecord> = {
      [injuredId]: { playerId: injuredId, teamId: seeded.teamId, severity: 'severe', gamesRemaining: 10, totalGames: 10 },
    };
    const once = redistributeMinutesForInjuries(seeded, injuries);
    const twice = redistributeMinutesForInjuries(once, injuries);
    expect(healthyRotationMinutes(twice, injuries)).toBe(healthyRotationMinutes(once, injuries));
  });
});

describe('restoreMinutesIfHealthy', () => {
  it('reverts every redistributed target back to its pre-injury baseline and clears the marker', () => {
    const { league } = generateFullLeague(8, 4, 8, 10, '2026-27');
    const team = league.teams[0];
    const seeded = { ...team, seasons: team.seasons.map((s, i) => ({ ...s, minutes: { ...s.minutes, target: i < 5 ? 40 : 10 } })) };
    const injuredId = seeded.seasons[0].playerId;
    const injuries: Record<string, InjuryRecord> = {
      [injuredId]: { playerId: injuredId, teamId: seeded.teamId, severity: 'severe', gamesRemaining: 10, totalGames: 10 },
    };
    const redistributed = redistributeMinutesForInjuries(seeded, injuries);
    expect(redistributed.seasons.some((s) => s.minutes.baselineTarget != null)).toBe(true);

    const restored = restoreMinutesIfHealthy(redistributed);
    for (const s of restored.seasons) {
      expect(s.minutes.baselineTarget).toBeUndefined();
      const original = seeded.seasons.find((o) => o.playerId === s.playerId)!;
      expect(s.minutes.target).toBe(original.minutes.target);
    }
  });

  it('is a no-op when nothing was ever redistributed', () => {
    const { league } = generateFullLeague(9, 4, 8, 10, '2026-27');
    const team = league.teams[0];
    const result = restoreMinutesIfHealthy(team);
    expect(result).toBe(team);
  });
});
