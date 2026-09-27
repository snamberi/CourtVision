import Dexie, { type Table } from 'dexie';
import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import type { AutoPlayHalfSeason } from '../simulation/autoPlay';
import type { CareerMeta } from './career';

/*
 * Saved careers, in their own IndexedDB database (apart from the main game's saves). The small part (the career
 * itself) is listed quickly; the league it plays in is stored separately and only read to continue.
 */

/** Where the league stands: stopped at the draft (with the half-season's results), or at the start of a season. */
export type CareerPhase = 'atDraft' | 'inSeason' | 'over';
export interface CareerWorld { id: string; league: League; extras: GMLeagueExtras; phase: CareerPhase; partial?: AutoPlayHalfSeason }

class CareerDatabase extends Dexie {
  metas!: Table<CareerMeta, string>;
  worlds!: Table<CareerWorld, string>;
  constructor() {
    super('courtvision-careers');
    this.version(1).stores({ metas: 'id, updatedAt', worlds: 'id' });
  }
}
const db = new CareerDatabase();

export async function listCareers(): Promise<CareerMeta[]> {
  try { return (await db.metas.toArray()).sort((a, b) => b.updatedAt - a.updatedAt); } catch { return []; }
}
export async function loadWorld(id: string): Promise<CareerWorld | undefined> {
  try { return await db.worlds.get(id); } catch { return undefined; }
}
export async function saveCareer(meta: CareerMeta, world?: CareerWorld): Promise<void> {
  try {
    await db.transaction('rw', db.metas, db.worlds, async () => {
      await db.metas.put({ ...meta, updatedAt: Date.now() });
      if (world) await db.worlds.put(world);
    });
  } catch { /* storage blocked or full: the career lasts as long as the page is open */ }
}
/** A finished career keeps its story; its league is dropped (it is big and nothing reads it again). */
export async function dropWorld(id: string): Promise<void> { try { await db.worlds.delete(id); } catch { /* ignore */ } }
export async function deleteCareer(id: string): Promise<void> {
  try { await db.transaction('rw', db.metas, db.worlds, async () => { await db.metas.delete(id); await db.worlds.delete(id); }); } catch { /* ignore */ }
}
