import { localRead, type Read } from '../lib/kv';

/*
 * 1v1 with your own player: against any real NBA player (at his best season) or against another GM's player. The
 * record keeps your wins and losses, the NBA players you've beaten and your record against each GM.
 */

export const ONE_KEY = 'cv-1v1';
export const ONE_EVENT = 'cv-1v1-changed';
export interface OneRecord {
  v: 1; w: number; l: number; beaten: string[]; users: Record<string, { w: number; l: number }>;
  /** Games played on `day` (UTC): only the first EVENT_GAMES of a day pay holiday event coins. */
  day: string; today: number;
}
export const EVENT_GAMES = 10;
const dayOf = (now: Date) => now.toISOString().slice(0, 10);
const BEATEN_MAX = 3000, USERS_MAX = 300;

const count = (v: unknown) => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(1e6, Math.floor(Number(v)))) : 0);
const okId = (s: unknown): s is string => typeof s === 'string' && s.length > 0 && s.length <= 80;
export function cleanOne(raw: unknown): OneRecord {
  const x = (raw && typeof raw === 'object' ? raw : {}) as Partial<OneRecord>;
  const users: OneRecord['users'] = {};
  for (const [k, v] of Object.entries(x.users && typeof x.users === 'object' ? x.users : {}).slice(0, USERS_MAX)) if (okId(k)) users[k.toLowerCase()] = { w: count(v?.w), l: count(v?.l) };
  const day = typeof x.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.day) ? x.day : '';
  return { v: 1, w: count(x.w), l: count(x.l), beaten: [...new Set((Array.isArray(x.beaten) ? x.beaten : []).filter(okId))].slice(-BEATEN_MAX), users, day, today: day ? count(x.today) : 0 };
}
export function loadOne(read: Read = localRead): OneRecord {
  try { return cleanOne(JSON.parse(read(ONE_KEY) ?? 'null')); } catch { return cleanOne(null); }
}
export function saveOne(r: OneRecord): void {
  try { localStorage.setItem(ONE_KEY, JSON.stringify(r)); } catch { /* storage blocked */ }
  try { window.dispatchEvent(new Event(ONE_EVENT)); } catch { /* no window (tests) */ }
}

/** One game played: against an NBA player (his player id) or a GM (their username). */
export function noteOne(r: OneRecord, opp: { kind: 'nba' | 'user'; id: string }, won: boolean, now = new Date()): OneRecord {
  const day = dayOf(now);
  const next: OneRecord = { ...r, w: r.w + (won ? 1 : 0), l: r.l + (won ? 0 : 1), day, today: (r.day === day ? r.today : 0) + 1 };
  if (opp.kind === 'nba' && won && !r.beaten.includes(opp.id)) next.beaten = [...r.beaten, opp.id].slice(-BEATEN_MAX);
  if (opp.kind === 'user') {
    const k = opp.id.toLowerCase(), was = r.users[k] ?? { w: 0, l: 0 };
    next.users = { ...r.users, [k]: { w: was.w + (won ? 1 : 0), l: was.l + (won ? 0 : 1) } };
  }
  return next;
}

/** The event-coin tag for the next game today: the first EVENT_GAMES each get their own, the rest share the last. */
export const eventTag = (r: OneRecord, now = new Date()) => `1v1:${dayOf(now)}:${Math.min(r.day === dayOf(now) ? r.today : 0, EVENT_GAMES - 1)}`;

/** Two devices' records: the bigger counts, every player beaten. */
export function mergeOne(a: OneRecord, b: OneRecord): OneRecord {
  const users: OneRecord['users'] = { ...b.users };
  for (const [k, v] of Object.entries(a.users)) users[k] = { w: Math.max(v.w, users[k]?.w ?? 0), l: Math.max(v.l, users[k]?.l ?? 0) };
  const day = a.day > b.day ? a.day : b.day, today = Math.max(a.day === day ? a.today : 0, b.day === day ? b.today : 0);
  return cleanOne({ v: 1, w: Math.max(a.w, b.w), l: Math.max(a.l, b.l), beaten: [...new Set([...b.beaten, ...a.beaten])], users, day, today });
}
