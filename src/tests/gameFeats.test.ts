import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRounds } from '../simulation/league';
import { simulateGame } from '../simulation/engine/game';
import { gameFeats, fiftyFortyNinety, addGameFeats, zoneSplits } from '../simulation/gameFeats';
import { bandOf, shotFeet, SHOT_BANDS } from '../simulation/shotDistance';
import { RNG } from '../simulation/engine/rng';
import { emptySeasonMilestones, emptySeasonStatTotals } from '../simulation/types';
import { computeRecords } from '../simulation/records';
import { LEADER_STATS, careerTable, rankLeaders } from '../simulation/allTimeLeaders';
import { careerSummary } from '../simulation/careerStats';

describe('shot distance', () => {
  it('puts each shot type at a sensible distance and band', () => {
    const rng = new RNG(3);
    for (let i = 0; i < 200; i++) {
      expect(shotFeet('dunk', rng)).toBeLessThan(3);
      const mid = shotFeet('midrange', rng);
      expect(mid).toBeGreaterThanOrEqual(10); expect(mid).toBeLessThanOrEqual(16);
      const three = shotFeet('aboveBreak3', rng, { line: 23.75 });
      expect(three).toBeGreaterThanOrEqual(23.75);
      expect(bandOf(three, true)).toBeGreaterThanOrEqual(4);
      expect(shotFeet('pullUp3', rng, { line: 23.75, deep: true })).toBeGreaterThanOrEqual(28);
      expect(bandOf(shotFeet('longMidrange', rng, { line: 23.75 }), false)).toBe(3);
    }
    expect(SHOT_BANDS.map(b => b.short)).toEqual(['0-3 ft', '3-10 ft', '10-16 ft', '16 ft-3PT', '3PT-27 ft', '28+ ft']);
    expect([bandOf(3, false), bandOf(12, false), bandOf(15, false), bandOf(25, true), bandOf(35, true)]).toEqual([1, 2, 2, 4, 5]);
  });
});

describe('game feats', () => {
  const { league } = generateFullLeague(44, 6, 13, 20, '2026', { priorSeasons: false });

  it('a game\'s shots by distance add up to its field-goal attempts and makes', () => {
    for (const seed of [1, 2, 3, 4]) {
      const g = simulateGame({ home: league.teams[0], away: league.teams[1], settings: { ...league.settings, seed } });
      const feats = gameFeats(g);
      for (const box of [g.homeBox, g.awayBox]) for (const line of Object.values(box.players)) {
        const z = feats.get(line.playerId)?.zones ?? [];
        const att = z.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0), made = z.filter((_, i) => i % 2 === 1).reduce((a, b) => a + b, 0);
        expect(att).toBe(line.fga);
        expect(made).toBe(line.fgm);
        const threes = (z[8] ?? 0) + (z[10] ?? 0);
        expect(threes).toBe(line.tpa);
      }
    }
  });

  it('distances never change how a game plays out', () => {
    const a = simulateGame({ home: league.teams[2], away: league.teams[3], settings: { ...league.settings, seed: 9 } });
    const b = simulateGame({ home: league.teams[2], away: league.teams[3], settings: { ...league.settings, seed: 9 } });
    expect(a.homeScore).toBe(b.homeScore);
    expect(a.possessionLog.map(p => p.debug?.shotFeet)).toEqual(b.possessionLog.map(p => p.debug?.shotFeet));
    // Every possession with a field-goal try has a distance; free-throw-only trips do not.
    for (const p of a.possessionLog) {
      const tried = Object.values(a.homeBox.players).length && p.playback?.shooterId && (p.result === 'MAKE' || p.result === 'MISS');
      if (tried && p.debug?.shotType) expect(typeof p.debug.shotFeet).toBe('number');
    }
  });

  it('counts 20-point games, runs, 20-20s and 20-20-20s', () => {
    let m = emptySeasonMilestones();
    const line = (points: number, reb = 0, ast = 0) => ({ points, oreb: 0, dreb: reb, ast });
    let streak = 0;
    for (const l of [line(25), line(31), line(12), line(20), line(22), line(24, 20), line(50, 20, 21)]) {
      streak = l.points >= 20 ? streak + 1 : 0;
      m = addGameFeats(m, l, streak);
    }
    expect(m.games20).toBe(6);
    expect(m.best20Streak).toBe(4);
    expect(m.twentyTwenty).toBe(2);
    expect(m.triple20).toBe(1);
    expect(m.fiftyPointGames).toBe(1);
  });

  it('50-40-90 needs all three percentages and the minimums (scaled to shorter seasons)', () => {
    const s = { ...emptySeasonStatTotals(), fgm: 320, fga: 620, tpm: 110, tpa: 260, ftm: 290, fta: 310 };
    expect(fiftyFortyNinety(s)).toBe(true);
    expect(fiftyFortyNinety({ ...s, ftm: 270 })).toBe(false);
    const half = { ...s, fgm: 160, fga: 310, tpm: 50, tpa: 120, ftm: 70, fta: 75 };
    expect(fiftyFortyNinety(half)).toBe(false);
    expect(fiftyFortyNinety(half, 0.5)).toBe(true);
  });

  it('a simulated season fills the feats, the record book and the all-time leaders', () => {
    const played = simulateRounds(league, 12, 5);
    const everyone = played.teams.flatMap(t => t.seasons);
    for (const p of everyone) {
      const m = p.seasonMilestones;
      if (!m || !p.seasonStats?.gamesPlayed) continue;
      const z = zoneSplits(m.shotZones);
      expect(z.reduce((n, x) => n + x.attempts, 0)).toBe(p.seasonStats.fga);
      expect(z.reduce((n, x) => n + x.makes, 0)).toBe(p.seasonStats.fgm);
      expect(m.games20 ?? 0).toBeLessThanOrEqual(p.seasonStats.gamesPlayed);
      expect(m.best20Streak ?? 0).toBeLessThanOrEqual(m.games20 ?? 0);
      expect(careerSummary(p).milestones.shotZones).toEqual(m.shotZones);
    }
    const games = played.schedule.filter(g => g.played).length;
    const buzzer = everyone.reduce((n, p) => n + (p.seasonMilestones?.buzzerBeaters ?? 0), 0);
    const winners = everyone.reduce((n, p) => n + (p.seasonMilestones?.gameWinners ?? 0), 0);
    expect(buzzer / games).toBeLessThan(1.2);
    expect(winners).toBeLessThanOrEqual(games);
    const records = computeRecords(played);
    expect(records.some(r => r.def.id === 'season:feat:g20' && r.entries.length > 0)).toBe(true);
    expect(records.some(r => r.def.id === 'season:zone:rim')).toBe(true);
    const table = careerTable(played);
    const pts = rankLeaders(table, LEADER_STATS.find(s => s.id === 'pts')!);
    expect(pts.length).toBeGreaterThan(50);
    for (let i = 1; i < pts.length; i++) expect(pts[i].value).toBeLessThanOrEqual(pts[i - 1].value);
    expect(rankLeaders(table, LEADER_STATS.find(s => s.id === 'pts')!, 'retired')).toEqual([]);
  });
});
