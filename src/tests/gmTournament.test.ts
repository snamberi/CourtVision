import { beforeAll, describe, expect, it } from 'vitest';
import type { NbaHistory } from '../history/nbaHistoryData';
import type { Baller } from '../arcade/street';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { aiTeams, canAfford, roundsOpen, runTournament, teamCost, tourPool, TOUR_BUDGET, TOUR_PICKS, TOUR_SIZE } from '../arcade/gmTournament';

describe('GM Tournament', () => {
  const week = '2026-W41';
  let h: NbaHistory, pool: Baller[], ai: ReturnType<typeof aiTeams>;
  beforeAll(async () => { h = await loadHistoryForTests(); pool = tourPool(h, week); ai = aiTeams(pool, week); });
  it('gives everyone the same pool and fifteen AI GMs under the budget', () => {
    expect(pool).toHaveLength(24);
    expect(tourPool(h, week).map(b => b.id)).toEqual(pool.map(b => b.id));
    expect(ai).toHaveLength(TOUR_SIZE - 1);
    for (const t of ai) { expect(t.players).toHaveLength(TOUR_PICKS); expect(teamCost(t.players)).toBeLessThanOrEqual(TOUR_BUDGET); }
    expect(canAfford(pool, pool.slice(0, 2), pool[2])).toBe(teamCost(pool.slice(0, 3)) <= TOUR_BUDGET);
  });
  it('plays a fixed 16-team bracket: 15 games, one champion, same every time', () => {
    const mine = { gm: 'Me', you: true, players: [...pool].reverse().slice(0, 3) };
    const a = runTournament(mine, ai, week), b = runTournament(mine, ai, week);
    expect(a.games).toHaveLength(15);
    expect(a.games.filter(g => g.round === 3)).toHaveLength(1);
    expect(a.champion.gm).toBe(b.champion.gm);
    expect(a.games.filter(g => g.a.you || g.b.you).length).toBeGreaterThanOrEqual(1);
  });
  it('opens a round Monday, Wednesday, Friday and Sunday (UTC)', () => {
    expect(roundsOpen(new Date('2026-10-05T10:00:00Z'))).toBe(1); // Monday
    expect(roundsOpen(new Date('2026-10-07T00:00:00Z'))).toBe(2); // Wednesday
    expect(roundsOpen(new Date('2026-10-10T12:00:00Z'))).toBe(3); // Saturday
    expect(roundsOpen(new Date('2026-10-11T12:00:00Z'))).toBe(4); // Sunday
  });
});
