import type { CareerWorkerIn, CareerWorkerOut } from '../workers/careerWorker';
import { startEngineWorkers } from '../workers/enginePool';
import { slimRetirees, restoreRetirees } from '../history/retirees';

/** Runs one Career Mode step in the background (see careerWorker.ts). `cancel` stops it. */
export function runCareerStep(msg: Omit<CareerWorkerIn, 'ports'>, onProgress: (pct: number) => void): { done: Promise<Exclude<CareerWorkerOut, { type: 'progress' | 'error' }>>; cancel: () => void } {
  const worker = new Worker(new URL('../workers/careerWorker.ts', import.meta.url), { type: 'module' });
  const engines = startEngineWorkers();
  let settled = false;
  let rejectFn: (e: Error) => void = () => {};
  const finish = (clean: boolean) => { settled = true; worker.terminate(); if (clean) engines.release(); else engines.stop(); };
  const full = msg.league;
  const done = new Promise<Exclude<CareerWorkerOut, { type: 'progress' | 'error' }>>((resolve, reject) => {
    rejectFn = reject;
    worker.onmessage = (e: MessageEvent<CareerWorkerOut>) => {
      const m = e.data;
      if (m.type === 'progress') { onProgress(m.pct); return; }
      if (m.type === 'error') { finish(false); reject(new Error(m.message)); return; }
      finish(true);
      resolve({ ...m, league: restoreRetirees(m.league, full) });
    };
    worker.onerror = () => { finish(false); reject(new Error('The simulation stopped unexpectedly.')); };
  });
  worker.postMessage({ ...msg, league: slimRetirees(msg.league), ports: engines.ports } satisfies CareerWorkerIn, engines.ports);
  return { done, cancel: () => { if (!settled) { finish(false); rejectFn(new Error('cancelled')); } } };
}
