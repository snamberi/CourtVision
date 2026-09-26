import { describe, expect, it } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRounds } from '../simulation/league';
import { computeRecords, recordGame } from '../simulation/records';
import { currentSeasonAdvanced, regularSeasonContext } from '../simulation/advancedStats';
import { buildTeamSeasonSummaries } from '../simulation/seasonTransition';

const played = () => simulateRounds(generateFullLeague(8, 8, 13, 20).league, 12, 4);

describe('record book', () => {
  it('defines at least 250 records and fills them from real games', () => {
    const league = played();
    const records = computeRecords(league);
    expect(records.length).toBeGreaterThanOrEqual(250);
    expect(new Set(records.map(r => r.def.id)).size).toBe(records.length);
    const pts = records.find(r => r.def.id === 'game:p:rs:pts')!;
    const best = Math.max(...league.schedule.filter(g => g.result).flatMap(g => [...Object.values(g.result!.homeBox.players), ...Object.values(g.result!.awayBox.players)]).map(l => l.points));
    expect(pts.entries[0].value).toBe(best);
    const seasonPts = records.find(r => r.def.id === 'season:tot:pts')!;
    expect(seasonPts.entries[0].value).toBe(Math.max(...league.teams.flatMap(t => t.seasons).flatMap(p => [p.seasonStats?.points ?? 0, ...(p.careerHistory ?? []).map(h => h.stats.points)])));
    for (const r of records) for (let i = 1; i < r.entries.length; i++) expect(r.def.lowerIsBetter ? r.entries[i].value >= r.entries[i - 1].value : r.entries[i].value <= r.entries[i - 1].value).toBe(true);
  });
  it('credits the players and teams in the game that set a record', () => {
    const league = played();
    const game = league.schedule.find(g => g.result)!.result!;
    const book = recordGame(undefined, game, { season: '2030', playoffs: true, isRookie: () => false });
    const top = book.game['p:po:pts'][0];
    expect([game.homeTeamId, game.awayTeamId]).toContain(top.teamId);
    expect(top.season).toBe('2030');
    expect(book.game['t:po:combined'][0].value).toBe(game.homeScore + game.awayScore);
  });
});

describe('team season summaries', () => {
  it('match the standings and carry each roster', () => {
    const league = played();
    const ctx = regularSeasonContext(league);
    const summaries = buildTeamSeasonSummaries(league, ctx, currentSeasonAdvanced(league, ctx));
    const games = league.schedule.filter(g => g.result);
    for (const s of summaries) {
      const wins = games.filter(g => (g.homeTeamId === s.teamId && g.result!.homeScore > g.result!.awayScore) || (g.awayTeamId === s.teamId && g.result!.awayScore > g.result!.homeScore)).length;
      expect(s.wins).toBe(wins);
      expect(s.playoffFinish).toBe('Missed Playoffs');
      expect(s.roster.length).toBeGreaterThan(5);
      expect(s.ortg).toBeGreaterThan(70); expect(s.ortg).toBeLessThan(140);
    }
  });
});
