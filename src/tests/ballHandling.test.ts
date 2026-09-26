import { describe, it, expect } from 'vitest';
import { chooseBallHandler } from '../simulation/engine/ballHandler';
import { RNG } from '../simulation/engine/rng';
import { buildGamePlan } from '../simulation/engine/minutesScheduler';
import { heightOverallContribution } from '../simulation/engine/effective';

describe('ball handler selection', () => {
  it('a player with much higher ball-handler priority is chosen far more often', () => {
    const rng = new RNG(7);
    const candidates = [
      { playerId: 'star', priority: 95, fatigueLevel: 0, onCourt: true },
      { playerId: 'role1', priority: 10, fatigueLevel: 0, onCourt: true },
      { playerId: 'role2', priority: 10, fatigueLevel: 0, onCourt: true },
      { playerId: 'role3', priority: 5, fatigueLevel: 0, onCourt: true },
      { playerId: 'role4', priority: 5, fatigueLevel: 0, onCourt: true },
    ];
    const counts: Record<string, number> = {};
    for (let i = 0; i < 2000; i++) {
      const id = chooseBallHandler(candidates, rng);
      counts[id] = (counts[id] ?? 0) + 1;
    }
    expect(counts.star).toBeGreaterThan(1200); // star should dominate possessions when user sets priority this high
  });
});

describe('exact minutes scheduling', () => {
  it('a player with EXACT per-quarter minutes gets those quarters honored when possible', () => {
    const roster = [
      { playerId: 'p1', minutes: { mode: 'EXACT' as const, target: 36, perQuarter: [9, 9, 9, 9] as [number, number, number, number] } },
      { playerId: 'p2', minutes: { mode: 'AI' as const, target: 20 } },
      { playerId: 'p3', minutes: { mode: 'AI' as const, target: 20 } },
      { playerId: 'p4', minutes: { mode: 'AI' as const, target: 20 } },
      { playerId: 'p5', minutes: { mode: 'AI' as const, target: 20 } },
      { playerId: 'p6', minutes: { mode: 'AI' as const, target: 15 } },
    ];
    const plan = buildGamePlan(roster, 4, 12);
    for (const q of plan) {
      expect(q.onCourt).toContain('p1'); // p1 has EXACT minutes every quarter, must always be scheduled
    }
  });

  it('total scheduled quarters approximate target minutes reasonably for TARGET mode', () => {
    const roster = Array.from({ length: 8 }, (_, i) => ({
      playerId: `p${i}`,
      minutes: { mode: 'TARGET' as const, target: i < 5 ? 30 : 10 },
    }));
    const plan = buildGamePlan(roster, 4, 12);
    const quartersPlayed: Record<string, number> = {};
    for (const q of plan) for (const id of q.onCourt) quartersPlayed[id] = (quartersPlayed[id] ?? 0) + 1;
    // starters (target 30) should play noticeably more quarters than bench (target 10)
    const starterAvg = [0, 1, 2, 3, 4].reduce((s, i) => s + (quartersPlayed[`p${i}`] ?? 0), 0) / 5;
    const benchAvg = [5, 6, 7].reduce((s, i) => s + (quartersPlayed[`p${i}`] ?? 0), 0) / 3;
    expect(starterAvg).toBeGreaterThan(benchAvg);
  });
});

describe('height → overall contribution', () => {
  it('height never contributes more than +/-2 overall points', () => {
    expect(heightOverallContribution(90)).toBeLessThanOrEqual(2); // 7'6"
    expect(heightOverallContribution(60)).toBeGreaterThanOrEqual(-2); // 5'0"
  });

  it('a tall player is not automatically inflated to elite overall from height alone', () => {
    const contribution = heightOverallContribution(88); // 7'4"
    expect(contribution).toBeLessThan(3);
  });
});
