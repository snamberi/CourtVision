import { describe, it, expect } from 'vitest';
import { driftChemistryAfterGame, driftChemistryForRosterContinuity } from '../simulation/engine/chemistryEvolution';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateNextGame } from '../simulation/league';
import { beginNewSeasonRoster, finalizeNewSeasonSchedule } from '../simulation/seasonTransition';

describe('driftChemistryAfterGame', () => {
  it('nudges chemistry up on a win and down on a loss', () => {
    expect(driftChemistryAfterGame(70, true)).toBeGreaterThan(70);
    expect(driftChemistryAfterGame(70, false)).toBeLessThan(70);
  });

  it('clamps at 0 and 100', () => {
    expect(driftChemistryAfterGame(100, true)).toBe(100);
    expect(driftChemistryAfterGame(0, false)).toBe(0);
  });

  it('defaults to a neutral 70 baseline when chemistry is unset', () => {
    expect(driftChemistryAfterGame(undefined, true)).toBeGreaterThan(70);
  });
});

describe('driftChemistryForRosterContinuity', () => {
  it('boosts chemistry for a team that kept almost everyone', () => {
    const before = ['a', 'b', 'c', 'd', 'e'];
    const after = ['a', 'b', 'c', 'd', 'f'];
    expect(driftChemistryForRosterContinuity(70, before, after)).toBeGreaterThan(70);
  });

  it('hurts chemistry for a team that churned its whole roster', () => {
    const before = ['a', 'b', 'c', 'd', 'e'];
    const after = ['v', 'w', 'x', 'y', 'z'];
    expect(driftChemistryForRosterContinuity(70, before, after)).toBeLessThan(70);
  });

  it('leaves chemistry alone when there was no prior roster to compare against', () => {
    expect(driftChemistryForRosterContinuity(70, [], ['a', 'b'])).toBe(70);
  });
});

describe('chemistry evolution wired into the sim', () => {
  it('simulateNextGame moves the winning team\'s chemistry up and the losing team\'s down', () => {
    const { league } = generateFullLeague(1, 4, 8, 10, '2026-27');
    const g = league.schedule[0];
    const homeChemBefore = league.teams.find((t) => t.teamId === g.homeTeamId)!.chemistry ?? 70;
    const awayChemBefore = league.teams.find((t) => t.teamId === g.awayTeamId)!.chemistry ?? 70;
    const next = simulateNextGame(league, 1);
    const playedGame = next.schedule[0];
    const homeWon = playedGame.result!.homeScore > playedGame.result!.awayScore;
    const homeChemAfter = next.teams.find((t) => t.teamId === g.homeTeamId)!.chemistry!;
    const awayChemAfter = next.teams.find((t) => t.teamId === g.awayTeamId)!.chemistry!;
    if (homeWon) {
      expect(homeChemAfter).toBeGreaterThan(homeChemBefore);
      expect(awayChemAfter).toBeLessThan(awayChemBefore);
    } else {
      expect(homeChemAfter).toBeLessThan(homeChemBefore);
      expect(awayChemAfter).toBeGreaterThan(awayChemBefore);
    }
  });

  it('a full-roster-turnover team sees a chemistry hit once the new season starts', () => {
    const { league, extras } = generateFullLeague(2, 4, 8, 10, '2026-27');
    const { league: rosterLeague, extras: rosterExtras } = beginNewSeasonRoster(league, extras, 2);
    const teamId = rosterLeague.teams[0].teamId;
    const chemBefore = rosterLeague.teams[0].chemistry ?? 70;
    // Simulate a total roster wipeout: replace every player's id-bearing season with a fresh one waived in from elsewhere.
    const churnedLeague = {
      ...rosterLeague,
      teams: rosterLeague.teams.map((t, i) => (i === 0 ? { ...t, seasons: [] } : t)),
    };
    const finalized = finalizeNewSeasonSchedule(churnedLeague);
    const chemAfter = finalized.teams.find((t) => t.teamId === teamId)!.chemistry ?? 70;
    expect(chemAfter).toBeLessThan(chemBefore);
    void rosterExtras;
  });
});
