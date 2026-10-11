import { supa, getAccount } from './account';
import { weekKey } from '../retention/week';

/*
 * Friend rivalry alerts: the GMs you follow who are ahead of you on this week's boards (and today's Daily Legend).
 * Read from the public board views; nothing new on the server. Each alert is shown until you dismiss it, and comes
 * back only if your friend's score moves again.
 */

export type RivalBoard = 'hunt' | 'perfect' | 'career' | 'rebuild' | 'daily';
export interface RivalAlert { id: string; board: RivalBoard; friend: string; theirs: number; mine: number | null }
export const RIVAL_BOARD_LABEL: Record<RivalBoard, string> = { hunt: 'Weekly Hunt', perfect: 'Daily 82-0 (this week)', career: 'Career of the Week', rebuild: 'Rebuild of the Week', daily: "today's Daily Legend" };
export const RIVAL_PLAY: Record<RivalBoard, string> = { hunt: '#/hunt', perfect: '#/82-0', career: '#/career', rebuild: '#/menu', daily: '#/hunt' };

const SEEN_KEY = 'cv-rival-seen';
const readSeen = (): string[] => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as string[]; } catch { return []; } };
export const rivalSeen = (id: string) => readSeen().includes(id);
export const dismissRival = (ids: string[]) => { try { localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set([...readSeen(), ...ids])].slice(-300))); } catch { /* storage blocked */ } };

interface Row { user_id: string; username: string; score: number; board?: string }

/** Friends ahead of you, best gap first: from rows of this week's boards and today's Daily. Pure, for testing. */
export function rivalAlerts(me: string, weekly: Row[], daily: Row[], week: string, day: string): RivalAlert[] {
  const out: RivalAlert[] = [];
  const scan = (rows: Row[], board: RivalBoard, period: string) => {
    const mine = rows.find(r => r.user_id === me)?.score ?? null;
    for (const r of rows) if (r.user_id !== me && r.score > (mine ?? 0)) out.push({ id: `${board}:${period}:${r.user_id}:${r.score}`, board, friend: r.username, theirs: r.score, mine });
  };
  for (const b of ['hunt', 'perfect', 'career', 'rebuild'] as const) scan(weekly.filter(r => r.board === b), b, week);
  scan(daily, 'daily', day);
  // Where you have a score, the closest races first (the ones you can win back); then the rest.
  return out.sort((a, b) => (a.mine == null ? 1 : 0) - (b.mine == null ? 1 : 0) || (a.theirs - (a.mine ?? 0)) / Math.max(1, a.theirs) - (b.theirs - (b.mine ?? 0)) / Math.max(1, b.theirs));
}

/** The alerts you haven't dismissed, for the signed-in account (empty with no friends). */
export async function loadRivalAlerts(now = new Date()): Promise<RivalAlert[]> {
  const me = getAccount().userId;
  if (!me) return [];
  const client = await supa();
  const { data: f } = await client.from('follows').select('target_id').eq('user_id', me);
  const friends = ((f ?? []) as { target_id: string }[]).map(x => x.target_id);
  if (!friends.length) return [];
  const ids = [me, ...friends.slice(0, 200)], week = weekKey(now), day = now.toISOString().slice(0, 10);
  const [w, d] = await Promise.all([
    client.from('lb_weekly').select('user_id, username, score, board').eq('week', week).in('user_id', ids),
    client.from('lb_daily').select('user_id, username, score').eq('day', day).in('user_id', ids),
  ]);
  return rivalAlerts(me, (w.data ?? []) as Row[], (d.data ?? []) as Row[], week, day).filter(a => !rivalSeen(a.id));
}

/* ---- Rivals Mode: one friend you take on all week, board by board. ---- */

export const WEEKLY_RIVAL_KEY = 'cv-weekly-rival';
export interface WeeklyRival { userId: string; username: string }
export const readWeeklyRival = (): WeeklyRival | null => { try { const v = JSON.parse(localStorage.getItem(WEEKLY_RIVAL_KEY) ?? 'null') as WeeklyRival | null; return v?.userId && v.username ? v : null; } catch { return null; } };
export const setWeeklyRival = (r: WeeklyRival | null) => { try { if (r) localStorage.setItem(WEEKLY_RIVAL_KEY, JSON.stringify(r)); else localStorage.removeItem(WEEKLY_RIVAL_KEY); } catch { /* storage blocked */ } };
export const H2H_BOARDS = ['hunt', 'perfect', 'career', 'rebuild', 'category'] as const;
export type H2HBoard = typeof H2H_BOARDS[number];
export const H2H_LABEL: Record<H2HBoard, string> = { hunt: 'Weekly Hunt', perfect: '82-0 Weekly', career: 'Career of the Week', rebuild: 'Rebuild of the Week', category: 'Category Draft' };
export interface HeadToHead { board: H2HBoard; mine: number | null; theirs: number | null }
/** The week's head-to-head: each board's best score for you and your rival, and who leads. Pure, for testing. */
export function headToHead(me: string, rival: string, rows: Row[]): { boards: HeadToHead[]; wins: number; losses: number } {
  const boards = H2H_BOARDS.map(b => ({ board: b, mine: rows.find(r => r.board === b && r.user_id === me)?.score ?? null, theirs: rows.find(r => r.board === b && r.user_id === rival)?.score ?? null }));
  return { boards, wins: boards.filter(x => (x.mine ?? -1) > (x.theirs ?? -1) && x.mine != null).length, losses: boards.filter(x => (x.theirs ?? -1) > (x.mine ?? -1) && x.theirs != null).length };
}
/** This week's rows for you and your rival. */
export async function loadHeadToHead(rival: WeeklyRival, now = new Date()) {
  const me = getAccount().userId;
  if (!me) return null;
  const client = await supa();
  const { data } = await client.from('lb_weekly').select('user_id, username, score, board').eq('week', weekKey(now)).in('user_id', [me, rival.userId]);
  return headToHead(me, rival.userId, (data ?? []) as Row[]);
}
/** The GMs you follow, for picking a rival. */
export async function loadFollowing(): Promise<WeeklyRival[]> {
  const me = getAccount().userId;
  if (!me) return [];
  const client = await supa();
  const { data: f } = await client.from('follows').select('target_id').eq('user_id', me);
  const ids = ((f ?? []) as { target_id: string }[]).map(x => x.target_id).slice(0, 200);
  if (!ids.length) return [];
  const { data } = await client.from('lb_users').select('id, username').in('id', ids);
  return ((data ?? []) as { id: string; username: string }[]).map(x => ({ userId: x.id, username: x.username })).sort((a, b) => a.username.localeCompare(b.username));
}
