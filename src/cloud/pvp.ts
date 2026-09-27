import { accessToken, getAccount } from './account';
import type { Ghost } from '../hunt/pvp';
import type { SeriesGame } from '../hunt/run';

/* Client for /api/pvp (see server/pvp.ts). */

export interface PvpMatch { match: { id: string; seed: number; era: string }; you: { rating: number; squad: Ghost }; opponent: { user_id: string; username: string; title: string; rating: number; wins: number; losses: number; squad: Ghost } }

async function call<T>(body: object): Promise<T> {
  const token = accessToken();
  if (!token) throw new Error('Sign in to play PvP.');
  let res: Response;
  try { res = await fetch('/api/pvp', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) }); }
  catch { throw new Error('You are offline.'); }
  const out = await res.json().catch(() => null) as (T & { error?: string }) | null;
  if (!res.ok || !out) throw new Error(out?.error ?? 'PvP is not available right now.');
  return out;
}

export const publishGhost = (ghost: Ghost) => (getAccount().status === 'signedIn' ? call<{ ok: true }>({ action: 'publish', ghost }) : Promise.resolve(null));
export const findMatch = () => call<PvpMatch>({ action: 'find' });
export const postResult = (matchId: string, won: boolean, games: SeriesGame[]) => call<{ ok: true; delta: number }>({ action: 'result', matchId, won, games });

/** The last finished hunt's squad, kept on this device until it is published as your PvP ghost. */
export const LOCAL_GHOST_KEY = 'cv-hunt-ghost';
export function saveLocalGhost(g: Ghost) { try { localStorage.setItem(LOCAL_GHOST_KEY, JSON.stringify({ ...g, at: Date.now() })); } catch { /* storage blocked */ } }
export const localGhost = (): (Ghost & { at: number }) | null => { try { return JSON.parse(localStorage.getItem(LOCAL_GHOST_KEY) ?? 'null'); } catch { return null; } };

