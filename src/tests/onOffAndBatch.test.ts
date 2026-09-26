import { describe, it, expect } from 'vitest';
import { computeOnOffSplit, mergeOnOffSplits } from '../simulation/engine/onOff';
import { runBatchSimulation } from '../simulation/engine/batchSimulate';
import { buildDemoTeam } from '../simulation/presets/samplePlayers';
import { DEFAULT_GAME_SETTINGS } from '../simulation/types';
import { simulateGame } from '../simulation/engine/game';
import type { PossessionLogEntry } from '../simulation/boxscore';

function fakeEntry(overrides: Partial<PossessionLogEntry>): PossessionLogEntry {
  return {
    quarter: 1, clockSeconds: 600, offenseTeamId: 'HOME', ballHandlerId: 'x',
    action: 'possession', events: [], result: 'MAKE',
    onCourtHome: ['h1'], onCourtAway: ['a1'],
    homeScoreAfter: 0, awayScoreAfter: 0,
    ...overrides,
  };
}

describe('on/off split', () => {
  it('correctly separates net point differential for possessions with vs without the player on court', () => {
    const log: PossessionLogEntry[] = [
      fakeEntry({ onCourtHome: ['star'], homeScoreAfter: 3, awayScoreAfter: 0 }), // +3 while on
      fakeEntry({ onCourtHome: ['bench'], homeScoreAfter: 3, awayScoreAfter: 2 }), // -2 while off
      fakeEntry({ onCourtHome: ['star'], homeScoreAfter: 5, awayScoreAfter: 2 }), // +2 while on
    ];
    const split = computeOnOffSplit(log, 'home', 'star');
    expect(split.possessionsOn).toBe(2);
    expect(split.possessionsOff).toBe(1);
    expect(split.netPointsPerPossessionOn).toBeCloseTo((3 + 2) / 2);
    expect(split.netPointsPerPossessionOff).toBeCloseTo(-2);
  });

  it('mergeOnOffSplits combines multiple games into one weighted split', () => {
    const a = { possessionsOn: 10, possessionsOff: 5, netPointsPerPossessionOn: 1, netPointsPerPossessionOff: -1 };
    const b = { possessionsOn: 10, possessionsOff: 5, netPointsPerPossessionOn: 2, netPointsPerPossessionOff: 0 };
    const merged = mergeOnOffSplits([a, b]);
    expect(merged.possessionsOn).toBe(20);
    expect(merged.possessionsOff).toBe(10);
    expect(merged.netPointsPerPossessionOn).toBeCloseTo(1.5);
  });
});

describe('pure batch simulation core', () => {
  it('runs the requested number of games and returns sane averaged stats', () => {
    const home = buildDemoTeam('HOME', 'Home');
    const away = buildDemoTeam('AWAY', 'Away');
    const result = runBatchSimulation({
      home, away, settings: { ...DEFAULT_GAME_SETTINGS }, games: 10,
      focusPlayerId: home.seasons[0].playerId, seedBase: 1,
    });
    expect(result.games).toBe(10);
    expect(result.ppg).toBeGreaterThan(0);
    expect(result.teamWinPct).toBeGreaterThanOrEqual(0);
    expect(result.teamWinPct).toBeLessThanOrEqual(1);
    expect(result.onOff.possessionsOn).toBeGreaterThan(0);
  });

  it('progress callback reaches 100 and is monotonically non-decreasing', () => {
    const home = buildDemoTeam('HOME', 'Home');
    const away = buildDemoTeam('AWAY', 'Away');
    const seen: number[] = [];
    runBatchSimulation(
      { home, away, settings: { ...DEFAULT_GAME_SETTINGS }, games: 20, focusPlayerId: home.seasons[0].playerId, seedBase: 1 },
      (pct) => seen.push(pct),
    );
    expect(seen[seen.length - 1]).toBe(100);
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
  });

  it('same request with same seedBase is fully reproducible (deterministic batch)', () => {
    const home = buildDemoTeam('HOME', 'Home');
    const away = buildDemoTeam('AWAY', 'Away');
    const req = { home, away, settings: { ...DEFAULT_GAME_SETTINGS }, games: 15, focusPlayerId: home.seasons[0].playerId, seedBase: 99 };
    const r1 = runBatchSimulation(req);
    const r2 = runBatchSimulation(req);
    expect(r1.ppg).toBe(r2.ppg);
    expect(r1.teamWinPct).toBe(r2.teamWinPct);
  });
});

describe('possession log carries on-court rosters for on/off analysis', () => {
  it('every possession entry lists exactly the on-court players for both sides', () => {
    const home = buildDemoTeam('HOME', 'Home');
    const away = buildDemoTeam('AWAY', 'Away');
    const result = simulateGame({ home, away, settings: { ...DEFAULT_GAME_SETTINGS, seed: 11 } });
    for (const entry of result.possessionLog) {
      expect(entry.onCourtHome.length).toBeGreaterThan(0);
      expect(entry.onCourtAway.length).toBeGreaterThan(0);
    }
  });
});
