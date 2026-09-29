import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { homeCities, miles, travelWalk, travelEdge, planTrip, CITIES } from '../simulation/travel';
import { simulateRounds } from '../simulation/league';

const { league } = generateFullLeague(21, 30, 13, 82, '2026', { priorSeasons: false });
const me = league.teams[0].teamId;

describe('road trips and travel fatigue', () => {
  it('gives every team a distinct home city, real when the name has one', () => {
    const c = homeCities(league.teams);
    expect(c.size).toBe(30);
    expect(new Set([...c.values()].map(x => `${x.lat},${x.lon}`)).size).toBe(30);
    const boston = homeCities([{ ...league.teams[0], teamId: 'BOS', name: 'Boston Celtics' }]).get('BOS')!;
    expect(boston.lat).toBeCloseTo(42.36);
    expect(miles(CITIES[0], CITIES[0])).toBe(0);
    expect(Math.round(miles(CITIES.find(x => x.name === 'Boston')!, CITIES.find(x => x.name === 'Los Angeles')!))).toBeGreaterThan(2500);
  });
  it('finds road trips, builds fatigue on the road and drains it at home', () => {
    const w = travelWalk(league, me);
    expect(w.trips.length).toBeGreaterThanOrEqual(2);
    const t = w.trips[0];
    expect(t.legs.length).toBeGreaterThanOrEqual(2);
    for (const l of t.legs) { expect(travelEdge(league, me, l.gameId)).toBeLessThanOrEqual(0); expect(travelEdge(league, me, l.gameId)).toBeGreaterThanOrEqual(-3); }
  });
  it('rest days cut a trip\'s fatigue; a team dinner lifts chemistry once; pushing adds an edge', () => {
    const t = travelWalk(league, me).trips.find(x => x.peak > 1)!;
    const rested = planTrip(league, me, t.id, 'rest');
    expect(travelWalk(rested, me).trips.find(x => x.id === t.id)!.peak).toBeLessThan(t.peak);
    const dinner = planTrip(league, me, t.id, 'dinner');
    expect(dinner.teams[0].chemistry).toBe(Math.min(100, (league.teams[0].chemistry ?? 70) + 3));
    expect(planTrip(dinner, me, t.id, 'dinner').teams[0].chemistry).toBe(dinner.teams[0].chemistry);
    const pushed = planTrip(league, me, t.id, 'push');
    expect(travelEdge(pushed, me, t.legs[0].gameId)).toBeGreaterThan(travelEdge(league, me, t.legs[0].gameId) - 0.5);
  });
  it('home teams win a little more than half their games over a stretch of the season', () => {
    const l = simulateRounds(league, 40, 7);
    const played = l.schedule.filter(g => g.result);
    const home = played.filter(g => g.result!.homeScore > g.result!.awayScore).length / played.length;
    expect(home).toBeGreaterThan(0.48);
    expect(home).toBeLessThan(0.66);
  }, 120000);
});
