import { describe, it, expect } from 'vitest';
import { buildSnapshot, parseUniverseFile } from '../storage/universeIO';
import { buildDemoTeam } from '../simulation/presets/samplePlayers';
import { generateRoundRobinSchedule, type League } from '../simulation/league';
import { DEFAULT_GAME_SETTINGS } from '../simulation/types';
import { DEFAULT_CAP_SETTINGS, DEFAULT_TRADE_SETTINGS, DEFAULT_GM_FLAGS, type GMLeagueExtras } from '../simulation/gm';

function fixture() {
  const teams = ['A', 'B'].map((id) => {
    const demo = buildDemoTeam(id, id);
    return { teamId: id, name: id, seasons: demo.seasons };
  });
  const league: League = { teams, schedule: generateRoundRobinSchedule(['A', 'B'], 1), settings: { ...DEFAULT_GAME_SETTINGS } };
  const extras: GMLeagueExtras = { contracts: {}, freeAgents: [], capSettings: { ...DEFAULT_CAP_SETTINGS }, draftClass: [], tradeSettings: { ...DEFAULT_TRADE_SETTINGS }, ...DEFAULT_GM_FLAGS };
  return { league, extras };
}

describe('universe export/import', () => {
  it('round-trips a league + GM extras through JSON without losing data', () => {
    const { league, extras } = fixture();
    const snapshot = buildSnapshot(league, extras);
    const text = JSON.stringify(snapshot);
    const parsed = parseUniverseFile(text);
    expect(parsed.league.teams.length).toBe(league.teams.length);
    expect(parsed.league.teams[0].seasons.length).toBe(league.teams[0].seasons.length);
    expect(parsed.extras.capSettings.salaryCap).toBe(extras.capSettings.salaryCap);
    expect(parsed.schemaVersion).toBe(snapshot.schemaVersion);
  });

  it('rejects structurally invalid files instead of silently accepting garbage', () => {
    expect(() => parseUniverseFile(JSON.stringify({ notAUniverse: true }))).toThrow();
    expect(() => parseUniverseFile('not even json')).toThrow();
  });
});
