import type { SeasonPhase } from '../simulation/league';

export type LeagueSettingsSub = 'awards' | 'rules';

export interface NavItem {
  label: string;
  tab: string;
  leagueSettingsSub?: LeagueSettingsSub;
  /** Shown as a small count badge next to the label when > 0 (e.g. pending trade offers). */
  badgeCount?: number;
  /** Only shown when the user controls a team (e.g. "Your Team"). */
  requiresControlledTeam?: boolean;
  /** Only shown during a specific season phase (e.g. Resign/Waive only during that window). */
  onlyDuringPhase?: SeasonPhase;
  /** Only shown in leagues started from the built-in NBA history. */
  requiresHistorical?: boolean;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const GROUPS: NavGroup[] = [
  {
    title: 'League',
    items: [
      { label: 'Dashboard', tab: 'dashboard' },
      { label: 'Standings', tab: 'standings' },
      { label: 'Playoffs', tab: 'playoffs' },
      { label: 'In-Season Cup', tab: 'cup' },
      { label: 'All-Star', tab: 'allStarWeekend' },
      { label: 'Schedule', tab: 'schedule' },
      { label: 'Daily Schedule', tab: 'dailySchedule' },
      { label: 'Finances', tab: 'finances' },
      { label: 'History', tab: 'history' },
      { label: 'Almanac', tab: 'almanac' },
      { label: 'NBA History', tab: 'nbaArchive', requiresHistorical: true },
      { label: 'Power Rankings', tab: 'powerRankings' },
      { label: 'Transactions', tab: 'transactions' },
      { label: 'News Feed', tab: 'news' },
      { label: 'Press Room', tab: 'press', requiresControlledTeam: true },
    ],
  },
  {
    title: 'Team',
    items: [
      { label: 'Your Team', tab: 'yourTeam', requiresControlledTeam: true },
      { label: 'Roster', tab: 'roster' },
      { label: 'Coaching', tab: 'coaching' },
      { label: 'Staff Market', tab: 'staff' },
      { label: 'Development', tab: 'development' },
      { label: 'Schedule', tab: 'schedule' },
      { label: 'Finances', tab: 'finances' },
      { label: 'Team History', tab: 'teamHistory' },
    ],
  },
  {
    title: 'Front Office',
    items: [
      { label: 'GM Office', tab: 'gmOffice' },
      { label: 'Summer League', tab: 'summerLeague' },
      { label: 'Free Agents', tab: 'freeAgency' },
      { label: 'Extensions', tab: 'extensions', requiresControlledTeam: true },
      { label: 'Trade', tab: 'trade' },
      { label: 'Trading Block', tab: 'tradeBlock' },
      { label: 'Trade Offers', tab: 'tradeOffers' },
      { label: 'Deadline Day', tab: 'deadline', requiresControlledTeam: true },
      { label: 'Draft', tab: 'draft' },
      { label: 'Compare Players', tab: 'compare' },
      { label: 'Watch List', tab: 'watchList' },
      { label: 'Hall of Fame', tab: 'hallOfFame' },
      { label: 'Legend Teams', tab: 'legends' },
    ],
  },
  {
    title: 'Stats',
    items: [
      { label: 'League Leaders', tab: 'analytics' },
      { label: 'Player Stats', tab: 'playerStats' },
      { label: 'Player Ratings', tab: 'database' },
      { label: 'Player Search', tab: 'database' },
      { label: 'Team Stats', tab: 'teamStats' },
      { label: 'League Stats', tab: 'analytics' },
      { label: 'Injuries', tab: 'injuries' },
      { label: 'Medical Room', tab: 'medical', requiresControlledTeam: true },
      { label: 'Award Races', tab: 'awards' },
      { label: 'Year in Review', tab: 'yearInReview', requiresControlledTeam: true },
      { label: 'Records', tab: 'records' },
    ],
  },
  {
    title: 'Sandbox',
    items: [
      { label: 'Sandbox Mode', tab: 'sandbox' },
      { label: 'God Mode', tab: 'bulk' },
      { label: 'Import/Export', tab: 'imports' },
      { label: 'Auto Play', tab: 'autoPlay' },
      { label: 'Fast Edit', tab: 'fastEdit' },
      { label: 'Bulk Editor', tab: 'bulk' },
      { label: 'Code Mode', tab: 'code' },
      { label: 'Simulation Lab', tab: 'lab' },
    ],
  },
  {
    title: 'Settings',
    items: [
      { label: 'Global Settings', tab: 'settings' },
      { label: 'League Settings', tab: 'leagueSettings', leagueSettingsSub: 'rules' },
      { label: 'Award Settings', tab: 'leagueSettings', leagueSettingsSub: 'awards' },
    ],
  },
];

export const NAV_ICONS: Record<string, string> = {
  cup: 'trophy', deadline: 'clock', yearInReview: 'star', press: 'list', medical: 'warning', extensions: 'list', gmOffice: 'star', summerLeague: 'play', coaching: 'list', allStarWeekend: 'trophy', dashboard: 'court', standings: 'chart', playoffs: 'trophy', schedule: 'calendar',
  dailySchedule: 'calendar', finances: 'chart', history: 'list', powerRankings: 'chart',
  transactions: 'trade', news: 'list', yourTeam: 'team', roster: 'team', freeAgency: 'team',
  trade: 'trade', tradeBlock: 'trade', tradeOffers: 'trade', draft: 'team', compare: 'chart',
  watchList: 'search', hallOfFame: 'trophy', teamHistory: 'trophy', records: 'trophy', almanac: 'trophy', nbaArchive: 'search', legends: 'trophy', analytics: 'chart',
  playerStats: 'chart', database: 'search', teamStats: 'chart', injuries: 'list', awards: 'trophy',
  bulk: 'settings', settings: 'settings', autoPlay: 'play', fastEdit: 'settings', code: 'list',
  staff: 'team', development: 'chart', sandbox: 'settings', imports: 'list', lab: 'chart', leagueSettings: 'settings', mainMenu: 'court',
};
