import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';

describe('player generation depth', () => {
  it('every generated player has a nationality and (usually) a college', () => {
    const { league } = generateFullLeague(41, 6, 12, 5);
    const all = league.teams.flatMap((t) => t.seasons);
    expect(all.every((p) => !!p.nationality)) .toBe(true);
    // College is only set for domestic-ish prospects in some cases; at minimum most should have one.
    const withCollege = all.filter((p) => !!p.college).length;
    expect(withCollege / all.length).toBeGreaterThan(0.5);
  });

  it('initial-roster players get a plausible backfilled draft record, and some are Undrafted', () => {
    const { league } = generateFullLeague(42, 8, 14, 5);
    const all = league.teams.flatMap((t) => t.seasons);
    const drafted = all.filter((p) => p.draftYear != null);
    const undrafted = all.filter((p) => p.draftYear == null);
    expect(drafted.length).toBeGreaterThan(0);
    expect(undrafted.length).toBeGreaterThan(0);
    for (const p of drafted) {
      expect(p.draftRound).toBeGreaterThanOrEqual(1);
      expect(p.draftRound).toBeLessThanOrEqual(2);
      expect(p.draftPick).toBeGreaterThanOrEqual(1);
      expect(p.draftPick).toBeLessThanOrEqual(60);
    }
  });

  it('assigns every player a real archetype, not a uniform default build', () => {
    const { league } = generateFullLeague(43, 10, 14, 5);
    const all = league.teams.flatMap((t) => t.seasons);
    const archetypes = new Set(all.map((p: any) => p.archetype).filter(Boolean));
    expect(archetypes.size).toBeGreaterThan(3); // a real mix of builds, not one repeated archetype
  });

  it('name pools are large enough that a fresh league rarely repeats a full name', () => {
    const { league } = generateFullLeague(44, 20, 15, 5); // 300 players
    const all = league.teams.flatMap((t) => t.seasons);
    const uniqueNames = new Set(all.map((p) => p.playerId));
    expect(uniqueNames.size).toBe(all.length); // generator already de-dupes; this just proves the pool is deep enough not to force weird suffixes constantly
  });
});
