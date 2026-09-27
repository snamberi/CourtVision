import type { PreparedGame, SimulatedGame } from '../simulation/league';
import type { GameResult } from '../simulation/boxscore';
import type { GameEvidence } from '../simulation/playerDevelopment';
import type { PlayerSeason } from '../simulation/types';
import { runEngineJob } from './engineJob';
import { liteMode, LITE_ENGINE_WORKERS } from '../lib/performanceMode';

export interface EngineJob { id: number; input: PreparedGame['input']; pack: boolean }
export type EngineReply = { id: number; result: GameResult; evidence: GameEvidence } | { id: number; error: string };

/** The engine reads only these training fields; the rest (history, reports, badge progress) stays behind. */
function slimSeason(s: PlayerSeason): PlayerSeason {
  if (!s.training) return s;
  const { workload, familiarity, morale } = s.training;
  return { ...s, training: { workload, familiarity, morale } as PlayerSeason['training'] };
}
function slimInput(input: PreparedGame['input']): PreparedGame['input'] {
  return {
    ...input,
    home: { ...input.home, seasons: input.home.seasons.map(slimSeason) },
    away: { ...input.away, seasons: input.away.seasons.map(slimSeason) },
  };
}

/** Games each engine worker holds at once: one running, one waiting, so a worker never idles on a message round trip. */
const IN_FLIGHT = 2;

/**
 * Coordinator side of the engine pool (lives in the season or Auto Play worker). Each engine worker pulls the next
 * game as it finishes one, so a slow (still cold) worker never holds up the day. With a single engine worker (a
 * two-core machine) the coordinator plays half the games itself while it waits. Results come back in the order the
 * games were given.
 */
export class EnginePool {
  private nextId = 0;
  private pending = new Map<number, { resolve: (g: SimulatedGame) => void; reject: (e: Error) => void }>();
  private ports: MessagePort[];
  constructor(ports: MessagePort[]) {
    this.ports = ports;
    for (const port of ports) {
      port.onmessage = (e: MessageEvent<EngineReply>) => {
        const reply = e.data;
        const waiting = this.pending.get(reply.id);
        if (!waiting) return;
        this.pending.delete(reply.id);
        if ('error' in reply) waiting.reject(new Error(reply.error));
        else waiting.resolve({ result: reply.result, evidence: reply.evidence });
      };
    }
  }
  get size() { return this.ports.length; }
  /** Runs every game; `pack` stores each replay log packed (Auto Play, whose logs are never replayed, skips it). */
  async run(inputs: PreparedGame['input'][], pack: boolean): Promise<SimulatedGame[]> {
    const own = this.ports.length === 1 ? Math.floor(inputs.length / 2) : 0;
    const sent = this.dispatch(inputs.slice(own), pack);
    const mine = inputs.slice(0, own).map((input) => runEngineJob(input, pack));
    return [...mine, ...await sent];
  }
  private dispatch(inputs: PreparedGame['input'][], pack: boolean): Promise<SimulatedGame[]> {
    const results: SimulatedGame[] = new Array(inputs.length);
    let next = 0, done = 0, failed = false;
    return new Promise((resolve, reject) => {
      if (!inputs.length) { resolve(results); return; }
      const fail = (e: Error) => { if (!failed) { failed = true; reject(e); } };
      const feed = (port: MessagePort) => {
        if (failed || next >= inputs.length) return;
        const index = next++, id = this.nextId++;
        // An engine worker that dies without replying must not hang the season: give up after a minute.
        const timer = setTimeout(() => { if (this.pending.delete(id)) fail(new Error('A game engine worker stopped responding.')); }, 60_000);
        this.pending.set(id, {
          resolve: (g) => { clearTimeout(timer); results[index] = g; if (++done === inputs.length) resolve(results); else feed(port); },
          reject: (e) => { clearTimeout(timer); fail(e); },
        });
        port.postMessage({ id, input: slimInput(inputs[index]), pack } satisfies EngineJob);
      };
      for (let k = 0; k < IN_FLIGHT; k++) for (const port of this.ports) feed(port);
    });
  }
  close() { for (const port of this.ports) port.close(); }
}

/** Engine workers kept warm between runs: each new worker starts with cold, unoptimized code, so reusing them makes
 * the next "Play" much faster. They are shut down after IDLE_MS without work, or at once when a run is cancelled. */
const IDLE_MS = 120_000;
let shared: { workers: Worker[] } | null = null;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
function shutdownShared() {
  clearTimeout(idleTimer);
  shared?.workers.forEach((w) => w.terminate());
  shared = null;
}

export interface EngineWorkers {
  ports: MessagePort[];
  /** Cancel: terminate the workers so no queued game keeps running. */
  stop: () => void;
  /** The run finished cleanly: keep the workers warm for the next one. */
  release: () => void;
}

/**
 * Page side: starts engine workers and returns the ports to hand to the season or Auto Play worker. Uses one worker
 * per spare CPU core (up to 8). Returns none on single-core machines or where workers can't start; the simulation
 * then runs every game itself, exactly as before. `localStorage['cv-engine-workers']` overrides the count (0 = off).
 */
export function startEngineWorkers(): EngineWorkers {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency ?? 2 : 2;
  let count = Math.min(liteMode() ? LITE_ENGINE_WORKERS : 8, cores - 1);
  try {
    const setting = localStorage.getItem('cv-engine-workers');
    if (setting != null && setting.trim() !== '' && Number.isFinite(Number(setting))) count = Math.max(0, Math.min(16, Math.round(Number(setting))));
  } catch { /* no storage: use the default */ }
  const none: EngineWorkers = { ports: [], stop: () => {}, release: () => {} };
  if (count < 1 || typeof Worker === 'undefined' || typeof MessageChannel === 'undefined') return none;
  clearTimeout(idleTimer);
  try {
    if (shared && shared.workers.length !== count) shutdownShared();
    if (!shared) {
      const workers: Worker[] = [];
      for (let i = 0; i < count; i++) workers.push(new Worker(new URL('./gameWorker.ts', import.meta.url), { type: 'module' }));
      shared = { workers };
    }
    // A fresh channel per run; the worker drops the previous run's channel when this one arrives.
    const ports = shared.workers.map((worker) => {
      const channel = new MessageChannel();
      worker.postMessage({ type: 'port', port: channel.port1 }, [channel.port1]);
      return channel.port2;
    });
    // Only this run's workers: a stale handle must not stop or schedule a later run's.
    const mine = shared;
    return {
      ports,
      stop: () => { if (shared === mine) shutdownShared(); },
      release: () => { if (shared !== mine) return; clearTimeout(idleTimer); idleTimer = setTimeout(shutdownShared, IDLE_MS); },
    };
  } catch {
    shutdownShared();
    return none;
  }
}
