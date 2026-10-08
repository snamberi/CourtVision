// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { cardPool } from '../hunt/cards';
import { categories, categoryById, mixedCategory, scoutTag, weeklyCategory } from '../perfect/categories';
import { newPerfectRun, autoPick, categoryLocked, rerollCategory, optionMultiplier, bestFive, STARTERS } from '../perfect/run';
import { categoryTitles, categoryBrutal, mergePerfectRecords, type PerfectRecords } from '../perfect/storage';
import { decodeDuel, encodeDuel } from '../retention/duel';
import { newRun, stopReels, lockReel, DECKS, type SpinKind } from '../hunt/run';
import { huntRoundCategory } from '../hunt/categoryDeck';
import { deckUnlocked } from '../hunt/storage';

describe('Category Draft extras', () => {
  it('mixed categories hold players who fit both, and can be looked up by id', async () => {
    const h = await loadHistoryForTests();
    const lakers = categories(h).find(c => c.name === 'Los Angeles Lakers')!;
    const nineties = categories(h).find(c => c.group === 'Eras' && /90s/.test(c.name))!;
    const mix = mixedCategory(h, lakers.id, nineties.id);
    if (mix) {
      expect(mix.group).toBe('Mixed');
      expect(categoryById(h, mix.id)?.size).toBe(mix.size);
      const lakerIds = new Set(lakers.pool.map(c => c.playerId));
      for (const c of mix.pool) expect(lakerIds.has(c.playerId)).toBe(true);
    }
  });

  it('the weekly category is the same all week, never a Names category, and locks the starters', async () => {
    const h = await loadHistoryForTests();
    const a = weeklyCategory(h, '2026-W41'), b = weeklyCategory(h, '2026-W41');
    expect(a.id).toBe(b.id);
    expect(a.group).not.toBe('Names');
    expect(['B', 'C', 'D']).toContain(a.tier);
    const run = newPerfectRun(h, 'category', 5, undefined, { weekly: '2026-W41' });
    expect(run.cat).toBe(a.id);
    expect(categoryLocked(run)).toBe(true);
    expect(rerollCategory(h, run)).toBe(run);
  });

  it('the shot clock auto-pick takes a player from the category, the same one every time', async () => {
    const h = await loadHistoryForTests();
    const run = newPerfectRun(h, 'category', 77, undefined, { catOpts: { clock: true } });
    const a = autoPick(h, run), b = autoPick(h, run);
    expect(a.squad.length).toBe(1);
    expect(a.squad).toEqual(b.squad);
    const cat = categoryById(h, run.cat!)!;
    const picked = cardPool(h).byId.get(a.squad[0])!;
    expect(cat.pool.some(c => c.playerId === picked.playerId)).toBe(true);
  });

  it('options change the score: tips cost, the clock and mixed rolls pay', () => {
    expect(optionMultiplier({})).toBe(1);
    expect(optionMultiplier({ catOpts: { tips: true } })).toBe(0.9);
    expect(optionMultiplier({ catOpts: { clock: true, mixed: true } })).toBe(1.21);
  });

  it('scouting tips are words, never numbers, and the best five are the top five', async () => {
    const h = await loadHistoryForTests();
    const mvp = categoryById(h, 'mvp')!;
    for (const c of mvp.pool.slice(0, 20)) expect(scoutTag(h, c)).toMatch(/^[A-Za-z -]+$/);
    const best = bestFive(h, 'mvp');
    expect(best.length).toBe(STARTERS);
    const top = Math.min(...best.map(c => c.ovr));
    expect(mvp.pool.filter(c => c.ovr > top).length).toBeLessThan(STARTERS);
  });

  it('duel codes carry the category options and drop junk', () => {
    const code = encodeDuel({ v: 1, m: 'perfect', s: 9, pm: 'slots', co: { tips: true, clock: true }, n: 'Sam', r: { score: 100, line: '60-22', won: false } });
    expect(decodeDuel(code)?.co).toEqual({ tips: true, clock: true });
    const junk = btoa(JSON.stringify({ v: 1, m: 'perfect', s: 9, pm: 'category', co: { evil: 1, mixed: 'yes' }, n: 'x', r: { score: 1, line: '', won: false } }));
    expect(decodeDuel(junk)?.co).toEqual({ mixed: true });
  });

  it('records: titles per category, brutal titles, and weekly bests merge', () => {
    const a: PerfectRecords = { runs: 2, titles: 2, perfectSeasons: 0, perfect98: 0, bestWins: 70, categories: { mvp: { w: 70, l: 12, champion: true, tier: 'S' }, x: { w: 60, l: 22, champion: true, tier: 'D' } },
      weekCat: { '2026-W41': { score: 9000, w: 60, l: 22, pw: 16, pl: 4, champion: true, mode: 'category', tries: 2 } } };
    const b: PerfectRecords = { runs: 1, titles: 0, perfectSeasons: 0, perfect98: 0, bestWins: 50, weekCat: { '2026-W41': { score: 12000, w: 65, l: 17, pw: 16, pl: 2, champion: true, mode: 'category', tries: 3 } } };
    expect(categoryTitles(a)).toBe(2);
    expect(categoryBrutal(a)).toBe(1);
    const m = mergePerfectRecords(a, b);
    expect(m.weekCat?.['2026-W41']).toMatchObject({ score: 12000, tries: 3 });
  });
});

describe('League Hunt Category Draft deck', () => {
  it('is open from the start and every round draws its reels from one seeded category', async () => {
    const h = await loadHistoryForTests();
    expect(deckUnlocked({ runs: 0, wins: 0, bestStop: 0 } as never, 'category')).toBe(true);
    let run = newRun(h, 31, { deck: 'category' });
    expect(run.coins).toBeGreaterThanOrEqual(DECKS.classic.coins + 30);
    const pool = cardPool(h);
    let inCat = 0, total = 0;
    for (let guard = 0; run.stage === 'draft' && guard < 10; guard++) {
      const cat = huntRoundCategory(h, run, run.spin)!;
      expect(cat).toBeTruthy();
      expect(huntRoundCategory(h, run, run.spin)!.id).toBe(cat.id);
      run = stopReels(h, run, cat);
      const ids = new Set(cat.pool.map(c => c.id));
      const players = Object.entries(run.reels ?? {}).filter(([k]) => k !== 'COACH');
      for (const [, id] of players) { total++; if (ids.has(id!)) inCat++; expect(pool.byId.get(id!)).toBeTruthy(); }
      run = lockReel(h, run, (players[0]?.[0] ?? 'COACH') as SpinKind);
    }
    expect(run.stage).toBe('focus');
    expect(run.squad.every(Boolean)).toBe(true);
    // Most reels come from the round's category (a reel it can't fill draws from everyone).
    expect(inCat / total).toBeGreaterThan(0.7);
    // Other decks roll no category.
    expect(huntRoundCategory(h, newRun(h, 31), 0)).toBeNull();
  });
});
