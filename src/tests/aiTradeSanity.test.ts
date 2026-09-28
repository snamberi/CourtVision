import { describe, expect, it } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { runTradeMarketAI, AI_TRADE_NEUTRAL_FLOOR } from '../simulation/aiGM';
import { tradePackageValue } from '../simulation/gm';
import { simulateFullRound } from '../simulation/league';

describe('AI-to-AI trade sanity', () => {
  it('never lopsided on neutral value, and nobody is flipped twice in a season', () => {
    const g = generateFullLeague(4242, 30, 14, 82, '2026', { priorSeasons: false });
    let league = { ...g.league, settings: { ...g.league.settings, injuriesEnabled: false } }, extras = g.extras;
    const moved = new Map<string, number>();
    let trades = 0;
    for (let day = 0; day < 16; day++) {
      league = simulateFullRound(league, day);
      const before = league;
      const r = runTradeMarketAI(league, extras, null, 1000 + day, 3);
      for (const t of r.trades) {
        trades++;
        const va = tradePackageValue(before, extras, t.teamAId, t.playersFromA, t.picksFromA ?? []);
        const vb = tradePackageValue(before, extras, t.teamBId, t.playersFromB, t.picksFromB ?? []);
        expect(Math.min(va, vb)).toBeGreaterThanOrEqual(Math.max(va, vb) * AI_TRADE_NEUTRAL_FLOOR);
        for (const id of [...t.playersFromA, ...t.playersFromB]) moved.set(id, (moved.get(id) ?? 0) + 1);
      }
      league = r.league; extras = r.extras;
    }
    expect(trades).toBeGreaterThan(0);
    expect([...moved.values()].every(n => n === 1)).toBe(true);
  }, 300_000);
});
