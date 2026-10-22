import { describe, it, expect, beforeAll } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRounds, type League } from '../simulation/league';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { buildHistoricalLeague } from '../history/historicalLeague';
import type { PlayerSeason } from '../simulation/types';

/* Shooting and passing land where the NBA does: no 50%+ three-point seasons, no 15-20 assist seasons. */
const players = (l: League) => l.teams.flatMap(t => t.seasons).filter(s => (s.seasonStats?.gamesPlayed ?? 0) >= 15);
const sum = (ps: PlayerSeason[], k: 'tpm' | 'tpa' | 'ast' | 'fgm') => ps.reduce((n, s) => n + (s.seasonStats?.[k] ?? 0), 0);

describe('shooting and passing balance (generated league)', () => {
  let ps: PlayerSeason[];
  beforeAll(() => { ps = players(simulateRounds(generateFullLeague(7, 30, 15, 82).league, 24, 7)); }, 300_000);

  it('the league makes about 36% of its threes and nobody shoots 50% on real volume', () => {
    const pct = sum(ps, 'tpm') / sum(ps, 'tpa');
    expect(pct).toBeGreaterThan(0.33); expect(pct).toBeLessThan(0.39);
    const best = Math.max(...ps.filter(s => s.seasonStats!.tpa >= 60).map(s => s.seasonStats!.tpm / s.seasonStats!.tpa));
    expect(best).toBeLessThan(0.5);
  });

  it('assist leaders stay near the NBA\'s 10-12 a game, with about 60% of made shots assisted', () => {
    const top = Math.max(...ps.map(s => s.seasonStats!.ast / s.seasonStats!.gamesPlayed));
    expect(top).toBeLessThan(13);
    const share = sum(ps, 'ast') / sum(ps, 'fgm');
    expect(share).toBeGreaterThan(0.5); expect(share).toBeLessThan(0.7);
  });
});

describe('real players shoot threes like they really did', () => {
  it('a star who is not a shooter keeps a modest three-point rating; a great shooter stays elite', async () => {
    const h = await loadHistoryForTests();
    const all = buildHistoricalLeague(h, 2016, { realDevelopment: true, forceRosters: true, difficulty: 'normal', seed: 3 }).league.teams.flatMap(t => t.seasons);
    const three = (name: string) => all.find(p => p.playerId === name)!.attributes.offense.corner3;
    expect(three('LeBron James')).toBeLessThan(70);
    expect(three('Russell Westbrook')).toBeLessThan(70);
    expect(three('Stephen Curry')).toBeGreaterThan(90);
  }, 120_000);
});
