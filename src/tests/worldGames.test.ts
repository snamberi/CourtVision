import { describe, it, expect, beforeAll } from 'vitest';
import type { NbaHistory } from '../history/nbaHistoryData';
import { loadHistoryForTests } from './helpers/nbaHistoryFixture';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { RNG } from '../simulation/engine/rng';
import { LISTED_NATIONALITIES, REAL_GAMES, norm, realNationality, realMedals, hostOf, isGamesYear } from '../worldGames/data';
import { countryOf, pickTeam, selectField, startTournament, playAll, playStep, podium, placings, tournamentAwards, groupTable, quarterfinalists, ROSTER_SIZE, type NationalTeam } from '../worldGames/tournament';

let h: NbaHistory;
beforeAll(async () => { h = await loadHistoryForTests(); }, 60_000);

describe('World Games data', () => {
  it('names only real players, for national teams and medal rosters', () => {
    const names = new Set(h.players.map(p => norm(p.displayName)));
    const all = [...LISTED_NATIONALITIES.map(([n]) => n), ...REAL_GAMES.flatMap(g => Object.values(g.rosters).flat() as string[])];
    expect(all.filter(n => !names.has(norm(n)))).toEqual([]);
  });
  it('knows national teams and real medals', () => {
    expect(realNationality('Nikola Jokic')).toBe('Serbia');
    expect(realNationality('Luka Dončić')).toBe('Slovenia');
    expect(realNationality('Michael Jordan')).toBe('USA');
    expect(realNationality('Dino Rađa')).toBe('Croatia');
    expect(realMedals('Michael Jordan').map(m => `${m.year} ${m.medal}`)).toEqual(['1992 gold']);
    expect(realMedals('LeBron James').map(m => `${m.year} ${m.medal}`)).toEqual(['2004 bronze', '2008 gold', '2012 gold', '2024 gold']);
    // Only medals from before the league's first season.
    expect(realMedals('LeBron James', 2009).map(m => m.year)).toEqual([2004, 2008]);
    expect(realMedals('Manu Ginóbili')[0]).toMatchObject({ year: 2004, medal: 'gold', country: 'Argentina', real: true });
    expect(hostOf(2024).city).toBe('Paris');
    expect(hostOf(2036).city).toBeTruthy();
    expect(isGamesYear(2028) && !isGamesYear(2027)).toBe(true);
  });
});

function leagueTeams(seed: number) {
  const { league } = generateFullLeague(seed, 30, 18, 82, '2027', { balanced: true });
  const players = league.teams.flatMap(t => t.seasons);
  const pools = new Map<string, typeof players>();
  for (const p of players) { const c = countryOf(p); pools.set(c, [...(pools.get(c) ?? []), p]); }
  const host = 'France';
  const field = selectField(pools, host);
  const rng = new RNG(seed), used = new Set(players.map(p => p.playerId));
  const teams = new Map<string, NationalTeam>(field.map(c => [c, pickTeam(c, pools.get(c) ?? [], { rng, season: '2027-28', used })]));
  return { field, teams, host, players };
}

describe('World Games tournament', () => {
  it('picks twelve countries of twelve, the host included, best players first', () => {
    const { field, teams, host, players } = leagueTeams(5);
    expect(field).toHaveLength(12);
    expect(new Set(field).size).toBe(12);
    expect(field).toContain(host);
    for (const t of teams.values()) {
      expect(t.players).toHaveLength(ROSTER_SIZE);
      expect(new Set(t.players.map(p => p.playerId)).size).toBe(ROSTER_SIZE);
      expect(t.players.every(p => countryOf(p) === t.country)).toBe(true);
    }
    const usa = teams.get('USA')!;
    expect(usa.homeLeague).toBe(0);
    expect(usa.picked.every(id => players.some(p => p.playerId === id))).toBe(true);
  });

  it('plays groups, quarterfinals, semifinals and the medal games, with one champion', () => {
    const { teams, host } = leagueTeams(9);
    let s = startTournament([...teams.values()], 2028, 'Lyon', host, 77);
    expect(s.groups.map(g => g.length)).toEqual([4, 4, 4]);
    for (let i = 0; i < 3; i++) s = playStep(s, teams);
    expect(s.games.filter(g => g.stage === 'group')).toHaveLength(18);
    for (let g = 0; g < 3; g++) expect(groupTable(s, g).reduce((n, r) => n + r.w, 0)).toBe(6);
    const q = quarterfinalists(s);
    expect(new Set(q).size).toBe(8);
    s = playAll(s, teams);
    expect(s.done).toBe(true);
    expect(s.games).toHaveLength(18 + 4 + 2 + 2);
    expect(s.games.every(g => g.as !== g.bs && g.as > 30 && g.bs > 30)).toBe(true);
    const p = podium(s)!;
    expect(new Set([p.gold, p.silver, p.bronze]).size).toBe(3);
    expect(placings(s)).toHaveLength(12);
    expect(new Set(placings(s)).size).toBe(12);
    const { mvp, allTournament } = tournamentAwards(s);
    expect(mvp && [p.gold, p.silver, p.bronze]).toContain(mvp!.country);
    expect(allTournament).toHaveLength(5);
  }, 60_000);

  it('is the same tournament for the same seed', () => {
    const a = leagueTeams(3), b = leagueTeams(3);
    const x = playAll(startTournament([...a.teams.values()], 2028, 'Lyon', a.host, 5), a.teams);
    const y = playAll(startTournament([...b.teams.values()], 2028, 'Lyon', b.host, 5), b.teams);
    expect(x.games.map(g => `${g.a}${g.as}-${g.b}${g.bs}`)).toEqual(y.games.map(g => `${g.a}${g.as}-${g.b}${g.bs}`));
  }, 60_000);
});

import { runWorldGamesIfDue, resolvePending, worldGamesDue, medalLine } from '../worldGames/league';
import { applyCreateSettings, DEFAULT_CREATE } from '../menu/createSettings';
import { buildHallOfFameCase } from '../simulation/hallOfFame';

describe('World Games in a league', () => {
  const summer = (year: number, extra: Record<string, unknown> = {}) => {
    const { league, extras } = generateFullLeague(21, 30, 18, 82, String(year), { balanced: true });
    return { league: { ...league, calendarDate: `${year}-07-10`, seasonPhase: 'resign_waive' as const, ...extra }, extras };
  };
  it('runs only in Games years, once, and puts medals on the players', () => {
    expect(worldGamesDue(summer(2027).league)).toBeNull();
    const { league, extras } = summer(2028);
    expect(worldGamesDue(league)).toBe(2028);
    const out = runWorldGamesIfDue(league, extras.freeAgents, 9);
    expect(out.record).toBeDefined();
    const r = out.record!;
    expect(out.league.worldGames!.history).toHaveLength(1);
    const medalists = out.league.teams.flatMap(t => t.seasons).filter(p => p.worldGames?.some(m => m.year === 2028));
    expect(medalists.length).toBeGreaterThan(5);
    for (const p of medalists) {
      const m = p.worldGames!.find(x => x.year === 2028)!;
      expect([r.gold, r.silver, r.bronze]).toContain(m.country);
      expect(m.medal).toBe(m.country === r.gold ? 'gold' : m.country === r.silver ? 'silver' : 'bronze');
      expect(r.rosters[m.country]).toContain(p.playerId);
    }
    expect(medalLine(medalists[0].worldGames)).toContain('2028');
    // Not twice.
    expect(worldGamesDue(out.league)).toBeNull();
    expect(runWorldGamesIfDue(out.league, out.freeAgents, 9).record).toBeUndefined();
  }, 60_000);
  it('can be switched off, and waits for your twelve when you coach a country', () => {
    const off = summer(2028, { worldGames: { history: [], off: true } });
    expect(runWorldGamesIfDue(off.league, off.extras.freeAgents, 1).record).toBeUndefined();
    const coach = summer(2028, { worldGames: { history: [], coach: 'France' } });
    const pending = runWorldGamesIfDue(coach.league, coach.extras.freeAgents, 1);
    expect(pending.pending).toBe(true);
    expect(pending.league.worldGames!.pending).toMatchObject({ year: 2028, city: 'Los Angeles', host: 'USA' });
    // Auto Play lets the AI play it even when you coach.
    expect(runWorldGamesIfDue(coach.league, coach.extras.freeAgents, 1, { forceAi: true }).record).toBeDefined();
    // Left unplayed: the AI plays it out.
    const resolved = resolvePending(pending.league, pending.freeAgents, 1);
    expect(resolved.league.worldGames!.pending).toBeUndefined();
    expect(resolved.league.worldGames!.history[0].year).toBe(2028);
  }, 60_000);
  it('is set up from the New Franchise settings', () => {
    const { league, extras } = generateFullLeague(2, 30, 18, 82, '2026', { balanced: true });
    expect(applyCreateSettings(league, extras, DEFAULT_CREATE, true).league.worldGames).toBeUndefined();
    expect(applyCreateSettings(league, extras, { ...DEFAULT_CREATE, worldGames: false }, true).league.worldGames).toEqual({ history: [], off: true });
    expect(applyCreateSettings(league, extras, { ...DEFAULT_CREATE, worldGamesCoach: 'Spain' }, true).league.worldGames).toEqual({ history: [], coach: 'Spain' });
  });
  it('counts medals for the Hall of Fame', () => {
    const { league } = generateFullLeague(4, 30, 18, 82, '2026', { balanced: true });
    const p = league.teams[0].seasons[0];
    const record = { playerId: p.playerId, finalTeamId: 't', finalTeamName: 'T', finalSeason: '2030', finalAge: 35, finalOverall: 70, finalSeasonData: p } as never;
    const base = buildHallOfFameCase(p, record, league).score;
    const withGold = buildHallOfFameCase({ ...p, worldGames: [{ year: 2028, country: 'USA', medal: 'gold' }] }, record, league);
    expect(withGold.score).toBe(base + 4);
    expect(withGold.resume.join(' ')).toContain('World Games: 1 gold');
  });
});

import { buildHistoricalLeague } from '../history/historicalLeague';

describe('World Games in a real league', () => {
  it('gives real players their national team and their real medals from before the start', () => {
    const { league } = buildHistoricalLeague(h, 2016, { realDevelopment: true, difficulty: 'normal', seed: 1, allPlayers: true });
    const all = [...league.teams.flatMap(t => t.seasons), ...(league.retiredPlayers ?? []).map(r => r.finalSeasonData).filter(Boolean)] as import('../simulation/types').PlayerSeason[];
    const find = (name: string) => all.find(p => p.playerId === name);
    expect(find('Kevin Durant')?.worldGames?.map(m => `${m.year} ${m.medal}`)).toEqual(['2012 gold', '2016 gold']);
    expect(find('Nikola Jokić')?.nationality).toBe('Serbia');
    expect(find('Kevin Durant')?.nationality).toBe('USA');
    expect(find('Michael Jordan')?.worldGames?.[0]).toMatchObject({ year: 1992, medal: 'gold', real: true });
    // Nothing from after the league began.
    expect(all.flatMap(p => p.worldGames ?? []).every(m => m.year <= 2016)).toBe(true);
  }, 120_000);
});

import { countryCards, modeTeams, myPool, modeScore, MODE_GAMES } from '../worldGames/mode';

describe('World Games mode', () => {
  it('builds a real Games from that season, plays it, and scores it', () => {
    const cards = countryCards(h, 2008);
    expect(cards.get('Spain')!.map(c => c.name)).toContain('Pau Gasol');
    expect(cards.get('USA')!.every(c => c.end === 2008)).toBe(true);
    const pool = myPool(h, 2008, 'Spain');
    expect(pool.length).toBeGreaterThanOrEqual(3);
    const chosen = pool.slice(0, 12).map(p => p.playerId);
    const t0 = Date.now();
    const teams = modeTeams(h, 2008, 'Spain', chosen, 3);
    expect(teams.size).toBe(12);
    expect(teams.has('Spain') && teams.has('China')).toBe(true); // you and the host
    expect(teams.get('Spain')!.picked).toEqual(chosen);
    expect(teams.get('USA')!.players.map(p => p.playerId).some(id => id.startsWith('Kobe Bryant'))).toBe(true);
    const s = playAll(startTournament([...teams.values()], 2008, 'Beijing', 'China', 3), teams);
    expect(Date.now() - t0).toBeLessThan(20_000);
    const place = placings(s).indexOf('Spain');
    expect(place).toBeGreaterThanOrEqual(0);
    expect(modeScore(s, 'Spain', place)).toBeGreaterThan(-200);
  }, 60_000);
  it('has a Fantasy Games with every player at his best', () => {
    expect(MODE_GAMES.at(-1)!.id).toBe('fantasy');
    const usa = countryCards(h, 'fantasy').get('USA')!;
    expect(new Set(usa.map(c => c.playerId)).size).toBe(usa.length);
    expect(usa.slice(0, 15).map(c => c.name)).toContain('Michael Jordan');
  }, 60_000);
});
