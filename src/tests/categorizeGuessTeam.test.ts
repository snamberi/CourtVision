import { describe, it, expect, beforeAll } from 'vitest';
import type { NbaHistory } from '../history/nbaHistoryData';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { categorizePuzzle, dailyCategorize, checkPick, type CategorizeLevel } from '../arcade/categorize';
import { guessTeamPuzzle, GUESS_TEAM_ERAS, type GuessTeamLevel } from '../arcade/guessTeam';
import { mergeArcade, endlessOf, readArcade, type ArcadeRecords } from '../arcade/storage';

let h: NbaHistory;
beforeAll(async () => { h = await loadHistoryForTests(); }, 60_000);

describe('Categorize', () => {
  it('builds sixteen different players in four categories, each player in exactly one', () => {
    for (const level of ['easy', 'normal', 'hard'] as CategorizeLevel[]) {
      for (let seed = 1; seed <= 6; seed++) {
        const p = categorizePuzzle(h, seed * 7919, level);
        expect(p.groups).toHaveLength(4);
        expect(p.tiles).toHaveLength(16);
        expect(new Set(p.tiles.map(t => t.playerId)).size).toBe(16);
        expect(new Set(p.groups.map(g => g.id)).size).toBe(4);
        for (const g of p.groups) expect(g.players).toHaveLength(4);
        expect(p.tiles.every(t => t.name && !/^\d/.test(t.name))).toBe(true);
      }
    }
  });
  it('checks picks: a full category solves, three of four is one away, and the daily board is the same for everyone', () => {
    const p = categorizePuzzle(h, 42);
    const [a, b] = p.groups;
    expect(checkPick(p, a.players, [])).toEqual({ kind: 'solved', group: a });
    expect(checkPick(p, [...a.players.slice(0, 3), b.players[0]], [])).toEqual({ kind: 'miss', oneAway: true });
    expect(checkPick(p, [a.players[0], a.players[1], b.players[0], b.players[1]], [])).toEqual({ kind: 'miss', oneAway: false });
    expect(checkPick(p, a.players.slice(0, 3), []).kind).toBe('invalid');
    expect(dailyCategorize(h, '2026-10-14').tiles).toEqual(dailyCategorize(h, '2026-10-14').tiles);
    expect(dailyCategorize(h, '2026-10-14').tiles).not.toEqual(dailyCategorize(h, '2026-10-15').tiles);
  });
});

describe('Guess the Team', () => {
  it('shows a real starting five with one clue each, and the answer is among the choices', () => {
    for (const level of ['easy', 'normal', 'hard'] as GuessTeamLevel[]) {
      for (let seed = 1; seed <= 6; seed++) {
        const p = guessTeamPuzzle(h, seed * 104729, level);
        expect(p.starters).toHaveLength(5);
        expect(new Set(p.starters.map(s => s.playerId)).size).toBe(5);
        expect(p.starters.every(s => s.clues.length >= 1)).toBe(true);
        // Clues never give away the team or the player.
        for (const s of p.starters) for (const c of s.clues) {
          expect(c.text).not.toContain(s.name);
          expect(c.text).not.toContain(p.teamName);
        }
        expect(p.choices.some(c => c.abbr === p.abbr)).toBe(true);
        expect(new Set(p.choices.map(c => c.name)).size).toBe(p.choices.length); // the Lakers and Clippers never look alike
        expect(p.choices.length).toBeGreaterThan(7);
      }
    }
  });
  it('only picks seasons from the eras switched on', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const p = guessTeamPuzzle(h, seed * 31, 'normal', [1990]);
      expect(p.season - 1).toBeGreaterThanOrEqual(1990);
      expect(p.season - 1).toBeLessThan(2000);
    }
    expect(GUESS_TEAM_ERAS).toContain(1950);
  });
  it('keeps and merges the new quick-game records', () => {
    const empty = (): ArcadeRecords => ({ guess: {}, hilo: { best: 0, runs: 0, weeks: {} }, bracket: {} });
    expect(endlessOf(readArcade(() => JSON.stringify(empty()))).categorize).toEqual({ played: 0, won: 0, perfect: 0, streak: 0, best: 0 });
    const a = { ...empty(), endless: { ...endlessOf(empty()), guessTeam: { played: 4, won: 2, streak: 1, best: 2 } } };
    const b = { ...empty(), endless: { ...endlessOf(empty()), guessTeam: { played: 2, won: 2, streak: 2, best: 3 } } };
    expect(mergeArcade(a, b).endless!.guessTeam).toEqual({ played: 4, won: 2, streak: 2, best: 3 });
  });
});
