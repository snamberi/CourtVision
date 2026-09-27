import { weekKey } from '../src/retention/week';
import { weeklyRebuild } from '../src/retention/weekly';
import { FINISH_POINTS, scoreResults, type ScoredSeason } from '../src/simulation/rebuildScenarios';

/*
 * Online weekly leaderboards (Rebuild of the Week and Career of the Week), served at /api/leaderboard by a Vercel
 * Function. Bundled into api/leaderboard.js by scripts/build-api.mjs; the data lives in Upstash Redis (Vercel
 * Marketplace), reached over its REST API with the KV_REST_API_URL and KV_REST_API_TOKEN variables Vercel sets.
 *
 * Each board is a sorted set per week (one entry per player id, best score kept) plus a hash with the name and a
 * line the server writes itself. Rebuild scores are recomputed here from the season results, never taken from the
 * client; Career entries are checked for plausible values. Submissions are rate-limited per IP (stored only as a
 * salted hash for an hour).
 */

export type Board = 'rebuild' | 'career';
export interface Redis { run(commands: (string | number)[][]): Promise<unknown[]> }

export function upstash(url: string, token: string): Redis {
  return {
    async run(commands) {
      const res = await fetch(`${url.replace(/\/$/, '')}/pipeline`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(commands) });
      if (!res.ok) throw new Error(`Redis ${res.status}`);
      const out = await res.json() as { result?: unknown; error?: string }[];
      return out.map(r => { if (r.error) throw new Error(r.error); return r.result; });
    },
  };
}

export interface BoardEntry { rank: number; name: string; score: number; detail: string; you?: boolean }
export interface BoardResponse { board: Board; week: string; entries: BoardEntry[]; total: number; you: { rank: number; score: number } | null }

const TTL = 90 * 86_400;
const MAX_WEEKS_BACK = 3;
const key = (b: Board, w: string) => `lb:${b}:${w}`;
const WEEK_RE = /^\d{4}-W\d{2}$/;
const ID_RE = /^[a-z0-9]{16,40}$/;
const BLOCKED = ['fuck', 'shit', 'cunt', 'nigg', 'fag', 'bitch', 'whore', 'rape', 'nazi', 'hitler', 'slut', 'retard'];

export function cleanName(raw: unknown, max = 18): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._'-]*$/u.test(name) || name.length < 2 || name.length > max) return null;
  const flat = name.toLowerCase().replace(/[^a-z]/g, '');
  return BLOCKED.some(w => flat.includes(w)) ? null : name;
}

/** The weeks that still take entries: this one and the three before (a long rebuild can finish after Monday). */
export function openWeeks(now = new Date()): string[] {
  return Array.from({ length: MAX_WEEKS_BACK + 1 }, (_, i) => weekKey(new Date(now.getTime() - i * 7 * 86_400_000)));
}

const FINISHES = new Set<string>([...Object.keys(FINISH_POINTS), 'Missed Playoffs']);
export interface CareerFields { player: string; legacy: number; seasons: number; titles: number; mvps: number; hof: 'no' | 'yes' | 'first-ballot' }
export interface Submission { board: Board; week: string; id: string; name: string; results?: ScoredSeason[]; career?: CareerFields }
export type Checked = { ok: true; score: number; detail: string } | { ok: false; error: string };

const int = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;

/** Checks a submission and works out its score and the line shown on the board. */
export function checkSubmission(s: Submission, now = new Date()): Checked {
  if (s.board !== 'rebuild' && s.board !== 'career') return { ok: false, error: 'Unknown board.' };
  if (typeof s.week !== 'string' || !WEEK_RE.test(s.week) || !openWeeks(now).includes(s.week)) return { ok: false, error: 'That week\'s board is closed.' };
  if (typeof s.id !== 'string' || !ID_RE.test(s.id)) return { ok: false, error: 'Bad player id.' };
  if (!cleanName(s.name)) return { ok: false, error: 'Pick a name of 2-18 letters or numbers (and keep it clean).' };
  if (s.board === 'rebuild') {
    const w = weeklyRebuild(s.week);
    const r = s.results;
    if (!Array.isArray(r) || !r.length || r.length > w.seasons) return { ok: false, error: 'Bad season results.' };
    for (const x of r) if (!x || !int(x.wins, 0, 82) || !int(x.losses, 0, 82) || x.wins + x.losses < 20 || x.wins + x.losses > 82 || !FINISHES.has(x.finish)) return { ok: false, error: 'Bad season results.' };
    const { titleAt, score, stars, counted } = scoreResults(r, w.seasons);
    if (titleAt < 0 && r.length < w.seasons) return { ok: false, error: 'Finish the challenge first.' };
    const best = [...counted].sort((a, b) => b.wins - a.wins)[0];
    return { ok: true, score, detail: `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)} · ${titleAt >= 0 ? `title in year ${titleAt + 1}` : `best ${best.wins}-${best.losses}`}` };
  }
  const c = s.career;
  if (!c || !cleanName(c.player, 24) || !int(c.legacy, 0, 400) || !int(c.seasons, 1, 25) || !int(c.titles, 0, c.seasons) || !int(c.mvps, 0, c.seasons) || !['no', 'yes', 'first-ballot'].includes(c.hof)) return { ok: false, error: 'Bad career.' };
  const p = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  return { ok: true, score: c.legacy, detail: `${cleanName(c.player, 24)} · ${p(c.seasons, 'season')} · ${p(c.titles, 'title')} · ${p(c.mvps, 'MVP')}${c.hof !== 'no' ? ' · Hall of Fame' : ''}` };
}

export async function readBoard(redis: Redis, board: Board, week: string, id: string | null, limit = 100): Promise<BoardResponse> {
  const k = key(board, week);
  const [range, total, rank, score] = await redis.run([['ZREVRANGE', k, 0, limit - 1, 'WITHSCORES'], ['ZCARD', k], ['ZREVRANK', k, id ?? '-'], ['ZSCORE', k, id ?? '-']]) as [string[], number, number | null, string | null];
  const ids: string[] = [], scores: number[] = [];
  for (let i = 0; i < (range?.length ?? 0); i += 2) { ids.push(range[i]); scores.push(Number(range[i + 1])); }
  const meta = ids.length ? (await redis.run([['HMGET', `${k}:meta`, ...ids]]))[0] as (string | null)[] : [];
  const entries = ids.map((m, i) => {
    let info: { name?: string; detail?: string } = {};
    try { info = JSON.parse(meta[i] ?? '{}'); } catch { /* missing meta */ }
    return { rank: i + 1, name: info.name ?? 'Anonymous', score: scores[i], detail: info.detail ?? '', ...(m === id ? { you: true } : {}) };
  });
  return { board, week, entries, total: Number(total ?? 0), you: id && rank != null ? { rank: Number(rank) + 1, score: Number(score) } : null };
}

async function sha(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Stores a checked entry, keeping each player's best score. Returns false if the rate limit is hit. */
export async function submit(redis: Redis, s: Submission, checked: { score: number; detail: string }, ip: string, now = new Date()): Promise<boolean> {
  const hour = Math.floor(now.getTime() / 3_600_000);
  const rl = `lb:rl:${await sha(`${ip}|${hour}|court-vision`)}`;
  const [count] = await redis.run([['INCR', rl], ['EXPIRE', rl, 3600]]) as [number, number];
  if (count > 12) return false;
  const k = key(s.board, s.week);
  const [prev] = await redis.run([['ZSCORE', k, s.id]]) as [string | null];
  if (prev != null && Number(prev) > checked.score) return true; // an older, better entry stays
  await redis.run([['ZADD', k, checked.score, s.id], ['HSET', `${k}:meta`, s.id, JSON.stringify({ name: cleanName(s.name), detail: checked.detail, at: now.toISOString() })], ['EXPIRE', k, TTL], ['EXPIRE', `${k}:meta`, TTL]]);
  return true;
}

const json = (body: unknown, status = 200, cache = false) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': cache ? 'public, s-maxage=20, stale-while-revalidate=60' : 'no-store' } });

/** The whole endpoint: GET reads a board, POST submits to one. */
export async function handle(request: Request, redis: Redis | null, now = new Date()): Promise<Response> {
  if (!redis) return json({ error: 'Online boards are not set up yet.' }, 503);
  try {
    if (request.method === 'GET') {
      const u = new URL(request.url);
      const board = u.searchParams.get('board') as Board;
      const week = u.searchParams.get('week') ?? weekKey(now);
      const id = u.searchParams.get('id');
      if ((board !== 'rebuild' && board !== 'career') || !WEEK_RE.test(week) || (id && !ID_RE.test(id))) return json({ error: 'Bad request.' }, 400);
      return json(await readBoard(redis, board, week, id), 200, !id);
    }
    if (request.method === 'POST') {
      const text = await request.text();
      if (text.length > 4000) return json({ error: 'Too large.' }, 413);
      let s: Submission;
      try { s = JSON.parse(text) as Submission; } catch { return json({ error: 'Bad request.' }, 400); }
      const checked = checkSubmission(s, now);
      if (!checked.ok) return json({ error: checked.error }, 400);
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
      if (!await submit(redis, s, checked, ip, now)) return json({ error: 'Too many submissions: try again in an hour.' }, 429);
      return json(await readBoard(redis, s.board, s.week, s.id));
    }
    return json({ error: 'Method not allowed.' }, 405);
  } catch {
    return json({ error: 'The leaderboard is having trouble. Try again soon.' }, 502);
  }
}
