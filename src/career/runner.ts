import { noteCurryHigh } from '../profile/curryAchievement';
import type { CareerWorkerIn, CareerWorkerOut } from '../workers/careerWorker';
import { startEngineWorkers } from '../workers/enginePool';
import { slimRetirees, restoreRetirees } from '../history/retirees';

// Reuse the coordinator as well as engine workers: retain compiled modules, never simulation state.
let warmWorker: Worker | null = null;
let warmTimer: ReturnType<typeof setTimeout> | undefined;
function acquireWorker() {
  if (warmWorker) { const worker = warmWorker; warmWorker = null; clearTimeout(warmTimer); return worker; }
  return new Worker(new URL('../workers/careerWorker.ts', import.meta.url), { type: 'module' });
}
function releaseWorker(worker: Worker) {
  worker.onmessage = null; worker.onerror = null;
  if (warmWorker) { worker.terminate(); return; }
  warmWorker = worker;
  warmTimer = setTimeout(() => { if (warmWorker === worker) { warmWorker = null; worker.terminate(); } }, 120000);
}

/** Runs one Career Mode step in the background (see careerWorker.ts). `cancel` stops it. */
export function runCareerStep(msg: Omit<CareerWorkerIn, 'ports'>, onProgress: (pct: number) => void): { done: Promise<Exclude<CareerWorkerOut, { type: 'progress' | 'error' }>>; cancel: () => void } {
  const worker = acquireWorker();
  const engines = startEngineWorkers();
  let settled = false;
  let rejectFn: (e: Error) => void = () => {};
  const finish = (clean: boolean) => { settled = true; if (clean) { releaseWorker(worker); engines.release(); } else { worker.terminate(); engines.stop(); } };
  const full = msg.league;
  const done = new Promise<Exclude<CareerWorkerOut, { type: 'progress' | 'error' }>>((resolve, reject) => {
    rejectFn = reject;
    worker.onmessage = (e: MessageEvent<CareerWorkerOut>) => {
      const m = e.data;
      if (m.type === 'progress') { onProgress(m.pct); return; }
      if (m.type === 'error') { finish(false); reject(new Error(m.message)); return; }
      noteCurryHigh(m.league);
      finish(true);
      resolve({ ...m, league: restoreRetirees(m.league, full) });
    };
    worker.onerror = () => { finish(false); reject(new Error('The simulation stopped unexpectedly.')); };
  });
  worker.postMessage({ ...msg, league: slimRetirees(msg.league), ports: engines.ports } satisfies CareerWorkerIn, engines.ports);
  return { done, cancel: () => { if (!settled) { finish(false); rejectFn(new Error('cancelled')); } } };
}
