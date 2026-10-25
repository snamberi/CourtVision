import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ENTITLEMENTS_KEY } from '../profile/cosmetics';

import { BUNDLE_IDS, type ProductId } from './products';

/*
 * The Support Shop, sold through Paddle (it is the merchant of record: payment, tax, receipts, refunds).
 *
 *   Supporter Pass, No-Ads Pass   monthly subscriptions: perks while active, cancel any time (cancelSubscription)
 *   Supporter, Visionary, Eternal Founder and Custom Support bundles   one-time: their cosmetics for good
 *
 * None of it changes the game: no ratings, spins, XP or picks are for sale. A purchase belongs to an account: the
 * checkout (Paddle's overlay, opened over the game) carries the signed-in player's id in custom_data, the webhook
 * (/api/billing) records it, and the game reads it back here and keeps a copy in this browser so it works offline.
 */

/** The Paddle price id (pri_…) of each product. Public: they are built into the game. */
export const PRICE_IDS: Record<ProductId, string | undefined> = {
  noAds: (import.meta.env.VITE_PADDLE_PRICE_NO_ADS as string | undefined) || undefined,
  supporter: (import.meta.env.VITE_PADDLE_PRICE_SUPPORTER as string | undefined) || undefined,
  bundleSupporter: (import.meta.env.VITE_PADDLE_PRICE_BUNDLE_SUPPORTER as string | undefined) || undefined,
  bundleVisionary: (import.meta.env.VITE_PADDLE_PRICE_BUNDLE_VISIONARY as string | undefined) || undefined,
  bundleFounder: (import.meta.env.VITE_PADDLE_PRICE_BUNDLE_FOUNDER as string | undefined) || undefined,
  bundleCustom: (import.meta.env.VITE_PADDLE_PRICE_BUNDLE_CUSTOM as string | undefined) || undefined,
};
/** Paddle's client-side token (live_… or test_…), which lets the game open checkouts. Public by design. */
const CLIENT_TOKEN = (import.meta.env.VITE_PADDLE_CLIENT_TOKEN as string | undefined) || '';
const SANDBOX = ((import.meta.env.VITE_PADDLE_ENV as string | undefined) || '').toLowerCase() === 'sandbox' || CLIENT_TOKEN.startsWith('test_');
export type PassKind = ProductId;
export type SubscriptionKind = 'noAds' | 'supporter';
/** Whether a product can be bought on this build. */
export const onSale = (id: ProductId) => !!CLIENT_TOKEN && !!PRICE_IDS[id];
export const passesOnSale = () => !!CLIENT_TOKEN && Object.values(PRICE_IDS).some(Boolean);

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

interface PaddleJs {
  Environment: { set(env: 'sandbox' | 'production'): void };
  Initialize(o: { token: string; eventCallback?: (e: { name?: string }) => void }): void;
  Checkout: { open(o: Record<string, unknown>): void };
}
declare global { interface Window { Paddle?: PaddleJs } }
const PADDLE_JS = 'https://cdn.paddle.com/paddle/v2/paddle.js';
let paddleReady: Promise<PaddleJs> | null = null;
/** Called when a checkout finishes (the Support Shop re-checks the account then). */
let onCompleted: (() => void) | null = null;

/** Loads Paddle.js once, the first time someone opens a checkout (nothing is loaded for players who never do). */
function loadPaddle(): Promise<PaddleJs> {
  paddleReady ??= new Promise<PaddleJs>((resolve, reject) => {
    const ready = () => {
      const P = window.Paddle;
      if (!P) { reject(new Error('Paddle did not load')); return; }
      if (SANDBOX) P.Environment.set('sandbox');
      P.Initialize({ token: CLIENT_TOKEN, eventCallback: e => { if (e.name === 'checkout.completed') onCompleted?.(); } });
      resolve(P);
    };
    if (window.Paddle) { ready(); return; }
    const s = document.createElement('script');
    s.src = PADDLE_JS;
    s.async = true;
    s.onload = ready;
    s.onerror = () => { paddleReady = null; reject(new Error('Paddle did not load')); };
    document.head.appendChild(s);
  });
  return paddleReady;
}

export interface CheckoutOptions { userId: string; email?: string | null; onDone?: () => void; transactionId?: string }
/**
 * Opens Paddle's checkout over the game for a product, tied to this account (custom_data.user_id comes back to the
 * webhook). A Custom Support Bundle at a chosen amount opens the transaction the server made for it instead.
 * Returns an error to show, or null.
 */
export async function openCheckout(kind: PassKind, o: CheckoutOptions): Promise<string | null> {
  const price = PRICE_IDS[kind];
  if (!CLIENT_TOKEN || (!price && !o.transactionId)) return 'This is not on sale here yet.';
  try {
    const P = await loadPaddle();
    onCompleted = o.onDone ?? null;
    P.Checkout.open({
      ...(o.transactionId ? { transactionId: o.transactionId } : { items: [{ priceId: price, quantity: 1 }] }),
      customData: { user_id: o.userId },
      ...(o.email ? { customer: { email: o.email } } : {}),
      settings: { displayMode: 'overlay', theme: 'dark', allowLogout: false },
    });
    return null;
  } catch { return 'The checkout could not load. Check your connection, or turn off a blocker for this site, and try again.'; }
}

/** Asks the server for a Custom Support Bundle checkout at `cents`; 'catalog' means use the bundle's normal price. */
export async function customAmountCheckout(cents: number, token: string): Promise<{ transactionId: string } | 'catalog' | string> {
  try {
    const res = await fetch('/api/billing?action=checkout', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ cents }) });
    if (res.status === HTTP_NOT_IMPLEMENTED) return 'catalog';
    const body = await res.json() as { transactionId?: string; error?: string };
    return res.ok && body.transactionId ? { transactionId: body.transactionId } : body.error ?? 'Could not start the checkout. Try again in a minute.';
  } catch { return 'You seem to be offline. Try again when you are connected.'; }
}
const HTTP_NOT_IMPLEMENTED = 501;

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
 * Cancels a monthly pass straight away from the game (the server asks Paddle, /api/billing?action=cancel).
 * The perks last until the end of the month already paid for. Returns null when it worked, or an error to show;
 * 'portal' means the server can't cancel by itself, so the caller opens Paddle's cancel page instead.
 */
export async function cancelSubscription(kind: SubscriptionKind, token: string): Promise<null | 'portal' | string> {
  try {
    const res = await fetch('/api/billing?action=cancel', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ kind }) });
    if (res.status === HTTP_NOT_IMPLEMENTED) return 'portal';
    let body: { error?: string } = {};
    try { body = await res.json() as { error?: string }; } catch { /* no body */ }
    return res.ok ? null : body.error ?? 'Could not cancel right now. Try again in a minute.';
  } catch { return 'You seem to be offline. Try again when you are connected.'; }
}
