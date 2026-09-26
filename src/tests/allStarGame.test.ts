import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRemainingSeason } from '../simulation/league';
import { computeSeasonAwards } from '../simulation/awards';
import { simulateAllStarGame } from '../simulation/allStarGame';

describe('simulateAllStarGame', () => {
  it('returns null when there are not enough All-Stars selected to fill two squads', () => {
    const { league } = generateFullLeague(1, 6, 8, 10, '2026-27');
    const played = simulateRemainingSeason(league, 1);
    const awards = computeSeasonAwards(played, { minGames: 1, allStarCount: 4 });
    expect(simulateAllStarGame(played, awards, 1)).toBeNull();
  });

  it('drafts two squads of real players and produces a valid, scored exhibition game', () => {
    const { league } = generateFullLeague(2, 10, 12, 14, '2026-27');
    const played = simulateRemainingSeason(league, 2);
    const awards = computeSeasonAwards(played, { minGames: 1, allStarCount: 24 });
    const game = simulateAllStarGame(played, awards, 2);
    expect(game).not.toBeNull();
    if (game) {
      expect(game.squadA.playerIds.length).toBeGreaterThanOrEqual(5);
      expect(game.squadB.playerIds.length).toBeGreaterThanOrEqual(5);
      // No player drafted onto both squads.
      const overlap = game.squadA.playerIds.filter((id) => game.squadB.playerIds.includes(id));
      expect(overlap.length).toBe(0);
      expect(game.result.homeScore).toBeGreaterThan(0);
      expect(game.result.awayScore).toBeGreaterThan(0);
    }
  });

  it('splits star power roughly evenly between the two squads (snake draft)', () => {
    const { league } = generateFullLeague(3, 10, 12, 14, '2026-27');
    const played = simulateRemainingSeason(league, 3);
    const awards = computeSeasonAwards(played, { minGames: 1, allStarCount: 24 });
    const game = simulateAllStarGame(played, awards, 3);
    expect(game).not.toBeNull();
    if (game) {
      const scoreById = new Map(awards.allStars.map((w) => [w.playerId, w.score]));
      const sumA = game.squadA.playerIds.reduce((s, id) => s + (scoreById.get(id) ?? 0), 0);
      const sumB = game.squadB.playerIds.reduce((s, id) => s + (scoreById.get(id) ?? 0), 0);
      const diff = Math.abs(sumA - sumB);
      const total = sumA + sumB;
      // Snake draft should keep the gap well under half the combined star power.
      expect(diff).toBeLessThan(total * 0.5);
    }
  });

  it('is deterministic given the same seed', () => {
    const { league } = generateFullLeague(4, 10, 12, 14, '2026-27');
    const played = simulateRemainingSeason(league, 4);
    const awards = computeSeasonAwards(played, { minGames: 1, allStarCount: 24 });
    const g1 = simulateAllStarGame(played, awards, 99);
    const g2 = simulateAllStarGame(played, awards, 99);
    expect(g1?.result.homeScore).toBe(g2?.result.homeScore);
    expect(g1?.result.awayScore).toBe(g2?.result.awayScore);
  });
});
