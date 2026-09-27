/// <reference lib="webworker" />
import { autoPlayToDraftAsync, autoPlayToDraft, autoPlayFromDraft, type AutoPlayHalfSeason } from '../simulation/autoPlay';
import { simulateRoundPhased, type League } from '../simulation/league';
import { EnginePool } from './enginePool';
import { compactLeagueLogs } from '../simulation/logPacking';
import type { GMLeagueExtras } from '../simulation/gm';
import type { AwardSettings } from '../components/LeagueSettingsPage';

/*
 * Career Mode's league runs here, half a season at a time: `toDraft` plays the season up to the draft (the career then
 * steps in on the main thread), `fromDraft` runs the draft, free agency and opens the next season, optionally going
 * straight on to the next draft.
 */

export type CareerWorkerIn = {
  type: 'toDraft' | 'fromDraft';
  league: League; extras: GMLeagueExtras; seed: number; awardSettings: AwardSettings;
  partial?: AutoPlayHalfSeason; thenToDraft?: boolean; ports?: MessagePort[];
};
export type CareerWorkerOut =
  | { type: 'progress'; pct: number }
  | { type: 'atDraft'; league: League; extras: GMLeagueExtras; partial: AutoPlayHalfSeason; draftPicks?: { playerId: string; teamId: string }[] }
  | { type: 'inSeason'; league: League; extras: GMLeagueExtras; draftPicks: { playerId: string; teamId: string }[] }
  | { type: 'error'; message: string };

const post = (m: CareerWorkerOut) => (self as unknown as Worker).postMessage(m);

self.onmessage = async (e: MessageEvent<CareerWorkerIn>) => {
  const msg = e.data;
  const pool = msg.ports?.length ? new EnginePool(msg.ports) : null;
  try {
    let league = msg.league, extras = msg.extras;
    let draftPicks: { playerId: string; teamId: string }[] | undefined;
    if (msg.type === 'fromDraft') {
      const done = autoPlayFromDraft(league, extras, null, msg.seed, msg.partial!);
      league = compactLeagueLogs(done.league); extras = done.extras; draftPicks = done.draftPicks;
      if (!msg.thenToDraft) { post({ type: 'inSeason', league, extras, draftPicks }); return; }
    }
    const total = Math.max(1, league.schedule.length);
    let lastPct = -1;
    const round = async (l: League, seed: number) => {
      const next = await simulateRoundPhased(l, seed, (inputs) => pool!.run(inputs, false));
      const pct = Math.round(next.schedule.filter(g => g.played).length / total * 100);
      if (pct !== lastPct) { lastPct = pct; post({ type: 'progress', pct }); }
      return next;
    };
    const seed = msg.seed + 1;
    const half = pool ? await autoPlayToDraftAsync(league, extras, null, msg.awardSettings, seed, round) : autoPlayToDraft(league, extras, null, msg.awardSettings, seed);
    post({ type: 'atDraft', league: compactLeagueLogs(half.league), extras: half.extras, partial: half.partial, ...(draftPicks ? { draftPicks } : {}) });
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  } finally {
    pool?.close();
  }
};
