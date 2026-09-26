/// <reference lib="webworker" />
import { runEngineJob } from './engineJob';
import type { EngineJob, EngineReply } from './enginePool';

/**
 * One engine worker of the pool. It receives a MessagePort from the page and runs the games the season or Auto Play
 * worker sends over it (see enginePool.ts).
 */
let current: MessagePort | null = null;
function serve(port: MessagePort) {
  // One run at a time: a new run's channel replaces the last one.
  current?.close();
  current = port;
  port.onmessage = (e: MessageEvent<EngineJob>) => {
    const { id, input, pack } = e.data;
    try {
      const { result, evidence } = runEngineJob(input, pack);
      port.postMessage({ id, result, evidence: evidence! } satisfies EngineReply);
    } catch (err) {
      port.postMessage({ id, error: String(err) } satisfies EngineReply);
    }
  };
}

self.onmessage = (e: MessageEvent<{ type: 'port'; port: MessagePort }>) => {
  if (e.data?.type === 'port') serve(e.data.port);
};
