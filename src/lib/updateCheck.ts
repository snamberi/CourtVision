/*
 * The Windows edition's update check: the live site publishes version.json (the newest What's New release id), and
 * the offline edition compares it with the newest release it was built with. Release ids sort by date.
 */
import { LATEST_RELEASE } from '../content/whatsNewLatest';

export const UPDATE_URL = 'https://courtvisiongame.com/version.json';
const SEEN_KEY = 'cv-update-dismissed';

export const bundledRelease = (): string => LATEST_RELEASE;

/** The newer release id when the live site is ahead of this copy, otherwise null. */
export function newerRelease(remote: unknown, local = bundledRelease()): string | null {
  const id = (remote as { release?: unknown } | null)?.release;
  return typeof id === 'string' && /^\d{4}-\d{2}-\d{2}/.test(id) && id > local ? id : null;
}

export async function checkForUpdate(fetcher: typeof fetch = fetch): Promise<string | null> {
  try {
    const res = await fetcher(UPDATE_URL, { cache: 'no-store' });
    if (!res.ok) return null;
    const newer = newerRelease(await res.json());
    if (!newer) return null;
    try { if (localStorage.getItem(SEEN_KEY) === newer) return null; } catch { /* storage blocked */ }
    return newer;
  } catch { return null; }
}

export function dismissUpdate(id: string): void {
  try { localStorage.setItem(SEEN_KEY, id); } catch { /* storage blocked */ }
}
