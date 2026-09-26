import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRounds } from '../simulation/league';
import { initializeCoaching } from '../simulation/staffManagement';
import { hotSeats, midseasonCarousel, offseasonCarousel, ensureHeadCoaches, carouselNews } from '../simulation/coachingCarousel';
import { generateNewsFeed } from '../simulation/news';
import type { League } from '../simulation/league';

const { league: g, extras } = generateFullLeague(33, 30, 13, 40, '2026');
const me = g.teams[0].teamId;
const league = initializeCoaching(g, me);

/** Every AI team's record forced: the best rosters lose, the worst win (so seats get hot). */
function withRecords(l: League, lastSeason: string): League {
  const teamSeasons = l.teams.map((t, i) => ({ teamId: t.teamId, teamName: t.name, wins: i % 2 ? 8 : 70, losses: i % 2 ? 74 : 12, ppg: 0, oppPpg: 0, ortg: 0, drtg: 0, pace: 0,
    tpmPg: 0, apg: 0, rpg: 0, spg: 0, bpg: 0, playoffFinish: 'Missed Playoffs' as const, playoffWins: 0, playoffLosses: 0, roster: [] }));
  return { ...l, season: '2027', franchiseHistory: [{ season: lastSeason, teamSeasons } as never] };
}

describe('coaching carousel', () => {
  it('rates hot seats from record against the roster, never your own coach', () => {
    const l = withRecords(league, '2026');
    const seats = hotSeats(l, me, l.franchiseHistory![0].teamSeasons, '2026');
    expect(seats.some(s => s.teamId === me)).toBe(false);
    const losers = seats.filter(s => l.teams.findIndex(t => t.teamId === s.teamId) % 2 === 1);
    const winners = seats.filter(s => l.teams.findIndex(t => t.teamId === s.teamId) % 2 === 0);
    expect(Math.min(...losers.map(s => s.heat))).toBeGreaterThan(Math.max(...winners.map(s => s.heat)));
  });

  it('offseason: AI owners fire coaches on the hot seat and every AI bench is filled', () => {
    const l = withRecords(league, '2026');
    const next = offseasonCarousel(l, '2026', me, new Map(l.teams.map(t => [t.teamId, t.coachIdentity?.coachId])));
    const events = next.coachingCarousel!.events;
    const fired = events.filter(e => e.kind === 'fired');
    expect(fired.length).toBeGreaterThan(3);
    expect(fired.every(e => l.teams.findIndex(t => t.teamId === e.teamId) % 2 === 1)).toBe(true); // only the teams that lost
    for (const e of fired) expect(next.teams.find(t => t.teamId === e.teamId)!.coachIdentity?.coachId).not.toBe(e.coachId);
    expect(next.teams.filter(t => t.teamId !== me).every(t => t.coachIdentity)).toBe(true);
    expect(events.some(e => e.kind === 'hired')).toBe(true);
    expect(generateNewsFeed(next, extras, 1000).some(n => /fire head coach/.test(n.headline))).toBe(true);
    expect(carouselNews(next).length).toBe(events.length);
    // A coach just hired gets a season of grace.
    const hire = events.find(e => e.kind === 'hired')!;
    const again = offseasonCarousel({ ...withRecords(next, '2027'), coachingCarousel: next.coachingCarousel }, '2027', me);
    expect(again.coachingCarousel!.events.some(e => e.season !== next.coachingCarousel!.events[0].season && e.kind === 'fired' && e.coachId === hire.coachId)).toBe(false);
  });

  it('mid-season: a far-below-expectations start can cost a coach his job, with an interim named', () => {
    let l = simulateRounds({ ...league, rulesSettings: { ...league.rulesSettings!, allStarEnabled: false } }, 28, 3);
    // Make the strongest roster lose every game so far.
    const best = [...l.teams].filter(t => t.teamId !== me).sort((a, b) => b.seasons.length - a.seasons.length)[0];
    l = { ...l, schedule: l.schedule.map(g => g.played && g.result && (g.homeTeamId === best.teamId || g.awayTeamId === best.teamId)
      ? { ...g, result: { ...g.result, homeScore: g.homeTeamId === best.teamId ? 80 : 120, awayScore: g.homeTeamId === best.teamId ? 120 : 80 } } : g) };
    let out = l;
    for (let seed = 1; seed < 40 && out === l; seed++) out = midseasonCarousel(l, me, seed);
    const events = out.coachingCarousel?.events ?? [];
    expect(events.some(e => e.kind === 'fired' && e.midseason)).toBe(true);
    const firedTeam = events.find(e => e.kind === 'fired')!.teamId;
    expect(out.teams.find(t => t.teamId === firedTeam)!.coachIdentity).toBeTruthy();
  });

  it('never leaves an AI bench empty', () => {
    const empty = { ...league, teams: league.teams.map((t, i) => i === 3 ? { ...t, coachIdentity: undefined } : t) };
    const out = ensureHeadCoaches(empty, me, '2026');
    expect(out.teams[3].coachIdentity).toBeTruthy();
  });
});
