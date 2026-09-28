import { describe, expect, it } from 'vitest';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { newRun } from '../hunt/run';
import { cardPool } from '../hunt/cards';
import { ghostFromRun, validGhost, playPvp, eloDelta, type Ghost } from '../hunt/pvp';

describe('League Hunt PvP', () => {
  it('plays a seeded best-of-seven between two ghosts', async () => {
    const h = await loadHistoryForTests();
    const pool = [...cardPool(h).byId.values()].sort((a, b) => b.ovr - a.ovr);
    const make = (from: number): Ghost => ({ squad: pool.slice(from, from + 6).map(c => c.id), items: [], boosts: [], growth: { star: 0, sixth: 0, chemistry: 0, coach: 0 }, training: {}, reached: 10 });
    const strong = make(0), weak = make(300);
    expect(validGhost(h, strong)).toBe(true);
    expect(validGhost(h, { ...strong, squad: ['nope'] })).toBe(false);
    const a = playPvp(h, strong, weak, 42, '90s'), b = playPvp(h, strong, weak, 42, '90s');
    expect(a).toEqual(b); // the same seed replays the same series
    const wins = a.games.filter(g => g.won).length;
    expect(a.games.length).toBeGreaterThanOrEqual(4);
    expect(a.games.length).toBeLessThanOrEqual(7);
    expect(a.won ? wins : a.games.length - wins).toBe(4);
    // The same players on both sides do not collide.
    const mirror = playPvp(h, strong, strong, 7, 'today');
    expect(mirror.games.every(g => g.us > 40 && g.them > 40)).toBe(true);
    // The better squad wins most series.
    let won = 0;
    for (let s = 1; s <= 6; s++) if (playPvp(h, strong, weak, s * 97, '10s').won) won++;
    expect(won).toBeGreaterThanOrEqual(5);
    // Only finished runs with a full squad make a ghost.
    expect(ghostFromRun(newRun(h, 1))).toBeNull();
  }, 120_000);

  it('Elo', () => {
    expect(eloDelta(1000, 1000, true)).toBe(16);
    expect(eloDelta(1000, 1000, false)).toBe(-16);
    expect(eloDelta(1400, 1000, true)).toBeLessThan(5);
    expect(eloDelta(1000, 1400, true)).toBeGreaterThan(27);
  });
});
