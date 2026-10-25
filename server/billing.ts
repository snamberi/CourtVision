import { rest, upsert, json, bearer, getUser, type SupaEnv, type Fetch } from './supabase';

/*
 * /api/billing: the Paddle webhook, plus two small actions for the Support Shop. Paddle is the merchant of record (it
 * takes the payment, handles tax and refunds); this only records what a signed-in player owns, in public.entitlements,
 * which the game reads back.
 *
 *   Supporter Pass, No-Ads Pass   monthly subscriptions   subscription.* → supporter_until / no_ads_until (paid-through)
 *   Supporter, Visionary, Eternal Founder, Custom Support bundles   one-time   transaction.completed → bundles;
 *                                                                   an approved full refund (adjustment.*) → removed
 *
 * Every webhook must carry Paddle-Signature (ts=…;h1=…): the HMAC-SHA256 of "ts:raw body" with the notification
 * destination's secret key. The buyer is the checkout's custom_data.user_id (the game sets it when it opens the
 * checkout), never an email match. Products are matched by Paddle product id (pro_…), so any price of a product counts.
 *
 *   ?action=cancel    (the player's access token) cancels that player's own monthly pass at the end of the paid period
 *   ?action=checkout  (the player's access token) starts a Custom Support Bundle checkout for an amount they choose
 * Both need PADDLE_API_KEY; without it the game falls back (Paddle's cancel link, or the bundle's catalog price).
 */

export const BUNDLES = ['bundleSupporter', 'bundleVisionary', 'bundleFounder', 'bundleCustom'] as const;
export type Bundle = typeof BUNDLES[number];
export interface BillingEnv {
  secret: string;
  /** Paddle product ids (comma lists allowed) of each product. */
  noAds: string[];
  supporter: string[];
  bundles: Record<Bundle, string[]>;
  /** A server-side API key, for cancelling and custom amounts. */
  apiKey?: string;
  /** api.paddle.com, or sandbox-api.paddle.com while testing. */
  api: string;
}
type Env = Record<string, string | undefined>;
const ids = (v: string | undefined) => (v ?? '').split(',').map(s => s.trim()).filter(Boolean);
const BUNDLE_ENV: Record<Bundle, string> = { bundleSupporter: 'SUPPORTER', bundleVisionary: 'VISIONARY', bundleFounder: 'FOUNDER', bundleCustom: 'CUSTOM' };
export function billingEnv(env: Env = (globalThis as { process?: { env: Env } }).process?.env ?? {}): BillingEnv | null {
  const secret = env.PADDLE_WEBHOOK_SECRET;
  const sandbox = (env.PADDLE_ENV ?? env.VITE_PADDLE_ENV ?? '').toLowerCase() === 'sandbox';
  return secret ? {
    secret, noAds: ids(env.PADDLE_PRODUCT_NO_ADS), supporter: ids(env.PADDLE_PRODUCT_SUPPORTER),
    bundles: Object.fromEntries(BUNDLES.map(b => [b, ids(env[`PADDLE_PRODUCT_BUNDLE_${BUNDLE_ENV[b]}`])])) as Record<Bundle, string[]>,
    apiKey: env.PADDLE_API_KEY || undefined, api: sandbox ? 'https://sandbox-api.paddle.com' : 'https://api.paddle.com',
  } : null;
}

/** HTTP statuses the endpoint answers with. */
const HTTP = { badRequest: 400, unauthorized: 401, notFound: 404, notAllowed: 405, serverError: 500, notImplemented: 501, badGateway: 502, unavailable: 503 } as const;
const HEX_RADIX = 16;
const BYTE_HEX_DIGITS = 2;
const MS_PER_S = 1000;
const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map(b => b.toString(HEX_RADIX).padStart(BYTE_HEX_DIGITS, '0')).join('');
export async function hmac(secret: string, text: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(text)));
}
/** The Paddle-Signature header for a body sent at `ts` (seconds). */
export const signBody = async (secret: string, body: string, ts: number) => `ts=${ts};h1=${await hmac(secret, `${ts}:${body}`)}`;
/** Compares in constant time, so the check leaks nothing about how close a forged signature came. */
function sameHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return [...a].reduce((diff, ch, i) => diff | (ch.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0;
}
/** Signatures older than this are replays. */
const MAX_AGE_MINUTES = 5;
const S_PER_MIN = 60;
const MAX_AGE_S = MAX_AGE_MINUTES * S_PER_MIN;
async function verified(header: string, body: string, secret: string, now: number): Promise<boolean> {
  const parts = Object.fromEntries(header.split(';').map(p => p.split('=') as [string, string]));
  const ts = Number(parts.ts);
  if (!Number.isFinite(ts) || Math.abs(now / MS_PER_S - ts) > MAX_AGE_S) return false;
  const want = await hmac(secret, `${ts}:${body}`);
  // Paddle may send more than one h1 while a secret is being rotated.
  return header.split(';').filter(p => p.startsWith('h1=')).some(p => sameHex(p.slice('h1='.length).toLowerCase(), want));
}

interface Item { price?: { id?: string; product_id?: string } }
interface Subscription {
  id?: string; status?: string; customer_id?: string; updated_at?: string; canceled_at?: string | null;
  current_billing_period?: { ends_at?: string } | null;
  scheduled_change?: { action?: string; effective_at?: string } | null;
  management_urls?: { cancel?: string; update_payment_method?: string | null } | null;
  items?: Item[];
  custom_data?: { user_id?: string } | null;
}
interface Transaction { id?: string; status?: string; customer_id?: string; subscription_id?: string | null; items?: Item[]; custom_data?: { user_id?: string } | null }
interface Adjustment { action?: string; status?: string; type?: string; transaction_id?: string }
interface Payload { event_type?: string; data?: Subscription & Transaction & Adjustment }

// An account id (a UUID): matches "0f3c2a8e-6b1d-4c1e-9a55-3f2b8c7d9e01", rejects "not-a-uuid". https://regex101.com/?regex=%5E%5B0-9a-f%5D%7B8%7D-%5B0-9a-f%5D%7B4%7D-%5B0-9a-f%5D%7B4%7D-%5B0-9a-f%5D%7B4%7D-%5B0-9a-f%5D%7B12%7D%24&testString=0f3c2a8e-6b1d-4c1e-9a55-3f2b8c7d9e01
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A subscription is paid through its billing period (plus a few days for a late renewal webhook). */
const DAY_MS = 86_400_000;
const GRACE_DAYS = 3;
const GRACE_MS = GRACE_DAYS * DAY_MS;
const LIVE = new Set(['active', 'trialing', 'past_due']);
const MONTH_DAYS = 31;

/** How long a monthly pass in this state keeps its perks (null: none). */
export function paidUntil(s: Subscription, now = Date.now()): string | null {
  if (!LIVE.has(s.status ?? '')) return null; // canceled or paused: over
  const end = Date.parse(s.current_billing_period?.ends_at ?? '');
  // Cancelled at the end of the period: exactly to that date, no grace.
  if (s.scheduled_change?.action === 'cancel') return new Date(Date.parse(s.scheduled_change.effective_at ?? '') || end || now).toISOString();
  return new Date((Number.isFinite(end) ? end : now + MONTH_DAYS * DAY_MS) + GRACE_MS).toISOString();
}
/** What the game shows: "cancelled" once a cancel is scheduled, even though Paddle still says active. */
const shownStatus = (s: Subscription) => (s.scheduled_change?.action === 'cancel' && LIVE.has(s.status ?? '') ? 'cancelled' : s.status ?? null);

/** The columns each monthly pass writes. */
// A Paddle transaction id: matches "txn_01h8xyz", rejects "txn_" or "1234". https://regex101.com/?regex=%5Etxn_%5Cw%2B%24&testString=txn_01h8xyz
const TXN_ID = /^txn_\w+$/;
// A Paddle subscription id: matches "sub_01h8xyz", rejects "sub_" or "77". https://regex101.com/?regex=%5Esub_%5Cw%2B%24&testString=sub_01h8xyz
const SUB_ID = /^sub_\w+$/;

const SUB_COLS = {
  supporter: { until: 'supporter_until', status: 'supporter_status', id: 'subscription_id', stamp: 'subscription_updated_at', portal: 'portal_url' },
  noAds: { until: 'no_ads_until', status: 'no_ads_status', id: 'no_ads_subscription_id', stamp: 'no_ads_updated_at', portal: 'no_ads_portal_url' },
} as const;
type SubKind = keyof typeof SUB_COLS;

export async function handleBilling(req: Request, supa: SupaEnv | null, bill: BillingEnv | null, f: Fetch = fetch, now = Date.now()): Promise<Response> {
  try { return await route(req, supa, bill, f, now); }
  catch (e) {
    // An account deleted since checkout (the row's user no longer exists): nothing to record, don't retry.
    if (e instanceof Error && e.message.includes('23503')) return json({ ok: true, ignored: 'no such account' });
    return json({ error: 'Could not record the purchase.' }, HTTP.serverError);
  }
}

async function route(req: Request, supa: SupaEnv | null, bill: BillingEnv | null, f: Fetch, now: number): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'POST only' }, HTTP.notAllowed);
  const action = new URL(req.url).searchParams.get('action');
  if (action === 'cancel') return cancel(req, supa, bill, f, now);
  if (action === 'checkout') return customCheckout(req, supa, bill, f);
  if (!supa || !bill) return json({ error: 'Billing is not set up on this server.' }, HTTP.unavailable);
  const body = await req.text();
  if (!await verified(req.headers.get('paddle-signature') ?? '', body, bill.secret, now)) return json({ error: 'Bad signature' }, HTTP.unauthorized);
  let p: Payload;
  try { p = JSON.parse(body) as Payload; } catch { return json({ error: 'Bad JSON' }, HTTP.badRequest); }
  return record(p, supa, bill, f, now);
}

const productOf = (items: Item[] | undefined) => (items ?? []).map(i => i.price?.product_id ?? '').filter(Boolean);
const bundleOf = (bill: BillingEnv, items: Item[] | undefined) => BUNDLES.find(b => productOf(items).some(id => bill.bundles[b].includes(id)));
const subKindOf = (bill: BillingEnv, items: Item[] | undefined): SubKind | null => {
  const products = productOf(items);
  if (products.some(id => bill.supporter.includes(id))) return 'supporter';
  return products.some(id => bill.noAds.includes(id)) ? 'noAds' : null;
};

async function record(p: Payload, supa: SupaEnv, bill: BillingEnv, f: Fetch, now: number): Promise<Response> {
  const event = p.event_type ?? '';
  const d = p.data ?? {};
  const stampNow = new Date(now).toISOString();

  // A full refund of a bundle, once Paddle approves it: find the order and take the bundle back.
  if (event.startsWith('adjustment.')) {
    if (d.action !== 'refund' || d.status !== 'approved' || d.type !== 'full' || !TXN_ID.test(d.transaction_id ?? '')) return json({ ok: true, ignored: 'not an approved full refund' });
    const rows = await rest(supa, 'GET', `entitlements?bundle_orders->>${d.transaction_id}=not.is.null&select=user_id,bundles,bundle_orders`, undefined, undefined, f) as { user_id: string; bundles: string[] | null; bundle_orders: Record<string, string> | null }[] | null;
    const row = rows?.[0];
    if (!row) return json({ ok: true, ignored: 'not a bundle order' });
    const bundle = row.bundle_orders?.[d.transaction_id!];
    const orders = { ...row.bundle_orders };
    delete orders[d.transaction_id!];
    // Another order of the same bundle keeps it.
    const stillOwned = Object.values(orders).includes(bundle ?? '');
    await upsert(supa, 'entitlements', [{ user_id: row.user_id, bundles: stillOwned ? row.bundles ?? [] : (row.bundles ?? []).filter(b => b !== bundle), bundle_orders: orders, updated_at: stampNow }], 'user_id', f);
    return json({ ok: true, refunded: bundle });
  }

  const userId = d.custom_data?.user_id ?? '';
  // Acknowledge (200) what isn't ours to record, so Paddle doesn't retry it forever.
  if (!UUID.test(userId)) return json({ ok: true, ignored: 'no user_id on the checkout' });
  const base = { user_id: userId, customer_id: d.customer_id ?? null, updated_at: stampNow };

  if (event === 'transaction.completed' || event === 'transaction.paid') {
    // A subscription's payments are recorded from its subscription.* events.
    if (d.subscription_id) return json({ ok: true, ignored: 'subscription payment' });
    const bundle = bundleOf(bill, d.items);
    if (!bundle || !d.id) return json({ ok: true, ignored: 'not a bundle' });
    const rows = await rest(supa, 'GET', `entitlements?user_id=eq.${userId}&select=bundles,bundle_orders`, undefined, undefined, f) as { bundles?: string[] | null; bundle_orders?: Record<string, string> | null }[] | null;
    const had = rows?.[0];
    await upsert(supa, 'entitlements', [{ ...base, bundles: [...new Set([...(had?.bundles ?? []), bundle])], bundle_orders: { ...had?.bundle_orders, [d.id]: bundle } }], 'user_id', f);
    return json({ ok: true, bundle });
  }

  if (event.startsWith('subscription.')) {
    const kind = subKindOf(bill, d.items);
    if (!kind) return json({ ok: true, ignored: 'not a monthly pass' });
    const until = await saveSubscription(supa, kind, base, d, f, now);
    return until === false ? json({ ok: true, ignored: 'stale' }) : json({ ok: true, [kind === 'supporter' ? 'supporterUntil' : 'noAdsUntil']: until });
  }
  return json({ ok: true, ignored: event || 'no event' });
}

/** Records a subscription's state; false when a newer state is already recorded (webhooks can arrive out of order). */
async function saveSubscription(supa: SupaEnv, kind: SubKind, base: Record<string, unknown>, s: Subscription, f: Fetch, now: number): Promise<string | null | false> {
  const col = SUB_COLS[kind];
  const stamp = s.updated_at ?? new Date(now).toISOString();
  const rows = await rest(supa, 'GET', `entitlements?user_id=eq.${base.user_id as string}&select=${col.stamp}`, undefined, undefined, f) as Record<string, string | null>[] | null;
  const seen = rows?.[0]?.[col.stamp];
  if (seen && Date.parse(seen) > Date.parse(stamp)) return false;
  const until = paidUntil(s, now);
  await upsert(supa, 'entitlements', [{
    ...base, [col.until]: until, [col.status]: shownStatus(s), [col.id]: s.id ?? null, [col.stamp]: stamp,
    [col.portal]: s.management_urls?.update_payment_method ?? s.management_urls?.cancel ?? null,
  }], 'user_id', f);
  return until;
}

async function signedInUser(req: Request, supa: SupaEnv, f: Fetch) {
  const token = bearer(req);
  if (!token) return null;
  try { return await getUser(supa, token, f); } catch { return null; }
}
const paddle = (bill: BillingEnv, path: string, body: unknown, f: Fetch) => f(`${bill.api}${path}`, {
  method: 'POST', headers: { Authorization: `Bearer ${bill.apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

/** Cancels the signed-in player's own monthly pass at the end of the period already paid for. */
async function cancel(req: Request, supa: SupaEnv | null, bill: BillingEnv | null, f: Fetch, now: number): Promise<Response> {
  if (!supa || !bill) return json({ error: 'Billing is not set up on this server.' }, HTTP.unavailable);
  if (!bill.apiKey) return json({ error: 'Cancel from the Paddle page.' }, HTTP.notImplemented);
  const user = await signedInUser(req, supa, f);
  if (!user) return json({ error: 'Sign in again, then try once more.' }, HTTP.unauthorized);
  const { kind } = await req.json().catch(() => ({})) as { kind?: string };
  if (kind !== 'supporter' && kind !== 'noAds') return json({ error: 'Unknown pass.' }, HTTP.badRequest);
  const col = SUB_COLS[kind];
  const rows = await rest(supa, 'GET', `entitlements?user_id=eq.${user.id}&select=${col.id}`, undefined, undefined, f) as Record<string, string | null>[] | null;
  const id = rows?.[0]?.[col.id];
  if (!id || !SUB_ID.test(id)) return json({ error: 'No active pass to cancel.' }, HTTP.notFound);
  const res = await paddle(bill, `/subscriptions/${id}/cancel`, { effective_from: 'next_billing_period' }, f);
  if (!res.ok) return json({ error: 'Paddle could not cancel it right now. Try again, or use the link in your Paddle receipt email.' }, HTTP.badGateway);
  const sub = ((await res.json().catch(() => ({}))) as { data?: Subscription }).data ?? { status: 'active', scheduled_change: { action: 'cancel' } };
  const until = await saveSubscription(supa, kind, { user_id: user.id, updated_at: new Date(now).toISOString() }, { ...sub, id }, f, now);
  return json({ ok: true, until: until === false ? null : until });
}

/** Pay what you want: from 99¢ up to this, in whole cents. */
export const CUSTOM_MIN_CENTS = 99;
export const CUSTOM_MAX_CENTS = 50_000;
/** Creates a one-off transaction for the Custom Support Bundle at the player's chosen amount; the game opens it. */
async function customCheckout(req: Request, supa: SupaEnv | null, bill: BillingEnv | null, f: Fetch): Promise<Response> {
  if (!supa || !bill) return json({ error: 'Billing is not set up on this server.' }, HTTP.unavailable);
  const product = bill.bundles.bundleCustom[0];
  if (!bill.apiKey || !product) return json({ error: 'Custom amounts are not set up.' }, HTTP.notImplemented);
  const user = await signedInUser(req, supa, f);
  if (!user) return json({ error: 'Sign in again, then try once more.' }, HTTP.unauthorized);
  const { cents } = await req.json().catch(() => ({})) as { cents?: number };
  if (!Number.isInteger(cents) || cents! < CUSTOM_MIN_CENTS || cents! > CUSTOM_MAX_CENTS) return json({ error: 'Pick an amount from $0.99 to $500.' }, HTTP.badRequest);
  const res = await paddle(bill, '/transactions', {
    items: [{ quantity: 1, price: { product_id: product, description: 'Custom Support Bundle', name: 'Custom Support Bundle', tax_mode: 'account_setting', unit_price: { amount: String(cents), currency_code: 'USD' } } }],
    custom_data: { user_id: user.id }, ...(user.email ? { customer: { email: user.email } } : {}),
  }, f);
  const body = await res.json().catch(() => ({})) as { data?: { id?: string } };
  if (!res.ok || !body.data?.id) return json({ error: 'Paddle could not start the checkout. Try again in a minute.' }, HTTP.badGateway);
  return json({ ok: true, transactionId: body.data.id });
}
