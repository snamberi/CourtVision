import type { NbaHistory } from '../history/nbaHistoryData';
import { cardPool, cardPlayer } from '../hunt/cards';
import { calculateOverall } from '../simulation/engine/overall';
import type { Attributes, PlayerSeason } from '../simulation/types';

/*
 * Create-a-Player (82-0 Fun): one made-up player built from real ones. Each skill comes from the player you pick for
 * it, at that player's card ("Curry's shooting, LeBron's finishing, Magic's passing, Rodman's rebounding"). Skills
 * nobody was picked for come from the base player, whose body and name-tag the new player starts from.
 */

export type SkillPart = 'shooting' | 'finishing' | 'playmaking' | 'defense' | 'rebounding' | 'athleticism' | 'size' | 'clutch';
export interface Hybrid {
  /** The name on the jersey (also the name in the box score). */
  name: string;
  /** The base player's card id: every skill no one else gives. */
  base: string;
  /** Skill → the card id it comes from. */
  parts: Partial<Record<SkillPart, string>>;
}

type Keys = { [G in keyof Attributes]?: (keyof Attributes[G])[] };
export const SKILL_PARTS: { id: SkillPart; label: string; blurb: string; keys: Keys; tendencies?: 'shot' | 'handle' }[] = [
  { id: 'shooting', label: 'Shooting', blurb: 'Threes, mid-range, free throws (and his shot diet)', tendencies: 'shot',
    keys: { offense: ['midrange', 'longMidrange', 'threePoint', 'corner3', 'aboveBreak3', 'pullUp3', 'catchAndShoot', 'freeThrow', 'shotIQ', 'offensiveConsistency'] } },
  { id: 'finishing', label: 'Finishing', blurb: 'Layups, dunks, touch and the post',
    keys: { offense: ['closeShot', 'drivingLayup', 'drivingDunk', 'standingDunk', 'finishing', 'touch', 'postHook', 'postFade', 'postControl'] } },
  { id: 'playmaking', label: 'Handles & passing', blurb: 'Ball handling, passing and reads', tendencies: 'handle',
    keys: { offense: ['ballHandling', 'ballSecurity', 'speedWithBall', 'passing', 'passingAccuracy', 'passingIQ', 'decisionMaking', 'offensiveIQ'] } },
  { id: 'defense', label: 'Defense', blurb: 'On the ball, help, steals',
    keys: { defense: ['perimeterDefense', 'interiorDefense', 'defensiveIQ', 'helpDefense', 'pickAndRollDefense', 'closeout', 'contest', 'steal', 'stealIQ', 'onBallSteal', 'passingLaneSteal', 'defensiveConsistency', 'defensiveAwareness', 'defensiveDiscipline'] } },
  { id: 'rebounding', label: 'Rebounds & blocks', blurb: 'Boards on both ends, rim protection',
    keys: { offense: ['offensiveRebounding'], defense: ['defensiveRebounding', 'block', 'blockIQ', 'blockTiming', 'rimProtection'] } },
  { id: 'athleticism', label: 'Athleticism', blurb: 'Speed, bounce, strength, stamina',
    keys: { physical: ['vertical', 'speed', 'acceleration', 'strength', 'agility', 'balance', 'stamina', 'durability'] } },
  { id: 'size', label: 'Size', blurb: 'Height, weight, wingspan, reach',
    keys: { physical: ['heightInches', 'weightLbs', 'wingspanInches', 'standingReachInches'] } },
  { id: 'clutch', label: 'Clutch & IQ', blurb: 'Big moments, poise, basketball IQ',
    keys: { mental: ['clutch', 'consistency', 'confidence', 'composure', 'discipline', 'aggression', 'effort', 'basketballIQ', 'playoffPerformance', 'pressurePerformance', 'leadership'] } },
];

export const MAX_NAME = 24;
export const cleanHybridName = (s: string) => s.replace(/[^\p{L}\p{N} .'-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);

/** Every card id the hybrid uses (base first), for checks. */
export const hybridCards = (hy: Hybrid) => [hy.base, ...Object.values(hy.parts).filter((x): x is string => !!x)];
export const validHybrid = (h: NbaHistory, hy: Hybrid | undefined): hy is Hybrid => !!hy && !!cleanHybridName(hy.name) && hybridCards(hy).every(id => cardPool(h).byId.has(id));

/** The created player as a game-ready season (bonus as for any card: chemistry, coach). */
export function hybridPlayer(h: NbaHistory, hy: Hybrid, teamId: string, bonus = 0): PlayerSeason {
  const pool = cardPool(h);
  const base = cardPlayer(h, pool.byId.get(hy.base)!, teamId, bonus);
  const attributes: Attributes = { physical: { ...base.attributes.physical }, offense: { ...base.attributes.offense }, defense: { ...base.attributes.defense }, mental: { ...base.attributes.mental } };
  let tendencies = base.tendencies, ballHandlerPriority = base.ballHandlerPriority;
  for (const part of SKILL_PARTS) {
    const id = hy.parts[part.id];
    if (!id || id === hy.base || !pool.byId.has(id)) continue;
    const donor = cardPlayer(h, pool.byId.get(id)!, teamId, bonus);
    for (const g of Object.keys(part.keys) as (keyof Attributes)[]) {
      const from = donor.attributes[g] as unknown as Record<string, number>, to = attributes[g] as unknown as Record<string, number>;
      for (const k of part.keys[g] as string[]) to[k] = from[k];
    }
    if (part.tendencies === 'shot') tendencies = { ...tendencies, shot: donor.tendencies.shot, threePointTargets: donor.tendencies.threePointTargets };
    if (part.tendencies === 'handle') { tendencies = { ...tendencies, passing: donor.tendencies.passing, driving: donor.tendencies.driving, ballDominance: donor.tendencies.ballDominance }; ballHandlerPriority = donor.ballHandlerPriority; }
  }
  return { ...base, attributes, tendencies, ballHandlerPriority, playerId: cleanHybridName(hy.name) || 'Created Player', firstName: undefined, lastName: undefined, real: undefined };
}

/** His overall as the game rates him (for the builder's preview). */
export const hybridOverall = (h: NbaHistory, hy: Hybrid) => Math.round(calculateOverall(hybridPlayer(h, hy, 'P820')));
