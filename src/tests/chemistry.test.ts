import { describe, it, expect } from 'vitest';
import { buildDemoTeam } from '../simulation/presets/samplePlayers';
import { runBatchSimulation } from '../simulation/engine/batchSimulate';
import { DEFAULT_GAME_SETTINGS } from '../simulation/types';

describe('team chemistry', () => {
  it('a high-chemistry team produces fewer turnovers for its focus player than an identical low-chemistry team', () => {
    const homeHighChem = { ...buildDemoTeam('HOME', 'Home'), chemistry: 95 };
    const homeLowChem = { ...buildDemoTeam('HOME', 'Home'), chemistry: 10 };
    const away = buildDemoTeam('AWAY', 'Away');

    const highResult = runBatchSimulation({
      home: homeHighChem, away, settings: { ...DEFAULT_GAME_SETTINGS, teamChemistryEnabled: true },
      games: 120, focusPlayerId: homeHighChem.seasons[0].playerId, seedBase: 1,
    });
    const lowResult = runBatchSimulation({
      home: homeLowChem, away, settings: { ...DEFAULT_GAME_SETTINGS, teamChemistryEnabled: true },
      games: 120, focusPlayerId: homeLowChem.seasons[0].playerId, seedBase: 1,
    });

    expect(highResult.tov).toBeLessThan(lowResult.tov);
  }, 15000);

  it('disabling team chemistry makes high vs low chemistry produce identical results', () => {
    const homeHighChem = { ...buildDemoTeam('HOME', 'Home'), chemistry: 95 };
    const homeLowChem = { ...buildDemoTeam('HOME', 'Home'), chemistry: 10 };
    const away = buildDemoTeam('AWAY', 'Away');

    const highResult = runBatchSimulation({
      home: homeHighChem, away, settings: { ...DEFAULT_GAME_SETTINGS, teamChemistryEnabled: false },
      games: 10, focusPlayerId: homeHighChem.seasons[0].playerId, seedBase: 5,
    });
    const lowResult = runBatchSimulation({
      home: homeLowChem, away, settings: { ...DEFAULT_GAME_SETTINGS, teamChemistryEnabled: false },
      games: 10, focusPlayerId: homeLowChem.seasons[0].playerId, seedBase: 5,
    });

    expect(highResult.tov).toBe(lowResult.tov);
  });
});
