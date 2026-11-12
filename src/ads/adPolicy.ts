import { AD_CONFIG, type AdConfig } from './adConfig';
import { IS_DESKTOP_BUILD } from '../appMode';
import type { ConsentSnapshot } from '../consent/consent';

/**
 * May Google ads be requested right now? One rule shared by the ad slots and the consent banner.
 *  - Google's certified consent tool (AD_CONFIG.googleCmp): Google asks visitors where the law requires consent
 *    (EEA, UK, Switzerland) and withholds ads there until they answer; elsewhere ads load with the page. A Global
 *    Privacy Control signal from the browser still means no ad requests.
 *  - In-app banner (googleCmp off): ads only after the visitor turns Advertising on.
 * The offline Windows edition never loads ads, and a production build loads them only on the site's own hostnames.
 */
export function advertisingPermitted(
  consent: ConsentSnapshot, cfg: AdConfig = AD_CONFIG, desktop = IS_DESKTOP_BUILD,
  host: string | null = import.meta.env.PROD ? location.hostname : null,
): boolean {
  if (!cfg.enabled || desktop || !cfg.adsenseClient) return false;
  if (host !== null && cfg.siteHosts.length > 0 && !cfg.siteHosts.includes(host)) return false;
  if (cfg.googleCmp) return !consent.gpc;
  return consent.advertisingAllowed;
}

/**
 * In-game screens that may carry an ad. AdSense allows ads only next to substantial publisher content, and not on
 * screens used for navigation, alerts, settings or actions where a misplaced tap is likely. So: read-only pages full
 * of stats, reports and history, never the main menu, editors, settings, loading states, trades, the draft, free
 * agency or simulation controls.
 */
export const AD_CONTENT_TABS: ReadonlySet<string> = new Set([
  'dashboard', 'standings', 'schedule', 'playoffs', 'boxscore', 'powerRankings', 'transactions', 'news',
  'playerStats', 'teamStats', 'teamProfile', 'roster', 'history', 'teamHistory', 'records', 'almanac', 'nbaArchive',
  'hallOfFame', 'awards', 'legends', 'yearInReview', 'seasonPreview', 'dynastyRankings', 'historyBook', 'timeline',
  'storylines', 'press', 'analytics', 'injuries', 'database', 'compare',
]);
export const adsAllowedOnTab = (tab: string): boolean => AD_CONTENT_TABS.has(tab);
