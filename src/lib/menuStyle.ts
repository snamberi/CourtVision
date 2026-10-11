import { readPlayTime } from '../retention/playTime';

/*
 * The menu style: Classic (everyone) or Gold Arcade, the chunky gold-button style that unlocks after 24 hours played
 * in total (src/retention/playTime.ts). Stored on this device; applied as a class on <html> so it only restyles the
 * menus, the phone bar and the mode cards.
 */

export type MenuStyle = 'classic' | 'gold';
export const GOLD_UNLOCK_SECONDS = 24 * 3600;
const KEY = 'cv-menu-style';
export const MENU_STYLE_EVENT = 'cv-menu-style';

export const goldProgress = (total = readPlayTime().total) => Math.min(1, total / GOLD_UNLOCK_SECONDS);
export const goldUnlocked = (total = readPlayTime().total) => total >= GOLD_UNLOCK_SECONDS;

export function menuStyle(): MenuStyle {
  try { return localStorage.getItem(KEY) === 'gold' && goldUnlocked() ? 'gold' : 'classic'; } catch { return 'classic'; }
}
export function setMenuStyle(style: MenuStyle): void {
  if (style === 'gold' && !goldUnlocked()) return;
  try { localStorage.setItem(KEY, style); } catch { /* storage blocked */ }
  applyMenuStyle();
  window.dispatchEvent(new Event(MENU_STYLE_EVENT));
}
export function applyMenuStyle(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('menu-gold', menuStyle() === 'gold');
}
