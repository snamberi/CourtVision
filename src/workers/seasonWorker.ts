/// <reference lib="webworker" />
import { simulateFullRound, simulateRoundPhased, type League } from '../simulation/league';
import { compactLeagueLogs } from '../simulation/logPacking';
import { EnginePool } from './enginePool';

/**
 * `rounds` limits the run to that many game days (Play → 1 Week / 1 Month); omitted = rest of season.
 * `ports` connect to engine workers (see enginePool.ts): with them, each day's games run in parallel.
 */
export type SeasonWorkerInMessage = { type: 'run'; league: League; seedBase: number; rounds?: number; ports?: MessagePort[] };
export type SeasonWorkerOutMessage =
  | { type: 'progress'; pct: number; played: number; total: number }
  | { type: 'done'; league: League }
  | { type: 'blocked'; league: League } // hit a pending All-Star break - stopped early, on purpose
  | { type: 'error'; message: string };

self.onmessage = async (e: MessageEvent<SeasonWorkerInMessage>) => {
  if (e.data.type !== 'run') return;
  const pool = e.data.ports?.length ? new EnginePool(e.data.ports) : null;
  try {
    let league = e.data.league;
    const firstRound = league.schedule.find((g) => !g.played)?.round ?? 0;
    const endRound = e.data.rounds != null ? firstRound + e.data.rounds : Infinity;
    const inRange = (l: League) => l.schedule.filter((g) => !g.played && g.round < endRound).length;
    const total = inRange(league);
    const progressEvery = Math.max(1, Math.floor(total / 50));

    while (inRange(league) > 0) {
      const next = pool
        ? await simulateRoundPhased(league, e.data.seedBase, (inputs) => pool.run(inputs, true))
        : simulateFullRound(league, e.data.seedBase);
      if (next === league) {
        (self as unknown as Worker).postMessage({ type: 'blocked', league: compactLeagueLogs(league) } satisfies SeasonWorkerOutMessage);
        return;
      }
      league = compactLeagueLogs(next);
      const played = total - inRange(league);
      if (played % progressEvery === 0 || played === total) {
        (self as unknown as Worker).postMessage({
          type: 'progress', pct: Math.round((played / total) * 100), played, total,
        } satisfies SeasonWorkerOutMessage);
      }
    }

    (self as unknown as Worker).postMessage({ type: 'done', league: compactLeagueLogs(league) } satisfies SeasonWorkerOutMessage);
  } catch (err) {
    (self as unknown as Worker).postMessage({ type: 'error', message: String(err) } satisfies SeasonWorkerOutMessage);
  } finally {
    pool?.close();
  }
};
