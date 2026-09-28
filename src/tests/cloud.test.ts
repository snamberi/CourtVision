// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { mergeStorage, mergeCareers, mergeValue } from '../cloud/merge';
import { derive, sanitizeBlob } from '../../server/derive';
import { tierFor, dailyLegendPoints, weeklyRebuildPoints, weeklyCareerPoints, dailyGoalPoints } from '../cloud/ranked';
import { weeklyRebuild } from '../retention/weekly';
import { scoreResults } from '../simulation/rebuildScenarios';
import { usernameProblem, cleanName } from '../lib/names';
import { encodeLeagueCode } from '../retention/leagueCode';

const legacy = (a: Record<string, number>, leagues: Record<string, number>) => JSON.stringify({ version: 1,
  achievements: Object.fromEntries(Object.entries(a).map(([id, at]) => [id, { season: '2026', leagueName: 'L', at, saveIds: [`s${at}`] }])),
  leagues: Object.fromEntries(Object.entries(leagues).map(([id, u]) => [id, { saveId: id, name: id, seasons: u, wins: u * 40, losses: u * 42, titles: 0, teams: [], lastSeason: '2026', updatedAt: u }])) });

describe('cloud merge', () => {
  it('never loses progress: unions, best numbers, better days and weeks', () => {
    const local = {
      'courtvision:gmLegacy': legacy({ first_season: 5, playoffs: 9 }, { a: 3 }),
      'cv-hunt-records': JSON.stringify({ runs: 4, wins: 1, bestStop: 9, daily: { '2026-09-20': { won: false, stop: 5, wins: 20, losses: 9 } } }),
      'cv-hunt-album': JSON.stringify(['x', 'y']),
      'cv-rebuild-records': JSON.stringify({ bulls99: { best: 900, stars: 1, titleIn: null, attempts: 2 } }),
      'cv-weekly-records': JSON.stringify({ '2026-W39': { rebuild: { best: 500, label: 'a', at: 1 } } }),
      'cv-daily-history': JSON.stringify({ '2026-09-20': { done: 1, xp: 50 } }),
      'cv-profile-equip': JSON.stringify({ frame: 'gold' }),
    };
    const cloud = {
      'courtvision:gmLegacy': legacy({ first_season: 2, dynasty: 7 }, { a: 1, b: 2 }),
      'cv-hunt-records': JSON.stringify({ runs: 9, wins: 0, bestStop: 4, daily: { '2026-09-20': { won: true, stop: 10, wins: 40, losses: 5 }, '2026-09-21': { won: false, stop: 2, wins: 8, losses: 8 } } }),
      'cv-hunt-album': JSON.stringify(['y', 'z']),
      'cv-rebuild-records': JSON.stringify({ bulls99: { best: 700, stars: 3, titleIn: 4, attempts: 1 }, lakers17: { best: 100, stars: 0, titleIn: null, attempts: 1 } }),
      'cv-weekly-records': JSON.stringify({ '2026-W39': { rebuild: { best: 800, label: 'b', at: 2 }, career: { best: 60, label: 'c', at: 3 } } }),
      'cv-daily-history': JSON.stringify({ '2026-09-20': { done: 3, xp: 235 } }),
      'cv-profile-equip': JSON.stringify({ frame: 'neon' }),
    };
    const m = mergeStorage(local, cloud);
    const leg = JSON.parse(m['courtvision:gmLegacy']);
    expect(Object.keys(leg.achievements).sort()).toEqual(['dynasty', 'first_season', 'playoffs']);
    expect(leg.achievements.first_season.at).toBe(2); // the earlier unlock is kept, with both leagues
    expect(leg.achievements.first_season.saveIds.sort()).toEqual(['s2', 's5']);
    expect(leg.leagues.a.seasons).toBe(3); // newer copy of the league
    expect(leg.leagues.b.seasons).toBe(2);
    const hunt = JSON.parse(m['cv-hunt-records']);
    expect(hunt).toMatchObject({ runs: 9, wins: 1, bestStop: 9 });
    expect(hunt.daily['2026-09-20'].won).toBe(true);
    expect(Object.keys(hunt.daily)).toHaveLength(2);
    expect(JSON.parse(m['cv-hunt-album']).sort()).toEqual(['x', 'y', 'z']);
    expect(JSON.parse(m['cv-rebuild-records']).bulls99).toMatchObject({ best: 900, stars: 3, titleIn: 4, attempts: 2 });
    expect(JSON.parse(m['cv-weekly-records'])['2026-W39']).toMatchObject({ rebuild: { best: 800 }, career: { best: 60 } });
    expect(JSON.parse(m['cv-daily-history'])['2026-09-20'].xp).toBe(235);
    expect(JSON.parse(m['cv-profile-equip']).frame).toBe('gold'); // this device's choice
    // Merging is stable: merging the result again changes nothing.
    expect(mergeStorage(m, cloud)).toEqual(m);
    expect(mergeValue('cv-hunt-album', null, '["a"]')).toBe('["a"]');
  });

  it('careers: the newer copy, and a retired career never goes back', () => {
    const c = (id: string, updatedAt: number, status: string) => ({ id, updatedAt, status });
    const out = mergeCareers([c('a', 5, 'active'), c('b', 1, 'retired')], [c('a', 9, 'retired'), c('b', 7, 'active'), c('c', 2, 'retired')]);
    const by = Object.fromEntries(out.map(x => [x.id, x]));
    expect(by.a.status).toBe('retired');
    expect(by.b.status).toBe('retired');
    expect(by.c).toBeTruthy();
  });
});

const NOW = new Date('2026-10-02T12:00:00Z');
function blob(storage: Record<string, unknown>, careers: unknown[] = []) {
  return sanitizeBlob({ version: 1, updatedAt: 1, storage: Object.fromEntries(Object.entries(storage).map(([k, v]) => [k, JSON.stringify(v)])), careers })!;
}
const career = (id: string, legacy: number, over: Record<string, unknown> = {}) => ({
  id, playerId: 'Zion Monroe', status: 'retired', updatedAt: 1, weekly: '2026-W40', years: Array.from({ length: 12 }, (_, i) => ({ season: String(2026 + i), stats: { gamesPlayed: 80, points: 1600, oreb: 100, dreb: 400, ast: 300, stl: 60, blk: 40 }, awards: i < 2 ? [{ key: 'champion' }] : [] })),
  retired: { age: 33, season: '2038', legacy, rank: 40, hallOfFame: 'yes' }, ...over,
});

describe('server derive', () => {
  it('builds the public rows and drops anything implausible', () => {
    const cfg = weeklyRebuild('2026-W40');
    const results = [{ wins: 30, losses: 52, finish: 'Missed Playoffs' }, { wins: 60, losses: 22, finish: 'Champion' }];
    const d = derive(blob({
      'cv-weekly-records': { '2026-W40': { rebuild: { best: 999999, label: 'x', stars: 3, at: 1, results }, career: { best: 88, label: 'Zion Monroe', at: 1 } }, '2030-W01': { career: { best: 99, label: 'future', at: 1 } } },
      'cv-hunt-records': { runs: 3, wins: 1, bestStop: 10, daily: { '2026-10-01': { won: true, stop: 10, wins: 40, losses: 10 }, '2026-10-02': { won: false, stop: 4, wins: 20, losses: 12 }, '2026-12-25': { won: true, stop: 10, wins: 40, losses: 0 } } },
      'cv-rebuild-records': { bulls99: { best: 2400, stars: 3, titleIn: 3, attempts: 2 }, fake: { best: 1, stars: 1, attempts: 1 }, lakers17: { best: 99999999, stars: 3, attempts: 1 } },
      'cv-daily-history': { '2026-10-01': { done: 3, xp: 235 } },
      'cv-code-results': { [encodeLeagueCode({ kind: 'random', year: 2026, seed: 5, difficulty: 'normal' })]: { team: 'Boston', wins: 55, losses: 27, finish: 'Second Round', season: '2026', at: 1 }, 'BAD-CODE-X-Y': { wins: 1, losses: 1, finish: 'x' } },
    }, [career('c1', 120), career('c2', 999), career('c3', 50, { playerId: '<b>hax</b>' }), { id: 'c4', status: 'active' }]), NOW);
    const wr = d.weekly.find(w => w.board === 'rebuild')!;
    expect(wr.score).toBe(scoreResults(results as never, cfg.seasons).score); // recomputed, not the 999999 claimed
    expect(d.weekly.find(w => w.board === 'career')?.score).toBe(88);
    expect(d.weekly).toHaveLength(2); // the future week is dropped
    expect(d.daily.map(x => x.day)).toEqual(['2026-10-01', '2026-10-02']); // no future days
    expect(d.daily[0].score).toBeGreaterThan(d.daily[1].score);
    expect(d.rebuild.map(r => r.scenario)).toEqual(['bulls99']);
    expect(d.players.map(p => p.career_id)).toEqual(['c1']); // legacy 999 and a bad name are out
    expect(d.players[0]).toMatchObject({ titles: 2, seasons: 12, ppg: 20, weekly: '2026-W40' });
    expect(d.codes).toHaveLength(1);
    const pts = Object.fromEntries(d.ranked.map(r => [r.event, r.points]));
    expect(pts['dl:2026-10-01']).toBe(40);
    expect(pts['dl:2026-10-02']).toBe(12);
    expect(pts['wr:2026-W40']).toBe(100);
    expect(pts['wc:2026-W40']).toBe(44);
    expect(pts['dg:2026-10-01']).toBe(20);
    expect(d.profile.stats).toMatchObject({ careers: 1, hallOfFame: 1, huntWins: 1, rebuildStars: 3 });
    expect(d.profile.level).toBeGreaterThan(1);
  });

  it('rejects malformed blobs and strips unknown keys', () => {
    expect(sanitizeBlob(null)).toBeNull();
    expect(sanitizeBlob({ version: 2 })).toBeNull();
    const b = sanitizeBlob({ version: 1, updatedAt: 1, storage: { 'cv-hunt-records': '{}', 'courtvision-auth': 'secret', evil: 'x' }, careers: [] })!;
    expect(Object.keys(b.storage)).toEqual(['cv-hunt-records']);
  });
});

describe('ranked and names', () => {
  it('points and tiers', () => {
    expect(dailyLegendPoints(true, 10)).toBe(40);
    expect(dailyLegendPoints(false, 20)).toBe(27);
    expect(weeklyRebuildPoints(3, true)).toBe(100);
    expect(weeklyCareerPoints(500)).toBe(100);
    expect(dailyGoalPoints(3)).toBe(20);
    expect(tierFor(0).tier.id).toBe('bronze');
    expect(tierFor(399).tier.id).toBe('silver');
    expect(tierFor(400).tier.id).toBe('gold');
    expect(tierFor(5000)).toMatchObject({ tier: { id: 'legend' }, next: null });
  });
  it('usernames and player names', () => {
    expect(usernameProblem('Saba_GM')).toBeNull();
    expect(usernameProblem('ab')).toBeTruthy();
    expect(usernameProblem('bad name')).toBeTruthy();
    expect(usernameProblem('xXfuckXx')).toBeTruthy();
    expect(cleanName("Shaquille O'Neal")).toBe("Shaquille O'Neal");
    expect(cleanName('<script>')).toBeNull();
  });
});
