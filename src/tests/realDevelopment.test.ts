import { describe, it, expect, beforeAll } from 'vitest';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import type { NbaHistory } from '../history/nbaHistoryData';
import { buildHistoricalLeague, topUpHistoricalClasses } from '../history/historicalLeague';
import { realTargetFor, applyRealDevelopment, realDevelopmentStatus } from '../history/realDevelopment';
import { prepareCoachingForGame, offseasonTrainingCamp, setPlayerProject } from '../simulation/playerDevelopment';
import { initializeCoaching } from '../simulation/staffManagement';
import { beginNewSeasonRoster, rollFreeAgentsForward } from '../simulation/seasonTransition';
import { calculateOverall } from '../simulation/engine/overall';
import { parseUniverseFile, buildSnapshot } from '../storage/universeIO';
import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import type { PlayerSeason } from '../simulation/types';

let h: NbaHistory;
beforeAll(async () => { h = await loadHistoryForTests(); }, 120_000);
const build = (realDevelopment: boolean, year = 2016) => buildHistoricalLeague(h, year, { realDevelopment, difficulty: 'normal', seed: 11 });
const all = (league: League, extras: GMLeagueExtras) => [...league.teams.flatMap(t => t.seasons), ...extras.freeAgents];
const byName = (league: League, extras: GMLeagueExtras, name: string) => all(league, extras).find(p => p.playerId === name)!;
const attrs = (p: PlayerSeason) => JSON.stringify(p.attributes);

describe('Real Player Development', () => {
  it('a full practice cycle and offseason camp leave real players unchanged when on, and develop them when off', () => {
    for (const on of [true, false]) {
      const { league: raw } = build(on);
      let league = initializeCoaching(raw);
      const gsw = league.teams.find(t => t.teamId === 'GSW')!;
      const before = new Map(gsw.seasons.map(p => [p.playerId, attrs(p)]));
      const young = gsw.seasons.slice().sort((a, b) => a.age - b.age)[0];
      league = setPlayerProject(league, young.playerId, 'corner-three', 'GSW');
      league = prepareCoachingForGame(league, ['GSW'], '2016-10-20');
      league = prepareCoachingForGame(league, ['GSW'], '2017-01-20'); // ~3 months of practice
      league = offseasonTrainingCamp(league);
      const after = league.teams.find(t => t.teamId === 'GSW')!.seasons;
      const unchanged = after.filter(p => before.get(p.playerId) === attrs(p)).length;
      if (on) {
        expect(unchanged).toBe(after.length);
        // Practice still did its non-rating work.
        expect(after.every(p => (p.training?.practiceDays ?? 0) > 0)).toBe(true);
        expect(after.some(p => Object.keys(p.training?.familiarity ?? {}).length > 0)).toBe(true);
      } else {
        expect(unchanged).toBeLessThan(after.length);
      }
    }
  }, 120_000);

  it('rollover moves real players to their reference rating once, without touching history', () => {
    const { league, extras } = build(true);
    const curry = byName(league, extras, 'Stephen Curry');
    const historyBefore = JSON.stringify(curry.careerHistory);
    const target = realTargetFor(curry.real, 2017)!;
    expect(target.kind).toBe('reference');
    const next = beginNewSeasonRoster(league, extras, 99);
    const c2 = byName(next.league, next.extras, 'Stephen Curry');
    expect(c2.age).toBe(curry.age + 1);
    expect(Math.abs(calculateOverall(c2) - target.ovr)).toBeLessThanOrEqual(1);
    expect(c2.real!.appliedSeason).toBe('2017');
    expect(c2.real!.rating.startYear).toBe(2017);
    // Imported seasons are untouched; the (unplayed) 2016 season was archived after them.
    expect(JSON.stringify(c2.careerHistory!.slice(0, curry.careerHistory!.length))).toBe(historyBefore);
    expect(c2.careerHistory!.at(-1)!.season).toBe('2016');
    // Applying the same season again is a no-op (loading a save never re-applies development).
    expect(applyRealDevelopment(c2, '2017')).toBe(c2);
    const again = rollFreeAgentsForward(next.league, next.extras.freeAgents, '2016', '2017', 5);
    expect(again.freeAgents.map(p => `${p.playerId}:${p.age}`)).toEqual(next.extras.freeAgents.map(p => `${p.playerId}:${p.age}`));
    // History records the real step.
    expect(c2.training?.history.at(-1)?.text).toMatch(/Real Player Development/);
  }, 120_000);

  it('with the toggle off, rollover uses Court Vision development and turning it back on resumes next rollover', () => {
    const { league, extras } = build(false);
    const curry = byName(league, extras, 'Stephen Curry');
    const next = beginNewSeasonRoster(league, extras, 99);
    const c2 = byName(next.league, next.extras, 'Stephen Curry');
    expect(c2.age).toBe(curry.age + 1);
    expect(c2.real!.appliedSeason).toBe('2016'); // the reference was not applied
    // Switch on mid-save: nothing is reset now; the profile explains when it resumes.
    const onLeague = { ...next.league, historical: { ...next.league.historical!, realDevelopment: true } };
    expect(realDevelopmentStatus(c2, onLeague)).toMatch(/resumes at the next season rollover/);
    const third = beginNewSeasonRoster({ ...onLeague, season: '2017' }, next.extras, 7);
    const c3 = byName(third.league, third.extras, 'Stephen Curry');
    expect(c3.real!.appliedSeason).toBe('2018');
    expect(Math.abs(calculateOverall(c3) - realTargetFor(c3.real, 2018)!.ovr)).toBeLessThanOrEqual(1);
  }, 120_000);

  it('uses the real draft class and brings in late debuts at rollover', () => {
    const { league, extras } = build(true);
    const next = beginNewSeasonRoster(league, extras, 99);
    const names = next.extras.draftClass.map(p => p.playerId);
    expect(names).toContain('Jayson Tatum');
    expect(names).toContain('Donovan Mitchell');
    expect(next.extras.draftClass.every(p => p.trueSeason.season === '2017' && p.trueSeason.real)).toBe(true);
    expect(next.league.historical!.futureClasses['2017']).toBeUndefined();
    // Bogdan Bogdanovic (2014 pick) debuted in 2017-18: absent at the start, a free agent from the 2017 rollover.
    expect(all(league, extras).some(p => p.playerId === 'Bogdan Bogdanović')).toBe(false);
    expect(next.extras.freeAgents.some(p => p.playerId === 'Bogdan Bogdanović')).toBe(true);
  }, 120_000);

  it('tops up future real classes without duplicating players', () => {
    const { league } = build(true);
    expect(league.historical!.classesLoadedThrough).toBe(2025);
    const early = build(true, 1980);
    const meta = topUpHistoricalClasses(h, early.league, early.extras, 2000)!;
    expect(meta.classesLoadedThrough).toBe(2000);
    const ids = Object.values(meta.futureClasses).flat().map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(topUpHistoricalClasses(h, { ...early.league, historical: meta }, early.extras, 2000)).toBeNull();
  }, 120_000);

  it('interpolates missed seasons and falls back to Court Vision when the trajectory ends', () => {
    const info = { id: 'x', dataset: 'd', rating: { ovr: 70, source: 'stats', startYear: 2016 }, frames: [[2018, 80, 'stats']] as [number, number, string][] };
    expect(realTargetFor(info, 2017)).toMatchObject({ ovr: 75, kind: 'interpolated' });
    expect(realTargetFor(info, 2018)).toMatchObject({ ovr: 80, kind: 'reference' });
    expect(realTargetFor(info, 2019)).toBeNull();
  });

  it('keeps the cutoff, settings, ids and development state through export and reimport', () => {
    const { league, extras } = build(true);
    const text = JSON.stringify(buildSnapshot(league, extras));
    const back = parseUniverseFile(text);
    expect(back.league.historical).toMatchObject({ startYear: 2016, realDevelopment: true, dataset: 'nba-history.v2' });
    const curry = byName(back.league, back.extras, 'Stephen Curry');
    expect(curry.real).toEqual(byName(league, extras, 'Stephen Curry').real);
    expect(back.league.franchiseHistory!.at(-1)!.season).toBe('2015');
    // Unrecorded numbers come back as unavailable (NaN), not zero, after a JSON round trip.
    const early = build(true, 1980);
    const round = parseUniverseFile(JSON.stringify(buildSnapshot(early.league, early.extras)));
    const k = byName(round.league, round.extras, 'Kareem Abdul-Jabbar').careerHistory!.find(c => c.season === '1970')!;
    expect(Number.isNaN(k.advanced!.stlPct)).toBe(true);
  }, 120_000);
});
