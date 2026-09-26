/// <reference lib="webworker" />
import { runBatchSimulation, type BatchSimulationRequest } from '../simulation/engine/batchSimulate';

export type WorkerInMessage = { type: 'run'; request: BatchSimulationRequest };
export type WorkerOutMessage =
  | { type: 'progress'; pct: number }
  | { type: 'done'; result: ReturnType<typeof runBatchSimulation> }
  | { type: 'error'; message: string };

self.onmessage = (e: MessageEvent<WorkerInMessage>) => {
  if (e.data.type !== 'run') return;
  try {
    const result = runBatchSimulation(e.data.request, (pct) => {
      (self as unknown as Worker).postMessage({ type: 'progress', pct } satisfies WorkerOutMessage);
    });
    (self as unknown as Worker).postMessage({ type: 'done', result } satisfies WorkerOutMessage);
  } catch (err) {
    (self as unknown as Worker).postMessage({ type: 'error', message: String(err) } satisfies WorkerOutMessage);
  }
};
