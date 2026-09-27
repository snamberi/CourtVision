// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { cardPool } from '../hunt/cards';
import { huntTeams } from '../hunt/teams';
import { ERAS } from '../hunt/eras';
import { newRun, draftPick, affordable, maxLives, type HuntRun } from '../hunt/run';
import { deckUnlocked, difficultyUnlocked, loadAlbum, saveRun, recordRun, loadRecords, dailySeed, todayUtc } from '../hunt/storage';
import { dreamGame, teamsIn } from '../hunt/matchup';

type H = Awaited<ReturnType<typeof loadHistoryForTests>>;
const draftAll = (h: H, run: HuntRun) => {
  const pool = cardPool(h);
  let r = run;
  while (r.stage === 'draft') r = draftPick(h, r, r.offer.filter(id => affordable(h, r, id)).sort((a, b) => pool.byId.get(b)!.ovr - pool.byId.get(a)!.ovr)[0]);
  return r;
};

describe('League Hunt: decks, difficulty, daily, album, dream matchup', () => {
  beforeEach(() => localStorage.clear());

  it('decks shape the draft', async () => {
    const h = await loadHistoryForTests(); const pool = cardPool(h);
    const old = draftAll(h, newRun(h, 11, { deck: 'oldSchool' }));
    expect(old.squad.every(id => pool.byId.get(id)!.end < 1980)).toBe(true);
    expect(old.cap).toBe(80);
    const pace = draftAll(h, newRun(h, 12, { deck: 'paceSpace' }));
    expect(pace.squad.every(id => pool.byId.get(id)!.end >= 2010)).toBe(true);
    expect(pace.items).toContain('sevenSeconds');
    const big = newRun(h, 13, { deck: 'bigMen' });
    expect(big.offer.every(id => ['C', 'PF'].includes(pool.byId.get(id)!.pos))).toBe(true);
    const dyn = newRun(h, 14, { deck: 'dynasty' });
    expect(dyn.squad).toHaveLength(2);
    const [x, y] = dyn.squad.map(id => pool.byId.get(id)!);
    expect(`${x.team}@${x.end}`).toBe(`${y.team}@${y.end}`);
  }, 120_000);

  it('difficulty changes lives and opponents', async () => {
    const h = await loadHistoryForTests();
    const teams = new Map(huntTeams(h).map(t => [t.id, t]));
    const str = (r: HuntRun) => r.stops.slice(0, 5).reduce((n, s) => n + teams.get(s.teamId)!.strength, 0) / 5;
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
    expect(a.stops).toEqual(b.stops);
    expect(a.offer).toEqual(b.offer);
    const done: HuntRun = { ...a, stage: 'lost', stopIndex: 2, results: [{ stop: 0, teamId: a.stops[0].teamId, us: 100, them: 90, won: true }] };
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
