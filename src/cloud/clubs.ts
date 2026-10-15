import { supa, getAccount } from './account';
import { weekKey } from '../retention/week';
import { loadRelics, saveRelics, spendCoins } from '../relics/relics';

/*
 * Clubs (supabase/migrations/2026-10-04-clubs.sql): groups of up to 20 GMs with a name, a tag and a badge.
 * Every member's weekly-board results add up to club points (each board scored 0-100 against that week's best),
 * club owners can start a one-week clash with another club, and the club board ranks every club by the week's points.
 * All writes go through database functions that check the caller; the browser never writes the tables directly.
 *
 * Clans (supabase/migrations/2026-10-15-clans.sql) grow clubs: a description and a flag, open or closed clans, a join
 * link, invites by username and the leader removing members. A new clan costs CLAN_PRICE coins.
 */

export interface Club { id: string; name: string; tag: string; badge: string; color: string; motto: string; owner: string; members: number; xp: number; description: string; flag: string; open: boolean }
export interface ClubMember { userId: string; username: string; title?: string; icon?: string; color?: string; avatar?: string; level: number; points: number; owner: boolean }
export interface ClubWeekRow { clubId: string; name: string; tag: string; badge: string; color: string; points: number; players: number; flag?: string }
export interface Clash { id: string; week: string; a: ClubWeekRow; b: ClubWeekRow }

export const CLUB_MAX = 20;
/** Coins to found a clan. */
export const CLAN_PRICE = 100_000;
export const CLAN_DESCRIPTION_MAX = 300;
export const CLUB_NAME = /^[A-Za-z0-9][A-Za-z0-9 _-]{1,22}[A-Za-z0-9]$/;
export const CLUB_TAG = /^[A-Z0-9]{2,4}$/;

/** A friendly message for a database error (missing tables mean the migration has not been run yet). */
function fail(e: { message?: string; code?: string } | null): never {
  const msg = e?.message ?? 'Something went wrong.';
  if (e?.code === '42P01' || e?.code === 'PGRST205' || e?.code === 'PGRST202' || /does not exist|schema cache/i.test(msg)) throw new Error('Clans are not set up on this site yet.');
  if (e?.code === '23505') throw new Error('That clan name is taken.');
  if (e?.code === '23514') throw new Error('Check the name (3-24 letters, numbers, spaces, - or _) and the tag (2-4 letters or numbers).');
  throw new Error(msg);
}
const row = (r: Record<string, unknown>): Club => ({ id: String(r.id), name: String(r.name), tag: String(r.tag), badge: String(r.badge ?? 'ball'), color: String(r.color ?? 'orange'), motto: String(r.motto ?? ''), owner: String(r.owner), members: Number(r.members ?? 0), xp: Number(r.xp ?? 0),
  description: String(r.description ?? ''), flag: String(r.flag ?? ''), open: r.open !== false });
const weekRow = (r: Record<string, unknown>): ClubWeekRow => ({ clubId: String(r.club_id), name: String(r.name), tag: String(r.tag), badge: String(r.badge ?? 'ball'), color: String(r.color ?? 'orange'), points: Number(r.points ?? 0), players: Number(r.players ?? 0), flag: String(r.flag ?? '') });
const emptyWeek = (c: Club): ClubWeekRow => ({ clubId: c.id, name: c.name, tag: c.tag, badge: c.badge, color: c.color, points: 0, players: 0, flag: c.flag });

/** The club you are in, or null. */
export async function myClub(): Promise<Club | null> {
  const me = getAccount().userId;
  if (!me) return null;
  const client = await supa();
  const { data: m, error } = await client.from('club_members').select('club_id').eq('user_id', me).maybeSingle();
  if (error) fail(error);
  if (!m) return null;
  return loadClub(String((m as { club_id: string }).club_id));
}

export async function loadClub(id: string): Promise<Club | null> {
  const client = await supa();
  const { data, error } = await client.from('lb_clubs').select('*').eq('id', id).maybeSingle();
  if (error) fail(error);
  return data ? row(data as Record<string, unknown>) : null;
}

/** Clubs by name (or the biggest ones when the search is empty). */
export async function findClubs(q = ''): Promise<Club[]> {
  const client = await supa();
  let sel = client.from('lb_clubs').select('*');
  if (q.trim()) sel = sel.ilike('name', `%${q.trim().replace(/[%_]/g, '')}%`);
  const { data, error } = await sel.order('xp', { ascending: false }).limit(20);
  if (error) fail(error);
  return ((data ?? []) as Record<string, unknown>[]).map(row);
}

/** Members with their club points this week, best first. */
export async function clubMembers(club: Club, week = weekKey()): Promise<ClubMember[]> {
  const client = await supa();
  const { data, error } = await client.from('lb_club_members').select('*').eq('club_id', club.id);
  if (error) fail(error);
  const by = new Map<string, ClubMember>();
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    const id = String(r.user_id);
    const cur = by.get(id) ?? { userId: id, username: String(r.username ?? ''), title: r.title as string | undefined, icon: r.icon as string | undefined, color: r.color as string | undefined, avatar: r.avatar as string | undefined, level: Number(r.level ?? 1), points: 0, owner: id === club.owner };
    if (r.week === week) cur.points += Number(r.points ?? 0);
    by.set(id, cur);
  }
  return [...by.values()].sort((a, b) => b.points - a.points || b.level - a.level);
}

/** The club board for a week: every club with points, best first. */
export async function clubBoard(week = weekKey()): Promise<ClubWeekRow[]> {
  const client = await supa();
  const { data, error } = await client.from('lb_club_weekly').select('*').eq('week', week).order('points', { ascending: false }).limit(100);
  if (error) fail(error);
  return ((data ?? []) as Record<string, unknown>[]).map(weekRow);
}

/** This week's clash for a club, with both sides' points, or null. */
export async function clubClash(club: Club, week = weekKey()): Promise<Clash | null> {
  const client = await supa();
  const { data, error } = await client.from('club_clashes').select('*').eq('week', week).or(`club_a.eq.${club.id},club_b.eq.${club.id}`).maybeSingle();
  if (error) fail(error);
  if (!data) return null;
  const x = data as { id: string; week: string; club_a: string; club_b: string };
  const [ca, cb] = await Promise.all([loadClub(x.club_a), loadClub(x.club_b)]);
  if (!ca || !cb) return null;
  const { data: pts } = await client.from('lb_club_weekly').select('*').eq('week', week).in('club_id', [ca.id, cb.id]);
  const rows = ((pts ?? []) as Record<string, unknown>[]).map(weekRow);
  return { id: x.id, week: x.week, a: rows.find(r => r.clubId === ca.id) ?? emptyWeek(ca), b: rows.find(r => r.clubId === cb.id) ?? emptyWeek(cb) };
}

export interface ClanEdit { name: string; tag: string; badge: string; color: string; motto: string; description: string; flag: string; open: boolean }
function checkEdit(c: ClanEdit): void {
  if (!CLUB_NAME.test(c.name.trim())) throw new Error('Clan names are 3-24 letters, numbers, spaces, - or _.');
  if (!CLUB_TAG.test(c.tag.trim().toUpperCase())) throw new Error('Tags are 2-4 letters or numbers.');
}
const editArgs = (c: ClanEdit) => ({ p_name: c.name.trim(), p_tag: c.tag.trim().toUpperCase(), p_badge: c.badge, p_color: c.color, p_motto: c.motto.trim().slice(0, 80),
  p_description: c.description.trim().slice(0, CLAN_DESCRIPTION_MAX), p_flag: c.flag.slice(0, 200), p_open: c.open });

/** Founds a clan: CLAN_PRICE coins, taken from your vault once the clan exists (the server checks your synced coins). */
export async function createClub(c: ClanEdit): Promise<string> {
  checkEdit(c);
  const have = loadRelics().coins;
  if (have < CLAN_PRICE) throw new Error(`A clan costs ${CLAN_PRICE.toLocaleString()} coins. You have ${have.toLocaleString()}.`);
  // The server reads your synced coins: send the latest first.
  await import('./sync').then(m => m.syncNow()).catch(() => {});
  const client = await supa();
  const { data, error } = await client.rpc('create_club', editArgs(c));
  if (error) fail(error);
  const paid = spendCoins(loadRelics(), CLAN_PRICE, `Founded the clan ${c.name.trim()}`);
  if (paid) saveRelics(paid);
  return String(data);
}
/** The leader edits the clan (name, tag, badge, colour, motto, description, flag, open or closed). */
export async function updateClub(c: ClanEdit): Promise<void> {
  checkEdit(c);
  const client = await supa();
  const { error } = await client.rpc('update_club', editArgs(c));
  if (error) fail(error);
}
export async function kickMember(userId: string): Promise<void> {
  const client = await supa();
  const { error } = await client.rpc('kick_from_club', { p_user: userId });
  if (error) fail(error);
}
export async function inviteMember(username: string): Promise<void> {
  const name = username.trim().replace(/^@/, '');
  if (!/^[A-Za-z0-9_]{3,18}$/.test(name)) throw new Error('GM names are 3-18 letters, numbers or _.');
  const client = await supa();
  const { error } = await client.rpc('invite_to_club', { p_username: name });
  if (error) fail(error);
}
/** Turns an invite down (yours) or takes it back (the leader, with the invited GM's id). */
export async function dropInvite(clubId: string, userId?: string): Promise<void> {
  const client = await supa();
  const { error } = await client.rpc('drop_club_invite', { p_club: clubId, p_user: userId ?? null });
  if (error) fail(error);
}
/** The leader's open invites, with the invited GMs' names. */
export async function sentInvites(club: Club): Promise<{ userId: string; username: string }[]> {
  const client = await supa();
  const { data, error } = await client.from('club_invites').select('user_id').eq('club_id', club.id);
  if (error) fail(error);
  const ids = ((data ?? []) as { user_id: string }[]).map(r => r.user_id);
  if (!ids.length) return [];
  const { data: users } = await client.from('lb_users').select('id, username').in('id', ids);
  return ((users ?? []) as { id: string; username: string }[]).map(u => ({ userId: u.id, username: u.username }));
}
/** Clans that invited you. */
export async function myInvites(): Promise<Club[]> {
  const me = getAccount().userId;
  if (!me) return [];
  const client = await supa();
  const { data, error } = await client.from('club_invites').select('club_id').eq('user_id', me);
  if (error) fail(error);
  const ids = ((data ?? []) as { club_id: string }[]).map(r => r.club_id);
  if (!ids.length) return [];
  const { data: clubs } = await client.from('lb_clubs').select('*').in('id', ids);
  return ((clubs ?? []) as Record<string, unknown>[]).map(row);
}
/** The join link's code (only the leader can read it). */
export async function clubCode(club: Club): Promise<string | null> {
  const client = await supa();
  const { data, error } = await client.from('club_codes').select('code').eq('club_id', club.id).maybeSingle();
  if (error) fail(error);
  return (data as { code?: string } | null)?.code ?? null;
}
export async function newClubCode(): Promise<string> {
  const client = await supa();
  const { data, error } = await client.rpc('new_club_code');
  if (error) fail(error);
  return String(data);
}
export const clanLink = (code: string, origin = typeof location !== 'undefined' ? location.origin : 'https://courtvisiongame.com') => `${origin}/#/clans/join/${code}`;
export const CLAN_CODE = /^[0-9a-f]{12}$/;
/** A join link opened (#/clans/join/<code>): App keeps the code here until the Clans page reads it. */
export const CLAN_JOIN_KEY = 'cv-clan-join';
/** Where a link leads (works signed out). */
export async function clubByCode(code: string): Promise<{ id: string; name: string; tag: string; flag: string; description: string; members: number } | null> {
  if (!CLAN_CODE.test(code)) return null;
  const client = await supa();
  const { data, error } = await client.rpc('club_by_code', { p_code: code });
  if (error) fail(error);
  const r = ((data ?? []) as Record<string, unknown>[])[0];
  return r ? { id: String(r.id), name: String(r.name), tag: String(r.tag), flag: String(r.flag ?? ''), description: String(r.description ?? ''), members: Number(r.members ?? 0) } : null;
}
export async function joinByCode(code: string): Promise<void> {
  const client = await supa();
  const { error } = await client.rpc('join_club_code', { p_code: code });
  if (error) fail(error);
}
/** A GM's clan for their profile (name, tag and flag), or null. */
export async function clanOf(userId: string): Promise<Club | null> {
  const client = await supa();
  const { data } = await client.from('club_members').select('club_id').eq('user_id', userId).maybeSingle();
  const id = (data as { club_id?: string } | null)?.club_id;
  return id ? loadClub(id).catch(() => null) : null;
}
export async function joinClub(id: string): Promise<void> {
  const client = await supa();
  const { error } = await client.rpc('join_club', { p_club: id });
  if (error) fail(error);
}
export async function leaveClub(): Promise<void> {
  const client = await supa();
  const { error } = await client.rpc('leave_club');
  if (error) fail(error);
}
export async function challengeClub(target: string, week = weekKey()): Promise<void> {
  const client = await supa();
  const { error } = await client.rpc('challenge_club', { p_target: target, p_week: week });
  if (error) fail(error);
}

/* ---- Weekend Showdown: every weekend each club meets the club next to it on the week's board (1v2, 3v4...). ---- */

/** Friday, Saturday or Sunday (UTC): showdown time. */
export const isShowdownWeekend = (now = new Date()) => [5, 6, 0].includes(now.getUTCDay());
/** Your club and its showdown rival on a week's board (clubs paired by place), or null without a rival. */
export function showdownPair(board: ClubWeekRow[], clubId: string): { me: ClubWeekRow; rival: ClubWeekRow } | null {
  const i = board.findIndex(r => r.clubId === clubId);
  if (i < 0) return null;
  const j = i % 2 === 0 ? i + 1 : i - 1;
  return board[j] ? { me: board[i], rival: board[j] } : null;
}
/** Last week's showdown, settled: won, lost or level (by the week's club points). */
export function showdownResult(board: ClubWeekRow[], clubId: string): { me: ClubWeekRow; rival: ClubWeekRow; outcome: 'won' | 'lost' | 'level' } | null {
  const p = showdownPair(board, clubId);
  if (!p) return null;
  return { ...p, outcome: p.me.points > p.rival.points ? 'won' : p.me.points < p.rival.points ? 'lost' : 'level' };
}

/* ---- The club pass: every member's XP fills one shared bar; banners unlock for the whole club. ---- */

export const CLUB_PASS_TIER_XP = 5000, CLUB_PASS_TIERS = 50;
export const CLUB_BANNERS: { tier: number; name: string; colors: [string, string] }[] = [
  { tier: 5, name: 'Rookie banner', colors: ['#2a3546', '#94a0b2'] },
  { tier: 10, name: 'Hardwood banner', colors: ['#8a5530', '#f2d27a'] },
  { tier: 20, name: 'Playoff banner', colors: ['#1d428a', '#ffffff'] },
  { tier: 30, name: 'Conference banner', colors: ['#552583', '#fdb927'] },
  { tier: 40, name: 'Finals banner', colors: ['#0b1018', '#f47b20'] },
  { tier: 50, name: 'Dynasty banner', colors: ['#ffd166', '#0b1018'] },
];
/** Where a club's shared pass stands, from its members' total XP. */
export function clubPass(xp: number): { tier: number; into: number; need: number; banners: typeof CLUB_BANNERS; next: (typeof CLUB_BANNERS)[number] | null } {
  const tier = Math.min(CLUB_PASS_TIERS, Math.floor(Math.max(0, xp) / CLUB_PASS_TIER_XP));
  return { tier, into: tier >= CLUB_PASS_TIERS ? CLUB_PASS_TIER_XP : Math.max(0, xp) - tier * CLUB_PASS_TIER_XP, need: CLUB_PASS_TIER_XP,
    banners: CLUB_BANNERS.filter(b => b.tier <= tier), next: CLUB_BANNERS.find(b => b.tier > tier) ?? null };
}
