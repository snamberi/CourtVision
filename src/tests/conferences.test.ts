import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { hasConferenceStructure, computeConferenceStandings } from '../simulation/league';
import { generateConferencePlayoffBracket, simulateFullPlayoffs } from '../simulation/playoffs';

describe('conferences and divisions', () => {
  it('a freshly generated 30-team league is split into two conferences of 15 with divisions assigned', () => {
    const { league } = generateFullLeague(1, 30, 10, 10);
    expect(hasConferenceStructure(league)).toBe(true);
    const east = league.teams.filter((t) => t.conferenceId === 'east');
    const west = league.teams.filter((t) => t.conferenceId === 'west');
    expect(east.length).toBe(15);
    expect(west.length).toBe(15);
    expect(league.teams.every((t) => !!t.divisionId)).toBe(true);
  });

  it('builds a bracket where round 0 keeps all-East and all-West series separate', () => {
    const { league: rawLeague } = generateFullLeague(2, 30, 8, 20);
    const league = { ...rawLeague }; // give every team a few real results so standings aren't all tied
    const bracket = generateConferencePlayoffBracket(league);
    const { east, west } = computeConferenceStandings(league);
    const eastIds = new Set(east.map((r) => r.teamId));
    const westIds = new Set(west.map((r) => r.teamId));

    expect(bracket.rounds[0]).toHaveLength(8);
    // Seeds 7 and 8 (slots 0 and 3 of each conference) come from the play-in, so they start empty.
    const waiting = (i: number) => i % 4 === 0 || i % 4 === 3;
    for (let i = 0; i < 8; i++) {
      const ids = i < 4 ? eastIds : westIds;
      expect(ids.has(bracket.rounds[0][i].teamAId!)).toBe(true);
      if (waiting(i)) expect(bracket.rounds[0][i].teamBId).toBeNull();
      else expect(ids.has(bracket.rounds[0][i].teamBId!)).toBe(true);
    }
    expect(bracket.playIn).toHaveLength(6);
    for (const g of bracket.playIn!.filter(g => g.kind !== 'final')) {
      const ids = g.conference === 'east' ? eastIds : westIds;
      expect(ids.has(g.teamAId!) && ids.has(g.teamBId!)).toBe(true);
    }
  });

  it('the Finals matchup is always one East team vs one West team, never same-conference', () => {
    const { league } = generateFullLeague(3, 30, 8, 20);
    const bracket = generateConferencePlayoffBracket(league);
    const { east, west } = computeConferenceStandings(league);
    const eastIds = new Set(east.map((r) => r.teamId));
    const westIds = new Set(west.map((r) => r.teamId));

    const result = simulateFullPlayoffs(bracket, league, 42);
    const finals = result.bracket.rounds[3][0];
    expect(finals.teamAId).toBeTruthy();
    expect(finals.teamBId).toBeTruthy();
    const aIsEast = eastIds.has(finals.teamAId!);
    const bIsEast = eastIds.has(finals.teamBId!);
    expect(aIsEast).not.toBe(bIsEast); // one from each conference
    expect(eastIds.has(finals.teamAId!) || westIds.has(finals.teamAId!)).toBe(true);
    expect(result.bracket.championTeamId).toBeTruthy();
  });
});
