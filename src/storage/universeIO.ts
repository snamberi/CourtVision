import { compactLeagueLogs } from '../simulation/logPacking';
import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import { slimRetirees } from '../history/retirees';

export interface UniverseSnapshot {
  controlledTeamId?: string | null;
  schemaVersion: number;
  gameVersion: string;
  exportedAt: number;
  league: League;
  extras: GMLeagueExtras;
}

const SCHEMA_VERSION = 1;
const GAME_VERSION = 'phase-1-9';

/** Replay logs are stored deflated (see simulation/logPacking), which keeps saves, backups and exports ~10× smaller. */
export function buildSnapshot(league: League, extras: GMLeagueExtras): UniverseSnapshot {
  return { schemaVersion: SCHEMA_VERSION, gameVersion: GAME_VERSION, exportedAt: Date.now(), league: compactLeagueLogs(slimRetirees(league), 0), extras };
}

/** Triggers a browser download of the current universe as a portable JSON file. */
export function downloadUniverse(league: League, extras: GMLeagueExtras, filename = 'universe.json') {
  downloadSnapshot(buildSnapshot(league, extras), filename);
}

export function downloadSnapshot(snapshot: UniverseSnapshot, filename = 'courtvision-backup.json') {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Parses and lightly migrates an imported universe file. Throws on structurally invalid input. */
export function parseUniverseFile(text: string): UniverseSnapshot {
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object' || !data.league || !data.extras) {
    throw new Error('This file does not look like a valid universe export.');
  }
  if (!Array.isArray(data.league.teams) || !Array.isArray(data.league.schedule) || (!data.league.settings || typeof data.league.settings !== 'object')
    || !Array.isArray(data.extras.freeAgents) || (!data.extras.contracts || typeof data.extras.contracts !== 'object')
    || data.league.teams.some((t: { teamId?: unknown; name?: unknown; seasons?: unknown }) =>
      typeof t?.teamId !== 'string' || typeof t?.name !== 'string' || !Array.isArray(t?.seasons))) {
    throw new Error('This backup is missing valid teams, schedule, or league settings.');
  }
  if (data.schemaVersion !== SCHEMA_VERSION) {
    // Placeholder for future migrations — schema is versioned from day one per spec section 60.
    console.warn(`Universe was exported with schema v${data.schemaVersion}, current is v${SCHEMA_VERSION}. Loading as-is.`);
  }
  reviveUnavailableNumbers(data as UniverseSnapshot);
  return data as UniverseSnapshot;
}

/**
 * JSON has no NaN, so "not recorded" numbers (imported historical seasons: advanced stats and team context that the
 * source never tracked) come back from an export as null. Restore them to NaN so every screen keeps showing "—"
 * instead of crashing or showing 0. Only touches `advanced` stat blocks and imported team-season summaries.
 */
export function reviveUnavailableNumbers(snapshot: Pick<UniverseSnapshot, 'league' | 'extras'>): void {
  const fixBlock = (o: Record<string, unknown> | null | undefined) => { if (o) for (const k of Object.keys(o)) if (o[k] === null) o[k] = Number.NaN; };
  const fixPlayer = (p: { careerHistory?: { advanced?: unknown; stints?: { advanced?: unknown }[] }[] } | null | undefined) => {
    for (const c of p?.careerHistory ?? []) {
      fixBlock(c.advanced as Record<string, unknown>);
      for (const st of c.stints ?? []) fixBlock(st.advanced as Record<string, unknown>);
    }
  };
  const { league, extras } = snapshot;
  for (const t of league.teams) t.seasons.forEach(fixPlayer);
  extras.freeAgents?.forEach(fixPlayer);
  extras.draftClass?.forEach(d => fixPlayer(d.trueSeason));
  for (const r of league.retiredPlayers ?? []) fixPlayer(r.finalSeasonData);
  for (const rec of league.franchiseHistory ?? []) if (rec.imported) for (const ts of rec.teamSeasons ?? []) fixBlock(ts as unknown as Record<string, unknown>);
}

export function readUniverseFromFile(file: File): Promise<UniverseSnapshot> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try { resolve(parseUniverseFile(String(reader.result))); }
      catch (e) { reject(e); }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
