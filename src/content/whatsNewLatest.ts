/*
 * The newest What's New release id, on its own so the main menu can tell whether there is news without loading every
 * release's text (src/content/whatsNew.ts, loaded with the pop-up). Keep it equal to RELEASES[0].id: a test checks.
 */
export const LATEST_RELEASE = '2027-05-26';
export const WHATS_NEW_KEY = 'courtvision:whatsNewSeen';

/** True when this player has a release they haven't seen. First-time visitors have none and are marked up to date. */
export function hasUnseenRelease(storage: Pick<Storage, 'getItem' | 'setItem' | 'length' | 'key'> = localStorage): boolean {
  try {
    const seen = storage.getItem(WHATS_NEW_KEY);
    if (seen == null) {
      for (let i = 0; i < storage.length; i++) { const k = storage.key(i) ?? ''; if (k.startsWith('cv-') || (k.startsWith('courtvision:') && k !== 'courtvision:consent')) return true; }
      storage.setItem(WHATS_NEW_KEY, LATEST_RELEASE);
      return false;
    }
    return LATEST_RELEASE > seen;
  } catch { return false; }
}
