import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRemainingSeason } from '../simulation/league';
import { generatePlayoffBracket, simulateFullPlayoffs } from '../simulation/playoffs';
import { beginNewSeasonRoster } from '../simulation/seasonTransition';
import { computeFinalsMVP } from '../simulation/awards';

describe('franchise history archiving', () => {
  it('archives a record with the correct champion and awards when championship info is provided', () => {
    const { league, extras } = generateFullLeague(1, 4, 8, 10, '2026-27');
    const played = simulateRemainingSeason(league, 1);
    const bracket = generatePlayoffBracket(played, 4);
    const finished = simulateFullPlayoffs(bracket, played, 2);
    const finals = finished.bracket.rounds[finished.bracket.rounds.length - 1][0];
    const fmvp = computeFinalsMVP(finals, finished.league);
    const championTeam = finished.league.teams.find((t) => t.teamId === finished.bracket.championTeamId)!;

    const { league: next } = beginNewSeasonRoster(finished.league, extras, 1, { minGames: 1 }, {
      teamId: finished.bracket.championTeamId, teamName: championTeam.name, fmvp,
    });

    expect(next.franchiseHistory?.length).toBe(1);
    const record = next.franchiseHistory![0];
    expect(record.championTeamId).toBe(finished.bracket.championTeamId);
    expect(record.championTeamName).toBe(championTeam.name);
    if (fmvp) expect(record.fmvpPlayerId).toBe(fmvp.playerId);
  });

  it('accumulates records across multiple seasons without overwriting earlier ones', () => {
    const { league, extras } = generateFullLeague(2, 4, 8, 10, '2026-27');
    const { league: afterOne } = beginNewSeasonRoster(league, extras, 2, { minGames: 1 }, { teamId: 'T0', teamName: 'Team 0', fmvp: null });
    const { league: afterTwo } = beginNewSeasonRoster(afterOne, extras, 3, { minGames: 1 }, { teamId: 'T1', teamName: 'Team 1', fmvp: null });
    expect(afterTwo.franchiseHistory?.length).toBe(2);
    expect(afterTwo.franchiseHistory?.[0].championTeamName).toBe('Team 0');
    expect(afterTwo.franchiseHistory?.[1].championTeamName).toBe('Team 1');
  });

  it('records null fields gracefully when no championship info is passed (e.g. quick-advance path)', () => {
    const { league, extras } = generateFullLeague(3, 4, 8, 10, '2026-27');
    const { league: next } = beginNewSeasonRoster(league, extras, 3, { minGames: 1 });
    expect(next.franchiseHistory?.length).toBe(1);
    expect(next.franchiseHistory![0].championTeamId).toBeNull();
  });
});
