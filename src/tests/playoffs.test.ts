import { describe, it, expect } from 'vitest';
import { generatePlayoffBracket, simulateNextPlayoffGame, simulateFullPlayoffs, simulateCurrentPlayoffRound } from '../simulation/playoffs';
import { generateRoundRobinSchedule, simulateRemainingSeason, type League } from '../simulation/league';
import { buildDemoTeam } from '../simulation/presets/samplePlayers';
import { DEFAULT_GAME_SETTINGS } from '../simulation/types';

function buildSeededLeague(teamCount: number, seed: number): League {
  const teams = Array.from({ length: teamCount }, (_, i) => {
    const demo = buildDemoTeam(`T${i}`, `Team ${i}`);
    return { teamId: demo.teamId, name: demo.label, seasons: demo.seasons };
  });
  const schedule = generateRoundRobinSchedule(teams.map((t) => t.teamId), 1);
  let league: League = { teams, schedule, settings: { ...DEFAULT_GAME_SETTINGS } };
  league = simulateRemainingSeason(league, seed);
  return league;
}

describe('playoff bracket generation', () => {
  it('seeds the top 8 teams by winPct into a 1v8/2v7/3v6/4v5 first round', () => {
    const league = buildSeededLeague(8, 11);
    const bracket = generatePlayoffBracket(league, 8);
    expect(bracket.rounds[0].length).toBe(4);
    expect(bracket.rounds.length).toBe(3);
    const seed1 = bracket.rounds[0][0].teamAId;
    const seed8 = bracket.rounds[0][0].teamBId;
    expect(seed1).not.toBe(seed8);
  });

  it('later rounds start with empty slots until earlier rounds resolve', () => {
    const league = buildSeededLeague(8, 12);
    const bracket = generatePlayoffBracket(league, 8);
    expect(bracket.rounds[1][0].teamAId).toBeNull();
    expect(bracket.rounds[1][0].teamBId).toBeNull();
  });
});

describe('playoff series simulation', () => {
  it('a series ends exactly when one side reaches 4 wins (best of 7)', () => {
    let league = buildSeededLeague(4, 20);
    let bracket = generatePlayoffBracket(league, 4);
    let guard = 0;
    while (!bracket.rounds[0][0].winnerTeamId && guard < 20) {
      const step = simulateNextPlayoffGame(bracket, league, 1);
      bracket = step.bracket;
      league = step.league;
      guard++;
    }
    const series = bracket.rounds[0][0];
    expect(series.winnerTeamId).not.toBeNull();
    expect(Math.max(series.teamAWins, series.teamBWins)).toBe(4);
    expect(series.games.length).toBeGreaterThanOrEqual(4);
    expect(series.games.length).toBeLessThanOrEqual(7);
  });

  it('winners correctly advance into the next round slot', () => {
    let league = buildSeededLeague(4, 21);
    let bracket = generatePlayoffBracket(league, 4);
    while (!bracket.rounds[0][0].winnerTeamId) {
      const step = simulateNextPlayoffGame(bracket, league, 2);
      bracket = step.bracket; league = step.league;
    }
    while (!bracket.rounds[0][1].winnerTeamId) {
      const step = simulateNextPlayoffGame(bracket, league, 3);
      bracket = step.bracket; league = step.league;
    }
    expect(bracket.rounds[1][0].teamAId).toBe(bracket.rounds[0][0].winnerTeamId);
    expect(bracket.rounds[1][0].teamBId).toBe(bracket.rounds[0][1].winnerTeamId);
  });

  it('simulateCurrentPlayoffRound plays out every series in the active round but stops before the next round starts', () => {
    const league = buildSeededLeague(8, 22);
    const bracket = generatePlayoffBracket(league, 8);
    const step = simulateCurrentPlayoffRound(bracket, league, 5);
    expect(step.bracket.rounds[0].every((s) => s.winnerTeamId !== null)).toBe(true);
    expect(step.bracket.rounds[1].every((s) => s.games.length === 0)).toBe(true);
  });
});

describe('full bracket simulation', () => {
  it('simulating a full 8-team bracket produces exactly one champion who won their final series', () => {
    const league = buildSeededLeague(8, 30);
    const bracket = generatePlayoffBracket(league, 8);
    const finished = simulateFullPlayoffs(bracket, league, 40);
    expect(finished.bracket.championTeamId).not.toBeNull();
    const finals = finished.bracket.rounds[finished.bracket.rounds.length - 1][0];
    expect(finals.winnerTeamId).toBe(finished.bracket.championTeamId);
  });

  it('injuries suffered mid-bracket carry a coherent countdown through to the end instead of throwing or going stale', () => {
    const league = buildSeededLeague(4, 31);
    const bracket = generatePlayoffBracket(league, 4);
    const finished = simulateFullPlayoffs(bracket, league, 50);
    for (const rec of Object.values(finished.league.injuries ?? {})) {
      expect(rec.gamesRemaining).toBeGreaterThan(0);
    }
  });
});

import { generateConferencePlayoffBracket, playInPending } from '../simulation/playoffs';
import { computeConferenceStandings } from '../simulation/league';
import { generateFullLeague as genLeague } from '../simulation/leagueGenerator';
import { simulateRounds as simRounds } from '../simulation/league';
describe('play-in tournament', () => {
  it('seeds 7-10 play in, winners fill the 7 and 8 slots, and the bracket follows 1v8/4v5 and 3v6/2v7', () => {
    const league = simRounds(genLeague(21, 30, 12, 10).league, 10, 3);
    const bracket = generateConferencePlayoffBracket(league);
    const { east } = computeConferenceStandings(league);
    const seed = (n: number) => east[n - 1].teamId;
    expect([bracket.rounds[0][0].teamAId, bracket.rounds[0][1].teamAId, bracket.rounds[0][1].teamBId, bracket.rounds[0][2].teamAId, bracket.rounds[0][2].teamBId, bracket.rounds[0][3].teamAId])
      .toEqual([seed(1), seed(4), seed(5), seed(3), seed(6), seed(2)]);
    const afterPlayIn = simulateCurrentPlayoffRound(bracket, league, 5);
    expect(playInPending(afterPlayIn.bracket)).toBe(false);
    expect(afterPlayIn.bracket.rounds[0].every(s => s.teamAWins + s.teamBWins === 0)).toBe(true); // play-in first, nothing else yet
    const eastGames = afterPlayIn.bracket.playIn!.filter(g => g.conference === 'east');
    const g78 = eastGames.find(g => g.kind === '7v8')!, final = eastGames.find(g => g.kind === 'final')!;
    expect(afterPlayIn.bracket.rounds[0][3].teamBId).toBe(g78.winnerTeamId);
    expect(afterPlayIn.bracket.rounds[0][0].teamBId).toBe(final.winnerTeamId);
    expect(final.teamAId).toBe(g78.loserTeamId);
    const done = simulateFullPlayoffs(afterPlayIn.bracket, afterPlayIn.league, 5);
    expect(done.bracket.championTeamId).not.toBeNull();
  });
});

describe('playoff game day', () => {
  it('plays one game in every series still going, not just the first matchup', async () => {
    const { simulatePlayoffGameDay } = await import('../simulation/playoffs');
    const league = buildSeededLeague(8, 31);
    const bracket = generatePlayoffBracket(league, 8);
    const day = simulatePlayoffGameDay(bracket, league, 5);
    expect(day.played).toHaveLength(4);
    expect(day.bracket.rounds[0].every(s => s.games.length === 1)).toBe(true);
    // Day after day the bracket finishes, and no series ever plays twice in one day.
    let b = day.bracket, l = day.league;
    for (let i = 0; i < 40 && !b.championTeamId; i++) {
      const before = new Map(b.rounds.flat().map(s => [s.id, s.games.length]));
      const next = simulatePlayoffGameDay(b, l, 5 + i);
      for (const s of next.bracket.rounds.flat()) expect(s.games.length - (before.get(s.id) ?? 0)).toBeLessThanOrEqual(1);
      b = next.bracket; l = next.league;
    }
    expect(b.championTeamId).toBeTruthy();
  });
});
