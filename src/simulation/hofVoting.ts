import type { League } from './league';
import { computeHallOfFame, HOF_THRESHOLD, type HallOfFameCase } from './hallOfFame';

/* Hall of Fame voting: every completed season a class is voted in. A retired player becomes eligible the season after
 * he retires and stays on the ballot up to ten years. His vote share follows his Hall of Fame case (a case right at
 * the bar polls about 75%), grows a little each year on the ballot, and 75% gets him in. Derived from the league's
 * records, so it needs no stored state and old leagues get their whole voting history. */

export const INDUCTION_SHARE = 0.75;
const BALLOT_YEARS = 10;
const BALLOT_FLOOR = 0.6; // case needed (share of the threshold) to appear on the ballot at all

export interface BallotEntry { playerId: string; share: number; year: number; inducted: boolean; score: number; finalTeamName: string }
export interface HofClass { season: string; inducted: BallotEntry[]; ballot: BallotEntry[] }

function jitter(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return (((h >>> 0) % 1000) / 1000 - 0.5) * 0.08; // ±4 points
}

export function voteShare(score: number, yearOnBallot: number, key: string): number {
  const base = INDUCTION_SHARE * (score / HOF_THRESHOLD);
  return Math.max(0.01, Math.min(0.99, base + (yearOnBallot - 1) * 0.03 + jitter(key)));
}

/** Every class this league has voted in, oldest first. Players who retired before the league began are not voted on. */
export function hallOfFameClasses(league: League, cases: HallOfFameCase[] = computeHallOfFame(league)): HofClass[] {
  const preStart = new Set((league.retiredPlayers ?? []).filter(r => r.preStart).map(r => r.playerId));
  const candidates = cases.filter(c => !preStart.has(c.playerId) && c.score >= HOF_THRESHOLD * BALLOT_FLOOR);
  const seasons = (league.franchiseHistory ?? []).filter(r => !r.imported).map(r => r.season).sort((a, b) => Number(a) - Number(b));
  const inducted = new Set<string>();
  const classes: HofClass[] = [];
  for (const season of seasons) {
    const ballot: BallotEntry[] = [];
    for (const c of candidates) {
      const year = Number(season) - Number(c.finalSeason);
      if (inducted.has(c.playerId) || year < 1 || year > BALLOT_YEARS) continue;
      const share = voteShare(c.score, year, `${c.playerId}|${season}`);
      ballot.push({ playerId: c.playerId, share, year, inducted: share >= INDUCTION_SHARE, score: c.score, finalTeamName: c.finalTeamName });
    }
    ballot.sort((a, b) => b.share - a.share);
    const cls = ballot.filter(b => b.inducted);
    for (const b of cls) inducted.add(b.playerId);
    classes.push({ season, inducted: cls, ballot: ballot.slice(0, 12) });
  }
  return classes;
}

/** Who is in the Hall: everyone voted in, plus pre-league retirees whose case clears the bar. */
export function hallOfFamers(league: League, cases: HallOfFameCase[], classes: HofClass[]): Set<string> {
  const preStart = new Set((league.retiredPlayers ?? []).filter(r => r.preStart).map(r => r.playerId));
  return new Set([...classes.flatMap(c => c.inducted.map(i => i.playerId)), ...cases.filter(c => preStart.has(c.playerId) && c.score >= HOF_THRESHOLD).map(c => c.playerId)]);
}
