import { describe, it, expect } from 'vitest';
import { BADGE_RULES, evaluateBadgeRule, badgeCapacity, type BadgeContext } from '../simulation/badgeRules';
import { NORMAL_BADGES } from '../simulation/badges';

const ctx = (over: Partial<BadgeContext['stats']> = {}, evidence: Partial<BadgeContext['evidence']> = {}, rating = 80): BadgeContext => ({
  ability: () => rating,
  stats: { minutes: 2000, gamesPlayed: 70, points: 1200, fga: 1000, fgm: 460, tpa: 300, tpm: 105, fta: 250, ast: 0, tov: 0, stl: 0, blk: 0, oreb: 0, dreb: 0, pf: 150, ...over },
  evidence: { games: 70, minutes: 2000, handling: 0, defensiveReps: 0, shots: {}, ...evidence },
  workload: 50, heightInches: 78,
});

describe('badge rules', () => {
  it('every normal badge has its own rule, and no two share the same bar', () => {
    for (const b of NORMAL_BADGES) expect(BADGE_RULES[b.id]).toBeDefined();
    const bars = NORMAL_BADGES.map(b => BADGE_RULES[b.id].text);
    expect(new Set(bars).size).toBe(bars.length);
  });

  it('a good passer earns the passing badges he has shown, not the whole category', () => {
    // 7.4 assists per 36 but only a 2.0 assist/turnover ratio: Dimer yes; Needle Threader and Floor General no.
    const passer = ctx({ ast: 410, tov: 205 }, { handling: 1500 });
    expect(evaluateBadgeRule('dimer', passer).eligible).toBe(true);
    expect(evaluateBadgeRule('needle_threader', passer).eligible).toBe(false);
    expect(evaluateBadgeRule('floor_general', passer).eligible).toBe(false);
    expect(evaluateBadgeRule('unpluckable', passer).eligible).toBe(false);
  });

  it('ratings below a badge\'s own bar keep it out of reach, whatever the stats', () => {
    const shooter = ctx({}, { shots: { corner3: { attempts: 120, makes: 55 } } }, 68);
    expect(evaluateBadgeRule('corner_specialist', shooter).eligible).toBe(false);
    expect(evaluateBadgeRule('corner_specialist', { ...shooter, ability: () => 72 }).eligible).toBe(true);
  });

  it('role players carry few badges and stars more', () => {
    expect(badgeCapacity(58)).toBe(1);
    expect(badgeCapacity(70)).toBe(3);
    expect(badgeCapacity(85)).toBe(6);
  });
});
