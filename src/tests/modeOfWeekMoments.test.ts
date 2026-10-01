// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { modeOfWeek, noteFeaturedXp, readBonusLog, bonusXp, mergeBonusLog, FEATURED_ROTATION, WEEKLY_BONUS_CAP, BONUS_XP_KEY } from '../retention/modeOfWeek';
import { weekKey } from '../retention/week';
import { xpParts } from '../profile/profile';
import { mergeValue } from '../cloud/merge';
import { huntProgress, perfectProgress, careerProgress } from '../menu/inProgress';
import { seasonMoment, applyMomentChoice, storyLegacy } from '../career/bigMoments';
import type { CareerYear } from '../career/career';
import { startProgress, MAX_PROGRESS } from '../career/create';
import { emptyResume, legacyScore } from '../career/legacy';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { newPerfectFromHunt, pickPlayer, SQUAD } from '../perfect/run';
import { cardPool } from '../hunt/cards';

beforeEach(() => localStorage.clear());

describe('Mode of the Week', () => {
  it('rotates through every featured mode, one a week', () => {
    const weeks = Array.from({ length: 8 }, (_, i) => modeOfWeek(`2026-W${String(40 + i).padStart(2, '0')}`));
    expect(new Set(weeks)).toEqual(new Set(FEATURED_ROTATION));
    expect(weeks[0]).not.toBe(weeks[1]);
  });

  it('doubles a finished run only in the featured mode, once per run, capped per week', () => {
    const now = new Date();
    const featured = modeOfWeek(weekKey(now));
    const other = FEATURED_ROTATION.find(m => m !== featured)!;
    expect(noteFeaturedXp(other, 'x-1', 500, now)).toBe(0);
    expect(noteFeaturedXp(featured, 'run-1', 500, now)).toBe(500);
    expect(noteFeaturedXp(featured, 'run-1', 500, now)).toBe(0);
    for (let i = 2; i < 12; i++) noteFeaturedXp(featured, `run-${i}`, 500, now);
    expect(bonusXp(readBonusLog())).toEqual({ xp: WEEKLY_BONUS_CAP, runs: 11 });
    expect(xpParts().find(p => p.id === 'bonus')?.xp).toBe(WEEKLY_BONUS_CAP);
    const merged = mergeBonusLog(readBonusLog(), { other: { xp: 10, week: '2026-W01', mode: 'career' } });
    expect(Object.keys(merged)).toContain('other');
    expect(JSON.parse(mergeValue(BONUS_XP_KEY, JSON.stringify(readBonusLog()), JSON.stringify({ c: { xp: 1, week: '2026-W02', mode: 'rebuild' } }))!).c).toBeTruthy();
  });
});

describe('Continue chips', () => {
  it('describe a run in progress and stay quiet for finished ones', () => {
    expect(huntProgress({ version: 3, stage: 'series', seriesIndex: 5 })).toBe('Series 6 of 10');
    expect(huntProgress({ version: 3, stage: 'won' })).toBeNull();
    expect(perfectProgress({ v: 1, stage: 'season', games: [{ won: true }, { won: true }] })).toBe('2-0, still perfect');
    expect(perfectProgress({ v: 1, stage: 'draft', squad: [1, 2, 3] })).toBe('Drafting 3/10');
    expect(perfectProgress({ v: 1, stage: 'done' })).toBeNull();
    expect(careerProgress([{ status: 'retired', updatedAt: 2, identity: { name: 'A' }, years: [] }])).toBeNull();
    expect(careerProgress([{ status: 'active', updatedAt: 1, identity: { name: 'Old' }, years: [] }, { status: 'active', updatedAt: 5, identity: { name: 'Jay' }, years: [{ age: 24 }] }])).toBe('Jay, age 24 (+1 more)');
  });
});

describe('Career big moments', () => {
  const year = (patch: Partial<CareerYear>): CareerYear => ({ season: '2030', age: 25, teamId: 'BOS', teamName: 'Boston', overall: 80, awards: [], training: [], stats: { gamesPlayed: 70, points: 1400 } as CareerYear['stats'], ...patch });
  it('picks the biggest moment of the season, once where it should', () => {
    expect(seasonMoment(year({ awards: [{ key: 'champion' } as CareerYear['awards'][number], { key: 'mvp' } as CareerYear['awards'][number]] }), 4, [])?.id).toBe('title');
    expect(seasonMoment(year({ awards: [{ key: 'mvp' } as CareerYear['awards'][number]] }), 4, [])?.id).toBe('mvp');
    expect(seasonMoment(year({}), 1, [])?.id).toBe('rookie');
    const allStar = year({ awards: [{ key: 'allStar' } as CareerYear['awards'][number]] });
    expect(seasonMoment(allStar, 3, [])?.id).toBe('allStar');
    expect(seasonMoment(allStar, 3, [{ id: 'allStar', season: '2029', title: '', choice: '', result: '', legacy: 1 }])?.id).not.toBe('allStar');
    expect(seasonMoment(year({}), 5, [])).toBeNull();
  });
  it('a call adds story Legacy or training, and the Legacy Score counts it', () => {
    const m = seasonMoment(year({ awards: [{ key: 'champion' } as CareerYear['awards'][number]] }), 4, [])!;
    const legacyPick = applyMomentChoice(m, 0, startProgress());
    expect(legacyPick.pick.legacy).toBe(2);
    const work = applyMomentChoice(m, 1, { ...startProgress(), body: MAX_PROGRESS - 0.01 });
    expect(work.progress.body).toBe(MAX_PROGRESS);
    expect(storyLegacy([legacyPick.pick, work.pick])).toBe(3);
    expect(legacyScore({ ...emptyResume(), story: 3 })).toBe(3);
  });
});

describe('Hunt squad to 82-0', () => {
  it('keeps the six and the coach, spins four bench players, then goes straight to the season', async () => {
    const h = await loadHistoryForTests();
    const six = cardPool(h).byRarity.epic.slice(0, 6).map(c => c.id);
    let r = newPerfectFromHunt(h, 77, six, 'jackson');
    expect(r).toMatchObject({ from: 'hunt', coach: 'jackson', stage: 'draft' });
    expect(r.squad).toEqual(six);
    while (r.stage === 'draft') r = pickPlayer(h, r);
    expect(r.squad).toHaveLength(SQUAD);
    expect(r.stage).toBe('season');
    expect(r.schedule).toHaveLength(82);
  });
});
