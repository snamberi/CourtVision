import { useSyncExternalStore } from 'react';
import { IS_DESKTOP_BUILD } from '../appMode';

/*
 * The installable app: registers the service worker (web build only, see vite.config.ts) and keeps the browser's
 * install prompt so the menu can offer an "Install app" button. iPhones have no prompt; the button explains
 * Share > Add to Home Screen instead.
 */

interface InstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export function startPwa(): void {
  if (IS_DESKTOP_BUILD || typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e as InstallPromptEvent; emit(); });
  window.addEventListener('appinstalled', () => { deferred = null; installed = true; emit(); });
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { /* offline play is optional */ }); });
  }
}

export const isStandalone = () => typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
export const isIos = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

export type InstallState = 'prompt' | 'ios' | 'none';
function snapshot(): InstallState {
  if (IS_DESKTOP_BUILD || installed || isStandalone()) return 'none';
  if (deferred) return 'prompt';
  return isIos() ? 'ios' : 'none';
}
export const useInstallState = () => useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, snapshot, () => 'none' as InstallState);

/** Shows the browser's install dialog. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const e = deferred;
  deferred = null; emit();
  await e.prompt();
  const { outcome } = await e.userChoice;
  return outcome === 'accepted';
}
