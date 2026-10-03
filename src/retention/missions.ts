import { localRead, type Read } from '../lib/kv';
import { weekKey, weeklySeed } from './week';
import { readWeekLog, type LogMode, type WeekEntry } from './weekLog';

/*
 * Weekly missions (Season Pass 2.0): five free missions a week, the same five for everyone, drawn from every mode.
 * Progress comes from this week's log (runs finished, time played, records). A finished mission is claimed for XP,
 * and that XP fills the monthly Season Pass and your level like any other. Claimed missions also count toward
 * mission titles that stay yours for good. Nothing is bought.
 */

export const MISSIONS_KEY = 'cv-missions';
export const MISSIONS_PER_WEEK = 5;

type Goal =
  | { kind: 'runs'; mode: LogMode; n: number }
  | { kind: 'anyRuns'; n: number }
  | { kind: 'modes'; n: number }
  | { kind: 'minutes'; n: number }
  | { kind: 'records'; n: number };
export interface MissionDef { id: string; label: string; xp: number; goal: Goal }

const run = (mode: LogMode, n: number, label: string, xp: number): MissionDef => ({ id: `${mode}-${n}`, label, xp, goal: { kind: 'runs', mode, n } });
export const MISSION_POOL: MissionDef[] = [
  run('hunt', 1, 'Finish a League Hunt run', 120),
  run('hunt', 3, 'Finish 3 League Hunt runs', 250),
  run('perfect', 1, 'Finish an 82-0 run', 120),
  run('perfect', 3, 'Finish 3 82-0 runs', 250),
  run('career', 1, 'Retire a Career Mode player', 200),
  run('rebuild', 1, 'Finish a Rebuild Challenge', 200),
  run('draft', 1, 'Finish an All-Time Draft', 200),
  run('guess', 2, 'Play Guess the Player on 2 days', 120),
  run('hilo', 3, 'Finish 3 Higher or Lower runs', 120),
  run('bracket', 1, 'Fill and tip off a Playoff Bracket', 120),
  run('quiz', 3, 'Finish 3 quiz rounds', 120),
  { id: 'any-5', label: 'Finish 5 runs in any modes', xp: 200, goal: { kind: 'anyRuns', n: 5 } },
  { id: 'modes-3', label: 'Play 3 different modes', xp: 200, goal: { kind: 'modes', n: 3 } },
  { id: 'time-30', label: 'Play for 30 minutes', xp: 100, goal: { kind: 'minutes', n: 30 } },
  { id: 'time-90', label: 'Play for 90 minutes', xp: 200, goal: { kind: 'minutes', n: 90 } },
  { id: 'records-1', label: 'Set a new record in your record book', xp: 150, goal: { kind: 'records', n: 1 } },
];
const BY_ID = new Map(MISSION_POOL.map(m => [m.id, m]));

/** Mission titles: claimed missions over all weeks. */
export const MISSION_TITLES = [{ n: 10, title: 'Mission Runner' }, { n: 30, title: 'Task Master' }, { n: 75, title: 'Mission Legend' }];

/** This week's five: one time mission, one "any mode" mission, three mode missions (all different modes). */
export function weekMissions(week = weekKey()): MissionDef[] {
  let s = weeklySeed('missions', week) || 1;
  const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 2 ** 32; };
  const pick = <T,>(list: T[]) => list[Math.floor(rnd() * list.length)];
  const time = pick(MISSION_POOL.filter(m => m.goal.kind === 'minutes'));
  const broad = pick(MISSION_POOL.filter(m => m.goal.kind === 'anyRuns' || m.goal.kind === 'modes' || m.goal.kind === 'records'));
  const modes: MissionDef[] = [];
  const pool = MISSION_POOL.filter(m => m.goal.kind === 'runs');
  while (modes.length < MISSIONS_PER_WEEK - 2) {
    const m = pick(pool);
    if (!modes.some(x => x.goal.kind === 'runs' && m.goal.kind === 'runs' && x.goal.mode === m.goal.mode)) modes.push(m);
  }
  return [...modes, broad, time];
}

/** How far along a mission is this week (0..n). */
export function missionProgress(m: MissionDef, e: WeekEntry | undefined): { have: number; need: number; done: boolean } {
  const runs = e?.runs ?? {};
  const g = m.goal;
  const have = g.kind === 'runs' ? runs[g.mode] ?? 0
    : g.kind === 'anyRuns' ? Object.values(runs).reduce((n: number, x) => n + (x ?? 0), 0)
    : g.kind === 'modes' ? Object.values(runs).filter(x => (x ?? 0) > 0).length
    : g.kind === 'minutes' ? Math.floor((e?.seconds ?? 0) / 60)
    : e?.records ?? 0;
  return { have: Math.min(have, g.n), need: g.n, done: have >= g.n };
}

export interface MissionState { weeks: Record<string, string[]> }
export function readMissions(read: Read = localRead): MissionState {
  try {
    const raw = JSON.parse(read(MISSIONS_KEY) ?? 'null') as MissionState | null;
    const weeks: Record<string, string[]> = {};
    for (const [w, ids] of Object.entries(raw?.weeks ?? {})) if (/^\d{4}-W\d{2}$/.test(w) && Array.isArray(ids)) weeks[w] = [...new Set(ids.filter(id => typeof id === 'string' && BY_ID.has(id)))];
    return { weeks };
  } catch { return { weeks: {} }; }
}

/** Claims a finished mission of this week (once). Returns the XP it paid, or 0. */
export function claimMission(id: string, now = new Date()): number {
  const week = weekKey(now);
  const m = weekMissions(week).find(x => x.id === id);
  if (!m || !missionProgress(m, readWeekLog()[week]).done) return 0;
  const st = readMissions();
  if (st.weeks[week]?.includes(id)) return 0;
  try { localStorage.setItem(MISSIONS_KEY, JSON.stringify({ weeks: { ...st.weeks, [week]: [...(st.weeks[week] ?? []), id] } })); } catch { return 0; }
  return m.xp;
}

export const missionsClaimed = (st: MissionState) => Object.values(st.weeks).reduce((n, ids) => n + ids.length, 0);
export const missionsXp = (st: MissionState) => Object.values(st.weeks).reduce((n, ids) => n + ids.reduce((t, id) => t + (BY_ID.get(id)?.xp ?? 0), 0), 0);
export const missionTitles = (claimed: number) => MISSION_TITLES.filter(t => claimed >= t.n).map(t => t.title);

/** Two devices: per week, every mission claimed on either. */
export function mergeMissions(a: MissionState, b: MissionState): MissionState {
  const weeks: Record<string, string[]> = { ...b.weeks };
  for (const [w, ids] of Object.entries(a.weeks)) weeks[w] = [...new Set([...(weeks[w] ?? []), ...ids])];
  return { weeks: Object.fromEntries(Object.entries(weeks).sort(([x], [y]) => x.localeCompare(y))) };
}
