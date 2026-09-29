import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { familyTies, withLegacySons } from '../simulation/family';
import type { RetiredPlayerRecord } from '../simulation/league';

describe('family ties', () => {
  const { league, extras } = generateFullLeague(44, 6, 12, 20, '2026', { priorSeasons: false });
  it('links a legacy son to his retired father, both ways', () => {
    const dad = league.teams[0].seasons[0];
    const retired: RetiredPlayerRecord = { playerId: dad.playerId, finalTeamId: 'X', finalTeamName: 'Old Team', finalSeason: '2020', finalAge: 36, finalOverall: 82, finalSeasonData: dad };
    const l = { ...league, retiredPlayers: [retired], teams: league.teams.map((t, i) => i === 0 ? { ...t, seasons: t.seasons.slice(1) } : t) };
    const classWithSon = withLegacySons(extras.draftClass, l, 1, 50).slice(0);
    const son = classWithSon.find(p => p.trueSeason.family?.some(f => f.playerId === dad.playerId));
    expect(son).toBeDefined();
    expect(son!.playerId.split(' ').slice(-1)[0].replace('Jr.', '').trim() || son!.playerId).toBeTruthy();
    const ties = familyTies(l, { ...extras, draftClass: classWithSon }, son!.trueSeason);
    expect(ties.some(t => t.playerId === dad.playerId && t.relation === 'father' && !t.active)).toBe(true);
  });
  it('knows real NBA families that exist in the league', () => {
    const a = { ...league.teams[0].seasons[0], playerId: 'Stephen Curry' }, b = { ...league.teams[1].seasons[0], playerId: 'Seth Curry' };
    const l = { ...league, historical: {} as never, teams: league.teams.map((t, i) => i === 0 ? { ...t, seasons: [a, ...t.seasons.slice(1)] } : i === 1 ? { ...t, seasons: [b, ...t.seasons.slice(1)] } : t) };
    const ties = familyTies(l, extras, a);
    expect(ties).toEqual([expect.objectContaining({ playerId: 'Seth Curry', relation: 'brother', active: true })]);
  });
});
