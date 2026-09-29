import type { League, LeagueTeam } from './league';
import { splitTeamName } from '../visuals/pixelFont';

/*
 * Road trips and travel fatigue. Every team has a home city on the map: a real NBA city when its name has one, and
 * otherwise one of the real metro spots nobody else uses (fixed per team). Walking a team's schedule in order: every
 * flight adds fatigue by distance, time zones crossed and short rest; a stretch at home lets it drain away. Fatigue
 * is a small minus to decision-making and help defense on the night (up to -2.5; see gameBoost in league.ts), so long
 * road trips and coast-to-coast swings are felt the way they are in the real league.
 *
 * On your team's road trips you decide how to handle it: rest days (fatigue from the trip cut by more than half),
 * a team dinner (a chemistry boost), or push through (a sharper edge on the trip, but more fatigue).
 */

export interface City { name: string; lat: number; lon: number }
export const CITIES: City[] = [
  { name: 'Atlanta', lat: 33.75, lon: -84.39 }, { name: 'Boston', lat: 42.36, lon: -71.06 }, { name: 'Brooklyn', lat: 40.68, lon: -73.97 },
  { name: 'New York', lat: 40.75, lon: -73.99 }, { name: 'Charlotte', lat: 35.23, lon: -80.84 }, { name: 'Chicago', lat: 41.88, lon: -87.63 },
  { name: 'Cleveland', lat: 41.5, lon: -81.69 }, { name: 'Dallas', lat: 32.78, lon: -96.8 }, { name: 'Denver', lat: 39.74, lon: -104.99 },
  { name: 'Detroit', lat: 42.33, lon: -83.05 }, { name: 'Golden State', lat: 37.77, lon: -122.39 }, { name: 'San Francisco', lat: 37.77, lon: -122.42 },
  { name: 'Houston', lat: 29.76, lon: -95.37 }, { name: 'Indiana', lat: 39.77, lon: -86.16 }, { name: 'Indianapolis', lat: 39.77, lon: -86.16 },
  { name: 'Los Angeles', lat: 34.04, lon: -118.27 }, { name: 'LA', lat: 34.04, lon: -118.27 }, { name: 'Memphis', lat: 35.15, lon: -90.05 },
  { name: 'Miami', lat: 25.78, lon: -80.19 }, { name: 'Milwaukee', lat: 43.04, lon: -87.92 }, { name: 'Minnesota', lat: 44.98, lon: -93.28 },
  { name: 'New Orleans', lat: 29.95, lon: -90.08 }, { name: 'Oklahoma City', lat: 35.47, lon: -97.52 }, { name: 'Orlando', lat: 28.54, lon: -81.38 },
  { name: 'Philadelphia', lat: 39.95, lon: -75.17 }, { name: 'Phoenix', lat: 33.45, lon: -112.07 }, { name: 'Portland', lat: 45.52, lon: -122.68 },
  { name: 'Sacramento', lat: 38.58, lon: -121.49 }, { name: 'San Antonio', lat: 29.42, lon: -98.49 }, { name: 'Toronto', lat: 43.65, lon: -79.38 },
  { name: 'Utah', lat: 40.76, lon: -111.89 }, { name: 'Salt Lake City', lat: 40.76, lon: -111.89 }, { name: 'Washington', lat: 38.9, lon: -77.02 },
  { name: 'Seattle', lat: 47.6, lon: -122.33 }, { name: 'Vancouver', lat: 49.28, lon: -123.12 }, { name: 'Kansas City', lat: 39.1, lon: -94.58 },
  { name: 'St. Louis', lat: 38.63, lon: -90.2 }, { name: 'Buffalo', lat: 42.89, lon: -78.88 }, { name: 'Baltimore', lat: 39.29, lon: -76.61 },
  { name: 'Cincinnati', lat: 39.1, lon: -84.51 }, { name: 'San Diego', lat: 32.72, lon: -117.16 }, { name: 'Las Vegas', lat: 36.17, lon: -115.14 },
  { name: 'Louisville', lat: 38.25, lon: -85.76 }, { name: 'Tampa', lat: 27.95, lon: -82.46 }, { name: 'Nashville', lat: 36.16, lon: -86.78 },
  { name: 'Austin', lat: 30.27, lon: -97.74 }, { name: 'Pittsburgh', lat: 40.44, lon: -80.0 }, { name: 'Albuquerque', lat: 35.08, lon: -106.65 },
  { name: 'Omaha', lat: 41.26, lon: -95.93 }, { name: 'Boise', lat: 43.62, lon: -116.2 }, { name: 'Birmingham', lat: 33.52, lon: -86.8 },
  { name: 'Raleigh', lat: 35.78, lon: -78.64 }, { name: 'Columbus', lat: 39.96, lon: -83.0 }, { name: 'Anaheim', lat: 33.84, lon: -117.91 },
  { name: 'Montreal', lat: 45.5, lon: -73.57 }, { name: 'Hartford', lat: 41.76, lon: -72.68 }, { name: 'Spokane', lat: 47.66, lon: -117.43 },
  { name: 'El Paso', lat: 31.76, lon: -106.49 }, { name: 'Tulsa', lat: 36.15, lon: -95.99 }, { name: 'Richmond', lat: 37.54, lon: -77.44 },
];

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
/** Home cities by team line-up (keyed by ids and names, so a new teams array after every game still hits). */
const cache = new Map<string, Map<string, City>>();
const teamsKey = (teams: LeagueTeam[]) => teams.map(t => `${t.teamId}=${t.name}`).join('|');

/** Each team's home city (real when its name has one; otherwise a free real-metro spot, fixed per team). */
export function homeCities(teams: LeagueTeam[]): Map<string, City> {
  const key = teamsKey(teams);
  const hit = cache.get(key);
  if (hit) return hit;
  const out = new Map<string, City>(), used = new Set<string>();
  const byName = (name: string) => { const { city } = splitTeamName(name); return CITIES.find(c => c.name.toLowerCase() === city.toLowerCase()) ?? CITIES.find(c => name.toLowerCase().startsWith(c.name.toLowerCase() + ' ')); };
  for (const t of teams) { const c = byName(t.name); if (c) { out.set(t.teamId, { ...c, name: splitTeamName(t.name).city || c.name }); used.add(`${c.lat},${c.lon}`); } }
  for (const t of [...teams].sort((a, b) => hash(a.teamId) - hash(b.teamId))) {
    if (out.has(t.teamId)) continue;
    const free = CITIES.filter(c => !used.has(`${c.lat},${c.lon}`));
    const c = (free.length ? free : CITIES)[hash(t.teamId) % (free.length || CITIES.length)];
    used.add(`${c.lat},${c.lon}`);
    out.set(t.teamId, { ...c, name: splitTeamName(t.name).city || c.name });
  }
  if (cache.size > 50) cache.clear();
  cache.set(key, out);
  return out;
}

/** Great-circle miles. */
export function miles(a: City, b: City): number {
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 3959 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}
/** US time zone (0 Eastern … 3 Pacific) from longitude. */
export const timeZone = (c: City) => c.lon > -87.5 ? 0 : c.lon > -101 ? 1 : c.lon > -114.5 ? 2 : 3;
export const ZONE_NAME = ['Eastern', 'Central', 'Mountain', 'Pacific'];

export type TripPlan = 'rest' | 'dinner' | 'push';
export const TRIP_PLANS: { id: TripPlan; label: string; note: string }[] = [
  { id: 'rest', label: 'Rest days', note: 'Light practices, extra sleep: fatigue from this trip is cut by more than half.' },
  { id: 'dinner', label: 'Team dinner', note: 'Everyone around one table: team chemistry +3 and every bond on the roster a little stronger.' },
  { id: 'push', label: 'Push through', note: 'Film, shootarounds, no days off: a sharper edge on the trip, but 25% more fatigue.' },
];
export interface TravelState { season: string; teamId: string; plans: Record<string, TripPlan>; dinners: string[] }

export interface TripLeg { gameId: string; round: number; opponentId: string; city: City; miles: number; zones: number; fatigue: number; played: boolean; won?: boolean }
export interface RoadTrip { id: string; legs: TripLeg[]; miles: number; zones: number; peak: number; plan?: TripPlan }

interface Walk { fatigue: Map<string, number>; trips: RoadTrip[] }
const walkCache = new WeakMap<League['schedule'], Map<string, Walk>>();

/** Walks a team's schedule in order: fatigue before every game, and its road trips (2+ road games in a row). */
export function travelWalk(league: League, teamId: string): Walk {
  let perSchedule = walkCache.get(league.schedule);
  if (!perSchedule) { perSchedule = new Map(); walkCache.set(league.schedule, perSchedule); }
  const plans = league.travel?.teamId === teamId && league.travel.season === league.season ? league.travel.plans : {};
  const key = `${teamId}|${JSON.stringify(plans)}`;
  const hit = perSchedule.get(key);
  if (hit) return hit;
  const cities = homeCities(league.teams);
  const home = cities.get(teamId);
  const fatigue = new Map<string, number>(), trips: RoadTrip[] = [];
  if (!home) return { fatigue, trips };
  const games = league.schedule.filter(g => g.homeTeamId === teamId || g.awayTeamId === teamId);
  let at = home, f = 0, lastRound = -99, trip: RoadTrip | null = null;
  for (const g of games) {
    const away = g.awayTeamId === teamId, host = cities.get(g.homeTeamId) ?? home;
    const gap = Math.max(1, g.round - lastRound);
    f *= Math.pow(0.7, gap);                              // every game day, the legs come back a little
    const d = miles(at, host), z = Math.abs(timeZone(at) - timeZone(host));
    if (d > 1) f += d / 1500 + z * 0.45 + (gap <= 1 ? 0.2 : 0); // a flight: distance, time zones, short rest
    if (!away) f *= 0.6;                                  // sleeping in your own bed
    if (away) {
      if (!trip) trip = { id: `${teamId}:${g.id}`, legs: [], miles: 0, zones: 0, peak: 0 };
      const plan = plans[trip.id];
      if (plan === 'rest') f *= 0.55; else if (plan === 'push') f *= 1.08;
    } else if (trip) { if (trip.legs.length >= 2) trips.push(trip); trip = null; }
    f = Math.min(8, f);
    fatigue.set(g.id, Math.round(f * 100) / 100);
    if (away && trip) {
      const us = g.result ? g.result.awayScore : 0, them = g.result ? g.result.homeScore : 0;
      trip.legs.push({ gameId: g.id, round: g.round, opponentId: g.homeTeamId, city: host, miles: Math.round(d), zones: z, fatigue: Math.round(f * 10) / 10, played: !!g.played, won: g.result ? us > them : undefined });
      trip.miles += Math.round(d); trip.zones += z; trip.peak = Math.max(trip.peak, f); trip.plan = plans[trip.id];
    }
    at = host; lastRound = g.round;
  }
  if (trip && trip.legs.length >= 2) trips.push(trip);
  const walk = { fatigue, trips };
  perSchedule.set(key, walk);
  return walk;
}

/*
 * Fatigue only depends on the schedule's shape (who plays where, on which day) and the trip plans, not on results, so
 * the game-night lookup is cached by that shape: the league's arrays are new after every game, the walk is not.
 */
const edgeCache = new Map<string, { fatigue: Map<string, number>; pushed: Set<string> }>();
function scheduleKey(league: League): string {
  const s = league.schedule;
  let rounds = 0;
  for (let i = 0; i < s.length; i++) rounds = (rounds * 31 + s[i].round) | 0;
  return `${league.season}|${s.length}|${s[0]?.id}|${s[s.length - 1]?.id}|${rounds}|${teamsKey(league.teams)}`;
}
function edgeWalk(league: League, teamId: string) {
  const plans = league.travel?.teamId === teamId && league.travel.season === league.season ? league.travel.plans : {};
  const key = `${scheduleKey(league)}|${teamId}|${JSON.stringify(plans)}`;
  let hit = edgeCache.get(key);
  if (!hit) {
    const w = travelWalk(league, teamId);
    hit = { fatigue: w.fatigue, pushed: new Set(w.trips.filter(t => t.plan === 'push').flatMap(t => t.legs.map(l => l.gameId))) };
    if (edgeCache.size > 400) edgeCache.clear();
    edgeCache.set(key, hit);
  }
  return hit;
}

/** Tonight's travel effect for a team: minus up to 2.5 from fatigue, plus 1 on a trip you chose to push through. */
export function travelEdge(league: League, teamId: string, gameId: string): number {
  const w = edgeWalk(league, teamId);
  const f = w.fatigue.get(gameId) ?? 0;
  const pushed = w.pushed.has(gameId) ? 1 : 0;
  return Math.round((-Math.min(2.5, f * 0.3) + pushed) * 100) / 100;
}

/** Picks a plan for one of your road trips (a team dinner also lifts chemistry and bonds, once per trip). */
export function planTrip(league: League, teamId: string, tripId: string, plan: TripPlan): League {
  const state: TravelState = league.travel?.teamId === teamId && league.travel.season === league.season ? league.travel : { season: league.season ?? '', teamId, plans: {}, dinners: [] };
  let teams = league.teams, dinners = state.dinners;
  if (plan === 'dinner' && !dinners.includes(tripId)) {
    dinners = [...dinners, tripId];
    teams = teams.map(t => t.teamId !== teamId ? t : {
      ...t, chemistry: Math.min(100, (t.chemistry ?? 70) + 3),
      bonds: Object.fromEntries(Object.entries(t.bonds ?? {}).map(([k, v]) => [k, Math.min(100, v + 2)])),
    });
  }
  return { ...league, teams, travel: { ...state, plans: { ...state.plans, [tripId]: plan }, dinners } };
}
