import type { LeagueRulesSettings } from '../leagueRules';
import { DEFAULT_LEAGUE_RULES } from '../leagueRules';

/**
 * Every field here defaults to a neutral 1 (or 0 where an additive shift, called out below) when
 * `rules` is undefined or a given field is left at ITS OWN default - so a game simulated with no
 * rules produces IDENTICAL output to before this file existed. Crucially, the League Rules panel
 * does NOT use one universal baseline: development/aging fields default to 100 (proportional,
 * `value / 100`), while nearly every Shooting/Defense/Simulation-Engine field defaults to 50 (or
 * another field-specific value like 70 or 30) instead. `mult()` below divides by each field's own
 * real default from DEFAULT_LEAGUE_RULES rather than assuming 100, so "no rules" and "rules left at
 * their shipped defaults" always produce the identical 1x multiplier regardless of which baseline
 * that particular field happens to use.
 *
 * A handful of Shooting/Simulation-Engine/Defense fields are deliberately left out (still inert):
 * shotFrequency, offBallMovement, shotClockUsage, hotColdStreakImpact, deflectionFrequency,
 * screenNavigation, defensiveCommunication, defensiveMatchupImportance, positionMismatchPenalty,
 * defensiveVersatility. Each would need a genuinely new mechanic (shot-clock modeling, per-player
 * streak tracking, a deflections stat, discrete screen events, matchup-quality detection) rather
 * than a multiplier on something that already exists, so wiring them here would be a fake connection.
 */

function mult<K extends keyof LeagueRulesSettings>(rules: LeagueRulesSettings | undefined, key: K): number {
  const def = DEFAULT_LEAGUE_RULES[key] as unknown as number;
  const value = (rules?.[key] as unknown as number) ?? def;
  return def === 0 ? 1 : value / def;
}

export interface ShotTypeWeightMods {
  three: number;
  mid: number;
  rim: number;
  dunk: number;
  layup: number;
  longTwo: number;
}

export interface ActionWeightMods {
  isolation: number;
  pnr: number;
  postUp: number;
  transition: number;
}

/** Multipliers consumed inside shot.ts's make-probability formula. */
export interface ShotRuleMods {
  threePointDifficulty: number;
  midrangeDifficulty: number;
  layupDifficulty: number;
  dunkSuccess: number;
  pullUpDifficulty: number;
  stepBackDifficulty: number;
  fadeawayDifficulty: number;
  catchAndShootBonus: number;
  cornerThreeBonus: number;
  aboveBreakThreeDifficulty: number;
  contestedShotPenalty: number;
  openShotBonus: number;
  wideOpenShotBonus: number;
  perimeterDefenseImpact: number;
  interiorDefenseImpact: number;
  closeoutEffectiveness: number;
  contestEffectiveness: number;
  defenderProximityImpact: number;
  shotQualityImportance: number;
  shotCreationDifficulty: number;
  heavilyContestedShotFrequency: number;
  offensiveEfficiency: number;
  defensiveEfficiency: number;
  pickAndRollDefense: number;
  postDefense: number;
  transitionDefense: number;
  defensiveIQImpact: number;
  freeThrowDifficulty: number;
}

/** Multipliers consumed inside turnover.ts. */
export interface TurnoverRuleMods {
  stealFrequency: number; // combined with Defense's stealSuccess - both scale the same lever, intentionally compounding
  stealSuccess: number;
  chargeFrequency: number;
  perimeterDefenseImpact: number;
}

export interface RuleMods {
  shot: ShotRuleMods;
  turnover: TurnoverRuleMods;
  shotTypeWeight: ShotTypeWeightMods;
  action: ActionWeightMods;
  reboundOffense: number;
  reboundDefense: number;
  assistFrequency: number;
  blockFrequency: number; // combined with Defense's blockSuccess - both scale the same lever, intentionally compounding
  blockSuccess: number;
  rimProtection: number;
  freeThrowFrequency: number;
  doubleTeamFrequency: number; // helpDefense x defensiveRotations, both feed the same double-team dial
  paceMultiplier: number;
  /** League office vote: the deepest threes count four (see possession.ts). */
  fourPointLine: boolean;
}

export function computeRuleMods(rules: LeagueRulesSettings | undefined): RuleMods {
  return {
    shot: {
      threePointDifficulty: mult(rules, 'threePointDifficulty'),
      midrangeDifficulty: mult(rules, 'midrangeDifficulty'),
      layupDifficulty: mult(rules, 'layupDifficulty'),
      dunkSuccess: mult(rules, 'dunkSuccessRate'),
      pullUpDifficulty: mult(rules, 'pullUpShootingDifficulty'),
      stepBackDifficulty: mult(rules, 'stepBackShootingDifficulty'),
      fadeawayDifficulty: mult(rules, 'fadeawayDifficulty'),
      catchAndShootBonus: mult(rules, 'catchAndShootBonus'),
      cornerThreeBonus: mult(rules, 'cornerThreeBonus'),
      aboveBreakThreeDifficulty: mult(rules, 'aboveBreakThreeDifficulty'),
      contestedShotPenalty: mult(rules, 'contestedShotPenalty'),
      openShotBonus: mult(rules, 'openShotBonus'),
      wideOpenShotBonus: mult(rules, 'wideOpenShotBonus'),
      perimeterDefenseImpact: mult(rules, 'perimeterDefenseImpact'),
      interiorDefenseImpact: mult(rules, 'interiorDefenseImpact'),
      closeoutEffectiveness: mult(rules, 'closeoutEffectiveness'),
      contestEffectiveness: mult(rules, 'contestEffectiveness'),
      defenderProximityImpact: mult(rules, 'defenderProximityImpact'),
      shotQualityImportance: mult(rules, 'shotQualityImportance'),
      shotCreationDifficulty: mult(rules, 'shotCreationDifficulty'),
      heavilyContestedShotFrequency: mult(rules, 'heavilyContestedShotFrequency'),
      offensiveEfficiency: mult(rules, 'offensiveEfficiency'),
      defensiveEfficiency: mult(rules, 'defensiveEfficiency'),
      pickAndRollDefense: mult(rules, 'pickAndRollDefense'),
      postDefense: mult(rules, 'postDefense'),
      transitionDefense: mult(rules, 'transitionDefense'),
      defensiveIQImpact: mult(rules, 'defensiveIQImpact'),
      freeThrowDifficulty: mult(rules, 'freeThrowDifficulty'),
    },
    turnover: {
      stealFrequency: mult(rules, 'stealFrequency'),
      stealSuccess: mult(rules, 'stealSuccess'),
      chargeFrequency: mult(rules, 'chargeFrequency'),
      perimeterDefenseImpact: mult(rules, 'perimeterDefenseImpact'),
    },
    shotTypeWeight: {
      three: mult(rules, 'threePointFrequency'),
      mid: mult(rules, 'midrangeFrequency'),
      rim: mult(rules, 'rimFrequency'),
      dunk: mult(rules, 'dunkFrequency'),
      layup: mult(rules, 'layupFrequency'),
      longTwo: mult(rules, 'longTwoFrequency'),
    },
    action: {
      isolation: mult(rules, 'isolationFrequency'),
      pnr: mult(rules, 'pickAndRollFrequency'),
      postUp: mult(rules, 'postUpFrequency'),
      transition: mult(rules, 'fastBreakFrequency') * mult(rules, 'transitionFrequency'),
    },
    reboundOffense: mult(rules, 'offensiveReboundFrequency'),
    reboundDefense: mult(rules, 'defensiveReboundFrequency'),
    assistFrequency: mult(rules, 'assistFrequency'),
    blockFrequency: mult(rules, 'blockFrequency'),
    blockSuccess: mult(rules, 'blockSuccess'),
    rimProtection: mult(rules, 'rimProtection'),
    freeThrowFrequency: mult(rules, 'freeThrowFrequency'),
    doubleTeamFrequency: mult(rules, 'helpDefense') * mult(rules, 'defensiveRotations'),
    paceMultiplier: mult(rules, 'possessionsPerGame'),
    fourPointLine: rules?.fourPointLine === true,
  };
}

/** A neutral bundle (every multiplier = 1) - used whenever no LeagueRulesSettings is available, so every call site can unconditionally read `mods.whatever` instead of chaining `?.` everywhere. */
export const NEUTRAL_RULE_MODS: RuleMods = computeRuleMods(undefined);
