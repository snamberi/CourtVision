import { describe, it, expect } from 'vitest';
import { RNG } from '../simulation/engine/rng';
import { calculateOverall, calculateFullAttributeOverall } from '../simulation/engine/overall';
import { developOffseasonPlayer } from '../simulation/engine/development';
import { makeDefaultSeason } from '../simulation/presets/samplePlayers';
import { emptySeasonStatTotals } from '../simulation/types';

function youngProspect(minutes: number) {
  const season = makeDefaultSeason('prospect', '2025-26', null, 20);
  season.development = { potential: 90, developmentRate: 60, developmentVariance: 10, peakAge: 27, declineRate: 40, injuryRisk: 30, workEthic: 60 };
  season.seasonStats = { ...emptySeasonStatTotals(), gamesPlayed: minutes > 0 ? 60 : 0, minutes };
  return season;
}

describe('developOffseasonPlayer - chance and minutes based growth', () => {
  it('sets previousFullOverall to the pre-development full-attribute composite', () => {
    const season = youngProspect(2000);
    const before = calculateFullAttributeOverall(season);
    const after = developOffseasonPlayer(season, new RNG(1));
    expect(after.previousFullOverall).toBe(before);
  });

  it('a heavy-minutes prospect develops faster on average than a barely-played one, across many trials', () => {
    let heavyTotal = 0;
    let lightTotal = 0;
    const trials = 40;
    for (let seed = 0; seed < trials; seed++) {
      const heavy = youngProspect(3000);
      const light = youngProspect(0);
      const heavyBefore = calculateOverall(heavy);
      const lightBefore = calculateOverall(light);
      const heavyAfter = developOffseasonPlayer(heavy, new RNG(seed));
      const lightAfter = developOffseasonPlayer(light, new RNG(seed));
      heavyTotal += calculateOverall(heavyAfter) - heavyBefore;
      lightTotal += calculateOverall(lightAfter) - lightBefore;
    }
    expect(heavyTotal / trials).toBeGreaterThan(lightTotal / trials);
  });

  it('growth is chance-based: across many seeds, growth amounts vary (not a fixed constant every time)', () => {
    const growthAmounts = new Set<number>();
    for (let seed = 0; seed < 30; seed++) {
      const season = youngProspect(2200);
      const before = calculateOverall(season);
      const after = developOffseasonPlayer(season, new RNG(seed));
      growthAmounts.add(Math.round((calculateOverall(after) - before) * 10));
    }
    expect(growthAmounts.size).toBeGreaterThan(1);
  });

  it('growth is never negative for a player below peak age (a "quiet" season still holds steady or improves slightly)', () => {
    for (let seed = 0; seed < 20; seed++) {
      const season = youngProspect(500);
      const before = calculateOverall(season);
      const after = developOffseasonPlayer(season, new RNG(seed));
      expect(calculateOverall(after)).toBeGreaterThanOrEqual(before - 0.01);
    }
  });
});

describe('calculateFullAttributeOverall', () => {
  it('is a plain average of every rated attribute, independent of shot tendencies', () => {
    const seasonA = makeDefaultSeason('a', '2025-26', null, 25);
    const seasonB = { ...seasonA, tendencies: { ...seasonA.tendencies, shot: { ...seasonA.tendencies.shot, rim: seasonA.tendencies.shot.rim + 50 } } };
    expect(calculateFullAttributeOverall(seasonA)).toBe(calculateFullAttributeOverall(seasonB));
  });

  it('rises when any rated attribute (offense/defense/mental/physical skill) rises', () => {
    const season = makeDefaultSeason('b', '2025-26', null, 25);
    const before = calculateFullAttributeOverall(season);
    const boosted = { ...season, attributes: { ...season.attributes, offense: { ...season.attributes.offense, threePoint: 199 } } };
    expect(calculateFullAttributeOverall(boosted)).toBeGreaterThan(before);
  });
});
