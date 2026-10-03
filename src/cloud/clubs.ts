import { supa, getAccount } from './account';
import { weekKey } from '../retention/week';

/*
 * Clubs (supabase/migrations/2026-10-04-clubs.sql): groups of up to 20 GMs with a name, a tag and a badge.
 * Every member's weekly-board results add up to club points (each board scored 0-100 against that week's best),
 * club owners can start a one-week clash with another club, and the club board ranks every club by the week's points.
 * All writes go through database functions that check the caller; the browser never writes the tables directly.
 */

export interface Club { id: string; name: string; tag: string; badge: string; color: string; motto: string; owner: string; members: number; xp: number }
export interface ClubMember { userId: string; username: string; title?: string; icon?: string; color?: string; avatar?: string; level: number; points: number; owner: boolean }
export interface ClubWeekRow { clubId: string; name: string; tag: string; badge: string; color: string; points: number; players: number }
export interface Clash { id: string; week: string; a: ClubWeekRow; b: ClubWeekRow }

export const CLUB_MAX = 20;
export const CLUB_NAME = /^[A-Za-z0-9][A-Za-z0-9 _-]{1,22}[A-Za-z0-9]$/;
export const CLUB_TAG = /^[A-Z0-9]{2,4}$/;

/** A friendly message for a database error (missing tables mean the migration has not been run yet). */
function fail(e: { message?: string; code?: string } | null): never {
  const msg = e?.message ?? 'Something went wrong.';
  if (e?.code === '42P01' || e?.code === 'PGRST205' || /does not exist|schema cache/i.test(msg)) throw new Error('Clubs are not set up on this site yet.');
  if (e?.code === '23505') throw new Error('That club name is taken.');
  if (e?.code === '23514') throw new Error('Check the name (3-24 letters, numbers, spaces, - or _) and the tag (2-4 letters or numbers).');
  throw new Error(msg);
}
const row = (r: Record<string, unknown>): Club => ({ id: String(r.id), name: String(r.name), tag: String(r.tag), badge: String(r.badge ?? 'ball'), color: String(r.color ?? 'orange'), motto: String(r.motto ?? ''), owner: String(r.owner), members: Number(r.members ?? 0), xp: Number(r.xp ?? 0) });
const weekRow = (r: Record<string, unknown>): ClubWeekRow => ({ clubId: String(r.club_id), name: String(r.name), tag: String(r.tag), badge: String(r.badge ?? 'ball'), color: String(r.color ?? 'orange'), points: Number(r.points ?? 0), players: Number(r.players ?? 0) });
const emptyWeek = (c: Club): ClubWeekRow => ({ clubId: c.id, name: c.name, tag: c.tag, badge: c.badge, color: c.color, points: 0, players: 0 });

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

export async function createClub(c: { name: string; tag: string; badge: string; color: string; motto: string }): Promise<string> {
  if (!CLUB_NAME.test(c.name.trim())) throw new Error('Club names are 3-24 letters, numbers, spaces, - or _.');
  if (!CLUB_TAG.test(c.tag.trim().toUpperCase())) throw new Error('Tags are 2-4 letters or numbers.');
  const client = await supa();
  const { data, error } = await client.rpc('create_club', { p_name: c.name.trim(), p_tag: c.tag.trim().toUpperCase(), p_badge: c.badge, p_color: c.color, p_motto: c.motto.trim().slice(0, 80) });
  if (error) fail(error);
  return String(data);
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
