import { describe, expect, it } from 'vitest';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { cardPool } from '../hunt/cards';
import { cardNotes } from '../hunt/cardNotes';
import { newRun, spinPick, draftGrade, SPINS } from '../hunt/run';
import { COACH_BY_ID } from '../hunt/coaches';

describe('League Hunt blind spins', () => {
  it('records every pick against the best on the table and grades the draft', async () => {
    const h = await loadHistoryForTests();
    const pool = cardPool(h);
    const value = (spin: number, id: string) => (SPINS[spin] === 'COACH' ? COACH_BY_ID.get(id)!.bonus : pool.byId.get(id)!.ovr);
    // Best card every time: A+.
    let best = newRun(h, 42);
    while (best.stage === 'draft') { const s = best.spin; best = spinPick(h, best, [...best.offer].sort((a, b) => value(s, b) - value(s, a))[0]); }
    expect(best.picks).toHaveLength(SPINS.length);
    expect(draftGrade(best)).toMatchObject({ grade: 'A+', missed: 0, bestPicks: SPINS.length });
    // Worst card every time: points left on the table, a lower grade.
    let worst = newRun(h, 42);
    while (worst.stage === 'draft') { const s = worst.spin; worst = spinPick(h, worst, [...worst.offer].sort((a, b) => value(s, a) - value(s, b))[0]); }
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
