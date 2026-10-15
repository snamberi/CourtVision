import { describe, it, expect } from 'vitest';
import { buildWorldLeague } from '../simulation/worldLeagueBuild';
import { WORLD_LEAGUES, WORLD_LEAGUE_IDS } from '../simulation/worldLeagues';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { calculateOverall } from '../simulation/engine/overall';
import { autoGeneratePlayoffBracket, simulateFullPlayoffs } from '../simulation/playoffs';
import { simulateRounds, hasConferenceStructure } from '../simulation/league';
import { encodeLeagueCode, decodeLeagueCode, describeOrigin } from '../retention/leagueCode';
import { generateDraftClass } from '../simulation/gm';
import { shouldRetire } from '../simulation/seasonTransition';
import { RNG } from '../simulation/engine/rng';
import { applyCreateSettings, DEFAULT_CREATE } from '../menu/createSettings';

const avgOverall = (teams: { seasons: Parameters<typeof calculateOverall>[0][] }[]) => {
  const all = teams.flatMap(t => t.seasons);
  return all.reduce((n, p) => n + calculateOverall(p), 0) / all.length;
};

describe('other leagues', () => {
  const nba = generateFullLeague(5, 30, 18, 82, '2025', { balanced: true });
  for (const id of WORLD_LEAGUE_IDS) {
    const def = WORLD_LEAGUES[id];
    it(`${def.name}: real clubs, its own rules, its players, one table`, () => {
      const { league, extras } = buildWorldLeague(id, 11, 2025);
      expect(league.worldLeague).toBe(id);
      expect(league.teams.map(t => t.name)).toEqual(def.clubs.map(c => c.name));
      expect(league.teams.every(t => t.identity?.abbreviation && t.seasons.length === def.rosterSize)).toBe(true);
      expect(new Set(league.teams.map(t => t.teamId)).size).toBe(league.teams.length);
      expect(hasConferenceStructure(league)).toBe(false);
      expect(league.settings.era).toMatchObject({ numberOfQuarters: def.periods, quarterLengthMinutes: def.minutes, shotClockSeconds: def.shotClock, threePointLineDistance: def.line });
      expect(league.settings.gamesPerSeason).toBe(def.games);
      expect(league.worldGames?.off).toBe(true);
      const games = league.schedule.filter(g => g.homeTeamId === league.teams[0].teamId || g.awayTeamId === league.teams[0].teamId).length;
      expect(games).toBe(def.games);
      const players = league.teams.flatMap(t => t.seasons);
      expect(players.every(p => p.age >= def.ages[0] && p.age <= def.ages[1])).toBe(true);
      // The home country is the biggest group (the EuroLeague is a mix with many imports).
      const counts = new Map<string, number>();
      for (const p of players) counts.set(p.nationality ?? '?', (counts.get(p.nationality ?? '?') ?? 0) + 1);
      const top = [...counts].sort((a, b) => b[1] - a[1])[0][0];
      expect(top).toBe(def.mix[0][0]);
      expect(avgOverall(league.teams)).toBeLessThan(avgOverall(nba.league.teams));
      expect(new Set(players.map(p => p.playerId)).size).toBe(players.length);
      expect(Object.keys(extras.contracts).length).toBe(players.length);
      if (id === 'college') expect(players.every(p => def.clubs.some(c => c.name === p.college))).toBe(true);
    });
  }

  it('plays a season and its own playoff format (college: one game a round)', () => {
    const { league } = buildWorldLeague('college', 3, 2025);
    const played = simulateRounds(league, 12, 9);
    expect(played.schedule.filter(g => g.played).length).toBeGreaterThan(80);
    // Two 20-minute halves.
    const game = played.schedule.find(g => g.played)!.result!;
    expect(game.regulationPeriods).toBe(2);
    const bracket = autoGeneratePlayoffBracket(played);
    expect(bracket.rounds[0].length).toBe(8);
    expect(bracket.rounds[0].every(s => s.gamesToWin === 1)).toBe(true);
    const done = simulateFullPlayoffs(bracket, played);
    expect(done.bracket.championTeamId).toBeTruthy();
    const euro = autoGeneratePlayoffBracket(buildWorldLeague('euro', 3, 2025).league);
    expect(euro.rounds[0].length).toBe(4);
    expect(euro.rounds[0][0].gamesToWin).toBe(3);
  });

  it('a yearly intake in the league\'s own mix and ages; college players move on after 22', () => {
    const cls = generateDraftClass(30, 4, '2026', [], WORLD_LEAGUES.china);
    expect(cls.filter(p => p.trueSeason.nationality === 'China').length).toBeGreaterThan(18);
    expect(cls.every(p => p.trueSeason.age >= 18 && p.trueSeason.age <= 21)).toBe(true);
    const freshmen = generateDraftClass(10, 4, '2026', [], WORLD_LEAGUES.college);
    expect(freshmen.every(p => p.trueSeason.age === 18)).toBe(true);
    const senior = { ...freshmen[0].trueSeason, age: 23 };
    expect(shouldRetire(senior, new RNG(1), undefined, 22)).toBe(true);
    expect(shouldRetire({ ...senior, age: 22 }, new RNG(1), undefined, 22)).toBe(false);
  });

  it('league codes rebuild the same league', () => {
    const origin = { kind: 'world' as const, world: 'georgia' as const, year: 2025, seed: 777, difficulty: 'normal' as const };
    const code = encodeLeagueCode(origin, 'W-DIN');
    expect(code.startsWith('WGEORGIA2025-')).toBe(true);
    const back = decodeLeagueCode(code);
    expect(back.origin).toMatchObject({ kind: 'world', world: 'georgia', year: 2025, seed: 777, difficulty: 'normal' });
    expect(describeOrigin(back.origin)).toContain('Georgian Superleague');
    const a = buildWorldLeague('georgia', 777, 2025), b = buildWorldLeague('georgia', 777, 2025);
    expect(a.league.teams.map(t => t.seasons.map(p => p.playerId))).toEqual(b.league.teams.map(t => t.seasons.map(p => p.playerId)));
  });

  it('New Franchise settings keep the league\'s own season unless it is changed', () => {
    const built = buildWorldLeague('euro', 2, 2025);
    const s = { ...DEFAULT_CREATE, games: 34, periods: 4, quarterMinutes: 10, injuries: true };
    const { league } = applyCreateSettings(built.league, built.extras, s, true);
    expect(league.schedule).toBe(built.league.schedule);
    expect(league.settings.era.quarterLengthMinutes).toBe(10);
    const longer = applyCreateSettings(built.league, built.extras, { ...s, games: 41 }, true).league;
    expect(longer.schedule.filter(g => g.homeTeamId === longer.teams[0].teamId || g.awayTeamId === longer.teams[0].teamId).length).toBe(41);
  });
});
