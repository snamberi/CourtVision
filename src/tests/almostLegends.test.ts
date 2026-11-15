import { describe, expect, it } from 'vitest';
import { almostLegends } from '../simulation/almostLegends';
import { generateFullLeague } from '../simulation/leagueGenerator';
import type { FranchiseHistoryRecord, TeamSeasonSummary } from '../simulation/league';
import type { HallOfFameCase } from '../simulation/hallOfFame';

const makeCase = (playerId: string, score: number): HallOfFameCase => ({ playerId, score, inducted: score >= 100, finalSeason: '2026', finalTeamName: 'Team', careerPoints: 0, careerRebounds: 0, careerAssists: 0, seasonsPlayed: 0, ppg: 0, rpg: 0, apg: 0, awardCount: 0, awardScore: 0, resume: [] });
const summary = (id: string, name: string, finish: TeamSeasonSummary['playoffFinish'], playerId: string) => ({ teamId: id, teamName: name, playoffFinish: finish, roster: [{ playerId }] }) as TeamSeasonSummary;

describe('Almost Legends', () => {
  it('shows recorded playoff runs for great retirees and excludes champions', () => {
    const { league } = generateFullLeague(42, 6, 12, 10, '2026', { priorSeasons: false });
    const [team, opponent] = league.teams;
    const [player, champion, ordinary] = team.seasons;
    const retirees = [player, champion, ordinary].map(p => ({ playerId: p.playerId, finalTeamId: team.teamId, finalTeamName: team.name, finalSeason: '2026', finalAge: 38, finalOverall: 75, finalSeasonData: p }));
    const history = { season: '2025', championTeamId: opponent.teamId, championTeamName: opponent.name, championPlayerIds: [champion.playerId], teamSeasons: [summary(team.teamId, team.name, 'Finals', player.playerId)], bracket: { rounds: [[{ teamAId: team.teamId, teamBId: opponent.teamId, teamAWins: 3, teamBWins: 4, winnerTeamId: opponent.teamId }]] } } as FranchiseHistoryRecord;
    const cases = [player, champion, ordinary].map((p, i) => makeCase(p.playerId, i === 2 ? 50 : 150));
    const result = almostLegends({ ...league, retiredPlayers: retirees, franchiseHistory: [history] }, cases);
    expect(result.map(x => x.career.playerId)).toEqual([player.playerId]);
    expect(result[0].runs[0]).toMatchObject({ finish: 'Finals', opponent: opponent.name, result: '3–4' });
  });
  it('handles missing archived rosters and brackets without inventing a playoff run', () => {
    const { league } = generateFullLeague(43, 6, 12, 10, '2026', { priorSeasons: false });
    const team = league.teams[0], player = team.seasons[0];
    const record = { playerId: player.playerId, finalTeamId: team.teamId, finalTeamName: team.name, finalSeason: '2026', finalAge: 38, finalOverall: 75, finalSeasonData: player };
    const result = almostLegends({ ...league, retiredPlayers: [record], franchiseHistory: [] }, [makeCase(player.playerId, 120)]);
    expect(result).toHaveLength(1);
    expect(result[0].runs).toEqual([]);
  });
});
