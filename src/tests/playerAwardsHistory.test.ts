import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRemainingSeason } from '../simulation/league';
import { generatePlayoffBracket, simulateFullPlayoffs } from '../simulation/playoffs';
import { beginNewSeasonRoster } from '../simulation/seasonTransition';
import { computeFinalsMVP, computeSeasonAwards } from '../simulation/awards';
import { getPlayerAwardsHistory } from '../simulation/leagueAnalytics';

describe('full award slate persists in franchise history', () => {
  it('stores the entire computed SeasonAwards object, not just headline names', () => {
    const { league, extras } = generateFullLeague(1, 6, 10, 12, '2026-27');
    const played = simulateRemainingSeason(league, 1);
    const { league: next } = beginNewSeasonRoster(played, extras, 1, { minGames: 1 });
    const record = next.franchiseHistory![0];
    expect(record.fullAwards).toBeDefined();
    expect(record.fullAwards!.allNBA.length).toBe(3);
    expect(record.fullAwards!.allStars.length).toBeGreaterThan(0);
  });
});

describe('getPlayerAwardsHistory', () => {
  it('finds an MVP season for the player who actually won it', () => {
    const { league, extras } = generateFullLeague(2, 6, 10, 12, '2026-27');
    const played = simulateRemainingSeason(league, 2);
    const awards = computeSeasonAwards(played, { minGames: 1 });
    const { league: next } = beginNewSeasonRoster(played, extras, 2, { minGames: 1 });
    if (awards.mvp) {
      const history = getPlayerAwardsHistory(next, awards.mvp.playerId);
      expect(history.some((h) => h.label === 'MVP')).toBe(true);
    }
  });

  it('credits a champion correctly using the player\'s roster affiliation at the time, not their current team', () => {
    const { league, extras } = generateFullLeague(3, 4, 8, 10, '2026-27');
    const played = simulateRemainingSeason(league, 3);
    const bracket = generatePlayoffBracket(played, 4);
    const finished = simulateFullPlayoffs(bracket, played, 4);
    const finals = finished.bracket.rounds[finished.bracket.rounds.length - 1][0];
    const fmvp = computeFinalsMVP(finals, finished.league);
    const championTeam = finished.league.teams.find((t) => t.teamId === finished.bracket.championTeamId)!;

    const { league: next } = beginNewSeasonRoster(finished.league, extras, 3, { minGames: 1 }, {
      teamId: finished.bracket.championTeamId, teamName: championTeam.name, fmvp,
    });

    // Pick a player who was actually on the champion roster during that season (via careerHistory/current season).
    const championPlayerId = championTeam.seasons[0]?.playerId;
    if (championPlayerId) {
      const history = getPlayerAwardsHistory(next, championPlayerId);
      expect(history.some((h) => h.label === 'NBA Champion')).toBe(true);
    }
  });

  it('returns an empty list for a player with no franchise history yet', () => {
    const { league } = generateFullLeague(4, 4, 8, 10, '2026-27');
    const history = getPlayerAwardsHistory(league, league.teams[0].seasons[0].playerId);
    expect(history).toEqual([]);
  });
});
