// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { noteWeekTime, noteWeekRun, noteWeekRecords, readWeekLog, lastWeekKey, recapWorthy, recapLines } from '../retention/weekLog';
import { weekKey } from '../retention/week';
import { formatPlayTime } from '../retention/playTime';

beforeEach(() => localStorage.clear());

describe('Weekly recap', () => {
  it('logs the week: time, runs once each, the best of each mode and new records', () => {
    const now = new Date('2026-09-23T12:00:00Z'), wk = weekKey(now);
    noteWeekTime(3600, now); noteWeekTime(4200, now);
    noteWeekRun('hunt', { score: 700, line: 'series 8' }, 'hunt-1', now);
    noteWeekRun('hunt', { score: 1200, line: 'beat the boss, 40-12' }, 'hunt-2', now);
    noteWeekRun('hunt', { score: 1200, line: 'beat the boss, 40-12' }, 'hunt-2', now);
    noteWeekRun('career', { score: 88, line: 'Jay, Legacy 88.0' }, 'career-a', now);
    noteWeekRecords(2, now); noteWeekRecords(0, now);
    const e = readWeekLog()[wk];
    expect(e.runs).toEqual({ hunt: 2, career: 1 });
    expect(e.best.hunt?.score).toBe(1200);
    expect(recapLines(e, formatPlayTime)).toEqual(['2h 10m played', '2 League Hunts (best: beat the boss, 40-12)', '1 career (best: Jay, Legacy 88.0)', '2 new records in your record book']);
    expect(lastWeekKey(new Date('2026-09-30T12:00:00Z'))).toBe(wk);
    expect(recapWorthy(e)).toBe(true);
    expect(recapWorthy({ seconds: 100, runs: {}, best: {}, records: 0 })).toBe(false);
  });
  it('keeps only the last eight weeks', () => {
    for (let i = 0; i < 12; i++) noteWeekTime(60, new Date(Date.UTC(2026, 0, 5 + i * 7)));
    expect(Object.keys(readWeekLog())).toHaveLength(8);
  });
});
