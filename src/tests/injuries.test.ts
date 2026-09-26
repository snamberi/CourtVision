import { ensureTalentInRotation } from '../simulation/rotationReview';
import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateNextGame, simulateRounds, type League, type InjuryRecord } from '../simulation/league';
import { redistributeMinutesForInjuries } from '../simulation/injuryReport';

function withInjury(league: League, playerId: string, teamId: string, gamesRemaining: number): League {
  const record: InjuryRecord = { playerId, teamId, severity: 'moderate', gamesRemaining, totalGames: gamesRemaining };
  return { ...league, injuries: { ...(league.injuries ?? {}), [playerId]: record } };
}

describe('persistent injury tracking', () => {
  it('sidelines an injured player from the boxscore entirely (not just mid-game)', () => {
    const { league } = generateFullLeague(1, 4, 8, 12, '2026-27');
    const g = league.schedule[0];
    const injuredId = league.teams.find((t) => t.teamId === g.homeTeamId)!.seasons[0].playerId;
    const injuredLeague = withInjury(league, injuredId, g.homeTeamId, 3);

    const next = simulateNextGame(injuredLeague, 1);
    const playedGame = next.schedule[0];
    expect(playedGame.played).toBe(true);
    expect(playedGame.result!.homeBox.players[injuredId]).toBeUndefined();
  });

  it("ticks the countdown down only on the injured player's own team games, not the whole league", () => {
    const { league } = generateFullLeague(2, 6, 8, 12, '2026-27');
    const teamId = league.teams[0].teamId;
    const injuredId = league.teams[0].seasons[0].playerId;
    const injuredLeague = withInjury(league, injuredId, teamId, 2);

    // Simulate one full round: every team (including this one) plays exactly once.
    const afterOneRound = simulateRounds(injuredLeague, 1, 1);
    expect(afterOneRound.injuries?.[injuredId]?.gamesRemaining).toBe(1);

    const afterTwoRounds = simulateRounds(afterOneRound, 1, 1);
    // Countdown hit 0 -> record removed, player fully healed.
    expect(afterTwoRounds.injuries?.[injuredId]).toBeUndefined();
  });

  it('returns a healed player to the active boxscore once their countdown reaches 0', () => {
    const { league } = generateFullLeague(3, 6, 8, 12, '2026-27');
    const teamId = league.teams[0].teamId;
    const injuredId = league.teams[0].seasons[0].playerId;
    let current = withInjury(league, injuredId, teamId, 1);

    current = simulateRounds(current, 1, 1); // this round: still out, countdown -> 0, removed
    expect(current.injuries?.[injuredId]).toBeUndefined();

    current = simulateRounds(current, 1, 1); // next round: should be playing again
    const teamGamesThisFar = current.schedule.filter((g) => g.played && (g.homeTeamId === teamId || g.awayTeamId === teamId));
    const latestTeamGame = teamGamesThisFar[teamGamesThisFar.length - 1];
    const box = latestTeamGame.homeTeamId === teamId ? latestTeamGame.result!.homeBox : latestTeamGame.result!.awayBox;
    expect(box.players[injuredId]).toBeDefined();
  });

  it('never fields fewer than 5 players even if most of a roster is hurt', () => {
    const { league } = generateFullLeague(4, 4, 8, 10, '2026-27');
    const g = league.schedule[0];
    const homeTeam = league.teams.find((t) => t.teamId === g.homeTeamId)!;
    let injured = league;
    // Injure all but 3 players on the home roster.
    for (const s of homeTeam.seasons.slice(0, Math.max(0, homeTeam.seasons.length - 3))) {
      injured = withInjury(injured, s.playerId, g.homeTeamId, 5);
    }
    const next = simulateNextGame(injured, 1);
    const box = next.schedule[0].result!.homeBox;
    const playersWithMinutes = Object.values(box.players).filter((p) => p.minutes > 0);
    expect(playersWithMinutes.length).toBeGreaterThanOrEqual(Math.min(5, homeTeam.seasons.length));
  });

  it('automatically reverts redistributed minutes once a team has fully healed', () => {
    const { league: raw } = generateFullLeague(5, 6, 8, 12, '2026-27');
    // Start from a talent-consistent rotation (the per-game talent check would otherwise fix it mid-test).
    const league = { ...raw, teams: raw.teams.map(t => ensureTalentInRotation(t)) };
    const teamId = league.teams[0].teamId;
    const injuredId = league.teams[0].seasons[0].playerId;
    const originalTargets = new Map(league.teams[0].seasons.map((s) => [s.playerId, s.minutes.target]));

    let current = withInjury(league, injuredId, teamId, 1);
    current = {
      ...current,
      teams: current.teams.map((t) => (t.teamId === teamId ? redistributeMinutesForInjuries(t, current.injuries) : t)),
    };
    const afterRedistribute = current.teams.find((t) => t.teamId === teamId)!;
    expect(afterRedistribute.seasons.some((s) => s.minutes.baselineTarget != null)).toBe(true);

    current = simulateRounds(current, 1, 1); // countdown hits 0 this round -> team is now fully healthy
    const healedTeam = current.teams.find((t) => t.teamId === teamId)!;
    for (const s of healedTeam.seasons) {
      expect(s.minutes.baselineTarget).toBeUndefined();
      expect(s.minutes.target).toBe(originalTargets.get(s.playerId));
    }
  });
});
