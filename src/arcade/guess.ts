import type { NbaHistory } from '../history/nbaHistoryData';
import { allFacts, isNotable, isGuessable, posLetters, heightLabel, type PlayerFacts } from './facts';
import { GUESS_TRIES, type GuessDay } from './storage';

/*
 * Guess the Player: one real player a day, the same for everyone (UTC days). Each guess is compared column by column
 * with the answer: green is right, yellow is close, and the arrow says which way to go.
 */

export const FIRST_GUESS_DAY = '2026-10-02';
export type Mark = 'hit' | 'close' | 'miss';
export interface Cell { label: string; value: string; mark: Mark; arrow?: 'up' | 'down' }

/** The puzzle number: #1 on the first day. */
export const puzzleNumber = (day: string) => Math.floor((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${FIRST_GUESS_DAY}T00:00:00Z`)) / 86_400_000) + 1;

function hash(s: string): number { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

/** The answers, in a fixed shuffled order; day N takes the Nth (so no repeats for years). */
export function answerPool(h: NbaHistory): PlayerFacts[] {
  return allFacts(h).filter(isNotable).sort((a, b) => hash(`cv-guess|${a.name}`) - hash(`cv-guess|${b.name}`) || a.idx - b.idx);
}
export function dailyAnswer(h: NbaHistory, day: string): PlayerFacts {
  const pool = answerPool(h), n = puzzleNumber(day);
  return pool[((n % pool.length) + pool.length) % pool.length];
}
export const guessable = (h: NbaHistory) => allFacts(h).filter(isGuessable);

const num = (label: string, g: number, a: number, close: number, show: (n: number) => string): Cell =>
  ({ label, value: show(g), mark: g === a ? 'hit' : Math.abs(g - a) <= close ? 'close' : 'miss', ...(g === a ? {} : { arrow: a > g ? 'up' as const : 'down' as const }) });

/** A guess against the answer, column by column. */
export function compare(g: PlayerFacts, a: PlayerFacts): Cell[] {
  const gp = posLetters(g.pos), ap = posLetters(a.pos);
  const posMark: Mark = g.pos === a.pos ? 'hit' : [...gp].some(x => ap.has(x)) ? 'close' : 'miss';
  return [
    { label: 'Team', value: g.team, mark: g.franchise === a.franchise ? 'hit' : 'miss' },
    { label: 'Pos', value: g.pos, mark: posMark },
    g.heightIn != null && a.heightIn != null ? num('Height', g.heightIn, a.heightIn, 2, heightLabel) : { label: 'Height', value: heightLabel(g.heightIn), mark: 'miss' },
    num('Debut', g.debut, a.debut, 3, String),
    num('PPG', g.ppg, a.ppg, 2, n => n.toFixed(1)),
    num('All-Star', g.allStars, a.allStars, 1, String),
  ];
}

export const isSolved = (d: GuessDay | undefined, answer: PlayerFacts) => !!d && d.guesses.includes(answer.idx);
export { isGuessDone as isOver } from './storage';

/** The spoiler-free result to share: one row of squares per guess. */
export function shareText(day: string, d: GuessDay, rows: Cell[][], url: string): string {
  const sq = (m: Mark) => (m === 'hit' ? '🟩' : m === 'close' ? '🟨' : '⬛');
  return [`Court Vision: Guess the Player #${puzzleNumber(day)} ${d.won ? d.guesses.length : 'X'}/${GUESS_TRIES} 🏀`, ...rows.map(r => r.map(c => sq(c.mark)).join('')), url].join('\n');
}

/** Players whose names match what was typed (start of a word first), for the guess box. */
export function searchPlayers(list: PlayerFacts[], text: string, limit = 8): PlayerFacts[] {
  const q = text.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (q.length < 2) return [];
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const scored: [number, PlayerFacts][] = [];
  for (const f of list) {
    const n = norm(f.name);
    const at = n.indexOf(q);
    if (at < 0) continue;
    scored.push([(at === 0 || n[at - 1] === ' ' ? 0 : 1000) - f.allStars * 10 - f.games / 200, f]);
  }
  return scored.sort((a, b) => a[0] - b[0]).slice(0, limit).map(([, f]) => f);
}
