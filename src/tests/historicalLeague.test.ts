import { describe, it, expect, beforeAll } from 'vitest';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import type { NbaHistory } from '../history/nbaHistoryData';
import { buildHistoricalLeague, supportedStartYears } from '../history/historicalLeague';
import { calculateOverall } from '../simulation/engine/overall';
import { careerSummary } from '../simulation/careerStats';
import { isRookieEligible } from '../simulation/rookieEligibility';
import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import { autoPlayOneSeason } from '../simulation/autoPlay';
import { DEFAULT_AWARD_SETTINGS } from '../components/LeagueSettingsPage';

let h: NbaHistory;
let l2016: { league: League; extras: GMLeagueExtras };
beforeAll(async () => { h = await loadHistoryForTests(); l2016 = buildHistoricalLeague(h, 2016, { realDevelopment: true, difficulty: 'normal', seed: 1 }); }, 120_000);
const everyone = (l: { league: League; extras: GMLeagueExtras }) => [...l.league.teams.flatMap(t => t.seasons), ...l.extras.freeAgents];
const find = (l: { league: League; extras: GMLeagueExtras }, name: string) => everyone(l).find(p => p.playerId === name);

describe('historical NBA league (2016-17 start)', () => {
  it('opens 2016-17 unplayed with history through 2015-16 only', () => {
    const { league } = l2016;
    expect(league.season).toBe('2016');
    expect(league.teams).toHaveLength(30);
    expect(league.schedule.every(g => !g.played)).toBe(true);
    expect(everyone(l2016).every(p => !p.seasonStats)).toBe(true);
    const seasons = league.franchiseHistory!.map(r => r.season);
    expect(seasons[0]).toBe('1946');
    expect(seasons.at(-1)).toBe('2015');
    expect(league.franchiseHistory!.every(r => r.imported)).toBe(true);
    expect(league.franchiseHistory!.find(r => r.season === '2015')!.championTeamId).toBe('CLE');
  });

  it('Curry: 2015-16 line, two MVPs and the 2015 title, nothing later', () => {
    const curry = find(l2016, 'Stephen Curry')!;
    expect(curry.teamId).toBe('GSW');
    const s2015 = curry.careerHistory!.find(c => c.season === '2015')!;
    expect(s2015.stats.points).toBe(2375);
    expect(s2015.stats.tpm).toBe(402);
    expect(s2015.imported).toBe(true);
    const awards = curry.historicalAwards!;
    expect(awards.filter(a => a.label === 'MVP').map(a => a.season)).toEqual(['2014', '2015']);
    expect(awards.filter(a => a.label === 'NBA Champion').map(a => a.season)).toEqual(['2014']);
    expect(awards.every(a => Number(a.season) < 2016)).toBe(true);
    // Rating: Court Vision's own, from his 2015-16 statistics (he was the league's most productive player).
    expect(curry.real!.rating).toMatchObject({ source: 'stats', startYear: 2016 });
    expect(curry.real!.rating.ovr).toBeGreaterThanOrEqual(88);
    expect(Math.abs(calculateOverall(curry) - curry.real!.rating.ovr)).toBeLessThanOrEqual(1);
    expect(isRookieEligible(curry)).toBe(false);
  });

  it('teams carry city names only, never official team names', () => {
    const names = Object.fromEntries(l2016.league.teams.map(t => [t.teamId, t.name]));
    expect(names).toMatchObject({ GSW: 'Golden State', LAL: 'Los Angeles', LAC: 'LA', POR: 'Portland', PHI: 'Philadelphia', NYK: 'New York' });
    const nicknames = /Warriors|Lakers|Clippers|Celtics|Knicks|Bulls|Spurs|Trail Blazers|76ers|Thunder|SuperSonics|Cavaliers/;
    expect(l2016.league.teams.some(t => nicknames.test(t.name))).toBe(false);
    expect(l2016.league.franchiseHistory!.some(r => nicknames.test(r.championTeamName ?? '') || r.teamSeasons?.some(ts => nicknames.test(ts.teamName)))).toBe(false);
    expect(h.teams.some(t => nicknames.test(t.name))).toBe(false); // the shipped data has none either
    expect(l2016.league.historical!.cityNames!.GSW).toBe('Golden State');
  });

  it('Durant starts with Golden State; retired and future players are not in the league', () => {
    expect(find(l2016, 'Kevin Durant')?.teamId).toBe('GSW');
    expect(find(l2016, 'Kobe Bryant')).toBeUndefined(); // retired April 2016
    expect(find(l2016, 'Tim Duncan')).toBeUndefined();  // retired July 2016, no 2016-17 games
    expect(find(l2016, 'Jayson Tatum')).toBeUndefined(); // 2017 draft
    expect(l2016.extras.draftClass.some(p => p.playerId === 'Jayson Tatum')).toBe(true); // the 2017 draft class is real
    const ids = everyone(l2016).map(p => p.real!.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(everyone(l2016).map(p => p.playerId)).size).toBe(ids.length);
  });

  it('multi-team seasons count once, with stints kept separately', () => {
    const traded = everyone(l2016).flatMap(p => (p.careerHistory ?? []).filter(c => c.stints?.length).map(c => ({ p, c })))[0];
    expect(traded).toBeTruthy();
    const { p, c } = traded;
    expect(c.stints!.reduce((n, s) => n + s.stats.points, 0)).toBe(c.stats.points);
    expect(p.careerHistory!.filter(x => x.season === c.season)).toHaveLength(1);
    const summary = careerSummary(p);
    expect(summary.totals.points).toBe(p.careerHistory!.reduce((n, x) => n + x.stats.points, 0));
  });

  it('keeps unrecorded stats unavailable instead of zero (1980 start)', () => {
    const l1980 = buildHistoricalLeague(h, 1980, { realDevelopment: true, difficulty: 'normal', seed: 2 });
    const kareem = find(l1980, 'Kareem Abdul-Jabbar')!;
    const early = kareem.careerHistory!.find(c => c.season === '1970')!; // 1970-71: no steals/blocks/turnovers/3PT
    expect(early.missing).toEqual(expect.arrayContaining(['stl', 'blk', 'tov', 'tpm', 'rebSplit']));
    expect(early.stats.dreb).toBeGreaterThan(1000); // total rebounds kept, split unknown
    expect(Number.isNaN(early.advanced!.stlPct)).toBe(true);
  }, 120_000);

  it('supports the earliest and latest starts', () => {
    const years = supportedStartYears(h);
    expect(years.at(-1)).toBe(1946);
    expect(years[0]).toBe(2025);
    const first = buildHistoricalLeague(h, 1946, { realDevelopment: true, difficulty: 'normal', seed: 3 });
    expect(first.league.franchiseHistory).toHaveLength(0);
    expect(first.league.teams.length).toBe(11);
    const last = buildHistoricalLeague(h, 2025, { realDevelopment: true, difficulty: 'normal', seed: 4 });
    expect(last.league.franchiseHistory!.at(-1)!.season).toBe('2024');
    expect(last.league.franchiseHistory!.at(-1)!.championTeamId).toBe('OKC');
    expect(() => buildHistoricalLeague(h, 2026, { realDevelopment: true, difficulty: 'normal' })).toThrow();
  }, 120_000);

  it('the earliest start (1946-47 BAA, 11 teams) plays a full season, playoffs, draft and rollover', () => {
    const { league, extras } = buildHistoricalLeague(h, 1946, { realDevelopment: true, difficulty: 'normal', seed: 9 });
    const r = autoPlayOneSeason(league, extras, league.teams[0].teamId, DEFAULT_AWARD_SETTINGS, 1946);
    expect(r.league.season).toBe('1947');
    expect(r.summary.championTeamName).toBeTruthy();
    expect(r.league.franchiseHistory!.at(-1)).toMatchObject({ season: '1946' });
    expect(r.league.franchiseHistory!.at(-1)!.imported).toBeFalsy(); // the simulation owns history from the start
    const drafted = r.league.teams.flatMap(t => t.seasons).filter(p => p.draftYear === '1947');
    expect(drafted.length).toBeGreaterThan(0);
    expect(drafted.every(p => p.real)).toBe(true); // the real 1947 draft class
  }, 120_000);
});
