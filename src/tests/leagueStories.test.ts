import { describe, expect, it } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { generateNewsFeed } from '../simulation/news';
import { emptyStatLine, type GameResult } from '../simulation/boxscore';
import { emptySeasonStatTotals } from '../simulation/types';
import { beginNewSeasonRoster } from '../simulation/seasonTransition';
const fixture = () => generateFullLeague(112, 4, 10, 12, '2026', { priorSeasons: false });
function game(home: string, away: string, player: string, points: number, threes = 0, homeScore = 110, awayScore = 108): GameResult {
  return { homeTeamId: home, awayTeamId: away, homeScore, awayScore, homeBox: { teamId: home, points: homeScore, players: { [player]: { ...emptyStatLine(player), minutes: 36, points, tpm: threes, tpa: threes + 4 } } }, awayBox: { teamId: away, points: awayScore, players: {} }, possessionLog: [], seed: 1, injuries: [] };
}
describe('evidence-based league stories', () => {
  it('calls out threes in Finals games and preserves win/loss context', () => {
    const { league, extras } = fixture(), [a, b] = league.teams, player = a.seasons[0].playerId;
    league.playoffBracket = { championTeamId: null, rounds: [[{ id: 'finals', round: 0, slot: 0, teamAId: a.teamId, teamBId: b.teamId, teamAWins: 0, teamBWins: 1, gamesToWin: 4, winnerTeamId: null, games: [game(a.teamId, b.teamId, player, 47, 13, 108, 110)] }]] };
    const story = generateNewsFeed(league, extras).find(i => i.headline.includes('13 threes'));
    expect(story?.headline).toContain('Finals'); expect(story?.detail).toContain('loss to');
  });
  it('recognizes genuine season records, not a tied mark or a smaller line in the same game', () => {
    const { league, extras } = fixture(), [a, b] = league.teams, player = a.seasons[0].playerId;
    league.schedule = [40, 51, 51].map((points, i) => ({ id: String(i), round: i, played: true, homeTeamId: a.teamId, awayTeamId: b.teamId, result: game(a.teamId, b.teamId, player, points) }));
    const records = generateNewsFeed(league, extras).filter(i => i.category === 'Records');
    expect(records).toHaveLength(1); expect(records[0].gameId).toBe('1');
    expect(records[0].detail).toContain('previous league mark of 40');
  });
  it('requires repeated close games and wins on both sides for a rivalry', () => {
    const { league, extras } = fixture(), [a, b] = league.teams;
    league.schedule = [true, false, true].map((won, i) => ({ id: String(i), round: i, played: true, homeTeamId: a.teamId, awayTeamId: b.teamId, result: game(a.teamId, b.teamId, a.seasons[0].playerId, 20, 0, won ? 110 : 108, won ? 108 : 110) }));
    expect(generateNewsFeed(league, extras).filter(i => i.category === 'Rivalries')).toHaveLength(1);
    league.schedule.pop(); expect(generateNewsFeed(league, extras).filter(i => i.category === 'Rivalries')).toHaveLength(0);
  });
  it('qualifies a 24-year-old rookie but excludes veterans; only reports actual homecomings', () => {
    const { league, extras } = fixture(), [a, b] = league.teams, player = a.seasons[0];
    player.age = 24; player.seasonStats = { ...emptySeasonStatTotals(), gamesPlayed: 5, points: 125 };
    expect(generateNewsFeed(league, extras).some(i => i.id.includes(`rookie:${player.playerId}`))).toBe(true);
    player.careerHistory = [{ season: '2025', teamId: a.teamId, age: 23, overall: 80, stats: player.seasonStats, milestones: { doubleDoubles: 0, tripleDoubles: 0, quadrupleDoubles: 0, quintupleDoubles: 0, gameHighPoints: 25, gameHighRebounds: 0, gameHighAssists: 0, gameHighSteals: 0, gameHighBlocks: 0 } }];
    expect(generateNewsFeed(league, extras).some(i => i.id.includes(`rookie:${player.playerId}`))).toBe(false);
    for (const group of Object.values(player.attributes)) for (const key of Object.keys(group)) (group as Record<string, number>)[key] = 99;
    player.history = [{ season: '2024', type: 'drafted', teamId: a.teamId, description: 'Drafted' }, { season: '2025', type: 'signed', teamId: b.teamId, description: 'Signed' }, { season: '2026', type: 'signed', teamId: a.teamId, description: 'Returned' }];
    expect(generateNewsFeed(league, extras).some(i => i.id.includes('homecoming:'))).toBe(true);
    player.history.splice(1, 1); expect(generateNewsFeed(league, extras).some(i => i.id.includes('homecoming:'))).toBe(false);
  });
  it('archives stories across seasons without duplicates or relabeling old games', () => {
    const { league, extras } = fixture(), [a, b] = league.teams;
    league.schedule = [{ id: 'old', round: 0, played: true, homeTeamId: a.teamId, awayTeamId: b.teamId, result: game(a.teamId, b.teamId, a.seasons[0].playerId, 55) }];
    const next = beginNewSeasonRoster(league, extras, 99);
    const items = generateNewsFeed(next.league, next.extras);
    const feats = items.filter(i => i.gameId === 'old');
    expect(feats).toHaveLength(1); expect(feats[0].season).toBe('2026');
    expect(new Set(items.map(i => i.id)).size).toBe(items.length);
    expect(next.league.newsArchive!.length).toBeLessThanOrEqual(200);
  });
  it('a five-by-five uses five in every category, not ten', () => {
    const { league, extras } = fixture(), [a, b] = league.teams, player = a.seasons[0].playerId;
    const result = game(a.teamId, b.teamId, player, 5);
    Object.assign(result.homeBox.players[player], { dreb: 5, ast: 5, stl: 5, blk: 5 });
    league.schedule = [{ id: 'five', round: 0, played: true, homeTeamId: a.teamId, awayTeamId: b.teamId, result }];
    expect(generateNewsFeed(league, extras).some(i => i.headline.includes('five-by-five'))).toBe(true);
  });
});
