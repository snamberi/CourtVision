import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRemainingSeason } from '../simulation/league';
import { calculateOverall } from '../simulation/engine/overall';
import { validateTrade, toggleTradeBlock } from '../simulation/gm';
import { seekTradeOffers } from '../simulation/seekOffers';

describe('Seek trade', () => {
  const { league: l0, extras } = generateFullLeague(11, 30, 13, 15, '2026-27');
  const league = simulateRemainingSeason({ ...l0, schedule: l0.schedule.slice(0, Math.floor(l0.schedule.length / 3)) }, 3);
  const me = league.teams[4];
  it('answers a block with at least ten valid offers from different teams', () => {
    const starter = [...me.seasons].sort((a, b) => calculateOverall(b) - calculateOverall(a))[1];
    const ex = toggleTradeBlock(extras, starter.playerId);
    const offers = seekTradeOffers(league, ex, me.teamId);
    expect(offers.length).toBeGreaterThanOrEqual(10);
    for (const o of offers) {
      expect(o.proposal.playersFromA).toEqual([starter.playerId]);
      expect(o.proposal.teamBId).not.toBe(me.teamId);
      expect(validateTrade(league, ex, o.proposal).valid).toBe(true);
    }
    expect(new Set(offers.map(o => o.proposal.teamBId)).size).toBeGreaterThanOrEqual(6);
  });
  it('needs something on the block', () => {
    expect(seekTradeOffers(league, { ...extras, tradeBlock: [], picksOnBlock: [] }, me.teamId)).toEqual([]);
  });
});
