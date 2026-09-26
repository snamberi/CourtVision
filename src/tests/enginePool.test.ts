import { describe, it, expect } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import { simulateRoundPhased } from '../simulation/league';
import type { PreparedGame } from '../simulation/league';
import { EnginePool, type EngineJob, type EngineReply } from '../workers/enginePool';
import { runEngineJob } from '../workers/engineJob';

/** A stand-in engine worker on the far end of a real MessageChannel. */
function fakeWorker(): { port: MessagePort; served: () => number } {
  const channel = new MessageChannel();
  let count = 0;
  channel.port1.onmessage = (e: MessageEvent<EngineJob>) => {
    count++;
    const { id, input, pack } = e.data;
    const { result, evidence } = runEngineJob(input, pack);
    channel.port1.postMessage({ id, result, evidence: evidence! } satisfies EngineReply);
  };
  return { port: channel.port2, served: () => count };
}

describe('engine pool', () => {
  const { league } = generateFullLeague(21, 10, 12, 10, '2026');

  it('returns every game in order and matches playing them in place', async () => {
    let inputs: PreparedGame['input'][] = [];
    await simulateRoundPhased(league, 5, async (given) => { inputs = given; return given.map(i => runEngineJob(i, true)); });
    expect(inputs.length).toBeGreaterThan(2);
    const workers = [fakeWorker(), fakeWorker(), fakeWorker()];
    const pool = new EnginePool(workers.map(w => w.port));
    const pooled = await pool.run(inputs, true);
    pool.close();
    const direct = inputs.map(i => runEngineJob(i, true));
    expect(pooled.map(g => [g.result.homeScore, g.result.awayScore, g.result.packedLog])).toEqual(direct.map(g => [g.result.homeScore, g.result.awayScore, g.result.packedLog]));
    // Two or more engine workers take every game; the coordinator only waits.
    expect(workers.reduce((n, w) => n + w.served(), 0)).toBe(inputs.length);
  });
});
