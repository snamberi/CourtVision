import type { League } from './league';
import { computeStandings } from './league';
import { RNG } from './engine/rng';

/*
 * How the first round is ordered, for every era of NBA drafts. "Year accurate" uses the rule the real league used in
 * that draft year; the others pin one rule forever. The worst team is always first in the list handed in here.
 *
 *  1947–1965  Reverse standings (the territorial-pick years): worst record picks first, no lottery.
 *  1966–1984  Coin flip: the last-place teams of the two conferences flip for picks 1 and 2.
 *  1985–1986  Envelope lottery: every non-playoff team has the same chance, and the draw sets all of their picks.
 *  1987–1989  Equal-odds lottery for the top 3 picks; the rest go in reverse order.
 *  1990–1993  Weighted lottery (66 combinations): the worst team gets 11 chances, the next 10, and so on, for the top 3.
 *  1994–2018  Weighted lottery (1,000 combinations): 25% for the worst team, top 3 picks drawn.
 *  2019–      Flattened odds: 14% each for the three worst teams, top 4 picks drawn.
 */
export type LotteryFormat = 'auto' | 'modern2019' | 'weighted1994' | 'weighted1990' | 'equal1987' | 'envelope1985' | 'coinFlip1966' | 'none';

export interface LotteryRule { id: Exclude<LotteryFormat, 'auto'>; label: string; years: string; blurb: string }
export const LOTTERY_RULES: LotteryRule[] = [
  { id: 'modern2019', label: 'Flattened lottery', years: '2019–today', blurb: 'The three worst teams share 14% odds; the top 4 picks are drawn.' },
  { id: 'weighted1994', label: 'Weighted lottery', years: '1994–2018', blurb: 'The worst team has a 25% shot at No. 1; the top 3 picks are drawn.' },
  { id: 'weighted1990', label: 'First weighted lottery', years: '1990–1993', blurb: 'The worst team gets 11 of 66 chances; the top 3 picks are drawn.' },
  { id: 'equal1987', label: 'Equal-odds lottery', years: '1987–1989', blurb: 'Every non-playoff team has the same odds for the top 3 picks.' },
  { id: 'envelope1985', label: 'Envelope draw', years: '1985–1986', blurb: 'Every non-playoff team has the same odds, and the draw sets all their picks.' },
  { id: 'coinFlip1966', label: 'Coin flip', years: '1966–1984', blurb: 'The last-place team in each conference flips a coin for the No. 1 pick.' },
  { id: 'none', label: 'Worst picks first', years: '1947–1965', blurb: 'No lottery: the worst record always picks first.' },
];

/** The rule the real NBA used in a draft year (the June that ends the season starting a year earlier). */
export function lotteryFormatForYear(draftYear: number): Exclude<LotteryFormat, 'auto'> {
  if (draftYear >= 2019) return 'modern2019';
  if (draftYear >= 1994) return 'weighted1994';
  if (draftYear >= 1990) return 'weighted1990';
  if (draftYear >= 1987) return 'equal1987';
  if (draftYear >= 1985) return 'envelope1985';
  if (draftYear >= 1966) return 'coinFlip1966';
  return 'none';
}

/** The format in force for a league's draft this year. Historical leagues default to year accurate, others to today's. */
export function activeLotteryFormat(league: Pick<League, 'settings' | 'historical'>, draftYear: number): Exclude<LotteryFormat, 'auto'> {
  const chosen = league.settings?.draftLottery ?? (league.historical ? 'auto' : 'modern2019');
  return chosen === 'auto' ? lotteryFormatForYear(draftYear) : chosen;
}

const MODERN = [140, 140, 140, 125, 105, 90, 75, 60, 45, 30, 20, 15, 10, 5];
const WEIGHTED_1994 = [250, 199, 156, 119, 88, 63, 43, 28, 17, 11, 8, 7, 6, 5];

/** Lottery weights for a pool (worst team first) and how many picks are drawn; null means no draw. */
export function lotteryWeights(format: Exclude<LotteryFormat, 'auto'>, pool: number): { weights: number[]; drawn: number } | null {
  if (pool < 2) return null;
  const pad = (table: number[]) => Array.from({ length: pool }, (_, i) => table[i] ?? table[table.length - 1]);
  switch (format) {
    case 'modern2019': return { weights: pad(MODERN), drawn: Math.min(4, pool) };
    case 'weighted1994': return { weights: pad(WEIGHTED_1994), drawn: Math.min(3, pool) };
    case 'weighted1990': return { weights: Array.from({ length: pool }, (_, i) => pool - i), drawn: Math.min(3, pool) };
    case 'equal1987': return { weights: Array(pool).fill(1), drawn: Math.min(3, pool) };
    case 'envelope1985': return { weights: Array(pool).fill(1), drawn: pool };
    default: return null;
  }
}

/** Each team's chance of landing No. 1, worst team first (for the lottery reveal). */
export function oddsForTop(format: Exclude<LotteryFormat, 'auto'>, pool: number): number[] {
  if (format === 'coinFlip1966') return Array.from({ length: pool }, (_, i) => (i < 2 ? 50 : 0));
  const w = lotteryWeights(format, pool);
  if (!w) return Array.from({ length: pool }, (_, i) => (i === 0 ? 100 : 0));
  const total = w.weights.reduce((a, b) => a + b, 0);
  return w.weights.map(x => Math.round((x / total) * 1000) / 10);
}

/** Teams that missed the playoffs (the lottery pool), worst record first. Falls back to the worst 14 before a bracket exists. */
export function lotteryPool(league: League, worstFirst: string[]): string[] {
  const inBracket = new Set((league.playoffBracket?.rounds[0] ?? []).flatMap(s => [s.teamAId, s.teamBId]).filter((x): x is string => !!x));
  const missed = inBracket.size >= 2 ? worstFirst.filter(id => !inBracket.has(id)) : worstFirst.slice(0, Math.min(14, worstFirst.length));
  return missed.length >= 2 ? missed : worstFirst.slice(0, Math.min(14, worstFirst.length));
}

/** First-round order under a format. `worstFirst` lists every team from worst record to best. */
export function firstRoundOrder(league: League, worstFirst: string[], format: Exclude<LotteryFormat, 'auto'>, seed: number): string[] {
  const pool = lotteryPool(league, worstFirst);
  const rest = worstFirst.filter(id => !pool.includes(id));
  const rng = new RNG(seed);
  if (format === 'none') return worstFirst;
  if (format === 'coinFlip1966') {
    // The worst team in each conference flips (the two worst overall in a league without conferences).
    const conf = new Map(league.teams.map(t => [t.teamId, t.conferenceId]));
    const east = worstFirst.find(id => conf.get(id) === 'east'), west = worstFirst.find(id => conf.get(id) === 'west');
    const pair = east && west ? [east, west] : worstFirst.slice(0, 2);
    const flip = rng.next() < 0.5 ? pair : [pair[1], pair[0]];
    return [...flip, ...worstFirst.filter(id => !flip.includes(id))];
  }
  const w = lotteryWeights(format, pool.length);
  if (!w) return worstFirst;
  const left = [...pool], weights = [...w.weights], top: string[] = [];
  for (let i = 0; i < w.drawn; i++) {
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = rng.next() * total, idx = weights.length - 1;
    for (let j = 0; j < weights.length; j++) { roll -= weights[j]; if (roll <= 0) { idx = j; break; } }
    top.push(left[idx]); left.splice(idx, 1); weights.splice(idx, 1);
  }
  return [...top, ...left, ...rest];
}

/** The whole first round for a league's draft this year. */
export function lotteryFirstRound(league: League, draftYear: number, seed: number): string[] {
  const worstFirst = [...computeStandings(league)].sort((a, b) => a.winPct - b.winPct).map(r => r.teamId);
  return firstRoundOrder(league, worstFirst, activeLotteryFormat(league, draftYear), seed);
}
