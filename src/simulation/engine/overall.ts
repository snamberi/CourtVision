import type { PlayerSeason } from '../types';
import { heightOverallContribution } from './effective';

export interface RatingBreakdown {
  overall: number;
  offensiveRating: number;
  defensiveRating: number;
  shootingRating: number;
  creationRating: number;
  playmakingRating: number;
  reboundingRating: number;
  physicalRating: number;
  /** Unrounded, unclamped composite (before any manual override). */
  rawOverall?: number;
}

/** Computes the full Overall + sub-rating breakdown for a season. Overall is a summary display only. */
export function calculateRatings(season: PlayerSeason): RatingBreakdown {
  const off = season.attributes.offense;
  const def = season.attributes.defense;
  const men = season.attributes.mental;
  const phys = season.attributes.physical;

  const shootingRating = (off.threePoint + off.midrange + off.closeShot + off.freeThrow) / 4;
  const creationRating = (off.ballHandling + off.pullUp3 + off.finishing + men.confidence) / 4;
  const playmakingRating = (off.passing + off.passingIQ + off.decisionMaking) / 3;
  const offensiveRating = (shootingRating + creationRating + playmakingRating) / 3;

  const defensiveRating = (def.perimeterDefense + def.interiorDefense + def.steal + def.block + def.defensiveIQ) / 5;
  const reboundingRating = (off.offensiveRebounding + def.defensiveRebounding) / 2;
  const physicalRating = (phys.speed + phys.strength + phys.stamina + phys.vertical) / 4;

  const heightBonus = heightOverallContribution(phys.heightInches);
  const mentalBlend = (men.basketballIQ + men.consistency + men.clutch) / 3;

  const rawOverall =
    offensiveRating * 0.35 +
    defensiveRating * 0.25 +
    reboundingRating * 0.1 +
    physicalRating * 0.1 +
    mentalBlend * 0.2 +
    heightBonus;

  const overall = season.overall.mode === 'MANUAL' && season.overall.manualOverall != null
    ? season.overall.manualOverall
    : Math.round(Math.max(25, Math.min(199, rawOverall)));

  return { overall, rawOverall, offensiveRating, defensiveRating, shootingRating, creationRating, playmakingRating, reboundingRating, physicalRating };
}

export function calculateOverall(season: PlayerSeason): number {
  return calculateRatings(season).overall;
}

/**
 * A broader, unweighted "true overall" used by the league analytics page:
 * the plain average of literally every rated attribute the player has
 * (physical skill ratings, all offense, all defense, all mental), explicitly
 * excluding raw body measurements (height/weight/wingspan/standing reach —
 * different units, not skill ratings) and shot tendencies/badges (preferences,
 * not ability). This is intentionally a different number from the headline
 * `calculateOverall` used for roster/trade display, which is a hand-weighted
 * composite of a smaller set of marquee attributes.
 */
export function calculateFullAttributeOverall(season: PlayerSeason): number {
  const { physical, offense, defense, mental } = season.attributes;
  const physicalSkillFields = [physical.vertical, physical.speed, physical.acceleration, physical.strength, physical.agility, physical.balance, physical.stamina, physical.durability];
  const all = [
    ...physicalSkillFields,
    ...(Object.values(offense) as number[]),
    ...(Object.values(defense) as number[]),
    ...(Object.values(mental) as number[]),
  ];
  const avg = all.reduce((sum, v) => sum + v, 0) / all.length;
  return Math.round(Math.max(25, Math.min(199, avg)));
}
