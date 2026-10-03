import type { NbaHistory } from '../history/nbaHistoryData';
import { huntTeams, type HuntTeam } from '../hunt/teams';
import { dreamGame } from '../hunt/matchup';
import { eraOf } from '../hunt/eras';
import { BRACKET_POINTS } from './storage';

/*
 * The weekly Playoff Bracket Challenge: sixteen great team-seasons from all of history, seeded by strength. Pick the
 * winner of every series before tip-off, then watch it play out. The games are the same for everyone that week (the
 * week's seed decides them, not your picks), best of seven, the higher seed at home 2-2-1-1-1 under its era's rules.
 */

export const ROUND_NAMES = ['First round', 'Quarterfinals', 'Semifinals', 'Final'] as const;
/** Seeds (1-based) meeting in the first round, in bracket order. */
export const FIRST_ROUND: [number, number][] = [[1, 16], [8, 9], [5, 12], [4, 13], [6, 11], [3, 14], [7, 10], [2, 15]];
/** Pick slots: 0-7 first round, 8-11 quarters, 12-13 semis, 14 the final. */
export const ROUND_SLOTS = [[0, 8], [8, 12], [12, 14], [14, 15]] as const;
export const roundOf = (slot: number) => ROUND_SLOTS.findIndex(([a, b]) => slot >= a && slot < b);

function hash(s: string): number { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

/** Eras for a random bracket (seasons by the year they end). */
export const BRACKET_ERAS = [
  { id: 'all', label: 'All eras', from: 1960, to: 9999 },
  { id: 'old', label: '1960-1989', from: 1960, to: 1989 },
  { id: 'mid', label: '1990-2009', from: 1990, to: 2009 },
  { id: 'new', label: '2010 to now', from: 2010, to: 9999 },
] as const;
export type BracketEra = typeof BRACKET_ERAS[number]['id'];

/** Sixteen champions and great teams, one season per franchise, best seeded first. `key` is the week (or a random
 *  bracket's seed); an era narrows the field, filled out with 55-win teams when it is short. */
export function bracketField(h: NbaHistory, key: string, era: BracketEra = 'all'): HuntTeam[] {
  const { from, to } = BRACKET_ERAS.find(e => e.id === era) ?? BRACKET_ERAS[0];
  const all = huntTeams(h).filter(t => t.end >= from && t.end <= to);
  const top = all.filter(t => t.champion || t.w >= 60);
  const great = new Set(top.map(t => t.abbr)).size >= 16 ? top : all.filter(t => t.champion || t.w >= 55);
  const shuffled = [...great].sort((a, b) => hash(`${key}|${a.id}`) - hash(`${key}|${b.id}`));
  const field: HuntTeam[] = [], used = new Set<string>();
  for (const t of shuffled) { if (used.has(t.abbr)) continue; used.add(t.abbr); field.push(t); if (field.length === 16) break; }
  return field.sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id));
}

export const teamLabel = (t: HuntTeam) => `${t.end - 1}-${String(t.end).slice(2)} ${t.name}`;

/** The two teams in each slot, given the winners so far (by slot). `null` while a feeder slot is undecided. */
export function slotTeams(field: HuntTeam[], winners: (string | null | undefined)[], slot: number): [string | null, string | null] {
  if (slot < 8) { const [a, b] = FIRST_ROUND[slot]; return [field[a - 1]?.id ?? null, field[b - 1]?.id ?? null]; }
  const r = roundOf(slot), [start] = ROUND_SLOTS[r], [prevStart] = ROUND_SLOTS[r - 1];
  const i = slot - start;
  return [winners[prevStart + i * 2] ?? null, winners[prevStart + i * 2 + 1] ?? null];
}

export interface SeriesGame { home: string; homeScore: number; awayScore: number; winner: string }
export interface Series { slot: number; high: string; low: string; winsHigh: number; winsLow: number; winner: string; games: SeriesGame[] }

const HOME_PATTERN = [true, true, false, false, true, false, true];

/** One best-of-seven: the better seed (`high`) at home in games 1, 2, 5 and 7. */
export function playSeries(h: NbaHistory, week: string, slot: number, high: HuntTeam, low: HuntTeam): Series {
  const s: Series = { slot, high: high.id, low: low.id, winsHigh: 0, winsLow: 0, winner: '', games: [] };
  for (let g = 0; g < 7 && s.winsHigh < 4 && s.winsLow < 4; g++) {
    const home = HOME_PATTERN[g] ? high : low, away = home === high ? low : high;
    const game = dreamGame(h, home.id, away.id, eraOf(home.end), hash(`bracket|${week}|${slot}|${g}`) % 1_000_000_000);
    if (!game) break;
    const homeWon = game.result.homeScore > game.result.awayScore;
    const winner = homeWon ? home.id : away.id;
    if (winner === high.id) s.winsHigh++; else s.winsLow++;
    s.games.push({ home: home.id, homeScore: game.result.homeScore, awayScore: game.result.awayScore, winner });
  }
  s.winner = s.winsHigh >= s.winsLow ? high.id : low.id;
  return s;
}

/** Points for a set of picks against the results so far. */
export function scorePicks(picks: (string | null)[], results: Series[]): number {
  let score = 0;
  for (const r of results) if (picks[r.slot] && picks[r.slot] === r.winner) score += BRACKET_POINTS[roundOf(r.slot)];
  return score;
}

/** The seed (1-16) of a team in the field. */
export const seedOf = (field: HuntTeam[], id: string) => field.findIndex(t => t.id === id) + 1;
