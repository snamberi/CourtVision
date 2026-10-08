// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { cardPool } from '../hunt/cards';
import { dailyGrid, makeGrid, answers, emptyPlay, guessCell, gridScore, isGridDone, gridShareText, rarity, playersOf, MIN_ANSWERS, GRID_GUESSES } from '../arcade/grid';
import { mergeArcade, gridStreak, readArcade, type ArcadeRecords } from '../arcade/storage';
import { newBattle, battlePick, boardOf, sideAt, sideCards, playBattleGame, seriesScore, battleWinner, BATTLE_PICKS, BATTLE_WINS } from '../perfect/battle';
import { categories, categoryById, comboCategory, comboSize, MIN_CATEGORY } from '../perfect/categories';
import { newPerfectRun, categoryLocked, rerollCategory, pickPlayer, categoryPool } from '../perfect/run';
import { decodeDuel, encodeDuel } from '../retention/duel';

describe('Daily Grid', () => {
  it('builds the same grid all day: three teams, three columns from different groups, every square answerable', async () => {
    const h = await loadHistoryForTests();
    for (const day of ['2027-03-10', '2027-03-11', '2027-04-01']) {
      const a = dailyGrid(h, day), b = dailyGrid(h, day);
      expect(a.rows.map(r => r.id)).toEqual(b.rows.map(r => r.id));
      expect(a.cols.map(c => c.id)).toEqual(b.cols.map(c => c.id));
      expect(a.rows.every(r => r.group === 'Teams')).toBe(true);
      expect(new Set(a.cols.map(c => c.group)).size).toBe(3);
      for (const r of a.rows) for (const c of a.cols) expect(answers(r, c).length).toBeGreaterThanOrEqual(MIN_ANSWERS);
    }
    const sig = (d: string) => { const g = dailyGrid(h, d); return [...g.rows, ...g.cols].map(c => c.id).join(); };
    expect(new Set(['2027-03-10', '2027-03-11', '2027-03-12', '2027-03-13'].map(sig)).size).toBe(4);
  });

  it('a right answer fills its square, a wrong one costs a guess, and nobody goes in twice', async () => {
    const h = await loadHistoryForTests();
    const g = makeGrid(h, 'test-1');
    const right = answers(g.rows[0], g.cols[0])[0];
    let r = guessCell(g, emptyPlay(), 0, right);
    expect(r.right).toBe(true);
    expect(r.play.cells[0]).toBe(right);
    // The same player again, in a square he also fits: no.
    const again = guessCell(g, r.play, 1, right);
    expect(again.right).toBe(false);
    expect(again.play.used).toBe(2);
    // Someone who fits neither row: a miss.
    const outsider = cardPool(h).cards.find(c => !playersOf(g.rows[0]).has(c.playerId))!.playerId;
    r = guessCell(g, again.play, 2, outsider);
    expect(r.right).toBe(false);
    expect(r.play.cells[2]).toBe('');
    // Score: 100 a square plus rarity; rarity is 0-100.
    const s = gridScore(h, g, r.play);
    expect(s.filled).toBe(1);
    expect(s.score).toBe(100 + rarity(h, g.rows[0], g.cols[0], right));
    let p = r.play;
    while (!isGridDone(p)) p = guessCell(g, p, p.cells.findIndex(x => !x), outsider).play;
    expect(p.used).toBe(GRID_GUESSES);
    expect(gridShareText('2026-10-08', h, g, p, 'https://x')).toMatch(/Grid #1: 1\/9/);
  });

  it('grid days merge across devices and count toward a streak', () => {
    const base = readArcade(() => null);
    const full = { cells: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'], used: 9 };
    const a: ArcadeRecords = { ...base, grid: { '2027-03-10': full, '2027-03-11': { cells: ['a', '', '', '', '', '', '', '', ''], used: 3 } } };
    const b: ArcadeRecords = { ...base, grid: { '2027-03-11': { cells: ['a', 'b', '', '', '', '', '', '', ''], used: 9 }, '2027-03-12': full } };
    const m = mergeArcade(a, b);
    expect(m.grid?.['2027-03-11'].cells.filter(Boolean).length).toBe(2);
    expect(gridStreak(m, '2027-03-12')).toEqual({ current: 3, best: 3 });
    // Junk in storage is dropped, not trusted.
    const junk = readArcade(() => JSON.stringify({ grid: { nope: full, '2027-01-01': { cells: [1, 2], used: 99 } } }));
    expect(junk.grid).toEqual({});
  });
});

describe('Draft Battle', () => {
  it('snakes 1-2-2-1, the AI answers, and both teams end with eight different players', async () => {
    const h = await loadHistoryForTests();
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(sideAt)).toEqual([0, 1, 1, 0, 0, 1, 1, 0]);
    let b = newBattle(h, 77, 'pro');
    expect(categoryById(h, b.cat)!.size).toBeGreaterThanOrEqual(40);
    b = battlePick(h, b, boardOf(h, b)[0].id);
    // You, then the AI's two.
    expect(b.picks.length).toBe(3);
    while (b.stage === 'draft') b = battlePick(h, b, boardOf(h, b)[0].id);
    expect(b.stage).toBe('series');
    expect(sideCards(b, 0).length).toBe(BATTLE_PICKS);
    expect(sideCards(b, 1).length).toBe(BATTLE_PICKS);
    expect(new Set(b.picks.map(id => cardPool(h).byId.get(id)!.playerId)).size).toBe(BATTLE_PICKS * 2);
    // A pick that isn't on the board does nothing.
    expect(battlePick(h, b, b.picks[0])).toBe(b);
    while (b.stage === 'series') b = playBattleGame(h, b);
    const s = seriesScore(b);
    expect(Math.max(s.a, s.b)).toBe(BATTLE_WINS);
    expect(battleWinner(b)).toBe(s.a > s.b ? 0 : 1);
  });

  it('a friend battle waits for both players, and the same picks play the same series', async () => {
    const h = await loadHistoryForTests();
    let b = newBattle(h, 5, 'friend', ['Ann', 'Bo']);
    b = battlePick(h, b, boardOf(h, b)[0].id);
    expect(b.picks.length).toBe(1);
    while (b.stage === 'draft') b = battlePick(h, b, boardOf(h, b)[0].id);
    const one = playBattleGame(h, b), two = playBattleGame(h, b);
    expect(one.games).toEqual(two.games);
  });
});

describe('Custom categories', () => {
  it('combines up to three categories from different groups', async () => {
    const h = await loadHistoryForTests();
    const lakers = categories(h).find(c => c.name === 'Los Angeles Lakers')!;
    const allStar = categoryById(h, 'allstar')!;
    const combo = comboCategory(h, [lakers.id, allStar.id]);
    expect(combo).toBeTruthy();
    expect(combo!.size).toBe(comboSize(h, [lakers.id, allStar.id]));
    const lakerIds = new Set(lakers.pool.map(c => c.playerId)), starIds = new Set(allStar.pool.map(c => c.playerId));
    for (const c of combo!.pool) { expect(lakerIds.has(c.playerId)).toBe(true); expect(starIds.has(c.playerId)).toBe(true); }
    // Two teams: not allowed (same group).
    const celtics = categories(h).find(c => c.name === 'Boston Celtics')!;
    expect(comboCategory(h, [lakers.id, celtics.id])).toBeNull();
    expect(comboSize(h, [lakers.id, celtics.id])).toBe(0);
    // Three parts, looked up by id.
    const era = categories(h).find(c => c.id === 'd1980')!;
    const three = comboSize(h, [lakers.id, era.id, allStar.id]);
    if (three >= MIN_CATEGORY) expect(categoryById(h, `${lakers.id}+${era.id}+allstar`)?.size).toBe(three);
  });

  it('a custom run drafts its starters from it, locked, and duels carry it', async () => {
    const h = await loadHistoryForTests();
    const lakers = categories(h).find(c => c.name === 'Los Angeles Lakers')!;
    const id = `${lakers.id}+allstar`;
    let run = newPerfectRun(h, 'category', 9, undefined, { custom: id });
    expect(run.cat).toBe(id);
    expect(run.custom).toBe(id);
    expect(categoryLocked(run)).toBe(true);
    expect(rerollCategory(h, run)).toBe(run);
    for (let i = 0; i < 5; i++) run = pickPlayer(h, run, categoryPool(h, run)[0].id);
    expect(run.cats!.slice(0, 5).every(c => c === id)).toBe(true);
    const code = encodeDuel({ v: 1, m: 'perfect', s: 9, pm: 'category', cc: id, n: 'Sam', r: { score: 1, line: '', won: false } });
    expect(decodeDuel(code)?.cc).toBe(id);
    const bad = btoa(JSON.stringify({ v: 1, m: 'perfect', s: 9, pm: 'category', cc: '<script>', n: 'x', r: { score: 1, line: '', won: false } }));
    expect(decodeDuel(bad)?.cc).toBeUndefined();
    // An unknown custom id falls back to a normal roll.
    expect(newPerfectRun(h, 'category', 9, undefined, { custom: 'nope+nada' }).custom).toBeUndefined();
  });
});
