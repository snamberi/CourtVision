import type { SeasonPhase } from '../simulation/league';

export type HubId = 'home' | 'myTeam' | 'frontOffice' | 'league' | 'history' | 'settings';

export interface SimpleNavItem {
  label: string;
  tab: string;
  leagueSettingsSub?: 'awards' | 'rules';
  requiresControlledTeam?: boolean;
  requiresHistorical?: boolean;
  onlyDuringPhase?: SeasonPhase;
  /** Sandbox editing tools only appear while Sandbox Mode is on. */
  sandboxOnly?: boolean;
}

export interface SimpleHub {
  id: HubId;
  label: string;
  icon: string;
  /** One line under the hub name on the Settings card and in the tour. */
  blurb: string;
  items: SimpleNavItem[];
}

/**
 * Simple mode's five places to go (plus Settings & tools). Nothing is removed: every page in the Full menu
 * sits under exactly one hub.
 */
export const SIMPLE_HUBS: SimpleHub[] = [
  {
    id: 'home', label: 'Home', icon: 'court', blurb: 'next game, road map, news',
    items: [
      { label: 'Home', tab: 'dashboard' },
      { label: 'Preseason', tab: 'preseason', onlyDuringPhase: 'preseason' },
      { label: 'News', tab: 'news' },
      { label: 'Press room', tab: 'press' },
      { label: 'Schedule', tab: 'schedule' },
      { label: 'Daily schedule', tab: 'dailySchedule' },
    ],
  },
  {
    id: 'myTeam', label: 'My Team', icon: 'team', blurb: 'roster, rotation, development',
    items: [
      { label: 'Rotation', tab: 'yourTeam', requiresControlledTeam: true },
      { label: 'Roster', tab: 'roster' },
      { label: 'Coaching', tab: 'coaching' },
      { label: 'Development', tab: 'development' },
      { label: 'Injuries', tab: 'injuries' },
      { label: 'Staff', tab: 'staff' },
      { label: 'Finances', tab: 'finances' },
      { label: 'Team history', tab: 'teamHistory' },
    ],
  },
  {
    id: 'frontOffice', label: 'Front Office', icon: 'trade', blurb: 'trades, free agents, draft',
    items: [
      { label: 'Trade', tab: 'trade' },
      { label: 'Trade offers', tab: 'tradeOffers' },
      { label: 'Trading block', tab: 'tradeBlock' },
      { label: 'Deadline Day', tab: 'deadline' },
      { label: 'Free agents', tab: 'freeAgency' },
      { label: 'Re-sign / waive', tab: 'resignWaive', onlyDuringPhase: 'resign_waive' },
      { label: 'Draft', tab: 'draft' },
      { label: 'Summer League', tab: 'summerLeague' },
      { label: 'Watch list', tab: 'watchList' },
      { label: 'Compare players', tab: 'compare' },
      { label: 'GM Office', tab: 'gmOffice' },
    ],
  },
  {
    id: 'league', label: 'League', icon: 'chart', blurb: 'standings, playoffs, stats, awards',
    items: [
      { label: 'Standings', tab: 'standings' },
      { label: 'Playoffs', tab: 'playoffs' },
      { label: 'Cup', tab: 'cup' },
      { label: 'All-Star', tab: 'allStarWeekend' },
      { label: 'Power rankings', tab: 'powerRankings' },
      { label: 'League leaders', tab: 'analytics' },
      { label: 'Player stats', tab: 'playerStats' },
      { label: 'Player ratings', tab: 'database' },
      { label: 'Team stats', tab: 'teamStats' },
      { label: 'Award races', tab: 'awards' },
      { label: 'Year in review', tab: 'yearInReview' },
      { label: 'Transactions', tab: 'transactions' },
    ],
  },
  {
    id: 'history', label: 'History', icon: 'trophy', blurb: 'almanac, records, Hall of Fame',
    items: [
      { label: 'League history', tab: 'history' },
      { label: 'Almanac', tab: 'almanac' },
      { label: 'Records', tab: 'records' },
      { label: 'Hall of Fame', tab: 'hallOfFame' },
      { label: 'NBA History', tab: 'nbaArchive', requiresHistorical: true },
      { label: 'Legend teams', tab: 'legends' },
    ],
  },
  {
    id: 'settings', label: 'Settings & tools', icon: 'settings', blurb: 'saves, rules, lessons',
    items: [
      { label: 'Settings & saves', tab: 'settings' },
      { label: 'League rules', tab: 'leagueSettings', leagueSettingsSub: 'rules' },
      { label: 'Award formulas', tab: 'leagueSettings', leagueSettingsSub: 'awards' },
      { label: 'Auto Play', tab: 'autoPlay' },
      { label: 'Sandbox Mode', tab: 'sandbox' },
      { label: 'God Mode', tab: 'bulk', sandboxOnly: true },
      { label: 'Fast Edit', tab: 'fastEdit', sandboxOnly: true },
      { label: 'Code Mode', tab: 'code', sandboxOnly: true },
      { label: 'Simulation Lab', tab: 'lab', sandboxOnly: true },
      { label: 'Import / Export', tab: 'imports', sandboxOnly: true },
    ],
  },
];

/** The hub a page belongs to; pages outside the menu (a player, a box score) belong to none. */
export function hubForTab(tab: string): HubId | null {
  return SIMPLE_HUBS.find((h) => h.items.some((i) => i.tab === tab))?.id ?? null;
}
