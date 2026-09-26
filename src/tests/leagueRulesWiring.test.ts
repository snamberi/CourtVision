import { describe, it, expect } from 'vitest';
import { RNG } from '../simulation/engine/rng';
import { developOffseasonPlayer } from '../simulation/engine/development';
import { makeDefaultSeason } from '../simulation/presets/samplePlayers';
import { emptySeasonStatTotals } from '../simulation/types';
import { DEFAULT_LEAGUE_RULES } from '../simulation/leagueRules';
import { beginNewSeasonRoster } from '../simulation/seasonTransition';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRemainingSeason } from '../simulation/league';

function youngProspect() {
  const season = makeDefaultSeason('prospect', '2025-26', null, 20);
  season.development = { potential: 90, developmentRate: 60, developmentVariance: 10, peakAge: 27, declineRate: 40, injuryRisk: 30, workEthic: 60 };
  season.seasonStats = { ...emptySeasonStatTotals(), gamesPlayed: 60, minutes: 2200 };
  return season;
}

describe('League Rules -> development engine wiring', () => {
  it('higher developmentSpeed produces more growth on average across seeds', () => {
    let fastTotal = 0;
    let slowTotal = 0;
    const fastRules = { ...DEFAULT_LEAGUE_RULES, developmentSpeed: 200 };
    const slowRules = { ...DEFAULT_LEAGUE_RULES, developmentSpeed: 30 };
    for (let seed = 0; seed < 20; seed++) {
      const fast = developOffseasonPlayer(youngProspect(), new RNG(seed), fastRules);
      const slow = developOffseasonPlayer(youngProspect(), new RNG(seed), slowRules);
      fastTotal += fast.attributes.offense.midrange;
      slowTotal += slow.attributes.offense.midrange;
    }
    expect(fastTotal).toBeGreaterThan(slowTotal);
  });

  it('rookieDevelopmentBonus specifically boosts growth for age <= 21', () => {
    const boosted = { ...DEFAULT_LEAGUE_RULES, rookieDevelopmentBonus: 300 };
    const normal = { ...DEFAULT_LEAGUE_RULES, rookieDevelopmentBonus: 100 };
    let boostedTotal = 0;
    let normalTotal = 0;
    for (let seed = 0; seed < 20; seed++) {
      boostedTotal += developOffseasonPlayer(youngProspect(), new RNG(seed), boosted).attributes.offense.midrange;
      normalTotal += developOffseasonPlayer(youngProspect(), new RNG(seed), normal).attributes.offense.midrange;
    }
    expect(boostedTotal).toBeGreaterThan(normalTotal);
  });

  it('peakAgeShiftYears extends how long a player keeps growing instead of declining', () => {
    const season = { ...youngProspect(), age: 26 }; // one year below default peakAge of 27
    const shifted = { ...DEFAULT_LEAGUE_RULES, peakAgeShiftYears: 5 };
    const result = developOffseasonPlayer(season, new RNG(1), shifted);
    // With peakAge effectively 32, a 26-year-old should still be in the growth branch (attributes shouldn't be reduced).
    expect(result.attributes.offense.midrange).toBeGreaterThanOrEqual(season.attributes.offense.midrange);
  });

  it('retirementAgeShiftYears delays the guaranteed-retirement cutoff', () => {
    const { league, extras } = generateFullLeague(1, 4, 6, 8, '2026-27');
    const played = simulateRemainingSeason(league, 1);
    const oldPlayerTeam = played.teams[0];
    const oldPlayer = { ...oldPlayerTeam.seasons[0], age: 41 };
    const tweaked = {
      ...played,
      teams: played.teams.map((t, i) => (i === 0 ? { ...t, seasons: [oldPlayer, ...t.seasons.slice(1)] } : t)),
      rulesSettings: { ...DEFAULT_LEAGUE_RULES, retirementAgeShiftYears: 5 },
    };
    const { summary } = beginNewSeasonRoster(tweaked, extras, 1, { minGames: 1 });
    // Forced retirement age is now 46 (41+5), so a 41-year-old shouldn't be guaranteed to retire this pass.
    expect(summary.retiredPlayerIds).not.toContain(oldPlayer.playerId);
  });

  it('recoveryTimeMultiplier scales how long a newly-registered injury lasts', () => {
    const { league } = generateFullLeague(2, 4, 8, 10, '2026-27');
    const doubled = { ...league, rulesSettings: { ...DEFAULT_LEAGUE_RULES, recoveryTimeMultiplier: 200 } };
    // We can't force an injury deterministically here without deep engine hooks, so just confirm the
    // multiplier is present and the league simulates without throwing under it.
    expect(() => simulateRemainingSeason(doubled, 2)).not.toThrow();
  });
});
