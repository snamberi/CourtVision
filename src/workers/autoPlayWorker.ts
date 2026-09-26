/// <reference lib="webworker" />
import { autoPlayOneSeason, autoPlayOneSeasonAsync, type AutoPlaySeasonSummary } from '../simulation/autoPlay';
import { simulateRoundPhased, type League } from '../simulation/league';
import { EnginePool } from './enginePool';
import { compactLeagueLogs } from '../simulation/logPacking';
import type { GMLeagueExtras } from '../simulation/gm';
import type { AwardSettings } from '../components/LeagueSettingsPage';

export type AutoPlayWorkerInMessage = {
  type: 'run';
  league: League;
  extras: GMLeagueExtras;
  controlledTeamId: string | null;
  awardSettings: AwardSettings;
  years: number;
  seedBase: number;
  /** Engine workers (see enginePool.ts): with them, each day's games run in parallel. */
  ports?: MessagePort[];
};
export type AutoPlayWorkerOutMessage =
  | { type: 'yearComplete'; yearIndex: number; totalYears: number; league: League; extras: GMLeagueExtras; summary: AutoPlaySeasonSummary }
  | { type: 'done'; league: League; extras: GMLeagueExtras; summaries: AutoPlaySeasonSummary[] }
  | { type: 'error'; message: string; league: League; extras: GMLeagueExtras };

self.onmessage = async (e: MessageEvent<AutoPlayWorkerInMessage>) => {
  if (e.data.type !== 'run') return;
  const { controlledTeamId, awardSettings, years, seedBase } = e.data;
  const pool = e.data.ports?.length ? new EnginePool(e.data.ports) : null;
  // Auto-played games are never replayed (the season rolls over), so their logs aren't packed or kept.
  const round = (l: League, seed: number) => simulateRoundPhased(l, seed, (inputs) => pool!.run(inputs, false));
  let league = e.data.league;
  let extras = e.data.extras;
  const summaries: AutoPlaySeasonSummary[] = [];
  try {
    for (let year = 0; year < years; year++) {
      const seed = seedBase + year * 100_000;
      const result = pool
        ? await autoPlayOneSeasonAsync(league, extras, controlledTeamId, awardSettings, seed, round)
        : autoPlayOneSeason(league, extras, controlledTeamId, awardSettings, seed);
      league = compactLeagueLogs(result.league);
      extras = result.extras;
      summaries.push(result.summary);
      (self as unknown as Worker).postMessage({
        type: 'yearComplete', yearIndex: year + 1, totalYears: years, league: compactLeagueLogs(league), extras, summary: result.summary,
      } satisfies AutoPlayWorkerOutMessage);
      // Fired: stop here so you choose your next job yourself.
      if (league.frontOffice?.status === 'unemployed') break;
    }
    (self as unknown as Worker).postMessage({ type: 'done', league: compactLeagueLogs(league), extras, summaries } satisfies AutoPlayWorkerOutMessage);
  } catch (err) {
    (self as unknown as Worker).postMessage({ type: 'error', message: String(err), league: compactLeagueLogs(league), extras } satisfies AutoPlayWorkerOutMessage);
  } finally {
    pool?.close();
  }
};
