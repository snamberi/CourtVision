import type { League } from '../simulation/league';
import { isOfficialLeague } from '../simulation/frontOffice';
import { localRead, type Read } from '../lib/kv';

/* Your GM legacy across every league played in this browser: achievements earned anywhere and career totals per
 * league. Kept in localStorage (small, per-browser, like the save list). Leagues where Sandbox was ever used never
 * count, and a league that becomes unofficial is taken back out, including achievements only it had earned. */

export interface LegacyLeague {
  saveId: string; name: string; seasons: number; wins: number; losses: number; titles: number;
  teams: string[]; lastSeason: string; updatedAt: number;
  /** 'draft' for an All-Time Draft league. */
  kind?: 'draft';
}
export interface LegacyAchievement { season: string; leagueName: string; at: number; saveIds: string[] }
export interface GmLegacy { version: 1; achievements: Record<string, LegacyAchievement>; leagues: Record<string, LegacyLeague> }

const KEY = 'courtvision:gmLegacy';
export const LEGACY_EVENT = 'courtvision:gm-legacy';
const empty = (): GmLegacy => ({ version: 1, achievements: {}, leagues: {} });

export function readLegacy(read: Read = localRead): GmLegacy {
  try {
    const raw = read(KEY);
    const parsed = raw ? JSON.parse(raw) as GmLegacy : null;
    return parsed?.version === 1 && parsed.achievements && parsed.leagues ? parsed : empty();
  } catch { return empty(); }
}
function write(legacy: GmLegacy) {
  try { localStorage.setItem(KEY, JSON.stringify(legacy)); window.dispatchEvent(new Event(LEGACY_EVENT)); } catch { /* storage blocked: the in-league record still works */ }
}

/** Pure merge step, exported for tests: fold one league's front office into the legacy record. */
export function mergeLeague(legacy: GmLegacy, saveId: string, name: string, league: League, now = Date.now()): GmLegacy {
  const fo = league.frontOffice;
  const next: GmLegacy = { version: 1, achievements: { ...legacy.achievements }, leagues: { ...legacy.leagues } };
  const official = !!fo && isOfficialLeague(league);
  const ownedIds = official ? new Set(Object.keys(fo!.achievements)) : new Set<string>();
  // Drop this league's claim on achievements it no longer holds (or all of them once Sandbox is used).
  for (const [id, a] of Object.entries(next.achievements)) {
    if (!a.saveIds.includes(saveId) || ownedIds.has(id)) continue;
    const saveIds = a.saveIds.filter(s => s !== saveId);
    if (saveIds.length) next.achievements[id] = { ...a, saveIds }; else delete next.achievements[id];
  }
  if (!official) { delete next.leagues[saveId]; return next; }
  for (const [id, unlock] of Object.entries(fo!.achievements)) {
    const existing = next.achievements[id];
    next.achievements[id] = existing
      ? (existing.saveIds.includes(saveId) ? existing : { ...existing, saveIds: [...existing.saveIds, saveId] })
      : { season: unlock.season, leagueName: name, at: now, saveIds: [saveId] };
  }
  const reviews = fo!.reviews.filter(r => !r.unofficial);
  if (reviews.length) {
    next.leagues[saveId] = {
      saveId, name, seasons: reviews.length, wins: reviews.reduce((n, r) => n + r.wins, 0), losses: reviews.reduce((n, r) => n + r.losses, 0),
      titles: reviews.filter(r => r.finish === 'Champion').length, teams: [...new Set(reviews.map(r => r.teamName))], lastSeason: reviews.at(-1)!.season, updatedAt: now,
      ...(league.allTimeDraft ? { kind: 'draft' as const } : {}),
    };
  } else delete next.leagues[saveId];
  return next;
}

/** Records a league into the legacy; writes only when something changed. */
export function recordLeagueLegacy(saveId: string, name: string, league: League): void {
  const before = readLegacy();
  const after = mergeLeague(before, saveId, name, league);
  const strip = (l: GmLegacy) => JSON.stringify({ a: Object.fromEntries(Object.entries(l.achievements).map(([k, v]) => [k, v.saveIds])), l: Object.fromEntries(Object.entries(l.leagues).map(([k, v]) => [k, { ...v, updatedAt: 0 }])) });
  if (strip(before) !== strip(after)) write(after);
}

export function legacyTotals(legacy: GmLegacy) {
  const leagues = Object.values(legacy.leagues);
  return {
    leagues: leagues.length, seasons: leagues.reduce((n, l) => n + l.seasons, 0), wins: leagues.reduce((n, l) => n + l.wins, 0),
    losses: leagues.reduce((n, l) => n + l.losses, 0), titles: leagues.reduce((n, l) => n + l.titles, 0), achievements: Object.keys(legacy.achievements).length,
  };
}
