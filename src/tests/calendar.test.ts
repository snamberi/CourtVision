import { describe, it, expect } from 'vitest';
import { addDays, daysBetween, seasonStartDate, formatDisplayDate, DAYS_PER_ROUND } from '../simulation/calendar';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateNextGame, simulateRounds } from '../simulation/league';

describe('calendar utilities', () => {
  it('addDays/daysBetween are inverses', () => {
    const start = '2026-10-21';
    const later = addDays(start, 17);
    expect(daysBetween(start, later)).toBe(17);
  });

  it('seasonStartDate parses the leading year out of a "YYYY-YY" label', () => {
    expect(seasonStartDate('2026-27')).toBe('2026-10-21');
    expect(seasonStartDate('2030')).toBe('2030-10-21');
    expect(seasonStartDate(undefined)).toBe('2025-10-21');
  });

  it('formatDisplayDate renders a readable date', () => {
    expect(formatDisplayDate('2026-10-21')).toMatch(/Oct/);
  });
});

describe('league calendar advancement', () => {
  it('starts a new league at the season-opening date', () => {
    const { league } = generateFullLeague(1, 4, 8, 10, '2026-27');
    expect(league.calendarDate).toBe('2026-10-21');
  });

  it('advances by DAYS_PER_ROUND when a game crosses into a new round', () => {
    const { league } = generateFullLeague(2, 4, 8, 10, '2026-27');
    const start = league.calendarDate!;
    const afterOneGame = simulateNextGame(league, 1);
    expect(afterOneGame.calendarDate).toBe(addDays(start, DAYS_PER_ROUND));
  });

  it('does not advance the calendar twice for games within the same round', () => {
    const { league } = generateFullLeague(3, 6, 8, 10, '2026-27');
    let current = simulateNextGame(league, 1);
    const afterFirst = current.calendarDate;
    // Simulate the rest of round 0's games (round 0 has teamCount/2 games).
    current = simulateNextGame(current, 1);
    current = simulateNextGame(current, 1);
    expect(current.calendarDate).toBe(afterFirst);
  });

  it('simulateRounds advances the calendar by roughly N * DAYS_PER_ROUND', () => {
    const { league } = generateFullLeague(4, 6, 8, 10, '2026-27');
    const start = league.calendarDate!;
    const after = simulateRounds(league, 3, 1);
    expect(after.calendarDate).toBe(addDays(start, 3 * DAYS_PER_ROUND));
  });
});
