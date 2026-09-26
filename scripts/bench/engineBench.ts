/* Engine benchmark: `npm run bench` bundles and runs this with Node.
 * Prints ms per game for the engine alone and for full league simulation (engine + bookkeeping),
 * plus a checksum of the results so optimizations can be checked for identical output. */
import { generateFullLeague } from '../../src/simulation/leagueGenerator';
import { simulateRemainingSeason } from '../../src/simulation/league';
import { simulateGame } from '../../src/simulation/engine/game';

const { league } = generateFullLeague(11, 30, 13, 20, '2026');
let checksum = 0;
const t1 = performance.now();
const N = 300;
for (let i = 0; i < N; i++) {
  const r = simulateGame({ home: league.teams[i % 30], away: league.teams[(i + 7) % 30], settings: { ...league.settings, seed: i } });
  checksum = (checksum * 31 + r.homeScore * 1000 + r.awayScore) % 1_000_000_007;
}
const engine = (performance.now() - t1) / N;
const t0 = performance.now();
const played = simulateRemainingSeason(league, 11);
const games = played.schedule.filter(g => g.played).length;
const season = (performance.now() - t0) / games;
for (const g of played.schedule) if (g.result) checksum = (checksum * 31 + g.result.homeScore * 1000 + g.result.awayScore) % 1_000_000_007;
console.log(`engine only: ${engine.toFixed(2)} ms/game | season sim: ${season.toFixed(2)} ms/game (${games} games) | checksum ${checksum}`);
