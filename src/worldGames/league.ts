import type { League } from '../simulation/league';
import type { PlayerSeason } from '../simulation/types';
import { RNG } from '../simulation/engine/rng';
import { calculateOverall } from '../simulation/engine/overall';
import { hostOf, isGamesYear, type Medal, type WorldMedal } from './data';
import {
  countryOf, pickTeam, selectField, startTournament, playAll, podium, placings, tournamentAwards, medalOf,
  type NationalTeam, type WGState, type WGGame, type WGLine,
} from './tournament';

/*
 * The World Games inside a GM league: every four summers, right after the draft (as the real Games come after the
 * NBA Finals and draft). By default the AI picks every country's twelve and plays it out; you can instead coach one
 * country (pick its twelve and play it round by round). Medals go on the players for good.
 */

export interface WorldGamesRecord {
  year: number; city: string; host: string;
  gold: string; silver: string; bronze: string;
  /** Finishing order, 1-12. */
  placings: string[];
  /** The three groups of four. */
  groups: string[][];
  games: WGGame[];
  /** Each country's twelve (player names). */
  rosters: Record<string, string[]>;
  mvp: WGLine | null;
  allTournament: WGLine[];
  /** Every player's tournament line. */
  lines: WGLine[];
  /** The country you coached, if you did. */
  coached?: string;
}

export interface LeagueWorldGames {
  history: WorldGamesRecord[];
  /** Turned off in the league's settings. */
  off?: boolean;
  /** Coach this country yourself (unset: the AI plays every country). */
  coach?: string;
  /** A Games waiting for you to pick your twelve and play it (when you coach a country). */
  pending?: { year: number; city: string; host: string };
}

/** The calendar year of the summer the league is in (the draft and free agency). */
export function summerYear(league: League): number | null {
  const d = league.calendarDate ? Date.parse(league.calendarDate) : NaN;
  if (Number.isFinite(d)) return new Date(d).getUTCFullYear();
  const s = parseInt(String(league.season ?? ''), 10);
  return Number.isFinite(s) ? s : null;
}

/** A World Games is due this summer: a Games year, switched on, not played yet. */
export function worldGamesDue(league: League): number | null {
  const year = summerYear(league);
  if (year == null || !isGamesYear(year) || league.worldGames?.off) return null;
  if (league.worldGames?.history.some(r => r.year === year) || league.worldGames?.pending?.year === year) return null;
  return year;
}

/** Everyone who can be picked: players on a team or available, healthy. */
export function eligiblePlayers(league: League, freeAgents: PlayerSeason[] = []): PlayerSeason[] {
  const hurt = (id: string) => (league.injuries?.[id]?.gamesRemaining ?? 0) > 0;
  return [...league.teams.flatMap(t => t.seasons), ...freeAgents].filter(p => !hurt(p.playerId));
}

export function poolsOf(players: PlayerSeason[]): Map<string, PlayerSeason[]> {
  const pools = new Map<string, PlayerSeason[]>();
  for (const p of players) { const c = countryOf(p); pools.set(c, [...(pools.get(c) ?? []), p]); }
  return pools;
}

/** The twelve national teams for a year (your country with your picks, when you coach one). */
export function buildTeams(league: League, freeAgents: PlayerSeason[], year: number, seed: number, mine?: { country: string; chosen: string[] }): { teams: Map<string, NationalTeam>; host: string; city: string } {
  const { city, country: host } = hostOf(year);
  const players = eligiblePlayers(league, freeAgents);
  const pools = poolsOf(players);
  const field = selectField(pools, host);
  if (mine && !field.includes(mine.country)) field[field.length - 1] = mine.country;
  const rng = new RNG(seed), used = new Set(players.map(p => p.playerId));
  // Older stars sometimes stay home for the summer.
  const declines = (p: PlayerSeason) => p.age >= 34 && rng.next() < 0.5;
  const teams = new Map(field.map(c => [c, pickTeam(c, pools.get(c) ?? [], { rng, season: String(league.season ?? year), used, declines, chosen: mine?.country === c ? mine.chosen : undefined })]));
  return { teams, host, city };
}

/** The finished tournament as a record for the league's history. */
export function recordOf(s: WGState, coached?: string): WorldGamesRecord {
  const p = podium(s)!;
  const { mvp, allTournament } = tournamentAwards(s);
  return {
    year: s.year, city: s.city, host: s.host, gold: p.gold, silver: p.silver, bronze: p.bronze, placings: placings(s),
    groups: s.groups, games: s.games, rosters: s.rosters, mvp, allTournament,
    lines: Object.values(s.lines).sort((a, b) => b.pts - a.pts),
    ...(coached ? { coached } : {}),
  };
}

/**
 * The Games' mark on the league: medals on the players who played, a morale lift for medal winners, a little growth for
 * young players who played (one point of potential), and the odd summer injury (when injuries are on).
 */
export function applyResults(league: League, freeAgents: PlayerSeason[], s: WGState, record: WorldGamesRecord, seed: number): { league: League; freeAgents: PlayerSeason[] } {
  const rng = new RNG(seed ^ 0x5eed);
  const played = new Map<string, WGLine>(Object.values(s.lines).map(l => [l.id, l]));
  const injuries = { ...(league.injuries ?? {}) };
  const update = (p: PlayerSeason): PlayerSeason => {
    const line = played.get(p.playerId);
    if (!line || countryOf(p) !== line.country) return p;
    let next = p;
    const medal: Medal | null = medalOf(s, line.country);
    if (medal) {
      const m: WorldMedal = { year: s.year, country: line.country, medal, city: s.city };
      next = { ...next, worldGames: [...(next.worldGames ?? []), m] };
      if (next.morale) next = { ...next, morale: { ...next.morale, score: Math.min(100, next.morale.score + (medal === 'gold' ? 6 : 3)) } };
    }
    if (p.age <= 24 && line.g >= 3) next = { ...next, development: { ...next.development, potential: Math.max(calculateOverall(next), Math.min(99, next.development.potential + 1)) } };
    if (league.settings.injuriesEnabled && p.teamId && rng.next() < 0.012 * league.settings.injuryFrequencyMultiplier) {
      const games = 3 + rng.nextInt(8);
      injuries[p.playerId] = { playerId: p.playerId, teamId: p.teamId, severity: 'minor', gamesRemaining: games, totalGames: games } as NonNullable<League['injuries']>[string];
    }
    return next;
  };
  const wg = league.worldGames ?? { history: [] };
  return {
    league: {
      ...league,
      teams: league.teams.map(t => ({ ...t, seasons: t.seasons.map(update) })),
      injuries,
      worldGames: { ...wg, history: [...wg.history.filter(r => r.year !== record.year), record], pending: undefined },
    },
    freeAgents: freeAgents.map(update),
  };
}

/**
 * This summer's World Games when they are due. With the AI playing (the default) it is played and applied at once;
 * when you coach a country it is left pending for you to pick your twelve and play it.
 */
export function runWorldGamesIfDue(league: League, freeAgents: PlayerSeason[], seed: number, opts: { forceAi?: boolean } = {}): { league: League; freeAgents: PlayerSeason[]; record?: WorldGamesRecord; pending?: boolean } {
  const year = worldGamesDue(league);
  if (year == null) return { league, freeAgents };
  const { city, country: host } = hostOf(year);
  // Auto Play can't stop for your picks: there the AI plays it even when you coach a country.
  if (league.worldGames?.coach && !opts.forceAi) {
    return { league: { ...league, worldGames: { ...(league.worldGames ?? { history: [] }), pending: { year, city, host } } }, freeAgents, pending: true };
  }
  const { teams } = buildTeams(league, freeAgents, year, seed);
  const s = playAll(startTournament([...teams.values()], year, city, host, seed), teams);
  const record = recordOf(s);
  const out = applyResults(league, freeAgents, s, record, seed);
  return { ...out, record };
}

/** A player's medals as a short line: "🥇 2028 USA · 🥈 2032 USA". */
export const MEDAL_ICON: Record<Medal, string> = { gold: '🥇', silver: '🥈', bronze: '🥉' };
export const medalLine = (ms: WorldMedal[] | undefined) => (ms ?? []).map(m => `${MEDAL_ICON[m.medal]} ${m.year}`).join(' · ');

/** A Games you were going to coach but left unplayed: the AI plays it out (on to free agency). */
export function resolvePending(league: League, freeAgents: PlayerSeason[], seed: number): { league: League; freeAgents: PlayerSeason[] } {
  const p = league.worldGames?.pending;
  if (!p) return { league, freeAgents };
  const { teams } = buildTeams(league, freeAgents, p.year, seed);
  const s = playAll(startTournament([...teams.values()], p.year, p.city, p.host, seed), teams);
  return applyResults(league, freeAgents, s, recordOf(s), seed);
}
