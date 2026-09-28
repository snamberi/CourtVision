import { describe, it, expect } from 'vitest';
import { generateSeasonSchedule, type ScheduledGame } from '../simulation/league';

function counts(schedule: ScheduledGame[]) {
  const games = new Map<string, number>(), home = new Map<string, number>();
  for (const g of schedule) {
    games.set(g.homeTeamId, (games.get(g.homeTeamId) ?? 0) + 1);
    games.set(g.awayTeamId, (games.get(g.awayTeamId) ?? 0) + 1);
    home.set(g.homeTeamId, (home.get(g.homeTeamId) ?? 0) + 1);
  }
  return { games, home };
}
const ids = (n: number) => Array.from({ length: n }, (_, i) => `T${i}`);

describe('season schedule with an odd number of teams', () => {
  it.each([[29, 82], [15, 82], [9, 30], [5, 12], [31, 58], [7, 4]])('%i teams, %i games: everyone plays the full slate', (n, g) => {
    const schedule = generateSeasonSchedule(ids(n), g);
    const { games, home } = counts(schedule);
    expect(games.size).toBe(n);
    for (const id of ids(n)) {
      expect(games.get(id)).toBe(g);
      expect(Math.abs(2 * (home.get(id) ?? 0) - g)).toBeLessThanOrEqual(2); // home and away within a game or so
    }
    // No team plays twice on one game day, rounds run in order, ids are unique.
    const byRound = new Map<number, string[]>();
    for (const x of schedule) byRound.set(x.round, [...(byRound.get(x.round) ?? []), x.homeTeamId, x.awayTeamId]);
    for (const teams of byRound.values()) expect(new Set(teams).size).toBe(teams.length);
    expect(schedule.every((x, i) => i === 0 || schedule[i - 1].round <= x.round)).toBe(true);
    expect(new Set(schedule.map(x => x.id)).size).toBe(schedule.length);
    expect(schedule.every(x => x.homeTeamId !== x.awayTeamId)).toBe(true);
    // Game days stay packed: about as few as a sit-out-each-round league allows.
    expect(schedule.at(-1)!.round + 1).toBeLessThanOrEqual(Math.ceil(g * n / (n - 1)) + 3);
  });

  it('odd teams and odd games: one team plays one fewer, the rest the full slate', () => {
    const { games } = counts(generateSeasonSchedule(ids(29), 81));
    const values = [...games.values()].sort((a, b) => a - b);
    expect(values[0]).toBe(80);
    expect(values.slice(1).every(v => v === 81)).toBe(true);
  });

  it('even team counts: full slate, one game a day, about half at home', () => {
    const schedule = generateSeasonSchedule(ids(30), 82);
    expect(schedule).toHaveLength(30 * 41);
    expect(schedule.at(-1)!.round + 1).toBe(82);
    const { games, home } = counts(schedule);
    expect([...games.values()].every(v => v === 82)).toBe(true);
    expect([...home.values()].every(v => v >= 40 && v <= 42)).toBe(true);
  });
});
