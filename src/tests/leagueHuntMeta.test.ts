// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { cardPool } from '../hunt/cards';
import { huntTeams } from '../hunt/teams';
import { ERAS } from '../hunt/eras';
import { newRun, stopReels, lockReel, draftBest, maxLives, opponentRating, type HuntRun, type SpinKind } from '../hunt/run';
import { deckUnlocked, difficultyUnlocked, loadAlbum, saveRun, recordRun, loadRecords, dailySeed, todayUtc } from '../hunt/storage';
import { dreamGame, teamsIn } from '../hunt/matchup';

type H = Awaited<ReturnType<typeof loadHistoryForTests>>;
const draftAll = (h: H, run: HuntRun) => draftBest(h, run);

describe('League Hunt: decks, difficulty, daily, album, dream matchup', () => {
  beforeEach(() => localStorage.clear());

  it('decks shape the draft', async () => {
    const h = await loadHistoryForTests(); const pool = cardPool(h);
    const old = draftAll(h, newRun(h, 11, { deck: 'oldSchool' }));
    expect(old.squad.every(id => pool.byId.get(id)!.end < 1980)).toBe(true);
    expect(old.coins).toBe(newRun(h, 11).coins + 50);
    const pace = draftAll(h, newRun(h, 12, { deck: 'paceSpace' }));
    expect(pace.squad.every(id => pool.byId.get(id)!.end >= 2010)).toBe(true);
    expect(pace.items).toContain('sevenSeconds');
    // Big Man Era: the PF and C reels always land on a Great or better.
    let big = newRun(h, 13, { deck: 'bigMen' });
    expect(big.items).toContain('badBoys');
    while (big.stage === 'draft') {
      big = stopReels(h, big);
      for (const k of ['PF', 'C'] as const) if (big.reels![k]) expect(['epic', 'legendary']).toContain(pool.byId.get(big.reels![k]!)!.rarity);
      big = lockReel(h, big, Object.keys(big.reels!)[0] as SpinKind);
    }
    // Dynasty: after the first lock, one reel is a real teammate of someone locked.
    let dyn = stopReels(h, newRun(h, 14, { deck: 'dynasty' }));
    dyn = stopReels(h, lockReel(h, dyn, 'PG'));
    const mates = new Set(huntTeams(h).filter(t => t.roster.includes(dyn.squad[0])).flatMap(t => t.roster));
    expect(Object.values(dyn.reels!).some(id => mates.has(id!))).toBe(true);
  }, 120_000);

  it('difficulty changes lives and opponents', async () => {
    const h = await loadHistoryForTests();
    const str = (r: HuntRun) => r.series.slice(0, 4).reduce((n, s) => n + opponentRating(h, r, s), 0) / 4;
    const rookie = newRun(h, 21, { difficulty: 'rookie' }), legend = newRun(h, 21, { difficulty: 'legend' });
    expect(maxLives(rookie)).toBe(4);
    expect(maxLives(legend)).toBe(2);
    expect(str(legend)).toBeGreaterThan(str(rookie));
  }, 120_000);

  it('unlocks follow your records; the daily hunt is the same for everyone and recorded by date', async () => {
    const h = await loadHistoryForTests();
    const fresh = loadRecords();
    expect(deckUnlocked(fresh, 'classic')).toBe(true);
    expect(deckUnlocked(fresh, 'dynasty')).toBe(false);
    expect(difficultyUnlocked(fresh, 'legend')).toBe(false);
    expect(deckUnlocked({ ...fresh, wins: 1 }, 'dynasty')).toBe(true);
    const date = '2026-09-27';
    expect(dailySeed(date)).toBe(dailySeed(date));
    expect(dailySeed(date)).not.toBe(dailySeed('2026-09-28'));
    const a = newRun(h, dailySeed(date), { daily: date }), b = newRun(h, dailySeed(date), { daily: date });
    expect(a.series).toEqual(b.series);
    expect(stopReels(h, a).reels).toEqual(stopReels(h, b).reels);
    const done: HuntRun = { ...a, stage: 'lost', seriesIndex: 2, results: [{ index: 0, teamId: a.series[0].teamId, games: [], won: true, coins: 0 }] };
    const rec = recordRun(done);
    expect(rec.daily?.[date]).toEqual({ won: false, stop: 2, wins: 1, losses: 0 });
    expect(todayUtc(new Date('2026-09-27T23:30:00Z'))).toBe('2026-09-27');
  }, 120_000);

  it('the album keeps every card that was on a squad', async () => {
    const h = await loadHistoryForTests();
    const run = draftAll(h, newRun(h, 31));
    saveRun(run);
    const album = loadAlbum();
    expect(run.squad.every(id => album.has(id))).toBe(true);
  }, 120_000);

  it('dream matchup: the 96 Bulls and the 17 Warriors under 1960s rules', async () => {
    const h = await loadHistoryForTests();
    const bulls = teamsIn(h, 1996).find(t => t.name === 'Chicago')!, dubs = teamsIn(h, 2017).find(t => t.name === 'Golden State')!;
    const g = dreamGame(h, bulls.id, dubs.id, ERAS[0], 5)!;
    expect(g.home.seasons.some(p => p.playerId === "Michael Jordan '96")).toBe(true);
    expect(g.away.seasons.some(p => p.playerId === "Stephen Curry '17")).toBe(true);
    const tpa = Object.values(g.result.awayBox.players).reduce((n, l) => n + l.tpa, 0);
    const modern = dreamGame(h, bulls.id, dubs.id, ERAS.find(e => e.id === '10s')!, 5)!;
    expect(tpa).toBeLessThan(Object.values(modern.result.awayBox.players).reduce((n, l) => n + l.tpa, 0));
    expect(dreamGame(h, bulls.id, bulls.id, ERAS[0], 5)).toBeNull();
  }, 120_000);
});
