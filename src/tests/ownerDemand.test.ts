import { describe, expect, it } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { ensureFrontOffice } from '../simulation/frontOffice';
import { tickOwnerDemand, teamResults, demandProgress } from '../simulation/ownerDemand';
import type { League } from '../simulation/league';

const { league: base } = generateFullLeague(12, 30, 13, 60, '2026');
const me = base.teams[0].teamId;

/** Plays this team's next `n` games with the given outcomes (other teams' games stay unplayed). */
function play(l: League, outcomes: boolean[]): League {
  let i = 0;
  const schedule = l.schedule.map(g => {
    if (g.played || i >= outcomes.length || (g.homeTeamId !== me && g.awayTeamId !== me)) return g;
    const won = outcomes[i++], home = g.homeTeamId === me;
    return { ...g, played: true, result: { ...(g.result ?? {}), homeScore: home === won ? 110 : 100, awayScore: home === won ? 100 : 110 } } as typeof g;
  });
  return { ...l, schedule };
}

describe("Owner's demand", () => {
  it('is issued when you are losing, then met or failed after ten games', () => {
    let l = ensureFrontOffice(base, me);
    // 6-14: a losing record a third of the way in.
    l = play(l, [...Array(6).fill(true), ...Array(14).fill(false)]);
    expect(teamResults(l, me).length).toBe(20);
    const issued = tickOwnerDemand(l);
    expect(issued.league.frontOffice?.demand?.status).toBe('active');
    expect(issued.news?.text).toMatch(/win 6 of your next 10/);
    // No change when nothing happened.
    expect(tickOwnerDemand(issued.league).league).toBe(issued.league);
    const before = issued.league.frontOffice!.security;
    const met = tickOwnerDemand(play(issued.league, [true, true, true, true, true, true]));
    expect(met.league.frontOffice?.demand?.status).toBe('met');
    expect(met.league.frontOffice!.security).toBeGreaterThan(before);
    const failed = tickOwnerDemand(play(issued.league, [false, false, false, false, false]));
    expect(failed.league.frontOffice?.demand?.status).toBe('failed');
    expect(failed.league.frontOffice!.security).toBeLessThan(before);
    expect(demandProgress(failed.league, failed.league.frontOffice!.demand!, me).played).toBe(5);
  });

  it('a winning team gets no demand', () => {
    let l = ensureFrontOffice(base, me);
    l = play(l, [...Array(15).fill(true), false, true, false, true, false]);
    expect(tickOwnerDemand(l).league).toBe(l);
  });
});
