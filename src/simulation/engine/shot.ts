import type { Attributes, ShotTendencies } from '../types';
import type { AggregatedFlags } from './effective';
import type { RNG } from './rng';
import type { ShotRuleMods, ShotTypeWeightMods } from './ruleMods';

export type ShotType =
  | 'rim' | 'close' | 'layup' | 'dunk'
  | 'midrange' | 'longMidrange' | 'stepback' | 'fadeaway' | 'postShot' | 'hook'
  | 'corner3' | 'aboveBreak3' | 'pullUp3' | 'catchAndShoot3';

export const THREE_POINT_TYPES: ShotType[] = ['corner3', 'aboveBreak3', 'pullUp3', 'catchAndShoot3', 'stepback'];
export const RIM_TYPES: ShotType[] = ['rim', 'close', 'layup', 'dunk'];

export type ContestLevel = 'open' | 'light' | 'contested' | 'heavy';

export interface ShotContext {
  type: ShotType;
  contest: ContestLevel;
  fatigueLevel: number; // 0-1
  isClutch: boolean;
  isPlayoffs: boolean;
  shootingVariance: number; // 0-1 from GameSettings
  action?: 'isolation' | 'pnr' | 'postUp' | 'drive' | 'catchAndShoot' | 'transition'; // which possession action created this look, for League Rules defense-by-action mods
  wasAssisted?: boolean; // for shotCreationDifficulty (self-created) / catchAndShootBonus
  defenderDefensiveIQ?: number; // for defensiveIQImpact
  ruleMods?: ShotRuleMods; // League Rules multipliers - see ruleMods.ts; omitted entirely => identical to pre-League-Rules behavior
}

function abilityForType(offense: Attributes['offense'], type: ShotType): number {
  const map: Record<ShotType, keyof Attributes['offense']> = {
    rim: 'closeShot',
    close: 'closeShot',
    layup: 'drivingLayup',
    dunk: 'drivingDunk',
    midrange: 'midrange',
    longMidrange: 'longMidrange',
    stepback: 'pullUp3', // stepbacks are almost always three-point in modern usage tendencies; midrange stepbacks fall under midrange tendency instead
    fadeaway: 'postFade',
    postShot: 'postControl',
    hook: 'postHook',
    corner3: 'corner3',
    aboveBreak3: 'aboveBreak3',
    pullUp3: 'pullUp3',
    catchAndShoot3: 'catchAndShoot',
  };
  return offense[map[type]] as number;
}

/**
 * Make% for an average (ability ~65) player shooting this shot type with a totally open look.
 * These are the anchor points the whole curve is built around — calibrated to real-life splits
 * (rim finishing is far easier than pull-up jumpers; threes trail twos; hooks/fadeaways are hard).
 */
const BASE_MAKE_BY_TYPE: Record<ShotType, number> = {
  dunk: 0.97,
  rim: 0.79,
  layup: 0.73,
  close: 0.68,
  hook: 0.60,
  postShot: 0.59,
  midrange: 0.59,
  longMidrange: 0.55,
  fadeaway: 0.52,
  corner3: 0.41,
  catchAndShoot3: 0.40,
  aboveBreak3: 0.38,
  pullUp3: 0.35,
  stepback: 0.34,
};

/** How hard defensive contest bites, by shot category — contests hurt jumpers far more than finishes at the rim. */
type ShotCategory = 'rim' | 'mid' | 'three';
function categoryOf(type: ShotType): ShotCategory {
  if (RIM_TYPES.includes(type)) return 'rim';
  if (THREE_POINT_TYPES.includes(type)) return 'three';
  return 'mid';
}

const CONTEST_DELTA: Record<ShotCategory, Record<ContestLevel, number>> = {
  rim: { open: 0.05, light: 0.0, contested: -0.07, heavy: -0.15 },
  mid: { open: 0.08, light: 0.02, contested: -0.08, heavy: -0.17 },
  three: { open: 0.09, light: 0.02, contested: -0.07, heavy: -0.15 },
};

// How much one point of ability above/below the population-average baseline shifts make%.
// The pivot sits near the average *effective* (post-fatigue) ability players actually shoot with,
// so a league of average shooters lands near the base rates above rather than systematically under them.
const ABILITY_SLOPE = 0.006;
export const RIM_FINISH_CALIBRATION = 0.06;
export const THREE_POINT_VOLUME = 1.12;
const ABILITY_PIVOT = 58;

function shotTypeWeightMultiplier(type: ShotType, mods: ShotTypeWeightMods): number {
  if (type === 'dunk') return mods.dunk;
  if (type === 'layup') return mods.layup;
  if (type === 'longMidrange') return mods.longTwo;
  if (THREE_POINT_TYPES.includes(type)) return mods.three;
  if (RIM_TYPES.includes(type)) return mods.rim; // whatever's left of RIM_TYPES after dunk/layup above: 'rim', 'close'
  return mods.mid; // midrange, fadeaway, postShot, hook
}

/** Choose which shot type is attempted this possession, weighted by tendencies + target-attempt overrides.
 * Tendency dials set the overall shape a player wants to play, but real shot selection also leans hard
 * toward shots the player is actually good at — a tendency to post up doesn't mean a bad post player
 * forces the issue there as often as the raw dial alone would imply.
 */
export function chooseShotType(tendencies: ShotTendencies, offense: Attributes['offense'], rng: RNG, weightMods?: ShotTypeWeightMods): ShotType {
  const entries = Object.entries(tendencies) as [ShotType, number][];
  const weights = entries.map(([type, w]) => {
    const ability = abilityForType(offense, type);
    const qualityFactor = Math.max(0.15, Math.min(1.9, Math.pow(Math.max(1, ability) / 50, 1.5)));
    const frequencyMult = weightMods ? shotTypeWeightMultiplier(type, weightMods) : 1;
    // Modern shot diets: about 40% of attempts are threes (NBA ~35 of 89 a game).
    const era = THREE_POINT_TYPES.includes(type) ? THREE_POINT_VOLUME : 1;
    return Math.max(0, w) * qualityFactor * frequencyMult * era;
  });
  const idx = rng.weightedPick(weights);
  return entries[idx][0];
}

export function computeMakeProbability(
  offense: Attributes,
  ctx: ShotContext,
  flags: AggregatedFlags,
  varianceRoll: number = Math.random(), // pass a seeded RNG's next() from the engine for determinism
): number {
  if (flags.perfectShooter) return 1;

  const ability = abilityForType(offense.offense, ctx.type); // 0-99 (or higher sandbox)
  const shotIQ = offense.offense.shotIQ;
  const consistency = offense.offense.offensiveConsistency;
  const category = categoryOf(ctx.type);
  const mods = ctx.ruleMods;

  // Base make rate, nudged per-shot-type by the Shooting section's difficulty/bonus sliders before
  // anything else - a "difficulty" >100 pushes the rate down, a "bonus" >100 pushes it up.
  let baseRate = BASE_MAKE_BY_TYPE[ctx.type];
  if (mods) {
    const shift = (m: number, harder: boolean) => (m - 1) * 0.5 * (harder ? -1 : 1);
    if (ctx.type === 'dunk') baseRate += shift(mods.dunkSuccess, false);
    else if (ctx.type === 'layup' || ctx.type === 'close' || ctx.type === 'rim') baseRate += shift(mods.layupDifficulty, true);
    else if (category === 'three') baseRate += shift(mods.threePointDifficulty, true);
    else if (category === 'mid') baseRate += shift(mods.midrangeDifficulty, true);

    if (ctx.type === 'pullUp3') baseRate += shift(mods.pullUpDifficulty, true);
    if (ctx.type === 'stepback') baseRate += shift(mods.stepBackDifficulty, true);
    if (ctx.type === 'fadeaway') baseRate += shift(mods.fadeawayDifficulty, true);
    if (ctx.type === 'catchAndShoot3') baseRate += shift(mods.catchAndShootBonus, false);
    if (ctx.type === 'corner3') baseRate += shift(mods.cornerThreeBonus, false);
    if (ctx.type === 'aboveBreak3') baseRate += shift(mods.aboveBreakThreeDifficulty, true);
  }
  baseRate = Math.max(0.05, Math.min(0.99, baseRate));

  let p = baseRate + (ability - ABILITY_PIVOT) * ABILITY_SLOPE;

  // Contest swing, softened for skilled shot-selectors (high shotIQ shooters take/avoid contests better).
  let contestDelta = CONTEST_DELTA[category][ctx.contest];
  if (mods) {
    // Perimeter vs. interior defense sliders scale how much contest matters by shot location.
    contestDelta *= category === 'rim' ? mods.interiorDefenseImpact : mods.perimeterDefenseImpact;
    // Then overall proximity sensitivity, split further by exactly how open the shot was.
    contestDelta *= mods.defenderProximityImpact;
    contestDelta *= contestDelta > 0
      ? (ctx.contest === 'open' ? mods.wideOpenShotBonus : mods.openShotBonus)
      : mods.contestedShotPenalty;
  }
  const defenderIQCounter = mods && ctx.defenderDefensiveIQ != null
    ? Math.min(0.3, Math.max(0, (ctx.defenderDefensiveIQ - 50) / 200) * mods.defensiveIQImpact)
    : 0;
  const contestMitigation = contestDelta < 0 ? Math.max(0.3, 1 - Math.min(0.35, shotIQ / 260) + defenderIQCounter) : 1;
  p += contestDelta * contestMitigation * (mods ? mods.shotQualityImportance : 1);

  // Off-the-dribble/self-created shots are genuinely harder than a clean feed - catchAndShootBonus
  // above already covers the assisted case specifically, this covers self-creation generally.
  if (mods && ctx.wasAssisted === false) {
    p -= (mods.shotCreationDifficulty - 1) * 0.04;
  }

  // Defense-by-action: pick-and-roll/post/transition defense quality suppresses those specific
  // situations on top of the generic contest math above.
  if (mods) {
    if (ctx.action === 'pnr') p -= (mods.pickAndRollDefense - 1) * 0.03;
    if (ctx.type === 'postShot' || ctx.type === 'hook') p -= (mods.postDefense - 1) * 0.03;
    if (ctx.action === 'transition') p -= (mods.transitionDefense - 1) * 0.03;
  }

  // Fatigue penalty, dampened by consistency.
  p -= ctx.fatigueLevel * 0.10 * (1 - consistency / 200);

  // Clutch / playoff modifiers only apply in those specific contexts.
  if (ctx.isClutch) p += (offense.mental.clutch - 50) * 0.0012;
  if (ctx.isPlayoffs) p += (offense.mental.playoffPerformance - 50) * 0.001;

  // Random variance noise (does not override skill, just widens/narrows the distribution).
  const varianceSpread = ctx.shootingVariance * 0.09;
  p += (varianceRoll * 2 - 1) * varianceSpread;

  // League-wide offensive/defensive efficiency dials, applied last as a broad scaling pass.
  if (mods) {
    p *= mods.offensiveEfficiency;
    p /= mods.defensiveEfficiency;
  }

  // Blocks are rolled separately and are now at NBA levels (about 5 a game); this keeps finishing at the rim near
  // the NBA's ~65% so overall field-goal percentage stays around 47%.
  if (category === 'rim') p -= RIM_FINISH_CALIBRATION;

  const floor = category === 'rim' ? 0.12 : 0.06;
  return Math.max(floor, Math.min(0.98, p));
}

export function resolveShot(
  offense: Attributes,
  ctx: ShotContext,
  flags: AggregatedFlags,
  rng: RNG,
): { made: boolean; probability: number } {
  const probability = computeMakeProbability(offense, ctx, flags, rng.next());
  return { made: rng.chance(probability), probability };
}

export function rollContestLevel(
  defenderContest: number,
  closeout: number,
  rng: RNG,
  contestEffectivenessMult = 1,
  closeoutEffectivenessMult = 1,
  heavilyContestedFrequencyMult = 1,
): ContestLevel {
  const pressure = (defenderContest * contestEffectivenessMult + closeout * closeoutEffectivenessMult) / 2;
  const roll = rng.next() * 100 + (pressure - 50) * 0.6 - (heavilyContestedFrequencyMult - 1) * 20;
  if (roll < 25) return 'open';
  if (roll < 50) return 'light';
  if (roll < 78) return 'contested';
  return 'heavy';
}

/**
 * Probability that a shot attempt draws a shooting foul (before we even roll make/miss).
 * Rim/drive attempts draw fouls far more often than jump shots, tuned so a team lands in the
 * realistic ~20-24 FTA/game range once combined with and-1s on made contested shots.
 */
export function foulDrawProbability(
  type: ShotType,
  contest: ContestLevel,
  defenderDiscipline: number,
  foulFrequencyMultiplier: number,
  freeThrowFrequencyMultiplier = 1,
): number {
  // Shooting fouls only; non-shooting and bonus fouls are rolled in the possession (see possession.ts).
  const base: Record<ShotCategory, number> = { rim: 0.165, mid: 0.048, three: 0.034 };
  const contestBoost: Record<ContestLevel, number> = { open: 0.4, light: 0.8, contested: 1.15, heavy: 1.4 };
  const disciplineFactor = 1 - Math.min(0.4, Math.max(-0.3, (defenderDiscipline - 50) / 150));
  return Math.max(0, base[categoryOf(type)] * contestBoost[contest] * disciplineFactor * foulFrequencyMultiplier * freeThrowFrequencyMultiplier);
}

/** Chance a made shot under contact also draws the foul for an and-1. Much rarer than a shooting foul on a miss. */
export function andOneProbability(type: ShotType, contest: ContestLevel): number {
  if (contest === 'open') return 0.01;
  const base: Record<ShotCategory, number> = { rim: 0.09, mid: 0.02, three: 0.015 };
  const contestBoost: Record<ContestLevel, number> = { open: 1, light: 1, contested: 1.4, heavy: 1.8 };
  return base[categoryOf(type)] * contestBoost[contest];
}

export function resolveFreeThrow(freeThrowRating: number, rng: RNG, difficultyMultiplier = 1): boolean {
  // An average rating lands near the NBA's ~78%; poor shooters sit in the 60s, specialists near 90%.
  const p = Math.max(0.45, Math.min(0.97, 0.48 + freeThrowRating * 0.0056 * (2 - difficultyMultiplier)));
  return rng.chance(p);
}
