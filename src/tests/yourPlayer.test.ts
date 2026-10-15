import { describe, it, expect } from 'vitest';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { prototypePool, closestPrototypes, shapeOf, buildDistance, matchPercent, prototypeGaps, SKILL_IDS } from '../career/prototype';
import { wheelPool, donor } from '../career/wheel';
import { primeFromRatings } from '../career/create';
import { categoryScore } from '../career/categories';
import { isUnrankedCareer, isYourPlayerCareer, type CareerMeta } from '../career/career';
import { careerCacheOf } from '../profile/profile';
import { derive } from '../../server/derive';
import { baseRatings, MY_RATINGS_KEY } from '../profile/myRatings';
import { ratingsBaller, playStreet } from '../arcade/street';
import { cleanOne, noteOne, mergeOne, eventTag, EVENT_GAMES } from '../arcade/oneOnOne';
import { mergeValue } from '../cloud/merge';

describe('prototypes', () => {
  it('a real player is his own closest prototype, and similar builds find similar players', async () => {
    const h = await loadHistoryForTests();
    const pool = prototypePool(h);
    expect(pool.length).toBeGreaterThan(100);
    const curry = wheelPool(h).find(c => c.name === 'Stephen Curry')!;
    const self = closestPrototypes(shapeOf(donor(h, curry.id)), pool, 3);
    expect(self[0].card.playerId).toBe(curry.playerId);
    expect(self[0].match).toBe(100);
    expect(self.map(p => p.match)).toEqual([...self.map(p => p.match)].sort((a, b) => b - a));
    // A tiny, all-45 build matches a small player; a seven-foot rim protector matches a big.
    const base = baseRatings();
    const small = closestPrototypes(base, pool, 1)[0];
    expect(small.shape.height).toBeLessThanOrEqual(72);
    const big = closestPrototypes({ height: 84, skills: { ...base.skills, interiorD: 95, finishing: 90, body: 90, iq: 75 } }, pool, 1)[0];
    expect(big.shape.height).toBeGreaterThanOrEqual(81);
    // One season per player at most, and `skip` leaves one out.
    expect(closestPrototypes(shapeOf(donor(h, curry.id)), pool, 3, curry.playerId).every(p => p.card.playerId !== curry.playerId)).toBe(true);
  }, 120_000);
  it('distance: shape, height and level; ratings over 99 read as 99', () => {
    const a = baseRatings();
    expect(buildDistance(a, a)).toBe(0);
    expect(matchPercent(0)).toBe(100);
    const taller = { ...a, height: a.height + 4 };
    expect(buildDistance(a, taller)).toBeCloseTo(6);
    const maxed = { height: 80, skills: Object.fromEntries(SKILL_IDS.map(id => [id, 120])) as typeof a.skills };
    const capped = { height: 80, skills: Object.fromEntries(SKILL_IDS.map(id => [id, 99])) as typeof a.skills };
    expect(buildDistance(maxed, capped)).toBe(0);
    const shooter = { ...a, skills: { ...a.skills, threePoint: 90 } };
    expect(prototypeGaps(shooter, a)[0]).toEqual({ id: 'threePoint', by: 45 });
  });
});

describe('Your Player careers', () => {
  it('start from the Closet ratings', () => {
    const r = baseRatings();
    const prime = primeFromRatings({ ...r.skills, threePoint: 88, interiorD: 61 }, 77);
    expect(categoryScore(prime.threePoint)).toBe(88);
    expect(categoryScore(prime.interiorD)).toBe(61);
    expect(categoryScore(prime.iq)).toBe(45);
    expect(prime.size['physical.heightInches']).toBe(77);
    expect(prime.size['physical.wingspanInches']).toBe(80);
  });
  it('count for XP but never for the leaderboards', () => {
    const retired = (mode: CareerMeta['mode'], id: string) => ({ version: 1, id, mode, playerId: 'Me Myself', status: 'retired', updatedAt: 1, years: [{ season: '2026-27', age: 19, awards: [], stats: { gamesPlayed: 82, points: 1500 } }],
      retired: { age: 35, season: '2042-43', legacy: 90, rank: null, hallOfFame: 'yes' } }) as unknown as CareerMeta;
    const mine = retired('yourplayer', 'y');
    expect(isYourPlayerCareer(mine)).toBe(true);
    expect(isUnrankedCareer(mine)).toBe(true);
    expect(isUnrankedCareer(retired('sandbox', 's'))).toBe(true);
    expect(isUnrankedCareer(retired('wheel', 'w'))).toBe(false);
    expect(careerCacheOf([mine]).retired).toBe(1);
    const d = derive({ version: 1, updatedAt: 1, storage: {}, careers: [mine, retired('wheel', 'w')] });
    expect(d.players.map(p => p.career_id)).toEqual(['w']);
  });
});

describe('1v1 with your player', () => {
  it('your profile publishes your player, kept within the points your level earned', () => {
    const r = baseRatings();
    const greedy = { ...r, skills: { ...r.skills, threePoint: 120, finishing: 120 }, height: 90 };
    const d = derive({ version: 1, updatedAt: 1, storage: { [MY_RATINGS_KEY]: JSON.stringify(greedy) }, careers: [] });
    const p = d.profile.stats.myPlayer as { skills: Record<string, number>; height: number };
    expect(p.height).toBe(r.height); // level 1: no points to spend
    expect(p.skills.threePoint).toBe(45);
  });
  it('plays a build on the street; a better build wins more', () => {
    const r = baseRatings();
    const weak = ratingsBaller(r, 'a', 'Weak'), strong = ratingsBaller({ height: 80, skills: Object.fromEntries(SKILL_IDS.map(id => [id, 95])) as typeof r.skills }, 'b', 'Strong');
    expect(strong.ovr).toBeGreaterThan(weak.ovr);
    let wins = 0;
    for (let i = 0; i < 30; i++) if (playStreet([strong], [weak], 11, i).winner === 0) wins++;
    expect(wins).toBeGreaterThan(20);
  });
  it('keeps a record, the players beaten, your record against each GM, and merges devices', () => {
    const day = new Date('2026-10-15T12:00:00Z');
    let r = cleanOne(null);
    r = noteOne(r, { kind: 'nba', id: 'curryst01' }, true, day);
    r = noteOne(r, { kind: 'nba', id: 'curryst01' }, true, day);
    r = noteOne(r, { kind: 'user', id: 'Saba' }, false, day);
    expect(r).toMatchObject({ w: 2, l: 1, beaten: ['curryst01'], users: { saba: { w: 0, l: 1 } }, day: '2026-10-15', today: 3 });
    const other = noteOne(cleanOne(null), { kind: 'nba', id: 'jordami01' }, true, day);
    const m = mergeOne(r, other);
    expect(m.beaten.sort()).toEqual(['curryst01', 'jordami01']);
    expect(m.w).toBe(2);
    expect(JSON.parse(mergeValue('cv-1v1', JSON.stringify(r), JSON.stringify(other))!).beaten).toHaveLength(2);
    expect(cleanOne({ w: -4, beaten: [7, 'x'], users: { '': { w: 1 } }, day: 'nope', today: 9 })).toMatchObject({ w: 0, beaten: ['x'], users: {}, day: '', today: 0 });
  });
  it('only the first ten games a day pay holiday event coins', () => {
    const day = new Date('2026-11-01T12:00:00Z');
    let r = cleanOne(null);
    const tags: string[] = [];
    for (let i = 0; i < EVENT_GAMES + 5; i++) { tags.push(eventTag(r, day)); r = noteOne(r, { kind: 'nba', id: `p${i}` }, true, day); }
    expect(new Set(tags).size).toBe(EVENT_GAMES);
    expect(eventTag(r, new Date('2026-11-02T12:00:00Z'))).toBe('1v1:2026-11-02:0');
  });
});
