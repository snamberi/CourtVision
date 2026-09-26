import Dexie, { type Table } from 'dexie';
import type { UniverseSnapshot } from './universeIO';
import { buildSnapshot } from './universeIO';
import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';

interface AutosaveRow {
  id: 'current';
  snapshot: UniverseSnapshot;
}

class AutosaveDatabase extends Dexie {
  saves!: Table<AutosaveRow, string>;

  constructor() {
    super('ubs-autosave');
    this.version(1).stores({ saves: 'id' });
  }
}

export const autosaveDb = new AutosaveDatabase();

export async function autosaveUniverse(league: League, extras: GMLeagueExtras): Promise<void> {
  const snapshot = buildSnapshot(league, extras);
  await autosaveDb.saves.put({ id: 'current', snapshot });
}

export async function loadAutosavedUniverse(): Promise<UniverseSnapshot | null> {
  const row = await autosaveDb.saves.get('current');
  return row?.snapshot ?? null;
}

export async function clearAutosave(): Promise<void> {
  await autosaveDb.saves.delete('current');
}

/** Simple debounce so rapid state changes (e.g. slider drags) don't hammer IndexedDB. */
export function createDebouncedAutosave(delayMs = 1500) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (league: League, extras: GMLeagueExtras) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      autosaveUniverse(league, extras).catch((err) => console.warn('Autosave failed:', err));
    }, delayMs);
  };
}
