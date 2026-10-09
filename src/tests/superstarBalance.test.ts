import { describe, expect, it } from 'vitest';
import { superFactor } from '../simulation/engine/superstar';
import { blockLength, chooseBallHandler } from '../simulation/engine/ballHandler';
import { updateFatigue } from '../simulation/engine/fatigue';
import { RNG } from '../simulation/engine/rng';
import type { AggregatedFlags } from '../simulation/engine/effective';

describe('Ratings past 99 (Career Mode)', () => {
  it('do nothing at 99 or below and reach full effect at 110', () => {
    expect(superFactor(60)).toBe(0);
    expect(superFactor(99)).toBe(0);
    expect(superFactor(110)).toBe(1);
    expect(superFactor(120)).toBeLessThanOrEqual(1.5);
  });

  it('height past 7\'0" adds block reach; shorter players are unchanged', () => {
    expect(blockLength(80)).toBe(1);
    expect(blockLength(84)).toBe(1);
    expect(blockLength(92)).toBeGreaterThan(2);
  });

  it('a 110 IQ floor general gets the ball far more, with the same random rolls', () => {
    const pick = (iq: number) => {
      const rng = new RNG(3);
      let n = 0;
      for (let i = 0; i < 2000; i++) {
        const id = chooseBallHandler([
          { playerId: 'big', priority: 20, fatigueLevel: 0, onCourt: true, iq },
          { playerId: 'pg', priority: 80, fatigueLevel: 0, onCourt: true },
          { playerId: 'w', priority: 50, fatigueLevel: 0, onCourt: true },
        ], rng);
        if (id === 'big') n++;
      }
      return n;
    };
    expect(pick(1)).toBeGreaterThan(pick(0) * 5);
  });

  it('a 110 athlete barely tires; an ordinary player tires as before', () => {
    const flags = { infiniteStamina: false } as AggregatedFlags;
    const normal = updateFatigue({ level: 0 }, true, 1, 80, flags, 15);
    expect(updateFatigue({ level: 0 }, true, 1, 80, flags, 15, 0)).toEqual(normal);
    expect(updateFatigue({ level: 0 }, true, 1, 80, flags, 15, 1).level).toBeCloseTo(normal.level * 0.2);
  });
});
