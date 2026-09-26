import { describe, it, expect } from 'vitest';
import { computeTurnoverProbability, resolveTurnover, type TurnoverContext } from '../simulation/engine/turnover';
import { RNG } from '../simulation/engine/rng';
import type { Attributes } from '../simulation/types';

function baseAttrs(overrides: Partial<Attributes['offense']> = {}): Attributes {
  return {
    physical: { heightInches: 78, weightLbs: 200, wingspanInches: 80, standingReachInches: 100, vertical: 60, speed: 60, acceleration: 60, strength: 60, agility: 60, balance: 60, stamina: 80, durability: 80 },
    offense: {
      closeShot: 60, drivingLayup: 60, drivingDunk: 60, standingDunk: 60, postHook: 40, postFade: 40, postControl: 40,
      midrange: 60, longMidrange: 60, threePoint: 60, corner3: 60, aboveBreak3: 60, pullUp3: 60, catchAndShoot: 60,
      freeThrow: 70, ballHandling: 60, ballSecurity: 60, speedWithBall: 60, passing: 60, passingAccuracy: 60,
      passingIQ: 60, offensiveIQ: 60, shotIQ: 60, decisionMaking: 60, finishing: 60, touch: 60,
      offensiveConsistency: 60, offensiveRebounding: 40,
      ...overrides,
    },
    defense: {
      perimeterDefense: 50, interiorDefense: 50, defensiveIQ: 50, helpDefense: 50, pickAndRollDefense: 50,
      closeout: 50, contest: 50, steal: 50, stealIQ: 50, onBallSteal: 50, passingLaneSteal: 50, block: 40,
      blockIQ: 40, blockTiming: 40, rimProtection: 40, defensiveRebounding: 50, defensiveConsistency: 50,
      defensiveAwareness: 50, defensiveDiscipline: 50,
    },
    mental: { clutch: 60, consistency: 60, confidence: 60, composure: 60, discipline: 60, aggression: 60, effort: 60, basketballIQ: 60, playoffPerformance: 60, pressurePerformance: 60, leadership: 60 },
  };
}

const baseCtx: TurnoverContext = {
  action: 'drive',
  isPass: false,
  defenderPerimeterDefense: 50,
  defenderStealIQ: 50,
  defenderOnBallSteal: 50,
  defenderPassingLaneSteal: 50,
  defensivePressure: 0.15,
  doubleTeamed: false,
  fatigueLevel: 0,
  turnoverFrequencyMultiplier: 1,
};

describe('turnover system', () => {
  it('elite ball handling + ball security yields materially lower turnover probability than average', () => {
    const elite = baseAttrs({ ballHandling: 99, ballSecurity: 99, decisionMaking: 95 });
    const average = baseAttrs({ ballHandling: 60, ballSecurity: 60, decisionMaking: 60 });

    const eliteProb = computeTurnoverProbability(elite, baseCtx, {} as any);
    const averageProb = computeTurnoverProbability(average, baseCtx, {} as any);

    expect(eliteProb).toBeLessThan(averageProb);
    expect(eliteProb / averageProb).toBeLessThan(0.6);
  });

  it('does NOT inflate turnover risk merely because the action is a primary-ball-handler-style possession', () => {
    // Same elite attributes, different "position implied" usage — probability must be
    // driven by attributes/context only, not by an implicit point-guard penalty.
    const elite = baseAttrs({ ballHandling: 99, ballSecurity: 99, decisionMaking: 95 });
    const isoCtx: TurnoverContext = { ...baseCtx, action: 'isolation' };
    const postCtx: TurnoverContext = { ...baseCtx, action: 'postUp' };
    const isoProb = computeTurnoverProbability(elite, isoCtx, {} as any);
    const postProb = computeTurnoverProbability(elite, postCtx, {} as any);
    // both should be low; neither should be artificially inflated to "PG-like" numbers
    expect(isoProb).toBeLessThan(0.06);
    expect(postProb).toBeLessThan(0.06);
  });

  it('Never Turnover badge flag drives probability to exactly zero', () => {
    const attrs = baseAttrs({ ballHandling: 40, ballSecurity: 30 });
    const prob = computeTurnoverProbability(attrs, baseCtx, { neverTurnover: true } as any);
    expect(prob).toBe(0);
  });

  it('double teams and defensive pressure increase turnover probability', () => {
    const attrs = baseAttrs();
    const normal = computeTurnoverProbability(attrs, baseCtx, {} as any);
    const doubled = computeTurnoverProbability(attrs, { ...baseCtx, doubleTeamed: true, defensivePressure: 0.6 }, {} as any);
    expect(doubled).toBeGreaterThan(normal);
  });

  it('turnover opportunity model produces a rate roughly matching computed probability over many trials', () => {
    const attrs = baseAttrs({ ballHandling: 90, ballSecurity: 90, decisionMaking: 85 });
    const rng = new RNG(42);
    const trials = 5000;
    let occurred = 0;
    for (let i = 0; i < trials; i++) {
      const out = resolveTurnover(attrs, baseCtx, {} as any, rng);
      if (out.occurred) occurred++;
    }
    const empirical = occurred / trials;
    const theoretical = computeTurnoverProbability(attrs, baseCtx, {} as any);
    expect(Math.abs(empirical - theoretical)).toBeLessThan(0.02);
  });
});
