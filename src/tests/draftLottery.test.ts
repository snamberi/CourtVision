import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRemainingSeason, type League } from '../simulation/league';
import { draftOrderWithLottery, draftOrderFromStandings } from '../simulation/gm';
import { beginNewSeasonRoster } from '../simulation/seasonTransition';

function fakeGame(homeTeamId: string, awayTeamId: string, homeScore: number, awayScore: number) {
  return { id: `${homeTeamId}-${awayTeamId}`, round: 0, homeTeamId, awayTeamId, played: true, result: { homeTeamId, awayTeamId, homeScore, awayScore } as never };
}

describe('draftOrderWithLottery', () => {
  it('includes every team exactly once', () => {
    const { league } = generateFullLeague(1, 8, 8, 10, '2026-27');
    const order = draftOrderWithLottery(league, 1);
    expect(order.length).toBe(league.teams.length);
    expect(new Set(order).size).toBe(league.teams.length);
  });

  it('picks 5+ still follow reverse-standings order among non-lottery teams', () => {
    const { league } = generateFullLeague(2, 20, 6, 8, '2026-27');
    const standingsOrder = draftOrderFromStandings(league);
    const lotteryOrder = draftOrderWithLottery(league, 2);
    // Teams outside the top-14-worst lottery pool should appear in the same relative order in both.
    const nonLotteryStandings = standingsOrder.slice(14);
    const nonLotteryLottery = lotteryOrder.slice(14);
    expect(nonLotteryLottery).toEqual(nonLotteryStandings);
  });

  it('is deterministic given the same seed', () => {
    const { league } = generateFullLeague(3, 16, 6, 8, '2026-27');
    const a = draftOrderWithLottery(league, 42);
    const b = draftOrderWithLottery(league, 42);
    expect(a).toEqual(b);
  });

  it('the worst team gets the top pick more often than a mid-lottery team across many lottery draws', () => {
    const { league } = generateFullLeague(4, 16, 6, 8, '2026-27');
    // Force a clean 16-team standings spread so ranks are unambiguous: ranked[i] beats everyone ranked after it.
    const ranked = league.teams.map((t) => t.teamId);
    const schedule = [];
    for (let i = 0; i < ranked.length; i++) {
      for (const loser of ranked.slice(i + 1)) schedule.push(fakeGame(ranked[i], loser, 110, 90));
    }
    const spread: League = { ...league, schedule };
    const worstTeam = ranked[ranked.length - 1];
    const midLotteryTeam = ranked[ranked.length - 8];
    let worstTop1 = 0;
    let midTop1 = 0;
    const trials = 200;
    for (let seed = 0; seed < trials; seed++) {
      const order = draftOrderWithLottery(spread, seed);
      if (order[0] === worstTeam) worstTop1++;
      if (order[0] === midLotteryTeam) midTop1++;
    }
    expect(worstTop1).toBeGreaterThan(midTop1);
  });
});

describe('beginNewSeasonRoster sets a lottery-based draftOrder', () => {
  it('stores a two-round draftOrder (round 1 lottery + round 2 standings), covering every team twice', () => {
    const { league, extras } = generateFullLeague(5, 8, 8, 10, '2026-27');
    const played = simulateRemainingSeason(league, 5);
    const { extras: nextExtras } = beginNewSeasonRoster(played, extras, 5, { minGames: 1 });
    expect(nextExtras.draftOrder?.length).toBe(league.teams.length * 2);
  });
});
