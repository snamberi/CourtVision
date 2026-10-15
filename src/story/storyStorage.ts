import Dexie, { type Table } from 'dexie';
import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import type { AutoPlayHalfSeason } from '../simulation/autoPlay';

/*
 * Story Mode's league: the real NBA your player is drafted into. The story itself is small and lives in localStorage
 * (see story.ts); its league is big, so it is kept here, in its own IndexedDB database, one per story.
 */

/** Where the league stands: stopped at the draft (with the half-season's results) or somewhere in a season. */
export interface StoryWorld { id: string; league: League; extras: GMLeagueExtras; phase: 'atDraft' | 'inSeason'; partial?: AutoPlayHalfSeason }

class StoryDatabase extends Dexie {
  worlds!: Table<StoryWorld, string>;
  constructor() {
    super('courtvision-story');
    this.version(1).stores({ worlds: 'id' });
  }
}
let db: StoryDatabase | null = null;
const open = () => (db ??= new StoryDatabase());

export async function loadStoryWorld(id: string): Promise<StoryWorld | undefined> {
  try { return await open().worlds.get(id); } catch { return undefined; }
}
/** Saves the league; false when storage is blocked or full (the story then lasts as long as the page is open). */
export async function saveStoryWorld(world: StoryWorld): Promise<boolean> {
  try { await open().worlds.put(world); return true; } catch { return false; }
}
/** Every league but `keep` (one story at a time: a finished or abandoned story's league is never read again). */
export async function dropStoryWorlds(keep: string | null = null): Promise<void> {
  try {
    const ids = (await open().worlds.toCollection().primaryKeys()).filter(id => id !== keep);
    if (ids.length) await open().worlds.bulkDelete(ids);
  } catch { /* ignore */ }
}

/** For the all-modes backup (see storage/backup.ts). */
export async function dumpStoryWorlds(): Promise<StoryWorld[]> {
  try { return await open().worlds.toArray(); } catch { return []; }
}
export async function restoreStoryWorlds(worlds: StoryWorld[]): Promise<void> {
  if (worlds.length) await open().worlds.bulkPut(worlds);
}
