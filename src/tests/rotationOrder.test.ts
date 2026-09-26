import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { getRotationOrder, reorderRoster, moveInRotation, moveToPosition, primaryPosition } from '../simulation/teamStatus';

describe('getRotationOrder', () => {
  it('falls back to minutes.target ranking when no explicit order is stored', () => {
    const { league } = generateFullLeague(1, 4, 10, 12, '2026-27');
    const team = league.teams[0];
    const order = getRotationOrder(team);
    expect(order.length).toBe(team.seasons.length);
    const sortedByMinutes = [...team.seasons].sort((a, b) => b.minutes.target - a.minutes.target).map((s) => s.playerId);
    expect(order).toEqual(sortedByMinutes);
  });

  it('appends newly-arrived players (not in the stored order) rather than dropping them', () => {
    const { league } = generateFullLeague(2, 4, 10, 12, '2026-27');
    const team = league.teams[0];
    const partialOrder = team.seasons.slice(0, 3).map((s) => s.playerId);
    const withPartialOrder = { ...team, rotationOrder: partialOrder };
    const order = getRotationOrder(withPartialOrder);
    expect(order.length).toBe(team.seasons.length);
    expect(order.slice(0, 3)).toEqual(partialOrder);
  });
});

describe('reorderRoster', () => {
  it('sets the first 5 as starters and the rest as bench, matching the new order', () => {
    const { league } = generateFullLeague(3, 4, 10, 12, '2026-27');
    const team = league.teams[0];
    const flipped = [...team.seasons].map((s) => s.playerId).reverse();
    const updated = reorderRoster(team, flipped);
    const starters = updated.seasons.filter((s) => s.rotationRole === 'starter').map((s) => s.playerId);
    expect(starters.sort()).toEqual(flipped.slice(0, 5).sort());
    expect(updated.rotationOrder).toEqual(flipped);
  });
});

describe('moveInRotation', () => {
  it('swaps a player with their neighbor moving up', () => {
    const { league } = generateFullLeague(4, 4, 10, 12, '2026-27');
    const team = league.teams[0];
    const order = getRotationOrder(team);
    const second = order[1];
    const updated = moveInRotation(team, second, 'up');
    expect(getRotationOrder(updated)[0]).toBe(second);
  });

  it('does nothing when trying to move the first player up or the last player down', () => {
    const { league } = generateFullLeague(5, 4, 10, 12, '2026-27');
    const team = league.teams[0];
    const order = getRotationOrder(team);
    const stillFirst = moveInRotation(team, order[0], 'up');
    expect(getRotationOrder(stillFirst)).toEqual(order);
    const stillLast = moveInRotation(team, order[order.length - 1], 'down');
    expect(getRotationOrder(stillLast)).toEqual(order);
  });
});

describe('moveToPosition (drag and drop)', () => {
  it('moves a bench player up into the starters when dropped ahead of a starter', () => {
    const { league } = generateFullLeague(6, 4, 10, 12, '2026-27');
    const team = league.teams[0];
    const order = getRotationOrder(team);
    const benchPlayer = order[7];
    const firstStarter = order[0];
    const updated = moveToPosition(team, benchPlayer, firstStarter);
    const newOrder = getRotationOrder(updated);
    expect(newOrder[0]).toBe(benchPlayer);
    expect(newOrder.slice(0, 5)).toContain(benchPlayer);
  });
});

describe('primaryPosition', () => {
  it('returns the position with the highest suitability score', () => {
    const { league } = generateFullLeague(7, 4, 8, 10, '2026-27');
    const s = league.teams[0].seasons[0];
    const pos = primaryPosition(s);
    const maxVal = Math.max(s.positions.PG, s.positions.SG, s.positions.SF, s.positions.PF, s.positions.C);
    expect(s.positions[pos]).toBe(maxVal);
  });
});
