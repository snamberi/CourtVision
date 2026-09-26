import type { Attributes } from '../types';
import type { AggregatedFlags } from './effective';
import type { RNG } from './rng';

export type TurnoverType =
  | 'BAD_HANDLE'
  | 'LOST_BALL'
  | 'BAD_PASS'
  | 'PASSING_LANE_STEAL'
  | 'ON_BALL_STEAL'
  | 'OFFENSIVE_FOUL'
  | 'CHARGE'
  | 'TRAVELING'
  | 'OUT_OF_BOUNDS'
  | 'DOUBLE_TEAM_TURNOVER'
  | 'SHOT_CLOCK_VIOLATION'
  | 'ILLEGAL_SCREEN'
  | 'MISC';

export interface TurnoverContext {
  action: 'drive' | 'pass' | 'isolation' | 'postUp' | 'pnrHandle' | 'catchAndShoot' | 'transition';
  isPass: boolean;
  defenderPerimeterDefense: number;
  defenderStealIQ: number;
  defenderOnBallSteal: number;
  defenderPassingLaneSteal: number;
  defensivePressure: number; // 0-1, from double teams / help defense settings
  doubleTeamed: boolean;
  fatigueLevel: number; // 0-1
  turnoverFrequencyMultiplier: number; // from GameSettings, tunable global dial
  stealFrequencyMultiplier?: number; // League Rules: Simulation Engine "Steal Frequency" x Defense "Steal Success" (both scale the same lever)
  chargeFrequencyMultiplier?: number; // League Rules: Game Rules "Charge Frequency"
  perimeterDefenseImpactMultiplier?: number; // League Rules: Defense "Perimeter Defense Impact"
}

export interface TurnoverOutcome {
  occurred: boolean;
  type?: TurnoverType;
  probability: number; // for Debug Mode transparency
  causedBySteal: boolean;
  stealerCredit?: 'ON_BALL' | 'PASSING_LANE';
}

/**
 * Core rule: an elite ball handler (high Ball Handling + Ball Security + Decision
 * Making) must have a materially lower turnover probability per opportunity than
 * an average one — regardless of position or usage. Usage/touches change the
 * NUMBER of opportunities, never the underlying per-opportunity rate directly.
 */
export function computeTurnoverProbability(
  offense: Attributes,
  ctx: TurnoverContext,
  flags: AggregatedFlags,
): number {
  if (flags.neverTurnover) return 0;

  const bh = offense.offense.ballHandling;
  const security = offense.offense.ballSecurity;
  const passing = offense.offense.passingAccuracy;
  const passingIQ = offense.offense.passingIQ;
  const decision = offense.offense.decisionMaking;

  // Baseline risk per opportunity, driven by skill (higher skill => much lower risk).
  let base = ctx.isPass
    ? 0.015 + Math.max(0, (90 - passing)) * 0.0009 + Math.max(0, (90 - passingIQ)) * 0.0006
    : 0.015 + Math.max(0, (90 - bh)) * 0.001 + Math.max(0, (90 - security)) * 0.0009;

  base += Math.max(0, (90 - decision)) * 0.0004;

  // Defensive pressure raises risk.
  const defPressure =
    (ctx.defenderPerimeterDefense * (ctx.perimeterDefenseImpactMultiplier ?? 1) + (ctx.isPass ? ctx.defenderPassingLaneSteal : ctx.defenderOnBallSteal) + ctx.defenderStealIQ) / 3;
  base += Math.max(0, defPressure - 50) * 0.0007;
  base += ctx.defensivePressure * 0.03;

  if (ctx.doubleTeamed) base += 0.045;

  // Fatigue degrades ball security and decision-making.
  base += ctx.fatigueLevel * 0.02;

  // Action-specific opportunity difficulty
  const actionDifficulty: Record<TurnoverContext['action'], number> = {
    drive: 1.15,
    pass: 1.0,
    isolation: 1.05,
    postUp: 0.9,
    pnrHandle: 1.1,
    catchAndShoot: 0.4,
    transition: 1.2,
  };
  base *= actionDifficulty[ctx.action];

  base *= ctx.turnoverFrequencyMultiplier;

  return Math.max(0.002, Math.min(0.6, base));
}

export function resolveTurnover(
  offense: Attributes,
  ctx: TurnoverContext,
  flags: AggregatedFlags,
  rng: RNG,
): TurnoverOutcome {
  const probability = computeTurnoverProbability(offense, ctx, flags);
  if (!rng.chance(probability)) {
    return { occurred: false, probability, causedBySteal: false };
  }

  // Decide turnover flavor.
  const stealMult = ctx.stealFrequencyMultiplier ?? 1;
  const chargeMult = ctx.chargeFrequencyMultiplier ?? 1;
  if (ctx.isPass) {
    const stealChance = (ctx.defenderPassingLaneSteal * stealMult) / (ctx.defenderPassingLaneSteal * stealMult + 60);
    if (rng.chance(stealChance)) {
      return { occurred: true, type: 'PASSING_LANE_STEAL', probability, causedBySteal: true, stealerCredit: 'PASSING_LANE' };
    }
    return { occurred: true, type: 'BAD_PASS', probability, causedBySteal: false };
  }

  const weights: [TurnoverType, number][] = [
    ['BAD_HANDLE', 3],
    ['LOST_BALL', 2],
    ['ON_BALL_STEAL', (ctx.defenderOnBallSteal / 20) * stealMult],
    ['OFFENSIVE_FOUL', 1 * chargeMult],
    ['TRAVELING', 1],
    ['OUT_OF_BOUNDS', 1],
    ['DOUBLE_TEAM_TURNOVER', ctx.doubleTeamed ? 3 : 0],
    ['ILLEGAL_SCREEN', 0.3],
    ['MISC', 0.5],
  ];
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let r = rng.next() * total;
  for (const [type, w] of weights) {
    r -= w;
    if (r <= 0) {
      return {
        occurred: true,
        type,
        probability,
        causedBySteal: type === 'ON_BALL_STEAL',
        stealerCredit: type === 'ON_BALL_STEAL' ? 'ON_BALL' : undefined,
      };
    }
  }
  return { occurred: true, type: 'MISC', probability, causedBySteal: false };
}
