import { describe, expect, it } from 'vitest';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { newPrimeRun, primeRoster, primeCard, primeYears, primeTeamsOf, pickCoach, playToEnd, summary, canTrade, oppEdge, OPP_EDGE } from '../perfect/run';
import { mergePerfectRecords } from '../perfect/storage';
import { huntTeams } from '../hunt/teams';
import { cardPool } from '../hunt/cards';

describe('82-0: All in Their Prime', () => {
  it("puts every player at his career-best season", async () => {
    const h = await loadHistoryForTests();
    const roster = primeRoster(h, 'CHI@1996');
    expect(roster.length).toBeGreaterThanOrEqual(8);
    const cards = cardPool(h).cards;
    for (const { then, prime } of roster) {
      expect(prime.playerId).toBe(then.playerId);
      expect(prime.ovr).toBe(Math.max(...cards.filter(c => c.playerId === then.playerId).map(c => c.ovr)));
      expect(prime.ovr).toBe(primeCard(h, then.playerId)!.ovr);
      // A season that ties his best stays the season he really played for this team.
      if (prime.ovr === then.ovr) expect(prime.id).toBe(then.id);
    }
    // Best prime first.
    expect(roster.map(r => r.prime.ovr)).toEqual([...roster.map(r => r.prime.ovr)].sort((a, b) => b - a));
  });

  it('starts at the coach pick with the prime squad, and plays only that year', async () => {
    const h = await loadHistoryForTests();
    const run = newPrimeRun(h, 7, 'CHI@1996')!;
    expect(run.mode).toBe('prime');
    expect(run.stage).toBe('coach');
    expect(run.squad).toEqual(primeRoster(h, 'CHI@1996').map(r => r.prime.id));
    expect(run.coachOffer).toHaveLength(3);
    expect(canTrade(run)).toBe(false);
    expect(oppEdge(run, false)).toBe(OPP_EDGE.prime);
    let r = pickCoach(h, run, run.coachOffer![0]);
    expect(r.schedule).toHaveLength(82);
    const year = new Set(huntTeams(h).filter(t => t.end === 1996 && t.id !== 'CHI@1996').map(t => t.id));
    expect(r.schedule.every(id => year.has(id))).toBe(true);
    // Everyone that year comes round, and the bosses are the year's best.
    expect(new Set(r.schedule).size).toBe(year.size);
    const best = huntTeams(h).filter(t => year.has(t.id)).sort((a, b) => b.strength - a.strength).slice(0, 2).map(t => t.id);
    expect(r.bosses.every(i => best.includes(r.schedule[i]))).toBe(true);
    r = playToEnd(h, playToEnd(h, r, 'season'), 'playoffs');
    expect(r.stage).toBe('done');
    expect(r.playoffs.every(s => year.has(s.opp))).toBe(true);
    expect(new Set(r.playoffs.map(s => s.opp)).size).toBe(r.playoffs.length);
    // Seeded: the same run plays out the same way.
    const again = playToEnd(h, playToEnd(h, pickCoach(h, newPrimeRun(h, 7, 'CHI@1996')!, run.coachOffer![0]), 'season'), 'playoffs');
    expect(summary(again)).toEqual(summary(r));
  }, 60000);

  it("meets that year's real champion in the Finals", async () => {
    const h = await loadHistoryForTests();
    // 1996: the Bulls won it, so the prime Sonics should face them if they get there.
    const run = newPrimeRun(h, 3, 'SEA@1996')!;
    let r = pickCoach(h, run, run.coachOffer![0]);
    r = playToEnd(h, playToEnd(h, r, 'season'), 'playoffs');
    if (r.playoffs.length === 4) expect(r.playoffs[3].opp).toBe('CHI@1996');
  }, 60000);

  it('lists years and teams, and refuses an unknown team', async () => {
    const h = await loadHistoryForTests();
    const years = primeYears(h);
    expect(years[0]).toBeGreaterThan(years.at(-1)!);
    const t = primeTeamsOf(h, 1996);
    expect(t[0].id).toBe('CHI@1996');
    expect(newPrimeRun(h, 1, 'NOPE@1900')).toBeNull();
  });

  it('keeps the best season with each team across devices', () => {
    const a = mergePerfectRecords({ runs: 1, titles: 0, perfectSeasons: 0, perfect98: 0, bestWins: 60, prime: { 'CHI@1996': { w: 60, l: 22, champion: false } } },
      { runs: 2, titles: 1, perfectSeasons: 0, perfect98: 0, bestWins: 70, prime: { 'CHI@1996': { w: 55, l: 27, champion: true }, 'GSW@2016': { w: 70, l: 12, champion: false } } });
    expect(a.prime?.['CHI@1996']).toEqual({ w: 55, l: 27, champion: true });
    expect(a.prime?.['GSW@2016']?.w).toBe(70);
  });
});
