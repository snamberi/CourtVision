import Dexie, { type Table } from 'dexie';
import type { Player, PlayerSeason, TeamSeason, Badge, GameSettings } from '../simulation/types';
import type { GameResult } from '../simulation/boxscore';

// --- Override system (section 105 of the spec): store only the diff, never
// duplicate the whole player record. Active player = base + overrides. ---
export interface PlayerOverride {
  id: string; // `${playerId}:${season}`
  playerId: string;
  season: string;
  patch: Record<string, unknown>; // dot-path -> value, applied over base PlayerSeason
  updatedAt: number;
}

export interface UniverseMeta {
  id: string; // singleton-ish key per universe, but table supports many universes
  name: string;
  schemaVersion: number;
  gameVersion: string;
  createdAt: number;
  updatedAt: number;
}

export interface SavedGame {
  id?: number;
  universeId: string;
  createdAt: number;
  result: GameResult;
}

export interface CustomBadgeRecord extends Badge {
  universeId: string;
}

export class UbsDatabase extends Dexie {
  players!: Table<Player, string>;
  playerSeasons!: Table<PlayerSeason, string>; // key = `${playerId}:${season}`
  playerOverrides!: Table<PlayerOverride, string>;
  teamSeasons!: Table<TeamSeason, string>; // key = `${teamId}:${season}`
  customBadges!: Table<CustomBadgeRecord, string>;
  savedGames!: Table<SavedGame, number>;
  universes!: Table<UniverseMeta, string>;
  settingsPresets!: Table<{ id: string; name: string; settings: GameSettings }, string>;

  constructor() {
    super('courtvision');
    this.version(1).stores({
      players: 'identity.id',
      playerSeasons: 'id, playerId, season, teamId',
      playerOverrides: 'id, playerId, season',
      teamSeasons: 'id, teamId, season',
      customBadges: 'id, universeId, category',
      savedGames: '++id, universeId, createdAt',
      universes: 'id',
      settingsPresets: 'id, name',
    });
  }
}

export const db = new UbsDatabase();

export function seasonKey(playerId: string, season: string) {
  return `${playerId}:${season}`;
}

function setByPath(obj: any, path: string, value: unknown) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] == null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

/** Merges base PlayerSeason data with any stored user override patch. Base data is never mutated on disk. */
export async function getActivePlayerSeason(playerId: string, season: string): Promise<PlayerSeason | undefined> {
  const base = await db.playerSeasons.get(seasonKey(playerId, season));
  if (!base) return undefined;
  const override = await db.playerOverrides.get(seasonKey(playerId, season));
  if (!override) return base;
  const merged: PlayerSeason = JSON.parse(JSON.stringify(base));
  for (const [path, value] of Object.entries(override.patch)) {
    setByPath(merged, path, value);
  }
  return merged;
}

export async function setPlayerOverride(playerId: string, season: string, patch: Record<string, unknown>) {
  const id = seasonKey(playerId, season);
  const existing = await db.playerOverrides.get(id);
  const merged = { ...(existing?.patch ?? {}), ...patch };
  await db.playerOverrides.put({ id, playerId, season, patch: merged, updatedAt: Date.now() });
}

export async function resetPlayerOverride(playerId: string, season: string) {
  await db.playerOverrides.delete(seasonKey(playerId, season));
}

// --- Export / Import universe (section 59) ---
export interface UniverseExport {
  schemaVersion: number;
  exportedAt: number;
  players: Player[];
  playerSeasons: PlayerSeason[];
  playerOverrides: PlayerOverride[];
  teamSeasons: TeamSeason[];
  customBadges: CustomBadgeRecord[];
}

export async function exportUniverse(): Promise<UniverseExport> {
  return {
    schemaVersion: 1,
    exportedAt: Date.now(),
    players: await db.players.toArray(),
    playerSeasons: await db.playerSeasons.toArray(),
    playerOverrides: await db.playerOverrides.toArray(),
    teamSeasons: await db.teamSeasons.toArray(),
    customBadges: await db.customBadges.toArray(),
  };
}

export async function importUniverse(data: UniverseExport) {
  await db.transaction('rw', db.players, db.playerSeasons, db.playerOverrides, db.teamSeasons, db.customBadges, async () => {
    await db.players.bulkPut(data.players);
    await db.playerSeasons.bulkPut(data.playerSeasons);
    await db.playerOverrides.bulkPut(data.playerOverrides);
    await db.teamSeasons.bulkPut(data.teamSeasons);
    await db.customBadges.bulkPut(data.customBadges);
  });
}
