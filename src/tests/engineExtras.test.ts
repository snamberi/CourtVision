import { describe, it, expect } from 'vitest';
import { computeMatchups } from '../simulation/engine/matchups';
import { rollInjury } from '../simulation/engine/injuries';
import { RNG } from '../simulation/engine/rng';
import { calculateOverall } from '../simulation/engine/overall';
import { developOffseasonPlayer } from '../simulation/engine/development';
import { generateSeasonSchedule } from '../simulation/league';
import { buildDemoTeam, makeDefaultSeason } from '../simulation/presets/samplePlayers';
import { simulateGame } from '../simulation/engine/game';
import { DEFAULT_GAME_SETTINGS } from '../simulation/types';

describe('position-weighted matchups', () => {
  it('assigns a center-type defender to a center-type offensive player, not by lineup index alone', () => {
    const offense = [
      { playerId: 'pg', positions: { PG: 100, SG: 20, SF: 0, PF: 0, C: 0 } },
      { playerId: 'c', positions: { PG: 0, SG: 0, SF: 10, PF: 60, C: 100 } },
    ];
    const defense = [
      { playerId: 'bigDef', positions: { PG: 0, SG: 0, SF: 10, PF: 70, C: 100 } },
      { playerId: 'guardDef', positions: { PG: 95, SG: 30, SF: 0, PF: 0, C: 0 } },
    ];
    const matchups = computeMatchups(offense, defense);
    expect(defense[matchups[0]].playerId).toBe('guardDef');
    expect(defense[matchups[1]].playerId).toBe('bigDef');
  });

  it('never assigns the same defender to two offensive players', () => {
    const offense = Array.from({ length: 5 }, (_, i) => ({ playerId: `o${i}`, positions: { PG: 20, SG: 20, SF: 20, PF: 20, C: 20 } }));
    const defense = Array.from({ length: 5 }, (_, i) => ({ playerId: `d${i}`, positions: { PG: 20, SG: 20, SF: 20, PF: 20, C: 20 } }));
    const matchups = computeMatchups(offense, defense);
    expect(new Set(matchups).size).toBe(5);
  });
});

describe('injuries', () => {
  it('No Injury flag makes injury probability zero regardless of fatigue/durability', () => {
    const rng = new RNG(1);
    const outcome = rollInjury(1.0, 10, 99, 5, { noInjury: true } as any, rng);
    expect(outcome.occurred).toBe(false);
  });

  it('higher fatigue and lower durability meaningfully increase injury frequency over many trials', () => {
    const rngLowRisk = new RNG(5);
    const rngHighRisk = new RNG(5);
    let lowRiskCount = 0, highRiskCount = 0;
    const trials = 20000;
    for (let i = 0; i < trials; i++) {
      if (rollInjury(0.05, 90, 10, 1, {} as any, rngLowRisk).occurred) lowRiskCount++;
      if (rollInjury(0.95, 30, 90, 1, {} as any, rngHighRisk).occurred) highRiskCount++;
    }
    expect(highRiskCount).toBeGreaterThan(lowRiskCount);
  });
});

describe('overall rating', () => {
  it('manual overall mode returns exactly the manual value', () => {
    const season = buildDemoTeam('T', 'Team').seasons[0];
    season.overall = { mode: 'MANUAL', manualOverall: 88 };
    expect(calculateOverall(season)).toBe(88);
  });

  it('a higher-rated player produces a higher computed overall than a lower-rated one', () => {
    const elite = makeDefaultSeason('elite', '2025-26');
    const poor = makeDefaultSeason('poor', '2025-26');
    for (const k of Object.keys(elite.attributes.offense) as (keyof typeof elite.attributes.offense)[]) elite.attributes.offense[k] = 95;
    for (const k of Object.keys(poor.attributes.offense) as (keyof typeof poor.attributes.offense)[]) poor.attributes.offense[k] = 40;
    expect(calculateOverall(elite)).toBeGreaterThan(calculateOverall(poor));
  });
});

describe('offseason development / aging', () => {
  it('a young player below peak age with high potential improves in overall', () => {
    const season = makeDefaultSeason('young', '2025-26', null, 20);
    season.development = { potential: 95, developmentRate: 90, developmentVariance: 5, peakAge: 27, declineRate: 40, injuryRisk: 20, workEthic: 80 };
    const rng = new RNG(1);
    const before = calculateOverall(season);
    const after = developOffseasonPlayer(season, rng);
    expect(after.age).toBe(21);
    expect(after.previousOverall).toBe(before);
    expect(calculateOverall(after)).toBeGreaterThanOrEqual(before);
  });

  it('an old player at/past peak age declines in overall', () => {
    const season = makeDefaultSeason('veteran', '2025-26', null, 36);
    season.development = { potential: 70, developmentRate: 20, developmentVariance: 5, peakAge: 27, declineRate: 70, injuryRisk: 40, workEthic: 50 };
    for (const k of Object.keys(season.attributes.offense) as (keyof typeof season.attributes.offense)[]) season.attributes.offense[k] = 80;
    const rng = new RNG(2);
    const before = calculateOverall(season);
    const after = developOffseasonPlayer(season, rng);
    expect(calculateOverall(after)).toBeLessThanOrEqual(before);
  });

  it('never mutates the original season object', () => {
    const season = makeDefaultSeason('p', '2025-26', null, 25);
    const originalThree = season.attributes.offense.threePoint;
    developOffseasonPlayer(season, new RNG(3));
    expect(season.attributes.offense.threePoint).toBe(originalThree);
  });
});

describe('82-game season schedule', () => {
  it('every one of 30 teams gets exactly 82 games scheduled', () => {
    const teamIds = Array.from({ length: 30 }, (_, i) => `T${i}`);
    const schedule = generateSeasonSchedule(teamIds, 82);
    const counts: Record<string, number> = {};
    for (const g of schedule) {
      counts[g.homeTeamId] = (counts[g.homeTeamId] ?? 0) + 1;
      counts[g.awayTeamId] = (counts[g.awayTeamId] ?? 0) + 1;
    }
    for (const id of teamIds) expect(counts[id]).toBe(82);
    expect(schedule.length).toBe((30 * 82) / 2);
  });
});

describe('matchups + coach tendencies wired into a real game', () => {
  it('a full game still runs end to end with matchups and default coach tendencies', () => {
    const home = buildDemoTeam('HOME', 'Home');
    const away = buildDemoTeam('AWAY', 'Away');
    const result = simulateGame({ home, away, settings: { ...DEFAULT_GAME_SETTINGS, seed: 21 } });
    expect(result.homeScore).toBeGreaterThan(0);
    expect(result.injuries).toEqual([]);
  });

  it('a higher combined coach pace tendency produces more possessions than a low-pace matchup', () => {
    const home = buildDemoTeam('HOME', 'Home');
    const away = buildDemoTeam('AWAY', 'Away');
    const fastCoach = { paceTendency: 95, threePointFrequency: 50, starUsage: 50, benchUsage: 50, defensiveAggression: 50, doubleTeamFrequency: 20, switchingFrequency: 40, zoneFrequency: 10, pnrFrequency: 50, postFrequency: 30 };
    const slowCoach = { ...fastCoach, paceTendency: 5 };
    const fastResult = simulateGame({ home: { ...home, coach: fastCoach }, away: { ...away, coach: fastCoach }, settings: { ...DEFAULT_GAME_SETTINGS, seed: 30 } });
    const slowResult = simulateGame({ home: { ...home, coach: slowCoach }, away: { ...away, coach: slowCoach }, settings: { ...DEFAULT_GAME_SETTINGS, seed: 30 } });
    expect(fastResult.possessionLog.length).toBeGreaterThan(slowResult.possessionLog.length);
  });

  it('enabling injuries can produce an injury over enough simulated games with a high-risk, low-durability roster', () => {
    const home = buildDemoTeam('HOME', 'Home');
    for (const s of home.seasons) {
      s.attributes.physical.durability = 5;
      s.development.injuryRisk = 95;
    }
    const away = buildDemoTeam('AWAY', 'Away');
    let anyInjury = false;
    for (let seed = 0; seed < 30 && !anyInjury; seed++) {
      const result = simulateGame({ home, away, settings: { ...DEFAULT_GAME_SETTINGS, seed, injuriesEnabled: true, injuryFrequencyMultiplier: 20 } });
      if (result.injuries.length > 0) anyInjury = true;
    }
    expect(anyInjury).toBe(true);
  });
});
