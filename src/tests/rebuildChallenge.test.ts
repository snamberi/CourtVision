// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { buildHistoricalLeague } from '../history/historicalLeague';
import { SCENARIOS, challengeProgress, recordRebuild, loadRebuildRecords, type RebuildChallengeConfig } from '../simulation/rebuildChallenge';
import type { League, FranchiseHistoryRecord, PlayoffFinish } from '../simulation/league';
import { autoPlayOneSeason } from '../simulation/autoPlay';
import { DEFAULT_AWARD_SETTINGS } from '../simulation/awards';
import { initializeCoaching } from '../simulation/staffManagement';
import { ensureFrontOffice } from '../simulation/frontOffice';

const record = (season: string, teamId: string, wins: number, finish: PlayoffFinish): FranchiseHistoryRecord => ({
  season, championTeamId: finish === 'Champion' ? teamId : null, championTeamName: null, mvpPlayerId: null, mvpTeamName: null, dpoyPlayerId: null, royPlayerId: null, fmvpPlayerId: null,
  teamSeasons: [{ teamId, teamName: teamId, wins, losses: 82 - wins, ppg: 0, oppPpg: 0, ortg: 0, drtg: 0, pace: 0, tpmPg: 0, apg: 0, rpg: 0, spg: 0, bpg: 0, playoffFinish: finish, playoffWins: 0, playoffLosses: 0, roster: [] }],
});
const withHistory = (config: RebuildChallengeConfig, rows: FranchiseHistoryRecord[]): League => ({ teams: [], schedule: [], settings: { sandboxMode: false } as League['settings'], rebuildChallenge: config, franchiseHistory: rows });

describe('Rebuild Challenge', () => {
  it('every scenario starts: the team is in that season\'s real league', async () => {
    const h = await loadHistoryForTests();
    for (const sc of SCENARIOS) {
      const built = buildHistoricalLeague(h, sc.startYear, { realDevelopment: true, difficulty: 'normal', seed: 1 });
      expect(built.league.teams.some(t => t.teamId === sc.team), `${sc.id}: ${sc.team} in ${sc.startYear}`).toBe(true);
    }
  }, 120_000);

  it('scores seasons, stars and the title; runs out of time; history before the start does not count', () => {
    const config = { id: 'bulls99', teamId: 'CHI', startSeason: '1998', seasons: 6 };
    const imported = { ...record('1997', 'CHI', 62, 'Champion'), imported: true };
    const active = challengeProgress(withHistory(config, [imported, record('1998', 'CHI', 13, 'Missed Playoffs'), record('1999', 'CHI', 45, 'First Round')]))!;
    expect(active.status).toBe('active');
    expect(active.seasonNumber).toBe(3);
    expect(active.stars).toBe(1);
    expect(active.score).toBe(13 * 2 + 45 * 2 + 20);
    const won = challengeProgress(withHistory(config, [record('1998', 'CHI', 30, 'Missed Playoffs'), record('1999', 'CHI', 50, 'Finals'), record('2000', 'CHI', 60, 'Champion'), record('2001', 'CHI', 20, 'Missed Playoffs')]))!;
    expect(won.status).toBe('won');
    expect(won.titleIn).toBe(3);
    expect(won.results).toHaveLength(3); // seasons after the title don't count
    expect(won.stars).toBe(3);
    expect(won.score).toBe((30 + 50 + 60) * 2 + 120 + 200 + 1000 + 3 * 250);
    const rows = ['1998', '1999', '2000', '2001', '2002', '2003', '2004'].map(y => record(y, 'CHI', 40, 'Missed Playoffs'));
    const out = challengeProgress(withHistory(config, rows))!;
    expect(out.status).toBe('failed');
    expect(out.results).toHaveLength(6);
  });

  it('the board keeps the best result, once per save, official leagues only', () => {
    localStorage.clear();
    const config = { id: 'lakers17', teamId: 'LAL', startSeason: '2016', seasons: 5 };
    const p = challengeProgress(withHistory(config, [record('2016', 'LAL', 60, 'Champion')]))!;
    recordRebuild(p, 'save-1');
    recordRebuild(p, 'save-1');
    expect(loadRebuildRecords().lakers17).toMatchObject({ stars: 3, titleIn: 1, attempts: 1 });
    const sandbox = { ...withHistory(config, [record('2016', 'LAL', 60, 'Champion')]), settings: { sandboxMode: true } as League['settings'] };
    recordRebuild(challengeProgress(sandbox)!, 'save-2');
    expect(loadRebuildRecords().lakers17.attempts).toBe(1);
  });

  it('a real season of Life After Michael counts as season one', async () => {
    const h = await loadHistoryForTests();
    const built = buildHistoricalLeague(h, 1998, { realDevelopment: true, difficulty: 'normal', seed: 7 });
    let league: League = { ...ensureFrontOffice(initializeCoaching(built.league, 'CHI'), 'CHI'), rebuildChallenge: { id: 'bulls99', teamId: 'CHI', startSeason: built.league.season!, seasons: 6 } };
    expect(challengeProgress(league)!.seasonNumber).toBe(1);
    league = autoPlayOneSeason(league, built.extras, 'CHI', DEFAULT_AWARD_SETTINGS, 3).league;
    const p = challengeProgress(league)!;
    expect(p.results).toHaveLength(1);
    expect(p.results[0].wins + p.results[0].losses).toBeGreaterThan(40);
    expect(p.seasonNumber).toBe(p.status === 'active' ? 2 : 1);
  }, 300_000);
});
