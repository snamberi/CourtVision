import { describe, it, expect, beforeEach } from 'vitest';
import { autosaveUniverse, loadAutosavedUniverse, clearAutosave } from '../storage/autosave';
import { buildDemoTeam } from '../simulation/presets/samplePlayers';
import { generateRoundRobinSchedule, type League } from '../simulation/league';
import { DEFAULT_GAME_SETTINGS } from '../simulation/types';
import { DEFAULT_CAP_SETTINGS, DEFAULT_TRADE_SETTINGS, DEFAULT_GM_FLAGS, type GMLeagueExtras } from '../simulation/gm';

function fixture() {
  const teams = ['A', 'B'].map((id) => {
    const demo = buildDemoTeam(id, id);
    return { teamId: demo.teamId, name: demo.label, seasons: demo.seasons };
  });
  const league: League = { teams, schedule: generateRoundRobinSchedule(['A', 'B'], 1), settings: { ...DEFAULT_GAME_SETTINGS } };
  const extras: GMLeagueExtras = { contracts: {}, freeAgents: [], capSettings: { ...DEFAULT_CAP_SETTINGS }, draftClass: [], tradeSettings: { ...DEFAULT_TRADE_SETTINGS }, ...DEFAULT_GM_FLAGS };
  return { league, extras };
}

describe('IndexedDB autosave', () => {
  beforeEach(async () => {
    await clearAutosave();
  });

  it('returns null when nothing has been saved yet', async () => {
    const loaded = await loadAutosavedUniverse();
    expect(loaded).toBeNull();
  });

  it('saves and reloads a universe with the same teams and rosters', async () => {
    const { league, extras } = fixture();
    await autosaveUniverse(league, extras);
    const loaded = await loadAutosavedUniverse();
    expect(loaded).not.toBeNull();
    expect(loaded!.league.teams.length).toBe(2);
    expect(loaded!.league.teams[0].seasons.length).toBe(league.teams[0].seasons.length);
  });

  it('overwrites the previous autosave rather than accumulating rows', async () => {
    const { league, extras } = fixture();
    await autosaveUniverse(league, extras);
    const league2 = { ...league, teams: league.teams.slice(0, 1) };
    await autosaveUniverse(league2, extras);
    const loaded = await loadAutosavedUniverse();
    expect(loaded!.league.teams.length).toBe(1);
  });

  it('clearAutosave removes the saved universe', async () => {
    const { league, extras } = fixture();
    await autosaveUniverse(league, extras);
    await clearAutosave();
    const loaded = await loadAutosavedUniverse();
    expect(loaded).toBeNull();
  });
});
