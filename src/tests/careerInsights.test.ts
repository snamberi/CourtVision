import { describe, expect, it } from 'vitest';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { superstarTraits, seasonGoals, gradeGoals, goalRecord, careerHighs, allTimeRanks } from '../career/insights';
import { emptySeasonStatTotals, emptySeasonMilestones, type Attributes } from '../simulation/types';
import type { CareerYear } from '../career/career';

const year = (season: string, g: number, pts: number, reb: number, ast: number, awards: string[] = [], high = 0): CareerYear => ({
  season, age: 22, teamId: 't', teamName: 'Team', overall: 80, awards: awards.map(k => ({ key: k as CareerYear['awards'][number]['key'], label: k })), training: [],
  stats: { ...emptySeasonStatTotals(), gamesPlayed: g, points: pts * g, dreb: reb * g, ast: ast * g },
  highs: { ...emptySeasonMilestones(), gameHighPoints: high, tripleDoubles: 1 },
});

describe('Career insights', () => {
  it('superstar traits unlock past 99 (and 7\'0") and describe what they do', () => {
    const v = (n: number) => new Proxy({}, { get: (_t, k) => (k === 'heightInches' ? 92 : n) });
    const maxed = { physical: v(110), offense: v(110), defense: v(110), mental: v(110) } as unknown as Attributes;
    const plain = { physical: new Proxy({}, { get: (_t, k) => (k === 'heightInches' ? 78 : 80) }), offense: v(80), defense: v(80), mental: v(80) } as unknown as Attributes;
    expect(superstarTraits(maxed).every(t => t.active && t.progress === 1)).toBe(true);
    expect(superstarTraits(maxed).find(t => t.id === 'iron')!.effect).toMatch(/whole game/);
    expect(superstarTraits(plain).some(t => t.active)).toBe(false);
  });

  it('season goals come from last season and are graded against the next', () => {
    expect(seasonGoals(undefined).map(g => g.id)).toEqual(['pts:10', 'gp:60', 'award:rookie']);
    const last = year('2026', 70, 21.4, 5, 8, ['allStar']);
    const goals = seasonGoals(last);
    expect(goals.map(g => g.id)).toEqual(['pts:23', 'ast:9', 'award:allnba']);
    const next = year('2027', 72, 24, 5, 8.5, ['allLeague2']);
    const graded = gradeGoals(goals, next);
    expect(graded.map(r => r.hit)).toEqual([true, false, true]);
    expect(goalRecord([last, next]).total).toBe(6);
  });

  it('career highs take the best game and sum the triple-doubles', () => {
    const h = careerHighs([year('2026', 70, 20, 5, 5, [], 41), year('2027', 70, 20, 5, 5, [], 38)]);
    expect(h.points).toBe(41);
    expect(h.tripleDoubles).toBe(2);
  });

  it('all-time ranks put a 40,000-point career near the top and name the next legend', async () => {
    const h = await loadHistoryForTests();
    const years = Array.from({ length: 20 }, (_, i) => year(String(2026 + i), 80, 25, 8, 6));
    const [pts] = allTimeRanks(h, years);
    expect(pts.total).toBe(40000);
    expect(pts.rank).toBeLessThanOrEqual(3);
    const rookie = allTimeRanks(h, [year('2026', 10, 2, 1, 1)])[0];
    expect(rookie.next?.total).toBeGreaterThan(rookie.total);
  });
});
