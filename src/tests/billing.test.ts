// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { handleBilling, signBody, supporterUntil, billingEnv, type BillingEnv } from '../../server/billing';
import type { SupaEnv } from '../../server/supabase';
import { fromRow, checkoutUrl, writeEntitlements, readEntitlements, activeProducts } from '../billing/billing';
import { hasEntitlement, unlockContext, isOpen, earnedExtraTitles, ICONS, NAME_COLORS, ENTITLEMENTS_KEY } from '../profile/cosmetics';
import { PRODUCTS } from '../billing/products';
import 'fake-indexeddb/auto';
import { buildBackup } from '../storage/backup';

const supa: SupaEnv = { url: 'http://db', serviceKey: 'service', publicKey: 'anon' };
const bill: BillingEnv = { secret: 'shh', noAds: ['333'], noAdsLifetime: ['111'], supporter: ['222', '223'], bundles: { bundleSupporter: ['401'], bundleVisionary: ['402'], bundleFounder: ['403'], bundleCustom: ['404'] }, apiKey: 'ls-key' };
const USER = '0f3c2a8e-6b1d-4c1e-9a55-3f2b8c7d9e01';
const NOW = Date.parse('2026-09-28T12:00:00Z');

/** A fake PostgREST: one entitlements table keyed by user. */
function fakeDb() {
  const rows = new Map<string, Record<string, unknown>>();
  const calls: string[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    const u = new URL(url);
    calls.push(`${init?.method ?? 'GET'} ${u.host}${u.pathname}`);
    // The signed-in player behind a token, and Lemon Squeezy's cancel.
    if (u.pathname === '/auth/v1/user') return new Response(JSON.stringify(new Headers(init?.headers).get('authorization') === 'Bearer good' ? { id: USER } : {}), { status: new Headers(init?.headers).get('authorization') === 'Bearer good' ? 200 : 401 });
    if (u.host === 'api.lemonsqueezy.com') return new Response(JSON.stringify({ data: { attributes: { status: 'cancelled', ends_at: '2026-10-20T12:00:00Z', updated_at: '2026-09-28T12:00:00Z' } } }), { status: 200 });
    if (init?.method === 'GET') {
      const id = u.searchParams.get('user_id')?.replace('eq.', '') ?? '';
      return new Response(JSON.stringify(rows.has(id) ? [rows.get(id)] : []), { status: 200 });
    }
    for (const r of JSON.parse(String(init?.body)) as Record<string, unknown>[]) rows.set(String(r.user_id), { ...rows.get(String(r.user_id)), ...r });
    return new Response('', { status: 201 });
  }) as typeof fetch;
  return { rows, f, calls };
}
async function hook(payload: unknown, db: ReturnType<typeof fakeDb>, secret = bill.secret) {
  const body = JSON.stringify(payload);
  const req = new Request('http://x/api/billing', { method: 'POST', body, headers: { 'X-Signature': await signBody(secret, body) } });
  const res = await handleBilling(req, supa, bill, db.f, NOW);
  return { status: res.status, body: await res.json() as Record<string, unknown> };
}
const order = (event: string, variant = 111, user = USER, status = 'paid') => ({ meta: { event_name: event, custom_data: { user_id: user } }, data: { type: 'orders', id: '9001', attributes: { status, customer_id: 5, first_order_item: { variant_id: variant } } } });
const sub = (event: string, attrs: Record<string, unknown>) => ({ meta: { event_name: event, custom_data: { user_id: USER } }, data: { type: 'subscriptions', id: '77', attributes: { variant_id: 222, customer_id: 5, urls: { customer_portal: 'https://shop/portal' }, ...attrs } } });

describe('Lemon Squeezy webhook', () => {
  it('rejects a missing or forged signature, and answers 503 when billing is not configured', async () => {
    const db = fakeDb();
    expect((await hook(order('order_created'), db, 'wrong')).status).toBe(401);
    const res = await handleBilling(new Request('http://x', { method: 'POST', body: '{}' }), supa, bill, db.f, NOW);
    expect(res.status).toBe(401);
    expect((await handleBilling(new Request('http://x', { method: 'POST', body: '{}' }), supa, null, db.f)).status).toBe(503);
    expect(db.rows.size).toBe(0);
    expect(billingEnv({})).toBeNull();
    expect(billingEnv({ LEMONSQUEEZY_WEBHOOK_SECRET: 's', LEMONSQUEEZY_SUPPORTER_VARIANT_ID: '1, 2' })?.supporter).toEqual(['1', '2']);
  });

  it('the old lifetime No-Ads Pass: an order grants it, a refund takes it back; other products and anonymous checkouts are ignored', async () => {
    const db = fakeDb();
    expect((await hook(order('order_created'), db)).body.noAds).toBe(true);
    expect(db.rows.get(USER)).toMatchObject({ no_ads: true, no_ads_order: '9001', customer_id: '5' });
    expect((await hook(order('order_created', 999), db)).body.ignored).toBeTruthy();
    expect((await hook(order('order_created', 111, 'not-a-uuid'), db)).body.ignored).toBeTruthy();
    // The supporter subscription's first order doesn't grant the one-time pass.
    expect((await hook(order('order_created', 222), db)).body.ignored).toBeTruthy();
    await hook(order('order_refunded', 111, USER, 'refunded'), db);
    expect(db.rows.get(USER)!.no_ads).toBe(false);
    expect(db.rows.size).toBe(1);
  });

  it('Supporter Pass: active until renewal (plus grace), cancelled until the period ends, expired over; stale events skipped', async () => {
    const db = fakeDb();
    await hook(sub('subscription_created', { status: 'active', renews_at: '2026-10-28T12:00:00Z', updated_at: '2026-09-28T12:00:00Z' }), db);
    const row = db.rows.get(USER)!;
    expect(Date.parse(String(row.supporter_until))).toBeGreaterThan(Date.parse('2026-10-28T12:00:00Z'));
    expect(row).toMatchObject({ supporter_status: 'active', portal_url: 'https://shop/portal', subscription_id: '77' });
    await hook(sub('subscription_cancelled', { status: 'cancelled', ends_at: '2026-10-28T12:00:00Z', updated_at: '2026-09-29T12:00:00Z' }), db);
    expect(db.rows.get(USER)).toMatchObject({ supporter_until: '2026-10-28T12:00:00.000Z', supporter_status: 'cancelled' });
    // An older "active" arriving late doesn't undo the cancellation.
    expect((await hook(sub('subscription_updated', { status: 'active', renews_at: '2026-10-28T12:00:00Z', updated_at: '2026-09-28T13:00:00Z' }), db)).body.ignored).toBe('stale');
    await hook(sub('subscription_expired', { status: 'expired', ends_at: '2026-10-28T12:00:00Z', updated_at: '2026-10-28T12:00:01Z' }), db);
    expect(db.rows.get(USER)!.supporter_until).toBeNull();
    // A second supporter variant (say, yearly) counts too; the one-time pass's variant doesn't.
    expect((await hook({ ...sub('subscription_created', { status: 'active', variant_id: 111 }) }, db)).body.ignored).toBeTruthy();
    expect(supporterUntil({ status: 'past_due', renews_at: '2026-10-01T00:00:00Z' }, NOW)).not.toBeNull();
    expect(supporterUntil({ status: 'paused' }, NOW)).toBeNull();
  });

  it('monthly No-Ads Pass: recorded in its own columns, never as a lifetime pass', async () => {
    const db = fakeDb();
    // Its first order is not a lifetime grant.
    expect((await hook(order('order_created', 333), db)).body.ignored).toBeTruthy();
    await hook(sub('subscription_created', { variant_id: 333, status: 'active', renews_at: '2026-10-28T12:00:00Z', updated_at: '2026-09-28T12:00:00Z' }), db);
    expect(db.rows.get(USER)).toMatchObject({ no_ads_status: 'active', no_ads_subscription_id: '77', no_ads_portal_url: 'https://shop/portal' });
    expect(db.rows.get(USER)!.no_ads).toBeUndefined();
    expect(db.rows.get(USER)!.supporter_until).toBeUndefined();
    expect(Date.parse(String(db.rows.get(USER)!.no_ads_until))).toBeGreaterThan(Date.parse('2026-10-28T12:00:00Z'));
  });

  it('bundles: each order adds its bundle for good, a refund removes only that one', async () => {
    const db = fakeDb();
    expect((await hook(order('order_created', 401), db)).body).toMatchObject({ bundle: 'bundleSupporter', owned: true });
    await hook(order('order_created', 403), db);
    await hook(order('order_created', 403), db); // a second purchase of the same bundle
    expect(db.rows.get(USER)!.bundles).toEqual(['bundleSupporter', 'bundleFounder']);
    await hook(order('order_refunded', 401, USER, 'refunded'), db);
    expect(db.rows.get(USER)!.bundles).toEqual(['bundleFounder']);
  });

  it("cancel: only the signed-in player's own pass, through the Lemon Squeezy API; without an API key the game uses the portal", async () => {
    const db = fakeDb();
    await hook(sub('subscription_created', { status: 'active', renews_at: '2026-10-28T12:00:00Z', updated_at: '2026-09-27T12:00:00Z' }), db);
    const ask = (token: string, kind: string, b = bill) => handleBilling(new Request('http://x/api/billing?action=cancel', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ kind }) }), supa, b, db.f, NOW);
    expect((await ask('bad', 'supporter')).status).toBe(401);
    expect((await ask('good', 'noAds')).status).toBe(404); // has no No-Ads Pass
    expect((await ask('good', 'supporter', { ...bill, apiKey: undefined })).status).toBe(501);
    const res = await ask('good', 'supporter');
    expect(res.status).toBe(200);
    expect(db.calls).toContain('DELETE api.lemonsqueezy.com/v1/subscriptions/77');
    expect(db.rows.get(USER)).toMatchObject({ supporter_status: 'cancelled', supporter_until: '2026-10-20T12:00:00.000Z' });
  });
});

describe('passes in the game', () => {
  beforeEach(() => localStorage.clear());

  it('reads a row into what the game unlocks, and a lapsed supporter pass ends on its date', () => {
    expect(fromRow(null)).toEqual({ noAds: false, supporter: false });
    expect(fromRow({ no_ads: true, supporter_until: null, supporter_status: null, portal_url: null }).noAds).toBe(true);
    const later = new Date(Date.now() + 86_400_000).toISOString(), earlier = new Date(Date.now() - 1000).toISOString();
    expect(fromRow({ no_ads: false, supporter_until: later, supporter_status: 'active', portal_url: 'p' }).supporter).toBe(true);
    expect(fromRow({ no_ads: false, supporter_until: earlier, supporter_status: 'cancelled', portal_url: 'p' }).supporter).toBe(false);
    writeEntitlements({ noAds: false, supporter: true, supporterUntil: later });
    expect(hasEntitlement('supporter')).toBe(true);
    expect(hasEntitlement('noAds')).toBe(true); // supporters see no ads
    expect(unlockContext(1).supporter).toBe(true);
    writeEntitlements({ noAds: false, supporter: true, supporterUntil: earlier });
    expect(hasEntitlement('supporter')).toBe(false);
    writeEntitlements(null);
    expect(localStorage.getItem(ENTITLEMENTS_KEY)).toBeNull();
    expect(readEntitlements()).toEqual({ noAds: false, supporter: false });
  });

  it('passes stay with the account: backups leave them out', async () => {
    writeEntitlements({ noAds: true, supporter: false });
    localStorage.setItem('cv-profile-seen-level', '3');
    const backup = JSON.stringify(await buildBackup());
    expect(backup).toContain('cv-profile-seen-level');
    expect(backup).not.toContain(ENTITLEMENTS_KEY);
  });

  it('the checkout link carries the account id (and email) for the webhook, or is absent when not on sale', () => {
    // No checkout links in the test build.
    expect(checkoutUrl('noAds', USER)).toBeNull();
  });

  it('every product has its own icon, name colour and title, unlocked only while owned', () => {
    const later = new Date(Date.now() + 86_400_000).toISOString();
    for (const p of PRODUCTS.filter(x => x.id !== 'supporter')) {
      const icons = ICONS.filter(i => 'product' in i.rule && i.rule.product === p.id), colors = NAME_COLORS.filter(c => 'product' in c.rule && c.rule.product === p.id);
      expect(icons).toHaveLength(1);
      expect(colors).toHaveLength(1);
      expect(isOpen(icons[0].rule, unlockContext(1))).toBe(false);
    }
    expect(new Set(PRODUCTS.map(p => p.title)).size).toBe(PRODUCTS.length);
    writeEntitlements({ noAds: false, supporter: false, noAdsUntil: later, bundles: ['bundleFounder'] });
    const c = unlockContext(1);
    expect(c.products).toEqual(['noAds', 'bundleFounder']);
    expect(earnedExtraTitles(c)).toEqual(expect.arrayContaining(['Ad-Free Baller', 'Eternal Founder']));
    expect(earnedExtraTitles(c)).not.toContain('Visionary');
    expect(hasEntitlement('noAds')).toBe(true);
    // A monthly No-Ads Pass ends on its date.
    writeEntitlements({ noAds: false, supporter: false, noAdsUntil: new Date(Date.now() - 1000).toISOString(), bundles: ['bundleCustom'] });
    expect(hasEntitlement('noAds')).toBe(false);
    expect(activeProducts(readEntitlements())).toEqual(['bundleCustom']);
    expect(fromRow({ no_ads: false, supporter_until: null, supporter_status: null, portal_url: null, bundles: ['bundleVisionary', 'junk'] }).bundles).toEqual(['bundleVisionary']);
  });
});
