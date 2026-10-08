import { useSyncExternalStore } from 'react';
import { IS_DESKTOP_BUILD } from '../appMode';
import { track } from '../analytics/track';

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
  watchStaleChunks();
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    // Was a worker already in charge? Then a new one taking over means a new version went live while we were open.
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) showUpdateBar(); });
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then(reg => {
        // An installed app has no reload button and can stay open for days: look for a new version when it comes
        // back to the front, and every half hour.
        const check = () => { reg.update().catch(() => { /* offline */ }); };
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
        window.setInterval(check, 30 * 60 * 1000);
      }).catch(() => { /* offline play is optional */ });
    });
  }
}

const RELOAD_KEY = 'cv-stale-reload';
/**
 * After a deploy, a page still running the old version asks for screens (code chunks) the server no longer has.
 * Reload once to get the new version instead of leaving a screen that never opens; if that already happened in the
 * last minute (the chunk really is missing), let the error show rather than loop.
 */
function watchStaleChunks(): void {
  window.addEventListener('vite:preloadError', event => {
    let last = 0;
    try { last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0); } catch { /* storage blocked */ }
    if (Date.now() - last < 60_000) return;
    try { sessionStorage.setItem(RELOAD_KEY, String(Date.now())); } catch { /* storage blocked */ }
    event.preventDefault();
    window.location.reload();
  });
}

/** A new version is live: a bar offering to reload (not forced, so nothing in progress is lost). */
function showUpdateBar(): void {
  if (document.getElementById('cv-update-bar')) return;
  const bar = document.createElement('div');
  bar.id = 'cv-update-bar';
  bar.className = 'cv-update-bar';
  bar.setAttribute('role', 'status');
  const text = document.createElement('span');
  text.textContent = 'A new version of Court Vision is ready.';
  const go = document.createElement('button');
  go.className = 'primary';
  go.textContent = 'Reload';
  go.addEventListener('click', () => window.location.reload());
  const later = document.createElement('button');
  later.textContent = 'Later';
  later.setAttribute('aria-label', 'Dismiss');
  later.addEventListener('click', () => bar.remove());
  bar.append(text, go, later);
  document.body.append(bar);
}

export const isStandalone = () => typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
export const isIos = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

/** prompt: the browser's own install dialog is ready; ios / manual: the guide explains the menu steps; installed: hide. */
export type InstallState = 'prompt' | 'ios' | 'manual' | 'installed';
function snapshot(): InstallState {
  if (IS_DESKTOP_BUILD || installed || isStandalone()) return 'installed';
  if (deferred) return 'prompt';
  return isIos() ? 'ios' : 'manual';
}
export const useInstallState = () => useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, snapshot, () => 'installed' as InstallState);

/** Shows the browser's install dialog. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const e = deferred;
  deferred = null; emit();
  await e.prompt();
  const { outcome } = await e.userChoice;
  return outcome === 'accepted';
}

export type InstallDevice = 'pc' | 'android' | 'ios';
export type InstallBrowser = 'chrome' | 'edge' | 'samsung' | 'firefox' | 'safari' | 'other';
/** Which install steps to show first. */
export function installDevice(ua = typeof navigator === 'undefined' ? '' : navigator.userAgent): { device: InstallDevice; browser: InstallBrowser } {
  const device: InstallDevice = /iphone|ipad|ipod/i.test(ua) ? 'ios' : /android/i.test(ua) ? 'android' : 'pc';
  const browser: InstallBrowser = /edg\//i.test(ua) ? 'edge' : /samsungbrowser/i.test(ua) ? 'samsung' : /firefox|fxios/i.test(ua) ? 'firefox'
    : /crios|chrome/i.test(ua) ? 'chrome' : /safari/i.test(ua) ? 'safari' : 'other';
  return { device, browser };
}

// The install guide: one dialog for the whole app, opened from any Install button (or the #/install link).
let guideOpen = false;
const guideListeners = new Set<() => void>();
export const openInstallGuide = () => { guideOpen = true; guideListeners.forEach(l => l()); };
export const closeInstallGuide = () => { guideOpen = false; guideListeners.forEach(l => l()); };
export const useInstallGuideOpen = () => useSyncExternalStore(cb => { guideListeners.add(cb); return () => guideListeners.delete(cb); }, () => guideOpen, () => false);

/** Install buttons: the browser's dialog when it has one, otherwise the step-by-step guide. */
export async function startInstall(where: string): Promise<void> {
  if (deferred) {
    const ok = await promptInstall();
    track('app_install', { outcome: ok ? 'accepted' : 'dismissed', where });
    if (ok) return;
  }
  openInstallGuide();
  track('app_install', { outcome: 'guide', where });
}
