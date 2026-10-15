import { runCareerStep } from '../career/runner';
import type { CareerWorkerIn } from '../workers/careerWorker';
import { DEFAULT_AWARD_SETTINGS } from '../simulation/awards';
import { saveStory } from './story';
import type { NbaRun, StorySim } from './storyNba';
import { loadStoryWorld, saveStoryWorld, type StoryWorld } from './storyStorage';

/*
 * Story Mode's league work in the game: today's NBA is built and its season before the draft played while you are
 * still on the road (so draft night is ready when you get there), and every step of the NBA years runs on the engine
 * workers. A step saves the story and the league when it lands, even if the screen was closed in the meantime, and
 * only one step runs at a time.
 */

export const storyWorldId = (seed: number) => `story-${seed}`;

type Msg = Omit<CareerWorkerIn, 'ports' | 'awardSettings'>;
/** The league's work on engine workers (Career Mode's worker), reporting progress. */
export function workerSim(onProgress: (pct: number) => void): StorySim {
  const run = (msg: Msg) => runCareerStep({ ...msg, awardSettings: DEFAULT_AWARD_SETTINGS }, onProgress).done;
  const unexpected = () => new Error('The league stopped in an unexpected place.');
  return {
    async stretch(w, stop, seed) {
      const r = await run({ type: 'stretch', league: w.league, extras: w.extras, seed, stop });
      if (r.type !== 'stretched') throw unexpected();
      return { ...w, league: r.league, extras: r.extras };
    },
    async playoffs(w, teamId, seed, stopAtDecider) {
      const r = await run({ type: 'playoffs', league: w.league, extras: w.extras, seed, teamId, stopAtDecider });
      if (r.type !== 'stretched') throw unexpected();
      return { ...w, league: r.league, extras: r.extras };
    },
    async toDraft(w, seed) {
      const r = await run({ type: 'toDraft', league: w.league, extras: w.extras, seed, continueBracket: !!w.league.playoffBracket });
      if (r.type !== 'atDraft') throw unexpected();
      return { ...w, league: r.league, extras: r.extras, phase: 'atDraft', partial: r.partial };
    },
    async fromDraft(w, seed) {
      const r = await run({ type: 'fromDraft', league: w.league, extras: w.extras, seed, partial: w.partial });
      if (r.type !== 'inSeason') throw unexpected();
      return { world: { ...w, league: r.league, extras: r.extras, phase: 'inSeason', partial: undefined }, picks: r.draftPicks };
    },
  };
}

// ---------------------------------------------------------------- what is running

export interface StoryStatus { label: string; pct: number | null }
let status: StoryStatus | null = null;
const listeners = new Set<(s: StoryStatus | null) => void>();
const setStatus = (s: StoryStatus | null) => { status = s; listeners.forEach(f => f(s)); };
export const storyStatus = () => status;
export function onStoryStatus(f: (s: StoryStatus | null) => void): () => void { listeners.add(f); return () => { listeners.delete(f); }; }

let inFlight: Promise<NbaRun> | null = null;
/** The step running now, if any (a screen opened mid-step waits for it). */
export const storyStepRunning = () => inFlight;

/** Runs one step of the NBA years; the story and the league are saved when it lands. */
export function runStoryStep(label: string, step: (sim: StorySim) => Promise<NbaRun>): Promise<NbaRun> {
  if (inFlight) return inFlight;
  setStatus({ label, pct: null });
  const sim = workerSim(pct => setStatus({ label, pct }));
  const p = step(sim).then(async r => { saveStory(r.s); await saveStoryWorld(r.world); return r; });
  inFlight = p;
  p.finally(() => { if (inFlight === p) { inFlight = null; setStatus(null); } }).catch(() => {});
  return p;
}

// ---------------------------------------------------------------- the league, built ahead of draft night

const preparing = new Map<string, Promise<StoryWorld>>();
let prepPct: number | null = null;
export const leaguePrepPct = () => prepPct;

/** Today's NBA, stopped at its draft: from the story database, or built now (once per story, in the background). */
export function prepareStoryLeague(seed: number): Promise<StoryWorld> {
  const id = storyWorldId(seed);
  let p = preparing.get(id);
  if (!p) {
    p = (async () => {
      const saved = await loadStoryWorld(id);
      if (saved) return saved;
      prepPct = 0;
      const [{ loadNbaHistory }, { buildHistoricalLeague }, { initializeCoaching }] = await Promise.all([
        import('../history/nbaHistoryData'), import('../history/historicalLeague'), import('../simulation/staffManagement'),
      ]);
      const h = await loadNbaHistory();
      const built = buildHistoricalLeague(h, h.manifest.coverage.seasons[1] - 1, { realDevelopment: false, difficulty: 'normal', seed });
      const fresh: StoryWorld = { id, league: initializeCoaching(built.league, null), extras: built.extras, phase: 'inSeason' };
      const world = await workerSim(pct => { prepPct = pct; }).toDraft(fresh, seed);
      await saveStoryWorld(world);
      return world;
    })().finally(() => { prepPct = null; });
    p.catch(() => preparing.delete(id));
    preparing.set(id, p);
  }
  return p;
}
