// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { noteVisit, readStreak, mergeStreak, streakTrophies, STREAK_KEY } from '../retention/streak';
import { notePass, readPass, mergePass, passTrophies, PASS_KEY, PASS_TIER_XP, PASS_TIERS } from '../retention/pass';
import { mergeValue } from '../cloud/merge';
import { weeklyHunt, huntScore } from '../hunt/storage';
import { AVATAR_FRAMES, avatarFrameOpen } from '../profile/avatarFrames';
import { TROPHY_ROAD } from '../profile/trophyRoad';
import { LEVEL_ROAD } from '../profile/cosmetics';

const day = (d: string) => new Date(`${d}T12:00:00Z`);
beforeEach(() => { localStorage.removeItem(STREAK_KEY); localStorage.removeItem(PASS_KEY); });

describe('daily streak', () => {
  it('counts days in a row, restarts after a gap, and keeps the best', () => {
    expect(noteVisit(day('2026-10-01')).streak.current).toBe(1);
    expect(noteVisit(day('2026-10-01')).streak.current).toBe(1);
    noteVisit(day('2026-10-02'));
    const third = noteVisit(day('2026-10-03'));
    expect(third.streak.current).toBe(3);
    expect(third.reached.map(r => r.days)).toEqual([3]);
    const gap = noteVisit(day('2026-10-06'));
    expect(gap.streak).toEqual({ last: '2026-10-06', current: 1, best: 3 });
    expect(streakTrophies(readStreak())).toBe(500);
  });
  it('merges two devices: the later visit and the best of both', () => {
    expect(mergeStreak({ last: '2026-10-05', current: 2, best: 9 }, { last: '2026-10-06', current: 6, best: 6 })).toEqual({ last: '2026-10-06', current: 6, best: 9 });
  });
});

describe('season pass', () => {
  it('fills from the XP earned this month and keeps tiers reached', () => {
    expect(notePass(1000, day('2026-10-01')).tier).toBe(0);
    const p = notePass(1000 + PASS_TIER_XP * 10 + 20, day('2026-10-09'));
    expect(p.tier).toBe(10);
    expect(p.newTiers.map(t => t.tier)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(notePass(1000 + PASS_TIER_XP * 999, day('2026-10-20')).tier).toBe(PASS_TIERS);
    // A new month starts a fresh pass from where your XP is then.
    expect(notePass(1000 + PASS_TIER_XP * 999, day('2026-11-01')).tier).toBe(0);
    expect(passTrophies(readPass())).toBeGreaterThan(0);
  });
  it('merges two devices per month (earlier start, higher tier)', () => {
    expect(mergePass({ months: { '2026-10': { start: 500, tier: 3 } } }, { months: { '2026-10': { start: 400, tier: 2 }, '2026-09': { start: 0, tier: 30 } } }))
      .toEqual({ months: { '2026-09': { start: 0, tier: 30 }, '2026-10': { start: 400, tier: 3 } } });
  });
});

describe('cloud merge of the character', () => {
  it('a chosen character beats a random first one, and the newer choice wins', () => {
    const random = JSON.stringify({ skin: 's1', at: 0 }), chosen = JSON.stringify({ skin: 's5', at: 100 }), newer = JSON.stringify({ skin: 's7', at: 200 });
    expect(mergeValue('cv-avatar', random, chosen)).toBe(chosen);
    expect(mergeValue('cv-avatar', chosen, random)).toBe(chosen);
    expect(mergeValue('cv-avatar', chosen, newer)).toBe(newer);
  });
  it('keeps the best Weekly Hunt attempt from either device', () => {
    const a = JSON.stringify({ runs: 3, wins: 0, bestStop: 4, weekly: { '2026-W40': { won: false, stop: 4, wins: 18, losses: 12, tries: 2 } } });
    const b = JSON.stringify({ runs: 2, wins: 0, bestStop: 6, weekly: { '2026-W40': { won: false, stop: 6, wins: 26, losses: 14, tries: 1 } } });
    const m = JSON.parse(mergeValue('cv-hunt-records', a, b)!);
    expect(m.weekly['2026-W40']).toEqual({ won: false, stop: 6, wins: 26, losses: 14, tries: 2 });
  });
});

describe('weekly hunt and frames', () => {
  it('is the same hunt for everyone in a week, and different next week', () => {
    expect(weeklyHunt('2026-W40')).toEqual(weeklyHunt('2026-W40'));
    expect(weeklyHunt('2026-W40').seed).not.toBe(weeklyHunt('2026-W41').seed);
    expect(huntScore({ won: true, stop: 9, wins: 40, losses: 10 })).toBeGreaterThan(huntScore({ won: false, stop: 9, wins: 39, losses: 12 }));
  });
  it('has nine profile frames: three ranked, three on each road', () => {
    const frames = AVATAR_FRAMES.filter(f => f.id !== 'none');
    expect(frames).toHaveLength(9);
    expect(frames.filter(f => f.honors)).toHaveLength(3);
    expect(TROPHY_ROAD.filter(([, k]) => k === 'avatarFrame')).toHaveLength(3);
    expect(LEVEL_ROAD.filter(([, k]) => k === 'avatarFrame')).toHaveLength(3);
    const gold = AVATAR_FRAMES.find(f => f.id === 'goldCrown')!, bronze = AVATAR_FRAMES.find(f => f.id === 'bronzeCrest')!;
    expect(avatarFrameOpen(gold, { level: 1, trophies: 0, honors: ['ranked-2'] })).toBe(false);
    expect(avatarFrameOpen(bronze, { level: 1, trophies: 0, honors: ['ranked-1'] })).toBe(true);
  });
});
