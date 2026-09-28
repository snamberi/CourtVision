// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { cardTier } from '../career/card';
import { pickVerdict, STEAL_GAP, REACH_GAP } from '../draft/wall';
import { baseline, rankChange, recordRanks, YOU } from '../cloud/rankHistory';
import type { BoardResult } from '../cloud/boards';

const DAY = 86_400_000;
const board: { result: BoardResult } = { result: { rows: [], total: 0, you: null } };
vi.mock('../cloud/boards', () => ({ loadBoard: () => Promise.resolve(board.result) }));
const { BoardTable } = await import('../components/cloud/BoardTable');

describe('career card tier', () => {
  it('follows the overall and turns to foil in the Hall of Fame', () => {
    expect(cardTier(65)).toBe('bronze');
    expect(cardTier(70)).toBe('silver');
    expect(cardTier(80)).toBe('gold');
    expect(cardTier(90)).toBe('holo');
    expect(cardTier(60, true)).toBe('foil');
  });
});

describe('draft wall verdicts', () => {
  it('marks steals and reaches only past their gaps', () => {
    expect(pickVerdict(10 + STEAL_GAP, 10)).toBe('steal');
    expect(pickVerdict(10 + STEAL_GAP - 1, 10)).toBeNull();
    expect(pickVerdict(5, 5 + REACH_GAP)).toBe('reach');
    expect(pickVerdict(5, 5 + REACH_GAP - 1)).toBeNull();
  });
});

describe('rank history', () => {
  const now = 100 * DAY + 5;
  it('keeps one snapshot a day for two weeks', () => {
    let h = recordRanks([], { a: 1 }, now - 20 * DAY);
    h = recordRanks(h, { a: 2 }, now - 3 * DAY);
    h = recordRanks(h, { a: 3 }, now);
    h = recordRanks(h, { a: 4 }, now + 60);
    expect(h.map(s => s.ranks.a)).toEqual([2, 4]);
  });
  it('compares with last week, or the oldest earlier snapshot before a week has passed', () => {
    const h = [{ day: 90, ranks: { a: 5 } }, { day: 92, ranks: { a: 4 } }, { day: 97, ranks: { a: 3 } }, { day: 100, ranks: { a: 1 } }];
    expect(baseline(h, now)?.day).toBe(92);
    expect(baseline([{ day: 98, ranks: {} }, { day: 99, ranks: {} }], now)?.day).toBe(98);
    expect(baseline([{ day: 100, ranks: {} }], now)).toBeNull();
    expect(rankChange({ day: 92, ranks: { a: 4 } }, 'a', 1)).toBe(3);
    expect(rankChange({ day: 92, ranks: { a: 4 } }, 'b', 1)).toBe('new');
    expect(rankChange(null, 'a', 1)).toBeNull();
  });
});

describe('leaderboard podium', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);
  const row = (i: number, you = false) => ({ rank: i + 1, userId: `u${i}`, username: `gm${i}`, score: 1000 - i * 10, detail: '', you });
  it('puts the top three on the podium and pins your rank when you are further down', async () => {
    const day = Math.floor(Date.now() / DAY) - 8;
    localStorage.setItem('cv-rank-history:{"kind":"gms"}', JSON.stringify([{ day, ranks: { u0: 2, u1: 1, [YOU]: 60 } }]));
    board.result = { rows: [0, 1, 2, 3, 4].map(i => row(i)), total: 80, you: { rank: 42, score: 500 } };
    render(<BoardTable spec={{ kind: 'gms' }} scoreLabel="XP" />);
    const podium = await screen.findByRole('list', { name: 'Top three' });
    expect(podium.querySelectorAll('.wb-step')).toHaveLength(3);
    expect(document.querySelectorAll('.wb-table tbody tr')).toHaveLength(2);
    const pinned = screen.getByRole('status');
    expect(pinned.textContent).toContain('#42');
    expect(pinned.querySelector('.wb-move.up')?.textContent).toBe('▲18');
    expect(podium.querySelector('.p1 .wb-move.up')).toBeTruthy();
    expect(podium.querySelector('.p2 .wb-move.down')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('cv-rank-history:{"kind":"gms"}')!)).toHaveLength(2);
  });
  it('does not track one-week boards', async () => {
    board.result = { rows: [row(0, true)], total: 1, you: { rank: 1, score: 1000 } };
    render(<BoardTable spec={{ kind: 'weekly', board: 'rebuild', week: '2026-W39' }} scoreLabel="Score" />);
    await screen.findByRole('list', { name: 'Top three' });
    expect(Object.keys(localStorage).filter(k => k.startsWith('cv-rank-history'))).toHaveLength(0);
    expect(document.querySelector('.wb-move')).toBeNull();
  });
});
