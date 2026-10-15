import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateGame } from '../simulation/engine/game';
import { applyCreateSettings, summary, DEFAULT_CREATE } from '../menu/createSettings';
import { cleanGameLength, gameLengthText, periodLabel, withGameLength } from '../simulation/gameLength';
import { formatGameClock } from '../simulation/highlights';
import { REALISTIC_ERA_MODERN } from '../simulation/types';
import { developOffseasonPlayer } from '../simulation/engine/development';
import { RNG } from '../simulation/engine/rng';

describe('game length', () => {
  it('keeps periods 1-8 and minutes 1-30, whole numbers', () => {
    expect(cleanGameLength(0, 0)).toEqual({ periods: 1, minutes: 1 });
    expect(cleanGameLength(12, 99)).toEqual({ periods: 8, minutes: 30 });
    expect(cleanGameLength(3.4, 15.6)).toEqual({ periods: 3, minutes: 16 });
    expect(cleanGameLength(NaN, NaN)).toEqual({ periods: 1, minutes: 1 });
  });
  it('names the periods and the clock', () => {
    expect(gameLengthText(4, 12)).toBe('4 × 12-minute quarters (48 minutes)');
    expect(gameLengthText(2, 20)).toBe('2 × 20-minute halves (40 minutes)');
    expect(gameLengthText(3, 16)).toBe('3 × 16-minute periods (48 minutes)');
    expect(gameLengthText(1, 30)).toBe('One 30-minute period');
    expect(periodLabel(3, 4)).toBe('Q3');
    expect(periodLabel(2, 2)).toBe('H2');
    expect(periodLabel(5, 6)).toBe('P5');
    expect(periodLabel(7, 6)).toBe('OT1');
    expect(formatGameClock(3, 75, 3)).toBe('P3 1:15');
  });
  it('overtime is never longer than a period', () => {
    expect(withGameLength(REALISTIC_ERA_MODERN, 4, 4).overtimeLengthMinutes).toBe(4);
    expect(withGameLength(REALISTIC_ERA_MODERN, 4, 12).overtimeLengthMinutes).toBe(5);
    expect(withGameLength(REALISTIC_ERA_MODERN, 5, 9)).toMatchObject({ numberOfQuarters: 5, quarterLengthMinutes: 9, shotClockSeconds: 24 });
  });
  it('New Franchise applies periods and length together, and says so', () => {
    const { league, extras } = generateFullLeague(7, 30, 18, 82, '2026', { balanced: true });
    const s = { ...DEFAULT_CREATE, periods: 3, quarterMinutes: 16 };
    const { league: l } = applyCreateSettings(league, extras, s, true);
    expect(l.settings.era).toMatchObject({ numberOfQuarters: 3, quarterLengthMinutes: 16, shotClockSeconds: league.settings.era.shotClockSeconds });
    expect(summary(s, true)).toContain('3 × 16-minute periods (48 minutes)');
    expect(summary(DEFAULT_CREATE, true).some(x => x.includes('minute'))).toBe(false);
  });

  const { league } = generateFullLeague(91, 4, 12, 6, '2026', { priorSeasons: false });
  for (const [periods, minutes] of [[4, 4], [3, 16], [1, 30], [8, 6]] as const) {
    it(`plays a whole ${periods} × ${minutes} game: minutes add up, scores reconcile`, () => {
      const settings = { ...league.settings, era: withGameLength(league.settings.era, periods, minutes) };
      for (const seed of [1, 2, 3]) {
        const g = simulateGame({ home: league.teams[0], away: league.teams[1], settings: { ...settings, seed } });
        expect(g.regulationPeriods).toBe(periods);
        const lastPeriod = Math.max(...g.possessionLog.map(p => p.quarter));
        expect(lastPeriod).toBeGreaterThanOrEqual(periods);
        const overtimes = lastPeriod - periods;
        const gameMinutes = periods * minutes + overtimes * Math.min(5, minutes);
        for (const box of [g.homeBox, g.awayBox]) {
          const played = Object.values(box.players).reduce((n, l) => n + l.minutes, 0);
          expect(played).toBeGreaterThan(5 * gameMinutes - 1.5);
          expect(played).toBeLessThan(5 * gameMinutes + 1.5);
          expect(Object.values(box.players).reduce((n, l) => n + l.points, 0)).toBe(box.points);
        }
        expect(g.homeScore).not.toBe(g.awayScore);
      }
    });
  }

  it('development counts minutes as if games were 48 minutes long', () => {
    const p = league.teams[0].seasons.find(s => s.age <= 22) ?? league.teams[0].seasons[0];
    const young = { ...p, age: 20, seasonStats: { ...(p.seasonStats as object), gamesPlayed: 70, minutes: 70 * 10 } } as typeof p;
    // 10 minutes a game in a 16-minute league is like 30 in a 48-minute one.
    const short = developOffseasonPlayer(young, new RNG(5), undefined, 1, 'balanced', 100, 16);
    const asLong = developOffseasonPlayer({ ...young, seasonStats: { ...(young.seasonStats as object), minutes: 70 * 30 } } as typeof p, new RNG(5), undefined, 1, 'balanced', 100, 48);
    expect(short.attributes).toEqual(asLong.attributes);
  });
});
