import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';

describe('full league generator', () => {
  it('produces exactly 30 teams of 18 players each by default', () => {
    const { league } = generateFullLeague(1);
    expect(league.teams.length).toBe(30);
    for (const t of league.teams) expect(t.seasons.length).toBe(18);
  });

  it('every generated player has a contract', () => {
    const { league, extras } = generateFullLeague(2);
    const allPlayerIds = league.teams.flatMap((t) => t.seasons.map((s) => s.playerId));
    for (const id of allPlayerIds) expect(extras.contracts[id]).toBeDefined();
  });

  it('every team has a full 82-game schedule', () => {
    const { league } = generateFullLeague(3);
    const counts: Record<string, number> = {};
    for (const g of league.schedule) {
      counts[g.homeTeamId] = (counts[g.homeTeamId] ?? 0) + 1;
      counts[g.awayTeamId] = (counts[g.awayTeamId] ?? 0) + 1;
    }
    for (const t of league.teams) expect(counts[t.teamId]).toBe(82);
  });

  it('team names are unique and non-empty', () => {
    const { league } = generateFullLeague(4);
    const names = league.teams.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) expect(n.length).toBeGreaterThan(0);
  });

  it('is reproducible from the same seed', () => {
    const a = generateFullLeague(42);
    const b = generateFullLeague(42);
    expect(a.league.teams[5].seasons[3].attributes.offense.threePoint).toBe(b.league.teams[5].seasons[3].attributes.offense.threePoint);
  });

  it('players span a plausible age range including young prospects and veterans', () => {
    const { league } = generateFullLeague(6);
    const ages = league.teams.flatMap((t) => t.seasons.map((s) => s.age));
    expect(Math.min(...ages)).toBeLessThanOrEqual(21);
    expect(Math.max(...ages)).toBeGreaterThanOrEqual(30);
  });
});
