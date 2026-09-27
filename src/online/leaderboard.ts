import { IS_DESKTOP_BUILD } from '../appMode';
import type { BoardResponse, Board, CareerFields } from '../../server/leaderboard';
import type { ScoredSeason } from '../simulation/rebuildScenarios';

/*
 * Client for the online weekly boards (/api/leaderboard). A random id kept in this browser stands for the player;
 * the name is whatever they choose when posting. Not available in the offline Windows edition.
 */

export type { BoardResponse, Board, CareerFields };
export const ONLINE_BOARDS = !IS_DESKTOP_BUILD;

const ID_KEY = 'cv-online-id', NAME_KEY = 'cv-online-name';
export function playerId(): string {
  try {
    let id = localStorage.getItem(ID_KEY);
    if (!id || !/^[a-z0-9]{16,40}$/.test(id)) {
      id = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(36).padStart(2, '0')).join('').slice(0, 24);
      localStorage.setItem(ID_KEY, id);
    }
    return id;
  } catch { return 'anonymous0000000000'; }
}
export const savedName = () => { try { return localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; } };
const saveName = (n: string) => { try { localStorage.setItem(NAME_KEY, n); } catch { /* storage blocked */ } };

export class BoardError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}
async function call(url: string, init?: RequestInit): Promise<BoardResponse> {
  let res: Response;
  try { res = await fetch(url, init); } catch { throw new BoardError('You are offline: the online boards need a connection.', 0); }
  const body = await res.json().catch(() => null) as (BoardResponse & { error?: string }) | null;
  if (!res.ok || !body || body.error) throw new BoardError(body?.error ?? (res.status === 404 ? 'Online boards are not available on this site yet.' : 'The leaderboard is having trouble. Try again soon.'), res.status);
  return body;
}

export const fetchBoard = (board: Board, week: string) => call(`/api/leaderboard?board=${board}&week=${encodeURIComponent(week)}&id=${playerId()}`);

export function postScore(board: Board, week: string, name: string, payload: { results?: ScoredSeason[]; career?: CareerFields }): Promise<BoardResponse> {
  saveName(name.trim());
  return call('/api/leaderboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ board, week, id: playerId(), name: name.trim(), ...payload }) });
}

/** Weekly entries already posted from this browser, so the button can say so. */
const POSTED_KEY = 'cv-online-posted';
export function postedKey(board: Board, week: string, ref: string) { return `${board}|${week}|${ref}`; }
export function wasPosted(k: string): boolean { try { return (JSON.parse(localStorage.getItem(POSTED_KEY) ?? '[]') as string[]).includes(k); } catch { return false; } }
export function markPosted(k: string): void {
  try { const all = JSON.parse(localStorage.getItem(POSTED_KEY) ?? '[]') as string[]; localStorage.setItem(POSTED_KEY, JSON.stringify([...all, k].slice(-100))); } catch { /* storage blocked */ }
}
