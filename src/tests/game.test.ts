import { describe, it, expect } from 'vitest';
import { simulateGame } from '../simulation/engine/game';
import { buildDemoTeam, makeGenericStarter } from '../simulation/presets/samplePlayers';
import { DEFAULT_GAME_SETTINGS } from '../simulation/types';

function withBench(team: ReturnType<typeof buildDemoTeam>) {
  return {
    ...team,
    seasons: [
      ...team.seasons,
      makeGenericStarter(`${team.teamId}-bench1`, team.teamId),
      makeGenericStarter(`${team.teamId}-bench2`, team.teamId),
      makeGenericStarter(`${team.teamId}-bench3`, team.teamId),
    ],
  };
}

describe('full game simulation (smoke test)', () => {
  it('runs a full game with plausible emergent scores and a non-empty possession log', () => {
    const home = buildDemoTeam('HOME', 'Home');
    const away = buildDemoTeam('AWAY', 'Away');
    const result = simulateGame({ home, away, settings: { ...DEFAULT_GAME_SETTINGS, seed: 42 } });

    expect(Number.isFinite(result.homeScore)).toBe(true);
    expect(Number.isFinite(result.awayScore)).toBe(true);
    expect(result.homeScore).toBeGreaterThan(40);
    expect(result.homeScore).toBeLessThan(200);
    expect(result.possessionLog.length).toBeGreaterThan(50);

    // box score points should match possession-derived score exactly (stats emerge from possessions)
    expect(result.homeBox.points).toBe(result.homeScore);
    expect(result.awayBox.points).toBe(result.awayScore);
  });

  it('same seed produces identical results (deterministic simulation)', () => {
    const home = buildDemoTeam('HOME', 'Home');
    const away = buildDemoTeam('AWAY', 'Away');
    const r1 = simulateGame({ home, away, settings: { ...DEFAULT_GAME_SETTINGS, seed: 777 } });
    const r2 = simulateGame({ home, away, settings: { ...DEFAULT_GAME_SETTINGS, seed: 777 } });
    expect(r1.homeScore).toBe(r2.homeScore);
    expect(r1.awayScore).toBe(r2.awayScore);
  });

  it('Never Turnover badge in sandbox mode drives that player\'s turnovers to zero across a full game', () => {
    const home = buildDemoTeam('HOME', 'Home');
    home.seasons[0].badges.push('never_turnover');
    const away = buildDemoTeam('AWAY', 'Away');
    const result = simulateGame({ home, away, settings: { ...DEFAULT_GAME_SETTINGS, sandboxMode: true, seed: 5 } });
    expect(result.homeBox.players[home.seasons[0].playerId].tov).toBe(0);
  });

  it('a bench-heavy roster lets an EXACT-minutes target player converge on their requested total', () => {
    let home = buildDemoTeam('HOME', 'Home');
    home.seasons[0].minutes = { mode: 'EXACT', target: 36, perQuarter: [9, 9, 9, 9] };
    home = withBench(home);
    const away = withBench(buildDemoTeam('AWAY', 'Away'));
    const result = simulateGame({ home, away, settings: { ...DEFAULT_GAME_SETTINGS, seed: 9 } });
    const starMinutes = result.homeBox.players[home.seasons[0].playerId].minutes;
    // Phase-1 scheduler works at quarter granularity (not full clock-level substitution),
    // so this checks convergence toward the target rather than an exact literal match.
    expect(starMinutes).toBeGreaterThanOrEqual(24);
    expect(starMinutes).toBeLessThanOrEqual(36);
  });
});
