import { friendActivity, type ActivityItem } from './boards';
import { loadGifts, type WaitingGift } from './social';

export interface InboxItem {
  id: string;
  kind: 'gift' | 'activity';
  at: string;
  title: string;
  body: string;
}
export const INBOX_EVENT = 'courtvision:inbox-read';
// Device-local and account-scoped. Never include another account's read history in cloud merges.
const key = (userId: string) => `courtvision-inbox-read:${userId}`;
export function readInboxIds(userId: string): Set<string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key(userId)) ?? '[]');
    return new Set(Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []);
  } catch { return new Set(); }
}
export function markInboxRead(userId: string, ids: string[]): boolean {
  if (!userId || !ids.length) return true;
  try {
    localStorage.setItem(key(userId), JSON.stringify([...new Set([...readInboxIds(userId), ...ids])].slice(-1000)));
    window.dispatchEvent(new Event(INBOX_EVENT));
    return true;
  } catch { return false; }
}
export function inboxItems(activity: ActivityItem[], gifts: WaitingGift[]): InboxItem[] {
  const items: InboxItem[] = [
    ...gifts.map(g => ({ id: `gift:${g.id}`, kind: 'gift' as const, at: g.at,
      title: `Gift from @${g.from}`, body: g.message || 'A gift is waiting. Open your friend list to collect it.' })),
    ...activity.map(a => ({ id: `activity:${JSON.stringify([a.username, a.at, a.text])}`, kind: 'activity' as const,
      at: a.at, title: `@${a.username}`, body: a.text })),
  ];
  return [...new Map(items.map(item => [item.id, item])).values()]
    .sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0) || a.id.localeCompare(b.id)).slice(0, 100);
}
export interface InboxSnapshot { items: InboxItem[]; errors: string[] }
/** Retain a failed source's previous entries and report partial failures explicitly. */
export async function loadInbox(previous: InboxItem[] = []): Promise<InboxSnapshot> {
  const [activity, gifts] = await Promise.allSettled([friendActivity(30), loadGifts()]);
  const fresh = inboxItems(activity.status === 'fulfilled' ? activity.value : [], gifts.status === 'fulfilled' ? gifts.value.waiting : []);
  const errors: string[] = [];
  if (activity.status === 'rejected') { errors.push('Friend activity could not refresh.'); fresh.push(...previous.filter(i => i.kind === 'activity')); }
  if (gifts.status === 'rejected') { errors.push('Gifts could not refresh.'); fresh.push(...previous.filter(i => i.kind === 'gift')); }
  return { items: fresh.sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0)).slice(0, 100), errors };
}
