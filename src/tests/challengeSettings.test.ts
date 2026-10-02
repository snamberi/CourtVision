// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { challengeMultiplier, challengePrefs, saveChallengePrefs, STANDARD_VIEW } from '../retention/challenge';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { newPerfectRun, oppEdge, summary, LEVEL_EDGE } from '../perfect/run';
import { newRun } from '../hunt/run';
import { growth } from '../career/career';
import { RNG } from '../simulation/engine/rng';
import { decodeDuel, encodeDuel } from '../retention/duel';

beforeEach(() => localStorage.clear());

describe('Challenge settings', () => {
  it('pays more for harder settings and less for easier ones', () => {
    expect(challengeMultiplier()).toBe(1);
    expect(challengeMultiplier('legend', { numbers: false, colors: false })).toBe(1.38);
    expect(challengeMultiplier('rookie', { numbers: true, colors: true })).toBe(0.72);
  });
  it('remembers the last settings per mode', () => {
    expect(challengePrefs('perfect')).toEqual({ level: 'pro', view: STANDARD_VIEW });
    saveChallengePrefs('perfect', { level: 'legend', view: { numbers: true, colors: false } });
    expect(challengePrefs('perfect')).toEqual({ level: 'legend', view: { numbers: true, colors: false } });
    expect(challengePrefs('hunt').level).toBe('pro');
  });
  it('82-0: the level moves every opponent and the score; the Daily is always standard', async () => {
    const h = await loadHistoryForTests();
    const legend = newPerfectRun(h, 'quick', 5, undefined, { level: 'legend', view: { numbers: false, colors: false } });
    expect(legend).toMatchObject({ level: 'legend', view: { numbers: false, colors: false } });
    expect(oppEdge(legend, false) - oppEdge({ ...legend, level: undefined }, false)).toBe(LEVEL_EDGE.legend);
    const daily = newPerfectRun(h, 'quick', 5, '2026-10-02', { level: 'legend', view: { numbers: true, colors: false } });
    expect(daily.level).toBeUndefined();
    expect(daily.view).toBeUndefined();
    const won = { ...legend, games: [{ opp: 'x', us: 110, them: 100, won: true, top: '' }] };
    expect(summary(won).score).toBe(Math.round(110 * 1.38));
    expect(newPerfectRun(h, 'quick', 5).view).toBeUndefined();
  });
  it('League Hunt keeps a view only off the Daily and Weekly', async () => {
    const h = await loadHistoryForTests();
    expect(newRun(h, 3, { view: { numbers: true, colors: true } }).view).toEqual({ numbers: true, colors: true });
    expect(newRun(h, 3, { daily: '2026-10-02', view: { numbers: true, colors: true } }).view).toBeUndefined();
    expect(newRun(h, 3, { view: STANDARD_VIEW }).view).toBeUndefined();
  });
  it('Career: Rookie grows faster and ages slower, Legend the other way', () => {
    const g = (age: number, l: 'rookie' | 'pro' | 'legend') => growth('threePoint', age, false, new RNG(1), l);
    expect(g(20, 'rookie')).toBeGreaterThan(g(20, 'pro'));
    expect(g(20, 'legend')).toBeLessThan(g(20, 'pro'));
    expect(g(34, 'rookie')).toBeGreaterThan(g(34, 'pro'));
    expect(g(34, 'legend')).toBeLessThan(g(34, 'pro'));
  });
  it('a duel carries the view so the friend plays the same way', () => {
    const d = decodeDuel(encodeDuel({ v: 1, m: 'hunt', s: 9, n: 'x', r: { score: 1, line: '', won: false }, vw: { numbers: true, colors: false } }));
    expect(d?.vw).toEqual({ numbers: true, colors: false });
  });
});
