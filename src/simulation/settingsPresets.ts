import type { GameSettings } from './types';
import { DEFAULT_GAME_SETTINGS, REALISTIC_ERA_MODERN } from './types';

export const SETTINGS_PRESETS: Record<string, GameSettings> = {
  Realistic: { ...DEFAULT_GAME_SETTINGS, era: REALISTIC_ERA_MODERN, pacePreset: 'realistic', shootingVariance: 0.35, sandboxMode: false },
  Balanced: { ...DEFAULT_GAME_SETTINGS, pacePreset: 'balanced', shootingVariance: 0.5, sandboxMode: true },
  Arcade: { ...DEFAULT_GAME_SETTINGS, pacePreset: 'arcade', shootingVariance: 0.7, turnoverFrequencyMultiplier: 0.6, sandboxMode: true },
  Chaos: { ...DEFAULT_GAME_SETTINGS, pacePreset: 'chaos', shootingVariance: 1.0, turnoverFrequencyMultiplier: 1.5, foulFrequency: 1.6, sandboxMode: true },
  Simulation: { ...DEFAULT_GAME_SETTINGS, pacePreset: 'simulation', shootingVariance: 0.3, sandboxMode: false, fatigueEnabled: true },
};

export type PresetName = keyof typeof SETTINGS_PRESETS;
