import { weekKey } from '../retention/week';

/*
 * The quick games' records, kept in this browser (cv-arcade) and synced: each day's Guess the Player, Higher or
 * Lower streaks, and each week's bracket. The weekly boards are worked out from these (scores below; the server uses
 * the same functions, server/derive.ts).
 */

export const ARCADE_KEY = 'cv-arcade';
export const ARCADE_EVENT = 'courtvision:arcade';

export interface GuessDay { guesses: number[]; won: boolean }
export interface BracketResult { slot: number; high: string; low: string; wh: number; wl: number; winner: string }
/** A week's bracket: picks lock at tip-off; then the results and the score. */
export interface BracketWeek { picks: string[]; locked: boolean; played: boolean; score: number; champion?: string; results?: BracketResult[] }
/** Endless play (any time, not on the weekly boards): totals and bests. */
export interface EndlessRecords {
  guess: { played: number; won: number; streak: number; best: number };
  bracket: { played: number; best: number };
  quiz: { played: number; best: number; right: number; answered: number };
}
export interface ArcadeRecords {
  guess: Record<string, GuessDay>;
  hilo: { best: number; runs: number; weeks: Record<string, number> };
  bracket: Record<string, BracketWeek>;
  endless?: EndlessRecords;
}
export const emptyEndless = (): EndlessRecords => ({ guess: { played: 0, won: 0, streak: 0, best: 0 }, bracket: { played: 0, best: 0 }, quiz: { played: 0, best: 0, right: 0, answered: 0 } });
const n = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.floor(Number(v)) : 0);
function readEndless(e: Partial<EndlessRecords> | undefined): EndlessRecords {
  return {
    guess: { played: n(e?.guess?.played), won: n(e?.guess?.won), streak: n(e?.guess?.streak), best: n(e?.guess?.best) },
    bracket: { played: n(e?.bracket?.played), best: Math.min(n(e?.bracket?.best), 320) },
    quiz: { played: n(e?.quiz?.played), best: n(e?.quiz?.best), right: n(e?.quiz?.right), answered: n(e?.quiz?.answered) },
  };
}
/** This browser's endless records (never missing). */
export const endlessOf = (r: ArcadeRecords) => r.endless ?? emptyEndless();

export const GUESS_TRIES = 6;
/** A day is over once it is solved or all six guesses are used. */
export const isGuessDone = (d: GuessDay | undefined) => !!d && (d.won || d.guesses.length >= GUESS_TRIES);
const empty = (): ArcadeRecords => ({ guess: {}, hilo: { best: 0, runs: 0, weeks: {} }, bracket: {} });

export function readArcade(read: (k: string) => string | null = k => { try { return localStorage.getItem(k); } catch { return null; } }): ArcadeRecords {
  try {
    const r = JSON.parse(read(ARCADE_KEY) ?? 'null') as Partial<ArcadeRecords> | null;
    if (!r || typeof r !== 'object') return empty();
    return {
      guess: r.guess && typeof r.guess === 'object' ? r.guess : {},
      hilo: { best: Number(r.hilo?.best) || 0, runs: Number(r.hilo?.runs) || 0, weeks: r.hilo?.weeks && typeof r.hilo.weeks === 'object' ? r.hilo.weeks : {} },
      bracket: r.bracket && typeof r.bracket === 'object' ? r.bracket : {},
      endless: readEndless(r.endless),
    };
  } catch { return empty(); }
}

export function writeArcade(r: ArcadeRecords): void {
  try { localStorage.setItem(ARCADE_KEY, JSON.stringify(r)); } catch { /* storage blocked: this visit only */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ARCADE_EVENT));
}

export const updateArcade = (fn: (r: ArcadeRecords) => ArcadeRecords) => { const next = fn(readArcade()); writeArcade(next); return next; };

/** Two devices' records: a finished day beats an unfinished one, best streaks, a played bracket beats an unplayed one. */
export function mergeArcade(a: ArcadeRecords, b: ArcadeRecords): ArcadeRecords {
  const out: ArcadeRecords = { guess: { ...b.guess }, hilo: { best: Math.max(a.hilo.best, b.hilo.best), runs: Math.max(a.hilo.runs, b.hilo.runs), weeks: { ...b.hilo.weeks } }, bracket: { ...b.bracket } };
  const done = (d?: GuessDay) => !!d && (d.won || d.guesses.length >= GUESS_TRIES);
  for (const [day, d] of Object.entries(a.guess)) { const o = out.guess[day]; if (!o || (done(d) && !done(o)) || (done(d) === done(o) && d.guesses.length > o.guesses.length)) out.guess[day] = d; }
  for (const [w, s] of Object.entries(a.hilo.weeks)) out.hilo.weeks[w] = Math.max(s, out.hilo.weeks[w] ?? 0);
  for (const [w, x] of Object.entries(a.bracket)) { const o = out.bracket[w]; if (!o || (x.played && !o.played) || (x.played === o.played && x.score > o.score)) out.bracket[w] = x; }
  // Endless totals: the larger of each (the device that has played more holds the full count).
  if (a.endless || b.endless) {
    const ea = endlessOf(a), eb = endlessOf(b), max = <T extends Record<string, number>>(x: T, y: T) => Object.fromEntries(Object.keys(x).map(k => [k, Math.max(x[k], y[k])])) as T;
    out.endless = { guess: max(ea.guess, eb.guess), bracket: max(ea.bracket, eb.bracket), quiz: max(ea.quiz, eb.quiz) };
  }
  return out;
}

// ---------------------------------------------------------------- scores for the weekly boards

/** A day of Guess the Player: 600 for the first try, 100 less for each one after; nothing for a miss. */
export const guessPoints = (d: GuessDay) => (d.won && d.guesses.length >= 1 && d.guesses.length <= GUESS_TRIES ? (GUESS_TRIES + 1 - d.guesses.length) * 100 : 0);

/** The weekly Guess the Player score: the week's days added up. */
export function guessWeeks(r: ArcadeRecords): Record<string, { score: number; days: number; solved: number }> {
  const out: Record<string, { score: number; days: number; solved: number }> = {};
  for (const [day, d] of Object.entries(r.guess)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Array.isArray(d?.guesses)) continue;
    const w = weekKey(new Date(`${day}T12:00:00Z`)), o = out[w] ?? { score: 0, days: 0, solved: 0 };
    o.score += guessPoints(d); o.days++; if (guessPoints(d)) o.solved++;
    out[w] = o;
  }
  return out;
}

/** Your current daily streak (days in a row solved, ending today or yesterday) and the best ever. */
export function guessStreak(r: ArcadeRecords, today: string): { current: number; best: number } {
  const solved = new Set(Object.entries(r.guess).filter(([, d]) => guessPoints(d) > 0).map(([day]) => day));
  const prev = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  let current = 0, day = solved.has(today) ? today : prev(today);
  while (solved.has(day)) { current++; day = prev(day); }
  let best = 0;
  for (const d of [...solved].sort()) { let n = 1, x = d; while (solved.has(prev(x))) { n++; x = prev(x); } best = Math.max(best, n); }
  return { current, best };
}

/** Bracket points per correct pick, by round (first round, quarters, semis, final): 320 for a perfect bracket. */
export const BRACKET_POINTS = [10, 20, 40, 80] as const;
export const BRACKET_MAX = 8 * 10 + 4 * 20 + 2 * 40 + 80;

/** XP from the quick games: 20 a solved Guess the Player day, 40 a played bracket (plus a tenth of its score), and each week's best Higher or Lower streak at 2 XP a step (up to 20 steps). */
export function arcadeXp(r: ArcadeRecords): { xp: number; solved: number; brackets: number; hiloWeeks: number } {
  const solved = Object.entries(r.guess).filter(([day, d]) => /^\d{4}-\d{2}-\d{2}$/.test(day) && Array.isArray(d?.guesses) && guessPoints(d) > 0).length;
  const played = Object.values(r.bracket).filter(b => b?.played && Number.isInteger(b.score) && b.score >= 0 && b.score <= BRACKET_MAX);
  const hilo = Object.values(r.hilo.weeks).filter(n => Number.isInteger(n) && n > 0);
  const xp = solved * 20 + played.reduce((n, b) => n + 40 + Math.floor(b.score / 10), 0) + hilo.reduce((n, s) => n + Math.min(20, s) * 2, 0);
  return { xp, solved, brackets: played.length, hiloWeeks: hilo.length };
}
