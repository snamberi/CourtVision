import type { League, SeasonPhase } from '../simulation/league';
import { allStarBreakRound } from '../simulation/league';
import { seasonsCompleted, teamGamesPlayed, tutorialOf, type TutorialState } from './tutorialState';

export type FeatureId = 'trades' | 'development' | 'draft' | 'staff' | 'sandbox';

export interface Feature {
  id: FeatureId;
  label: string;
  /** Pages this tool adds to the Simple menu. */
  tabs: string[];
  /** The page "Show me" opens. */
  home: string;
  /** Body of the "Unlocked" notice. */
  notice: string;
}

export const FEATURES: Feature[] = [
  {
    id: 'trades', label: 'Trades & free agents', tabs: ['trade', 'tradeOffers', 'tradeBlock', 'freeAgency'], home: 'trade',
    notice: 'You can now trade with the other teams and sign free agents from Front Office. Trades stay open until the trade deadline.',
  },
  {
    id: 'development', label: 'Player development', tabs: ['development'], home: 'development',
    notice: 'Set practice, development plans and long-term projects for your players. Age, potential, minutes and coaching all shape how they grow.',
  },
  {
    id: 'draft', label: 'Scouting & draft', tabs: ['draft', 'watchList'], home: 'draft',
    notice: "Next summer's draft class is ready to scout. Study the prospects and add the ones you like to your watch list before draft night.",
  },
  {
    id: 'staff', label: 'Staff & finances', tabs: ['staff', 'finances'], home: 'finances',
    notice: 'Hire coaches and staff, and follow your revenue, payroll and profit.',
  },
  {
    id: 'sandbox', label: 'Sandbox tools', tabs: ['sandbox', 'bulk', 'fastEdit', 'code', 'lab', 'imports'], home: 'sandbox',
    notice: 'Edit players and teams, import data and run the Simulation Lab. Turning on Sandbox Mode makes the whole league editable.',
  },
];

const OFFSEASON: SeasonPhase[] = ['playoffs', 'awards_recap', 'draft', 'resign_waive', 'free_agency', 'preseason'];

export interface UnlockContext {
  league: League;
  controlledTeamId: string | null;
  pendingTradeOffers?: number;
}

export interface FeatureStatus {
  feature: Feature;
  unlocked: boolean;
  /** When it opens, e.g. "after 5 games". */
  when: string;
  /** Progress toward it, e.g. "2 / 5 games". */
  progress?: string;
}

function allStarReached(league: League): boolean {
  const phase = league.seasonPhase ?? 'regular_season';
  if (phase === 'all_star') return true;
  return league.allStarWeekend?.season === (league.season ?? '') && league.allStarWeekend.completed === true;
}

export function featureStatuses(ctx: UnlockContext, t: TutorialState): FeatureStatus[] {
  const { league, controlledTeamId } = ctx;
  const phase = league.seasonPhase ?? 'regular_season';
  const played = teamGamesPlayed(league, controlledTeamId);
  const pastFirst = seasonsCompleted(league, t) >= 1;
  const offseason = OFFSEASON.includes(phase);
  const games = (n: number) => ({ when: `after ${n} games`, progress: `${Math.min(played, n)} / ${n} games` });
  const allStarOn = allStarBreakRound(league) != null;
  const halfway = Math.ceil(league.schedule.filter((g) => g.homeTeamId === controlledTeamId || g.awayTeamId === controlledTeamId).length / 2);
  return FEATURES.map((feature): FeatureStatus => {
    switch (feature.id) {
      case 'trades':
        return { feature, unlocked: pastFirst || offseason || played >= 5 || (ctx.pendingTradeOffers ?? 0) > 0, ...games(5) };
      case 'development':
        return { feature, unlocked: pastFirst || offseason || played >= 10, ...games(10) };
      case 'draft':
        return allStarOn
          ? { feature, unlocked: pastFirst || offseason || allStarReached(league), when: 'at the All-Star break' }
          : { feature, unlocked: pastFirst || offseason || played >= halfway, when: 'halfway through the season', progress: `${Math.min(played, halfway)} / ${halfway} games` };
      default:
        return { feature, unlocked: pastFirst, when: 'after your first season' };
    }
  });
}

/** Tools still hidden from the Simple menu. Empty in Full mode, with "unlock everything", or without a team to run. */
export function lockedFeatures(ctx: UnlockContext): FeatureStatus[] {
  const t = tutorialOf(ctx.league);
  if (!t || t.navMode !== 'simple' || t.unlockAll || !ctx.controlledTeamId) return [];
  return featureStatuses(ctx, t).filter((s) => !s.unlocked);
}

/** Tools unlocked by play whose notice hasn't been answered yet, oldest first. */
export function pendingUnlockNotices(ctx: UnlockContext): Feature[] {
  const t = tutorialOf(ctx.league);
  if (!t || t.navMode !== 'simple' || t.unlockAll || !ctx.controlledTeamId) return [];
  return featureStatuses(ctx, t).filter((s) => s.unlocked && !t.seenUnlocks.includes(s.feature.id)).map((s) => s.feature);
}

/** Pages that carry a NEW tag in the Simple menu: unlocked by play but not opened yet. */
export function newTabs(ctx: UnlockContext): Set<string> {
  const t = tutorialOf(ctx.league);
  if (!t || t.navMode !== 'simple' || t.unlockAll || !ctx.controlledTeamId) return new Set();
  const tabs = featureStatuses(ctx, t).filter((s) => s.unlocked && !t.opened.includes(s.feature.id)).map((s) => s.feature.home);
  return new Set(tabs);
}

export function featureForTab(tab: string): Feature | undefined {
  return FEATURES.find((f) => f.tabs.includes(tab));
}
