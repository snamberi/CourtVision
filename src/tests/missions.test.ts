// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { weekMissions, missionProgress, claimMission, readMissions, missionsXp, mergeMissions, missionTitles, MISSIONS_KEY, MISSIONS_PER_WEEK } from '../retention/missions';
import { noteWeekRun, noteWeekTime, WEEK_LOG_KEY } from '../retention/weekLog';
import { weekKey } from '../retention/week';
import { xpParts } from '../profile/profile';

beforeEach(() => { localStorage.removeItem(MISSIONS_KEY); localStorage.removeItem(WEEK_LOG_KEY); });

describe('weekly missions', () => {
  it('gives everyone the same five missions a week, with no mode twice', () => {
    for (const w of ['2026-W40', '2026-W41', '2027-W05']) {
      const a = weekMissions(w), b = weekMissions(w);
      expect(a.map(m => m.id)).toEqual(b.map(m => m.id));
      expect(a).toHaveLength(MISSIONS_PER_WEEK);
      expect(new Set(a.map(m => m.id)).size).toBe(MISSIONS_PER_WEEK);
      expect(a.filter(m => m.goal.kind === 'minutes')).toHaveLength(1);
    }
  });
  it('claims a finished mission once, and its XP counts toward the profile', () => {
    const now = new Date();
    const time = weekMissions(weekKey(now)).find(m => m.goal.kind === 'minutes')!;
    expect(claimMission(time.id, now)).toBe(0);
    noteWeekTime(100 * 60, now);
    expect(missionProgress(time, JSON.parse(localStorage.getItem(WEEK_LOG_KEY)!)[weekKey(now)]).done).toBe(true);
    expect(claimMission(time.id, now)).toBe(time.xp);
    expect(claimMission(time.id, now)).toBe(0);
    expect(missionsXp(readMissions())).toBe(time.xp);
    expect(xpParts().find(p => p.id === 'missions')!.xp).toBe(time.xp);
  });
  it('counts runs per mode', () => {
    const now = new Date();
    noteWeekRun('hunt', undefined, 'a', now); noteWeekRun('hunt', undefined, 'b', now);
    const e = JSON.parse(localStorage.getItem(WEEK_LOG_KEY)!)[weekKey(now)];
    expect(missionProgress({ id: 'x', label: '', xp: 1, goal: { kind: 'runs', mode: 'hunt', n: 3 } }, e)).toEqual({ have: 2, need: 3, done: false });
    expect(missionProgress({ id: 'y', label: '', xp: 1, goal: { kind: 'modes', n: 1 } }, e).done).toBe(true);
  });
  it('merges two devices and hands out titles', () => {
    const m = mergeMissions({ weeks: { '2026-W40': ['time-30'] } }, { weeks: { '2026-W40': ['any-5'], '2026-W41': ['time-90'] } });
    expect(m.weeks['2026-W40'].sort()).toEqual(['any-5', 'time-30']);
    expect(missionTitles(10)).toEqual(['Mission Runner']);
    expect(missionTitles(9)).toEqual([]);
  });
});
