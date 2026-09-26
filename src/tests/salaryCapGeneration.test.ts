import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { teamPayroll } from '../simulation/gm';

describe('freshly generated league salary cap sanity', () => {
  it('every team starts at or under the salary cap (not universally over it)', () => {
    const { league, extras } = generateFullLeague(1, 30, 18, 82, '2026-27');
    const overCap = league.teams.filter((t) => teamPayroll(extras.contracts, t) > extras.capSettings.salaryCap);
    // A handful of teams over the cap (like in real life) is fine; every team starting over it is the bug.
    expect(overCap.length).toBeLessThan(league.teams.length);
    expect(overCap.length / league.teams.length).toBeLessThan(0.5);
  });

  it('most teams have real cap room to work with at the start of a new league', () => {
    const { league, extras } = generateFullLeague(2, 30, 18, 82, '2026-27');
    const withRoom = league.teams.filter((t) => teamPayroll(extras.contracts, t) < extras.capSettings.salaryCap * 0.95);
    expect(withRoom.length).toBeGreaterThan(league.teams.length * 0.5);
  });

  it('holds across different roster sizes used by sandbox/test leagues', () => {
    for (const rosterSize of [8, 10, 12, 18]) {
      const { league, extras } = generateFullLeague(3, 6, rosterSize, 20, '2026-27');
      const avgPayroll = league.teams.reduce((sum, t) => sum + teamPayroll(extras.contracts, t), 0) / league.teams.length;
      expect(avgPayroll).toBeLessThan(extras.capSettings.salaryCap * 1.1);
    }
  });
});
