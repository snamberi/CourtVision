import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ENTITLEMENTS_KEY } from '../profile/cosmetics';

/*
 * The passes, sold through Lemon Squeezy (it is the merchant of record: payment, tax, receipts, refunds).
 *
 *   No-Ads Pass     one-time   ads off for good
 *   Supporter Pass  monthly    ads off while active, plus the supporter icons, name colour and title
 *
 * Neither changes the game: no ratings, spins, XP or picks are for sale. A pass belongs to an account: the checkout
 * link carries the signed-in player's id, the webhook (/api/billing) records it, and the game reads it back here and
 * keeps a copy in this browser so it works offline.
 */

const NO_ADS_URL = import.meta.env.VITE_LEMONSQUEEZY_NO_ADS_URL as string | undefined;
const SUPPORTER_URL = import.meta.env.VITE_LEMONSQUEEZY_SUPPORTER_URL as string | undefined;
export type PassKind = 'noAds' | 'supporter';
export const PASS_URLS: Record<PassKind, string | undefined> = { noAds: NO_ADS_URL || undefined, supporter: SUPPORTER_URL || undefined };
export const passesOnSale = () => !!(PASS_URLS.noAds || PASS_URLS.supporter);

export const ENTITLEMENTS_EVENT = 'courtvision:entitlements';
export interface Entitlements { noAds: boolean; supporter: boolean; supporterUntil?: string | null; supporterStatus?: string | null; portal?: string | null }
const NONE: Entitlements = { noAds: false, supporter: false };

export function readEntitlements(): Entitlements {
  try {
    const e = JSON.parse(localStorage.getItem(ENTITLEMENTS_KEY) ?? 'null') as Entitlements | null;
    return e ? { ...NONE, ...e } : NONE;
  } catch { return NONE; }
}
export function writeEntitlements(e: Entitlements | null): void {
  try {
    const next = e && (e.noAds || e.supporter || e.supporterUntil) ? JSON.stringify(e) : null;
    if (next === localStorage.getItem(ENTITLEMENTS_KEY)) return;
    if (next) localStorage.setItem(ENTITLEMENTS_KEY, next); else localStorage.removeItem(ENTITLEMENTS_KEY);
  } catch { /* storage blocked */ }
  window.dispatchEvent(new Event(ENTITLEMENTS_EVENT));
}

/** The checkout link for a pass, tied to this account (Lemon Squeezy hands `custom.user_id` back to the webhook). */
export function checkoutUrl(kind: PassKind, userId: string, email?: string | null): string | null {
  const base = PASS_URLS[kind];
  if (!base) return null;
  const url = new URL(base);
  url.searchParams.set('checkout[custom][user_id]', userId);
  if (email) url.searchParams.set('checkout[email]', email);
  return url.toString();
}

interface Row { no_ads: boolean | null; supporter_until: string | null; supporter_status: string | null; portal_url: string | null }
export function fromRow(row: Row | null, now = Date.now()): Entitlements {
  if (!row) return NONE;
  const until = row.supporter_until;
  return { noAds: !!row.no_ads, supporter: !!until && Date.parse(until) > now, supporterUntil: until, supporterStatus: row.supporter_status, portal: row.portal_url };
}

/** Reads the signed-in player's passes (on sign-in and profile refresh). A database without the table reads as none. */
export async function loadEntitlements(client: SupabaseClient, userId: string): Promise<Entitlements> {
  const { data, error } = await client.from('entitlements').select('no_ads, supporter_until, supporter_status, portal_url').eq('user_id', userId).maybeSingle();
  // Keep what this browser knew if the read failed (offline); only a clean answer replaces it.
  if (error) return readEntitlements();
  const e = fromRow(data as Row | null);
  writeEntitlements(e);
  return e;
}

export function useEntitlements(): Entitlements {
  const [e, setE] = useState(readEntitlements);
  useEffect(() => {
    const bump = () => setE(readEntitlements());
    window.addEventListener(ENTITLEMENTS_EVENT, bump);
    window.addEventListener('storage', bump);
    return () => { window.removeEventListener(ENTITLEMENTS_EVENT, bump); window.removeEventListener('storage', bump); };
  }, []);
  return e;
}
