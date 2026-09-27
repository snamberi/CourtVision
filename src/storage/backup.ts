import { savesDb, type SaveRow } from './saves';
import { exportUniverse, importUniverse, type UniverseExport } from './db';
import { dumpCareers, restoreCareers } from '../career/storage';
import type { CareerMeta } from '../career/career';
import type { CareerWorld } from '../career/storage';

/*
 * One file with everything this browser holds: GM leagues (saves), Career Mode (careers and their leagues), League
 * Hunt (run, records, album), the GM legacy and achievements, Rebuild Challenge records, custom badges and settings.
 * Everything else (cookie consent, the last page open) belongs to this device and stays out.
 *
 * Restoring adds and replaces by id; nothing already here is deleted. Files are gzip-compressed where the browser
 * can (plain JSON is read too).
 */

export const BACKUP_FORMAT = 'courtvision-backup';
export interface Backup {
  format: typeof BACKUP_FORMAT; version: 1; createdAt: number;
  localStorage: Record<string, string>;
  saves: SaveRow[];
  careers: { metas: CareerMeta[]; worlds: CareerWorld[] };
  universe: UniverseExport;
}
export interface BackupSummary { leagues: number; careers: number; hunts: boolean; achievements: number; sizeKb: number }

const KEEP = (key: string) => (key.startsWith('cv-') || key.startsWith('courtvision:')) && key !== 'courtvision:consent' && key !== 'courtvision:lastRoute' && key !== 'courtvision:lastActiveSaveId';

export async function buildBackup(): Promise<Backup> {
  const ls: Record<string, string> = {};
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && KEEP(k)) ls[k] = localStorage.getItem(k) ?? ''; } } catch { /* storage blocked */ }
  return { format: BACKUP_FORMAT, version: 1, createdAt: Date.now(), localStorage: ls, saves: await savesDb.saves.toArray(), careers: await dumpCareers(), universe: await exportUniverse() };
}

export function summarize(b: Backup, bytes = 0): BackupSummary {
  let achievements = 0;
  try { achievements = Object.keys((JSON.parse(b.localStorage['courtvision:gmLegacy'] ?? '{}') as { achievements?: object }).achievements ?? {}).length; } catch { /* none */ }
  return { leagues: b.saves.length, careers: b.careers.metas.length, hunts: !!b.localStorage['cv-hunt-records'], achievements, sizeKb: Math.round(bytes / 1024) };
}

async function gzip(text: string): Promise<Blob> {
  if (typeof CompressionStream === 'undefined') return new Blob([text], { type: 'application/json' });
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).blob();
}

/** The backup as a file to download. */
export async function backupFile(): Promise<{ blob: Blob; name: string; summary: BackupSummary }> {
  const b = await buildBackup();
  const blob = await gzip(JSON.stringify(b));
  const day = new Date().toISOString().slice(0, 10);
  return { blob, name: `courtvision-backup-${day}.cvbackup`, summary: summarize(b, blob.size) };
}

/** Reads a backup file (gzip or plain JSON); throws with a readable message when it isn't one. */
export async function readBackup(file: Blob): Promise<Backup> {
  const head = new Uint8Array(await file.slice(0, 2).arrayBuffer());
  let text: string;
  if (head[0] === 0x1f && head[1] === 0x8b) {
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot open compressed backups. Try a current Chrome, Edge, Firefox or Safari.');
    text = await new Response(file.stream().pipeThrough(new DecompressionStream('gzip'))).text();
  } else text = await file.text();
  let data: Backup;
  try { data = JSON.parse(text) as Backup; } catch { throw new Error('That file is not a Court Vision backup.'); }
  if (data?.format !== BACKUP_FORMAT || data.version !== 1) throw new Error('That file is not a Court Vision backup (or it is from a newer version).');
  return data;
}

/** Puts a backup back: adds and replaces by id, keeps everything else. */
export async function restoreBackup(b: Backup): Promise<void> {
  try { for (const [k, v] of Object.entries(b.localStorage ?? {})) if (KEEP(k)) localStorage.setItem(k, v); } catch { /* storage blocked */ }
  if (b.saves?.length) await savesDb.saves.bulkPut(b.saves);
  if (b.careers) await restoreCareers(b.careers);
  if (b.universe) await importUniverse(b.universe);
}
