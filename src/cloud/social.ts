/*
 * Friend gifts and profile visitors (server/social.ts). A gift is free for the sender: 150 coins and a Lucky Spin
 * for the friend, ten friends a day. Collected gifts go straight into the Relic Vault.
 */
import { accessToken, getAccount, supa } from './account';
import { claimRewardRpc } from './deliveries';
import { noteFeat } from '../profile/feats';

export interface Friend { userId: string; username: string; level: number; icon?: string; color?: string; title?: string; avatar?: string; lastSeen?: string }
export interface WaitingGift { message?: string; spins?: number; gems?: number; items?: string[]; cosmetics?: string[]; id: string; from: string; coins: number; lucky: number; at: string }
export interface GiftStatus { day: string; sentTo: string[]; left: number; perDay: number; waiting: WaitingGift[] }

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const token = accessToken();
  if (!token) throw new Error('Sign in first.');
  const res = await fetch('/api/social', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  const out = await res.json().catch(() => null) as (T & { error?: string }) | null;
  if (!res.ok || !out) throw new Error(out?.error ?? `Something went wrong (${res.status}).`);
  return out;
}

/** The GMs you follow, with their character, level and when they were last online. */
export async function loadFriends(): Promise<Friend[]> {
  const me = getAccount().userId;
  if (!me) return [];
  const client = await supa();
  const { data: f } = await client.from('follows').select('target_id').eq('user_id', me);
  const ids = ((f ?? []) as { target_id: string }[]).map(x => x.target_id).slice(0, 200);
  if (!ids.length) return [];
  const { data } = await client.from('lb_users').select('id, username, level, icon, color, title, avatar, stats').in('id', ids);
  return ((data ?? []) as { id: string; username: string; level: number; icon?: string; color?: string; title?: string; avatar?: string; stats?: { lastSeen?: string } }[])
    .map(x => ({ userId: x.id, username: x.username, level: x.level, icon: x.icon, color: x.color, title: x.title, avatar: x.avatar, lastSeen: x.stats?.lastSeen }))
    .sort((a, b) => (Date.parse(b.lastSeen ?? '') || 0) - (Date.parse(a.lastSeen ?? '') || 0) || a.username.localeCompare(b.username));
}

export const loadGifts = () => call<GiftStatus>({ action: 'gifts' });
export async function sendGift(to: string): Promise<{ ok: true; left: number }> {
  const out = await call<{ ok: true; left: number }>({ action: 'send', to });
  noteFeat('giftsSent', 1);
  return out;
}

/** Collects every waiting gift into the Relic Vault. Returns what came in. */
export async function claimGifts(): Promise<{ coins: number; lucky: number; from: string[]; spins?: number; gems?: number; items?: string[]; cosmetics?: string[] }> {
  const rewards = await claimRewardRpc('claim_gifts_v2');
  const got = { coins: rewards.reduce((n, r) => n + r.coins, 0), lucky: rewards.reduce((n, r) => n + r.lucky, 0),
    spins: rewards.reduce((n, r) => n + r.spins, 0), gems: rewards.reduce((n, r) => n + r.gems, 0),
    items: rewards.flatMap(r => r.items), cosmetics: rewards.flatMap(r => r.cosmetics), from: rewards.map(r => r.label) };
  if (rewards.length) noteFeat('giftsCollected', rewards.length);
  return got;
}

/** Notes a visit to someone's profile (quietly: a failure doesn't matter). */
export function noteProfileView(target: string): void {
  if (!accessToken() || target === getAccount().userId) return;
  void call({ action: 'view', target }).catch(() => {});
}
export const loadVisitors = () => call<{ today: number; week: number }>({ action: 'visitors' });

export const sendOwnerGift = (gift: { to: string; message: string; coins: number; spins: number; lucky: number; gems: number; items: string[]; cosmetics: string[] }) => call<{ ok: true }>({ action: 'owner-send', ...gift });
