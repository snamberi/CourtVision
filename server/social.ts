import { getUser, rest, json, bearer, type SupaEnv, type Fetch } from './supabase';

/*
 * /api/social: friend gifts and profile visitors (tables in supabase/migrations/2026-10-12-gifts-visitors.sql).
 *   gifts    today's sends (who you already gifted, how many left) and the gifts waiting for you
 *   send     a free gift to a GM you follow: 150 coins and a Lucky Spin for them, nothing spent by you.
 *            Ten a day, one per friend per day (UTC).
 *   claim    collects every waiting gift; each is marked claimed before it is returned, so it pays out once
 *   view     notes that you looked at someone's profile (once a day per profile)
 *   visitors how many GMs looked at your profile today and this week
 */

export const GIFT_COINS = 150;
export const GIFT_LUCKY = 1;
export const GIFTS_PER_DAY = 10;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dayOf = (d: Date) => d.toISOString().slice(0, 10);
/** A missing table (the migration not run yet) reads as "not set up" instead of a crash. */
const notSetUp = (e: unknown) => /PGRST205|42P01|relation .* does not exist|Could not find the table/i.test(String(e instanceof Error ? e.message : e));

interface GiftRow { id: string; sender: string; recipient: string; day: string; coins: number; lucky: number; claimed: boolean; created_at: string }

export async function handleSocial(req: Request, env: SupaEnv | null, now = new Date(), f: Fetch = fetch): Promise<Response> {
  if (!env) return json({ error: 'Accounts are not set up on this site yet.' }, 503);
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const token = bearer(req);
  const user = token ? await getUser(env, token, f).catch(() => null) : null;
  if (!user) return json({ error: 'Please sign in again.' }, 401);
  let body: { action?: string; to?: string; target?: string };
  try { body = JSON.parse(await req.text()); } catch { return json({ error: 'Bad request.' }, 400); }
  const me = user.id, day = dayOf(now);
  try {
    if (body.action === 'gifts') {
      const [sent, waiting] = await Promise.all([
        rest(env, 'GET', `gifts?sender=eq.${me}&day=eq.${day}&select=recipient`, undefined, undefined, f) as Promise<{ recipient: string }[]>,
        rest(env, 'GET', `gifts?recipient=eq.${me}&claimed=eq.false&select=id,sender,coins,lucky,created_at&order=created_at.desc&limit=50`, undefined, undefined, f) as Promise<GiftRow[]>,
      ]);
      const names = await usernames(env, waiting.map(g => g.sender), f);
      return json({ day, sentTo: sent.map(s => s.recipient), left: Math.max(0, GIFTS_PER_DAY - sent.length), perDay: GIFTS_PER_DAY,
        waiting: waiting.map(g => ({ id: g.id, from: names.get(g.sender) ?? 'A friend', coins: g.coins, lucky: g.lucky, at: g.created_at })) });
    }
    if (body.action === 'send') {
      const to = String(body.to ?? '');
      if (!UUID.test(to) || to === me) return json({ error: 'Pick a friend to send a gift to.' }, 400);
      const follows = await rest(env, 'GET', `follows?user_id=eq.${me}&target_id=eq.${to}&select=target_id`, undefined, undefined, f) as unknown[];
      if (!follows.length) return json({ error: 'Follow this GM first: gifts go to your friends.' }, 403);
      const sent = await rest(env, 'GET', `gifts?sender=eq.${me}&day=eq.${day}&select=recipient`, undefined, undefined, f) as { recipient: string }[];
      if (sent.some(s => s.recipient === to)) return json({ error: 'You already sent them a gift today.' }, 409);
      if (sent.length >= GIFTS_PER_DAY) return json({ error: `That's ${GIFTS_PER_DAY} gifts today. More tomorrow!` }, 429);
      try {
        await rest(env, 'POST', 'gifts', [{ sender: me, recipient: to, day, coins: GIFT_COINS, lucky: GIFT_LUCKY, created_at: now.toISOString() }], 'return=minimal', f);
      } catch (e) {
        if (/23505|duplicate/i.test(String(e))) return json({ error: 'You already sent them a gift today.' }, 409);
        throw e;
      }
      return json({ ok: true, left: GIFTS_PER_DAY - sent.length - 1 });
    }
    if (body.action === 'claim') {
      // Flip claimed first and pay only the rows this call flipped: two devices claiming at once can't both get them.
      const rows = await rest(env, 'PATCH', `gifts?recipient=eq.${me}&claimed=eq.false`, { claimed: true }, 'return=representation', f) as GiftRow[];
      const names = await usernames(env, rows.map(g => g.sender), f);
      return json({ coins: rows.reduce((n, g) => n + g.coins, 0), lucky: rows.reduce((n, g) => n + g.lucky, 0), from: [...new Set(rows.map(g => names.get(g.sender) ?? 'A friend'))] });
    }
    if (body.action === 'view') {
      const target = String(body.target ?? '');
      if (!UUID.test(target) || target === me) return json({ ok: true });
      await rest(env, 'POST', 'profile_views?on_conflict=viewer,target,day', [{ viewer: me, target, day }], 'resolution=ignore-duplicates,return=minimal', f);
      return json({ ok: true });
    }
    if (body.action === 'visitors') {
      const weekAgo = dayOf(new Date(now.getTime() - 6 * 86_400_000));
      const rows = await rest(env, 'GET', `profile_views?target=eq.${me}&day=gte.${weekAgo}&select=viewer,day`, undefined, undefined, f) as { viewer: string; day: string }[];
      return json({ today: new Set(rows.filter(r => r.day === day).map(r => r.viewer)).size, week: new Set(rows.map(r => r.viewer)).size });
    }
    return json({ error: 'Unknown action.' }, 400);
  } catch (e) {
    if (notSetUp(e)) return json({ error: 'Gifts and visitors are not set up on this site yet.', setup: true }, 503);
    return json({ error: 'Something went wrong. Try again in a moment.' }, 500);
  }
}

async function usernames(env: SupaEnv, ids: string[], f: Fetch): Promise<Map<string, string>> {
  const uniq = [...new Set(ids)].filter(id => UUID.test(id));
  if (!uniq.length) return new Map();
  const rows = await rest(env, 'GET', `profiles?id=in.(${uniq.join(',')})&select=id,username`, undefined, undefined, f) as { id: string; username: string | null }[];
  return new Map(rows.filter(r => r.username).map(r => [r.id, r.username!]));
}
