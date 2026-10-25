// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { handleBilling, signBody, paidUntil, billingEnv, type BillingEnv } from '../../server/billing';
import type { SupaEnv } from '../../server/supabase';
import { fromRow, openCheckout, writeEntitlements, readEntitlements, activeProducts } from '../billing/billing';
import { hasEntitlement, unlockContext, isOpen, earnedExtraTitles, ICONS, NAME_COLORS, ENTITLEMENTS_KEY } from '../profile/cosmetics';
import { PRODUCTS } from '../billing/products';
import 'fake-indexeddb/auto';
import { buildBackup } from '../storage/backup';

const supa: SupaEnv = { url: 'http://db', serviceKey: 'service', publicKey: 'anon' };
const bill: BillingEnv = {
  secret: 'shh', noAds: ['pro_noads'], supporter: ['pro_sup', 'pro_sup_yearly'],
  bundles: { bundleSupporter: ['pro_b1'], bundleVisionary: ['pro_b2'], bundleFounder: ['pro_b3'], bundleCustom: ['pro_b4'] },
  apiKey: 'pdl_key', api: 'https://sandbox-api.paddle.com',
};
const USER = '0f3c2a8e-6b1d-4c1e-9a55-3f2b8c7d9e01';
const NOW = Date.parse('2026-09-28T12:00:00Z');
const TS = NOW / 1000;

/** A fake PostgREST (one entitlements table keyed by user), Supabase auth and the Paddle API. */
function fakeDb() {
  const rows = new Map<string, Record<string, unknown>>();
  const calls: { url: string; body?: unknown }[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    const u = new URL(url);
    calls.push({ url: `${init?.method ?? 'GET'} ${u.host}${u.pathname}`, body: init?.body ? JSON.parse(String(init.body)) as unknown : undefined });
    const auth = new Headers(init?.headers).get('authorization');
    if (u.pathname === '/auth/v1/user') return new Response(JSON.stringify(auth === 'Bearer good' ? { id: USER, email: 'gm@x.com' } : {}), { status: auth === 'Bearer good' ? 200 : 401 });
    if (u.host === 'sandbox-api.paddle.com' && u.pathname.endsWith('/cancel')) return new Response(JSON.stringify({ data: { status: 'active', current_billing_period: { ends_at: '2026-10-20T12:00:00Z' }, scheduled_change: { action: 'cancel', effective_at: '2026-10-20T12:00:00Z' }, updated_at: '2026-09-28T12:00:00Z' } }), { status: 200 });
    if (u.host === 'sandbox-api.paddle.com' && u.pathname === '/transactions') return new Response(JSON.stringify({ data: { id: 'txn_custom1' } }), { status: 201 });
    if (init?.method === 'GET') {
      const id = u.searchParams.get('user_id')?.replace('eq.', '');
      const txn = [...u.searchParams.keys()].find(k => k.startsWith('bundle_orders->>'))?.slice('bundle_orders->>'.length);
      const found = id ? (rows.has(id) ? [rows.get(id)] : []) : [...rows.values()].filter(r => txn && (r.bundle_orders as Record<string, string> | undefined)?.[txn]);
      return new Response(JSON.stringify(found), { status: 200 });
    }
    for (const r of JSON.parse(String(init?.body)) as Record<string, unknown>[]) rows.set(String(r.user_id), { ...rows.get(String(r.user_id)), ...r });
    return new Response('', { status: 201 });
  }) as typeof fetch;
  return { rows, f, calls };
}
async function hook(payload: unknown, db: ReturnType<typeof fakeDb>, secret = bill.secret, ts = TS) {
  const body = JSON.stringify(payload);
  const req = new Request('http://x/api/billing', { method: 'POST', body, headers: { 'Paddle-Signature': await signBody(secret, body, ts) } });
  const res = await handleBilling(req, supa, bill, db.f, NOW);
  return { status: res.status, body: await res.json() as Record<string, unknown> };
}
const items = (product: string) => [{ price: { id: 'pri_x', product_id: product } }];
const txn = (product: string, id = 'txn_1', user = USER, sub: string | null = null) => ({ event_type: 'transaction.completed', data: { id, status: 'completed', customer_id: 'ctm_1', subscription_id: sub, items: items(product), custom_data: { user_id: user } } });
const sub = (event: string, attrs: Record<string, unknown>, product = 'pro_sup') => ({ event_type: event, data: { id: 'sub_77', customer_id: 'ctm_1', items: items(product), custom_data: { user_id: USER }, management_urls: { update_payment_method: 'https://pdl/update', cancel: 'https://pdl/cancel' }, ...attrs } });
const refund = (transaction: string, status = 'approved', type = 'full') => ({ event_type: 'adjustment.updated', data: { action: 'refund', status, type, transaction_id: transaction } });
const period = (ends: string) => ({ current_billing_period: { ends_at: ends } });

describe('Paddle webhook', () => {
  it('rejects a missing, forged or replayed signature, and answers 503 when billing is not configured', async () => {
    const db = fakeDb();
    expect((await hook(txn('pro_b1'), db, 'wrong')).status).toBe(401);
    expect((await hook(txn('pro_b1'), db, bill.secret, TS - 3600)).status).toBe(401);
    expect((await handleBilling(new Request('http://x', { method: 'POST', body: '{}' }), supa, bill, db.f, NOW)).status).toBe(401);
    expect((await handleBilling(new Request('http://x', { method: 'POST', body: '{}' }), supa, null, db.f)).status).toBe(503);
    expect(db.rows.size).toBe(0);
    expect(billingEnv({})).toBeNull();
    const env = billingEnv({ PADDLE_WEBHOOK_SECRET: 's', PADDLE_PRODUCT_SUPPORTER: 'pro_a, pro_b', PADDLE_PRODUCT_BUNDLE_FOUNDER: 'pro_f', PADDLE_ENV: 'sandbox' });
    expect(env?.supporter).toEqual(['pro_a', 'pro_b']);
    expect(env?.bundles.bundleFounder).toEqual(['pro_f']);
    expect(env?.api).toBe('https://sandbox-api.paddle.com');
  });

  it('bundles: each purchase adds its bundle for good, an approved full refund removes only that one', async () => {
    const db = fakeDb();
    expect((await hook(txn('pro_b1', 'txn_1'), db)).body).toMatchObject({ bundle: 'bundleSupporter' });
    await hook(txn('pro_b3', 'txn_2'), db);
    expect(db.rows.get(USER)).toMatchObject({ bundles: ['bundleSupporter', 'bundleFounder'], customer_id: 'ctm_1' });
    expect((await hook(txn('pro_other'), db)).body.ignored).toBeTruthy();
    expect((await hook(txn('pro_b1', 'txn_9', 'not-a-uuid'), db)).body.ignored).toBeTruthy();
    // A pending or partial refund changes nothing.
    await hook(refund('txn_1', 'pending_approval'), db);
    await hook(refund('txn_1', 'approved', 'partial'), db);
    expect(db.rows.get(USER)!.bundles).toEqual(['bundleSupporter', 'bundleFounder']);
    expect((await hook(refund('txn_1'), db)).body.refunded).toBe('bundleSupporter');
    expect(db.rows.get(USER)!.bundles).toEqual(['bundleFounder']);
    expect((await hook(refund('txn_unknown'), db)).body.ignored).toBeTruthy();
  });

  it('a subscription payment is not a bundle', async () => {
    const db = fakeDb();
    expect((await hook(txn('pro_sup', 'txn_3', USER, 'sub_77'), db)).body.ignored).toBe('subscription payment');
    expect(db.rows.size).toBe(0);
  });

  it('Supporter Pass: active to the period end (plus grace), cancelled to the period end, canceled over; stale events skipped', async () => {
    const db = fakeDb();
    await hook(sub('subscription.created', { status: 'active', ...period('2026-10-28T12:00:00Z'), updated_at: '2026-09-28T12:00:00Z' }), db);
    const row = db.rows.get(USER)!;
    expect(Date.parse(String(row.supporter_until))).toBeGreaterThan(Date.parse('2026-10-28T12:00:00Z'));
    expect(row).toMatchObject({ supporter_status: 'active', portal_url: 'https://pdl/update', subscription_id: 'sub_77' });
    await hook(sub('subscription.updated', { status: 'active', ...period('2026-10-28T12:00:00Z'), scheduled_change: { action: 'cancel', effective_at: '2026-10-28T12:00:00Z' }, updated_at: '2026-09-29T12:00:00Z' }), db);
    expect(db.rows.get(USER)).toMatchObject({ supporter_until: '2026-10-28T12:00:00.000Z', supporter_status: 'cancelled' });
    // An older event arriving late doesn't undo the cancellation.
    expect((await hook(sub('subscription.updated', { status: 'active', ...period('2026-10-28T12:00:00Z'), updated_at: '2026-09-28T13:00:00Z' }), db)).body.ignored).toBe('stale');
    await hook(sub('subscription.canceled', { status: 'canceled', updated_at: '2026-10-28T12:00:01Z' }), db);
    expect(db.rows.get(USER)!.supporter_until).toBeNull();
    // A second supporter product (say, yearly) counts too; other products don't.
    expect((await hook(sub('subscription.created', { status: 'active', updated_at: '2026-11-01T00:00:00Z' }, 'pro_sup_yearly'), db)).body.supporterUntil).toBeTruthy();
    expect((await hook(sub('subscription.created', { status: 'active' }, 'pro_b1'), db)).body.ignored).toBeTruthy();
    expect(paidUntil({ status: 'past_due', ...period('2026-10-01T00:00:00Z') }, NOW)).not.toBeNull();
    expect(paidUntil({ status: 'paused' }, NOW)).toBeNull();
  });

  it('No-Ads Pass: recorded in its own columns', async () => {
    const db = fakeDb();
    await hook(sub('subscription.activated', { status: 'active', ...period('2026-10-28T12:00:00Z'), updated_at: '2026-09-28T12:00:00Z' }, 'pro_noads'), db);
    expect(db.rows.get(USER)).toMatchObject({ no_ads_status: 'active', no_ads_subscription_id: 'sub_77', no_ads_portal_url: 'https://pdl/update' });
    expect(db.rows.get(USER)!.supporter_until).toBeUndefined();
  });

  it("cancel: only the signed-in player's own pass, at the period end through the Paddle API; without an API key the game uses Paddle's link", async () => {
    const db = fakeDb();
    await hook(sub('subscription.created', { status: 'active', ...period('2026-10-20T12:00:00Z'), updated_at: '2026-09-27T12:00:00Z' }), db);
    const ask = (token: string, kind: string, b = bill) => handleBilling(new Request('http://x/api/billing?action=cancel', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ kind }) }), supa, b, db.f, NOW);
    expect((await ask('bad', 'supporter')).status).toBe(401);
    expect((await ask('good', 'noAds')).status).toBe(404); // has no No-Ads Pass
    expect((await ask('good', 'supporter', { ...bill, apiKey: undefined })).status).toBe(501);
    expect((await ask('good', 'supporter')).status).toBe(200);
    const call = db.calls.find(c => c.url === 'POST sandbox-api.paddle.com/subscriptions/sub_77/cancel');
    expect(call?.body).toEqual({ effective_from: 'next_billing_period' });
    expect(db.rows.get(USER)).toMatchObject({ supporter_status: 'cancelled', supporter_until: '2026-10-20T12:00:00.000Z' });
  });

  it('custom amount: a one-off price for the Custom Support Bundle, tied to the signed-in player, within limits', async () => {
    const db = fakeDb();
    const ask = (cents: unknown, token = 'good') => handleBilling(new Request('http://x/api/billing?action=checkout', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ cents }) }), supa, bill, db.f, NOW);
    expect((await ask(500, 'bad')).status).toBe(401);
    expect((await ask(50)).status).toBe(400);
    expect((await ask(4.5)).status).toBe(400);
    const res = await ask(750);
    expect(await res.json()).toMatchObject({ transactionId: 'txn_custom1' });
    const call = db.calls.find(c => c.url === 'POST sandbox-api.paddle.com/transactions');
    expect(call?.body).toMatchObject({ custom_data: { user_id: USER }, items: [{ price: { product_id: 'pro_b4', unit_price: { amount: '750', currency_code: 'USD' } } }] });
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

  it('no checkout opens when nothing is on sale (no Paddle token in the test build)', async () => {
    expect(await openCheckout('noAds', { userId: USER })).toMatch(/not on sale/);
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
