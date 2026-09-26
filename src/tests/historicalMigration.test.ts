import { describe, it, expect, beforeAll } from 'vitest';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { buildHistoricalLeague } from '../history/historicalLeague';
import { migrateHistoricalLeague } from '../history/migrateHistorical';
import { cityName, parseTeamNameLines } from '../history/teamNames';
import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';

let built: { league: League; extras: GMLeagueExtras };
beforeAll(async () => { built = buildHistoricalLeague(await loadHistoryForTests(), 2016, { realDevelopment: true, difficulty: 'normal', seed: 3 }); }, 120_000);

/** Recreates how a league from the first data version was stored: 2K-scale reference values and official team names. */
function asFirstVersion(l: { league: League; extras: GMLeagueExtras }) {
  const league = structuredClone(l.league), extras = structuredClone(l.extras);
  league.historical!.dataset = 'nba-history.v1';
  delete league.historical!.cityNames;
  league.teams.find(t => t.teamId === 'GSW')!.name = 'Golden State Warriors';
  league.teams.find(t => t.teamId === 'LAC')!.name = 'Los Angeles Clippers';
  league.teams.find(t => t.teamId === 'POR')!.name = 'Portland Trail Blazers';
  league.franchiseHistory!.find(r => r.season === '2014')!.championTeamName = 'Golden State Warriors';
  const curry = league.teams.find(t => t.teamId === 'GSW')!.seasons.find(p => p.playerId === 'Stephen Curry')!;
  (curry.real as unknown as { rating: object }).rating = { ovr2k: 94, source: 'community', edition: 'NBA 2K17', startYear: 2016 };
  curry.real!.frames = [[2017, 95, 'community'], [2018, 93, 'est-A']];
  curry.careerHistory![0].rating = { ovr2k: 71, source: 'est-A-same', edition: null } as never;
  const seed = Object.values(league.historical!.futureClasses)[0][0];
  (seed as unknown as { rating: object }).rating = { ovr2k: 80, source: 'community', edition: 'NBA 2K18', startYear: 2017 };
  return { league, extras, curry: curry.playerId };
}

describe('leagues from the first NBA history data version', () => {
  it('convert ratings to Court Vision\'s scale and team names to city names, once', () => {
    const v1 = asFirstVersion(built);
    const { league, extras, migrated } = migrateHistoricalLeague(v1.league, v1.extras);
    expect(migrated).toBe(true);
    expect(league.historical!.dataset).toBe('nba-history.v2');
    const names = Object.fromEntries(league.teams.map(t => [t.teamId, t.name]));
    expect(names).toMatchObject({ GSW: 'Golden State', LAC: 'LA', POR: 'Portland' });
    expect(league.historical!.cityNames!.GSW).toBe('Golden State');
    expect(league.franchiseHistory!.find(r => r.season === '2014')!.championTeamName).toBe('Golden State');
    const curry = league.teams.find(t => t.teamId === 'GSW')!.seasons.find(p => p.playerId === 'Stephen Curry')!;
    expect(curry.real!.rating).toMatchObject({ ovr: 87, source: 'legacy', startYear: 2016 });
    expect(curry.real!.frames).toEqual([[2017, 89, 'legacy'], [2018, 86, 'legacy']]);
    expect(curry.careerHistory![0].rating).toEqual({ ovr: 45, source: 'legacy' }); // 71 on the old scale
    expect(Object.values(league.historical!.futureClasses)[0][0].rating).toMatchObject({ ovr: 63, source: 'legacy' });
    expect(JSON.stringify(league)).not.toMatch(/ovr2k|NBA 2K|Warriors|Clippers|Trail Blazers/);
    // Idempotent: a converted league is left alone.
    expect(migrateHistoricalLeague(league, extras).migrated).toBe(false);
  });

  it('leaves current leagues and random leagues untouched', () => {
    const r = migrateHistoricalLeague(built.league, built.extras);
    expect(r.migrated).toBe(false);
    expect(r.league).toBe(built.league);
  });
});

describe('team names', () => {
  it('city names follow the data builder rules', () => {
    expect(cityName('Golden State Warriors')).toBe('Golden State');
    expect(cityName('Portland Trail Blazers')).toBe('Portland');
    expect(cityName('Los Angeles Clippers', 'LAC')).toBe('LA');
    expect(cityName('Spirits of St. Louis')).toBe('St. Louis');
    expect(cityName('Philadelphia 76ers')).toBe('Philadelphia');
  });
  it('players can paste their own names by team code', () => {
    const { names, rejected } = parseTeamNameLines('GSW = Bay Area Dubs\nlal: Showtime\nXYZ = Nobody\n\nnonsense', ['GSW', 'LAL', 'BOS']);
    expect(names).toEqual({ GSW: 'Bay Area Dubs', LAL: 'Showtime' });
    expect(rejected).toEqual(['XYZ = Nobody', 'nonsense']);
  });
});
