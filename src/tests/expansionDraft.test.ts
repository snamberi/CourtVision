import { describe, it, expect } from 'vitest';
import { runExpansionDraft } from '../simulation/expansionDraft';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { calculateOverall } from '../simulation/engine/overall';

describe('expansion draft', () => {
  it('creates a new team with the requested roster size', () => {
    const { league, extras } = generateFullLeague(1, 8, 18, 20);
    const result = runExpansionDraft(league, extras, 'Expansion Squad', 14, 8, 5);
    const newTeam = result.league.teams.find((t) => t.name === 'Expansion Squad')!;
    expect(newTeam).toBeDefined();
    expect(newTeam.seasons.length).toBe(14);
  });

  it('never drafts a protected (top-8-by-overall) player from any original team', () => {
    const { league, extras } = generateFullLeague(2, 8, 18, 20);
    const protectedIds = new Set<string>();
    for (const t of league.teams) {
      const top8 = [...t.seasons].sort((a, b) => calculateOverall(b) - calculateOverall(a)).slice(0, 8);
      for (const p of top8) protectedIds.add(p.playerId);
    }
    const result = runExpansionDraft(league, extras, 'Expansion Squad', 14, 8, 6);
    for (const id of result.draftedPlayerIds) expect(protectedIds.has(id)).toBe(false);
  });

  it('removes drafted players from their original team and gives them to the new team', () => {
    const { league, extras } = generateFullLeague(3, 8, 18, 20);
    const result = runExpansionDraft(league, extras, 'Expansion Squad', 14, 8, 7);
    const newTeamId = result.league.teams.find((t) => t.name === 'Expansion Squad')!.teamId;
    for (const id of result.draftedPlayerIds) {
      const stillOnOldTeam = result.league.teams.some((t) => t.teamId !== newTeamId && t.seasons.some((s) => s.playerId === id));
      expect(stillOnOldTeam).toBe(false);
      expect(result.extras.contracts[id].teamId).toBe(newTeamId);
    }
  });

  it('regenerates a schedule that includes the new team', () => {
    const { league, extras } = generateFullLeague(4, 8, 18, 20);
    const result = runExpansionDraft(league, extras, 'Expansion Squad', 14, 8, 8);
    const newTeamId = result.league.teams.find((t) => t.name === 'Expansion Squad')!.teamId;
    const appearsInSchedule = result.league.schedule.some((g) => g.homeTeamId === newTeamId || g.awayTeamId === newTeamId);
    expect(appearsInSchedule).toBe(true);
  });
});
