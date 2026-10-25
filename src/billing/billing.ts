import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ENTITLEMENTS_KEY } from '../profile/cosmetics';

import { BUNDLE_IDS, type ProductId } from './products';

/*
 * The Support Shop, sold through Lemon Squeezy (it is the merchant of record: payment, tax, receipts, refunds).
 *
 *   Supporter Pass, No-Ads Pass   monthly subscriptions: perks while active, cancel any time (cancelSubscription)
 *   Supporter, Visionary, Eternal Founder and Custom Support bundles   one-time: their cosmetics for good
 *
 * None of it changes the game: no ratings, spins, XP or picks are for sale. A purchase belongs to an account: the
 * checkout link carries the signed-in player's id, the webhook (/api/billing) records it, and the game reads it back
 * here and keeps a copy in this browser so it works offline.
 */

export const PASS_URLS: Record<ProductId, string | undefined> = {
  noAds: (import.meta.env.VITE_LEMONSQUEEZY_NO_ADS_URL as string | undefined) || undefined,
  supporter: (import.meta.env.VITE_LEMONSQUEEZY_SUPPORTER_URL as string | undefined) || undefined,
  bundleSupporter: (import.meta.env.VITE_LEMONSQUEEZY_BUNDLE_SUPPORTER_URL as string | undefined) || undefined,
  bundleVisionary: (import.meta.env.VITE_LEMONSQUEEZY_BUNDLE_VISIONARY_URL as string | undefined) || undefined,
  bundleFounder: (import.meta.env.VITE_LEMONSQUEEZY_BUNDLE_FOUNDER_URL as string | undefined) || undefined,
  bundleCustom: (import.meta.env.VITE_LEMONSQUEEZY_BUNDLE_CUSTOM_URL as string | undefined) || undefined,
};
export type PassKind = ProductId;
export type SubscriptionKind = 'noAds' | 'supporter';
export const passesOnSale = () => Object.values(PASS_URLS).some(Boolean);

export const ENTITLEMENTS_EVENT = 'courtvision:entitlements';
export interface Entitlements {
  /** No ads: a lifetime No-Ads Pass from before it became monthly, or the monthly pass while it is active. */
  noAds: boolean;
  supporter: boolean; supporterUntil?: string | null; supporterStatus?: string | null; portal?: string | null;
  noAdsUntil?: string | null; noAdsStatus?: string | null; noAdsPortal?: string | null;
  /** One-time bundles owned (product ids). */
  bundles?: string[];
}
const NONE: Entitlements = { noAds: false, supporter: false };

/** Every product this account has right now (subscriptions only while paid through). */
export function activeProducts(e: Entitlements, now = Date.now()): ProductId[] {
  const live = (until?: string | null) => !!until && Date.parse(until) > now;
  return [
    ...(e.supporter && (!e.supporterUntil || live(e.supporterUntil)) ? ['supporter' as const] : []),
    ...(live(e.noAdsUntil) ? ['noAds' as const] : []),
    ...BUNDLE_IDS.filter(id => (e.bundles ?? []).includes(id)),
  ];
}

export function readEntitlements(): Entitlements {
  try {
    const e = JSON.parse(localStorage.getItem(ENTITLEMENTS_KEY) ?? 'null') as Entitlements | null;
    return e ? { ...NONE, ...e } : NONE;
  } catch { return NONE; }
}
export function writeEntitlements(e: Entitlements | null): void {
  try {
    const next = e && (e.noAds || e.supporter || e.supporterUntil || e.noAdsUntil || e.bundles?.length) ? JSON.stringify(e) : null;
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

interface Row {
  no_ads: boolean | null; supporter_until: string | null; supporter_status: string | null; portal_url: string | null;
  no_ads_until?: string | null; no_ads_status?: string | null; no_ads_portal_url?: string | null; bundles?: string[] | null;
}
export function fromRow(row: Row | null, now = Date.now()): Entitlements {
  if (!row) return NONE;
  const until = row.supporter_until;
  const adsUntil = row.no_ads_until ?? null;
  return {
    noAds: !!row.no_ads || (!!adsUntil && Date.parse(adsUntil) > now), supporter: !!until && Date.parse(until) > now, supporterUntil: until,
    supporterStatus: row.supporter_status, portal: row.portal_url,
    noAdsUntil: adsUntil, noAdsStatus: row.no_ads_status ?? null, noAdsPortal: row.no_ads_portal_url ?? null,
    bundles: (row.bundles ?? []).filter(b => (BUNDLE_IDS as string[]).includes(b)),
  };
}

/** Reads the signed-in player's passes (on sign-in and profile refresh). A database without the table reads as none. */
export async function loadEntitlements(client: SupabaseClient, userId: string): Promise<Entitlements> {
  const full = 'no_ads, supporter_until, supporter_status, portal_url, no_ads_until, no_ads_status, no_ads_portal_url, bundles';
  let { data, error } = await client.from('entitlements').select(full).eq('user_id', userId).maybeSingle();
  // A database not yet migrated for the Support Shop (supabase/schema.sql) lacks the new columns: read the old ones.
  if (error?.code === '42703') ({ data, error } = await client.from('entitlements').select('no_ads, supporter_until, supporter_status, portal_url').eq('user_id', userId).maybeSingle());
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

/**
 * Cancels a monthly pass straight away from the game (the server asks Lemon Squeezy, /api/billing?action=cancel).
 * The perks last until the end of the month already paid for. Returns null when it worked, or an error to show;
 * 'portal' means the server can't cancel by itself, so the caller opens Lemon Squeezy's page instead.
 */
export async function cancelSubscription(kind: SubscriptionKind, token: string): Promise<null | 'portal' | string> {
  try {
    const res = await fetch('/api/billing?action=cancel', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ kind }) });
    if (res.status === 501) return 'portal';
    const body = await res.json().catch(() => ({})) as { error?: string };
    return res.ok ? null : body.error ?? 'Could not cancel right now. Try again in a minute.';
  } catch { return 'You seem to be offline. Try again when you are connected.'; }
}
