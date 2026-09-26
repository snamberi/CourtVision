import type { League } from '../simulation/league';

/** Simple shows five places to go and unlocks tools as the season goes; Full is the complete menu. */
export type NavMode = 'simple' | 'full';
export type TourStatus = 'new' | 'finished' | 'skipped';

/**
 * Per-league tutorial progress. Stored on the league so it travels with saves, backups and exports.
 * Leagues without it (every league made before the tutorial existed) behave exactly as before: Full menu,
 * nothing locked, no tour.
 */
export interface TutorialState {
  version: 1;
  /** 'new': made with the league, so lessons are offered. 'existing': added later to a league the player already knows. */
  origin: 'new' | 'existing';
  navMode: NavMode;
  /** "I know the game": Simple mode shows every tool straight away. */
  unlockAll: boolean;
  /** Completed seasons when this league's tutorial began, so "your first season" survives rollovers. */
  startHistory: number;
  tourStatus: TourStatus;
  /** The walkthrough step on screen; absent when the tour is not running. */
  tourStep?: number;
  checklistHidden: boolean;
  /** Pages a lesson asks the player to open. */
  visited: string[];
  /** Unlocked tools whose "Unlocked" notice has been answered. */
  seenUnlocks: string[];
  /** Unlocked tools opened from the menu, which clears their NEW tag. */
  opened: string[];
}

/** Pages whose first visit completes a lesson. */
export const TRACKED_VISITS = new Set(['yourTeam', 'development', 'playerDevelopment', 'trade']);

const TOUR_SEEN_KEY = 'cv-tour-seen';
const NAV_MODE_KEY = 'cv-nav-mode';

/** How the tour ended in an earlier league on this device, if it ever ran. */
export function readTourSeen(): TourStatus | null {
  try {
    const v = localStorage.getItem(TOUR_SEEN_KEY);
    return v === 'finished' || v === 'skipped' ? v : null;
  } catch { return null; }
}
export function rememberTourSeen(status: 'finished' | 'skipped'): void {
  try {
    // A finished tour is never downgraded to skipped by a later skip.
    if (status === 'skipped' && readTourSeen() === 'finished') return;
    localStorage.setItem(TOUR_SEEN_KEY, status);
  } catch { /* the tour just offers itself again next time */ }
}
/** The menu the player last chose, used for their next new league. */
export function readPreferredNavMode(): NavMode {
  try { return localStorage.getItem(NAV_MODE_KEY) === 'full' ? 'full' : 'simple'; } catch { return 'simple'; }
}
export function rememberNavMode(mode: NavMode): void {
  try { localStorage.setItem(NAV_MODE_KEY, mode); } catch { /* the in-league choice still applies */ }
}

/** Tutorial state for a league the player is starting now. */
export function createTutorial(league: League, options: { tourSeen?: TourStatus | null; navMode?: NavMode } = {}): TutorialState {
  const tourSeen = options.tourSeen ?? null;
  return {
    version: 1,
    origin: 'new',
    navMode: options.navMode ?? 'simple',
    unlockAll: false,
    startHistory: league.franchiseHistory?.length ?? 0,
    tourStatus: tourSeen ?? 'new',
    ...(tourSeen ? {} : { tourStep: 0 }),
    checklistHidden: false,
    visited: [],
    seenUnlocks: [],
    opened: [],
  };
}

/** A league from before the tutorial existed: the player already knows it, so nothing is locked or auto-shown. */
export function legacyTutorial(league: League): TutorialState {
  return {
    version: 1,
    origin: 'existing',
    navMode: 'full',
    unlockAll: true,
    startHistory: league.franchiseHistory?.length ?? 0,
    tourStatus: 'skipped',
    checklistHidden: true,
    visited: [],
    seenUnlocks: [],
    opened: [],
  };
}

/** Reads the stored state, repairing anything missing or malformed (imported files, hand-edited saves). */
export function tutorialOf(league: League): TutorialState | undefined {
  const t = league.tutorial;
  if (!t || typeof t !== 'object') return undefined;
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  return {
    version: 1,
    origin: t.origin === 'new' ? 'new' : 'existing',
    navMode: t.navMode === 'full' ? 'full' : 'simple',
    unlockAll: t.unlockAll === true,
    startHistory: Number.isFinite(t.startHistory) ? Math.max(0, t.startHistory) : league.franchiseHistory?.length ?? 0,
    tourStatus: t.tourStatus === 'finished' || t.tourStatus === 'skipped' ? t.tourStatus : 'new',
    ...(Number.isInteger(t.tourStep) && (t.tourStep ?? -1) >= 0 ? { tourStep: t.tourStep } : {}),
    checklistHidden: t.checklistHidden === true,
    visited: list(t.visited),
    seenUnlocks: list(t.seenUnlocks),
    opened: list(t.opened),
  };
}

export function navModeOf(league: League): NavMode {
  return tutorialOf(league)?.navMode ?? 'full';
}

/** Applies a change, creating legacy state first for leagues that have none. */
export function updateTutorial(league: League, patch: Partial<TutorialState> | ((t: TutorialState) => Partial<TutorialState>)): League {
  const current = tutorialOf(league) ?? legacyTutorial(league);
  const changes = typeof patch === 'function' ? patch(current) : patch;
  const next: TutorialState = { ...current, ...changes };
  if (next.tourStep === undefined) delete next.tourStep;
  return { ...league, tutorial: next };
}

/** Records the first visit to a lesson page. Returns the same league object when nothing changes. */
export function markVisited(league: League, tab: string): League {
  const t = tutorialOf(league);
  if (!t || !TRACKED_VISITS.has(tab) || t.visited.includes(tab)) return league;
  return updateTutorial(league, { visited: [...t.visited, tab] });
}

/** Seasons finished since the tutorial began (0 during the first season, 1 from the first draft on). */
export function seasonsCompleted(league: League, t: TutorialState): number {
  return Math.max(0, (league.franchiseHistory?.length ?? 0) - t.startHistory);
}

/** Regular-season (or current-schedule) games the team has played. */
export function teamGamesPlayed(league: League, teamId: string | null): number {
  if (!teamId) return 0;
  return league.schedule.filter((g) => g.played && (g.homeTeamId === teamId || g.awayTeamId === teamId)).length;
}
