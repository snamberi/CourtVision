import { rest, upsert, json, bearer, getUser, type SupaEnv, type Fetch } from './supabase';

/*
 * /api/billing: the Lemon Squeezy webhook. Lemon Squeezy is the merchant of record (it takes the payment, handles tax
 * and refunds); this only records what a signed-in player owns, in public.entitlements, which the game reads back.
 *
 *   Supporter Pass, No-Ads Pass   monthly subscriptions   subscription_* → supporter_until / no_ads_until (paid-through)
 *   Supporter, Visionary, Eternal Founder, Custom Support bundles   one-time   order_created → bundles; order_refunded → removed
 *   No-Ads Pass from before it was monthly   one-time   order_created → no_ads (lifetime); order_refunded → taken back
 *
 * Every request must carry X-Signature, the HMAC-SHA256 of the raw body with the webhook's signing secret. The buyer
 * is the checkout's custom user_id (the game adds it to the checkout link), never an email match.
 *
 * /api/billing?action=cancel (POST, the player's access token) cancels that player's own monthly pass through the
 * Lemon Squeezy API, so the game can offer a one-tap cancel. It needs LEMONSQUEEZY_API_KEY; without it the game
 * opens Lemon Squeezy's customer portal instead.
 */

export const BUNDLES = ['bundleSupporter', 'bundleVisionary', 'bundleFounder', 'bundleCustom'] as const;
export type Bundle = typeof BUNDLES[number];
export interface BillingEnv {
  secret: string;
  /** Variant ids (comma lists allowed) of each product, from the Lemon Squeezy dashboard. */
  noAds: string[];
  supporter: string[];
  /** The old one-time No-Ads Pass, for refunds and any sales still open. */
  noAdsLifetime: string[];
  bundles: Record<Bundle, string[]>;
  /** An API key, for cancelling from the game. */
  apiKey?: string;
}
type Env = Record<string, string | undefined>;
const ids = (v: string | undefined) => (v ?? '').split(',').map(s => s.trim()).filter(Boolean);
const BUNDLE_ENV: Record<Bundle, string> = { bundleSupporter: 'SUPPORTER', bundleVisionary: 'VISIONARY', bundleFounder: 'FOUNDER', bundleCustom: 'CUSTOM' };
export function billingEnv(env: Env = (globalThis as { process?: { env: Env } }).process?.env ?? {}): BillingEnv | null {
  const secret = env.LEMONSQUEEZY_WEBHOOK_SECRET;
  return secret ? {
    secret, noAds: ids(env.LEMONSQUEEZY_NO_ADS_VARIANT_ID), supporter: ids(env.LEMONSQUEEZY_SUPPORTER_VARIANT_ID), noAdsLifetime: ids(env.LEMONSQUEEZY_NO_ADS_LIFETIME_VARIANT_ID),
    bundles: Object.fromEntries(BUNDLES.map(b => [b, ids(env[`LEMONSQUEEZY_BUNDLE_${BUNDLE_ENV[b]}_VARIANT_ID`])])) as Record<Bundle, string[]>,
    apiKey: env.LEMONSQUEEZY_API_KEY || undefined,
  } : null;
}

/** The columns each monthly pass writes. */
const SUB_COLS = {
  supporter: { until: 'supporter_until', status: 'supporter_status', id: 'subscription_id', stamp: 'subscription_updated_at', portal: 'portal_url' },
  noAds: { until: 'no_ads_until', status: 'no_ads_status', id: 'no_ads_subscription_id', stamp: 'no_ads_updated_at', portal: 'no_ads_portal_url' },
} as const;
type SubKind = keyof typeof SUB_COLS;

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
export async function signBody(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(body)));
}
/** Compares in constant time, so the check leaks nothing about how close a forged signature came. */
function sameHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

interface Attributes {
  status?: string;
  variant_id?: number | string;
  first_order_item?: { variant_id?: number | string };
  customer_id?: number | string;
  renews_at?: string | null;
  ends_at?: string | null;
  updated_at?: string;
  urls?: { customer_portal?: string };
}
interface Payload { meta?: { event_name?: string; custom_data?: { user_id?: string } }; data?: { id?: string; type?: string; attributes?: Attributes } }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A subscription is paid through its renewal date (plus a few days for a late renewal webhook). */
const GRACE_MS = 3 * 86_400_000;
const LIVE = new Set(['active', 'on_trial', 'past_due']);

/** How long a Supporter subscription in this state keeps its perks (null: none). */
export function supporterUntil(a: Attributes, now = Date.now()): string | null {
  const t = (s?: string | null) => (s ? Date.parse(s) : NaN);
  if (LIVE.has(a.status ?? '')) {
    const renew = t(a.renews_at);
    return new Date((Number.isFinite(renew) ? renew : now + 31 * 86_400_000) + GRACE_MS).toISOString();
  }
  // Cancelled: paid up to the end of the period; expired, unpaid or paused: over.
  if (a.status === 'cancelled' && Number.isFinite(t(a.ends_at))) return new Date(t(a.ends_at)).toISOString();
  return null;
}

export async function handleBilling(req: Request, supa: SupaEnv | null, bill: BillingEnv | null, f: Fetch = fetch, now = Date.now()): Promise<Response> {
  try { return await record(req, supa, bill, f, now); }
  catch (e) {
    // An account deleted since checkout (the row's user no longer exists): nothing to record, don't retry.
    if (e instanceof Error && e.message.includes('23503')) return json({ ok: true, ignored: 'no such account' });
    return json({ error: 'Could not record the purchase.' }, 500);
  }
}

async function record(req: Request, supa: SupaEnv | null, bill: BillingEnv | null, f: Fetch, now: number): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (new URL(req.url).searchParams.get('action') === 'cancel') return cancel(req, supa, bill, f, now);
  if (!supa || !bill) return json({ error: 'Billing is not set up on this server.' }, 503);
  const body = await req.text();
  const sig = (req.headers.get('x-signature') ?? '').toLowerCase();
  if (!sig || !sameHex(sig, await signBody(bill.secret, body))) return json({ error: 'Bad signature' }, 401);

  let p: Payload;
  try { p = JSON.parse(body) as Payload; } catch { return json({ error: 'Bad JSON' }, 400); }
  const event = p.meta?.event_name ?? '';
  const userId = p.meta?.custom_data?.user_id ?? '';
  const a = p.data?.attributes ?? {};
  // Acknowledge (200) what isn't ours to record, so Lemon Squeezy doesn't retry it forever.
  if (!UUID.test(userId)) return json({ ok: true, ignored: 'no user_id on the checkout' });
  const variant = String(a.first_order_item?.variant_id ?? a.variant_id ?? '');
  const base = { user_id: userId, customer_id: a.customer_id != null ? String(a.customer_id) : null, updated_at: new Date(now).toISOString() };

  if (event === 'order_created' || event === 'order_refunded') {
    const owned = event === 'order_created' && a.status !== 'refunded';
    const bundle = BUNDLES.find(b => bill.bundles[b].includes(variant));
    if (bundle) {
      const rows = await rest(supa, 'GET', `entitlements?user_id=eq.${userId}&select=bundles`, undefined, undefined, f) as { bundles?: string[] | null }[] | null;
      const had = rows?.[0]?.bundles ?? [];
      const next = owned ? [...new Set([...had, bundle])] : had.filter(b => b !== bundle);
      await upsert(supa, 'entitlements', [{ ...base, bundles: next }], 'user_id', f);
      return json({ ok: true, bundle, owned });
    }
    if (!bill.noAdsLifetime.includes(variant)) return json({ ok: true, ignored: 'not a one-time product (subscriptions are recorded from subscription_* events)' });
    await upsert(supa, 'entitlements', [{ ...base, no_ads: owned, no_ads_order: p.data?.id ?? null }], 'user_id', f);
    return json({ ok: true, noAds: owned });
  }

  if (event.startsWith('subscription_')) {
    const kind: SubKind | null = bill.supporter.includes(variant) ? 'supporter' : bill.noAds.includes(variant) ? 'noAds' : null;
    if (!kind) return json({ ok: true, ignored: 'not a monthly pass' });
    // Payment events carry an invoice, not the subscription; the subscription_updated that follows has the dates.
    if (p.data?.type !== 'subscriptions') return json({ ok: true, ignored: 'not a subscription object' });
    const until = await saveSubscription(supa, kind, base, p.data?.id ?? null, a, f, now);
    return until === false ? json({ ok: true, ignored: 'stale' }) : json({ ok: true, [kind === 'supporter' ? 'supporterUntil' : 'noAdsUntil']: until });
  }
  return json({ ok: true, ignored: event || 'no event' });
}

/** Records a subscription's state; false when a newer state is already recorded (webhooks can arrive out of order). */
async function saveSubscription(supa: SupaEnv, kind: SubKind, base: Record<string, unknown>, id: string | null, a: Attributes, f: Fetch, now: number): Promise<string | null | false> {
  const col = SUB_COLS[kind];
  const stamp = a.updated_at ?? new Date(now).toISOString();
  const rows = await rest(supa, 'GET', `entitlements?user_id=eq.${base.user_id as string}&select=${col.stamp}`, undefined, undefined, f) as Record<string, string | null>[] | null;
  const seen = rows?.[0]?.[col.stamp];
  if (seen && Date.parse(seen) > Date.parse(stamp)) return false;
  const until = supporterUntil(a, now);
  await upsert(supa, 'entitlements', [{
    ...base, [col.until]: until, [col.status]: a.status ?? null, [col.id]: id, [col.stamp]: stamp, [col.portal]: a.urls?.customer_portal ?? null,
  }], 'user_id', f);
  return until;
}

/** Cancels the signed-in player's own monthly pass. The perks stay until the end of the period already paid for. */
async function cancel(req: Request, supa: SupaEnv | null, bill: BillingEnv | null, f: Fetch, now: number): Promise<Response> {
  if (!supa || !bill) return json({ error: 'Billing is not set up on this server.' }, 503);
  if (!bill.apiKey) return json({ error: 'Cancel from the Lemon Squeezy page.' }, 501);
  const token = bearer(req);
  const user = token ? await getUser(supa, token, f).catch(() => null) : null;
  if (!user) return json({ error: 'Sign in again, then try once more.' }, 401);
  const { kind } = await req.json().catch(() => ({})) as { kind?: string };
  if (kind !== 'supporter' && kind !== 'noAds') return json({ error: 'Unknown pass.' }, 400);
  const col = SUB_COLS[kind];
  const rows = await rest(supa, 'GET', `entitlements?user_id=eq.${user.id}&select=${col.id}`, undefined, undefined, f) as Record<string, string | null>[] | null;
  const id = rows?.[0]?.[col.id];
  if (!id || !/^\d+$/.test(id)) return json({ error: 'No active pass to cancel.' }, 404);
  const res = await f(`https://api.lemonsqueezy.com/v1/subscriptions/${id}`, {
    method: 'DELETE', headers: { Accept: 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json', Authorization: `Bearer ${bill.apiKey}` },
  });
  if (!res.ok) return json({ error: 'Lemon Squeezy could not cancel it right now. Try again, or use Manage on the Lemon Squeezy page.' }, 502);
  const body = await res.json().catch(() => ({})) as { data?: { attributes?: Attributes } };
  const until = await saveSubscription(supa, kind, { user_id: user.id, updated_at: new Date(now).toISOString() }, id, body.data?.attributes ?? { status: 'cancelled' }, f, now);
  return json({ ok: true, until: until === false ? null : until });
}
