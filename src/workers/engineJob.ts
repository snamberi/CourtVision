import { simulateGame } from '../simulation/engine/game';
import { gameEvidence } from '../simulation/playerDevelopment';
import { packLog } from '../simulation/logPacking';
import type { PreparedGame, SimulatedGame } from '../simulation/league';

/**
 * One game as the engine workers run it: the game itself, its development evidence, and (when `pack`) the replay
 * log packed for storage. The full log never travels back, which keeps the hand-off small.
 */
export function runEngineJob(input: PreparedGame['input'], pack: boolean): SimulatedGame {
  const full = simulateGame(input);
  const evidence = gameEvidence(full);
  const result = { ...full, possessionLog: [], ...(pack && full.possessionLog.length ? { packedLog: packLog(full.possessionLog) } : {}) };
  return { result, evidence };
}
