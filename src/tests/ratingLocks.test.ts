import { describe, expect, it } from 'vitest';
import { RNG } from '../simulation/engine/rng';
import { generatePlayer, generateFullLeague } from '../simulation/leagueGenerator';
import { developOffseasonPlayer } from '../simulation/engine/development';
import { keepLockedRatings, setRatingLocks, ratingAt } from '../simulation/ratingLocks';
import { applyRealDevelopment } from '../history/realDevelopment';
import { sandboxBuild, setSandbox, primeFromSandbox, categoryPaths, buildPlayer, startProgress } from '../career/create';
import { newCareerMeta, applyProgress, findPlayer } from '../career/career';
import { CATEGORIES } from '../career/categories';
import type { PlayerSeason } from '../simulation/types';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { buildHistoricalLeague } from '../history/historicalLeague';
import { initializeCoaching } from '../simulation/staffManagement';
import { prepareCoachingForGame } from '../simulation/playerDevelopment';
import { FOCUS_SKILLS } from '../simulation/coachingModel';

const LOCKS = ['offense.threePoint', 'physical.speed', 'mental.clutch'];

describe('Locked ratings', () => {
  it('lock and unlock single ratings; locked ones are put back after any change', () => {
    const p = generatePlayer('Lock Test', '2026', null, 21, 7, new RNG(7), { caliber: 55 });
    let q = setRatingLocks(p, ['offense.threePoint', 'physical.speed'], true);
    expect(q.lockedRatings).toEqual(['offense.threePoint', 'physical.speed']);
    q = setRatingLocks(q, ['physical.speed'], false);
    expect(q.lockedRatings).toEqual(['offense.threePoint']);
    expect(setRatingLocks(q, ['offense.threePoint'], false).lockedRatings).toBeUndefined();
    const changed: PlayerSeason = { ...q, attributes: { ...q.attributes, offense: { ...q.attributes.offense, threePoint: 1, midrange: 1 } } };
    const kept = keepLockedRatings(q, changed);
    expect(ratingAt(kept, 'offense.threePoint')).toBe(ratingAt(q, 'offense.threePoint'));
    expect(ratingAt(kept, 'offense.midrange')).toBe(1);
  });

  it('a young player grows, an old one declines, and locked ratings never move', () => {
    const young = setRatingLocks(generatePlayer('Young Lock', '2026', null, 20, 3, new RNG(3), { caliber: 50 }), LOCKS, true);
    let p = young;
    for (let y = 0; y < 6; y++) p = developOffseasonPlayer(p, new RNG(100 + y));
    for (const path of LOCKS) expect(ratingAt(p, path)).toBe(ratingAt(young, path));
    expect(ratingAt(p, 'offense.midrange')).not.toBe(ratingAt(young, 'offense.midrange'));
    expect(p.lockedRatings).toEqual([...LOCKS].sort());
    expect(p.age).toBe(26);

    const old = setRatingLocks(generatePlayer('Old Lock', '2026', null, 33, 4, new RNG(4), { caliber: 70 }), LOCKS, true);
    let o = old;
    for (let y = 0; y < 4; y++) o = developOffseasonPlayer(o, new RNG(200 + y));
    for (const path of LOCKS) expect(ratingAt(o, path)).toBe(ratingAt(old, path));
    expect(ratingAt(o, 'physical.agility')).toBeLessThan(ratingAt(old, 'physical.agility'));
  });

  it('real player development and in-season practice keep locked ratings too', async () => {
    const h = await loadHistoryForTests();
    const real = buildHistoricalLeague(h, 2016, { realDevelopment: true, difficulty: 'normal', seed: 11 });
    const curry = setRatingLocks(real.league.teams.flatMap(t => t.seasons).find(p => p.playerId === 'Stephen Curry')!, ['offense.threePoint', 'physical.speed'], true);
    const next = applyRealDevelopment(curry, '2017')!;
    expect(next.real!.appliedSeason).toBe('2017');
    expect(ratingAt(next, 'offense.threePoint')).toBe(ratingAt(curry, 'offense.threePoint'));
    expect(ratingAt(next, 'physical.speed')).toBe(ratingAt(curry, 'physical.speed'));

    // Practice (Real Player Development off): everyone's training moves ratings, never a locked one.
    const { league: raw } = buildHistoricalLeague(h, 2016, { realDevelopment: false, difficulty: 'normal', seed: 11 });
    let league = initializeCoaching(raw);
    const gsw = league.teams.find(t => t.teamId === 'GSW')!;
    const locked = gsw.seasons.map(p => setRatingLocks(p, LOCKS.concat(FOCUS_SKILLS['catch-and-shoot'], FOCUS_SKILLS.balanced), true));
    league = { ...league, teams: league.teams.map(t => (t.teamId === 'GSW' ? { ...t, seasons: locked } : t)) };
    league = prepareCoachingForGame(league, ['GSW'], '2016-10-20');
    league = prepareCoachingForGame(league, ['GSW'], '2017-01-20');
    const after = league.teams.find(t => t.teamId === 'GSW')!.seasons;
    for (const p of after) {
      const before = locked.find(x => x.playerId === p.playerId)!;
      for (const path of p.lockedRatings!) expect(ratingAt(p, path)).toBe(ratingAt(before, path));
    }
    expect(after.some(p => JSON.stringify(p.attributes) !== JSON.stringify(locked.find(x => x.playerId === p.playerId)!.attributes))).toBe(true);
  }, 120_000);

  it('Career Create Anything: a locked rating keeps its built number from the rookie year to the prime', () => {
    let b = sandboxBuild(90);
    b = setSandbox(b, ['offense.corner3'], 40);
    const prime = primeFromSandbox(b);
    const locks = { 'offense.corner3': 40 };
    const rookie = buildPlayer({ name: 'Locked Rook', pos: 'SF', jersey: 3 }, prime, startProgress(), 'balanced', '2026', 19, 1, locks);
    expect(rookie.attributes.offense.corner3).toBe(40);
    expect(rookie.lockedRatings).toEqual(['offense.corner3']);
    expect(rookie.attributes.offense.threePoint).toBeLessThan(90); // a balanced rookie starts below his prime
    expect(categoryPaths('threePoint')).toContain('offense.corner3');

    const { league, extras } = generateFullLeague(1, 2, 8, 4, '2026');
    const meta = { ...newCareerMeta('c', 1, 'sandbox', { name: 'Locked Rook', pos: 'SF', jersey: 3 }, prime, 'balanced', 'Locked Rook', '2026', startProgress()), locks };
    const onTeam = { ...league, teams: league.teams.map((t, i) => (i ? t : { ...t, seasons: [...t.seasons, { ...rookie, playerId: 'Locked Rook', teamId: t.teamId }] })) };
    const atPrime = { ...meta, progress: Object.fromEntries(CATEGORIES.map(c => [c.id, 1])) as typeof meta.progress };
    const grown = applyProgress(onTeam, extras, atPrime);
    const p = findPlayer(grown.league, grown.extras, 'Locked Rook')!.player;
    expect(p.attributes.offense.corner3).toBe(40);
    expect(p.attributes.offense.threePoint).toBe(90);
    // As a rookie (and in decline) a locked rating still holds; without the lock it follows his progress.
    for (const progress of [0, -0.5]) {
      const at = { ...meta, progress: Object.fromEntries(CATEGORIES.map(c => [c.id, progress])) as typeof meta.progress };
      expect(findPlayer(applyProgress(onTeam, extras, at).league, extras, 'Locked Rook')!.player.attributes.offense.corner3).toBe(40);
      expect(findPlayer(applyProgress(onTeam, extras, { ...at, locks: undefined }).league, extras, 'Locked Rook')!.player.attributes.offense.corner3).toBeLessThan(40);
    }
  });
});
