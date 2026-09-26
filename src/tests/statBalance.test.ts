import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRemainingSeason } from '../simulation/league';

/* League-wide box-score balance against NBA norms (2023-24, per team game): 5.1 BLK, 7.5 STL, 13.6 TOV, 43.5 REB,
 * 47.5 FG%. Bounds are wide enough for small samples but catch the old imbalance (16 BLK, 3 STL, 54 REB). */
describe('box-score balance', () => {
  const { league } = generateFullLeague(33, 30, 13, 8, '2026');
  const played = simulateRemainingSeason(league, 33);
  const players = played.teams.flatMap(t => t.seasons).filter(p => p.seasonStats && p.seasonStats.gamesPlayed > 0);
  const teamGames = played.schedule.filter(g => g.played).length * 2;
  const per = (k: 'blk' | 'stl' | 'tov' | 'oreb' | 'dreb' | 'fgm' | 'fga') => players.reduce((n, p) => n + p.seasonStats![k], 0) / teamGames;

  it('blocks, steals and turnovers per team game are NBA-like', () => {
    expect(per('blk')).toBeGreaterThan(3.5); expect(per('blk')).toBeLessThan(7);
    expect(per('stl')).toBeGreaterThan(5.5); expect(per('stl')).toBeLessThan(9.5);
    expect(per('tov')).toBeGreaterThan(10.5); expect(per('tov')).toBeLessThan(16.5);
    expect(per('stl') / per('tov')).toBeGreaterThan(0.42); // most turnovers are steals, as in the NBA (~55%)
  });

  it('rebounds and shooting are NBA-like', () => {
    const reb = per('oreb') + per('dreb');
    expect(reb).toBeGreaterThan(37); expect(reb).toBeLessThan(47);
    const fg = per('fgm') / per('fga');
    expect(fg).toBeGreaterThan(0.44); expect(fg).toBeLessThan(0.52);
  });

  it('shot-blocking and rebounding concentrate on the players built for them', () => {
    const q = players.filter(p => p.seasonStats!.gamesPlayed >= 4 && p.seasonStats!.minutes / p.seasonStats!.gamesPlayed >= 15);
    const pg = (p: typeof q[0], k: 'blk' | 'oreb' | 'dreb') => p.seasonStats![k] / p.seasonStats!.gamesPlayed;
    const topBlk = Math.max(...q.map(p => pg(p, 'blk')));
    const avgBlk = q.reduce((n, p) => n + pg(p, 'blk'), 0) / q.length;
    expect(topBlk).toBeGreaterThan(avgBlk * 4);
    const topReb = Math.max(...q.map(p => pg(p, 'oreb') + pg(p, 'dreb')));
    expect(topReb).toBeGreaterThan(9);
  });
});
