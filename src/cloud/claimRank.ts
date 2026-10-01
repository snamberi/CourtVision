import { supa } from './account';

/*
 * "Claim your rank": when a guest finishes something that would make an online board, we look up where it would land
 * (the boards are public, so no account is needed to read them) and say so: "would place #8 globally". Inside the
 * top 100 it is a place; past it, a share ("in the top 23%").
 *
 * The scores here must match what the server posts for the same result (server/derive.ts): the Legacy board stores a
 * rounded Legacy Score, the Daily Hunt and the weekly boards store their own scores.
 */

export type ClaimBoard =
  | { kind: 'players' }
  | { kind: 'weekly'; board: 'career' | 'hunt' | 'perfect' | 'rebuild'; week: string }
  | { kind: 'daily'; day: string }
  | { kind: 'code'; code: string };

export interface Placement { rank: number; total: number }

const TABLE: Record<ClaimBoard['kind'], { view: string; score: string }> = {
  players: { view: 'lb_players', score: 'legacy' },
  weekly: { view: 'lb_weekly', score: 'score' },
  daily: { view: 'lb_daily', score: 'score' },
  code: { view: 'lb_codes', score: 'score' },
};

/** Where a score would land on a board: the entries above it, plus one. */
export async function placeOnBoard(board: ClaimBoard, score: number): Promise<Placement> {
  const client = await supa();
  const t = TABLE[board.kind];
  const filtered = (head: boolean) => {
    let q = client.from(t.view).select('*', { count: 'exact', head });
    if (board.kind === 'weekly') q = q.eq('board', board.board).eq('week', board.week);
    if (board.kind === 'daily') q = q.eq('day', board.day);
    if (board.kind === 'code') q = q.eq('code', board.code.toUpperCase());
    return q;
  };
  const [above, all] = await Promise.all([filtered(true).gt(t.score, Math.round(score)), filtered(true)]);
  if (above.error) throw new Error(above.error.message);
  const rank = (above.count ?? 0) + 1;
  return { rank, total: Math.max(rank, (all.count ?? 0) + 1) };
}

/** "#8", or "in the top 23%" outside the top 100. */
export function placeLabel(p: Placement): string {
  if (p.rank <= 100) return `#${p.rank}`;
  return `in the top ${Math.max(1, Math.min(99, Math.ceil(p.rank / p.total * 100)))}%`;
}

// ---------------------------------------------------------------- not nagging

const DISMISSED_KEY = 'cv-claim-dismissed';
const SNOOZE_KEY = 'cv-claim-snooze';
const POPUP_KEY = 'cv-claim-popup-day';
const WEEK_MS = 7 * 24 * 3600 * 1000;

const readJson = <T,>(k: string, d: T): T => { try { return (JSON.parse(localStorage.getItem(k) ?? 'null') as T) ?? d; } catch { return d; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch { /* storage blocked */ } };

/** "Don't ask for a week" is on. */
export const claimSnoozed = (now = Date.now()) => readJson<number>(SNOOZE_KEY, 0) > now;
export const snoozeClaims = (now = Date.now()) => write(SNOOZE_KEY, now + WEEK_MS);
/** "Not now" on this result. */
export const claimDismissed = (id: string) => readJson<string[]>(DISMISSED_KEY, []).includes(id);
export const dismissClaim = (id: string) => write(DISMISSED_KEY, [...readJson<string[]>(DISMISSED_KEY, []).filter(x => x !== id), id].slice(-200));
/** The popup comes up once a day at most; after that the card stays on the results screen. */
export const popupShownToday = (day = new Date().toISOString().slice(0, 10)) => { try { return localStorage.getItem(POPUP_KEY) === day; } catch { return true; } };
export const notePopupShown = (day = new Date().toISOString().slice(0, 10)) => write(POPUP_KEY, day);
