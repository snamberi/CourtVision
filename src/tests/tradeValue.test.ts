import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { validateTrade, evaluateTradeSides } from '../simulation/gm';
import { runTradeMarketAI } from '../simulation/aiGM';
import { assetCurve, teamDirection } from '../simulation/tradeValue';
import { calculateOverall } from '../simulation/engine/overall';
import { simulateRemainingSeason } from '../simulation/league';

describe('trade valuation', () => {
  it('values stars far above role players (steep curve)', () => {
    expect(assetCurve(88)).toBeGreaterThan(assetCurve(70) * 3);
    expect(assetCurve(35)).toBe(0);
  });

  it('refuses a star-for-three-role-players package', () => {
    const { league, extras } = generateFullLeague(11, 30, 13, 10, '2026');
    const [a, b] = league.teams;
    const star = [...a.seasons].sort((x, y) => calculateOverall(y) - calculateOverall(x))[0];
    const roles = [...b.seasons].sort((x, y) => calculateOverall(x) - calculateOverall(y)).filter(p => calculateOverall(p) < calculateOverall(star) - 12).slice(-3);
    expect(roles).toHaveLength(3);
    const relaxed = { ...extras, capSettings: { ...extras.capSettings, enforceCapOnTrades: false, minRosterSize: 0, maxRosterSize: 99 } };
    const res = validateTrade(league, relaxed, { teamAId: a.teamId, teamBId: b.teamId, playersFromA: [star.playerId], playersFromB: roles.map(r => r.playerId) });
    expect(res.valid).toBe(false);
    expect(res.reasons.join(' ')).toContain(a.name);
  });

  it('judges each side from its own direction', () => {
    const { league } = generateFullLeague(12, 30, 13, 10, '2026');
    const dirs = league.teams.map(t => teamDirection(league, t.teamId));
    expect(dirs).toContain('contender');
    expect(dirs).toContain('rebuilding');
  });

  it('the AI market still completes deals that both sides accept', () => {
    const { league: base, extras } = generateFullLeague(13, 30, 13, 20, '2026');
    const league = simulateRemainingSeason(base, 13);
    let trades = 0;
    let cur = { league, extras };
    for (let i = 0; i < 12 && trades === 0; i++) {
      const r = runTradeMarketAI(cur.league, cur.extras, null, 100 + i, 3);
      trades += r.trades.length;
      for (const t of r.trades) {
        const sides = evaluateTradeSides(cur.league, cur.extras, { teamAId: t.teamAId, teamBId: t.teamBId, playersFromA: t.playersFromA, playersFromB: t.playersFromB, picksFromA: t.picksFromA, picksFromB: t.picksFromB });
        for (const s of [sides.a, sides.b]) expect(s.receive).toBeGreaterThanOrEqual(s.give * 0.8);
      }
      cur = { league: r.league, extras: r.extras };
    }
    expect(trades).toBeGreaterThan(0);
  });
});
