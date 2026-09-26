import { describe, it, expect } from 'vitest';
import { RNG } from '../simulation/engine/rng';
import { generateCoachIdentity, recordCoachResult, fireAndReplaceCoach } from '../simulation/coaching';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateNextGame } from '../simulation/league';
import { computeSeasonAwards } from '../simulation/awards';

describe('coaching module', () => {
  it('generates a real named coach with a rating and contract', () => {
    const coach = generateCoachIdentity(new RNG(1), '2026-27', new Set());
    expect(coach.coachId.split(' ').length).toBeGreaterThanOrEqual(2);
    expect(coach.rating).toBeGreaterThanOrEqual(40);
    expect(coach.rating).toBeLessThanOrEqual(89);
    expect(coach.contract.annualSalary).toBeGreaterThan(0);
    expect(coach.careerWins).toBe(0);
    expect(coach.careerLosses).toBe(0);
  });

  it('recordCoachResult tallies wins and losses without mutating the original', () => {
    const coach = generateCoachIdentity(new RNG(2), '2026-27', new Set());
    const afterWin = recordCoachResult(coach, true);
    const afterLoss = recordCoachResult(afterWin, false);
    expect(coach.careerWins).toBe(0); // original untouched
    expect(afterWin?.careerWins).toBe(1);
    expect(afterLoss?.careerWins).toBe(1);
    expect(afterLoss?.careerLosses).toBe(1);
  });

  it('fireAndReplaceCoach produces a fresh coach with a reset career record', () => {
    const original = generateCoachIdentity(new RNG(3), '2026-27', new Set());
    const withRecord = recordCoachResult(recordCoachResult(original, true)!, true)!;
    const replacement = fireAndReplaceCoach(999, '2027-28');
    expect(replacement.careerWins).toBe(0);
    expect(replacement.careerLosses).toBe(0);
    expect(replacement.hiredSeason).toBe('2027-28');
    expect(withRecord.careerWins).toBe(2); // sanity: the fired coach's own record is untouched by this call
  });

  it('every generated team has a real coach identity, not just style tendencies', () => {
    const { league } = generateFullLeague(4, 10, 8, 5);
    expect(league.teams.every((t) => !!t.coachIdentity)).toBe(true);
    const names = new Set(league.teams.map((t) => t.coachIdentity!.coachId));
    expect(names.size).toBe(league.teams.length); // no duplicate coach names
  });

  it('a coach\'s win/loss record updates as games are simulated', () => {
    const { league } = generateFullLeague(6, 4, 8, 10);
    const teamId = league.teams[0].teamId;
    const before = league.teams[0].coachIdentity!;
    const after = simulateNextGame(league, 55);
    const afterCoach = after.teams.find((t) => t.teamId === teamId)!.coachIdentity!;
    expect(afterCoach.careerWins + afterCoach.careerLosses).toBe(before.careerWins + before.careerLosses + 1);
  });

  it('Coach of the Year references the actual coach\'s name when available', () => {
    const { league: fresh } = generateFullLeague(8, 6, 8, 15);
    let league = fresh;
    for (let i = 0; i < 15 * 3; i++) {
      const unplayed = league.schedule.some((g) => !g.played);
      if (!unplayed) break;
      league = simulateNextGame(league, i + 1);
    }
    const awards = computeSeasonAwards(league, { minGames: 5 });
    if (awards.coy) {
      const team = league.teams.find((t) => t.teamId === awards.coy!.teamId);
      expect(awards.coy.coachName).toBe(team?.coachIdentity?.coachId ?? null);
    }
  });
});
