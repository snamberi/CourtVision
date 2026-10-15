import { describe, it, expect } from 'vitest';
import { generatePlayer } from '../simulation/leagueGenerator';
import { developOffseasonPlayer, GUARANTEE_RATE } from '../simulation/engine/development';
import { calculateOverall } from '../simulation/engine/overall';
import { primeWindow } from '../simulation/engine/potential';
import { RNG } from '../simulation/engine/rng';
import { followsRealDevelopment, ratingsHeld, LOCKED_KEEPS_PLAYING } from '../simulation/realDevelopmentGate';
import { shouldRetire } from '../simulation/seasonTransition';
import type { PlayerSeason } from '../simulation/types';

const player = (seed: number, age: number): PlayerSeason => generatePlayer(`P${seed}`, '2026-27', 'A', age, seed, new RNG(seed));
const played = (p: PlayerSeason, minutes = 2300, games = 75): PlayerSeason => ({ ...p, seasonStats: { ...p.seasonStats!, minutes, gamesPlayed: games } });

describe('Edit Player: lock ratings and own development', () => {
  it('locked ratings: a year older, not a point different, even past his prime', () => {
    for (const age of [20, 27, 35]) {
      const p = { ...played(player(age, age)), lockRatings: true };
      const next = developOffseasonPlayer(p, new RNG(age));
      expect(next.age).toBe(age + 1);
      expect(next.attributes).toEqual(p.attributes);
      expect(calculateOverall(next)).toBe(calculateOverall(p));
    }
  });
  it('locked players who are still good never retire on age; real development steps aside for both options', () => {
    const old = player(5, 44);
    expect(shouldRetire({ ...old, lockRatings: true, overall: { mode: 'MANUAL', manualOverall: LOCKED_KEEPS_PLAYING + 10 } } as PlayerSeason, new RNG(1))).toBe(false);
    expect(shouldRetire(old, new RNG(1))).toBe(true); // 44 without the lock: forced out
    const league = { historical: { realDevelopment: true } } as never;
    const real = { ...player(6, 25), real: { id: 'x' } } as unknown as PlayerSeason;
    expect(followsRealDevelopment(real, league)).toBe(true);
    expect(followsRealDevelopment({ ...real, ownDevelopment: true }, league)).toBe(false);
    expect(followsRealDevelopment({ ...real, lockRatings: true }, league)).toBe(false);
    expect(ratingsHeld({ ...real, lockRatings: true }, league)).toBe(true);
    expect(ratingsHeld({ ...real, ownDevelopment: true }, league)).toBe(false);
  });
});

describe('growing into potential', () => {
  it(`development rate ${GUARANTEE_RATE}+ reaches potential by the first year of his prime, however big the gap`, () => {
    let reached = 0;
    for (let i = 0; i < 20; i++) {
      const base = player(100 + i, 22);
      const w = primeWindow(base);
      const p = played({ ...base, age: w.start - 1, development: { ...base.development, developmentRate: GUARANTEE_RATE, potential: Math.min(99, calculateOverall(base) + 40) } });
      const next = developOffseasonPlayer(p, new RNG(i));
      if (calculateOverall(next) >= p.development.potential - 1) reached++;
    }
    expect(reached).toBe(20);
  });
  it('a season lost to injury still gets in the way of the guarantee', () => {
    const base = player(300, 22), w = primeWindow(base);
    const p = { ...base, age: w.start - 1, development: { ...base.development, developmentRate: 120, potential: Math.min(99, calculateOverall(base) + 30) } };
    const healthy = developOffseasonPlayer(played(p), new RNG(3)), hurt = developOffseasonPlayer(played(p, 200, 6), new RNG(3));
    expect(calculateOverall(hurt)).toBeLessThan(calculateOverall(healthy));
  });
  it('a player who reaches his prime short of his potential keeps growing toward it, and the window fades', () => {
    let gained = 0, n = 0;
    for (let i = 0; i < 40; i++) {
      const base = player(500 + i, 22), w = primeWindow(base);
      const p = played({ ...base, age: w.start, development: { ...base.development, potential: Math.min(99, calculateOverall(base) + 8) } });
      const next = developOffseasonPlayer(p, new RNG(i));
      gained += calculateOverall(next) - calculateOverall(p); n++;
      expect(next.development.potential).toBeLessThanOrEqual(p.development.potential);
      expect(calculateOverall(next)).toBeLessThanOrEqual(p.development.potential);
    }
    expect(gained / n).toBeGreaterThan(0.8);
  });
});
