import type { NbaHistory } from '../history/nbaHistoryData';
import type { PlayerSeason } from '../simulation/types';
import { wheelPool, donor } from '../career/wheel';
import { RNG } from '../simulation/engine/rng';
import { weekKey, weeklySeed } from '../retention/week';

/*
 * Street ball on a half court: 1v1 (the Legends Tournament, first to 11) and 3v3 (Street, first to 21). Ones inside
 * the arc, twos from deep, win by two, loser's ball. Each trip the offense picks a shot by what its man is good at,
 * the defender matched up contests, and misses go to a rebound battle. Seeded, so the same game plays the same way.
 */

export interface Baller { id: string; name: string; inside: number; mid: number; three: number; handle: number; perD: number; intD: number; reb: number; height: number; ovr: number; team?: string }
export interface StreetPlay { team: 0 | 1; by: string; shot: 'inside' | 'mid' | 'three'; made: boolean; pts: number; score: [number, number]; text: string }
export interface StreetGame { plays: StreetPlay[]; score: [number, number]; winner: 0 | 1 }

const avg = (...v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
export function ballerOf(p: PlayerSeason, name: string, ovr: number, team?: string): Baller {
  const o = p.attributes.offense, d = p.attributes.defense, ph = p.attributes.physical;
  return {
    id: p.playerId, name, ovr, team,
    inside: avg(o.closeShot, o.drivingLayup, o.drivingDunk, o.finishing ?? o.closeShot),
    mid: avg(o.midrange, o.longMidrange),
    three: avg(o.threePoint, o.pullUp3 ?? o.threePoint),
    handle: avg(o.ballHandling, o.speedWithBall),
    perD: avg(d.perimeterDefense, d.steal),
    intD: avg(d.interiorDefense, d.block, d.rimProtection ?? d.interiorDefense),
    reb: avg(d.defensiveRebounding, o.offensiveRebounding),
    height: ph.heightInches,
  };
}

/** Plays one game. `to` is the winning score (11 for 1v1, 21 for 3v3). */
export function playStreet(a: Baller[], b: Baller[], to: number, seed: number): StreetGame {
  const rng = new RNG(seed);
  const teams = [a, b] as const;
  const score: [number, number] = [0, 0];
  const plays: StreetPlay[] = [];
  let ball: 0 | 1 = rng.next() < 0.5 ? 0 : 1;
  for (let trip = 0; trip < 400; trip++) {
    const off = teams[ball], def = teams[ball === 0 ? 1 : 0];
    // The ball goes to the better scorers more often.
    const weights = off.map(p => Math.max(1, p.ovr - 40) ** 1.5);
    let r = rng.next() * weights.reduce((x, y) => x + y, 0), si = 0;
    for (; si < off.length - 1; si++) { r -= weights[si]; if (r <= 0) break; }
    const shooter = off[si], guard = def[Math.min(si, def.length - 1)];
    const pref = { inside: shooter.inside + shooter.handle * 0.3 + (shooter.height - guard.height) * 2, mid: shooter.mid, three: shooter.three * 1.05 } as const;
    const kinds = (['inside', 'mid', 'three'] as const);
    const kw = kinds.map(k => Math.max(1, pref[k] - 45) ** 2);
    let kr = rng.next() * kw.reduce((x, y) => x + y, 0), ki = 0;
    for (; ki < 2; ki++) { kr -= kw[ki]; if (kr <= 0) break; }
    const shot = kinds[ki];
    const skill = shot === 'inside' ? shooter.inside : shot === 'mid' ? shooter.mid : shooter.three;
    const d = shot === 'inside' ? guard.intD + (guard.height - shooter.height) * 1.5 : guard.perD;
    const base = shot === 'inside' ? 0.56 : shot === 'mid' ? 0.44 : 0.36;
    const made = rng.next() < Math.max(0.12, Math.min(0.85, base + (skill - d) / 180));
    const pts = made ? (shot === 'three' ? 2 : 1) : 0;
    score[ball] += pts;
    const call = made ? (shot === 'three' ? `${shooter.name} drains a deep two` : shot === 'mid' ? `${shooter.name} hits the pull-up` : `${shooter.name} scores at the rim`) : (shot === 'inside' && guard.intD > 75 && rng.next() < 0.3 ? `${guard.name} blocks ${shooter.name}` : `${shooter.name} misses`);
    plays.push({ team: ball, by: shooter.id, shot, made, pts, score: [score[0], score[1]], text: call });
    const leader = score[0] >= to || score[1] >= to ? (score[0] > score[1] ? 0 : 1) : null;
    if (leader != null && Math.abs(score[0] - score[1]) >= 2) return { plays, score, winner: leader };
    if (made) { ball = ball === 0 ? 1 : 0; continue; }
    // A miss: the rebound battle.
    const offReb = Math.max(...off.map(p => p.reb + p.height * 0.5)), defReb = Math.max(...def.map(p => p.reb + p.height * 0.5));
    if (rng.next() >= 0.3 + (offReb - defReb) / 300) ball = ball === 0 ? 1 : 0;
  }
  return { plays, score, winner: score[0] >= score[1] ? 0 : 1 };
}

// ---------------------------------------------------------------- the Legends Tournament

export const FIELD = 64;
const fields = new WeakMap<NbaHistory, Baller[]>();
/** The 64 greatest at their best season, seeded by overall. */
export function legendsField(h: NbaHistory): Baller[] {
  const hit = fields.get(h);
  if (hit) return hit;
  const cards = [...wheelPool(h)].sort((a, b) => b.ovr - a.ovr).slice(0, FIELD);
  const out = cards.map(c => ballerOf(donor(h, c.id), c.name, c.ovr, c.team));
  fields.set(h, out);
  return out;
}
/** First-round order: seed 1 v 64, 32 v 33 and so on, so the top seeds meet late. */
export function bracketOrder(n = FIELD): number[] {
  let order = [0];
  while (order.length < n) { const size = order.length * 2; order = order.flatMap(s => [s, size - 1 - s]); }
  return order;
}
export const tournamentWeek = (now = new Date()) => weekKey(now);
const gameSeed = (week: string, round: number, a: string, b: string) => weeklySeed(`legends|${round}|${[a, b].sort().join('|')}`, week);

/** The whole bracket with nobody playing in it: this week's champion and every round. */
export function simulateBracket(field: Baller[], week: string): { rounds: Baller[][]; champion: Baller } {
  let alive = bracketOrder(field.length).map(i => field[i]);
  const rounds: Baller[][] = [alive];
  for (let round = 0; alive.length > 1; round++) {
    const next: Baller[] = [];
    for (let i = 0; i < alive.length; i += 2) {
      const g = playStreet([alive[i]], [alive[i + 1]], 11, gameSeed(week, round, alive[i].id, alive[i + 1].id));
      next.push(g.winner === 0 ? alive[i] : alive[i + 1]);
    }
    alive = next; rounds.push(alive);
  }
  return { rounds, champion: alive[0] };
}

/** Your legend's next opponent: whoever wins the other half of his bracket slot this round (the AI bracket). */
export function opponentFor(field: Baller[], week: string, mine: Baller, round: number): Baller | null {
  const order = bracketOrder(field.length).map(i => field[i]);
  const slot = order.findIndex(p => p.id === mine.id);
  if (slot < 0) return null;
  const { rounds } = simulateBracket(field, week);
  // In round r the survivors stand in bracket order; you are at slot / 2^r and play the one next to you.
  return rounds[round]?.[Math.floor(slot / 2 ** round) ^ 1] ?? null;
}
/** Your game in a round (seeded by the week, so everyone's Jordan-vs-Bird plays the same). */
export const playRound = (week: string, round: number, mine: Baller, opp: Baller) => playStreet([mine], [opp], 11, gameSeed(week, round, mine.id, opp.id) ^ 0x5bd1);
export const ROUND_NAMES = ['Round of 64', 'Round of 32', 'Sweet 16', 'Elite 8', 'Final Four', 'Final'];
