import type { NbaHistory } from '../history/nbaHistoryData';
import type { PlayerSeason } from '../simulation/types';
import { RNG } from '../simulation/engine/rng';
import { cardPool, cardPlayer, type HuntCard } from '../hunt/cards';
import { COUNTRY_BY_NAME, REAL_GAMES, REAL_HOSTS, realNationality } from './data';
import { pickTeam, selectFieldByRatings, ROSTER_SIZE, type NationalTeam, type WGState } from './tournament';

/*
 * The World Games mode: coach one country at a real Games (1992 to 2024: each player as he was that season) or at the
 * Fantasy Games (every player in history at his best). No contracts, trades or free agency: pick twelve, win medals.
 */

export type GamesId = number | 'fantasy';
export const MODE_GAMES: { id: GamesId; label: string; blurb: string }[] = [
  ...REAL_GAMES.map(g => ({ id: g.year as GamesId, label: `${g.year} ${REAL_HOSTS[g.year].city}`, blurb: `Real result: ${g.gold} gold, ${g.silver} silver, ${g.bronze} bronze.` })).reverse(),
  { id: 'fantasy', label: 'Fantasy Games', blurb: 'Every player in history at his best: the 1992 Dream Team against Jokić, Dončić and Giannis.' },
];
/** How many of your country's players you can pick from. */
const POOL_SHOWN = 30;

/** Each country's cards for these Games, best first (one card a player: that season's, or his best ever). */
export function countryCards(h: NbaHistory, games: GamesId): Map<string, HuntCard[]> {
  const best = new Map<string, HuntCard>();
  for (const c of cardPool(h).cards) {
    if (games !== 'fantasy' && c.end !== games) continue;
    const o = best.get(c.playerId);
    if (!o || c.ovr > o.ovr) best.set(c.playerId, c);
  }
  const out = new Map<string, HuntCard[]>();
  for (const c of best.values()) { const k = realNationality(c.name); out.set(k, [...(out.get(k) ?? []), c]); }
  for (const list of out.values()) list.sort((a, b) => b.ovr - a.ovr);
  return out;
}

/** The host: the real one, or (Fantasy Games) your own country. */
export const hostFor = (games: GamesId, mine: string) => (games === 'fantasy' ? { city: 'Court Vision City', country: mine } : REAL_HOSTS[games]);

const players = (h: NbaHistory, cards: HuntCard[], code: string): PlayerSeason[] => cards.map(c => cardPlayer(h, c, code));

/** Your country's candidates (the best thirty) as players. */
export function myPool(h: NbaHistory, games: GamesId, country: string): PlayerSeason[] {
  const code = COUNTRY_BY_NAME.get(country)?.code ?? 'YOU';
  return players(h, (countryCards(h, games).get(country) ?? []).slice(0, POOL_SHOWN), code);
}

/** The twelve national teams: yours with your picks, the others with their best twelve (home-league players fill any gaps). */
export function modeTeams(h: NbaHistory, games: GamesId, mine: string, chosen: string[], seed: number): Map<string, NationalTeam> {
  const cards = countryCards(h, games);
  const host = hostFor(games, mine).country;
  // The field by card strength (the best twelve cards a country has), the host and you always in.
  let field = selectFieldByRatings(new Map([...cards].map(([c, list]) => [c, list.slice(0, ROSTER_SIZE).map(x => x.ovr)])), host);
  if (!field.includes(mine)) field = [...field.slice(0, field.length - 1), mine];
  const rng = new RNG(seed), used = new Set<string>();
  const season = games === 'fantasy' ? '2026' : String(games - 1);
  return new Map(field.map(c => {
    const code = COUNTRY_BY_NAME.get(c)?.code ?? c.slice(0, 3).toUpperCase();
    if (c === mine) {
      const pool = myPool(h, games, c);
      return [c, pickTeam(c, pool, { rng, season, used, chosen })];
    }
    return [c, pickTeam(c, players(h, (cards.get(c) ?? []).slice(0, ROSTER_SIZE), code), { rng, season, used })];
  }));
}

// ---------------------------------------------------------------- score and records

export const PLACE_POINTS = [1000, 600, 350, 200, 100, 100, 100, 100, 0, 0, 0, 0];
/** A run's score: by place, plus 15 a win and the points difference (up to 150). */
export function modeScore(s: WGState, mine: string, place: number): number {
  const mineGames = s.games.filter(g => g.a === mine || g.b === mine);
  const wins = mineGames.filter(g => g.winner === mine).length;
  const diff = mineGames.reduce((n, g) => n + (g.a === mine ? g.as - g.bs : g.bs - g.as), 0);
  return (PLACE_POINTS[place] ?? 0) + wins * 15 + Math.max(-150, Math.min(150, diff));
}

export interface ModeRecords { played: number; best: number; gold: number; silver: number; bronze: number; /** Best place by Games and country, "2008|Spain": 1. */ best_place: Record<string, number> }
const KEY = 'cv-world-games';
export function readModeRecords(): ModeRecords {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<ModeRecords> | null;
    return { played: r?.played ?? 0, best: r?.best ?? 0, gold: r?.gold ?? 0, silver: r?.silver ?? 0, bronze: r?.bronze ?? 0, best_place: r?.best_place ?? {} };
  } catch { return { played: 0, best: 0, gold: 0, silver: 0, bronze: 0, best_place: {} }; }
}
export function saveModeResult(games: GamesId, country: string, place: number, score: number): ModeRecords {
  const r = readModeRecords();
  const k = `${games}|${country}`;
  const next: ModeRecords = {
    played: r.played + 1, best: Math.max(r.best, score),
    gold: r.gold + (place === 0 ? 1 : 0), silver: r.silver + (place === 1 ? 1 : 0), bronze: r.bronze + (place === 2 ? 1 : 0),
    best_place: { ...r.best_place, [k]: Math.min(r.best_place[k] ?? 99, place + 1) },
  };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage blocked: this visit only */ }
  return next;
}
