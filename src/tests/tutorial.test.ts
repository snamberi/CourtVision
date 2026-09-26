import { beforeAll, describe, expect, it } from 'vitest';
import { generateFullLeague } from '../simulation/leagueGenerator';
import type { League, SeasonPhase } from '../simulation/league';
import { allStarBreakRound } from '../simulation/league';
import { GROUPS } from '../navigation/menu';
import { SIMPLE_HUBS, hubForTab } from '../tutorial/simpleNav';
import { createTutorial, markVisited, navModeOf, tutorialOf, updateTutorial } from '../tutorial/tutorialState';
import { featureStatuses, lockedFeatures, newTabs, pendingUnlockNotices } from '../tutorial/unlocks';
import { lessonStatuses } from '../tutorial/lessons';
import { seasonRoadMap } from '../tutorial/roadmap';
import { hintStep, tourSteps } from '../tutorial/guide';

let base: League;
let team: string;
beforeAll(() => {
  base = generateFullLeague(4, 30, 13, 82, '2026').league;
  team = base.teams[0].teamId;
});

const withTutorial = (league: League, patch = {}) => updateTutorial({ ...league, tutorial: createTutorial(league) }, patch);
/** Marks the first `n` games of `teamId` (in schedule order) and everything scheduled before them as played. */
function playTeamGames(league: League, teamId: string, n: number): League {
  const ordered = [...league.schedule].sort((a, b) => a.round - b.round);
  let count = 0;
  let lastRound = -1;
  for (const g of ordered) {
    if (count >= n) break;
    if (g.homeTeamId === teamId || g.awayTeamId === teamId) { count++; lastRound = g.round; }
  }
  return { ...league, schedule: league.schedule.map((g) => (g.round <= lastRound ? { ...g, played: true } : g)) };
}
const phase = (league: League, seasonPhase: SeasonPhase): League => ({ ...league, seasonPhase });
const oneSeasonLater = (league: League): League => ({ ...league, franchiseHistory: [...(league.franchiseHistory ?? []), { season: '2026' } as never] });

describe('tutorial state', () => {
  it('leaves leagues from before the tutorial on the Full menu with nothing locked', () => {
    expect(tutorialOf(base)).toBeUndefined();
    expect(navModeOf(base)).toBe('full');
    expect(lockedFeatures({ league: base, controlledTeamId: team })).toEqual([]);
    const switched = updateTutorial(base, { navMode: 'simple' });
    expect(tutorialOf(switched)).toMatchObject({ origin: 'existing', navMode: 'simple', unlockAll: true, checklistHidden: true });
    expect(tutorialOf(switched)!.tourStep).toBeUndefined();
    expect(lockedFeatures({ league: switched, controlledTeamId: team })).toEqual([]);
  });

  it('starts new leagues in Simple mode with the tour on step one, unless the tour already ran on this device', () => {
    const fresh = createTutorial(base);
    expect(fresh).toMatchObject({ origin: 'new', navMode: 'simple', unlockAll: false, tourStatus: 'new', tourStep: 0, checklistHidden: false });
    const seen = createTutorial(base, { tourSeen: 'finished', navMode: 'full' });
    expect(seen.tourStep).toBeUndefined();
    expect(seen).toMatchObject({ tourStatus: 'finished', navMode: 'full' });
  });

  it('repairs malformed stored state instead of failing', () => {
    const broken = { ...base, tutorial: { navMode: 'weird', visited: 'yourTeam', tourStep: -3, opened: [1, 'trades'] } as never };
    const t = tutorialOf(broken)!;
    expect(t).toMatchObject({ navMode: 'simple', visited: [], opened: ['trades'], tourStatus: 'new', origin: 'existing' });
    expect(t.tourStep).toBeUndefined();
  });

  it('records lesson pages once and ignores other pages', () => {
    const l = withTutorial(base);
    const visited = markVisited(l, 'yourTeam');
    expect(tutorialOf(visited)!.visited).toEqual(['yourTeam']);
    expect(markVisited(visited, 'yourTeam')).toBe(visited);
    expect(markVisited(visited, 'standings')).toBe(visited);
    expect(markVisited(base, 'yourTeam')).toBe(base); // no tutorial: nothing stored
  });

  it('clears the tour step when the tour ends', () => {
    const l = withTutorial(base);
    expect(tutorialOf(l)!.tourStep).toBe(0);
    const ended = updateTutorial(l, { tourStep: undefined, tourStatus: 'skipped' });
    expect('tourStep' in ended.tutorial!).toBe(false);
  });
});

describe('Simple menu', () => {
  it('keeps every page of the Full menu under exactly one hub', () => {
    const fullTabs = new Set(GROUPS.flatMap((g) => g.items.map((i) => i.tab)));
    for (const tab of fullTabs) expect(hubForTab(tab), tab).not.toBeNull();
    const counts = new Map<string, number>();
    for (const hub of SIMPLE_HUBS) for (const item of new Set(hub.items.map((i) => i.tab))) counts.set(item, (counts.get(item) ?? 0) + 1);
    for (const [tab, n] of counts) expect(n, tab).toBe(1);
  });
});

describe('unlocks', () => {
  const locks = (league: League, opts: { offers?: number } = {}) => lockedFeatures({ league, controlledTeamId: team, pendingTradeOffers: opts.offers ?? 0 }).map((s) => s.feature.id);

  it('opens trades after 5 games, development after 10, the draft at the All-Star break, the rest after the first season', () => {
    const l = withTutorial(base);
    expect(locks(l)).toEqual(['trades', 'development', 'draft', 'staff', 'sandbox']);
    expect(locks(playTeamGames(l, team, 4))).toContain('trades');
    expect(locks(playTeamGames(l, team, 5))).toEqual(['development', 'draft', 'staff', 'sandbox']);
    expect(locks(playTeamGames(l, team, 10))).toEqual(['draft', 'staff', 'sandbox']);
    expect(locks(phase(playTeamGames(l, team, 40), 'all_star'))).toEqual(['staff', 'sandbox']);
    const done = { ...playTeamGames(l, team, 50), allStarWeekend: { season: l.season ?? '', completed: true } };
    expect(locks(done)).toEqual(['staff', 'sandbox']);
    expect(locks(phase(oneSeasonLater(l), 'draft'))).toEqual([]);
  });

  it('opens trades early when a team sends an offer, and opens everything for the offseason phases that need it', () => {
    const l = withTutorial(base);
    expect(locks(l, { offers: 1 })).not.toContain('trades');
    expect(locks(phase(l, 'draft'))).toEqual(['staff', 'sandbox']);
  });

  it('shows progress toward each lock', () => {
    const l = withTutorial(playTeamGames(base, team, 3));
    const trades = lockedFeatures({ league: l, controlledTeamId: team }).find((s) => s.feature.id === 'trades')!;
    expect(trades).toMatchObject({ when: 'after 5 games', progress: '3 / 5 games' });
  });

  it('uses halfway through the season for the draft when the All-Star break is off', () => {
    const l = withTutorial({ ...base, rulesSettings: { ...base.rulesSettings!, allStarEnabled: false } });
    const draft = lockedFeatures({ league: l, controlledTeamId: team }).find((s) => s.feature.id === 'draft')!;
    expect(draft.when).toBe('halfway through the season');
    expect(locks(playTeamGames(l, team, 41))).not.toContain('draft');
  });

  it('locks nothing in Full mode, after "unlock everything", or without a team', () => {
    expect(locks(withTutorial(base, { navMode: 'full' }))).toEqual([]);
    expect(locks(withTutorial(base, { unlockAll: true }))).toEqual([]);
    expect(lockedFeatures({ league: withTutorial(base), controlledTeamId: null })).toEqual([]);
  });

  it('announces each newly opened tool once and tags it NEW until opened', () => {
    const l = withTutorial(playTeamGames(base, team, 5));
    const ctx = { league: l, controlledTeamId: team };
    expect(pendingUnlockNotices(ctx).map((f) => f.id)).toEqual(['trades']);
    expect([...newTabs(ctx)]).toEqual(['trade']);
    const seen = updateTutorial(l, { seenUnlocks: ['trades'] });
    expect(pendingUnlockNotices({ league: seen, controlledTeamId: team })).toEqual([]);
    expect([...newTabs({ league: seen, controlledTeamId: team })]).toEqual(['trade']);
    const opened = updateTutorial(seen, { opened: ['trades'] });
    expect(newTabs({ league: opened, controlledTeamId: team }).size).toBe(0);
  });

  it('never re-locks a tool once the first season is over', () => {
    const t = createTutorial(base);
    const later = { ...oneSeasonLater(base), tutorial: t };
    expect(featureStatuses({ league: phase(later, 'regular_season'), controlledTeamId: team }, t).every((s) => s.unlocked)).toBe(true);
  });
});

describe('first-season checklist', () => {
  const done = (league: League) => lessonStatuses({ league, controlledTeamId: team }).filter((s) => s.done).map((s) => s.lesson.id);

  it('ticks lessons off from what actually happened in the league', () => {
    let l = withTutorial(base);
    expect(done(l)).toEqual(['team']);
    l = playTeamGames(l, team, 1);
    expect(done(l)).toEqual(['team', 'firstGame']);
    l = markVisited(markVisited(l, 'yourTeam'), 'trade');
    expect(done(l)).toEqual(['team', 'firstGame', 'rotation', 'trade']);
    l = updateTutorial(l, { tourStatus: 'finished' });
    expect(done(l)).toContain('tour');
    expect(done({ ...l, schedule: l.schedule.map((g) => ({ ...g, played: true })) })).toContain('finishSeason');
    l = phase(l, 'playoffs');
    expect(done(l)).toContain('finishSeason');
    l = phase(oneSeasonLater(l), 'draft');
    expect(done(l)).not.toContain('draft');
    l = phase(l, 'resign_waive');
    expect(done(l)).toContain('draft');
    expect(done(l)).toContain('firstGame'); // stays done in the new season, before a game is played
  });

  it('shows when a locked lesson opens instead of a Go button', () => {
    const statuses = lessonStatuses({ league: withTutorial(base), controlledTeamId: team });
    expect(statuses.find((s) => s.lesson.id === 'trade')!.lockedUntil).toBe('Unlocks after 5 games');
    expect(statuses.find((s) => s.lesson.id === 'development')!.lockedUntil).toBe('Unlocks after 10 games');
    expect(statuses.find((s) => s.lesson.id === 'rotation')!.lockedUntil).toBeUndefined();
    const full = lessonStatuses({ league: withTutorial(base, { navMode: 'full' }), controlledTeamId: team });
    expect(full.every((s) => !s.lockedUntil)).toBe(true);
  });

  it('is empty for leagues without tutorial state', () => {
    expect(lessonStatuses({ league: base, controlledTeamId: team })).toEqual([]);
  });
});

describe('season road map', () => {
  let opts: { controlledTeamId: string; autoAllStar: boolean };
  beforeAll(() => { opts = { controlledTeamId: team, autoAllStar: true }; });
  const statusOf = (league: League, id: string) => seasonRoadMap(league, opts).stops.find((s) => s.id === id)?.status;

  it('marks the regular season as current with the All-Star break next, and counts games to it', () => {
    const l = playTeamGames(base, team, 10);
    const map = seasonRoadMap(l, opts);
    expect(map.stops.map((s) => s.id)).toEqual(['preseason', 'regular', 'allStar', 'deadline', 'playoffs', 'awards', 'draft', 'resign', 'freeAgency']);
    expect(statusOf(l, 'preseason')).toBe('done');
    expect(statusOf(l, 'regular')).toBe('current');
    expect(statusOf(l, 'allStar')).toBe('next');
    const breakRound = allStarBreakRound(l)!;
    const toBreak = l.schedule.filter((g) => !g.played && g.round < breakRound && (g.homeTeamId === team || g.awayTeamId === team)).length;
    expect(map.stops.find((s) => s.id === 'allStar')!.note).toBe(`in ${toBreak} games`);
    expect(map.stops.find((s) => s.id === 'regular')!.note).toBe('10 / 82 games');
    expect(map.next!.title).toBe('All-Star weekend');
    expect(map.next!.text).toContain('plays automatically');
    expect(seasonRoadMap(l, { ...opts, autoAllStar: false }).next!.text).toContain('stops at the break');
  });

  it('moves on to the trade deadline after the weekend, then to the playoffs after the deadline', () => {
    const afterBreak = { ...playTeamGames(base, team, 50), allStarWeekend: { season: base.season ?? '', completed: true } };
    expect(statusOf(afterBreak, 'allStar')).toBe('done');
    expect(statusOf(afterBreak, 'deadline')).toBe('next');
    const pastDeadline = { ...playTeamGames(base, team, 60), allStarWeekend: { season: base.season ?? '', completed: true } };
    expect(statusOf(pastDeadline, 'deadline')).toBe('done');
    expect(statusOf(pastDeadline, 'playoffs')).toBe('next');
    expect(seasonRoadMap(pastDeadline, opts).now.points.join(' ')).toContain('trade deadline has passed');
    expect(seasonRoadMap(pastDeadline, opts).now.actions.map((a) => a.tab)).not.toContain('trade');
  });

  it('follows the league phase through the offseason', () => {
    expect(statusOf(phase(base, 'all_star'), 'allStar')).toBe('current');
    expect(statusOf(phase(base, 'draft'), 'playoffs')).toBe('done');
    expect(statusOf(phase(base, 'draft'), 'draft')).toBe('current');
    expect(statusOf(phase(base, 'draft'), 'resign')).toBe('next');
    const pre = seasonRoadMap(phase(base, 'preseason'), opts);
    expect(pre.stops[0]).toMatchObject({ id: 'preseason', status: 'current' });
    expect(pre.stops.slice(1).every((s) => s.status !== 'done')).toBe(true);
  });

  it('puts the trade deadline first when the rules hold it before the All-Star break', () => {
    const l = { ...base, settings: { ...base.settings, tradeDeadlinePct: 0.3 } };
    expect(seasonRoadMap(l, opts).stops.map((s) => s.id).slice(1, 4)).toEqual(['regular', 'deadline', 'allStar']);
  });

  it('drops the All-Star stop when the weekend is turned off', () => {
    const l = { ...base, rulesSettings: { ...base.rulesSettings!, allStarEnabled: false } };
    expect(seasonRoadMap(l, opts).stops.map((s) => s.id)).not.toContain('allStar');
  });

  it('fills the progress bar further as the season goes', () => {
    const fills = [0, 20, 60, 82].map((n) => seasonRoadMap(playTeamGames(base, team, n), opts).fill);
    for (let i = 1; i < fills.length; i++) expect(fills[i]).toBeGreaterThan(fills[i - 1]);
    expect(seasonRoadMap(phase(base, 'free_agency'), opts).fill).toBe(1);
  });

  it('never offers an action for a page that is still locked', () => {
    const map = seasonRoadMap(base, { ...opts, lockedTabs: new Set(['trade']) });
    expect(map.now.actions.map((a) => a.tab)).not.toContain('trade');
    expect(map.now.points.join(' ')).toContain('unlock after your first five games');
  });
});

describe('coach guide text', () => {
  it('has eight tour stops that name the team and adapt to the menu', () => {
    const simple = tourSteps({ teamName: 'Golden State', navMode: 'simple', hasLocks: true });
    expect(simple).toHaveLength(8);
    expect(simple[0].body).toContain('You run Golden State now.');
    expect(simple.find((s) => s.id === 'frontOffice')!.body).toContain('unlock as the season goes');
    const full = tourSteps({ teamName: null, navMode: 'full', hasLocks: false });
    expect(full.find((s) => s.id === 'myTeam')!.title).toBe('Team');
    expect(full.find((s) => s.id === 'frontOffice')!.body).not.toContain('unlock');
  });

  it('points every lesson hint at something on screen', () => {
    for (const id of ['play', 'rotation', 'development', 'trade', 'finishSeason', 'draft'] as const) expect(hintStep(id).targets.length).toBeGreaterThan(0);
  });
});
