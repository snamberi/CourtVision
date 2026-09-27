import { SCENARIOS, type RebuildScenario } from '../simulation/rebuildScenarios';
import { weekKey, weekEndsAt, weeklySeed } from './week';

export { weekKey, weekEndsAt, weeklySeed };

/*
 * The weekly challenges: every Monday (00:00 UTC) a new Rebuild of the Week and Career of the Week, the same for
 * everyone. Both come from a seed made from the week, so the league (and the Career wheel) start identical in every
 * browser, and results can be compared on Discord. Results are kept per week in this browser.
 */

// ---------------------------------------------------------------- Rebuild of the Week

export interface WeeklyTwist { id: 'standard' | 'shortClock' | 'hardTrades' | 'gauntlet'; label: string; blurb: string; seasonsDelta: number; hardTrades: boolean }
export const TWISTS: WeeklyTwist[] = [
  { id: 'standard', label: 'Standard rules', blurb: 'The scenario as written.', seasonsDelta: 0, hardTrades: false },
  { id: 'shortClock', label: 'Short clock', blurb: 'One season less than usual. Win faster.', seasonsDelta: -1, hardTrades: false },
  { id: 'hardTrades', label: 'Tough GMs', blurb: 'Trades need tightly matched value. No fleecing the AI.', seasonsDelta: 0, hardTrades: true },
  { id: 'gauntlet', label: 'Short clock, tough GMs', blurb: 'One season less, and trades need tightly matched value.', seasonsDelta: -1, hardTrades: true },
];

export interface WeeklyRebuild { week: string; seed: number; scenario: RebuildScenario; twist: WeeklyTwist; seasons: number }
export function weeklyRebuild(week = weekKey()): WeeklyRebuild {
  const seed = weeklySeed('rebuild', week);
  const scenario = SCENARIOS[seed % SCENARIOS.length];
  const twist = TWISTS[Math.floor(seed / 97) % TWISTS.length];
  return { week, seed, scenario, twist, seasons: Math.max(3, scenario.seasons + twist.seasonsDelta) };
}

// ---------------------------------------------------------------- Career of the Week

/** Drafts worth living through; `null` is today's league. */
const CAREER_DRAFTS: (number | null)[] = [null, 1984, 1996, 2003, 1979, 1992, 1997, 2009, 2007, 2014, 2018, 1985, 1987, 1998, 1969, null];
export interface WeeklyCareer { week: string; seed: number; draftYear: number | null }
export function weeklyCareer(week = weekKey()): WeeklyCareer {
  const seed = weeklySeed('career', week);
  return { week, seed, draftYear: CAREER_DRAFTS[seed % CAREER_DRAFTS.length] };
}

// ---------------------------------------------------------------- results (this browser)

export interface WeeklyResult { best: number; label: string; stars?: number; at: number }
export interface WeeklyRecords { [week: string]: { rebuild?: WeeklyResult; career?: WeeklyResult } }
const KEY = 'cv-weekly-records';

export function loadWeeklyRecords(): WeeklyRecords {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as WeeklyRecords; } catch { return {}; }
}

/** Keeps the best result of the week for a mode; the last 26 weeks are kept. Returns true if it is a new best. */
export function recordWeekly(kind: 'rebuild' | 'career', week: string, result: Omit<WeeklyResult, 'at'>): boolean {
  const all = loadWeeklyRecords();
  const prev = all[week]?.[kind];
  if (prev && prev.best >= result.best) return false;
  const next: WeeklyRecords = { ...all, [week]: { ...all[week], [kind]: { ...result, at: Date.now() } } };
  const keep = Object.keys(next).sort().slice(-26);
  try { localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(keep.map(k => [k, next[k]])))); } catch { /* storage blocked */ }
  return true;
}

/** Weeks in a row (ending this week or last) with a weekly result: the streak. */
export function weeklyStreak(records = loadWeeklyRecords(), now = new Date()): number {
  let n = 0;
  let d = new Date(now);
  if (!records[weekKey(d)]) d = new Date(d.getTime() - 7 * 86_400_000);
  while (records[weekKey(d)]) { n++; d = new Date(d.getTime() - 7 * 86_400_000); }
  return n;
}
