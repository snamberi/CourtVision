import type { PlayerSeason } from './types';
import type { League } from './league';
import { calculateOverall } from './engine/overall';

/* Career comps: players whose Overall at the same ages looked most like this player's, and how their careers went.
 * Built from the league's own career records (real careers too, in historical leagues). */

export interface CareerComp { playerId: string; distance: number; atAge: number; thenOverall: number; peakOverall: number; peakAge: number; seasons: number }

/** Overall by age: every archived season plus the current one. Seasons without a rating are skipped. */
export function overallCurve(p: PlayerSeason): Map<number, number> {
  const curve = new Map<number, number>();
  for (const c of p.careerHistory ?? []) if (c.overall > 0 && c.age > 0) curve.set(c.age, c.overall);
  curve.set(p.age, calculateOverall(p));
  return curve;
}

export function careerPool(league: League, freeAgents: PlayerSeason[]): PlayerSeason[] {
  const seen = new Set<string>();
  const out: PlayerSeason[] = [];
  for (const p of [...league.teams.flatMap(t => t.seasons), ...freeAgents, ...(league.retiredPlayers ?? []).flatMap(r => (r.finalSeasonData ? [r.finalSeasonData] : []))]) {
    if (seen.has(p.playerId)) continue;
    seen.add(p.playerId);
    out.push(p);
  }
  return out;
}

export function careerComps(target: PlayerSeason, pool: PlayerSeason[], count = 3): CareerComp[] {
  const mine = overallCurve(target);
  const age = target.age;
  const ages = [...mine.keys()].filter(a => a <= age && a >= age - 3);
  const out: CareerComp[] = [];
  for (const p of pool) {
    if (p.playerId === target.playerId) continue;
    const theirs = overallCurve(p);
    const later = [...theirs.keys()].filter(a => a > age);
    if (later.length < 2) continue; // a comp has to show where the road went
    const shared = ages.filter(a => theirs.has(a));
    if (!shared.length || (ages.length >= 2 && shared.length < 2)) continue;
    const distance = shared.reduce((s, a) => s + Math.abs(theirs.get(a)! - mine.get(a)!), 0) / shared.length;
    if (distance > 6) continue;
    let peakOverall = 0, peakAge = 0;
    for (const [a, o] of theirs) if (o > peakOverall) { peakOverall = o; peakAge = a; }
    out.push({ playerId: p.playerId, distance, atAge: age, thenOverall: theirs.get(age) ?? theirs.get(Math.max(...shared))!, peakOverall, peakAge, seasons: theirs.size });
  }
  return out.sort((a, b) => a.distance - b.distance || b.peakOverall - a.peakOverall).slice(0, count);
}
