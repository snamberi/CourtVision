import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateGame } from '../simulation/engine/game';

describe('offensive rebounds keep possession', () => {
  const { league } = generateFullLeague(91, 4, 12, 6, '2026', { priorSeasons: false });
  const games = [1, 2, 3, 4, 5].map(seed => simulateGame({ home: league.teams[0], away: league.teams[1], settings: { ...league.settings, seed } }));

  it('the rebounding team goes again after an offensive board; everything else hands the ball over', () => {
    let continuations = 0, flips = 0;
    for (const g of games) {
      const log = g.possessionLog;
      for (let i = 0; i < log.length - 1; i++) {
        const cur = log[i], next = log[i + 1];
        if (next.quarter !== cur.quarter) continue; // each period opens with the tip/inbound
        const offensiveBoard = cur.result === 'MISS' && cur.debug?.offensiveRebound === true;
        if (offensiveBoard) {
          continuations++;
          expect(next.offenseTeamId).toBe(cur.offenseTeamId);
          expect(next.secondChance).toBe(true);
          expect(cur.events.some(e => e.startsWith('Offensive rebound:'))).toBe(true);
        } else {
          flips++;
          expect(next.offenseTeamId).not.toBe(cur.offenseTeamId);
          expect(next.secondChance).toBeUndefined();
        }
      }
    }
    expect(continuations).toBeGreaterThan(20);
    expect(flips).toBeGreaterThan(continuations);
  });

  it('box-score offensive rebounds match the second chances in the log, and the rate is NBA-like', () => {
    for (const g of games) {
      for (const [box, teamId] of [[g.homeBox, g.homeTeamId], [g.awayBox, g.awayTeamId]] as const) {
        const oreb = Object.values(box.players).reduce((n, l) => n + l.oreb, 0);
        const offensiveBoards = g.possessionLog.filter(p => p.offenseTeamId === teamId && p.debug?.offensiveRebound === true);
        // Team rebounds (out of bounds, tipped around) keep possession but credit no player, as in official stats.
        const credited = offensiveBoards.filter(p => !p.events.includes('Team rebound')).length;
        expect(oreb).toBe(credited);
        expect(credited).toBeGreaterThanOrEqual(Math.floor(offensiveBoards.length * 0.7));
      }
    }
    const all = games.flatMap(g => [g.homeBox, g.awayBox]).flatMap(b => Object.values(b.players));
    const oreb = all.reduce((n, l) => n + l.oreb, 0), dreb = all.reduce((n, l) => n + l.dreb, 0);
    const rate = oreb / (oreb + dreb);
    expect(rate).toBeGreaterThan(0.15);
    expect(rate).toBeLessThan(0.35);
  });

  it('second-chance trips are short and the game clock still adds up', () => {
    for (const g of games) {
      const second = g.possessionLog.filter(p => p.secondChance);
      const regular = g.possessionLog.filter(p => !p.secondChance);
      const avg = (xs: typeof second) => xs.reduce((n, p) => n + (p.durationSeconds ?? 0), 0) / Math.max(1, xs.length);
      expect(avg(second)).toBeLessThan(avg(regular));
      const q1 = g.possessionLog.filter(p => p.quarter === 1).reduce((n, p) => n + (p.durationSeconds ?? 0), 0);
      expect(q1).toBe(Math.round((league.settings.era?.quarterLengthMinutes ?? 12) * 60));
    }
  });
});
