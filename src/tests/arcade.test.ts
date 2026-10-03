import { describe, it, expect, beforeAll } from 'vitest';
import type { NbaHistory } from '../history/nbaHistoryData';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { allFacts, isNotable } from '../arcade/facts';
import { dailyAnswer, answerPool, compare, puzzleNumber, searchPlayers, guessable, shareText } from '../arcade/guess';
import { hiloPool, nextRound, isRight, mulberry } from '../arcade/hilo';
import { bracketField, slotTeams, playSeries, scorePicks, FIRST_ROUND, BRACKET_ERAS } from '../arcade/bracket';
import { randomAnswer, endlessPool } from '../arcade/guess';
import { quizRound, quizPoints, QUIZ_ERAS, QUIZ_LENGTH } from '../arcade/quiz';
import { guessPoints, guessWeeks, guessStreak, mergeArcade, arcadeXp, readArcade, endlessOf, BRACKET_MAX, type ArcadeRecords } from '../arcade/storage';
import { xpParts } from '../profile/profile';
import { derive } from '../../server/derive';

let h: NbaHistory;
beforeAll(async () => { h = await loadHistoryForTests(); }, 60_000);
const fact = (name: string) => allFacts(h).find(f => f.name === name)!;
const empty = (): ArcadeRecords => ({ guess: {}, hilo: { best: 0, runs: 0, weeks: {} }, bracket: {} });

describe('player facts', () => {
  it('works out career lines from the real data', () => {
    const curry = fact('Stephen Curry'), mj = fact('Michael Jordan');
    expect(curry.team).toBe('Golden State');
    expect(mj.franchise).toBe('CHI');
    expect(mj.ppg).toBeCloseTo(30.1, 1);
    expect(mj.rings).toBe(6);
    expect(mj.allStars).toBeGreaterThanOrEqual(14);
  });
  it('keeps the answers to well-known NBA players', () => {
    const pool = answerPool(h);
    expect(pool.length).toBeGreaterThan(150);
    expect(pool.every(isNotable)).toBe(true);
    expect(pool.map(f => f.name)).toContain('Michael Jordan');
  });
});

describe('Guess the Player', () => {
  it('gives everyone the same answer each day, and a new one the next day', () => {
    expect(dailyAnswer(h, '2026-10-05').idx).toBe(dailyAnswer(h, '2026-10-05').idx);
    expect(dailyAnswer(h, '2026-10-05').idx).not.toBe(dailyAnswer(h, '2026-10-06').idx);
    expect(puzzleNumber('2026-10-02')).toBe(1);
    expect(puzzleNumber('2026-10-11')).toBe(10);
  });
  it('marks each column right, close or wrong with a direction', () => {
    const mj = fact('Michael Jordan'), curry = fact('Stephen Curry');
    expect(compare(mj, mj).every(c => c.mark === 'hit')).toBe(true);
    const cells = Object.fromEntries(compare(curry, mj).map(c => [c.label, c]));
    expect(cells.Team.mark).toBe('miss');
    expect(cells.Pos.mark).toBe('close');
    expect(cells.Height.arrow).toBe('up');
    expect(cells.Debut.arrow).toBe('down');
  });
  it('finds players by any part of the name, best known first', () => {
    const hits = searchPlayers(guessable(h), 'jordan');
    expect(hits[0].name).toBe('Michael Jordan');
    expect(searchPlayers(guessable(h), 'j')).toEqual([]);
  });
  it('scores fewer guesses higher, adds up the week and counts a streak', () => {
    expect(guessPoints({ guesses: [1], won: true })).toBe(600);
    expect(guessPoints({ guesses: [1, 2, 3, 4, 5, 6], won: true })).toBe(100);
    expect(guessPoints({ guesses: [1, 2, 3, 4, 5, 6], won: false })).toBe(0);
    const r = { ...empty(), guess: { '2026-10-05': { guesses: [1, 2], won: true }, '2026-10-06': { guesses: [1], won: true }, '2026-10-07': { guesses: [1, 2, 3, 4, 5, 6], won: false } } };
    expect(guessWeeks(r)['2026-W41']).toEqual({ score: 1100, days: 3, solved: 2 });
    expect(guessStreak(r, '2026-10-06')).toEqual({ current: 2, best: 2 });
    expect(guessStreak(r, '2026-10-08')).toEqual({ current: 0, best: 2 });
  });
  it('shares squares, not the answer', () => {
    const mj = fact('Michael Jordan');
    const text = shareText('2026-10-05', { guesses: [1, 2], won: true }, [compare(fact('Stephen Curry'), mj), compare(mj, mj)], 'https://x');
    expect(text).toContain('#4 2/6');
    expect(text).not.toContain('Jordan');
    expect(text.split('\n')[2]).toBe('🟩🟩🟩🟩🟩🟩');
  });
});

describe('Higher or Lower', () => {
  it('always asks about a number the two players differ on', () => {
    const pool = hiloPool(h), byIdx = new Map(pool.map(f => [f.idx, f])), rand = mulberry(7);
    let a = pool[0];
    for (let i = 0; i < 200; i++) {
      const r = nextRound(pool, a, rand, new Set([a.idx]));
      const fa = byIdx.get(r.a)!, fb = byIdx.get(r.b)!;
      expect(fa[r.stat]).not.toBe(fb[r.stat]);
      expect(isRight(r, byIdx, true)).toBe(!isRight(r, byIdx, false));
      a = fb;
    }
  });
});

describe('Higher or Lower variety', () => {
  it('never asks about the same number three rounds running when another would do', () => {
    const pool = hiloPool(h), rand = mulberry(11);
    let a = pool[3], recent: string[] = [];
    for (let i = 0; i < 300; i++) {
      const r = nextRound(pool, a, rand, new Set([a.idx]), recent as never);
      if (recent.length === 2 && recent[0] === recent[1]) expect(r.stat).not.toBe(recent[0]);
      recent = [r.stat, ...recent].slice(0, 2);
      a = pool.find(f => f.idx === r.b)!;
    }
  });
});

describe('Bracket Challenge', () => {
  it('seeds sixteen different franchises and plays the same series for everyone', () => {
    const field = bracketField(h, '2026-W41');
    expect(field).toHaveLength(16);
    expect(new Set(field.map(t => t.abbr)).size).toBe(16);
    for (let i = 1; i < 16; i++) expect(field[i - 1].strength).toBeGreaterThanOrEqual(field[i].strength);
    const [hi, lo] = FIRST_ROUND[0];
    const a = playSeries(h, '2026-W41', 0, field[hi - 1], field[lo - 1]), b = playSeries(h, '2026-W41', 0, field[hi - 1], field[lo - 1]);
    expect(a).toEqual(b);
    expect(Math.max(a.winsHigh, a.winsLow)).toBe(4);
    expect(a.games.length).toBeGreaterThanOrEqual(4);
    expect(a.games.length).toBeLessThanOrEqual(7);
  }, 60_000);
  it('fills later rounds from earlier winners and scores picks by round', () => {
    const field = bracketField(h, '2026-W41');
    const winners: string[] = FIRST_ROUND.map(([x]) => field[x - 1].id);
    expect(slotTeams(field, winners, 8)).toEqual([winners[0], winners[1]]);
    expect(slotTeams(field, winners, 11)).toEqual([winners[6], winners[7]]);
    expect(slotTeams(field, [], 12)).toEqual([null, null]);
    const results = Array.from({ length: 15 }, (_, slot) => ({ slot, high: 'a', low: 'b', winsHigh: 4, winsLow: 0, winner: 'a', games: [] }));
    expect(scorePicks(Array(15).fill('a'), results)).toBe(BRACKET_MAX);
    expect(scorePicks([...Array(14).fill('b'), 'a'], results)).toBe(80);
  });
});

describe('quick games records', () => {
  it('merge two devices: finished days, best streaks, played brackets', () => {
    const a = { ...empty(), guess: { '2026-10-05': { guesses: [1, 2, 3], won: true } }, hilo: { best: 9, runs: 4, weeks: { '2026-W41': 9 } } };
    const b = { ...empty(), guess: { '2026-10-05': { guesses: [1], won: false } }, hilo: { best: 12, runs: 2, weeks: { '2026-W41': 3 } }, bracket: { '2026-W41': { picks: [], locked: true, played: true, score: 120 } } };
    const m = mergeArcade(a, b);
    expect(m.guess['2026-10-05'].won).toBe(true);
    expect(m.hilo).toEqual({ best: 12, runs: 4, weeks: { '2026-W41': 9 } });
    expect(m.bracket['2026-W41'].score).toBe(120);
  });
  it('go on the weekly boards, and nonsense is dropped', () => {
    const records: ArcadeRecords = {
      guess: { '2026-10-05': { guesses: [1, 2], won: true }, '2026-10-06': { guesses: [1, 2, 3, 4, 5, 6, 7, 8], won: true } },
      hilo: { best: 14, runs: 3, weeks: { '2026-W41': 14, '2026-W42': 99999 } },
      bracket: { '2026-W41': { picks: [], locked: true, played: true, score: 150, champion: 'CHI@1996' }, '2026-W40': { picks: [], locked: true, played: true, score: 155 } },
    };
    const d = derive({ version: 1, updatedAt: Date.now(), storage: { 'cv-arcade': JSON.stringify(records) }, careers: [] }, new Date('2026-10-08T12:00:00Z'));
    const rows = d.weekly.filter(w => ['guess', 'hilo', 'bracket'].includes(w.board));
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ board: 'guess', week: '2026-W41', score: 500 }),
      expect.objectContaining({ board: 'hilo', week: '2026-W41', score: 14 }),
      expect.objectContaining({ board: 'bracket', week: '2026-W41', score: 150 }),
    ]));
    expect(rows).toHaveLength(3);
  });
});

describe('quick games XP', () => {
  it('counts solved days, played brackets and each week\'s best streak (capped)', () => {
    const r: ArcadeRecords = {
      guess: { '2026-10-05': { guesses: [1, 2], won: true }, '2026-10-06': { guesses: [1, 2, 3, 4, 5, 6], won: false } },
      hilo: { best: 30, runs: 9, weeks: { '2026-W41': 30, '2026-W42': 5 } },
      bracket: { '2026-W41': { picks: [], locked: true, played: true, score: 150 }, '2026-W42': { picks: [], locked: false, played: false, score: 0 } },
    };
    expect(arcadeXp(r)).toEqual({ xp: 20 + (40 + 15) + (40 + 10), solved: 1, brackets: 1, hiloWeeks: 2 });
  });
  it('shows up in the profile XP', () => {
    const store: Record<string, string> = { 'cv-arcade': JSON.stringify({ guess: { '2026-10-05': { guesses: [1], won: true } }, hilo: { best: 0, runs: 0, weeks: {} }, bracket: {} }) };
    expect(xpParts(k => store[k] ?? null).find(p => p.id === 'arcade')?.xp).toBe(20);
  });
});

describe('endless play', () => {
  it('draws random answers that avoid recent ones, from a famous or a deeper pool', () => {
    const famous = endlessPool(h, 'famous'), deep = endlessPool(h, 'deep');
    expect(deep.length).toBeGreaterThan(famous.length);
    const rand = mulberry(3), seen = new Set<number>();
    for (let i = 0; i < 50; i++) { const a = randomAnswer(h, 'famous', rand, seen); expect(seen.has(a.idx)).toBe(false); seen.add(a.idx); }
  });
  it('builds a 16-team bracket for every era, one franchise each, and the weekly field is unchanged', () => {
    for (const era of BRACKET_ERAS) {
      const field = bracketField(h, 'random-42', era.id);
      expect(field).toHaveLength(16);
      expect(new Set(field.map(t => t.abbr)).size).toBe(16);
      expect(field.every(t => t.end >= era.from && t.end <= era.to)).toBe(true);
    }
    expect(bracketField(h, '2026-W41', 'all').map(t => t.id)).toEqual(bracketField(h, '2026-W41').map(t => t.id));
    expect(bracketField(h, 'random-1').map(t => t.id)).not.toEqual(bracketField(h, 'random-2').map(t => t.id));
  });
  it('keeps and merges endless totals, and old records read with zeros', () => {
    expect(endlessOf(readArcade(() => JSON.stringify({ guess: {}, hilo: { best: 1, runs: 1, weeks: {} }, bracket: {} }))).quiz).toEqual({ played: 0, best: 0, right: 0, answered: 0 });
    const a = { ...empty(), endless: { guess: { played: 5, won: 3, streak: 2, best: 3 }, bracket: { played: 1, best: 150 }, quiz: { played: 2, best: 900, right: 14, answered: 20 } } };
    const b = { ...empty(), endless: { guess: { played: 2, won: 2, streak: 2, best: 4 }, bracket: { played: 4, best: 90 }, quiz: { played: 1, best: 1200, right: 8, answered: 10 } } };
    const m = mergeArcade(a, b).endless!;
    expect(m.guess).toEqual({ played: 5, won: 3, streak: 2, best: 4 });
    expect(m.bracket).toEqual({ played: 4, best: 150 });
    expect(m.quiz.best).toBe(1200);
  });
});

describe('NBA Quiz', () => {
  it('writes ten different questions with four distinct options and one right answer, in every era', () => {
    for (const era of QUIZ_ERAS) {
      for (let seed = 1; seed <= 5; seed++) {
        const round = quizRound(h, era.id, mulberry(seed * 97));
        expect(round).toHaveLength(QUIZ_LENGTH);
        expect(new Set(round.map(q => q.text)).size).toBe(QUIZ_LENGTH);
        for (const q of round) {
          expect(q.options).toHaveLength(4);
          expect(new Set(q.options).size).toBe(4);
          expect(q.answer).toBeGreaterThanOrEqual(0);
          expect(q.answer).toBeLessThan(4);
        }
        expect(new Set(round.map(q => q.kind)).size).toBeGreaterThanOrEqual(4);
      }
    }
  }, 60_000);
  it('gets the facts right', () => {
    const qs = Array.from({ length: 40 }, (_, i) => quizRound(h, 'all', mulberry(1000 + i))).flat();
    const champ = qs.find(q => q.text === 'Who won the 1995-96 NBA title?');
    if (champ) expect(champ.options[champ.answer]).toBe('Chicago');
    const mvp = qs.find(q => q.kind === 'mvp');
    expect(mvp).toBeDefined();
    expect(quizPoints(true, 0)).toBe(150);
    expect(quizPoints(true, 20_000)).toBe(100);
    expect(quizPoints(false, 0)).toBe(0);
  });
});
