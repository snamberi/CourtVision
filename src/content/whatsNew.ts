/*
 * The "What's new" popup: shown once on the main menu after an update, to players who were here before it.
 * Add new entries at the top; the id must sort after the previous one (a date works).
 */
export interface Release { id: string; title: string; items: string[] }

export const RELEASES: Release[] = [
  {
    id: '2026-09-28',
    title: 'Weekly challenges and an installable app',
    items: [
      '**Rebuild of the Week:** one scenario and one twist for everyone, from the same league, until Monday.',
      '**Career of the Week:** everyone spins the same wheel in the same league. Chase the best Legacy Score.',
      '**Seven new Rebuilds:** the 11-71 Mavericks and Nuggets, the 12-70 Nets, Wade alone in Miami, Orlando after T-Mac, the 13-69 Hawks and the young Giannis Bucks.',
      '**Install Court Vision:** add it to your home screen or desktop. It opens full screen and plays offline once loaded.',
      '**Lighter on older phones:** fewer effects and a smaller simulation load on low-memory devices (Graphics, at the bottom of the main menu).',
    ],
  },
  {
    id: '2026-09-27',
    title: 'Backups, share cards and guides',
    items: [
      '**Backup everything:** one file with all your progress; restore it on any device (GM Locker).',
      '**Share cards:** pixel-art images of your Career, League Hunt and Rebuild results.',
      '**Guides:** How to Play, mode guides and an FAQ, linked at the bottom of the menu.',
    ],
  },
];

const KEY = 'courtvision:whatsNewSeen';

/** The releases this player has not seen yet (newest first). First-time visitors see nothing and are marked up to date. */
export function unseenReleases(storage: Pick<Storage, 'getItem' | 'setItem' | 'length' | 'key'> = localStorage): Release[] {
  try {
    const seen = storage.getItem(KEY);
    if (seen == null) {
      let returning = false;
      for (let i = 0; i < storage.length; i++) { const k = storage.key(i) ?? ''; if (k.startsWith('cv-') || (k.startsWith('courtvision:') && k !== 'courtvision:consent')) { returning = true; break; } }
      if (!returning) { storage.setItem(KEY, RELEASES[0].id); return []; }
      return RELEASES.slice(0, 1);
    }
    return RELEASES.filter(r => r.id > seen);
  } catch { return []; }
}

export function markReleasesSeen(storage: Pick<Storage, 'setItem'> = localStorage): void {
  try { storage.setItem(KEY, RELEASES[0].id); } catch { /* storage blocked */ }
}
