import { AD_CONFIG, type AdConfig } from './adConfig';
import { IS_DESKTOP_BUILD } from '../appMode';
import type { ConsentSnapshot } from '../consent/consent';

/**
 * May Google ads be requested right now? One rule shared by the ad slots and the consent banner.
 *  - Google's certified consent tool (AD_CONFIG.googleCmp): Google asks visitors where the law requires consent
 *    (EEA, UK, Switzerland) and withholds ads there until they answer; elsewhere ads load with the page. A Global
 *    Privacy Control signal from the browser still means no ad requests.
 *  - In-app banner (googleCmp off): ads only after the visitor turns Advertising on.
 * The offline Windows edition never loads ads.
 */
export function advertisingPermitted(consent: ConsentSnapshot, cfg: AdConfig = AD_CONFIG, desktop = IS_DESKTOP_BUILD): boolean {
  if (!cfg.enabled || desktop || !cfg.adsenseClient) return false;
  if (cfg.googleCmp) return !consent.gpc;
  return consent.advertisingAllowed;
}
