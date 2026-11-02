import { describe, it, expect } from 'vitest';
import { activityScore, cleanActivityScore, mergeActivityScore } from '../profile/activityScore';
describe('Court Score activity bonuses', () => {
  it('caps each UTC day at five unique completed runs', () => {
    const state=cleanActivityScore({'2026-11-01':['a','b','c','d','e','f','a'],bad:['g']});
    expect(activityScore(state)).toBe(100);
    expect(Object.keys(state)).toEqual(['2026-11-01']);
  });
  it('merges both devices without duplicating runs and is independent of merge order', () => {
    const a={'2026-11-01':['a','b']}, b={'2026-11-01':['b','c'],'2026-11-02':['d']};
    expect(mergeActivityScore(a,b)).toEqual(mergeActivityScore(b,a));
    expect(activityScore(mergeActivityScore(a,b))).toBe(80);
    expect(mergeActivityScore(a,a)).toEqual(a);
  });
  it('ignores malformed records', () => {
    expect(cleanActivityScore(null)).toEqual({});
    expect(cleanActivityScore([])).toEqual({});
    expect(cleanActivityScore({'2026-11-01':'wrong'})).toEqual({});
  });
});
