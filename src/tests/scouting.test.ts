import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { combineResults, perceivedPotential, scoutingReport, toggleWorkout, workoutSlots, workoutsFor } from '../simulation/scouting';
import type { League } from '../simulation/league';

const withScouting = (league: League, teamId: string, scouting: number): League => ({
  ...league, teams: league.teams.map(t => t.teamId === teamId ? { ...t, expenseLevels: { scouting, coaching: 50, health: 50, facilities: 50 } } : t),
});
const meanError = (league: League, extras: ReturnType<typeof generateFullLeague>['extras'], teamId: string) =>
  extras.draftClass.reduce((n, p) => n + Math.abs(perceivedPotential(p, league, extras, teamId) - p.trueSeason.development.potential), 0) / extras.draftClass.length;

describe('scouting and the draft combine', () => {
  it('a bigger scouting budget reads potential more accurately and grants more workouts', () => {
    const { league, extras } = generateFullLeague(21, 30, 13, 10, '2026');
    const id = league.teams[0].teamId;
    const cheap = withScouting(league, id, 0), rich = withScouting(league, id, 100);
    expect(meanError(rich, extras, id)).toBeLessThan(meanError(cheap, extras, id));
    expect(workoutSlots(rich, id)).toBeGreaterThan(workoutSlots(cheap, id));
  });

  it('reports are stable, ranges contain the read, and a workout narrows the range', () => {
    const { league, extras } = generateFullLeague(22, 30, 13, 10, '2026');
    const id = league.teams[0].teamId, p = extras.draftClass[0];
    const before = scoutingReport(p, league, extras, id);
    expect(scoutingReport(p, league, extras, id)).toEqual(before);
    expect(before.potLow).toBeLessThanOrEqual(before.potMid);
    expect(before.potHigh).toBeGreaterThanOrEqual(before.potMid);
    const { extras: after } = toggleWorkout(league, extras, id, p.playerId);
    expect(workoutsFor(after, id)).toEqual([p.playerId]);
    const worked = scoutingReport(p, league, after, id);
    expect(worked.confidence).toBe('Workout');
    expect(worked.potHigh - worked.potLow).toBeLessThanOrEqual(before.potHigh - before.potLow);
    expect(Math.abs(worked.potMid - p.trueSeason.development.potential)).toBeLessThanOrEqual(1);
  });

  it('refuses workouts beyond the slot limit', () => {
    const { league, extras } = generateFullLeague(23, 30, 13, 10, '2026');
    const id = league.teams[0].teamId;
    let cur = extras;
    for (const p of extras.draftClass.slice(0, workoutSlots(league, id))) cur = toggleWorkout(league, cur, id, p.playerId).extras;
    const extra = toggleWorkout(league, cur, id, extras.draftClass[workoutSlots(league, id)].playerId);
    expect(extra.error).toBeTruthy();
    expect(extra.extras).toBe(cur);
  });

  it('combine numbers are deterministic and physically plausible', () => {
    const { extras } = generateFullLeague(24, 30, 13, 10, '2026');
    for (const p of extras.draftClass) {
      const c = combineResults(p.trueSeason);
      expect(combineResults(p.trueSeason)).toEqual(c);
      expect(c.maxVertical).toBeGreaterThan(20); expect(c.maxVertical).toBeLessThan(48);
      expect(c.laneAgility).toBeGreaterThan(9.5); expect(c.laneAgility).toBeLessThan(13.5);
      expect(c.heightNoShoes).toBeLessThan(c.heightShoes);
    }
  });
});
