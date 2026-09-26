import { describe, it, expect } from 'vitest';
import { runExpansionDraft, prepareExpansionDraft, pickBlocked, completeExpansionDraft, protectionValue } from '../simulation/expansionDraft';
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

  it('never drafts a player his team protected', () => {
    const { league, extras } = generateFullLeague(2, 8, 18, 20);
    const setup = prepareExpansionDraft(league, extras, 'Expansion Squad', 14, 8, 6);
    const protectedIds = new Set(Object.values(setup.protectedIds).flat());
    expect(protectedIds.size).toBe(8 * 8);
    const result = runExpansionDraft(league, extras, 'Expansion Squad', 14, 8, 6);
    for (const id of result.draftedPlayerIds) expect(protectedIds.has(id)).toBe(false);
  });

  it('teams protect young upside ahead of an old player of the same rating', () => {
    const { league } = generateFullLeague(9, 8, 18, 20);
    const p = league.teams[0].seasons[0];
    const young = protectionValue({ ...p, age: 21, development: { ...p.development, potential: calculateOverall(p) + 15 } });
    const old = protectionValue({ ...p, age: 35, development: { ...p.development, potential: calculateOverall(p) } });
    expect(young).toBeGreaterThan(old);
  });

  it('lets you pick your own players, at most the per-team limit from any one team', () => {
    const { league, extras } = generateFullLeague(5, 8, 18, 20);
    const setup = prepareExpansionDraft(league, extras, 'Expansion Squad', 14, 8, 1);
    expect(setup.perTeamLimit).toBe(2);
    const team = setup.pool[0].fromTeamId;
    const fromOne = setup.pool.filter(e => e.fromTeamId === team).map(e => e.player.playerId);
    const picks = fromOne.slice(0, 2);
    expect(pickBlocked(setup, picks, fromOne[2])).toMatch(/at most 2/);
    const protectedId = setup.protectedIds[team][0];
    expect(pickBlocked(setup, [], protectedId)).toMatch(/protected/);
    const other = setup.pool.find(e => e.fromTeamId !== team)!.player.playerId;
    const done = completeExpansionDraft(league, extras, 'Expansion Squad', setup, [...picks, other]);
    expect(done.league.teams.find(t => t.teamId === setup.newTeamId)!.seasons.map(s => s.playerId).sort()).toEqual([...picks, other].sort());
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
