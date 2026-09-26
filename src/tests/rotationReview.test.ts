import { describe, expect, it } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { reviewTeamRotation } from '../simulation/rotationReview';
import { emptyStatLine, type GameResult } from '../simulation/boxscore';
import { simulateNextGame } from '../simulation/league';

function fixture(count = 7) {
  const { league } = generateFullLeague(71, 4, 10, 30, '2026', { priorSeasons: false });
  const team = league.teams[0];
  team.rotationOrder = team.seasons.map(s => s.playerId);
  team.seasons.forEach((s, i) => { s.minutes = { mode: 'AI', target: i < 5 ? 30 : 18 }; s.rotationRole = i < 5 ? 'starter' : 'bench'; s.positions = {PG:80,SG:80,SF:80,PF:80,C:80}; });
  const bench = team.seasons[5];
  league.schedule = Array.from({ length: count }, (_, i) => {
    const players = Object.fromEntries(team.seasons.map((s,j) => [s.playerId, { ...emptyStatLine(s.playerId), minutes: 24, points: j === 5 ? 30 : 8, fga: j === 5 ? 16 : 12, fgm: j === 5 ? 12 : 4, ast: j === 5 ? 8 : 1 }]));
    const result: GameResult = { homeTeamId: team.teamId, awayTeamId: league.teams[1].teamId, homeScore: 102, awayScore: 90, homeBox: { teamId: team.teamId, points: 102, players }, awayBox: { teamId: league.teams[1].teamId, points: 90, players: {} }, possessionLog: [], seed: i, injuries: [] };
    return { id: `g${i}`, round: i, homeTeamId: team.teamId, awayTeamId: result.awayTeamId, played: true, result };
  });
  return { league, team, bench };
}
describe('performance rotations', () => {
  it('waits for the cadence, promotes a breakout sixth man and conserves the minute budget', () => {
    const { league, team, bench } = fixture(6);
    expect(reviewTeamRotation(team, league)).toBe(team);
    league.schedule.push({ ...league.schedule[0], id: 'last', round: 6 });
    const reviewed = reviewTeamRotation(team, league);
    expect(reviewed.seasons.find(s => s.playerId === bench.playerId)?.rotationRole).toBe('starter');
    expect(reviewed.seasons.find(s => s.playerId === bench.playerId)!.minutes.target).toBeGreaterThan(18);
    expect(reviewed.rotationReview?.changes.find(c => c.playerId === bench.playerId)?.reason).toMatch(/Promoted/);
    expect(reviewed.seasons.reduce((n,s) => n+s.minutes.target,0)).toBe(240);
    expect(reviewTeamRotation(reviewed, league)).toBe(reviewed);
    expect(team.seasons[5].minutes.target).toBe(18);
  });
  it('protects manual targets, injuries, insufficient samples and disabled coaching', () => {
    const { league, team, bench } = fixture();
    team.seasons[0].minutes = { mode:'EXACT', target:30 };
    league.injuries = { [bench.playerId]: { playerId:bench.playerId, teamId:team.teamId, gamesRemaining:3, totalGames:3, severity:'minor' } };
    const reviewed = reviewTeamRotation(team, league);
    expect(reviewed.seasons[0]).toBe(team.seasons[0]);
    expect(reviewed.seasons[5]).toBe(bench);
    team.coach = { ...team.coach!, autoRotation:false };
    expect(reviewTeamRotation(team, league)).toBe(team);
  });
  it('accounts for workload fatigue before promoting an otherwise productive bench player', () => {
    const { league, team, bench } = fixture();
    for (const g of league.schedule) g.result!.homeBox.players[bench.playerId].minutes = 38;
    bench.attributes.physical.stamina = 100;
    expect(reviewTeamRotation(team, league).seasons[5].rotationRole).toBe('starter');
    bench.attributes.physical.stamina = 10;
    expect(reviewTeamRotation(team, league).seasons[5].rotationRole).toBe('bench');
    league.settings.fatigueEnabled = false;
    expect(reviewTeamRotation(team, league).seasons[5].rotationRole).toBe('starter');
  });
  it('persists reviews across JSON reload and reviews anew after a season rollover', () => {
    const { league, team } = fixture();
    const reviewed = JSON.parse(JSON.stringify(reviewTeamRotation(team, league)));
    expect(reviewTeamRotation(reviewed, league)).toBe(reviewed);
    league.season = '2027';
    expect(reviewTeamRotation(reviewed, league).rotationReview?.season).toBe('2027');
  });
  it('honors a 5-game cadence through the real league simulation and never reviews in the offseason', () => {
    const { league } = generateFullLeague(64, 4, 10, 10, '2026', { priorSeasons: false });
    league.settings.injuriesEnabled = false;
    league.teams = league.teams.map(t=>({...t,coach:{...t.coach!,rotationReviewInterval:5}}));
    let current = league;
    for (let i=0;i<10;i++) current=simulateNextGame(current,54);
    expect(current.teams.every(t=>t.rotationReview?.gamesReviewed===5)).toBe(true);
    const { league: off, team } = fixture(); off.seasonPhase='draft';
    expect(reviewTeamRotation(team,off)).toBe(team);
  });
});
