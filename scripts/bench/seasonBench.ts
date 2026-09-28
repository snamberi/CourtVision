/* Season pipeline benchmark: the same steps as the season worker (seasonWorker.ts), timed per phase. */
import { generateFullLeague } from '../../src/simulation/leagueGenerator';
import { simulateRoundPhased, type League } from '../../src/simulation/league';
import { simulateGame } from '../../src/simulation/engine/game';
import { compactLeagueLogs, packResult } from '../../src/simulation/logPacking';
import { initializeCoaching } from '../../src/simulation/staffManagement';
import { ensureFrontOffice } from '../../src/simulation/frontOffice';
import { setupCup } from '../../src/simulation/cup';

const { league: generated } = generateFullLeague(11, 30, 13, 82, '2026');
// Set up like the app does when a league opens (App.tsx enterApp): coaching staff, training, front office, Cup.
const userTeam = generated.teams[0].teamId;
let league: League = ensureFrontOffice(setupCup(initializeCoaching(generated, userTeam)), userTeam);
let engineMs = 0, packMs = 0, compactMs = 0, games = 0;
const t0 = performance.now();
for (let day = 0; day < 30; day++) {
  league = await simulateRoundPhased(league, 11, async (inputs) => inputs.map(input => {
    const a = performance.now(); const result = simulateGame(input); engineMs += performance.now() - a;
    const b = performance.now(); const packed = packResult(result); packMs += performance.now() - b;
    games++; return { result: packed };
  }));
  const c = performance.now(); league = compactLeagueLogs(league); compactMs += performance.now() - c;
}
const total = performance.now() - t0;
const other = total - engineMs - packMs - compactMs;
console.log(`${games} games: total ${(total / games).toFixed(2)} ms/game = engine ${(engineMs / games).toFixed(2)} + log packing ${(packMs / games).toFixed(2)} + daily compaction ${(compactMs / games).toFixed(2)} + prepare/apply ${(other / games).toFixed(2)}`);
