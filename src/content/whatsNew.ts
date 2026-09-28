/*
 * The "What's new" popup: shown once on the main menu after an update, to players who were here before it.
 * Add new entries at the top; the id must sort after the previous one (a date works).
 */
export interface Release { id: string; title: string; items: string[] }

export const RELEASES: Release[] = [
  {
    id: '2026-10-01',
    title: 'The All-Time Draft',
    items: [
      '**06 / DRAFT:** thirty teams, thirteen rounds, every player in history at his best. Out-draft the AI GMs, then play the season under any era\'s rules.',
      '**All-Time Draft of the Week:** the same draft order and era for everyone.',
      '**Sign in** from the main menu to keep your progress on every device (as soon as accounts switch on).',
      '**Smarter AI front offices:** trades make contenders better instead of gifting veterans for bench kids, teams use their cap room on real depth, rotation players re-sign, and Auto Play now has in-season trades. Trade offers to you make sense, and a deal you decline isn\'t pitched again.',
      '**31 new achievements** for Career Mode, League Hunt, Rebuild, the Draft, PvP, Ranked, weekly challenges and daily goals, in the GM Locker. What you already did counts.',
    ],
  },
  {
    id: '2026-09-30',
    title: 'Accounts, leaderboards, ranked and PvP',
    items: [
      '**Accounts (optional):** sign in with Discord, Google or an email link. Your level, trophies, records and retired careers follow you to every device.',
      '**Community:** leaderboards for GMs, created players, the weekly challenges, the Daily Legend and every Rebuild, plus public profiles and friends.',
      '**Ranked seasons:** one a month, from Bronze to Legend. Reach Gold or higher to unlock that title.',
      '**League Hunt PvP:** your finished hunt squad against other GMs\' squads, best of seven, Elo-rated.',
    ],
  },
  {
    id: '2026-09-29',
    title: 'Levels, daily goals and online leaderboards',
    items: [
      '**GM Profile:** one level across every mode. Everything you have already won counts. Unlock share-card frames, court floors and titles in the GM Locker.',
      '**Daily goals:** three small goals a day in any GM league, like a 40-point game or three straight wins, for XP.',
      '**Online leaderboards:** post your Rebuild and Career of the Week results and see the top 100.',
      '**League codes:** every new league has a code. Send it to a friend and they start the exact same league.',
      '**Highlight GIFs:** turn any highlight in Watch Game into a GIF that plays on Discord.',
    ],
  },
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
