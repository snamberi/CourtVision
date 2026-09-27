import { IS_DESKTOP_BUILD } from '../appMode';

/*
 * Anonymous gameplay events for Umami (web only): which modes get started and finished, which features get used.
 * Only fixed event names and short, whitelisted values are sent: never names, save contents, ids or free text.
 * Nothing is sent in the Windows edition, or when the browser sends a Global Privacy Control or Do Not Track signal.
 */

export type EventName = 'mode_start' | 'mode_finish' | 'weekly_start' | 'share_card' | 'backup' | 'whats_new' | 'app_install';
type Value = string | number | boolean;
type Umami = { track: (event: string, data?: Record<string, Value>) => void };

const queue: [EventName, Record<string, Value>][] = [];
let listening = false;

/** Keeps values short and plain: letters, digits, dashes; numbers rounded. */
export function clean(data: Record<string, Value>): Record<string, Value> {
  const out: Record<string, Value> = {};
  for (const [k, v] of Object.entries(data).slice(0, 8)) {
    if (!/^[a-z_]{1,20}$/.test(k)) continue;
    if (typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'number' && Number.isFinite(v)) out[k] = Math.round(v);
    else if (typeof v === 'string') out[k] = v.replace(/[^\w-]/g, '').slice(0, 24);
  }
  return out;
}

export function trackingAllowed(): boolean {
  if (IS_DESKTOP_BUILD || typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return !nav.globalPrivacyControl && nav.doNotTrack !== '1';
}

function flush() {
  const umami = (window as unknown as { umami?: Umami }).umami;
  if (!umami) return;
  while (queue.length) { const [e, d] = queue.shift()!; try { umami.track(e, d); } catch { /* ignore */ } }
}

export function track(event: EventName, data: Record<string, Value> = {}): void {
  if (!trackingAllowed()) return;
  if (queue.length < 20) queue.push([event, clean(data)]);
  if (!listening) { listening = true; window.addEventListener('courtvision:umami-ready', flush); }
  flush();
}

/** Sends an event only once per key in this browser (e.g. a finished challenge that is reopened later). */
export function trackOnce(key: string, event: EventName, data: Record<string, Value> = {}): void {
  const STORE = 'cv-analytics-once';
  let seen: string[] = [];
  try { seen = JSON.parse(localStorage.getItem(STORE) ?? '[]') as string[]; } catch { /* none */ }
  if (seen.includes(key)) return;
  try { localStorage.setItem(STORE, JSON.stringify([...seen, key].slice(-200))); } catch { /* storage blocked */ }
  track(event, data);
}
