import { describe, expect, it } from 'vitest';
import { isShowdownWeekend, showdownPair, showdownResult, type ClubWeekRow } from '../cloud/clubs';

const row = (clubId: string, points: number): ClubWeekRow => ({ clubId, name: clubId.toUpperCase(), tag: clubId, badge: 'star', color: 'gold', points, players: 3 });
const board = [row('a', 900), row('b', 700), row('c', 400), row('d', 400), row('e', 100)];

describe('Weekend Showdown', () => {
  it('runs Friday to Sunday (UTC)', () => {
    expect(isShowdownWeekend(new Date('2026-10-09T12:00:00Z'))).toBe(true); // Friday
    expect(isShowdownWeekend(new Date('2026-10-11T23:59:00Z'))).toBe(true); // Sunday
    expect(isShowdownWeekend(new Date('2026-10-12T00:00:00Z'))).toBe(false); // Monday
    expect(isShowdownWeekend(new Date('2026-10-08T12:00:00Z'))).toBe(false); // Thursday
  });
  it('pairs clubs next to each other on the board', () => {
    expect(showdownPair(board, 'a')?.rival.clubId).toBe('b');
    expect(showdownPair(board, 'b')?.rival.clubId).toBe('a');
    expect(showdownPair(board, 'd')?.rival.clubId).toBe('c');
    expect(showdownPair(board, 'e')).toBeNull(); // odd one out
    expect(showdownPair(board, 'zzz')).toBeNull();
  });
  it('settles won, lost and level', () => {
    expect(showdownResult(board, 'a')?.outcome).toBe('won');
    expect(showdownResult(board, 'b')?.outcome).toBe('lost');
    expect(showdownResult(board, 'c')?.outcome).toBe('level');
  });
});
