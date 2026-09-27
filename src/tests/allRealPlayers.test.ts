import { describe, expect, it } from 'vitest';
import { buildHistoricalLeague, retiredBeforeStart, realIdsInLeague, hydrateRetirees } from '../history/historicalLeague';
import { needsRetireeData, restoreRetirees } from '../history/retirees';
import { buildSnapshot } from '../storage/universeIO';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';

describe('Load every real player', () => {
  it('adds everyone who retired before the start, with real careers and honours', async () => {
    const h = await loadHistoryForTests();
    const t0 = performance.now();
    const { league, extras } = buildHistoricalLeague(h, 2010, { realDevelopment: true, difficulty: 'normal', seed: 1, allPlayers: true });
    const ms = performance.now() - t0;
    const retired = league.retiredPlayers ?? [];
    expect(ms).toBeLessThan(20_000);
    expect(retired.length).toBeGreaterThan(3000);
    expect(retired.every(r => r.preStart)).toBe(true);

    const jordan = retired.find(r => r.playerId === 'Michael Jordan');
    expect(jordan).toBeDefined();
    const career = jordan!.finalSeasonData!.careerHistory!;
    expect(career.length).toBe(15);
    expect(career.reduce((n, c) => n + c.stats.points, 0)).toBe(32292);
    expect(jordan!.finalSeason).toBe('2002');
    expect(jordan!.finalSeasonData!.historicalAwards!.filter(a => a.label === 'MVP')).toHaveLength(5);
    expect(jordan!.finalSeasonData!.historicalAwards!.filter(a => a.label === 'NBA Champion')).toHaveLength(6);

    // Nobody is in the league twice: active players, free agents, classes and retirees are all distinct real players.
    const active = new Set<string>();
    league.teams.forEach(t => t.seasons.forEach(p => active.add(p.real!.id)));
    extras.freeAgents.forEach(p => active.add(p.real!.id));
    expect(retired.filter(r => active.has(r.finalSeasonData!.real!.id))).toHaveLength(0);
    const names = new Set<string>();
    for (const r of retired) { expect(names.has(r.playerId)).toBe(false); names.add(r.playerId); }
    for (const t of league.teams) for (const p of t.seasons) expect(names.has(p.playerId)).toBe(false);
  }, 120_000);

  it('can load them into an existing league without duplicates', async () => {
    const h = await loadHistoryForTests();
    const { league, extras } = buildHistoricalLeague(h, 1995, { realDevelopment: true, difficulty: 'normal', seed: 2 });
    expect(league.retiredPlayers ?? []).toHaveLength(0);
    const added = retiredBeforeStart(h, 1995, realIdsInLeague(league, extras));
    expect(added.length).toBeGreaterThan(2000);
    expect(added.some(r => r.playerId === 'Wilt Chamberlain')).toBe(true);
    expect(added.some(r => r.playerId === 'Michael Jordan')).toBe(false); // still active in 1995
    const again = retiredBeforeStart(h, 1995, realIdsInLeague({ ...league, retiredPlayers: added }, extras));
    expect(again).toHaveLength(0);
  }, 120_000);

  it('saves them as references and rebuilds them on load', async () => {
    const h = await loadHistoryForTests();
    const { league, extras } = buildHistoricalLeague(h, 2005, { realDevelopment: true, difficulty: 'normal', seed: 3, allPlayers: true });
    const full = JSON.stringify(league.retiredPlayers).length;
    const snap = buildSnapshot(league, extras);
    const saved = JSON.stringify(snap.league.retiredPlayers).length;
    expect(saved).toBeLessThan(full / 10);
    expect(needsRetireeData(snap.league)).toBe(true);
    expect(needsRetireeData(league)).toBe(false); // the live league keeps its data

    const loaded = hydrateRetirees(h, JSON.parse(JSON.stringify(snap.league)));
    expect(needsRetireeData(loaded)).toBe(false);
    const bird = (l: typeof league) => l.retiredPlayers!.find(r => r.playerId === 'Larry Bird')!.finalSeasonData!;
    expect(bird(loaded).careerHistory!.reduce((n, c) => n + c.stats.points, 0)).toBe(bird(league).careerHistory!.reduce((n, c) => n + c.stats.points, 0));
    expect(bird(loaded).attributes).toEqual(bird(league).attributes);

    // A worker gets the slim league; the data comes back from the league that was sent.
    const back = restoreRetirees(snap.league, league);
    expect(needsRetireeData(back)).toBe(false);

    // Edited in Sandbox: kept in the save.
    const edited = { ...league, retiredPlayers: league.retiredPlayers!.map(r => r.playerId === 'Larry Bird' ? { ...r, keepData: true } : r) };
    expect(buildSnapshot(edited, extras).league.retiredPlayers!.find(r => r.playerId === 'Larry Bird')!.finalSeasonData).toBeDefined();
  }, 120_000);
});
