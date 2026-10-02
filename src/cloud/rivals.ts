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
