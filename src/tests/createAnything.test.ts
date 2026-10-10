import { describe, expect, it } from 'vitest';
import { sandboxBuild, setSandbox, primeFromSandbox, categoryPaths, buildPlayer, valuesAt, startProgress, primeOverall, SANDBOX_MAX, SANDBOX_MIN, type Progress } from '../career/create';
import { CATEGORIES } from '../career/categories';
import { isSandboxCareer, type CareerMeta } from '../career/career';
import { careerCacheOf } from '../profile/profile';
import { derive } from '../../server/derive';
import { starLift, STAR_FROM, STAR_MAX } from '../simulation/engine/superstar';

const full = (v: number) => Object.fromEntries(CATEGORIES.map(c => [c.id, v])) as Progress;

describe('Career: Create Anything', () => {
  it('takes any rating from 1 to 120 and any size', () => {
    let b = sandboxBuild(75, 100);
    b = setSandbox(b, categoryPaths('threePoint'), 500);
    b = setSandbox(b, categoryPaths('perimeterD'), -3);
    b = setSandbox(b, ['offense.freeThrow'], 42);
    const prime = primeFromSandbox({ ...b, weightLbs: 999 });
    expect(Object.values(prime.threePoint).every(v => v === SANDBOX_MAX)).toBe(true);
    expect(Object.values(prime.perimeterD).every(v => v === SANDBOX_MIN)).toBe(true);
    expect(prime.midRange['offense.freeThrow']).toBe(42);
    expect(prime.size['physical.heightInches']).toBe(100);
    expect(prime.body['physical.weightLbs']).toBe(400);
  });

  it('"Exactly as built" plays at those ratings from day one and keeps them', () => {
    const b = setSandbox(setSandbox(sandboxBuild(120), categoryPaths('threePoint'), 1), ['mental.clutch'], 7);
    const prime = primeFromSandbox(b);
    for (const p of [startProgress(), full(1), full(-1)]) {
      const v = valuesAt(prime, p, 'exact');
      expect(v.threePoint['offense.threePoint']).toBe(1);
      expect(v.athleticism['physical.speed']).toBe(120);
      expect(v.iq['mental.clutch']).toBe(7);
      expect(v.body['physical.weightLbs']).toBe(prime.body['physical.weightLbs']);
    }
    const p = { ...buildPlayer({ name: 'Max Out', pos: 'SF', jersey: 0 }, prime, startProgress(), 'exact', '2025-26', 19, 1), careerPlayer: true };
    expect(p.attributes.physical.speed).toBe(120);
    expect(p.attributes.offense.threePoint).toBe(1);
    expect(primeOverall(prime, 'exact', 'SF')).toBeGreaterThan(99);
    // A normal readiness still grows him toward what you built.
    expect(valuesAt(prime, startProgress(), 'balanced').athleticism['physical.speed']).toBeLessThan(120);
  });

  it('never counts for XP, achievements or the online boards', () => {
    const retired = (mode: CareerMeta['mode'], id: string) => ({ version: 1, id, mode, playerId: 'Max Out', status: 'retired', updatedAt: 1, years: [{ season: '2026-27', age: 19, awards: [{ key: 'mvp' }], stats: { gamesPlayed: 82, points: 3000 } }],
      retired: { age: 35, season: '2042-43', legacy: 150, rank: 1, hallOfFame: 'first-ballot' } }) as unknown as CareerMeta;
    expect(isSandboxCareer(retired('sandbox', 'a'))).toBe(true);
    const cache = careerCacheOf([retired('sandbox', 'a')]);
    expect(cache.retired).toBe(0);
    expect(cache.legacy).toBe(0);
    expect(careerCacheOf([retired('wheel', 'b')]).retired).toBe(1);
    const d = derive({ version: 1, updatedAt: 1, storage: {}, careers: [retired('sandbox', 'a')] });
    expect(d.players).toHaveLength(0);
  });
});

describe('Franchise stars lift their team', () => {
  it('starts at a true superstar and caps', () => {
    expect(starLift(STAR_FROM)).toBe(0);
    expect(starLift(80)).toBe(0);
    expect(starLift(95)).toBeGreaterThan(0.04);
    expect(starLift(100)).toBeGreaterThan(starLift(95));
    expect(starLift(120)).toBe(STAR_MAX);
  });
});
