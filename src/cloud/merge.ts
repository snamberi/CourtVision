import { readRecordBook, mergeRecordBook } from '../retention/recordBook';
import { readArcade, mergeArcade } from '../arcade/storage';
import { readPlayTime, mergePlayTime } from '../retention/playTime';
/*
 * Cloud progress: which stored values travel with an account, and how two copies (this device and the cloud) are
 * merged. Every merge keeps the best of both, so signing in on a second device can never erase progress:
 * achievements and albums are unions, records keep their best numbers, per-day and per-week results keep the better
 * one. GM leagues and careers still in progress stay on the device (they are large); retired careers travel.
 */

import type { GmLegacy } from '../storage/gmLegacy';
import { huntScore, type HuntRecords } from '../hunt/storage';
import type { RebuildRecord } from '../simulation/rebuildChallenge';
import type { WeeklyRecords } from '../retention/weekly';
import { readFeats, mergeFeats } from '../profile/feats';
import { avatarSavedAt } from '../profile/avatar';
import { readStreak, mergeStreak } from '../retention/streak';
import { readPass, mergePass } from '../retention/pass';
import { loadPerfectRecords, mergePerfectRecords } from '../perfect/storage';
import { readBonusLog, mergeBonusLog } from '../retention/modeOfWeek';
import { readMissions, mergeMissions } from '../retention/missions';
import { readQuests, mergeQuests } from '../tutorial/quests';
import { loadRelics, mergeRelics } from '../relics/relics';

/** The stored values that belong to the account (everything else is per device). */
export const SYNC_KEYS = [
  'courtvision:gmLegacy', 'cv-hunt-records', 'cv-hunt-album', 'cv-rebuild-records', 'cv-rebuild-records-done',
  'cv-weekly-records', 'cv-daily-history', 'cv-profile-equip', 'cv-code-results', 'cv-feats',
  'cv-legend-records', 'cv-card-album', 'cv-card-sets', 'cv-avatar', 'cv-streak', 'cv-pass',
  'cv-perfect-records', 'cv-bonus-xp', 'cv-record-book', 'cv-play-time', 'cv-arcade', 'cv-missions', 'cv-quests', 'cv-trophy-case',
  'cv-relics',
] as const;
export type SyncKey = typeof SYNC_KEYS[number];

const parse = <T>(raw: string | null | undefined, fallback: T): T => { if (!raw) return fallback; try { return JSON.parse(raw) as T ?? fallback; } catch { return fallback; } };
const max = (a?: number | null, b?: number | null) => Math.max(a ?? 0, b ?? 0);

function mergeLegacy(a: GmLegacy, b: GmLegacy): GmLegacy {
  const out: GmLegacy = { version: 1, achievements: { ...b.achievements }, leagues: { ...b.leagues } };
  for (const [id, x] of Object.entries(a.achievements ?? {})) {
    const y = out.achievements[id];
    out.achievements[id] = y ? { ...(x.at <= y.at ? x : y), saveIds: [...new Set([...x.saveIds, ...y.saveIds])] } : x;
  }
  for (const [id, l] of Object.entries(a.leagues ?? {})) { const y = out.leagues[id]; if (!y || l.updatedAt >= y.updatedAt) out.leagues[id] = l; }
  return out;
}

function mergeHunt(a: HuntRecords, b: HuntRecords): HuntRecords {
  const daily = { ...(b.daily ?? {}) };
  for (const [d, r] of Object.entries(a.daily ?? {})) { const o = daily[d]; if (!o || (r.won && !o.won) || (r.won === o.won && r.stop > o.stop)) daily[d] = r; }
  const weekly = { ...(b.weekly ?? {}) };
  for (const [w, r] of Object.entries(a.weekly ?? {})) { const o = weekly[w]; weekly[w] = !o ? r : { ...(huntScore(r) > huntScore(o) ? r : o), tries: max(r.tries, o.tries) }; }
  return { runs: max(a.runs, b.runs), wins: max(a.wins, b.wins), bestStop: max(a.bestStop, b.bestStop), ...(a.lastSeed != null ? { lastSeed: a.lastSeed } : b.lastSeed != null ? { lastSeed: b.lastSeed } : {}), daily, ...(Object.keys(weekly).length ? { weekly } : {}) };
}

function mergeRebuild(a: Record<string, RebuildRecord>, b: Record<string, RebuildRecord>): Record<string, RebuildRecord> {
  // One fixed shape, so merging an already-merged copy gives the very same text (no endless "changes").
  const norm = (r: RebuildRecord, o: RebuildRecord = r): RebuildRecord => {
    const done = max(r.completedAt, o.completedAt);
    return { best: max(r.best, o.best), stars: max(r.stars, o.stars), titleIn: r.titleIn != null && o.titleIn != null ? Math.min(r.titleIn, o.titleIn) : r.titleIn ?? o.titleIn ?? null, attempts: max(r.attempts, o.attempts), ...(done ? { completedAt: done } : {}) };
  };
  const out: Record<string, RebuildRecord> = {};
  for (const id of [...new Set([...Object.keys(b), ...Object.keys(a)])].sort()) out[id] = a[id] && b[id] ? norm(a[id], b[id]) : norm(a[id] ?? b[id]);
  return out;
}

function mergeWeekly(a: WeeklyRecords, b: WeeklyRecords): WeeklyRecords {
  const out: WeeklyRecords = JSON.parse(JSON.stringify(b)) as WeeklyRecords;
  for (const [w, x] of Object.entries(a)) {
    const y = out[w] ?? {};
    out[w] = { ...y };
    for (const k of ['rebuild', 'career'] as const) { const r = x[k], o = y[k]; if (r && (!o || r.best > o.best)) out[w][k] = r; }
  }
  return out;
}

type ByDay = Record<string, { done: number; xp: number }>;
function mergeDays(a: ByDay, b: ByDay): ByDay {
  const out = { ...b };
  for (const [d, x] of Object.entries(a)) { const y = out[d]; if (!y || x.xp > y.xp) out[d] = x; }
  return out;
}

export interface CodeResult { team: string | null; wins: number; losses: number; finish: string; season: string; at: number }
function mergeCodes(a: Record<string, CodeResult>, b: Record<string, CodeResult>): Record<string, CodeResult> {
  const out = { ...b };
  for (const [c, x] of Object.entries(a)) { const y = out[c]; if (!y || x.at > y.at) out[c] = x; }
  return out;
}

/** Merges one stored value. `local` wins ties for per-device choices (the frame and floor you just equipped). */
export function mergeValue(key: SyncKey, local: string | null | undefined, cloud: string | null | undefined): string | null {
  if (local == null || local === '') return cloud ?? null;
  if (cloud == null || cloud === '') return local;
  switch (key) {
    case 'courtvision:gmLegacy': return JSON.stringify(mergeLegacy(parse(local, { version: 1, achievements: {}, leagues: {} } as GmLegacy), parse(cloud, { version: 1, achievements: {}, leagues: {} } as GmLegacy)));
    case 'cv-hunt-records': return JSON.stringify(mergeHunt(parse(local, { runs: 0, wins: 0, bestStop: 0 }), parse(cloud, { runs: 0, wins: 0, bestStop: 0 })));
    case 'cv-hunt-album': case 'cv-rebuild-records-done': return JSON.stringify([...new Set([...parse<string[]>(cloud, []), ...parse<string[]>(local, [])])]);
    case 'cv-rebuild-records': return JSON.stringify(mergeRebuild(parse(local, {}), parse(cloud, {})));
    case 'cv-weekly-records': return JSON.stringify(mergeWeekly(parse(local, {}), parse(cloud, {})));
    case 'cv-daily-history': return JSON.stringify(mergeDays(parse(local, {}), parse(cloud, {})));
    case 'cv-code-results': return JSON.stringify(mergeCodes(parse(local, {}), parse(cloud, {})));
    case 'cv-feats': return JSON.stringify(mergeFeats(readFeats(() => local), readFeats(() => cloud)));
    case 'cv-profile-equip': return local;
    // Your character: the one changed most recently (a random first character never beats a chosen one).
    case 'cv-avatar': return avatarSavedAt(cloud) > avatarSavedAt(local) ? cloud : local;
    case 'cv-streak': return JSON.stringify(mergeStreak(readStreak(() => local), readStreak(() => cloud)));
    case 'cv-trophy-case': return local; // what you arranged on this device
    case 'cv-quests': return JSON.stringify(mergeQuests(readQuests(() => local), readQuests(() => cloud)));
    case 'cv-missions': return JSON.stringify(mergeMissions(readMissions(() => local), readMissions(() => cloud)));
    case 'cv-bonus-xp': return JSON.stringify(mergeBonusLog(readBonusLog(() => local), readBonusLog(() => cloud)));
    case 'cv-perfect-records': return JSON.stringify(mergePerfectRecords(loadPerfectRecords(() => local), loadPerfectRecords(() => cloud)));
    case 'cv-record-book': return JSON.stringify(mergeRecordBook(readRecordBook(() => local), readRecordBook(() => cloud)));
    case 'cv-play-time': return JSON.stringify(mergePlayTime(readPlayTime(() => local), readPlayTime(() => cloud)));
    case 'cv-arcade': return JSON.stringify(mergeArcade(readArcade(() => local), readArcade(() => cloud)));
    case 'cv-pass': return JSON.stringify(mergePass(readPass(() => local), readPass(() => cloud)));
    case 'cv-relics': return JSON.stringify(mergeRelics(loadRelics(() => local), loadRelics(() => cloud)));
    case 'cv-legend-records': {
      // Best score and stars per Legend Challenge; attempts from whichever device played more.
      type Rec = { best: number; stars: number; attempts: number };
      const out: Record<string, Rec> = { ...parse<Record<string, Rec>>(cloud, {}) };
      for (const [id, x] of Object.entries(parse<Record<string, Rec>>(local, {}))) { const y = out[id]; out[id] = y ? { best: max(x.best, y.best), stars: max(x.stars, y.stars), attempts: max(x.attempts, y.attempts) } : x; }
      return JSON.stringify(out);
    }
    case 'cv-card-sets':
    case 'cv-card-album': return JSON.stringify({ ...parse<Record<string, unknown>>(cloud, {}), ...parse<Record<string, unknown>>(local, {}) });
  }
}

export function mergeStorage(local: Record<string, string>, cloud: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of SYNC_KEYS) { const v = mergeValue(k, local[k], cloud[k]); if (v != null) out[k] = v; }
  return out;
}

/** Careers: the newer copy of each (a retired one never goes back to active). */
export function mergeCareers<T extends { id: string; updatedAt: number; status: string }>(local: T[], cloud: T[]): T[] {
  const byId = new Map(cloud.map(c => [c.id, c]));
  for (const c of local) {
    const o = byId.get(c.id);
    if (!o || (o.status !== 'retired' && (c.status === 'retired' || c.updatedAt >= o.updatedAt))) byId.set(c.id, c);
  }
  return [...byId.values()];
}

export interface ProgressBlob { version: 1; updatedAt: number; storage: Record<string, string>; careers: unknown[] }
