import type { AdSlot } from './adConfig';

/* Unfilled ad placements may ask Google again only after the player navigates, at most once every
 * AD_RETRY_MIN_GAP_MS and AD_MAX_RETRIES times per visit — never on a timer (AdSense forbids automatic refreshes). */
export const AD_RETRY_MIN_GAP_MS = 30_000;
export const AD_MAX_RETRIES = 3;
const state = new Map<AdSlot, { lastRequest: number; retries: number }>();

export function noteAdRequest(slot: AdSlot, now = Date.now()): void {
  const s = state.get(slot) ?? { lastRequest: 0, retries: 0 };
  state.set(slot, { ...s, lastRequest: now });
}
export function noteAdRetry(slot: AdSlot): void {
  const s = state.get(slot) ?? { lastRequest: 0, retries: 0 };
  state.set(slot, { ...s, retries: s.retries + 1 });
}
export function mayRetryAd(slot: AdSlot, now = Date.now()): boolean {
  const s = state.get(slot) ?? { lastRequest: 0, retries: 0 };
  return s.retries < AD_MAX_RETRIES && now - s.lastRequest >= AD_RETRY_MIN_GAP_MS;
}
/** Test hook: forget retry history. */
export function resetAdRetries(): void { state.clear(); }
