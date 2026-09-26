import { describe, it, expect } from 'vitest';
import { generateFullLeague, generatePlayer } from '../simulation/leagueGenerator';
import { RNG } from '../simulation/engine/rng';
import { calculateOverall } from '../simulation/engine/overall';
import { developOffseasonPlayer } from '../simulation/engine/development';
import { ARCHETYPES, pickArchetype } from '../simulation/archetypes';
import { generatePlayerOrigin } from '../simulation/names';
import { expenseAnnualCost, expenseEffects, defaultExpenseLevels } from '../simulation/league';

describe('archetype-driven player generation', () => {
  it('produces a real spread of distinct builds across a full league', () => {
    const { league } = generateFullLeague(3, 30, 15, 5);
    const all = league.teams.flatMap((t) => t.seasons);
    const builds = new Set(all.map((p) => p.archetype));
    // A 450-player league should surface most of the archetype catalogue, not one or two shapes.
    expect(builds.size).toBeGreaterThanOrEqual(Math.floor(ARCHETYPES.length * 0.75));
    expect(all.every((p) => !!p.archetypeLabel)).toBe(true);
  });

  it('gives builds genuine strengths and weaknesses rather than flat stat blocks', () => {
    const { league } = generateFullLeague(3, 30, 15, 5);
    const all = league.teams.flatMap((t) => t.seasons);
    const rimProtectors = all.filter((p) => p.archetype === 'rimProtector');
    const sharpshooters = all.filter((p) => p.archetype === 'sharpshooter');
    expect(rimProtectors.length).toBeGreaterThan(0);
    expect(sharpshooters.length).toBeGreaterThan(0);

    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const rimThree = avg(rimProtectors.map((p) => p.attributes.offense.aboveBreak3));
    const sharpThree = avg(sharpshooters.map((p) => p.attributes.offense.aboveBreak3));
    const rimBlock = avg(rimProtectors.map((p) => p.attributes.defense.block));
    const sharpBlock = avg(sharpshooters.map((p) => p.attributes.defense.block));

    expect(sharpThree).toBeGreaterThan(rimThree + 10); // shooters really shoot
    expect(rimBlock).toBeGreaterThan(sharpBlock + 10); // rim protectors really protect
  });

  it('produces a believable talent curve — scarce stars, a thick middle', () => {
    const { league } = generateFullLeague(3, 30, 15, 5);
    const ovrs = league.teams.flatMap((t) => t.seasons).map(calculateOverall).sort((a, b) => b - a);
    expect(ovrs[0]).toBeGreaterThanOrEqual(80); // the league has genuine stars
    const median = ovrs[Math.floor(ovrs.length / 2)];
    expect(median).toBeGreaterThan(40);
    expect(median).toBeLessThan(65); // ...but most players are not stars
  });

  it('generates identity — nationality, and a college for most American players', () => {
    const { league } = generateFullLeague(5, 10, 15, 5);
    const all = league.teams.flatMap((t) => t.seasons);
    expect(all.every((p) => !!p.nationality)).toBe(true);
    expect(new Set(all.map((p) => p.nationality)).size).toBeGreaterThan(1); // international players exist
    const americans = all.filter((p) => p.nationality === 'USA');
    const withCollege = americans.filter((p) => !!p.college);
    expect(withCollege.length / americans.length).toBeGreaterThan(0.8);
  });

  it('never produces duplicate names within one league', () => {
    const { league } = generateFullLeague(9, 30, 15, 5);
    const names = league.teams.flatMap((t) => t.seasons).map((p) => p.playerId);
    expect(new Set(names).size).toBe(names.length);
  });

  it('pickArchetype always returns a valid archetype across the whole roll range', () => {
    for (let i = 0; i <= 100; i++) {
      const a = pickArchetype(i / 100);
      expect(ARCHETYPES.some((x) => x.key === a.key)).toBe(true);
    }
  });

  it('generatePlayerOrigin yields nationality-appropriate names without repeats', () => {
    const rng = new RNG(12);
    const used = new Set<string>();
    const origins = Array.from({ length: 200 }, () => generatePlayerOrigin(rng, used));
    expect(new Set(origins.map((o) => o.name)).size).toBe(200);
    expect(origins.every((o) => !!o.nationality)).toBe(true);
  });
});

describe('development: prime window, growth ceiling, decline', () => {
  function youngPlayer(seed: number, age = 21) {
    const rng = new RNG(seed);
    return generatePlayer(`P${seed}`, '2026-27', 'A', age, seed, rng);
  }

  it('a heavy-minutes young player can occasionally jump close to +10 overall in one season', () => {
    const rng = new RNG(99);
    let best = 0;
    for (let i = 0; i < 300; i++) {
      const p = youngPlayer(i, 20);
      // Give them a big potential gap and a full workload — the best case for a leap.
      const primed = {
        ...p,
        development: { ...p.development, potential: Math.min(99, calculateOverall(p) + 30) },
        seasonStats: { ...p.seasonStats!, minutes: 2400, gamesPlayed: 80 },
      };
      const after = developOffseasonPlayer(primed as any, rng);
      best = Math.max(best, calculateOverall(after) - calculateOverall(primed as any));
    }
    expect(best).toBeGreaterThanOrEqual(6); // big leaps are possible...
    expect(best).toBeLessThanOrEqual(11);   // ...but capped, so nothing absurd
  });

  it('most seasons are modest, so huge jumps stay rare', () => {
    const rng = new RNG(4);
    const jumps: number[] = [];
    for (let i = 0; i < 200; i++) {
      const p = youngPlayer(i + 500, 21);
      const primed = { ...p, seasonStats: { ...p.seasonStats!, minutes: 2200, gamesPlayed: 75 } };
      jumps.push(calculateOverall(developOffseasonPlayer(primed as any, rng)) - calculateOverall(primed as any));
    }
    const bigJumps = jumps.filter((j) => j >= 6).length;
    expect(bigJumps / jumps.length).toBeLessThan(0.25); // leaps are the exception
  });

  it('a player past their prime declines rather than grows', () => {
    const rng = new RNG(21);
    let declined = 0;
    for (let i = 0; i < 60; i++) {
      const p = youngPlayer(i + 900, 36); // well past any generated prime window
      const after = developOffseasonPlayer(p, rng);
      if (calculateOverall(after) < calculateOverall(p)) declined++;
    }
    expect(declined).toBeGreaterThan(45);
  });

  it('a season lost to injury develops a young player less than a full healthy season', () => {
    const rng = new RNG(31);
    let healthyTotal = 0;
    let injuredTotal = 0;
    for (let i = 0; i < 120; i++) {
      const p = youngPlayer(i + 1300, 21);
      const primed = { ...p, development: { ...p.development, potential: Math.min(99, calculateOverall(p) + 25) } };
      const healthy = { ...primed, seasonStats: { ...p.seasonStats!, minutes: 2400, gamesPlayed: 80 } };
      const injured = { ...primed, seasonStats: { ...p.seasonStats!, minutes: 300, gamesPlayed: 10 } };
      healthyTotal += calculateOverall(developOffseasonPlayer(healthy as any, rng)) - calculateOverall(healthy as any);
      injuredTotal += calculateOverall(developOffseasonPlayer(injured as any, rng)) - calculateOverall(injured as any);
    }
    expect(healthyTotal).toBeGreaterThan(injuredTotal);
  });

  it('a breakout can raise a player\'s potential, so the ceiling is a projection not a hard cap', () => {
    const rng = new RNG(77);
    let raised = 0;
    for (let i = 0; i < 300; i++) {
      const p = youngPlayer(i + 2000, 20);
      // Start them right at their ceiling so any increase must come from the potential-raise path.
      const atCeiling = {
        ...p,
        development: { ...p.development, potential: calculateOverall(p) },
        seasonStats: { ...p.seasonStats!, minutes: 2400, gamesPlayed: 80 },
      };
      const after = developOffseasonPlayer(atCeiling as any, rng);
      if (after.development.potential > atCeiling.development.potential) raised++;
    }
    expect(raised).toBeGreaterThan(0);
  });
});

describe('team expense levels', () => {
  it('costs more at higher levels', () => {
    expect(expenseAnnualCost(100)).toBeGreaterThan(expenseAnnualCost(0));
  });

  it('a well-funded health staff shortens injuries and a poor one lengthens them', () => {
    const good = expenseEffects({ ...defaultExpenseLevels(), health: 100 });
    const bad = expenseEffects({ ...defaultExpenseLevels(), health: 0 });
    expect(good.injuryDurationMultiplier).toBeLessThan(1);
    expect(bad.injuryDurationMultiplier).toBeGreaterThan(1);
  });

  it('a well-funded coaching staff speeds development', () => {
    const good = expenseEffects({ ...defaultExpenseLevels(), coaching: 100 });
    const bad = expenseEffects({ ...defaultExpenseLevels(), coaching: 0 });
    expect(good.developmentMultiplier).toBeGreaterThan(bad.developmentMultiplier);
  });

  it('default levels are exactly neutral, so an untouched team behaves as before', () => {
    const e = expenseEffects(defaultExpenseLevels());
    expect(e.developmentMultiplier).toBeCloseTo(1, 6);
    expect(e.injuryDurationMultiplier).toBeCloseTo(1, 6);
    expect(e.moodBonus).toBeCloseTo(0, 6);
  });
});
