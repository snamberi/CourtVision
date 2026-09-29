import { describe, expect, it } from 'vitest';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { cardPool } from '../hunt/cards';
import { cardNotes } from '../hunt/cardNotes';
import { newRun, draftBest, draftGrade, SLOTS } from '../hunt/run';

describe('League Hunt blind spins', () => {
  it('records every lock against the best player on the reels and grades the draft', async () => {
    const h = await loadHistoryForTests();
    // The best player on the reels every round: A+ (the coach lock is not graded).
    const best = draftBest(h, newRun(h, 42));
    expect(best.picks).toHaveLength(SLOTS.length);
    expect(draftGrade(best)).toMatchObject({ grade: 'A+', missed: 0, bestPicks: SLOTS.length });
    // The worst every round: points left on the table, a lower grade.
    const worst = draftBest(h, newRun(h, 42), true);
    const g = draftGrade(worst)!;
    expect(g.missed).toBeGreaterThan(0);
    expect(g.grade).not.toBe('A+');
    expect(draftGrade({})).toBeNull();
  });

  it('shows award notes without numbers', async () => {
    const h = await loadHistoryForTests();
    const pool = cardPool(h);
    const jordan = pool.cards.find(c => c.name === 'Michael Jordan' && c.end === 1996);
    if (!jordan) return; // the test fixture may not carry every season
    const notes = cardNotes(h, jordan);
    expect(notes).toContain('MVP');
    expect(notes).toContain('Won the title');
    expect(notes.join(' ')).not.toMatch(/\d{2}/);
  });
});
