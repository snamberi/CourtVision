import type { NbaHistory } from '../history/nbaHistoryData';
import { RNG } from '../simulation/engine/rng';
import { weekEndsAt, weeklySeed } from '../retention/week';
import { bracketOrder, legendsField, playStreet, type Baller, type StreetGame } from './street';

/*
 * The GM Tournament: sixteen GMs, one bracket, one week. Everyone gets the same 24 legends this week and the same
 * salary budget; you draft three, fifteen AI GMs draft theirs, and the bracket (3v3 to 21) plays one round at a time
 * through the week: the Round of 16 opens Monday, the quarterfinals Wednesday, the semifinals Friday, the final Sunday
 * (UTC). Every game is seeded by the week, so the bracket is fixed the moment you lock in your team.
 */

export const TOUR_SIZE = 16, TOUR_PICKS = 3, TOUR_POOL = 24, TOUR_BUDGET = 48, TOUR_TO = 21;
export const TOUR_ROUNDS = ['Round of 16', 'Quarterfinals', 'Semifinals', 'Final'] as const;
/** Days after Monday 00:00 UTC that each round opens. */
export const TOUR_OPENS = [0, 2, 4, 6] as const;
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export interface TourTeam { gm: string; players: Baller[]; you?: boolean }
export interface TourGame { round: number; a: TourTeam; b: TourTeam; score: [number, number]; winner: TourTeam; game: StreetGame }

const AI_GMS = ['Coach Pixel', 'Hoop Wizard', 'Bucket Boss', 'Glass Cleaner', 'Splash Bro', 'Fast Break Fox', 'Iron Pivot', 'Lob City GM',
  'Zone Buster', 'Triple Double', 'Sixth Man', 'Clutch Gene', 'Full Court Press', 'Pick and Pop', 'Swish Master', 'Board Man'];

/** What a legend costs against the budget: 1 for a 70, 25 for a 94. */
export const tourCost = (b: Baller) => Math.max(1, Math.round(b.ovr - 69));

/** This week's 24 legends, picked from the 64 greatest. The same for everyone. */
export function tourPool(h: NbaHistory, week: string): Baller[] {
  const rng = new RNG(weeklySeed('gm-tour-pool', week));
  return [...legendsField(h)].map(b => ({ b, k: rng.next() })).sort((x, y) => x.k - y.k).slice(0, TOUR_POOL).map(x => x.b).sort((a, b) => b.ovr - a.ovr);
}

export const teamCost = (players: Baller[]) => players.reduce((n, b) => n + tourCost(b), 0);
/** Can this pick still fit, leaving room for the cheapest legend in each slot that's left? */
export function canAfford(pool: Baller[], picked: Baller[], b: Baller): boolean {
  if (picked.length >= TOUR_PICKS || picked.some(p => p.id === b.id)) return false;
  const left = TOUR_PICKS - picked.length - 1;
  const cheapest = pool.filter(p => p.id !== b.id && !picked.some(x => x.id === p.id)).map(tourCost).sort((x, y) => x - y).slice(0, left);
  return teamCost(picked) + tourCost(b) + cheapest.reduce((n, c) => n + c, 0) <= TOUR_BUDGET;
}

/** Fifteen AI GMs draft from the same pool: each favours a different star, then fills under the budget. */
export function aiTeams(pool: Baller[], week: string): TourTeam[] {
  const rng = new RNG(weeklySeed('gm-tour-ai', week));
  const names = [...AI_GMS].map(n => ({ n, k: rng.next() })).sort((x, y) => x.k - y.k).map(x => x.n);
  return Array.from({ length: TOUR_SIZE - 1 }, (_, i) => {
    const picked: Baller[] = [];
    const order = pool.map(b => ({ b, k: b.ovr + rng.next() * 18 })).sort((x, y) => y.k - x.k).map(x => x.b);
    for (const b of order) if (canAfford(pool, picked, b)) picked.push(b);
    return { gm: names[i], players: picked };
  });
}

const seedStrength = (t: TourTeam) => t.players.reduce((n, b) => n + b.ovr, 0);
const gameSeed = (week: string, round: number, a: TourTeam, b: TourTeam) => weeklySeed(`gm-tour|${round}|${[a.gm, b.gm].sort().join('|')}`, week);

/** The whole bracket for your team: every game of every round, seeded 1 v 16 by team strength. */
export function runTournament(mine: TourTeam, ai: TourTeam[], week: string): { games: TourGame[]; seeds: TourTeam[]; champion: TourTeam } {
  const seeds = [mine, ...ai].sort((a, b) => seedStrength(b) - seedStrength(a) || (a.you ? -1 : 1));
  let alive = bracketOrder(TOUR_SIZE).map(i => seeds[i]);
  const games: TourGame[] = [];
  for (let round = 0; alive.length > 1; round++) {
    const next: TourTeam[] = [];
    for (let i = 0; i < alive.length; i += 2) {
      const a = alive[i], b = alive[i + 1];
      const g = playStreet(a.players, b.players, TOUR_TO, gameSeed(week, round, a, b));
      const winner = g.winner === 0 ? a : b;
      games.push({ round, a, b, score: g.score, winner, game: g });
      next.push(winner);
    }
    alive = next;
  }
  return { games, seeds, champion: alive[0] };
}

/** When round `r` opens this week (ms). */
export const roundOpensAt = (r: number, now = new Date()) => weekEndsAt(now) - 7 * 86_400_000 + TOUR_OPENS[r] * 86_400_000;
/** Rounds open so far this week. */
export const roundsOpen = (now = new Date()) => TOUR_OPENS.filter((_, r) => now.getTime() >= roundOpensAt(r, now)).length;
export const roundDay = (r: number) => DAY_NAMES[TOUR_OPENS[r]];

/** A game seen from team b's side (b becomes team 0), so "you" are always on the left. */
export const flipGame = (g: StreetGame): StreetGame => ({
  plays: g.plays.map(p => ({ ...p, team: (p.team === 0 ? 1 : 0) as 0 | 1, score: [p.score[1], p.score[0]] as [number, number] })),
  score: [g.score[1], g.score[0]], winner: g.winner === 0 ? 1 : 0,
});
