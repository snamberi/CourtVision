// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import type { NbaHistory } from '../history/nbaHistoryData';
import { buildHistoricalLeague } from '../history/historicalLeague';
import { PlayerProfile } from '../components/PlayerProfile';
import { TeamHistoryPage } from '../components/TeamHistoryPage';
import { AlmanacPage } from '../components/AlmanacPage';
import { DEFAULT_AWARD_SETTINGS } from '../components/LeagueSettingsPage';
import { careerSummary } from '../simulation/careerStats';
import { computeRecords } from '../simulation/records';
import { awardVote } from '../simulation/almanac';
import { initializeCoaching } from '../simulation/staffManagement';
import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';

let h: NbaHistory;
let l2016: { league: League; extras: GMLeagueExtras };
let l1980: { league: League; extras: GMLeagueExtras };
beforeAll(async () => {
  h = await loadHistoryForTests();
  const a = buildHistoricalLeague(h, 2016, { realDevelopment: true, difficulty: 'normal', seed: 5 });
  const b = buildHistoricalLeague(h, 1980, { realDevelopment: true, difficulty: 'normal', seed: 6 });
  l2016 = { league: initializeCoaching(a.league), extras: a.extras };
  l1980 = { league: initializeCoaching(b.league), extras: b.extras };
}, 120_000);
afterEach(() => cleanup());
const find = (l: { league: League; extras: GMLeagueExtras }, name: string) => [...l.league.teams.flatMap(t => t.seasons), ...l.extras.freeAgents].find(p => p.playerId === name)!;

describe('historical data on screen', () => {
  it('Curry\'s profile separates real awards from simulated ones and names the rating source', () => {
    const curry = find(l2016, 'Stephen Curry');
    const { container } = render(<PlayerProfile season={curry} teamName="Golden State Warriors" sandboxMode={false} onChange={() => {}} league={l2016.league} extras={l2016.extras} />);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/NaN/);
    const awards = container.querySelector('.awards-by-origin')!;
    expect(awards.textContent).toMatch(/Real NBA · before 2016–17/);
    expect(awards.textContent).toMatch(/MVP ×2/);
    expect(awards.textContent).toMatch(/NBA Champion/);
    expect(awards.textContent).toMatch(/None yet/); // nothing simulated yet
    expect(container.querySelector('.real-player-facts')?.textContent).toMatch(/2016–17 reference Overall \d+: Court Vision estimate from the previous season's statistics/);
    expect(container.textContent).not.toMatch(/2K/);
    expect(container.querySelectorAll('.imported-row').length).toBe(curry.careerHistory!.length);
  });

  it('Kareem\'s 1970s seasons show unrecorded stats as "—" and career averages use recorded games', () => {
    const kareem = find(l1980, 'Kareem Abdul-Jabbar');
    const summary = careerSummary(kareem);
    const recorded = kareem.careerHistory!.filter(c => !c.missing?.includes('stl'));
    const games = recorded.reduce((n, c) => n + c.stats.gamesPlayed, 0);
    expect(summary.partial.stl).toBe(kareem.careerHistory!.length - recorded.length);
    expect(summary.perGame.spg).toBeCloseTo(summary.totals.stl / games, 6);
    const { container } = render(<PlayerProfile season={kareem} teamName="Los Angeles Lakers" sandboxMode={false} onChange={() => {}} league={l1980.league} extras={l1980.extras} />);
    expect(container.textContent).not.toMatch(/NaN/);
    const row1970 = [...container.querySelectorAll('.imported-row')].find(r => r.textContent?.startsWith('1970'))!;
    expect(row1970.querySelectorAll('.stat-na').length).toBeGreaterThanOrEqual(3); // STL, BLK, TOV (and 3P%)
  });

  it('records never count a season that did not record the stat', () => {
    const records = computeRecords(l1980.league, l1980.extras);
    const byId = new Map(records.map(r => [r.def.id, r]));
    const earlySeasons = (id: string) => (byId.get(id)?.entries ?? []).filter(e => Number(e.season) < 1973);
    expect(earlySeasons('season:avg:spg')).toHaveLength(0);
    expect(earlySeasons('season:avg:drpg')).toHaveLength(0);
    expect(earlySeasons('season:tot:blk')).toHaveLength(0);
    for (const r of records) for (const e of r.entries) expect(Number.isFinite(e.value)).toBe(true);
  }, 60_000);

  it('imported award ballots keep the real vote shares', () => {
    const rec = l2016.league.franchiseHistory!.find(r => r.season === '2015')!;
    const votes = awardVote(rec.fullAwards!.ballots!.mvp!, '2015|mvp');
    expect(votes[0]).toMatchObject({ playerId: 'Stephen Curry', share: 1, first: 131, real: true });
    const { container } = render(<AlmanacPage league={l2016.league} extras={l2016.extras} awardSettings={DEFAULT_AWARD_SETTINGS} onSelectPlayer={() => {}} />);
    expect(container.textContent).toMatch(/2015 Season/);
    expect(container.textContent).toMatch(/100\.0% share · 131 first-place \(real voting\)/);
    expect(container.textContent).not.toMatch(/NaN/);
  });

  it('shared real awards keep both winners (1994-95 co-Rookies of the Year)', () => {
    const rec = l2016.league.franchiseHistory!.find(r => r.season === '1994')!;
    const names = [rec.fullAwards!.roy!.playerId, ...(rec.fullAwards!.coWinners?.roy ?? []).map(w => w.playerId)].sort();
    expect(names).toEqual(['Grant Hill', 'Jason Kidd']);
  });

  it('team history shows imported franchise seasons under their historical names without NaN', () => {
    const { container } = render(<TeamHistoryPage league={l2016.league} extras={l2016.extras} initialTeamId="OKC" onSelectPlayer={() => {}} onOpenArchive={() => {}} />);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/NaN/);
    expect(text).not.toMatch(/SuperSonics|Thunder/);
    expect(text).toMatch(/1978 Seattle[^—]*Champion/);
    expect(text).not.toMatch(/1966/); // the franchise began in 1967-68: no empty rows before it
    expect(container.querySelector('.history-summary')?.textContent).toMatch(/TITLES1/);
  });
});
