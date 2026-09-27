import { useCallback, useEffect, useRef, useState } from 'react';
import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import type { AwardSettings } from '../components/LeagueSettingsPage';
import type { AutoPlaySeasonSummary } from '../simulation/autoPlay';
import type { AutoPlayWorkerOutMessage } from './autoPlayWorker';
import type { SeasonWorkerOutMessage } from './seasonWorker';
import { startEngineWorkers } from './enginePool';
import { createProgressStore } from './progressStore';
import { restoreRetirees, slimRetirees } from '../history/retirees';

export interface AutoPlayLogRow { season: string; summary: AutoPlaySeasonSummary }
export interface AutoPlayProgress { year: number; total: number }
export interface SeasonSimProgress { pct: number; played: number; total: number }

export interface AutoPlayStartArgs {
  league: League;
  extras: GMLeagueExtras;
  controlledTeamId: string | null;
  awardSettings: AwardSettings;
  years: number;
  seedBase: number;
}

interface Handlers {
  /** Called every time Auto Play lands a season (and once more at the end) so the app's live state tracks the worker. */
  onAutoPlayLeague: (league: League, extras: GMLeagueExtras) => void;
  /** Called with the finished (or All-Star-break-paused) league from "Simulate Remaining Season". */
  onSeasonSimLeague: (league: League) => void;
  onToast: (message: string, tone?: 'info' | 'success' | 'error') => void;
  /** Optional async step before Auto Play starts (historical leagues load upcoming real draft classes here). */
  prepareAutoPlay?: (args: AutoPlayStartArgs) => Promise<AutoPlayStartArgs>;
}

/**
 * Owns the two long-running background workers (Auto Play multiple seasons, and "Simulate Remaining
 * Season") at the App level rather than inside the page components that start them. Because App
 * never unmounts while a league is open, switching tabs no longer kills a run mid-way — the
 * worker keeps going and its results keep flowing into the app's state.
 *
 * Only one job can run at a time: both write the whole league back when they land, so letting two
 * run together would have one silently overwrite the other.
 */
export function useBackgroundJobs(handlers: Handlers) {
  const handlersRef = useRef(handlers);
  useEffect(() => { handlersRef.current = handlers; });

  const autoPlayWorker = useRef<Worker | null>(null);
  const seasonWorker = useRef<Worker | null>(null);
  // Stops the engine workers that belong to the run in progress.
  const autoPlayEngines = useRef<() => void>(() => {});
  const seasonEngines = useRef<() => void>(() => {});

  const [autoPlayRunning, setAutoPlayRunning] = useState(false);
  const [autoPlayProgress, setAutoPlayProgress] = useState<AutoPlayProgress | null>(null);
  const [autoPlayLog, setAutoPlayLog] = useState<AutoPlayLogRow[]>([]);
  const [seasonSimRunning, setSeasonSimRunning] = useState(false);
  const [seasonSimProgress] = useState(() => createProgressStore<SeasonSimProgress>());

  const busy = autoPlayRunning || seasonSimRunning;

  // Bumped by cancel/reset so a run still in its async prepare step never starts afterwards.
  const autoPlayToken = useRef(0);
  const cancelAutoPlay = useCallback(() => {
    autoPlayToken.current++;
    autoPlayWorker.current?.terminate();
    autoPlayWorker.current = null;
    autoPlayEngines.current();
    setAutoPlayRunning(false);
  }, []);

  const cancelSeasonSim = useCallback(() => {
    seasonWorker.current?.terminate();
    seasonWorker.current = null;
    seasonEngines.current();
    setSeasonSimRunning(false);
  }, []);

  const launchAutoPlay = useCallback((args: AutoPlayStartArgs) => {
    if (autoPlayWorker.current || seasonWorker.current) return;
    const worker = new Worker(new URL('./autoPlayWorker.ts', import.meta.url), { type: 'module' });
    // Retirees loaded from NBA history stay here (thousands of careers the simulation never reads) and are put back after.
    const full = args.league;
    const engines = startEngineWorkers();
    autoPlayWorker.current = worker;
    autoPlayEngines.current = engines.stop;
    // A clean finish keeps the engine workers warm for the next run; errors shut them down.
    const finish = (clean = false) => {
      if (autoPlayWorker.current === worker) autoPlayWorker.current = null;
      worker.terminate();
      if (clean) engines.release(); else engines.stop();
      setAutoPlayRunning(false);
    };

    worker.onmessage = (e: MessageEvent<AutoPlayWorkerOutMessage>) => {
      const msg = e.data;
      if (msg.type === 'yearComplete') {
        setAutoPlayProgress({ year: msg.yearIndex, total: msg.totalYears });
        setAutoPlayLog((l) => [{ season: msg.summary.season, summary: msg.summary }, ...l]);
        handlersRef.current.onAutoPlayLeague(restoreRetirees(msg.league, full), msg.extras);
      } else if (msg.type === 'done') {
        handlersRef.current.onAutoPlayLeague(restoreRetirees(msg.league, full), msg.extras);
        handlersRef.current.onToast(`Auto Play finished — ${msg.summaries.length} season${msg.summaries.length === 1 ? '' : 's'} simulated.`, 'success');
        finish(true);
      } else if (msg.type === 'error') {
        handlersRef.current.onAutoPlayLeague(restoreRetirees(msg.league, full), msg.extras);
        handlersRef.current.onToast(`Auto Play stopped early: ${msg.message}`, 'error');
        finish();
      }
    };
    worker.onerror = () => {
      handlersRef.current.onToast('Auto Play stopped unexpectedly.', 'error');
      finish();
    };

    worker.postMessage({
      type: 'run', league: slimRetirees(args.league), extras: args.extras, controlledTeamId: args.controlledTeamId,
      awardSettings: args.awardSettings, years: args.years, seedBase: args.seedBase, ports: engines.ports,
    }, engines.ports);
  }, []);

  const startAutoPlay = useCallback((args: AutoPlayStartArgs) => {
    if (autoPlayWorker.current || seasonWorker.current) return;
    setAutoPlayRunning(true);
    setAutoPlayLog([]);
    setAutoPlayProgress({ year: 0, total: args.years });
    const token = ++autoPlayToken.current;
    const prepare = handlersRef.current.prepareAutoPlay;
    if (!prepare) { launchAutoPlay(args); return; }
    prepare(args).catch(() => args).then(ready => { if (autoPlayToken.current === token) launchAutoPlay(ready); });
  }, [launchAutoPlay]);

  const startSeasonSim = useCallback((league: League, seedBase: number, rounds?: number) => {
    if (autoPlayWorker.current || seasonWorker.current) return;
    const first = league.schedule.find((g) => !g.played)?.round ?? 0;
    const total = league.schedule.filter((g) => !g.played && (rounds == null || g.round < first + rounds)).length;
    if (total === 0) return;
    setSeasonSimRunning(true);
    seasonSimProgress.set({ pct: 0, played: 0, total });

    const worker = new Worker(new URL('./seasonWorker.ts', import.meta.url), { type: 'module' });
    const full = league;
    const engines = startEngineWorkers();
    seasonWorker.current = worker;
    seasonEngines.current = engines.stop;
    const finish = (clean = false) => {
      if (seasonWorker.current === worker) seasonWorker.current = null;
      worker.terminate();
      if (clean) engines.release(); else engines.stop();
      setSeasonSimRunning(false);
    };

    worker.onmessage = (e: MessageEvent<SeasonWorkerOutMessage>) => {
      const msg = e.data;
      if (msg.type === 'progress') {
        seasonSimProgress.set({ pct: msg.pct, played: msg.played, total: msg.total });
      } else if (msg.type === 'done') {
        handlersRef.current.onSeasonSimLeague(restoreRetirees(msg.league, full));
        handlersRef.current.onToast(rounds == null ? 'Season simulation finished.' : `Simulated ${total} games.`, 'success');
        finish(true);
      } else if (msg.type === 'blocked') {
        handlersRef.current.onSeasonSimLeague(restoreRetirees(msg.league, full));
        finish(true);
      } else if (msg.type === 'error') {
        handlersRef.current.onToast(`Season simulation failed: ${msg.message}`, 'error');
        finish();
      }
    };
    worker.onerror = () => {
      handlersRef.current.onToast('Season simulation stopped unexpectedly.', 'error');
      finish();
    };

    worker.postMessage({ type: 'run', league: slimRetirees(league), seedBase, rounds, ports: engines.ports }, engines.ports);
  }, [seasonSimProgress]);

  /** Stops whatever is running and forgets the Auto Play history — used when a different league is loaded or the app returns to the menu. */
  const resetAll = useCallback(() => {
    autoPlayToken.current++;
    autoPlayWorker.current?.terminate();
    seasonWorker.current?.terminate();
    autoPlayEngines.current();
    seasonEngines.current();
    autoPlayWorker.current = null;
    seasonWorker.current = null;
    setAutoPlayRunning(false);
    setSeasonSimRunning(false);
    setAutoPlayProgress(null);
    seasonSimProgress.set(null);
    setAutoPlayLog([]);
  }, [seasonSimProgress]);

  // Only when the whole App goes away (not on tab switches) do we tear the workers down.
  useEffect(() => () => {
    autoPlayWorker.current?.terminate();
    seasonWorker.current?.terminate();
    autoPlayEngines.current();
    seasonEngines.current();
  }, []);

  return {
    busy,
    autoPlay: { running: autoPlayRunning, progress: autoPlayProgress, log: autoPlayLog, start: startAutoPlay, cancel: cancelAutoPlay },
    seasonSim: { running: seasonSimRunning, progress: seasonSimProgress, start: startSeasonSim, cancel: cancelSeasonSim },
    resetAll,
  };
}
