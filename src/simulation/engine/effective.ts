import type { Attributes, Badge, BadgeEffect, PlayerSeason } from '../types';
import { getBadgeById } from '../badges';

export interface AggregatedFlags {
  perfectShooter: boolean;
  perfectBlocker: boolean;
  perfectStealer: boolean;
  neverTurnover: boolean;
  infiniteStamina: boolean;
  unlimitedRange: boolean;
  noInjury: boolean;
  noFoul: boolean;
  automaticAssist: boolean;
  unblockableShot: boolean;
  unstealableBall: boolean;
  speedMultiplier: number;
  reboundMultiplier: number;
  gravityMultiplier: number;
  verticalMultiplier: number;
}

function emptyFlags(): AggregatedFlags {
  return {
    perfectShooter: false,
    perfectBlocker: false,
    perfectStealer: false,
    neverTurnover: false,
    infiniteStamina: false,
    unlimitedRange: false,
    noInjury: false,
    noFoul: false,
    automaticAssist: false,
    unblockableShot: false,
    unstealableBall: false,
    speedMultiplier: 1,
    reboundMultiplier: 1,
    gravityMultiplier: 1,
    verticalMultiplier: 1,
  };
}

function getByPath(obj: any, path: string): number {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj) ?? 0;
}

function setByPath(obj: any, path: string, value: number) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
  cur[parts[parts.length - 1]] = value;
}

export interface EffectivePlayer {
  attributes: Attributes; // deep-cloned, badge modifiers applied
  flags: AggregatedFlags;
  sandboxMode: boolean;
}

/**
 * Applies equipped badges (attribute modifiers + flags) on top of base attributes.
 * Base attributes are never mutated — this returns a fresh effective view.
 */
export function resolveEffectivePlayer(
  season: PlayerSeason,
  customBadges: Badge[] = [],
  sandboxMode = false,
): EffectivePlayer {
  const attributes: Attributes = JSON.parse(JSON.stringify(season.attributes));
  const flags = emptyFlags();

  for (const badgeId of new Set(season.badges)) {
    const badge = getBadgeById(badgeId, customBadges);
    if (!badge || (!sandboxMode && badge.category === 'experimental')) continue;
    applyEffect(attributes, flags, badge.effect);
  }

  if (!sandboxMode) {
    // Realistic mode: clamp all numeric ratings to [0, 99], ignore broken flags. Career Mode's player can be one of
    // history's greats at something (up to 120, see career/wheel.ts).
    clampRealistic(attributes, season.careerPlayer || season.highRatings ? CAREER_RATING_MAX : 99);
    return { attributes, flags: emptyFlags(), sandboxMode: false };
  }

  return { attributes, flags, sandboxMode: true };
}

function applyEffect(attributes: Attributes, flags: AggregatedFlags, effect: BadgeEffect) {
  if (effect.attributeModifiers) {
    for (const [path, delta] of Object.entries(effect.attributeModifiers)) {
      if (delta == null) continue;
      const current = getByPath(attributes, path);
      setByPath(attributes, path, current + delta);
    }
  }
  if (effect.flags) {
    const f = effect.flags;
    if (f.perfectShooter) flags.perfectShooter = true;
    if (f.perfectBlocker) flags.perfectBlocker = true;
    if (f.perfectStealer) flags.perfectStealer = true;
    if (f.neverTurnover) flags.neverTurnover = true;
    if (f.infiniteStamina) flags.infiniteStamina = true;
    if (f.unlimitedRange) flags.unlimitedRange = true;
    if (f.noInjury) flags.noInjury = true;
    if (f.noFoul) flags.noFoul = true;
    if (f.automaticAssist) flags.automaticAssist = true;
    if (f.unblockableShot) flags.unblockableShot = true;
    if (f.unstealableBall) flags.unstealableBall = true;
    if (f.speedMultiplier) flags.speedMultiplier *= f.speedMultiplier;
    if (f.reboundMultiplier) flags.reboundMultiplier *= f.reboundMultiplier;
    if (f.gravityMultiplier) flags.gravityMultiplier *= f.gravityMultiplier;
    if (f.verticalMultiplier) flags.verticalMultiplier *= f.verticalMultiplier;
  }
}

/** The highest rating Career Mode's player can carry (the best ever at something). */
export const CAREER_RATING_MAX = 120;

/** Past 99 a rating counts half on the court: a 120 shooter is the best ever, not a 70% three-point shooter. */
const pastNinetyNine = (v: number, max: number) => (v > 99 && max > 99 ? 99 + (Math.min(max, v) - 99) / 2 : Math.min(max, v));

function clampRealistic(attributes: Attributes, max = 99) {
  const clampGroup = (group: Record<string, number>) => {
    for (const k of Object.keys(group)) {
      if (typeof group[k] === 'number') group[k] = Math.max(0, pastNinetyNine(group[k], max));
    }
  };
  clampGroup(attributes.offense as any);
  clampGroup(attributes.defense as any);
  clampGroup(attributes.mental as any);
  // physical has non-rating fields (height/weight in real units) — only clamp the rating-like ones
  const p: any = attributes.physical;
  for (const k of ['vertical', 'speed', 'acceleration', 'strength', 'agility', 'balance', 'stamina', 'durability']) {
    p[k] = Math.max(0, pastNinetyNine(p[k], max));
  }
}

/** Height contributes at most ~2 Overall points — never a large swing. See NON-NEGOTIABLE RULES. */
export function heightOverallContribution(heightInches: number): number {
  const NBA_AVG_HEIGHT = 79; // ~6'7"
  const diff = heightInches - NBA_AVG_HEIGHT;
  const raw = diff * 0.15; // small slope
  return Math.max(-2, Math.min(2, raw));
}
