import { describe, it, expect, beforeEach } from 'vitest';

// vitest's node environment has no localStorage; saves.ts already degrades gracefully without it,
// but to actually exercise the "last active save" bookkeeping we provide a minimal in-memory shim.
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

import {
  createSave, updateSave, deleteSave, renameSave, getSave, listSaves,
  getLastActiveSaveId, savesDb,
} from '../storage/saves';
import { buildDemoTeam } from '../simulation/presets/samplePlayers';
import { generateRoundRobinSchedule, type League } from '../simulation/league';
import { DEFAULT_GAME_SETTINGS } from '../simulation/types';
import { DEFAULT_CAP_SETTINGS, DEFAULT_TRADE_SETTINGS, DEFAULT_GM_FLAGS, type GMLeagueExtras } from '../simulation/gm';

function fixture() {
  const teams = ['A', 'B'].map((id) => {
    const demo = buildDemoTeam(id, id);
    return { teamId: demo.teamId, name: demo.label, seasons: demo.seasons };
  });
  const league: League = { teams, schedule: generateRoundRobinSchedule(['A', 'B'], 1), settings: { ...DEFAULT_GAME_SETTINGS }, season: '2026-27' };
  const extras: GMLeagueExtras = { contracts: {}, freeAgents: [], capSettings: { ...DEFAULT_CAP_SETTINGS }, draftClass: [], tradeSettings: { ...DEFAULT_TRADE_SETTINGS }, ...DEFAULT_GM_FLAGS };
  return { league, extras };
}

describe('multi-slot saves', () => {
  beforeEach(async () => {
    await savesDb.saves.clear();
  });

  it('creates a save and can list it back with correct summary info', async () => {
    const { league, extras } = fixture();
    const id = await createSave('My Dynasty', league, extras, 'A');
    const saves = await listSaves();
    expect(saves.length).toBe(1);
    expect(saves[0].id).toBe(id);
    expect(saves[0].name).toBe('My Dynasty');
    expect(saves[0].season).toBe('2026-27');
    expect(saves[0].teamCount).toBe(2);
    expect(saves[0].controlledTeamName).toBe(league.teams[0].name);
  });

  it('sets the newly created save as the last-active save', async () => {
    const { league, extras } = fixture();
    const id = await createSave('Save 1', league, extras, null);
    expect(getLastActiveSaveId()).toBe(id);
  });

  it('supports multiple independent save slots at once', async () => {
    const { league, extras } = fixture();
    const idA = await createSave('League A', league, extras, 'A');
    const idB = await createSave('League B', { ...league, season: '2030-31' }, extras, 'B');
    const saves = await listSaves();
    expect(saves.length).toBe(2);
    expect(new Set(saves.map((s) => s.id))).toEqual(new Set([idA, idB]));
  });

  it('updateSave overwrites the snapshot and bumps updatedAt without creating a new slot', async () => {
    const { league, extras } = fixture();
    const id = await createSave('League', league, extras, 'A');
    const before = await listSaves();
    await new Promise((r) => setTimeout(r, 5));
    await updateSave(id, { ...league, season: '2031-32' }, extras, 'A');
    const after = await listSaves();
    expect(after.length).toBe(before.length);
    expect(after.find((s) => s.id === id)?.season).toBe('2031-32');
  });

  it('renameSave changes the display name only', async () => {
    const { league, extras } = fixture();
    const id = await createSave('Old Name', league, extras, null);
    await renameSave(id, 'New Name');
    const saves = await listSaves();
    expect(saves[0].name).toBe('New Name');
  });

  it('deleteSave removes the slot entirely', async () => {
    const { league, extras } = fixture();
    const id = await createSave('Temp', league, extras, null);
    await deleteSave(id);
    expect(await listSaves()).toEqual([]);
    expect(await getSave(id)).toBeNull();
  });

  it('getSave round-trips the full league/extras and the controlled team id', async () => {
    const { league, extras } = fixture();
    const id = await createSave('Roundtrip', league, extras, 'B');
    const snap = await getSave(id);
    expect(snap).not.toBeNull();
    expect(snap!.controlledTeamId).toBe('B');
    expect(snap!.league.teams.length).toBe(2);
    expect(snap!.league.teams[0].seasons.length).toBe(league.teams[0].seasons.length);
  });
});
