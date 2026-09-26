import { describe, it, expect } from 'vitest';
import { generateDraftClass } from '../simulation/gm';

describe('generateDraftClass - full prospect generation', () => {
  it('produces prospects with varied position suitability across the class (not a flat generic profile)', () => {
    const draftClass = generateDraftClass(14, 1, '2027-28');
    const primaryPositions = draftClass.map((p) => {
      const pos = p.trueSeason.positions;
      const entries = Object.entries(pos) as [string, number][];
      return entries.reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0];
    });
    expect(new Set(primaryPositions).size).toBeGreaterThan(1);
  });

  it('each prospect has a real full attribute set, not just a potential number', () => {
    const draftClass = generateDraftClass(14, 2, '2027-28');
    for (const p of draftClass) {
      expect(p.trueSeason.attributes.offense.threePoint).toBeGreaterThan(0);
      expect(p.trueSeason.attributes.defense.rimProtection).toBeGreaterThan(0);
      expect(p.trueSeason.attributes.physical.heightInches).toBeGreaterThan(0);
      expect(p.trueSeason.tendencies).toBeDefined();
    }
  });

  it('varies attribute totals across the class instead of everyone being identical', () => {
    const draftClass = generateDraftClass(14, 3, '2027-28');
    const totals = draftClass.map((p) => Object.values(p.trueSeason.attributes.offense).reduce((a, b) => a + b, 0));
    expect(new Set(totals).size).toBeGreaterThan(1);
  });

  it('ages prospects between 19 and 22', () => {
    const draftClass = generateDraftClass(20, 4, '2027-28');
    for (const p of draftClass) {
      expect(p.trueSeason.age).toBeGreaterThanOrEqual(19);
      expect(p.trueSeason.age).toBeLessThanOrEqual(22);
    }
  });
});
