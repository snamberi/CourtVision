import type { PreparedGame, SimulatedGame } from '../simulation/league';
import type { GameResult } from '../simulation/boxscore';
import type { GameEvidence } from '../simulation/playerDevelopment';
import type { PlayerSeason } from '../simulation/types';
import { runEngineJob } from './engineJob';

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

/**
 * Coordinator side of the engine pool (lives in the season or Auto Play worker). Games are dealt round-robin to the
 * engine workers behind `ports`, and the coordinator plays its own share while it waits, so a two-core machine with
 * one engine worker still runs two games at a time. Results come back in the order the games were given.
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
    const own = Math.floor(inputs.length / (this.ports.length + 1));
    const sent = this.dispatch(inputs.slice(own), pack);
    const mine = inputs.slice(0, own).map((input) => runEngineJob(input, pack));
    return [...mine, ...await sent];
  }
  private dispatch(inputs: PreparedGame['input'][], pack: boolean): Promise<SimulatedGame[]> {
    return Promise.all(inputs.map((input) => new Promise<SimulatedGame>((resolve, reject) => {
      const id = this.nextId++;
      // An engine worker that dies without replying must not hang the season: give up after a minute.
      const timer = setTimeout(() => { if (this.pending.delete(id)) reject(new Error('A game engine worker stopped responding.')); }, 60_000);
      this.pending.set(id, { resolve: (g) => { clearTimeout(timer); resolve(g); }, reject: (e) => { clearTimeout(timer); reject(e); } });
      this.ports[id % this.ports.length].postMessage({ id, input: slimInput(input), pack } satisfies EngineJob);
    })));
  }
  close() { for (const port of this.ports) port.close(); }
}

/**
 * Page side: starts engine workers and returns the ports to hand to the season or Auto Play worker. Uses one worker
 * per spare CPU core (up to 8). Returns none on single-core machines or where workers can't start; the simulation
 * then runs every game itself, exactly as before. `localStorage['cv-engine-workers']` overrides the count (0 = off).
 */
export function startEngineWorkers(): { ports: MessagePort[]; stop: () => void } {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency ?? 2 : 2;
  let count = Math.min(8, cores - 1);
  try {
    const setting = localStorage.getItem('cv-engine-workers');
    if (setting != null && setting.trim() !== '' && Number.isFinite(Number(setting))) count = Math.max(0, Math.min(16, Math.round(Number(setting))));
  } catch { /* no storage: use the default */ }
  const workers: Worker[] = [];
  const ports: MessagePort[] = [];
  const stop = () => { for (const w of workers) w.terminate(); };
  if (count < 1 || typeof Worker === 'undefined' || typeof MessageChannel === 'undefined') return { ports, stop };
  try {
    for (let i = 0; i < count; i++) {
      const worker = new Worker(new URL('./gameWorker.ts', import.meta.url), { type: 'module' });
      const channel = new MessageChannel();
      worker.postMessage({ type: 'port', port: channel.port1 }, [channel.port1]);
      workers.push(worker);
      ports.push(channel.port2);
    }
  } catch {
    stop();
    return { ports: [], stop: () => {} };
  }
  return { ports, stop };
}
