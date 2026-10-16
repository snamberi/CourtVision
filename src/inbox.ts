/* Inbox: every message the game shows while you are in a league is kept here, per league, so nothing is lost when a
 * pop-up fades. Stored on this device only (it is a log, not league data). */

export interface InboxMessage { id: string; at: number; text: string; tone: 'info' | 'success' | 'error'; season?: string; date?: string; read?: boolean }

const KEY = (saveId: string) => `cv-inbox:${saveId}`;
const MAX = 200;

export function loadInbox(saveId: string | null): InboxMessage[] {
  if (!saveId) return [];
  try {
    const raw = localStorage.getItem(KEY(saveId));
    const list = raw ? (JSON.parse(raw) as InboxMessage[]) : [];
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

function save(saveId: string, list: InboxMessage[]) {
  try { localStorage.setItem(KEY(saveId), JSON.stringify(list.slice(-MAX))); } catch { /* storage full or blocked: the inbox just won't persist */ }
  window.dispatchEvent(new Event('courtvision:inbox'));
}

export function appendInbox(saveId: string | null, msg: Omit<InboxMessage, 'id' | 'at'>): void {
  if (!saveId) return;
  const list = loadInbox(saveId);
  const last = list.at(-1);
  if (last && last.text === msg.text && Date.now() - last.at < 2000) return; // the same toast twice in a row
  save(saveId, [...list, { ...msg, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: Date.now() }]);
}

export function markAllRead(saveId: string | null): void {
  if (!saveId) return;
  save(saveId, loadInbox(saveId).map(m => (m.read ? m : { ...m, read: true })));
}

export function clearInbox(saveId: string | null): void {
  if (saveId) save(saveId, []);
}

export const unreadCount = (list: InboxMessage[]) => list.filter(m => !m.read).length;
