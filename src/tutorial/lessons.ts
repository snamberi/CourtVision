import type { League, SeasonPhase } from '../simulation/league';
import { seasonsCompleted, teamGamesPlayed, tutorialOf, type TutorialState } from './tutorialState';
import { lockedFeatures, type FeatureId, type UnlockContext } from './unlocks';

export type HintId = 'play' | 'rotation' | 'development' | 'trade' | 'finishSeason' | 'draft';

export interface Lesson {
  id: string;
  title: string;
  /** Shown under the title of the lesson that's up next. */
  detail: string;
  /** The tool that must be unlocked before the Go button appears. */
  feature?: FeatureId;
  /** What Go does: start the tour, or open a page and point at what to press. */
  go: { tour: true } | { tab: string; hint: HintId };
  done: (league: League, t: TutorialState, teamId: string | null) => boolean;
}

const AFTER_REGULAR_SEASON: SeasonPhase[] = ['playoffs', 'awards_recap'];

export const LESSONS: Lesson[] = [
  {
    id: 'team', title: 'Choose your team', detail: 'Done when you picked a franchise.',
    go: { tab: 'yourTeam', hint: 'rotation' },
    done: (_l, _t, teamId) => !!teamId,
  },
  {
    id: 'tour', title: "Take the coach's tour", detail: 'Eight quick stops around the game.',
    go: { tour: true },
    done: (_l, t) => t.tourStatus === 'finished',
  },
  {
    id: 'firstGame', title: 'Play your first game', detail: 'Press Play, then 1 Game or Watch Next Game.',
    go: { tab: 'dashboard', hint: 'play' },
    done: (l, t, teamId) => seasonsCompleted(l, t) >= 1 || teamGamesPlayed(l, teamId) >= 1,
  },
  {
    id: 'rotation', title: 'Look over your rotation', detail: 'The top five on My Team › Rotation start.',
    go: { tab: 'yourTeam', hint: 'rotation' },
    done: (_l, t) => t.visited.includes('yourTeam'),
  },
  {
    id: 'development', title: 'Check on player development', detail: 'Practice, plans and projects for each player.', feature: 'development',
    go: { tab: 'development', hint: 'development' },
    done: (_l, t) => t.visited.includes('development') || t.visited.includes('playerDevelopment'),
  },
  {
    id: 'trade', title: 'Look for a trade', detail: 'Build an offer on Front Office › Trade.', feature: 'trades',
    go: { tab: 'trade', hint: 'trade' },
    done: (_l, t) => t.visited.includes('trade'),
  },
  {
    id: 'finishSeason', title: 'Finish the regular season', detail: 'Keep pressing Play. Rest of Season sims every game left.',
    go: { tab: 'dashboard', hint: 'finishSeason' },
    done: (l, t) => seasonsCompleted(l, t) >= 1 || AFTER_REGULAR_SEASON.includes(l.seasonPhase ?? 'regular_season')
      || ((l.seasonPhase ?? 'regular_season') === 'regular_season' && l.schedule.length > 0 && l.schedule.every((g) => g.played)),
  },
  {
    id: 'draft', title: 'Draft your first rookie', detail: 'Scout the class, then pick on draft night.', feature: 'draft',
    go: { tab: 'draft', hint: 'draft' },
    done: (l, t) => seasonsCompleted(l, t) >= 2 || (seasonsCompleted(l, t) >= 1 && (l.seasonPhase ?? 'regular_season') !== 'draft'),
  },
];

export interface LessonStatus {
  lesson: Lesson;
  done: boolean;
  /** Set while the lesson's tool is still locked in Simple mode, e.g. "Unlocks after 5 games". */
  lockedUntil?: string;
}

export function lessonStatuses(ctx: UnlockContext): LessonStatus[] {
  const t = tutorialOf(ctx.league);
  if (!t) return [];
  const locked = new Map(lockedFeatures(ctx).map((s) => [s.feature.id, s.when]));
  return LESSONS.map((lesson) => {
    const done = lesson.done(ctx.league, t, ctx.controlledTeamId);
    const when = !done && lesson.feature ? locked.get(lesson.feature) : undefined;
    return { lesson, done, ...(when ? { lockedUntil: `Unlocks ${when}` } : {}) };
  });
}
