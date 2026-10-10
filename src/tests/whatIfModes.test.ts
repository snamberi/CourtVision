// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { newWhatIfRun, newPrimeRun, whatIfSquad, primeRoster, primeCard, primeYears, primeTeamsOf, rookieCard, franchiseLegends, legendFranchises, pickCoach, playToEnd, summary, canTrade, oppEdge, isFreeMode, type PerfectRun, type WhatIf } from '../perfect/run';
import { hybridPlayer, hybridOverall, cleanHybridName, type Hybrid } from '../perfect/hybrid';
import { recordPerfect, loadPerfectRecords, mergePerfectRecords, whatIfKey, PERFECT_RECORDS_KEY } from '../perfect/storage';
import { huntTeams } from '../hunt/teams';
import { cardPool, cardPlayer } from '../hunt/cards';
import type { NbaHistory } from '../history/nbaHistoryData';

const play = (h: NbaHistory, r: PerfectRun) => playToEnd(h, playToEnd(h, pickCoach(h, r, r.coachOffer![0]), 'season'), 'playoffs');
const find = (h: NbaHistory, name: string) => primeCard(h, cardPool(h).cards.find(c => c.name === name)!.playerId)!;

describe('82-0 What If and Fun modes', () => {
  beforeEach(() => localStorage.clear());

  it('All in Their Prime: every player at his career best (a tie keeps that year), only that year on the schedule', async () => {
    const h = await loadHistoryForTests();
    const roster = primeRoster(h, 'CHI@1996');
    for (const { then, prime } of roster) {
      expect(prime.ovr).toBe(primeCard(h, then.playerId)!.ovr);
      if (prime.ovr === then.ovr) expect(prime.id).toBe(then.id);
    }
    const run = newPrimeRun(h, 7, 'CHI@1996')!;
    expect(run.mode).toBe('whatif');
    expect(isFreeMode(run.mode)).toBe(true);
    expect(run.stage).toBe('coach');
    expect(canTrade(run)).toBe(false);
    // Normal difficulty: no extra edge for the opponents.
    expect(oppEdge(run, false)).toBe(0);
    const r = pickCoach(h, run, run.coachOffer![0]);
    const year = new Set(huntTeams(h).filter(t => t.end === 1996 && t.id !== 'CHI@1996').map(t => t.id));
    expect(r.schedule).toHaveLength(82);
    expect(r.schedule.every(id => year.has(id))).toBe(true);
    expect(new Set(r.schedule).size).toBe(year.size);
    const done = playToEnd(h, playToEnd(h, r, 'season'), 'playoffs');
    expect(done.stage).toBe('done');
    expect(done.playoffs.every(s => year.has(s.opp))).toBe(true);
  }, 60000);

  it('Time Travel plays the real roster in another season; Rookie Year and Franchise Legends build their squads', async () => {
    const h = await loadHistoryForTests();
    const travel = newWhatIfRun(h, 1, { kind: 'travel', team: 'CHI@1996', year: 2016 })!;
    expect(travel.squad).toEqual(huntTeams(h).find(t => t.id === 'CHI@1996')!.roster);
    const r = pickCoach(h, travel, travel.coachOffer![0]);
    expect(r.schedule.every(id => id.endsWith('@2016'))).toBe(true);

    const rookies = whatIfSquad(h, { kind: 'rookies', team: 'CHI@1996', year: 1996 })!;
    for (const id of rookies) expect(rookieCard(h, cardPool(h).byId.get(id)!.playerId)!.id).toBe(id);

    const bulls = cardPool(h).byId.get(huntTeams(h).find(t => t.id === 'CHI@1996')!.roster[0])!.franchise;
    const lakers = legendFranchises(h).find(f => f.id === bulls)!;
    const legends = franchiseLegends(h, lakers.id);
    expect(legends).toHaveLength(10);
    expect(new Set(legends.map(c => c.playerId)).size).toBe(10);
    expect(legends.every(c => c.franchise === lakers.id)).toBe(true);
    // All of history: the usual schedule.
    const all = pickCoach(h, newWhatIfRun(h, 2, { kind: 'legends', franchise: lakers.id, year: null })!, 'x');
    expect(all.stage).toBe('coach'); // an unknown coach changes nothing
  });

  it('Add a Star puts him first and keeps one of each player', async () => {
    const h = await loadHistoryForTests();
    const jordan = find(h, 'Michael Jordan');
    const squad = whatIfSquad(h, { kind: 'star', team: 'GSW@2016', year: 2016, star: jordan.id })!;
    expect(squad[0]).toBe(jordan.id);
    expect(squad.length).toBeLessThanOrEqual(10);
    // Joining his own team doesn't double him.
    const own = whatIfSquad(h, { kind: 'star', team: 'CHI@1996', year: 1996, star: jordan.id })!;
    expect(own.filter(id => cardPool(h).byId.get(id)!.playerId === jordan.playerId)).toHaveLength(1);
  });

  it("Create-a-Player takes each skill from its donor", async () => {
    const h = await loadHistoryForTests();
    const curry = find(h, 'Stephen Curry'), lebron = find(h, 'LeBron James'), rodman = find(h, 'Dennis Rodman');
    const hy: Hybrid = { name: 'Steph-Bron', base: lebron.id, parts: { shooting: curry.id, rebounding: rodman.id } };
    const p = hybridPlayer(h, hy, 'P820');
    const c = cardPlayer(h, curry, 'P820'), l = cardPlayer(h, lebron, 'P820'), d = cardPlayer(h, rodman, 'P820');
    expect(p.playerId).toBe('Steph-Bron');
    expect(p.attributes.offense.threePoint).toBe(c.attributes.offense.threePoint);
    expect(p.tendencies.shot).toEqual(c.tendencies.shot);
    expect(p.attributes.offense.drivingDunk).toBe(l.attributes.offense.drivingDunk);
    expect(p.attributes.defense.defensiveRebounding).toBe(d.attributes.defense.defensiveRebounding);
    expect(p.attributes.physical.heightInches).toBe(l.attributes.physical.heightInches);
    expect(hybridOverall(h, hy)).toBeGreaterThan(0);
    expect(cleanHybridName('  <b>Big   Steph</b>!!  ')).toBe('bBig Stephb');
    const run = newWhatIfRun(h, 5, { kind: 'create', team: 'NYK@2010', year: 2010, hybrid: hy })!;
    expect(run.mode).toBe('fun');
    expect(run.squad[0]).toBe(lebron.id);
    const done = play(h, run);
    // The box score carries his name.
    expect(Object.keys(done.lines ?? {})).toContain('Steph-Bron');
  }, 60000);

  it('Superteam needs eight, Chaos Spin is seeded', async () => {
    const h = await loadHistoryForTests();
    const top = [...new Map(cardPool(h).byRarity.legendary.map(c => [c.playerId, c.id])).values()].slice(0, 12);
    expect(newWhatIfRun(h, 1, { kind: 'super', year: null, picks: top.slice(0, 5) })).toBeNull();
    const sup = newWhatIfRun(h, 1, { kind: 'super', year: null, picks: top })!;
    expect(sup.squad.length).toBeGreaterThanOrEqual(8);
    const a = newWhatIfRun(h, 77, { kind: 'chaos', year: null })!, b = newWhatIfRun(h, 77, { kind: 'chaos', year: null })!;
    expect(a.squad).toEqual(b.squad);
    expect(a.whatIf!.year).not.toBeNull();
    expect(primeYears(h)).toContain(a.whatIf!.year);
  });

  it("doesn't count for records or leaderboards, only its own book", async () => {
    const h = await loadHistoryForTests();
    const w: WhatIf = { kind: 'prime', team: 'BOS@1986', year: 1986 };
    const done = play(h, newWhatIfRun(h, 9, w)!);
    const rec = recordPerfect(done);
    expect(rec.runs).toBe(0);
    expect(rec.titles).toBe(0);
    expect(rec.perfectSeasons).toBe(0);
    expect(rec.best).toBeUndefined();
    expect(rec.bestWins).toBe(0);
    expect(rec.whatIf?.[whatIfKey(w)!]).toEqual({ w: summary(done).w, l: summary(done).l, champion: summary(done).champion });
    expect(loadPerfectRecords().runs).toBe(0);
    expect(localStorage.getItem(PERFECT_RECORDS_KEY)).toContain('whatIf');
    expect(whatIfKey({ kind: 'chaos', year: 1990 })).toBeNull();
    const m = mergePerfectRecords({ ...rec, whatIf: { x: { w: 60, l: 22, champion: false } } }, { runs: 0, titles: 0, perfectSeasons: 0, perfect98: 0, bestWins: 0, whatIf: { x: { w: 55, l: 27, champion: true } } });
    expect(m.whatIf?.x).toEqual({ w: 55, l: 27, champion: true });
    expect(primeTeamsOf(h, 1996)[0].id).toBe('CHI@1996');
  }, 60000);
});
