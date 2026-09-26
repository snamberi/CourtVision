import { describe, it, expect } from 'vitest';
import { computeMakeProbability, type ShotContext } from '../simulation/engine/shot';
import type { Attributes } from '../simulation/types';

function attrsWith3PT(rating: number, extra: Partial<Attributes['offense']> = {}): Attributes {
  return {
    physical: { heightInches: 78, weightLbs: 200, wingspanInches: 80, standingReachInches: 100, vertical: 60, speed: 60, acceleration: 60, strength: 60, agility: 60, balance: 60, stamina: 80, durability: 80 },
    offense: {
      closeShot: 60, drivingLayup: 60, drivingDunk: 60, standingDunk: 60, postHook: 40, postFade: 40, postControl: 40,
      midrange: 60, longMidrange: 60, threePoint: rating, corner3: rating, aboveBreak3: rating, pullUp3: rating, catchAndShoot: rating,
      freeThrow: 70, ballHandling: 60, ballSecurity: 60, speedWithBall: 60, passing: 60, passingAccuracy: 60,
      passingIQ: 60, offensiveIQ: 60, shotIQ: 60, decisionMaking: 60, finishing: 60, touch: 60,
      offensiveConsistency: 60, offensiveRebounding: 40,
      ...extra,
    },
    defense: { perimeterDefense: 50, interiorDefense: 50, defensiveIQ: 50, helpDefense: 50, pickAndRollDefense: 50, closeout: 50, contest: 50, steal: 50, stealIQ: 50, onBallSteal: 50, passingLaneSteal: 50, block: 40, blockIQ: 40, blockTiming: 40, rimProtection: 40, defensiveRebounding: 50, defensiveConsistency: 50, defensiveAwareness: 50, defensiveDiscipline: 50 },
    mental: { clutch: 60, consistency: 60, confidence: 60, composure: 60, discipline: 60, aggression: 60, effort: 60, basketballIQ: 60, playoffPerformance: 60, pressurePerformance: 60, leadership: 60 },
  };
}

const baseCtx: ShotContext = { type: 'catchAndShoot3', contest: 'open', fatigueLevel: 0, isClutch: false, isPlayoffs: false, shootingVariance: 0 };

describe('shot system', () => {
  it('higher 3PT ability yields higher make probability than lower ability', () => {
    const elite = computeMakeProbability(attrsWith3PT(99), baseCtx, {} as any);
    const poor = computeMakeProbability(attrsWith3PT(50), baseCtx, {} as any);
    expect(elite).toBeGreaterThan(poor);
  });

  it('Perfect Shooter badge forces make probability to exactly 1', () => {
    const p = computeMakeProbability(attrsWith3PT(10), baseCtx, { perfectShooter: true } as any);
    expect(p).toBe(1);
  });

  it('heavier contest reduces make probability versus an open look', () => {
    const open = computeMakeProbability(attrsWith3PT(90), { ...baseCtx, contest: 'open' }, {} as any);
    const heavy = computeMakeProbability(attrsWith3PT(90), { ...baseCtx, contest: 'heavy' }, {} as any);
    expect(heavy).toBeLessThan(open);
  });

  it('Unlimited Range removes the distance penalty on three-point attempts', () => {
    const withPenalty = computeMakeProbability(attrsWith3PT(90), baseCtx, {} as any);
    const noPenalty = computeMakeProbability(attrsWith3PT(90), baseCtx, { unlimitedRange: true } as any);
    expect(noPenalty).toBeGreaterThanOrEqual(withPenalty);
  });

  it('fatigue reduces make probability', () => {
    const fresh = computeMakeProbability(attrsWith3PT(90), { ...baseCtx, fatigueLevel: 0 }, {} as any);
    const tired = computeMakeProbability(attrsWith3PT(90), { ...baseCtx, fatigueLevel: 1 }, {} as any);
    expect(tired).toBeLessThan(fresh);
  });
});
