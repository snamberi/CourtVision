import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRounds } from '../simulation/league';
import { computeSeasonAwards } from '../simulation/awards';
import { getPlayerAwardsHistory } from '../simulation/leagueAnalytics';

describe('unanimous awards in a player bio', () => {
  it('an award won with every first-place vote reads "Unanimous MVP"; a split vote reads "MVP"', () => {
    const { league } = generateFullLeague(5, 10, 13, 20, '2026', { priorSeasons: false });
    const played = simulateRounds(league, 15, 5);
    const awards = computeSeasonAwards(played, { minGames: 1 });
    const mvp = awards.mvp!.playerId;
    const vote = awards.votes!.mvp!;
    const record = (first: number) => ({ season: '2026', championTeamId: null, championTeamName: null, championPlayerIds: [], mvpPlayerId: mvp, mvpTeamName: null, dpoyPlayerId: null, royPlayerId: null, fmvpPlayerId: null, allStarGameMVPPlayerId: null,
      fullAwards: { ...awards, votes: { ...awards.votes, mvp: { ...vote, winners: [mvp], lines: vote.lines.map((l, i) => i === 0 ? { ...l, id: mvp, firstVotes: first } : { ...l, firstVotes: i === 1 ? vote.voters - first : 0 }) } } } });
    const unanimous = getPlayerAwardsHistory({ ...played, franchiseHistory: [record(vote.voters) as never] }, mvp);
    expect(unanimous.some(a => a.label === 'Unanimous MVP' && a.unanimous)).toBe(true);
    const split = getPlayerAwardsHistory({ ...played, franchiseHistory: [record(vote.voters - 3) as never] }, mvp);
    expect(split.some(a => a.label === 'MVP')).toBe(true);
    expect(split.some(a => a.label.startsWith('Unanimous'))).toBe(false);
  });
});
