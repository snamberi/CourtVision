/*
 * Same-spin duels: finish a League Hunt or 82-0 run, send a friend a link, and they play the exact same run (same
 * seed, deck and difficulty, or the same 82-0 mode): the same reels, rolls and schedule; only the choices differ.
 * The link carries the challenger's result, so the comparison needs no server. A friends' game: it is not a
 * leaderboard, so a hand-edited link only fools its sender.
 */

import type { PerfectMode } from '../perfect/run';
import type { RunView } from './challenge';

export type DuelMode = 'hunt' | 'perfect';
export interface DuelResult { score: number; line: string; won: boolean }
export interface Duel {
  v: 1; m: DuelMode; s: number;
  /** League Hunt: deck and difficulty. 82-0: Quick or Franchise Spin. */
  deck?: string; diff?: string; pm?: PerfectMode;
  /** The challenger's view (ratings shown, rarity colours): the friend plays the same way. */
  vw?: RunView;
  /** Who sent it and how they did. */
  n: string; r: DuelResult;
}

const PENDING_KEY = 'cv-duel-pending';
const b64url = (s: string) => btoa(Array.from(new TextEncoder().encode(s), b => String.fromCharCode(b)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)));
const clean = (s: unknown, n: number) => (typeof s === 'string' ? s.replace(/[<>]/g, '').slice(0, n) : '');

export function encodeDuel(d: Duel): string {
  return b64url(JSON.stringify({ ...d, n: clean(d.n, 24), r: { ...d.r, line: clean(d.r.line, 60) } }));
}

/** The duel in a code, or null when it isn't one (or is malformed). */
export function decodeDuel(code: string): Duel | null {
  try {
    const d = JSON.parse(unb64url(code.trim())) as Partial<Duel>;
    if (d.v !== 1 || (d.m !== 'hunt' && d.m !== 'perfect') || !Number.isSafeInteger(d.s) || !d.r || typeof d.r.score !== 'number' || !Number.isFinite(d.r.score)) return null;
    if (d.m === 'perfect' && d.pm !== 'quick' && d.pm !== 'franchise' && d.pm !== 'category' && d.pm !== 'slots') return null;
    return { v: 1, m: d.m, s: d.s!, ...(d.deck ? { deck: clean(d.deck, 20) } : {}), ...(d.diff ? { diff: clean(d.diff, 20) } : {}), ...(d.pm ? { pm: d.pm } : {}), ...(d.vw && typeof d.vw === 'object' ? { vw: { numbers: !!d.vw.numbers, colors: d.vw.colors !== false } } : {}),
      n: clean(d.n, 24) || 'A friend', r: { score: Math.round(d.r.score), line: clean(d.r.line, 60), won: !!d.r.won } };
  } catch { return null; }
}

export const duelLink = (d: Duel, origin = typeof location !== 'undefined' ? location.origin : 'https://courtvisiongame.com') => `${origin}/#/duel/${encodeDuel(d)}`;
/** A duel's route ("#/duel/<code>"): the code, or null. */
export const duelFromHash = (hash: string): Duel | null => { const m = hash.match(/^#\/duel\/([A-Za-z0-9_-]+)$/); return m ? decodeDuel(m[1]) : null; };

/** The duel a link opened, waiting for its mode to start it. */
export function savePendingDuel(d: Duel): void { try { localStorage.setItem(PENDING_KEY, encodeDuel(d)); } catch { /* storage blocked */ } }
export function takePendingDuel(mode: DuelMode): Duel | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    const d = raw ? decodeDuel(raw) : null;
    if (!d || d.m !== mode) return null;
    localStorage.removeItem(PENDING_KEY);
    return d;
  } catch { return null; }
}

/** Who won: "You win by 1,200", "They win by 300", "A tie". */
export function duelVerdict(mine: number, theirs: number, name: string): { text: string; outcome: 'win' | 'loss' | 'tie' } {
  if (mine === theirs) return { text: 'A dead heat.', outcome: 'tie' };
  return mine > theirs ? { text: `You beat ${name} by ${(mine - theirs).toLocaleString()}.`, outcome: 'win' } : { text: `${name} wins by ${(theirs - mine).toLocaleString()}.`, outcome: 'loss' };
}
