// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { cardPool, type HuntCard } from '../hunt/cards';
import {
  newPerfectRun, pickPlayer, pickCoach, rerollTeam, rerollEra, applyPrime, rollPool, playNext, playToEnd, summary, fitBonds, franchiseIndex,
  BOSS_TEAMS, QUICK_SLOTS, SQUAD, SEASON_GAMES, WINS_NEEDED, type PerfectRun,
} from '../perfect/run';
import { recordPerfect, loadPerfectRecords, mergePerfectRecords, dailyPerfect, perfectWeeks, perfectTrophies, PERFECT_RECORDS_KEY } from '../perfect/storage';
import { mergeValue } from '../cloud/merge';
import { AVATAR_FRAMES, avatarFrameOpen } from '../profile/avatarFrames';
import { MODE_ACHIEVEMENTS } from '../profile/modeAchievements';

const draftAll = async (mode: 'quick' | 'franchise', seed: number): Promise<PerfectRun> => {
  const h = await loadHistoryForTests();
  let r = newPerfectRun(h, mode, seed);
  while (r.stage === 'draft') r = pickPlayer(h, r, mode === 'franchise' ? rollPool(h, r, r.roll!)[0].id : undefined);
  return r;
};

beforeEach(() => localStorage.removeItem(PERFECT_RECORDS_KEY));

describe('82-0 Challenge drafting', () => {
  it('Quick Spin is seeded, fills ten spots by position, then offers one coach', async () => {
    const h = await loadHistoryForTests();
    const a = await draftAll('quick', 99), b = await draftAll('quick', 99);
    expect(a.squad).toEqual(b.squad);
    expect(a.squad).toHaveLength(SQUAD);
    expect(new Set(a.squad.map(id => cardPool(h).byId.get(id)!.playerId)).size).toBe(SQUAD);
    const pos = a.squad.map(id => cardPool(h).byId.get(id)!.pos);
    const fits: Record<string, string[]> = { PG: ['PG', 'G'], SG: ['SG', 'G'], SF: ['SF', 'F'], PF: ['PF', 'F'], C: ['C'] };
    QUICK_SLOTS.slice(0, 5).forEach((s, i) => expect(fits[s]).toContain(pos[i]));
    expect(a.stage).toBe('coach');
    expect(a.coachOffer).toHaveLength(1);
  });

  it('Franchise Spin offers each player once at his best there; rerolls and Absolute Prime work once', async () => {
    const h = await loadHistoryForTests();
    let r = newPerfectRun(h, 'franchise', 4242);
    const pool = rollPool(h, r, r.roll!);
    expect(pool.length).toBeGreaterThanOrEqual(3);
    expect(new Set(pool.map(c => c.playerId)).size).toBe(pool.length);
    for (const c of pool) expect(c.franchise).toBe(r.roll!.franchise);
    const before = r.roll!;
    r = rerollTeam(h, r);
    expect(r.roll!.eraId).toBe(before.eraId);
    expect(r.roll!.franchise).not.toBe(before.franchise);
    expect(rerollTeam(h, r)).toBe(r); // used up
    const mid = r.roll!;
    r = rerollEra(h, r);
    expect(r.roll!.franchise).toBe(mid.franchise);
    expect(r.roll!.eraId).not.toBe(mid.eraId);
    r = applyPrime(r);
    const prime = rollPool(h, r, r.roll!), idx = franchiseIndex(h);
    for (const c of prime) expect(c.ovr).toBe(idx.prime.get(c.playerId)!.ovr);
    expect(applyPrime(r)).toBe(r);
    // Picking someone not on the roll does nothing; a real pick moves on to a fresh roll with the prime boost spent.
    expect(pickPlayer(h, r, 'nobody@1990')).toBe(r);
    const next = pickPlayer(h, r, prime[0].id);
    expect(next.squad).toEqual([prime[0].id]);
    expect(next.prime).toBe(false);
    expect(next.rolls).toBe(r.rolls + 1);
  });

  it('flags lineups with no guard or no big among the starters', () => {
    const c = (id: string, pos: string, ovr: number) => ({ id, pos, ovr }) as HuntCard;
    const bigs = fitBonds([c('a', 'C', 90), c('b', 'PF', 88), c('c', 'C', 87), c('d', 'PF', 86), c('e', 'SF', 85), c('f', 'PG', 60)]);
    expect(bigs.some(b => /No guard/.test(b.label))).toBe(true);
    const guards = fitBonds([c('a', 'PG', 90), c('b', 'SG', 88), c('c', 'G', 87), c('d', 'SF', 86), c('e', 'SF', 85)]);
    expect(guards.some(b => /No big/.test(b.label))).toBe(true);
    expect(fitBonds([c('a', 'PG', 90), c('b', 'SG', 88), c('c', 'SF', 87), c('d', 'PF', 86), c('e', 'C', 85)])).toEqual([]);
  });
});

describe('82-0 Challenge season', () => {
  it('plays 82 games with the bosses on the schedule, then the playoffs to a finish', async () => {
    const h = await loadHistoryForTests();
    let r = await draftAll('quick', 7);
    r = pickCoach(h, r, r.coachOffer![0]);
    expect(r.stage).toBe('season');
    expect(r.schedule).toHaveLength(SEASON_GAMES);
    expect(r.bosses.length).toBe(BOSS_TEAMS.length);
    for (const i of r.bosses) expect(BOSS_TEAMS.map(b => b.id)).toContain(r.schedule[i]);
    const one = playNext(h, r);
    expect(one.games).toHaveLength(1);
    expect(playNext(h, r)).toEqual(one); // seeded
    r = playToEnd(h, r, 'season');
    expect(r.games).toHaveLength(SEASON_GAMES);
    expect(r.stage).toBe('playoffs');
    r = playToEnd(h, r, 'playoffs');
    expect(r.stage).toBe('done');
    const s = summary(r);
    expect(s.w + s.l).toBe(SEASON_GAMES);
    for (const ser of r.playoffs) {
      const w = ser.games.filter(g => g.won).length, l = ser.games.length - w;
      expect(Math.max(w, l)).toBeLessThanOrEqual(WINS_NEEDED);
    }
    const last = r.playoffs.at(-1)!;
    expect(r.result).toBe(last.games.filter(g => g.won).length === WINS_NEEDED && last.round === 3 ? 'champion' : 'eliminated');
    expect(s.score).toBeGreaterThan(s.w * 100 - 1);
    expect(r.games.every(g => g.us !== g.them)).toBe(true);
  }, 60_000);
});

describe('82-0 Challenge records and rewards', () => {
  const done = (seed: number, wins: number, champion: boolean, daily?: string): PerfectRun => ({
    v: 1, mode: 'quick', seed, daily, stage: 'done', squad: [], rolls: 0, rerolls: { team: 1, era: 1, prime: 1 }, schedule: [], bosses: [],
    games: Array.from({ length: SEASON_GAMES }, (_, i) => ({ opp: 'X', us: i < wins ? 110 : 90, them: 100, won: i < wins, top: '' })),
    playoffs: champion ? [0, 1, 2, 3].map(round => ({ round, opp: 'Y', games: Array.from({ length: 4 }, () => ({ opp: 'Y', us: 105, them: 100, won: true, top: '' })) })) : [],
    result: champion ? 'champion' : 'eliminated',
  });

  it('counts a run once, keeps the best, and the Daily keeps the best try of the day', () => {
    recordPerfect(done(1, 60, false));
    recordPerfect(done(1, 60, false));
    let r = loadPerfectRecords();
    expect(r.runs).toBe(1);
    recordPerfect(done(2, 82, true, '2026-12-16'));
    recordPerfect(done(2, 70, false, '2026-12-16'));
    r = loadPerfectRecords();
    expect(r).toMatchObject({ runs: 3, titles: 1, perfectSeasons: 1, perfect98: 1, bestWins: 82 });
    expect(r.daily?.['2026-12-16']).toMatchObject({ w: 82, tries: 2 });
    expect(perfectWeeks(r)['2026-W51'].w).toBe(82);
    expect(perfectTrophies(r)).toBeGreaterThan(4000);
    const merged = mergePerfectRecords(r, { runs: 9, titles: 0, perfectSeasons: 0, perfect98: 0, bestWins: 50 });
    expect(merged).toMatchObject({ runs: 9, titles: 1, bestWins: 82 });
    expect(JSON.parse(mergeValue('cv-perfect-records', JSON.stringify(r), JSON.stringify({ runs: 9 }))!).runs).toBe(9);
  });

  it('the Daily is the same for everyone and alternates the mode', () => {
    expect(dailyPerfect('2026-12-16')).toEqual(dailyPerfect('2026-12-16'));
    expect(dailyPerfect('2026-12-16').mode).not.toBe(dailyPerfect('2026-12-17').mode);
  });

  it('82-0 and 98-0 open their frames through the mode achievements', () => {
    const undefeated = AVATAR_FRAMES.find(f => f.id === 'undefeated')!, gold = AVATAR_FRAMES.find(f => f.id === 'perfectGold')!;
    const ctx = (modes: string[]) => ({ level: 1, trophies: 0, honors: [], modes });
    expect(avatarFrameOpen(undefeated, ctx([]))).toBe(false);
    expect(avatarFrameOpen(undefeated, ctx(['perfect-82']))).toBe(true);
    expect(avatarFrameOpen(gold, ctx(['perfect-82']))).toBe(false);
    expect(avatarFrameOpen(gold, ctx(['perfect-98']))).toBe(true);
    expect(MODE_ACHIEVEMENTS.filter(a => a.mode === 'perfect').map(a => a.id)).toEqual(['perfect-60', 'perfect-title', 'perfect-74', 'perfect-82', 'perfect-98']);
  });
});
