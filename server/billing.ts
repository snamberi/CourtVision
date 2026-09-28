import { rest, upsert, json, type SupaEnv, type Fetch } from './supabase';

/*
 * /api/billing: the Lemon Squeezy webhook. Lemon Squeezy is the merchant of record (it takes the payment, handles tax
 * and refunds); this only records what a signed-in player owns, in public.entitlements, which the game reads back.
 *
 *   No-Ads Pass     one-time order        order_created → no_ads; order_refunded → taken back
 *   Supporter Pass  monthly subscription  subscription_* → supporter_until (paid-through date; ads off too)
 *
 * Every request must carry X-Signature, the HMAC-SHA256 of the raw body with the webhook's signing secret. The buyer
 * is the checkout's custom user_id (the game adds it to the checkout link), never an email match.
 */

export interface BillingEnv {
  secret: string;
  /** Variant ids (comma lists allowed) of each pass, from the Lemon Squeezy dashboard. */
  noAds: string[];
  supporter: string[];
}
type Env = Record<string, string | undefined>;
const ids = (v: string | undefined) => (v ?? '').split(',').map(s => s.trim()).filter(Boolean);
export function billingEnv(env: Env = (globalThis as { process?: { env: Env } }).process?.env ?? {}): BillingEnv | null {
  const secret = env.LEMONSQUEEZY_WEBHOOK_SECRET;
  return secret ? { secret, noAds: ids(env.LEMONSQUEEZY_NO_ADS_VARIANT_ID), supporter: ids(env.LEMONSQUEEZY_SUPPORTER_VARIANT_ID) } : null;
}

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
    if (!bill.noAds.includes(variant)) return json({ ok: true, ignored: 'not the No-Ads Pass' });
    const owned = event === 'order_created' && a.status !== 'refunded';
    await upsert(supa, 'entitlements', [{ ...base, no_ads: owned, no_ads_order: p.data?.id ?? null }], 'user_id', f);
    return json({ ok: true, noAds: owned });
  }

  if (event.startsWith('subscription_')) {
    if (!bill.supporter.includes(variant)) return json({ ok: true, ignored: 'not the Supporter Pass' });
    // Payment events carry an invoice, not the subscription; the subscription_updated that follows has the dates.
    if (p.data?.type !== 'subscriptions') return json({ ok: true, ignored: 'not a subscription object' });
    // Webhooks can arrive out of order: never let an older state overwrite a newer one.
    const stamp = a.updated_at ?? new Date(now).toISOString();
    const rows = await rest(supa, 'GET', `entitlements?user_id=eq.${userId}&select=subscription_updated_at`, undefined, undefined, f) as { subscription_updated_at?: string | null }[] | null;
    const seen = rows?.[0]?.subscription_updated_at;
    if (seen && Date.parse(seen) > Date.parse(stamp)) return json({ ok: true, ignored: 'stale' });
    const until = supporterUntil(a, now);
    await upsert(supa, 'entitlements', [{
      ...base, supporter_until: until, supporter_status: a.status ?? null, subscription_id: p.data?.id ?? null,
      subscription_updated_at: stamp, portal_url: a.urls?.customer_portal ?? null,
    }], 'user_id', f);
    return json({ ok: true, supporterUntil: until });
  }
  return json({ ok: true, ignored: event || 'no event' });
}
