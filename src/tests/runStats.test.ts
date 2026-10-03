// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { addBox, addHighs, runMvp, pct, perGame } from '../hunt/statLines';
import { noteRunHighs, noteFinalsMvp, readRecordBook, mergeRecordBook } from '../retention/recordBook';
import { addPlayTime, readPlayTime, mergePlayTime, formatPlayTime, topArea } from '../retention/playTime';
import { mergeValue } from '../cloud/merge';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { newPerfectRun, pickPlayer, pickCoach, playNext, SQUAD } from '../perfect/run';
import type { PlayerStatLine } from '../simulation/boxscore';

beforeEach(() => localStorage.clear());
const line = (p: Partial<PlayerStatLine>): PlayerStatLine => ({ playerId: 'x', minutes: 30, points: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, ...p } as PlayerStatLine);

describe('Run stats', () => {
  it('adds box scores into per-player totals and keeps the best games', () => {
    let lines = addBox({}, { Jordan: line({ points: 40, fgm: 15, fga: 25, tpm: 2, tpa: 4, dreb: 6, ast: 5, stl: 3 }), Bench: line({ minutes: 0, points: 0 }) });
    lines = addBox(lines, { Jordan: line({ points: 30, fgm: 11, fga: 20, oreb: 1, dreb: 4, ast: 7, blk: 1 }) });
    expect(lines.Jordan).toMatchObject({ g: 2, pts: 70, reb: 11, ast: 12, min: 60, stl: 3, blk: 1, fgm: 26, fga: 45 });
    expect(lines.Bench).toBeUndefined();
    expect(pct(26, 45)).toBe('57.8');
    expect(perGame(70, 2)).toBe('35.0');
    // An old Hunt line (games, points, rebounds, assists only) keeps counting.
    expect(addBox({ Old: { g: 3, pts: 30, reb: 9, ast: 6 } }, { Old: line({ points: 10 }) }).Old).toMatchObject({ g: 4, pts: 40, min: 30 });
    const highs = addHighs(addHighs({}, { Jordan: line({ points: 40 }) }, 'Bulls'), { Bird: line({ points: 40, ast: 12 }) }, 'Lakers');
    expect(highs.pts).toEqual({ v: 40, name: 'Jordan', vs: 'Bulls' });
    expect(highs.ast?.name).toBe('Bird');
    expect(runMvp(lines)?.name).toBe('Jordan');
  });

  it('82-0 runs count player stats, regular season and playoffs apart', async () => {
    const h = await loadHistoryForTests();
    let r = newPerfectRun(h, 'quick', 21);
    while (r.stage === 'draft') r = pickPlayer(h, r);
    expect(r.squad).toHaveLength(SQUAD);
    if (r.stage === 'coach') r = pickCoach(h, r, r.coachOffer![0]);
    expect(r.stage).toBe('season');
    r = playNext(h, r, 3);
    const games = Object.values(r.lines ?? {}).reduce((m, l) => Math.max(m, l.g), 0);
    expect(games).toBe(3);
    expect(Object.values(r.lines ?? {}).every(l => (l.min ?? 0) > 0)).toBe(true);
    expect(r.highs?.pts?.v).toBeGreaterThan(0);
  });
});

describe('Record book', () => {
  it('keeps the best single game in each category and merges devices', () => {
    expect(noteRunHighs('hunt', { pts: { v: 50, name: 'A', vs: 'X' } }, 1)).toEqual(['pts']);
    expect(noteRunHighs('perfect', { pts: { v: 48, name: 'B', vs: 'Y' }, reb: { v: 20, name: 'C', vs: 'Z' } }, 2)).toEqual(['reb']);
    noteFinalsMvp({ name: 'B', record: '74-8', pts: 120, g: 4 }, 3);
    const book = readRecordBook();
    expect(book.highs.pts).toMatchObject({ v: 50, mode: 'hunt' });
    expect(book.finals).toHaveLength(1);
    const other = { highs: { pts: { v: 61, name: 'D', vs: 'W', mode: 'perfect' as const, at: 9 } }, finals: [{ name: 'E', record: '80-2', pts: 100, g: 4, at: 8 }] };
    const merged = mergeRecordBook(book, other);
    expect(merged.highs.pts?.v).toBe(61);
    expect(merged.highs.reb?.v).toBe(20);
    expect(merged.finals.map(f => f.name)).toEqual(['E', 'B']);
    expect(JSON.parse(mergeValue('cv-record-book', JSON.stringify(book), JSON.stringify(other))!).highs.pts.v).toBe(61);
  });
});

describe('Time played', () => {
  it('adds up by area, merges devices safely and reads well', () => {
    addPlayTime('career', 3600); addPlayTime('career', 1800); addPlayTime('hunt', 600); addPlayTime('menu', 9000);
    const t = readPlayTime();
    expect(t.total).toBe(15000);
    expect(topArea(t)).toBe('career');
    expect(formatPlayTime(t.total)).toBe('4h 10m');
    expect(formatPlayTime(30)).toBe('under a minute');
    const m = mergePlayTime(t, { total: 7200, areas: { hunt: 7200 } });
    expect(m.areas).toMatchObject({ career: 5400, hunt: 7200, menu: 9000 });
    expect(m.total).toBe(21600);
  });
});
