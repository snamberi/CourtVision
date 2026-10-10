// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { objectRead } from '../lib/kv';
import { modeStats, earnedModeAchievements, longestStreak, MODE_ACHIEVEMENTS } from '../profile/modeAchievements';
import { careerCacheOf } from '../profile/profile';
import { mergeFeats, noteFeat, readFeats } from '../profile/feats';
import { takeModeUnlocks } from '../profile/modeUnlocks';
import { mergeValue } from '../cloud/merge';
import { derive } from '../../server/derive';

const year = (points: number, awards: string[] = []) => ({ stats: { points }, awards: awards.map(key => ({ key })) });

describe('mode achievements', () => {
  it('ids are unique and every mode has some', () => {
    expect(new Set(MODE_ACHIEVEMENTS.map(a => a.id)).size).toBe(MODE_ACHIEVEMENTS.length);
    expect(new Set(MODE_ACHIEVEMENTS.map(a => a.mode)).size).toBe(11);
  });

  it('career summary: first ballot, Top 10, MVP careers, most titles and points', () => {
    const c = careerCacheOf([
      { retired: { legacy: 95, hallOfFame: 'first-ballot', rank: 8 }, years: [year(20_000, ['mvp', 'champion']), year(12_000, ['champion', 'champion'])] },
      { retired: { legacy: 30, hallOfFame: 'no', rank: null }, years: [year(5_000)] },
      { years: [year(40_000, ['mvp'])] }, // still playing: doesn't count
    ]);
    expect(c).toMatchObject({ careers: 3, retired: 2, hallOfFame: 1, firstBallot: 1, top10: 1, mvpCareers: 1, mostTitles: 3, mostPoints: 32_000 });
  });

  it('reads every mode from its own records (old progress counts)', () => {
    const read = objectRead({
      'cv-profile-careers': JSON.stringify(careerCacheOf([{ retired: { legacy: 50, hallOfFame: 'yes', rank: 40 }, years: [year(31_000)] }])),
      'cv-hunt-records': JSON.stringify({ runs: 9, wins: 5, bestStop: 9, daily: { '2026-09-01': { won: true, stop: 9, wins: 40, losses: 9 } } }),
      'cv-hunt-album': JSON.stringify(Array.from({ length: 120 }, (_, i) => `c${i}`)),
      'cv-rebuild-records': JSON.stringify({ a: { best: 1, stars: 3, titleIn: 1, attempts: 1 } }),
      'cv-weekly-records': JSON.stringify({ '2026-W38': { rebuild: { best: 5, label: 'x', at: 1 } } }),
      'cv-daily-history': JSON.stringify(Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`2026-09-0${i + 1}`, { done: i === 3 ? 3 : 1, xp: 10 }]))),
      'courtvision:gmLegacy': JSON.stringify({ version: 1, achievements: {}, leagues: { d: { saveId: 'd', name: 'D', seasons: 1, wins: 60, losses: 22, titles: 1, teams: ['X'], lastSeason: '2026', updatedAt: 1, kind: 'draft' } } }),
      'cv-feats': JSON.stringify({ huntLegendWins: 1, pvpWins: 2, pvpBest: 1210, drafts: 1 }),
      'cv-ranked-best': 'diamond',
    });
    const got = new Set(earnedModeAchievements(read));
    for (const id of ['career-retire', 'career-hof', 'career-30k', 'hunt-win', 'hunt-five', 'hunt-legend', 'hunt-daily-win', 'hunt-album-100', 'rebuild-star', 'rebuild-title', 'rebuild-year-one',
      'draft-done', 'draft-title', 'pvp-win', 'pvp-1200', 'ranked-gold', 'ranked-diamond', 'weekly-first', 'goals-all', 'goals-streak']) expect(got, id).toContain(id);
    for (const id of ['career-first-ballot', 'hunt-album-300', 'rebuild-architect', 'draft-top', 'pvp-ten', 'ranked-legend', 'weekly-four', 'hunt-daily-seven']) expect(got, id).not.toContain(id);
    expect(modeStats(objectRead({})).rankedTier).toBe(0);
  });

  it('streaks count consecutive days only', () => {
    expect(longestStreak(['2026-09-01', '2026-09-02', '2026-09-04', '2026-09-05', '2026-09-06'])).toBe(3);
    expect(longestStreak([])).toBe(0);
  });

  it('feats keep the higher number when merged, and merge to themselves', () => {
    expect(mergeFeats({ pvpWins: 3, drafts: 1 }, { pvpWins: 1, pvpBest: 1100 })).toEqual({ drafts: 1, pvpBest: 1100, pvpWins: 3 });
    const once = mergeValue('cv-feats', JSON.stringify({ pvpWins: 3 }), JSON.stringify({ drafts: 2 }))!;
    expect(mergeValue('cv-feats', once, once)).toBe(once);
    localStorage.clear();
    noteFeat('drafts', 1); noteFeat('drafts', 1); noteFeat('pvpBest', 1100, 'max'); noteFeat('pvpBest', 1050, 'max');
    expect(readFeats()).toEqual({ drafts: 2, pvpBest: 1100 });
  });

  it('announces what was earned before as one note, then each new unlock once', () => {
    localStorage.clear();
    localStorage.setItem('cv-hunt-records', JSON.stringify({ runs: 1, wins: 1, bestStop: 9 }));
    expect(takeModeUnlocks()).toMatchObject({ first: true, fresh: [{ id: 'hunt-win' }] });
    expect(takeModeUnlocks().fresh).toEqual([]);
    noteFeat('drafts', 1);
    expect(takeModeUnlocks()).toMatchObject({ first: false, fresh: [{ id: 'draft-done' }] });
  });

  it('the server counts them for rarity as mode-<id>', () => {
    const d = derive({ version: 1, updatedAt: 1, storage: { 'cv-hunt-records': JSON.stringify({ runs: 2, wins: 1, bestStop: 9 }), 'cv-feats': JSON.stringify({ drafts: 1 }) }, careers: [] });
    expect(d.achievements).toEqual(expect.arrayContaining(['mode-hunt-win', 'mode-draft-done']));
  });
});
