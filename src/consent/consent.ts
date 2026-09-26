import { useSyncExternalStore } from 'react';

/**
 * Cookie & advertising consent.
 *
 * CourtVision itself sets no cookies and runs no analytics; the only optional third-party technology is Google
 * AdSense on the WEB version. So there is one consent category beyond "strictly necessary" (which is always on and
 * needs no consent): Advertising. Nothing from Google is loaded until the visitor turns Advertising on, and
 * turning it off again removes the ads immediately.
 *
 * The visitor's choice is stored in localStorage under CONSENT_STORAGE_KEY (a strictly-necessary record of the choice
 * itself). Bump CONSENT_VERSION whenever the categories change in a way that requires asking everyone again.
 *
 * A Global Privacy Control signal from the browser is treated as "advertising: declined" when the visitor hasn't
 * chosen otherwise, and suppresses the banner; they can still opt in on purpose from Cookie settings.
 */

export const CONSENT_STORAGE_KEY = 'courtvision:consent';
export const CONSENT_VERSION = 1;

export interface ConsentRecord {
  version: number;
  advertising: boolean;
  decidedAt: number;
}

export function parseConsent(raw: string | null | undefined): ConsentRecord | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<ConsentRecord>;
    if (!v || typeof v.advertising !== 'boolean' || typeof v.decidedAt !== 'number') return null;
    if (v.version !== CONSENT_VERSION) return null; // categories changed since they answered: ask again
    return { version: v.version, advertising: v.advertising, decidedAt: v.decidedAt };
  } catch {
    return null;
  }
}

export interface ConsentSnapshot {
  /** The visitor's saved choice, or null if they haven't made one (or it's out of date). */
  record: ConsentRecord | null;
  /** Browser sends a Global Privacy Control opt-out signal. */
  gpc: boolean;
  /** Cookie settings dialog is open. */
  preferencesOpen: boolean;
  /** May Google AdSense be loaded right now? */
  advertisingAllowed: boolean;
  /** Should the first-visit banner be showing? */
  needsDecision: boolean;
}

export function deriveSnapshot(record: ConsentRecord | null, gpc: boolean, preferencesOpen: boolean): ConsentSnapshot {
  return {
    record, gpc, preferencesOpen,
    advertisingAllowed: record ? record.advertising : false,
    needsDecision: !record && !gpc,
  };
}

// ---- tiny external store (so any component can subscribe without a provider) ----

const SERVER_SNAPSHOT: ConsentSnapshot = deriveSnapshot(null, false, false);
let snapshot: ConsentSnapshot | null = null;
const listeners = new Set<() => void>();

function readStored(): ConsentRecord | null {
  try { return parseConsent(localStorage.getItem(CONSENT_STORAGE_KEY)); } catch { return null; }
}
function detectGpc(): boolean {
  try { return (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true; } catch { return false; }
}
function publish(next: ConsentSnapshot) {
  snapshot = next;
  listeners.forEach((l) => l());
}
function current(): ConsentSnapshot {
  if (!snapshot) snapshot = deriveSnapshot(readStored(), detectGpc(), false);
  return snapshot;
}

export function saveConsent(advertising: boolean): void {
  const record: ConsentRecord = { version: CONSENT_VERSION, advertising, decidedAt: Date.now() };
  try { localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record)); } catch { /* storage blocked: the choice still applies for this visit */ }
  publish(deriveSnapshot(record, current().gpc, false));
}

export function openPreferences(): void {
  const c = current();
  publish(deriveSnapshot(c.record, c.gpc, true));
}

export function closePreferences(): void {
  const c = current();
  publish(deriveSnapshot(c.record, c.gpc, false));
}

/** Forget the saved choice (used by tests, and handy for support: the banner returns). */
export function resetConsent(): void {
  try { localStorage.removeItem(CONSENT_STORAGE_KEY); } catch { /* ignore */ }
  publish(deriveSnapshot(null, detectGpc(), false));
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useConsent(): ConsentSnapshot {
  return useSyncExternalStore(subscribe, current, () => SERVER_SNAPSHOT);
}
