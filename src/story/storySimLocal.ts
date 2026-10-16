import { autoPlayStretch, autoPlayPlayoffStep, autoPlayToDraftAsync, autoPlayFromDraft } from '../simulation/autoPlay';
import { simulateFullRound } from '../simulation/league';
import { DEFAULT_AWARD_SETTINGS } from '../simulation/awards';
import type { StorySim } from './storyNba';

/** Story Mode's league work on this thread (tests; the game runs the same steps on engine workers, see storyRunner.ts). */
export const localSim: StorySim = {
  stretch: async (w, stop, seed) => {
    const r = await autoPlayStretch(w.league, w.extras, stop, DEFAULT_AWARD_SETTINGS, seed, async (l, sd) => simulateFullRound(l, sd));
    return { ...w, league: r.league, extras: r.extras };
  },
  playoffs: async (w, teamId, seed, stopAtDecider) => ({ ...w, league: autoPlayPlayoffStep(w.league, teamId, seed, stopAtDecider) }),
  toDraft: async (w, seed) => {
    const h = await autoPlayToDraftAsync(w.league, w.extras, null, DEFAULT_AWARD_SETTINGS, seed + 1, async (l, sd) => simulateFullRound(l, sd), !!w.league.playoffBracket);
    return { ...w, league: h.league, extras: h.extras, phase: 'atDraft', partial: h.partial };
  },
  fromDraft: async (w, seed) => {
    const d = autoPlayFromDraft(w.league, w.extras, null, seed, w.partial!);
    return { world: { ...w, league: d.league, extras: d.extras, phase: 'inSeason', partial: undefined }, picks: d.draftPicks };
  },
};
