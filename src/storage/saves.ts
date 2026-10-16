import Dexie, { type Table } from 'dexie';
import type { UniverseSnapshot } from './universeIO';
import { buildSnapshot } from './universeIO';
import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import { packJson, unpackJson } from './packSnapshot';

export interface SaveRow {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  snapshot: UniverseSnapshot & { controlledTeamId?: string | null };
}

/** What a restore point holds, readable without unpacking it. */
export interface RestorePointInfo { season?: string; phase?: string; games: number }
export interface RestorePoint {
  id: string; saveId: string; createdAt: number; sourceUpdatedAt: number; label: string;
  /** The league as saved. Older points keep it this way; new ones hold it only until it is compressed into `packed`. */
  snapshot?: SaveRow['snapshot'];
  /** The same snapshot as gzip-compressed JSON (packSnapshot.ts). Read it with loadRestorePoint. */
  packed?: Uint8Array;
  info?: RestorePointInfo;
  /** A key moment (before Deadline Day, the playoffs, the draft, re-signing, free agency, a new season or a rewind):
   * kept in its own, longer list so routine backups never push it out. */
  key?: boolean;
}
// Compressed points take a fraction of the space, so more of them are kept.
export const MAX_RESTORE_POINTS = 12;
export const MAX_KEY_POINTS = 15;

/** Games played so far this season, playoffs included. */
const playedGames = (l: League | null | undefined) => (Array.isArray(l?.schedule) ? l.schedule.filter(g => g.played).length : 0)
  + (l?.playoffBracket?.rounds.flat().reduce((n, s) => n + s.games.length, 0) ?? 0);
const infoOf = (snapshot: SaveRow['snapshot'] | undefined): RestorePointInfo =>
  ({ season: snapshot?.league?.season, phase: snapshot?.league?.seasonPhase, games: playedGames(snapshot?.league) });
export const restorePointInfo = (p: RestorePoint): RestorePointInfo => p.info ?? infoOf(p.snapshot);

const PHASE_LABEL: Record<string, string> = {
  playoffs: 'Before the playoffs', draft: 'Before the draft', resign_waive: 'Before re-signing', free_agency: 'Before free agency',
  preseason: 'Before the preseason', awards_recap: 'Before the awards', all_star: 'Before All-Star Weekend',
};
/** The key moment a save is about to pass, if any: a label for the snapshot taken just before it. */
export function keyMoment(previous: League, next: League): string | null {
  if (previous.season !== next.season) return 'Before the new season';
  if ((previous.deadlineDay?.status ?? 'upcoming') !== 'open' && next.deadlineDay?.status === 'open' && next.deadlineDay.season === next.season) return 'Before Deadline Day';
  if (previous.seasonPhase !== next.seasonPhase) return PHASE_LABEL[next.seasonPhase ?? 'regular_season'] ?? 'Before season / phase change';
  return null;
}

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
  /** One small summary per save, so the save list never has to load whole leagues (rebuilt from `saves` when missing). */
  saveMeta!: Table<SaveSummary, string>;

  constructor() {
    super('courtvision-saves');
    this.version(1).stores({ saves: 'id, updatedAt' });
    this.version(2).stores({ saves: 'id, updatedAt', restorePoints: 'id, saveId, [saveId+createdAt]' });
    this.version(3).stores({ saves: 'id, updatedAt', restorePoints: 'id, saveId, [saveId+createdAt]', saveMeta: 'id' });
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
  const [ids, metas] = await Promise.all([savesDb.saves.toCollection().primaryKeys(), savesDb.saveMeta.toArray()]);
  const live = new Set(ids), known = new Map(metas.filter(m => live.has(m.id)).map(m => [m.id, m]));
  // Saves written before summaries existed (or put back from a backup) are read once and summarized.
  const missing = ids.filter(id => !known.has(id));
  if (missing.length) {
    const fresh = (await savesDb.saves.bulkGet(missing)).filter((r): r is SaveRow => !!r).map(summarize);
    for (const m of fresh) known.set(m.id, m);
    await savesDb.saveMeta.bulkPut(fresh).catch(() => { /* the list still shows; it is rebuilt next time */ });
  }
  const stale = metas.filter(m => !live.has(m.id)).map(m => m.id);
  if (stale.length) await savesDb.saveMeta.bulkDelete(stale).catch(() => {});
  return [...known.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}
/** Forgets the stored summaries of these saves (all when omitted); the next listSaves rebuilds them. */
export async function refreshSaveMeta(ids?: string[]): Promise<void> {
  await (ids ? savesDb.saveMeta.bulkDelete(ids) : savesDb.saveMeta.clear());
}

function makeId(): string {
  return `save_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function createSave(name: string, league: League, extras: GMLeagueExtras, controlledTeamId: string | null): Promise<string> {
  const id = makeId();
  const now = Date.now();
  const snapshot = { ...buildSnapshot(league, extras), controlledTeamId };
  const row: SaveRow = { id, name: name.trim() || 'Untitled League', createdAt: now, updatedAt: now, snapshot };
  await savesDb.transaction('rw', [savesDb.saves, savesDb.restorePoints, savesDb.saveMeta], async () => {
    await savesDb.saves.put(row);
    await savesDb.saveMeta.put(summarize(row));
    await addRestorePoint(id, snapshot, now, 'League created');
  });
  setLastActiveSaveId(id);
  void packRestorePoints(id);
  return id;
}

const pendingWrites = new Map<string, Promise<void>>();

export function updateSave(id: string, league: League, extras: GMLeagueExtras, controlledTeamId: string | null): Promise<void> {
  const snapshot = structuredClone({ ...buildSnapshot(league, extras), controlledTeamId });
  const write = (pendingWrites.get(id) ?? Promise.resolve()).catch(() => {}).then(async () => {
    // Update only the snapshot. Never resurrect a deleted slot or overwrite a concurrent rename.
    let added = false;
    await savesDb.transaction('rw', [savesDb.saves, savesDb.restorePoints, savesDb.saveMeta], async () => {
      const row = await savesDb.saves.get(id);
      if (!row) return;
      const latest = await latestRestorePoint(id);
      const previous = row.snapshot.league;
      const moment = keyMoment(previous, league);
      const boundary = !!moment;
      const due = !latest || boundary || Date.now() - latest.createdAt >= 10 * 60_000
        || playedGames(league) - restorePointInfo(latest).games >= 10;
      if (due && latest?.sourceUpdatedAt !== row.updatedAt) {
        await addRestorePoint(id, row.snapshot, row.updatedAt, moment ?? 'Automatic backup', !!moment);
        added = true;
      } else if (moment && latest && latest.sourceUpdatedAt === row.updatedAt && !latest.key) {
        // The newest backup already holds this exact moment: name it instead of storing it twice.
        await savesDb.restorePoints.update(latest.id, { label: moment, key: true });
      }
      const updatedAt = Math.max(Date.now(), row.updatedAt + 1);
      await savesDb.saves.update(id, { snapshot, updatedAt });
      await savesDb.saveMeta.put(summarize({ ...row, snapshot, updatedAt }));
    });
    if (added) void packRestorePoints(id);
  });
  pendingWrites.set(id, write);
  const clean = () => { if (pendingWrites.get(id) === write) pendingWrites.delete(id); };
  void write.then(clean, clean);
  return write;
}

export async function renameSave(id: string, name: string): Promise<void> {
  if (!name.trim()) return;
  await savesDb.transaction('rw', savesDb.saves, savesDb.saveMeta, async () => {
    await savesDb.saves.update(id, { name: name.trim() });
    await savesDb.saveMeta.update(id, { name: name.trim() });
  });
}

export async function deleteSave(id: string): Promise<void> {
  await savesDb.transaction('rw', [savesDb.saves, savesDb.restorePoints, savesDb.saveMeta], async () => {
    await savesDb.saves.delete(id);
    await savesDb.saveMeta.delete(id);
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
async function addRestorePoint(saveId: string, snapshot: SaveRow['snapshot'], sourceUpdatedAt: number, label: string, key = false): Promise<string> {
  const id = `restore_${makeId()}`;
  const last = await latestRestorePoint(saveId);
  const createdAt = Math.max(Date.now(), (last?.createdAt ?? 0) + 1);
  // Stored as-is inside the transaction (compressing would end it early); packRestorePoints compresses it right after.
  await savesDb.restorePoints.add({ id, saveId, createdAt, sourceUpdatedAt, label, snapshot, info: infoOf(snapshot), ...(key ? { key: true } : {}) });
  // Routine and key-moment backups are trimmed separately, newest kept.
  const all = await savesDb.restorePoints.where('[saveId+createdAt]').between([saveId, Dexie.minKey], [saveId, Dexie.maxKey]).reverse().toArray();
  const drop = [...all.filter(p => !p.key).slice(MAX_RESTORE_POINTS), ...all.filter(p => p.key).slice(MAX_KEY_POINTS)].map(p => p.id);
  if (drop.length) await savesDb.restorePoints.bulkDelete(drop);
  return id;
}

function latestRestorePoint(saveId: string) {
  return savesDb.restorePoints.where('[saveId+createdAt]').between([saveId, Dexie.minKey], [saveId, Dexie.maxKey]).reverse().first();
}
export async function listRestorePoints(saveId: string): Promise<RestorePoint[]> {
  return savesDb.restorePoints.where('saveId').equals(saveId).reverse().sortBy('createdAt');
}
/** The league a restore point holds (unpacked if it was compressed). */
export async function loadRestorePoint(point: RestorePoint): Promise<SaveRow['snapshot']> {
  if (point.snapshot) return point.snapshot;
  if (point.packed) return unpackJson<SaveRow['snapshot']>(point.packed);
  throw new Error('This restore point is empty.');
}

const packing = new Map<string, Promise<void>>();
/**
 * Compresses a save's restore points that are still stored as-is (new ones, and every point from before compression).
 * Runs after the save's transaction, one save at a time; a point deleted meanwhile is simply skipped.
 */
export function packRestorePoints(saveId: string): Promise<void> {
  const run = (packing.get(saveId) ?? Promise.resolve()).then(async () => {
    const loose = await savesDb.restorePoints.where('saveId').equals(saveId).filter(p => !!p.snapshot).primaryKeys();
    for (const id of loose) {
      const point = await savesDb.restorePoints.get(id);
      if (!point?.snapshot) continue;
      const packed = await packJson(point.snapshot);
      await savesDb.restorePoints.where('id').equals(id).modify(p => {
        if (!p.snapshot) return;
        p.info = p.info ?? infoOf(p.snapshot);
        p.packed = packed;
        delete p.snapshot;
      });
    }
  }).catch(err => { console.warn('Could not compress backups:', err); });
  packing.set(saveId, run);
  void run.finally(() => { if (packing.get(saveId) === run) packing.delete(saveId); });
  return run;
}
/** Waits for any compression still running (tests, and before reading every point's bytes). */
export const restorePointsSettled = () => Promise.all([...packing.values()]).then(() => undefined);

export async function createRestorePoint(saveId: string): Promise<string> {
  await pendingWrites.get(saveId);
  const id = await savesDb.transaction('rw', savesDb.saves, savesDb.restorePoints, async () => {
    const row = await savesDb.saves.get(saveId);
    if (!row) throw new Error('This saved league no longer exists.');
    return addRestorePoint(saveId, row.snapshot, row.updatedAt, 'Manual backup');
  });
  void packRestorePoints(saveId);
  return id;
}
/**
 * Rewind: replaces the save with a restore point's snapshot and returns it to load into the open league, after saving
 * where you are now as a "Before rewind" key moment (so a rewind can itself be undone).
 */
export async function prepareRewind(saveId: string, pointId: string): Promise<SaveRow['snapshot']> {
  await pendingWrites.get(saveId);
  const found = await savesDb.restorePoints.get(pointId);
  if (!found || found.saveId !== saveId) throw new Error('This restore point is no longer available.');
  const target = await loadRestorePoint(found); // unpacked before the transaction, which must not wait on anything else
  const snapshot = await savesDb.transaction('rw', [savesDb.saves, savesDb.restorePoints, savesDb.saveMeta], async () => {
    const point = await savesDb.restorePoints.get(pointId);
    const row = await savesDb.saves.get(saveId);
    if (!point || point.saveId !== saveId || !row) throw new Error('This restore point is no longer available.');
    await addRestorePoint(saveId, row.snapshot, row.updatedAt, 'Before rewind', true);
    const updatedAt = Math.max(Date.now(), row.updatedAt + 1);
    await savesDb.saves.update(saveId, { snapshot: target, updatedAt });
    await savesDb.saveMeta.put(summarize({ ...row, snapshot: target, updatedAt }));
    return target;
  });
  void packRestorePoints(saveId);
  return snapshot;
}

export async function recoverRestorePoint(saveId: string, pointId: string): Promise<string> {
  const point = await savesDb.restorePoints.get(pointId);
  const original = await savesDb.saves.get(saveId);
  if (!point || point.saveId !== saveId || !original) throw new Error('This restore point is no longer available.');
  const { league, extras, controlledTeamId } = await loadRestorePoint(point);
  return createSave(`${original.name} — recovered`, league, extras, controlledTeamId ?? null);
}
