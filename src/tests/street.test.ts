import { describe, it, expect } from 'vitest';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { legendsField, simulateBracket, opponentFor, playRound, playStreet, bracketOrder, FIELD } from '../arcade/street';

describe('street ball', () => {
  it('1v1 to 11 and 3v3 to 21, win by two, and the same seed plays the same game', async () => {
    const h = await loadHistoryForTests();
    const f = legendsField(h);
    expect(f).toHaveLength(FIELD);
    const g = playStreet([f[0]], [f[63]], 11, 7);
    expect(Math.max(...g.score)).toBeGreaterThanOrEqual(11);
    expect(Math.abs(g.score[0] - g.score[1])).toBeGreaterThanOrEqual(2);
    expect(playStreet([f[0]], [f[63]], 11, 7)).toEqual(g);
    const t = playStreet(f.slice(0, 3), f.slice(3, 6), 21, 3);
    expect(Math.max(...t.score)).toBeGreaterThanOrEqual(21);
    // Better players win more often.
    let wins = 0; for (let i = 0; i < 40; i++) if (playStreet([f[0]], [f[63]], 11, i).winner === 0) wins++;
    expect(wins).toBeGreaterThan(20);
  }, 120_000);
  it('the weekly bracket: 64 seeds, a champion, and your opponents round by round', async () => {
    const h = await loadHistoryForTests();
    const f = legendsField(h);
    expect(new Set(bracketOrder()).size).toBe(64);
    const b = simulateBracket(f, '2026-W40');
    expect(b.rounds.map(r => r.length)).toEqual([64, 32, 16, 8, 4, 2, 1]);
    expect(simulateBracket(f, '2026-W40').champion.id).toBe(b.champion.id);
    const mine = f[10];
    for (let r = 0; r < 6; r++) { const opp = opponentFor(f, '2026-W40', mine, r); expect(opp).toBeTruthy(); expect(opp!.id).not.toBe(mine.id); }
    expect(playRound('2026-W40', 0, mine, opponentFor(f, '2026-W40', mine, 0)!)).toEqual(playRound('2026-W40', 0, mine, opponentFor(f, '2026-W40', mine, 0)!));
  }, 120_000);
});
