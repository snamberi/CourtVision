import type { GameSettings, PlayerSeason } from '../simulation/types';
import { DEFAULT_GAME_SETTINGS } from '../simulation/types';
import type { GameResult } from '../simulation/boxscore';
import { simulateGame } from '../simulation/engine/game';
import { calculateOverall } from '../simulation/engine/overall';
import { RNG } from '../simulation/engine/rng';
import { defaultCoachTendencies } from '../simulation/league';
import { generatePlayer } from '../simulation/leagueGenerator';
import { nameForCountry } from '../simulation/names';
import { DEFAULT_LEAGUE_RULES } from '../simulation/leagueRules';
import { COUNTRY_BY_NAME, type Medal } from './data';

/*
 * The World Games tournament: twelve national teams of twelve, three groups of four (round robin), the top two of each
 * group and the two best third-placed teams into the quarterfinals, then semifinals, a bronze game and the final.
 * FIBA rules: 40-minute games, the shorter three-point line, zone defence, no defensive three seconds, five fouls.
 */

export const FIBA_ERA: GameSettings['era'] = {
  threePointLineDistance: 22.15, shotClockSeconds: 24, quarterLengthMinutes: 10, numberOfQuarters: 4, overtimeLengthMinutes: 5,
  handChecking: false, zoneDefenseAllowed: true, defensiveThreeSeconds: false,
};
export const FIBA_RULES = { ...DEFAULT_LEAGUE_RULES, personalFoulLimit: 5, offensiveEfficiency: DEFAULT_LEAGUE_RULES.offensiveEfficiency * 0.9 };
export const ROSTER_SIZE = 12;
export const FIELD_SIZE = 12;
/** Minutes for a 40-minute game, best player first. */
const MINUTES = [30, 28, 27, 26, 25, 20, 16, 12, 8, 5, 2, 1];

/** A player's national team (players without one are American, like most of the league). */
export const countryOf = (p: PlayerSeason) => p.nationality || 'USA';

export interface NationalTeam {
  country: string;
  players: PlayerSeason[];
  /** League players on the team (ids), and the stars who said no. */
  picked: string[];
  declined: string[];
  /** How many of the twelve are home-league players (not from this league). */
  homeLeague: number;
  strength: number;
}

const strengthOf = (players: PlayerSeason[]) => {
  const top = players.map(calculateOverall).sort((a, b) => b - a).slice(0, 8);
  return top.length ? Math.round(top.reduce((a, b) => a + b, 0) / top.length * 10) / 10 : 0;
};

export interface PickOptions {
  rng: RNG;
  /** The season label for generated home-league players. */
  season: string;
  /** Names already in use. */
  used: Set<string>;
  /** Whether a player turns the invitation down (older stars sometimes do). */
  declines?: (p: PlayerSeason) => boolean;
  /** Ids to take first, in this order (your own picks). */
  chosen?: string[];
}

/** A country's twelve: its best available players, then home-league players for any spots left. */
export function pickTeam(country: string, pool: PlayerSeason[], o: PickOptions): NationalTeam {
  const byId = new Map(pool.map(p => [p.playerId, p]));
  const declined: string[] = [];
  const team: PlayerSeason[] = [];
  for (const id of o.chosen ?? []) { const p = byId.get(id); if (p && team.length < ROSTER_SIZE && !team.includes(p)) team.push(p); }
  if (!o.chosen?.length) {
    for (const p of [...pool].sort((a, b) => calculateOverall(b) - calculateOverall(a))) {
      if (team.length >= ROSTER_SIZE) break;
      if (o.declines?.(p)) { declined.push(p.playerId); continue; }
      team.push(p);
    }
  }
  const picked = team.map(p => p.playerId);
  const home = COUNTRY_BY_NAME.get(country)?.home ?? 45;
  let homeLeague = 0;
  while (team.length < ROSTER_SIZE) {
    const name = nameForCountry(country, o.rng, o.used);
    const age = 21 + o.rng.nextInt(12);
    const caliber = Math.round(home + (o.rng.next() - 0.5) * 8 - homeLeague * 0.6);
    team.push(generatePlayer(name, o.season, null, age, o.rng.nextInt(1000), o.rng, { caliber, origin: { name, nationality: country, college: null } }));
    homeLeague++;
  }
  return { country, players: team, picked, declined, homeLeague, strength: strengthOf(team) };
}

/** The twelve countries: the host, then the strongest by their best eight. Each pool is that country's players. */
export function selectField(pools: Map<string, PlayerSeason[]>, host: string): string[] {
  return selectFieldByRatings(new Map([...pools].map(([c, ps]) => [c, ps.map(calculateOverall)])), host);
}

/** The same from each country's player ratings (home-league players fill the gaps at the country's home level). */
export function selectFieldByRatings(ratings: Map<string, number[]>, host: string): string[] {
  const rated = [...ratings].map(([country, list]) => {
    const home = COUNTRY_BY_NAME.get(country)?.home ?? 45;
    const top = [...list].sort((a, b) => b - a).slice(0, 8);
    while (top.length < 8) top.push(home);
    return { country, strength: top.reduce((a, b) => a + b, 0) / 8 };
  }).sort((a, b) => b.strength - a.strength || a.country.localeCompare(b.country));
  const field = [host, ...rated.map(r => r.country).filter(c => c !== host)];
  // Countries with no players at all still make up the twelve, by home-league strength.
  for (const c of [...COUNTRY_BY_NAME.values()].sort((a, b) => b.home - a.home)) { if (field.length >= FIELD_SIZE) break; if (!field.includes(c.name)) field.push(c.name); }
  return field.slice(0, FIELD_SIZE);
}

// ---------------------------------------------------------------- the tournament

export type Stage = 'group' | 'qf' | 'sf' | 'bronze' | 'final';
export interface WGGame { stage: Stage; group?: number; a: string; b: string; as: number; bs: number; winner: string; ot: boolean; top: { id: string; pts: number } }
export interface WGLine { id: string; country: string; g: number; min: number; pts: number; reb: number; ast: number; stl: number; blk: number }
export interface GroupRow { country: string; w: number; l: number; pf: number; pa: number }

export interface WGState {
  year: number; city: string; host: string; seed: number;
  /** Groups of four countries, A to C. */
  groups: string[][];
  games: WGGame[];
  /** Steps played: 0-2 the group rounds, 3 quarterfinals, 4 semifinals, 5 the medal games. */
  step: number;
  lines: Record<string, WGLine>;
  /** Each team's twelve, as ids. */
  rosters: Record<string, string[]>;
  strength: Record<string, number>;
  done: boolean;
}
export const STEP_NAMES = ['Group round 1', 'Group round 2', 'Group round 3', 'Quarterfinals', 'Semifinals', 'Medal games'];
export const GROUP_NAMES = ['A', 'B', 'C'];
const ROUND_ROBIN: [number, number][][] = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];

/** Draws the groups (snake by strength, so each group gets one of the top three) and sets up the tournament. */
export function startTournament(teams: NationalTeam[], year: number, city: string, host: string, seed: number): WGState {
  const sorted = [...teams].sort((a, b) => b.strength - a.strength);
  const groups: string[][] = [[], [], []];
  sorted.forEach((t, i) => { const row = Math.floor(i / 3), col = i % 3; groups[row % 2 ? 2 - col : col].push(t.country); });
  return {
    year, city, host, seed, groups, games: [], step: 0, lines: {}, done: false,
    rosters: Object.fromEntries(teams.map(t => [t.country, t.players.map(p => p.playerId)])),
    strength: Object.fromEntries(teams.map(t => [t.country, t.strength])),
  };
}

const rotation = (players: PlayerSeason[], teamId: string) => [...players].sort((a, b) => calculateOverall(b) - calculateOverall(a))
  .map((p, i) => ({ ...p, teamId, rotationRole: i < 5 ? 'starter' as const : 'bench' as const, minutes: { mode: 'TARGET' as const, target: MINUTES[i] ?? 0 } }));

/** One game between two national teams (the host, when playing, is at home). */
export function playGame(s: WGState, teams: Map<string, NationalTeam>, a: string, b: string, stage: Stage, seed: number, group?: number): { game: WGGame; result: GameResult } {
  const [home, away] = b === s.host ? [b, a] : [a, b];
  const code = (c: string) => COUNTRY_BY_NAME.get(c)?.code ?? c.slice(0, 3).toUpperCase();
  // FIBA games run slower than the NBA (fewer possessions in 40 minutes): about 80-85 points a team.
  const coach = { ...defaultCoachTendencies(), rotationDepth: 10, paceTendency: 25 };
  const result = simulateGame({
    home: { teamId: code(home), seasons: rotation(teams.get(home)!.players, code(home)), coach, chemistry: 70 },
    away: { teamId: code(away), seasons: rotation(teams.get(away)!.players, code(away)), coach, chemistry: 70 },
    settings: { ...DEFAULT_GAME_SETTINGS, era: FIBA_ERA, seed, injuriesEnabled: false, teamChemistryEnabled: false, homeCourtAdvantage: home === s.host ? 0.03 : 0 },
    rules: FIBA_RULES,
  });
  const score = { [home]: result.homeScore, [away]: result.awayScore };
  const top = [...Object.values(result.homeBox.players), ...Object.values(result.awayBox.players)].sort((x, y) => y.points - x.points)[0];
  const game: WGGame = { stage, group, a, b, as: score[a], bs: score[b], winner: score[a] > score[b] ? a : b, ot: (result.regulationPeriods ?? 4) > 4 || result.homeScore === result.awayScore, top: { id: top?.playerId ?? '', pts: top?.points ?? 0 } };
  return { game, result };
}

function addLines(s: WGState, result: GameResult, countryOfTeam: Record<string, string>) {
  for (const box of [result.homeBox, result.awayBox]) {
    const country = countryOfTeam[box.teamId];
    for (const l of Object.values(box.players)) {
      if (!l.minutes) continue;
      const o = s.lines[l.playerId] ?? { id: l.playerId, country, g: 0, min: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0 };
      o.g++; o.min += l.minutes; o.pts += l.points; o.reb += l.oreb + l.dreb; o.ast += l.ast; o.stl += l.stl; o.blk += l.blk;
      s.lines[l.playerId] = o;
    }
  }
}

/** The group table, best first: wins, then points difference, then points scored. */
export function groupTable(s: Pick<WGState, 'groups' | 'games'>, g: number): GroupRow[] {
  const rows = new Map(s.groups[g].map(c => [c, { country: c, w: 0, l: 0, pf: 0, pa: 0 }]));
  for (const x of s.games) {
    if (x.stage !== 'group' || x.group !== g) continue;
    const ra = rows.get(x.a)!, rb = rows.get(x.b)!;
    ra.pf += x.as; ra.pa += x.bs; rb.pf += x.bs; rb.pa += x.as;
    if (x.winner === x.a) { ra.w++; rb.l++; } else { rb.w++; ra.l++; }
  }
  return [...rows.values()].sort((a, b) => b.w - a.w || (b.pf - b.pa) - (a.pf - a.pa) || b.pf - a.pf || a.country.localeCompare(b.country));
}

const rank = (r: GroupRow, s: WGState) => [r.w, r.pf - r.pa, r.pf, -s.strength[r.country]];
const better = (s: WGState) => (x: GroupRow, y: GroupRow) => { const a = rank(x, s), b = rank(y, s); for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return b[i] - a[i]; return 0; };

/** The eight quarterfinalists, seeded 1-8: group winners, runners-up, then the two best thirds. */
export function quarterfinalists(s: WGState): string[] {
  const tables = s.groups.map((_, g) => groupTable(s, g));
  const firsts = tables.map(t => t[0]).sort(better(s)), seconds = tables.map(t => t[1]).sort(better(s)), thirds = tables.map(t => t[2]).sort(better(s)).slice(0, 2);
  return [...firsts, ...seconds, ...thirds].map(r => r.country);
}

const winnersOf = (s: WGState, stage: Stage) => s.games.filter(g => g.stage === stage).map(g => g.winner);
const losersOf = (s: WGState, stage: Stage) => s.games.filter(g => g.stage === stage).map(g => (g.winner === g.a ? g.b : g.a));

/** The games of the next step, as [a, b, stage, group] (empty once the tournament is over). */
export function nextPairs(s: WGState): [string, string, Stage, number?][] {
  if (s.step < 3) return s.groups.flatMap((g, gi) => ROUND_ROBIN[s.step].map(([i, j]) => [g[i], g[j], 'group', gi] as [string, string, Stage, number]));
  if (s.step === 3) { const q = quarterfinalists(s); return [[q[0], q[7], 'qf'], [q[3], q[4], 'qf'], [q[1], q[6], 'qf'], [q[2], q[5], 'qf']]; }
  if (s.step === 4) { const w = winnersOf(s, 'qf'); return [[w[0], w[1], 'sf'], [w[2], w[3], 'sf']]; }
  if (s.step === 5) { const w = winnersOf(s, 'sf'), l = losersOf(s, 'sf'); return [[l[0], l[1], 'bronze'], [w[0], w[1], 'final']]; }
  return [];
}

/** Plays the next step (a group round, the quarterfinals, the semifinals or the medal games). */
export function playStep(s: WGState, teams: Map<string, NationalTeam>): WGState {
  if (s.done) return s;
  const next: WGState = { ...s, games: [...s.games], lines: { ...s.lines } };
  for (const id of Object.keys(next.lines)) next.lines[id] = { ...next.lines[id] };
  const codeToCountry = Object.fromEntries([...teams.keys()].map(c => [COUNTRY_BY_NAME.get(c)?.code ?? c.slice(0, 3).toUpperCase(), c]));
  nextPairs(s).forEach(([a, b, stage, group], i) => {
    const { game, result } = playGame(next, teams, a, b, stage, (s.seed * 31 + s.step * 97 + i * 7919) % 2_147_483_647, group);
    next.games.push(game);
    addLines(next, result, codeToCountry);
  });
  next.step = s.step + 1;
  next.done = next.step >= STEP_NAMES.length;
  return next;
}

export const playAll = (s: WGState, teams: Map<string, NationalTeam>) => { let x = s; while (!x.done) x = playStep(x, teams); return x; };

// ---------------------------------------------------------------- results

export interface Podium { gold: string; silver: string; bronze: string }
export function podium(s: WGState): Podium | null {
  const f = s.games.find(g => g.stage === 'final'), b = s.games.find(g => g.stage === 'bronze');
  if (!f || !b) return null;
  return { gold: f.winner, silver: f.winner === f.a ? f.b : f.a, bronze: b.winner };
}

/** Every country's finishing place (1-12): medals, fourth, the quarterfinal losers, then the rest by group record. */
export function placings(s: WGState): string[] {
  const p = podium(s);
  if (!p) return [];
  const b = s.games.find(g => g.stage === 'bronze')!;
  const fourth = b.winner === b.a ? b.b : b.a;
  const tables = s.groups.flatMap((_, g) => groupTable(s, g));
  const row = new Map(tables.map(r => [r.country, r]));
  const qfLosers = losersOf(s, 'qf').sort((x, y) => better(s)(row.get(x)!, row.get(y)!));
  const out = [p.gold, p.silver, p.bronze, fourth, ...qfLosers];
  return [...out, ...tables.filter(r => !out.includes(r.country)).sort(better(s)).map(r => r.country)];
}

export const medalOf = (s: WGState, country: string): Medal | null => {
  const p = podium(s);
  return !p ? null : p.gold === country ? 'gold' : p.silver === country ? 'silver' : p.bronze === country ? 'bronze' : null;
};

const value = (l: WGLine) => (l.pts + 1.2 * l.reb + 1.5 * l.ast + 2 * (l.stl + l.blk)) / Math.max(1, l.g);

/** The MVP (from the medal teams, the champion counting most) and the All-Tournament five. */
export function tournamentAwards(s: WGState): { mvp: WGLine | null; allTournament: WGLine[] } {
  const p = podium(s);
  const bonus = (c: string) => (p?.gold === c ? 6 : p?.silver === c ? 3 : p?.bronze === c ? 1.5 : 0);
  const lines = Object.values(s.lines).filter(l => l.g >= 4);
  const mvp = [...lines].filter(l => bonus(l.country) > 0).sort((a, b) => value(b) + bonus(b.country) - value(a) - bonus(a.country))[0] ?? null;
  const allTournament = [...lines].sort((a, b) => value(b) + bonus(b.country) / 2 - value(a) - bonus(a.country) / 2).slice(0, 5);
  return { mvp, allTournament };
}
