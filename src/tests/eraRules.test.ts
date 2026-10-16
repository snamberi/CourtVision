import { describe, it, expect, beforeAll } from 'vitest';
import { simulateGame } from '../simulation/engine/game';
import { buildDemoTeam, makeGenericStarter } from '../simulation/presets/samplePlayers';
import { DEFAULT_GAME_SETTINGS, type GameSettings } from '../simulation/types';
import { realEraRules, seasonEraSettings, applyEraRules, eraSummary } from '../simulation/eraRules';
import { computeRuleMods } from '../simulation/engine/ruleMods';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { realSeasonShape } from '../history/historicalLeague';

const team = (id: string) => { const t = buildDemoTeam(id, id); return { ...t, seasons: [...t.seasons, ...[1, 2, 3].map(i => makeGenericStarter(`${id}-b${i}`, id))] }; };
const threes = (settings: GameSettings, seeds = 6) => {
  let tpa = 0;
  for (let seed = 0; seed < seeds; seed++) {
    const r = simulateGame({ home: team('H'), away: team('A'), settings: { ...settings, seed } });
    for (const box of [r.homeBox, r.awayBox]) for (const p of Object.values(box.players)) tpa += p.tpa;
  }
  return tpa;
};

describe('era rules', () => {
  it('maps each season to its real rules', () => {
    const base = DEFAULT_GAME_SETTINGS.era;
    expect(realEraRules(1975, base).threePointLineDistance).toBe(0);
    expect(realEraRules(1979, base).threePointLineDistance).toBe(23.75);
    expect(realEraRules(1995, base).threePointLineDistance).toBe(22);
    expect(realEraRules(1950, base).shotClockSeconds).toBe(0);
    expect(realEraRules(2003, base).handChecking).toBe(true);
    expect(realEraRules(2004, base).handChecking).toBe(false);
    expect(realEraRules(2000, base).zoneDefenseAllowed).toBe(false);
    expect(realEraRules(2001, base).zoneDefenseAllowed).toBe(true);
    expect(eraSummary(realEraRules(1975, base))).toContain('no 3-point line');
  });
  it('leaves a modern game untouched', () => {
    const mods = computeRuleMods(undefined);
    expect(applyEraRules(mods, DEFAULT_GAME_SETTINGS)).toBe(mods);
  });
  it('no 3-point line means no threes; era volume cuts attempts', () => {
    const y1975 = seasonEraSettings({ ...DEFAULT_GAME_SETTINGS, yearAccurate: true }, 1975, undefined, 2025);
    const y1985 = seasonEraSettings({ ...DEFAULT_GAME_SETTINGS, yearAccurate: true }, 1985, { 1985: 0.1 }, 2025);
    expect(threes(y1975)).toBe(0);
    const modern = threes(DEFAULT_GAME_SETTINGS);
    expect(threes(y1985)).toBeLessThan(modern * 0.4);
  });
  it('turning era rules off, or passing the data, plays today\'s rules', () => {
    const on = seasonEraSettings({ ...DEFAULT_GAME_SETTINGS, yearAccurate: true }, 1975, undefined, 2025);
    const off = seasonEraSettings({ ...on, eraRules: false }, 1975, undefined, 2025);
    expect(off.era.threePointLineDistance).toBe(23.75);
    expect(off.eraYear).toBeUndefined();
    const future = seasonEraSettings(on, 2030, undefined, 2025);
    expect(future.eraYear).toBeUndefined();
  });
});

describe('real three-point volume from the data', () => {
  let threesByYear: Record<string, number>;
  beforeAll(async () => { threesByYear = realSeasonShape(await loadHistoryForTests()).threes; }, 120_000);
  it('is zero before the line and climbs toward today', () => {
    expect(threesByYear['1975']).toBe(0);
    expect(threesByYear['1985']).toBeGreaterThan(0);
    expect(threesByYear['1985']).toBeLessThan(0.2);
    expect(threesByYear['2010']).toBeGreaterThan(threesByYear['1985']);
    expect(threesByYear['2010']).toBeLessThan(threesByYear['2022']);
  });
});
