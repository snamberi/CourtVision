// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { weekKey, weekEndsAt, weeklySeed, weeklyRebuild, weeklyCareer, recordWeekly, loadWeeklyRecords, weeklyStreak, TWISTS } from '../retention/weekly';
import { SCENARIOS } from '../simulation/rebuildChallenge';
import { unseenReleases, markReleasesSeen, RELEASES } from '../content/whatsNew';
import { clean } from '../analytics/track';
import { isLowEndDevice, liteMode } from '../lib/performanceMode';

beforeEach(() => localStorage.clear());

describe('weekly challenges', () => {
  it('weeks are ISO weeks in UTC, starting Monday', () => {
    expect(weekKey(new Date('2026-09-27T23:59:00Z'))).toBe('2026-W39'); // Sunday
    expect(weekKey(new Date('2026-09-28T00:00:00Z'))).toBe('2026-W40'); // Monday
    expect(weekKey(new Date('2021-01-03T12:00:00Z'))).toBe('2020-W53');
    expect(weekKey(new Date('2024-12-30T12:00:00Z'))).toBe('2025-W01');
    expect(weekEndsAt(new Date('2026-09-27T10:00:00Z'))).toBe(Date.parse('2026-09-28T00:00:00Z'));
    expect(weekEndsAt(new Date('2026-09-28T10:00:00Z'))).toBe(Date.parse('2026-10-05T00:00:00Z'));
  });

  it('the same week gives everyone the same challenge; weeks differ', () => {
    expect(weeklyRebuild('2026-W39')).toEqual(weeklyRebuild('2026-W39'));
    expect(weeklySeed('rebuild', '2026-W39')).not.toBe(weeklySeed('career', '2026-W39'));
    const weeks = Array.from({ length: 40 }, (_, i) => `2027-W${String(i + 1).padStart(2, '0')}`);
    const picks = weeks.map(w => weeklyRebuild(w));
    expect(new Set(picks.map(p => p.scenario.id)).size).toBeGreaterThan(8);
    expect(new Set(picks.map(p => p.twist.id)).size).toBe(TWISTS.length);
    for (const p of picks) {
      expect(SCENARIOS).toContain(p.scenario);
      expect(p.seasons).toBeGreaterThanOrEqual(3);
      expect(p.seasons).toBe(Math.max(3, p.scenario.seasons + p.twist.seasonsDelta));
    }
    const careers = weeks.map(w => weeklyCareer(w));
    expect(new Set(careers.map(c => c.draftYear)).size).toBeGreaterThan(5);
  });

  it('keeps the best result of each week, and counts the streak', () => {
    expect(recordWeekly('rebuild', '2026-W39', { best: 900, stars: 1, label: 'x' })).toBe(true);
    expect(recordWeekly('rebuild', '2026-W39', { best: 500, stars: 0, label: 'x' })).toBe(false);
    expect(loadWeeklyRecords()['2026-W39'].rebuild?.best).toBe(900);
    recordWeekly('career', '2026-W38', { best: 70, label: 'y' });
    expect(weeklyStreak(loadWeeklyRecords(), new Date('2026-09-25T00:00:00Z'))).toBe(2);
    expect(weeklyStreak(loadWeeklyRecords(), new Date('2026-10-01T00:00:00Z'))).toBe(2); // this week not played yet
    expect(weeklyStreak(loadWeeklyRecords(), new Date('2026-10-08T00:00:00Z'))).toBe(0);
  });
});

describe("what's new", () => {
  it('first-time visitors see nothing; returning players see the latest once', () => {
    expect(unseenReleases()).toEqual([]);
    localStorage.clear();
    localStorage.setItem('cv-rebuild-records', '{}');
    expect(unseenReleases()[0].id).toBe(RELEASES[0].id);
    markReleasesSeen();
    expect(unseenReleases()).toEqual([]);
    localStorage.setItem('courtvision:whatsNewSeen', '2000-01-01');
    expect(unseenReleases()).toHaveLength(RELEASES.length);
  });
  it('releases are newest first', () => {
    const ids = RELEASES.map(r => r.id);
    expect([...ids].sort().reverse()).toEqual(ids);
  });
});

describe('analytics and performance', () => {
  it('event data is short and plain: no free text or odd keys', () => {
    expect(clean({ mode: 'career', variant: 'John Smith <b>', n: 3.7, ok: true, BadKey: 'x', nested: {} as unknown as string })).toEqual({ mode: 'career', variant: 'JohnSmithb', n: 4, ok: true });
  });
  it('lite mode: auto on low-memory devices, or when chosen', () => {
    expect(isLowEndDevice({ deviceMemory: 2, hardwareConcurrency: 8 })).toBe(true);
    expect(isLowEndDevice({ deviceMemory: 8, hardwareConcurrency: 8 })).toBe(false);
    expect(isLowEndDevice({ hardwareConcurrency: 8, connection: { saveData: true } })).toBe(true);
    expect(liteMode('auto', { deviceMemory: 8, hardwareConcurrency: 8 })).toBe(false);
    expect(liteMode('lite', { deviceMemory: 8, hardwareConcurrency: 8 })).toBe(true);
    expect(liteMode('full', { deviceMemory: 1 })).toBe(false);
  });
});
