import { computeMakeProbability } from '../simulation/engine/shot';
import { computeRuleMods } from '../simulation/engine/ruleMods';
import type { AggregatedFlags } from '../simulation/engine/effective';
import { describe, it, expect } from 'vitest';
import { simulateGame } from '../simulation/engine/game';
import { buildDemoTeam, makeGenericStarter } from '../simulation/presets/samplePlayers';
import { DEFAULT_GAME_SETTINGS } from '../simulation/types';
import { DEFAULT_LEAGUE_RULES } from '../simulation/leagueRules';

function withBench(team: ReturnType<typeof buildDemoTeam>) {
  return {
    ...team,
    seasons: [
      ...team.seasons,
      makeGenericStarter(`${team.teamId}-bench1`, team.teamId),
      makeGenericStarter(`${team.teamId}-bench2`, team.teamId),
      makeGenericStarter(`${team.teamId}-bench3`, team.teamId),
    ],
  };
}

/** Aggregates a stat across several seeded games under a given rules setting. */
function aggregate(rules: typeof DEFAULT_LEAGUE_RULES, pick: (r: ReturnType<typeof simulateGame>) => number, seeds = 12): number {
  const home = withBench(buildDemoTeam('HOME', 'Home'));
  const away = withBench(buildDemoTeam('AWAY', 'Away'));
  let total = 0;
  for (let seed = 0; seed < seeds; seed++) {
    const result = simulateGame({ home, away, settings: { ...DEFAULT_GAME_SETTINGS, seed }, rules });
    total += pick(result);
  }
  return total;
}

function totalThrees(r: ReturnType<typeof simulateGame>): number {
  const sumTpa = (box: ReturnType<typeof simulateGame>['homeBox']) => Object.values(box.players).reduce((s, p) => s + p.tpm, 0);
  return sumTpa(r.homeBox) + sumTpa(r.awayBox);
}
function totalPoints(r: ReturnType<typeof simulateGame>): number {
  return r.homeScore + r.awayScore;
}
function totalSteals(r: ReturnType<typeof simulateGame>): number {
  const sum = (box: ReturnType<typeof simulateGame>['homeBox']) => Object.values(box.players).reduce((s, p) => s + p.stl, 0);
  return sum(r.homeBox) + sum(r.awayBox);
}
function totalBlocks(r: ReturnType<typeof simulateGame>): number {
  const sum = (box: ReturnType<typeof simulateGame>['homeBox']) => Object.values(box.players).reduce((s, p) => s + p.blk, 0);
  return sum(r.homeBox) + sum(r.awayBox);
}
function totalOreb(r: ReturnType<typeof simulateGame>): number {
  const sum = (box: ReturnType<typeof simulateGame>['homeBox']) => Object.values(box.players).reduce((s, p) => s + p.oreb, 0);
  return sum(r.homeBox) + sum(r.awayBox);
}
function totalAssists(r: ReturnType<typeof simulateGame>): number {
  const sum = (box: ReturnType<typeof simulateGame>['homeBox']) => Object.values(box.players).reduce((s, p) => s + p.ast, 0);
  return sum(r.homeBox) + sum(r.awayBox);
}
function totalPossessions(r: ReturnType<typeof simulateGame>): number {
  return r.possessionLog.length;
}

describe('League Rules -> live game engine wiring', () => {
  it('a game simulated with no rules produces identical output to the same game with default (100) rules', () => {
    const home = withBench(buildDemoTeam('HOME', 'Home'));
    const away = withBench(buildDemoTeam('AWAY', 'Away'));
    const withoutRules = simulateGame({ home, away, settings: { ...DEFAULT_GAME_SETTINGS, seed: 5 } });
    const withDefaultRules = simulateGame({ home, away, settings: { ...DEFAULT_GAME_SETTINGS, seed: 5 }, rules: DEFAULT_LEAGUE_RULES });
    expect(withDefaultRules.homeScore).toBe(withoutRules.homeScore);
    expect(withDefaultRules.awayScore).toBe(withoutRules.awayScore);
  });

  it('raising threePointDifficulty lowers made threes league-wide', () => {
    const easy = aggregate({ ...DEFAULT_LEAGUE_RULES, threePointDifficulty: 40 }, totalThrees);
    const hard = aggregate({ ...DEFAULT_LEAGUE_RULES, threePointDifficulty: 220 }, totalThrees);
    expect(easy).toBeGreaterThan(hard);
  });

  it('offensiveEfficiency up and defensiveEfficiency up move total scoring in opposite directions', () => {
    const offenseBoosted = aggregate({ ...DEFAULT_LEAGUE_RULES, offensiveEfficiency: 160 }, totalPoints);
    const defenseBoosted = aggregate({ ...DEFAULT_LEAGUE_RULES, defensiveEfficiency: 160 }, totalPoints);
    const baseline = aggregate(DEFAULT_LEAGUE_RULES, totalPoints);
    expect(offenseBoosted).toBeGreaterThan(baseline);
    expect(defenseBoosted).toBeLessThan(baseline);
  });

  it('stealFrequency and stealSuccess raise total steals', () => {
    const low = aggregate({ ...DEFAULT_LEAGUE_RULES, stealFrequency: 30, stealSuccess: 30 }, totalSteals);
    const high = aggregate({ ...DEFAULT_LEAGUE_RULES, stealFrequency: 250, stealSuccess: 250 }, totalSteals);
    expect(high).toBeGreaterThan(low);
  });

  it('blockFrequency and blockSuccess raise total blocks', () => {
    const low = aggregate({ ...DEFAULT_LEAGUE_RULES, blockFrequency: 20, blockSuccess: 20 }, totalBlocks);
    const high = aggregate({ ...DEFAULT_LEAGUE_RULES, blockFrequency: 300, blockSuccess: 300 }, totalBlocks);
    expect(high).toBeGreaterThan(low);
  });

  it('offensiveReboundFrequency raises total offensive rebounds', () => {
    const low = aggregate({ ...DEFAULT_LEAGUE_RULES, offensiveReboundFrequency: 20 }, totalOreb);
    const high = aggregate({ ...DEFAULT_LEAGUE_RULES, offensiveReboundFrequency: 300 }, totalOreb);
    expect(high).toBeGreaterThan(low);
  });

  it('assistFrequency raises total assists', () => {
    const low = aggregate({ ...DEFAULT_LEAGUE_RULES, assistFrequency: 30 }, totalAssists);
    const high = aggregate({ ...DEFAULT_LEAGUE_RULES, assistFrequency: 180 }, totalAssists);
    expect(high).toBeGreaterThan(low);
  });

  it('possessionsPerGame raises the number of possessions actually simulated', () => {
    const slow = aggregate({ ...DEFAULT_LEAGUE_RULES, possessionsPerGame: 60 }, totalPossessions, 4);
    const fast = aggregate({ ...DEFAULT_LEAGUE_RULES, possessionsPerGame: 160 }, totalPossessions, 4);
    expect(fast).toBeGreaterThan(slow);
  });

  it('dunkSuccessRate and layupDifficulty move rim-finishing shot types in opposite directions', () => {
    // Compare identical dunk opportunities: whole-game totals also change rebounds, pace and shot mix.
    const shooter = makeGenericStarter('dunker', 'HOME');
    const probability = (success: number) => computeMakeProbability(shooter.attributes, { type: 'dunk', contest: 'heavy', fatigueLevel: 0, isClutch: false, isPlayoffs: false, shootingVariance: 0, ruleMods: computeRuleMods({ ...DEFAULT_LEAGUE_RULES, dunkSuccessRate: success }).shot }, {} as AggregatedFlags, .5);
    const hardLayups = aggregate({ ...DEFAULT_LEAGUE_RULES, layupDifficulty: 220 }, totalPoints);
    const baseline = aggregate(DEFAULT_LEAGUE_RULES, totalPoints);
    expect(probability(200)).toBeGreaterThan(probability(DEFAULT_LEAGUE_RULES.dunkSuccessRate));
    expect(hardLayups).toBeLessThan(baseline);
  });
});
