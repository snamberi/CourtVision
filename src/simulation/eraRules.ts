import type { EraRules, GameSettings } from './types';
import { REALISTIC_ERA_MODERN } from './types';
import type { RuleMods } from './engine/ruleMods';

/* Era rules for year-accurate historical leagues: each season plays by the NBA's rules of that year.
 *  - No 3-point line before 1979-80; the shortened 22-foot line from 1994-95 to 1996-97.
 *  - No shot clock before 1954-55 (its slower pace is already in the season's real pace).
 *  - Hand-checking allowed until 2003-04; illegal-defense rules (no zones) until 2000-01.
 * Three-point volume follows the real share of shots that were threes that season. */

/** The rules of the season that opens in `startYear` (2001 = 2001-02). Game length stays the league's own. */
export function realEraRules(startYear: number, base: EraRules): EraRules {
  return {
    ...base,
    threePointLineDistance: startYear < 1979 ? 0 : startYear >= 1994 && startYear <= 1996 ? 22 : 23.75,
    shotClockSeconds: startYear < 1954 ? 0 : 24,
    handChecking: startYear < 2004,
    zoneDefenseAllowed: startYear >= 2001,
    defensiveThreeSeconds: startYear >= 2001,
  };
}

/** Today's rules, keeping the league's own game length. */
export function modernEraRules(base: EraRules): EraRules {
  return { ...base, threePointLineDistance: REALISTIC_ERA_MODERN.threePointLineDistance, shotClockSeconds: REALISTIC_ERA_MODERN.shotClockSeconds,
    handChecking: false, zoneDefenseAllowed: true, defensiveThreeSeconds: true };
}

/**
 * Settings for one season of a year-accurate league: that year's rules and three-point volume while era rules are on
 * and the data covers the season, today's rules otherwise.
 */
export function seasonEraSettings(settings: GameSettings, season: number, threeVolume: Record<string, number> | undefined, lastDataStartYear: number): GameSettings {
  const on = !!settings.yearAccurate && settings.eraRules !== false && season <= lastDataStartYear;
  if (!on) {
    if (settings.eraYear == null) return settings;
    const { eraYear: _y, eraThreeVolume: _v, ...rest } = settings;
    return { ...rest, era: modernEraRules(settings.era) };
  }
  return { ...settings, era: realEraRules(season, settings.era), eraYear: season, eraThreeVolume: threeVolume?.[String(season)] ?? 1 };
}

/** One line describing a season's rules, e.g. "no 3-point line · hand-checking · no zone defenses". */
export function eraSummary(era: EraRules, threeVolume?: number): string {
  const parts = [
    era.threePointLineDistance <= 0 ? 'no 3-point line' : era.threePointLineDistance < 23 ? '22-foot 3-point line' : `threes at ${Math.round((threeVolume ?? 1) * 100)}% of today's volume`,
    era.shotClockSeconds <= 0 ? 'no shot clock' : null,
    era.handChecking ? 'hand-checking' : null,
    era.zoneDefenseAllowed ? null : 'no zone defenses',
  ].filter(Boolean);
  return parts.join(' · ');
}

/** What the season's rules do on the floor. A modern season (no eraYear, a 3-point line) is untouched. */
export function applyEraRules(mods: RuleMods, settings: Pick<GameSettings, 'era' | 'eraYear' | 'eraThreeVolume'>): RuleMods {
  const era = settings.era;
  const noLine = era.threePointLineDistance <= 0;
  if (settings.eraYear == null && !noLine) return mods;
  const volume = noLine ? 0 : Math.max(0.03, settings.eraThreeVolume ?? 1);
  const shortLine = !noLine && era.threePointLineDistance < 23;
  const handCheck = settings.eraYear != null && era.handChecking;
  const noZones = settings.eraYear != null && !era.zoneDefenseAllowed;
  return {
    ...mods,
    shotTypeWeight: { ...mods.shotTypeWeight, three: mods.shotTypeWeight.three * volume },
    shot: {
      ...mods.shot,
      threePointDifficulty: mods.shot.threePointDifficulty * (shortLine ? 0.93 : 1),
      perimeterDefenseImpact: mods.shot.perimeterDefenseImpact * (handCheck ? 1.08 : 1),
      interiorDefenseImpact: mods.shot.interiorDefenseImpact * (noZones ? 0.95 : 1),
    },
    action: { ...mods.action, isolation: mods.action.isolation * (noZones ? 1.12 : 1), postUp: mods.action.postUp * (noZones ? 1.1 : 1) },
    doubleTeamFrequency: mods.doubleTeamFrequency * (noZones ? 0.8 : 1),
    freeThrowFrequency: mods.freeThrowFrequency * (handCheck ? 1.05 : 1),
    fourPointLine: noLine ? false : mods.fourPointLine,
  };
}
