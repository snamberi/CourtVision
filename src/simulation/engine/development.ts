import { FOCUS_SKILLS } from '../coachingModel';
import { coachPerformanceModifiers, type CoachIdentity } from '../coaching';
import type { CoachTendencies } from '../league';
import type { PlayerSeason } from '../types';
import { RNG } from './rng';
import { calculateOverall, calculateFullAttributeOverall, calculateRatings } from './overall';
import { careerPhase, primeWindow, syncPotential } from './potential';
import type { LeagueRulesSettings } from '../leagueRules';
import { expenseEffects, type TeamExpenseLevels } from '../league';

function clampAttr(v: number, max: number): number {
  return Math.max(0, Math.min(max, v));
}

// A rough baseline of "played like a rotation player all season" (~27 mpg over an 82-game slate).
// Actual minutes played this season are compared against this to scale how much a player develops -
// reps matter, so heavy-minutes players develop faster (and stay sharper into decline) than players
// who barely saw the floor.
const BASELINE_SEASON_MINUTES = 2200;

/**
 * Advances a player by one season of aging/development. Growth before
 * peakAge moves attributes toward Potential; decline at/after peakAge
 * reduces attributes based on declineRate. Both are now **chance-based**:
 * each season rolls for a "breakout" (full growth) vs a "quiet" season
 * (mostly flat) while growing, or a "rough" vs "well-preserved" year while
 * declining - biased by how much potential is left and how heavy the
 * player's minutes were, so playing a prospect more minutes measurably
 * raises their odds and pace of improvement. Returns a NEW PlayerSeason -
 * the input is never mutated - with `previousOverall`/`previousFullOverall`
 * set to the values *before* this pass, so callers can display deltas.
 *
 * `rules` (from League Settings) lets a league tune development speed and
 * variance, rookie/young-player growth bonuses, late-career decline speed,
 * and how much playing time matters - each multiplier is 100 = baseline.
 */
export function developOffseasonPlayer(season: PlayerSeason, rng: RNG = new RNG(), rules?: LeagueRulesSettings, facilityMultiplier = 1, focus: CoachTendencies['trainingFocus'] = 'balanced', ratingCap = 200): PlayerSeason {
  const beforeOverall = calculateOverall(season);
  const beforeFullOverall = calculateFullAttributeOverall(season);
  const next: PlayerSeason = JSON.parse(JSON.stringify(season));
  next.age = season.age + 1;

  const speedMult = ((rules?.developmentSpeed ?? 100) / 100) * facilityMultiplier;
  const randomnessMult = (rules?.developmentRandomness ?? 100) / 100;
  const playingTimeMult = (rules?.developmentFromPlayingTime ?? 100) / 100;
  const declineSpeedMult = ((rules?.lateCareerDecline ?? 100) / 100) * ((rules?.declineSpeed ?? 100) / 100);
  const peakAgeShift = rules?.peakAgeShiftYears ?? 0;
  const effectivePeakAge = season.development.peakAge + peakAgeShift;
  // Higher "veteran development" means a savvier vet resists decline better (a 150 slider halves decline; 50 doubles it).
  const veteranDeclineMult = (200 - (rules?.veteranDevelopment ?? 100)) / 100;
  const athleticDeclineRateMult = (rules?.athleticDeclineRate ?? 100) / 100;
  const declineRandomnessMult = (rules?.agingRandomness ?? 100) / 100;
  const offenseGrowthMult = ((rules?.shootingDevelopment ?? 100) + (rules?.finishingDevelopment ?? 100) + (rules?.passingDevelopment ?? 100)) / 300;
  const defenseGrowthMult = (rules?.defenseDevelopment ?? 100) / 100;
  const mentalGrowthMult = (rules?.mentalDevelopment ?? 100) / 100;

  // A player's prime is a window, not a birthday: they grow toward potential before it, hold through it,
  // and decline after it. Each player carries their own prime length and decline speed.
  const window = primeWindow(season, rules);
  const phase = careerPhase(season, rules, next.age);
  const primeEnd = window.end;
  void effectivePeakAge;

  const varianceFactor = 1 + (rng.next() - 0.5) * (season.development.developmentVariance / 50) * randomnessMult;
  const maxAttr = Math.max(ratingCap, ...Object.values(season.attributes.offense), ...Object.values(season.attributes.defense), ...Object.values(season.attributes.mental)); // clamp headroom only; realistic-mode display clamp happens in resolveEffectivePlayer

  const minutesPlayedRaw = season.seasonStats?.minutes ?? 0;
  const baseMinutesFactor = minutesPlayedRaw > 0 ? Math.max(0.4, Math.min(1.6, minutesPlayedRaw / BASELINE_SEASON_MINUTES)) : 0.6;
  const gamesPlayedForMinutes = season.seasonStats?.gamesPlayed ?? 0;
  const mpg = minutesPlayedRaw / Math.max(1, gamesPlayedForMinutes);
  const overload = mpg > 32 ? Math.max(.65, 1 - (mpg - 32) / 55) : 1;
  const roleSupport = season.training && ['lead guard','secondary creator','bench creator'].includes(season.training.plan.targetRole)
    ? .85 + Math.min(.2, season.training.evidence.handling / Math.max(1, season.training.evidence.minutes) * .3) : 1;
  const minutesFactor = (1 + (Math.min(1.25, baseMinutesFactor) - 1) * playingTimeMult) * overload * roleSupport;
  const workEthic = .65 + season.development.workEthic / 140;
  const pattern = season.training?.pattern;
  const patternBoost = pattern === 'late bloomer' ? (next.age < 24 ? .8 : 1.15) : pattern === 'early contributor' ? (next.age < 23 ? 1.15 : .95) : pattern === 'raw project' ? .9 : 1;

  // Games missed to injury both slow growth and accelerate decline — a lost season really costs a player.
  const gamesPlayed = season.seasonStats?.gamesPlayed ?? 0;
  const missedShare = season.training?.practiceDays ? Math.min(.85, season.training.injuredDays / season.training.practiceDays) : gamesPlayed > 0 ? Math.max(0, Math.min(0.85, 1 - gamesPlayed / 70)) : 0.5;
  const injuryGrowthPenalty = 1 - missedShare * 0.55; // heavily injured seasons stunt development
  const injuryDeclinePenalty = 1 + missedShare * 0.7; // and make the decline years bite harder
  // Adding one "growth point" to every skill moves the headline Overall by roughly this much.
  const OVERALL_PER_GROWTH = 0.77;
  const applyGrowth = (growth: number) => {
    for (const k of Object.keys(next.attributes.offense) as (keyof typeof next.attributes.offense)[]) {
      next.attributes.offense[k] = clampAttr(next.attributes.offense[k] + growth * offenseGrowthMult * (focus === 'balanced' ? 1 : focus === 'shooting' && ['threePoint', 'midrange', 'longMidrange', 'corner3', 'aboveBreak3', 'pullUp3', 'catchAndShoot', 'freeThrow', 'shotIQ'].includes(k) ? 1.45 : focus === 'playmaking' && ['passingIQ', 'passingAccuracy', 'passing', 'ballHandling', 'decisionMaking'].includes(k) ? 1.45 : 0.9), maxAttr);
    }
    for (const k of Object.keys(next.attributes.defense) as (keyof typeof next.attributes.defense)[]) {
      next.attributes.defense[k] = clampAttr(next.attributes.defense[k] + growth * 0.85 * defenseGrowthMult * (focus === 'defense' ? 1.35 : focus === 'balanced' ? 1 : 0.9), maxAttr);
    }
    for (const k of Object.keys(next.attributes.mental) as (keyof typeof next.attributes.mental)[]) {
      next.attributes.mental[k] = clampAttr(next.attributes.mental[k] + growth * 0.6 * mentalGrowthMult, maxAttr);
    }
  };

  // League rules can weight skill groups differently, so correct once toward the intended Overall change.
  const growOverall = (target: number) => {
    if (Math.abs(target) < 0.01) return;
    const start = calculateOverallExact(next);
    applyGrowth(target / OVERALL_PER_GROWTH);
    const realized = calculateOverallExact(next) - start;
    if (Math.sign(realized) === Math.sign(target) && Math.abs(realized) > 0.05 && Math.abs(realized) < Math.abs(target) * 0.85) applyGrowth((target - realized) / OVERALL_PER_GROWTH * Math.abs(target / realized) * 0.9);
  };

  if (phase === 'growth') {
    // 1) Playing time re-rates the ceiling: real minutes can raise it, a season glued to the bench can lower it.
    const cap = Math.min(99, ratingCap - 1);
    let potential = season.development.potential;
    const potentialRoll = rng.next(), sizeRoll = rng.next();
    // Raises get smaller as the ceiling rises, so a 90+ ceiling has to be earned, not handed out.
    const eliteDamp = Math.max(0.12, 1 - Math.max(0, potential - 70) / 16);
    if (gamesPlayedForMinutes >= 30 && mpg >= 24 && potentialRoll < 0.3 * playingTimeMult) {
      const bump = (1 + Math.round(sizeRoll * 1.4) + (next.age <= 21 ? 1 : 0)) * eliteDamp;
      potential += bump >= 1 ? Math.round(bump) : sizeRoll < bump ? 1 : 0;
    } else if (gamesPlayedForMinutes >= 30 && mpg >= 16 && potentialRoll < 0.18 * playingTimeMult) {
      potential += sizeRoll < eliteDamp ? 1 : 0;
    } else if (next.age >= 21 && (gamesPlayedForMinutes < 20 || mpg < 8) && potentialRoll < 0.35) {
      potential -= 1 + Math.round(sizeRoll * 2);
    }
    potential = Math.max(beforeOverall, Math.min(Math.max(cap, season.development.potential), potential));
    next.development.potential = potential;

    // 2) Grow toward that ceiling. The closer the prime, the more of the remaining gap closes each year;
    //    a breakout year closes much more, a quiet year very little. Nobody grows past potential.
    const gap = Math.max(0, potential - beforeOverall);
    const yearsLeft = Math.max(1, window.start - next.age);
    const ageBonus = next.age <= 21 ? (rules?.rookieDevelopmentBonus ?? 100) / 100 : next.age <= 24 ? (rules?.youngPlayerDevelopment ?? 100) / 100 : 1;
    const breakoutChance = Math.max(0.05, Math.min(0.9, (0.4 + (minutesFactor - 1) * 0.3) * injuryGrowthPenalty));
    const roll = rng.next();
    const tier = roll < breakoutChance * 0.12 ? 1.9 : roll < breakoutChance * 0.45 ? 1.35 : roll < breakoutChance ? 1 : roll < breakoutChance + 0.3 ? 0.55 : 0.25;
    const share = Math.min(0.8, 1.25 / (yearsLeft + 0.5));
    // Becoming a star takes years: growth slows once a young player is already good, so a draft class produces
    // one or two stars, not a handful, and they arrive in their mid-20s.
    const starSlowdown = beforeOverall >= 72 ? 0.5 : beforeOverall >= 67 ? 0.68 : beforeOverall >= 62 ? 0.85 : 1;
    const overallGain = Math.min(gap, 7, gap * share * tier * starSlowdown * (0.6 + season.development.developmentRate / 250)
      * varianceFactor * minutesFactor * speedMult * workEthic * patternBoost * ageBonus * injuryGrowthPenalty);
    growOverall(overallGain);
  } else if (phase === 'prime') {
    // Prime: what you see is what you get. Small year-to-year noise; heavy minutes keep a player sharp.
    const drift = (rng.next() - 0.5) * 1.4 * randomnessMult - (next.age >= primeEnd ? 0.35 : 0);
    growOverall(drift * ((rules?.primeDevelopment ?? 100) / 100));
  } else {
    // Post-prime decline, scaled by the player's own declineRate plus injury wear. The roll gives some
    // veterans a graceful landing and others a hard cliff.
    const yearsPastPrime = next.age - primeEnd;
    const declineRoll = 0.6 + rng.next() * 0.9 * declineRandomnessMult;
    const wearFromMinutes = 0.85 + minutesFactor * 0.15;
    const accel = 1 + yearsPastPrime * 0.18; // decline compounds the further past prime they get
    const decline = Math.max(0, (season.development.declineRate / 100) * 1.3
      * varianceFactor * declineRoll * wearFromMinutes * declineSpeedMult * accel * injuryDeclinePenalty * veteranDeclineMult);

    for (const k of Object.keys(next.attributes.offense) as (keyof typeof next.attributes.offense)[]) {
      next.attributes.offense[k] = clampAttr(next.attributes.offense[k] - decline, maxAttr);
    }
    for (const k of Object.keys(next.attributes.defense) as (keyof typeof next.attributes.defense)[]) {
      next.attributes.defense[k] = clampAttr(next.attributes.defense[k] - decline, maxAttr);
    }
    // Athleticism goes first, which is why old guards lose a step before they lose their jumper.
    next.attributes.physical.speed = clampAttr(next.attributes.physical.speed - decline * 1.6 * athleticDeclineRateMult, maxAttr);
    next.attributes.physical.vertical = clampAttr(next.attributes.physical.vertical - decline * 1.6 * athleticDeclineRateMult, maxAttr);
    next.attributes.physical.acceleration = clampAttr(next.attributes.physical.acceleration - decline * 1.4 * athleticDeclineRateMult, maxAttr);
    next.attributes.physical.agility = clampAttr(next.attributes.physical.agility - decline * 1.3 * athleticDeclineRateMult, maxAttr);
  }

  if (season.training) {
    const primary = FOCUS_SKILLS[season.training.plan.primary], secondary = FOCUS_SKILLS[season.training.plan.secondary];
    for (const group of ['offense','defense','mental'] as const) for (const key of Object.keys(next.attributes[group])) {
      const old = season.attributes[group] as unknown as Record<string,number>, dest = next.attributes[group] as unknown as Record<string,number>;
      const delta = dest[key] - old[key], path = `${group}.${key}`;
      if (delta > 0) dest[key] = clampAttr(old[key] + delta * Math.max(.25, 1 - Math.max(0,old[key]-70)/100) * ((primary as readonly string[]).includes(path) ? 1.3 : (secondary as readonly string[]).includes(path) ? 1.08 : .82), maxAttr);
      if (delta < 0 && (key.toLowerCase().includes('iq') || key === 'decisionMaking' || key === 'freeThrow')) dest[key] = clampAttr(old[key] + Math.min(.4, workEthic * .2) * speedMult, maxAttr);
    }
    // Athletic skills peak earlier than learned reads; physical decline can coexist with skill growth.
    if (next.age >= effectivePeakAge + (pattern === 'early physical peak' ? 0 : 2)) {
      for (const key of ['speed','acceleration','vertical','agility'] as const) next.attributes.physical[key] = clampAttr(next.attributes.physical[key] - .25 * declineSpeedMult, maxAttr);
    }
  }
  if (phase === 'growth') capToPotential(season, next, next.development.potential);
  const synced = syncPotential(next, rules);
  synced.previousOverall = beforeOverall;
  synced.previousFullOverall = beforeFullOverall;
  return synced;
}

/** Scales this offseason's rating changes back just enough that Overall does not pass `potential`. */
function capToPotential(before: PlayerSeason, next: PlayerSeason, potential: number) {
  if (calculateOverall(next) <= potential) return;
  const groups = ['offense', 'defense', 'mental', 'physical'] as const;
  const from = groups.map(g => ({ ...(before.attributes[g] as unknown as Record<string, number>) }));
  const to = groups.map(g => ({ ...(next.attributes[g] as unknown as Record<string, number>) }));
  const blend = (k: number) => groups.forEach((g, i) => {
    const dest = next.attributes[g] as unknown as Record<string, number>;
    for (const key of Object.keys(to[i])) if (typeof to[i][key] === 'number' && typeof from[i][key] === 'number') dest[key] = from[i][key] + (to[i][key] - from[i][key]) * k;
  });
  let lo = 0, hi = 1;
  for (let n = 0; n < 12; n++) { const mid = (lo + hi) / 2; blend(mid); if (calculateOverall(next) <= potential) lo = mid; else hi = mid; }
  blend(lo);
}

/** `keep` marks players this pass must not touch (real players under Real Player Development). */
export function developOffseasonLeague<T extends { seasons: PlayerSeason[]; expenseLevels?: TeamExpenseLevels; coachIdentity?: CoachIdentity; coach?: CoachTendencies }>(teams: T[], seed = 1, rules?: LeagueRulesSettings, keep?: (p: PlayerSeason) => boolean): T[] {
  const rng = new RNG(seed);
  return teams.map((t) => {
    // A team that funds its coaching/development staff gets measurably better progressions.
    const coach = coachPerformanceModifiers(t.coachIdentity, t.seasons).development;
    const mult = expenseEffects(t.expenseLevels).developmentMultiplier * (1 + (coach - 1) * (rules?.coachingImpact ?? 100) / 100);
    return { ...t, seasons: t.seasons.map((s) => (keep?.(s) ? s : developOffseasonPlayer(s, rng, rules, mult, t.coach?.trainingFocus))) };
  });
}

/** Unrounded Overall, for measuring small growth steps. */
function calculateOverallExact(p: PlayerSeason): number {
  const r = calculateRatings({ ...p, overall: { ...p.overall, mode: 'AUTO' } });
  return r.rawOverall ?? r.overall;
}
