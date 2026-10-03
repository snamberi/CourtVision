import { useEffect, useRef, useState } from 'react';
import type { TeamInput } from '../simulation/engine/game';
import type { GameSettings } from '../simulation/types';
import type { BatchSimulationResult } from '../simulation/engine/batchSimulate';
import type { WorkerOutMessage } from '../workers/simulationWorker';
import { statWhole } from './statFormat';

interface Props {
  home: TeamInput;
  away: TeamInput;
  settings: GameSettings;
  focusPlayerId: string;
}

export function SimulationLab({ home, away, settings, focusPlayerId }: Props) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BatchSimulationResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const run = (n: number) => {
    setRunning(true);
    setProgress(0);
    setError(null);
    setResult(null);

    workerRef.current?.terminate();
    const worker = new Worker(new URL('../workers/simulationWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
      const msg = e.data;
      if (msg.type === 'progress') setProgress(msg.pct);
      else if (msg.type === 'done') { setResult(msg.result); setRunning(false); }
      else if (msg.type === 'error') { setError(msg.message); setRunning(false); }
    };
    worker.onerror = (e) => { setError(e.message); setRunning(false); };

    worker.postMessage({ type: 'run', request: { home, away, settings, games: n, focusPlayerId, seedBase: settings.seed ?? 1 } });
  };

  return (
    <div className="sim-lab">
      <h4>Simulation Lab — {focusPlayerId}</h4>
      <p className="hint-text">Runs happen in a Web Worker, so even 10,000 games never freezes the UI.</p>
      <div className="sim-lab-buttons">
        <button disabled={running} onClick={() => run(1)}>Simulate 1</button>
        <button disabled={running} onClick={() => run(100)}>Simulate 100</button>
        <button disabled={running} onClick={() => run(1000)}>Simulate 1,000</button>
        <button disabled={running} onClick={() => run(10000)}>Simulate 10,000</button>
      </div>
      {running && <div className="progress">Running… {progress}%</div>}
      {error && <p className="hint-text" style={{ color: 'var(--miss)' }}>{error}</p>}
      {result && (
        <>
          <table className="sim-lab-results">
            <tbody>
              <tr><td>Games</td><td>{result.games}</td></tr>
              <tr><td>PPG</td><td>{statWhole(result.ppg)}</td></tr>
              <tr><td>RPG</td><td>{statWhole(result.rpg)}</td></tr>
              <tr><td>APG</td><td>{statWhole(result.apg)}</td></tr>
              <tr><td>SPG</td><td>{result.spg.toFixed(2)}</td></tr>
              <tr><td>BPG</td><td>{result.bpg.toFixed(2)}</td></tr>
              <tr><td>FG%</td><td>{(result.fgPct * 100).toFixed(1)}</td></tr>
              <tr><td>3P%</td><td>{(result.tpPct * 100).toFixed(1)}</td></tr>
              <tr><td>3PA</td><td>{result.tpa.toFixed(1)}</td></tr>
              <tr><td>TOV</td><td>{result.tov.toFixed(1)}</td></tr>
              <tr><td>TS%</td><td>{(result.tsPct * 100).toFixed(1)}</td></tr>
              <tr><td>Team Win%</td><td>{(result.teamWinPct * 100).toFixed(1)}</td></tr>
            </tbody>
          </table>
          <h4>On/Off Impact</h4>
          <table className="sim-lab-results">
            <tbody>
              <tr><td>Net pts/100 poss, ON</td><td>{(result.onOff.netPointsPerPossessionOn * 100).toFixed(1)}</td></tr>
              <tr><td>Net pts/100 poss, OFF</td><td>{(result.onOff.netPointsPerPossessionOff * 100).toFixed(1)}</td></tr>
              <tr><td>On/Off Swing</td><td>{((result.onOff.netPointsPerPossessionOn - result.onOff.netPointsPerPossessionOff) * 100).toFixed(1)}</td></tr>
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
