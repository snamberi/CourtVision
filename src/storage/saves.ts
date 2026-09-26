import Dexie, { type Table } from 'dexie';
import type { UniverseSnapshot } from './universeIO';
import { buildSnapshot } from './universeIO';
import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';

export interface SaveRow {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  snapshot: UniverseSnapshot & { controlledTeamId?: string | null };
}

export interface RestorePoint {
  id: string; saveId: string; createdAt: number; sourceUpdatedAt: number; label: string;
  snapshot: SaveRow['snapshot'];
}
export const MAX_RESTORE_POINTS = 5;

export interface SaveSummary {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  season?: string;
  teamCount: number;
  controlledTeamName?: string;
}

class SavesDatabase extends Dexie {
  saves!: Table<SaveRow, string>;
  restorePoints!: Table<RestorePoint, string>;

  constructor() {
    super('courtvision-saves');
    this.version(1).stores({ saves: 'id, updatedAt' });
    this.version(2).stores({ saves: 'id, updatedAt', restorePoints: 'id, saveId, [saveId+createdAt]' });
  }
}

export const savesDb = new SavesDatabase();

const LAST_ACTIVE_KEY = 'courtvision:lastActiveSaveId';

export function getLastActiveSaveId(): string | null {
  try { return localStorage.getItem(LAST_ACTIVE_KEY); } catch { return null; }
}

export function setLastActiveSaveId(id: string | null): void {
  try {
    if (id) localStorage.setItem(LAST_ACTIVE_KEY, id);
    else localStorage.removeItem(LAST_ACTIVE_KEY);
  } catch { /* localStorage unavailable (e.g. private mode) - non-fatal */ }
}

function summarize(row: SaveRow): SaveSummary {
  // Keep the slot visible for recovery even if its latest snapshot is damaged.
  const league = row.snapshot?.league;
  const teams = Array.isArray(league?.teams) ? league.teams : [];
  const controlledTeamId = row.snapshot?.controlledTeamId;
  const controlledTeam = controlledTeamId ? teams.find((t) => t?.teamId === controlledTeamId) : undefined;
  return {
    id: row.id, name: row.name, createdAt: row.createdAt, updatedAt: row.updatedAt,
    season: league?.season, teamCount: teams.length, controlledTeamName: controlledTeam?.name,
  };
}

export async function listSaves(): Promise<SaveSummary[]> {
  const rows = await savesDb.saves.toArray();
  return rows.map(summarize).sort((a, b) => b.updatedAt - a.updatedAt);
}

function makeId(): string {
  return `save_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function createSave(name: string, league: League, extras: GMLeagueExtras, controlledTeamId: string | null): Promise<string> {
  const id = makeId();
  const now = Date.now();
  const snapshot = { ...buildSnapshot(league, extras), controlledTeamId };
  await savesDb.transaction('rw', savesDb.saves, savesDb.restorePoints, async () => {
    await savesDb.saves.put({ id, name: name.trim() || 'Untitled League', createdAt: now, updatedAt: now, snapshot });
    await addRestorePoint(id, snapshot, now, 'League created');
  });
  setLastActiveSaveId(id);
  return id;
}

const pendingWrites = new Map<string, Promise<void>>();

export function updateSave(id: string, league: League, extras: GMLeagueExtras, controlledTeamId: string | null): Promise<void> {
  const snapshot = structuredClone({ ...buildSnapshot(league, extras), controlledTeamId });
  const write = (pendingWrites.get(id) ?? Promise.resolve()).catch(() => {}).then(async () => {
    // Update only the snapshot. Never resurrect a deleted slot or overwrite a concurrent rename.
    await savesDb.transaction('rw', savesDb.saves, savesDb.restorePoints, async () => {
      const row = await savesDb.saves.get(id);
      if (!row) return;
      const latest = await latestRestorePoint(id);
      const previous = row.snapshot.league;
      const boundary = previous.season !== league.season || previous.seasonPhase !== league.seasonPhase;
      const games = (l: League) => l.schedule.filter(g => g.played).length + (l.playoffBracket?.rounds.flat().reduce((n, s) => n + s.games.length, 0) ?? 0);
      const due = !latest || boundary || Date.now() - latest.createdAt >= 10 * 60_000
        || games(league) - games(latest.snapshot.league) >= 10;
      if (due && latest?.sourceUpdatedAt !== row.updatedAt) {
        await addRestorePoint(id, row.snapshot, row.updatedAt, boundary ? 'Before season / phase change' : 'Automatic backup');
      }
      await savesDb.saves.update(id, { snapshot, updatedAt: Math.max(Date.now(), row.updatedAt + 1) });
    });
  });
  pendingWrites.set(id, write);
  const clean = () => { if (pendingWrites.get(id) === write) pendingWrites.delete(id); };
  void write.then(clean, clean);
  return write;
}

export async function renameSave(id: string, name: string): Promise<void> {
  if (name.trim()) await savesDb.saves.update(id, { name: name.trim() });
}

export async function deleteSave(id: string): Promise<void> {
  await savesDb.transaction('rw', savesDb.saves, savesDb.restorePoints, async () => {
    await savesDb.saves.delete(id);
    await savesDb.restorePoints.where('saveId').equals(id).delete();
  });
  if (getLastActiveSaveId() === id) setLastActiveSaveId(null);
}

export async function getSave(id: string): Promise<SaveRow['snapshot'] | null> {
  const row = await savesDb.saves.get(id);
  return row?.snapshot ?? null;
}

/**
 * One-time migration: if the old single-slot autosave (from before multi-save
 * support existed) has data and the new save list is still empty, import it
 * as "Imported Save" so nobody's in-progress universe silently disappears.
 */
export async function migrateLegacyAutosaveIfNeeded(): Promise<void> {
  try {
    const existingSaves = await savesDb.saves.count();
    if (existingSaves > 0) return;

    const legacy = new Dexie('ubs-autosave');
    legacy.version(1).stores({ saves: 'id' });
    const legacyTable = legacy.table('saves') as Table<{ id: string; snapshot: UniverseSnapshot }, string>;
    const row = await legacyTable.get('current').catch(() => undefined);
    if (row?.snapshot) {
      const id = makeId();
      const now = Date.now();
      await savesDb.saves.put({ id, name: 'Imported Save', createdAt: now, updatedAt: now, snapshot: row.snapshot });
      setLastActiveSaveId(id);
    }
    legacy.close();
  } catch {
    // No legacy DB, or browser blocked it - nothing to migrate, not an error worth surfacing.
  }
}

/**
 * Simple debounce so rapid state changes (e.g. slider drags) don't hammer IndexedDB. Call with the currently
 * active save id. `flush()` writes any pending change immediately - used when the tab is hidden or closed so
 * the last second or two of play is never lost.
 */
export function createDebouncedSave(delayMs = 1500) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: (() => Promise<void>) | null = null;

  let inFlight: Promise<void> = Promise.resolve();
  const run = () => {
    timer = null;
    const job = pending;
    pending = null;
    if (job) inFlight = job().catch((err) => {
      console.warn('Save failed:', err);
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('courtvision:save-error'));
    });
    return inFlight;
  };

  const schedule = (saveId: string | null, league: League, extras: GMLeagueExtras, controlledTeamId: string | null) => {
    if (!saveId) return;
    if (timer) clearTimeout(timer);
    pending = () => updateSave(saveId, league, extras, controlledTeamId);
    timer = setTimeout(run, delayMs);
  };
  schedule.flush = () => {
    if (timer) clearTimeout(timer);
    return run();
  };
  return schedule;
}

/** Restore points share the save transaction: a failed backup never half-replaces a save. */
async function addRestorePoint(saveId: string, snapshot: SaveRow['snapshot'], sourceUpdatedAt: number, label: string): Promise<string> {
  const id = `restore_${makeId()}`;
  const last = await latestRestorePoint(saveId);
  const createdAt = Math.max(Date.now(), (last?.createdAt ?? 0) + 1);
  await savesDb.restorePoints.add({ id, saveId, createdAt, sourceUpdatedAt, label, snapshot });
  const keys = await savesDb.restorePoints.where('[saveId+createdAt]').between([saveId, Dexie.minKey], [saveId, Dexie.maxKey]).reverse().primaryKeys();
  await savesDb.restorePoints.bulkDelete(keys.slice(MAX_RESTORE_POINTS));
  return id;
}
function latestRestorePoint(saveId: string) {
  return savesDb.restorePoints.where('[saveId+createdAt]').between([saveId, Dexie.minKey], [saveId, Dexie.maxKey]).reverse().first();
}
export async function listRestorePoints(saveId: string): Promise<RestorePoint[]> {
  return savesDb.restorePoints.where('saveId').equals(saveId).reverse().sortBy('createdAt');
}
export async function createRestorePoint(saveId: string): Promise<string> {
  await pendingWrites.get(saveId);
  return savesDb.transaction('rw', savesDb.saves, savesDb.restorePoints, async () => {
    const row = await savesDb.saves.get(saveId);
    if (!row) throw new Error('This saved league no longer exists.');
    return addRestorePoint(saveId, row.snapshot, row.updatedAt, 'Manual backup');
  });
}
export async function recoverRestorePoint(saveId: string, pointId: string): Promise<string> {
  const point = await savesDb.restorePoints.get(pointId);
  const original = await savesDb.saves.get(saveId);
  if (!point || point.saveId !== saveId || !original) throw new Error('This restore point is no longer available.');
  const { league, extras, controlledTeamId } = point.snapshot;
  return createSave(`${original.name} — recovered`, league, extras, controlledTeamId ?? null);
}
