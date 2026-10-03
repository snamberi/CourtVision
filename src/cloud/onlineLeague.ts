import { supa, getAccount } from './account';
import { gzip } from './sync';
import { buildSnapshot, parseUniverseFile, type UniverseSnapshot } from '../storage/universeIO';
import type { League } from '../simulation/league';
import type { GMLeagueExtras, TradeProposal } from '../simulation/gm';

/*
 * Online GM leagues (supabase/migrations/2026-10-05-online-leagues.sql): 2-8 friends share one league, each running
 * a team. The league is a compressed save file in Storage, one file per version; the online_leagues row points at
 * the latest. Saving checks the version you loaded, so nobody overwrites a friend's moves: if someone saved in
 * between, you reload and redo yours. The league moves forward when everyone is ready, or once the commissioner's
 * deadline has passed since the last step.
 */

export const BUCKET = 'online-leagues';
export const MAX_MEMBERS = 8;
export interface OnlineTeam { id: string; name: string }
export interface OnlineLeague {
  id: string; code: string; name: string; commissioner: string; teams: OnlineTeam[]; version: number; statePath: string | null;
  season: string; phase: string; statusLine: string; deadlineHours: number; advancedAt: string; savedBy: string | null; updatedAt: string;
}
export interface OnlineMember { userId: string; teamId: string; ready: boolean; username: string; icon?: string; color?: string }
export interface OnlineTrade { id: string; fromUser: string; toUser: string; proposal: TradeProposal; status: 'pending' | 'accepted' | 'declined' | 'cancelled'; createdAt: string }
export interface Peek { id: string; name: string; teams: OnlineTeam[]; taken: string[]; members: number; season: string }

function fail(e: { message?: string; code?: string } | null): never {
  const msg = e?.message ?? 'Something went wrong.';
  if (e?.code === '42P01' || e?.code === 'PGRST205' || e?.code === 'PGRST202' || /does not exist|schema cache|Bucket not found/i.test(msg)) throw new Error('Online leagues are not set up on this site yet.');
  if (/^stale/.test(msg)) throw new StaleError();
  throw new Error(msg);
}
/** Someone saved the league after you loaded it. */
export class StaleError extends Error { constructor() { super('A friend saved the league after you loaded it. Load the latest version, then make your moves again.'); } }

const toLeague = (r: Record<string, unknown>): OnlineLeague => ({
  id: String(r.id), code: String(r.code), name: String(r.name), commissioner: String(r.commissioner), teams: (r.teams as OnlineTeam[]) ?? [], version: Number(r.version ?? 0),
  statePath: (r.state_path as string | null) ?? null, season: String(r.season ?? ''), phase: String(r.phase ?? ''), statusLine: String(r.status_line ?? ''), deadlineHours: Number(r.deadline_hours ?? 24),
  advancedAt: String(r.advanced_at ?? ''), savedBy: (r.saved_by as string | null) ?? null, updatedAt: String(r.updated_at ?? ''),
});

/** Your online leagues, most recently saved first. */
export async function myOnlineLeagues(): Promise<OnlineLeague[]> {
  const me = getAccount().userId;
  if (!me) return [];
  const client = await supa();
  const { data, error } = await client.from('online_leagues').select('*').order('updated_at', { ascending: false });
  if (error) fail(error);
  return ((data ?? []) as Record<string, unknown>[]).map(toLeague);
}
export async function loadOnlineLeague(id: string): Promise<OnlineLeague> {
  const client = await supa();
  const { data, error } = await client.from('online_leagues').select('*').eq('id', id).single();
  if (error) fail(error);
  return toLeague(data as Record<string, unknown>);
}
export async function onlineMembers(id: string): Promise<OnlineMember[]> {
  const client = await supa();
  const { data, error } = await client.from('online_members_view').select('*').eq('league_id', id).order('joined_at');
  if (error) fail(error);
  return ((data ?? []) as Record<string, unknown>[]).map(r => ({ userId: String(r.user_id), teamId: String(r.team_id), ready: !!r.ready, username: String(r.username ?? ''), icon: r.icon as string | undefined, color: r.color as string | undefined }));
}

/** Everyone ready, or the deadline has passed since the league last moved. */
export function canAdvance(l: OnlineLeague, members: OnlineMember[], now = Date.now()): { ok: boolean; why: string } {
  const waiting = members.filter(m => !m.ready);
  if (!waiting.length) return { ok: true, why: 'Everyone is ready.' };
  const due = Date.parse(l.advancedAt) + l.deadlineHours * 3_600_000;
  if (Number.isFinite(due) && now >= due) return { ok: true, why: `The ${l.deadlineHours}-hour deadline has passed.` };
  const hours = Number.isFinite(due) ? Math.max(1, Math.ceil((due - now) / 3_600_000)) : l.deadlineHours;
  return { ok: false, why: `Waiting for ${waiting.map(m => `@${m.username}`).join(', ')} (or ${hours} more hour${hours === 1 ? '' : 's'}).` };
}

// ---------------------------------------------------------------- the save file

async function upload(leagueId: string, version: number, league: League, extras: GMLeagueExtras): Promise<string> {
  const client = await supa();
  const text = JSON.stringify(buildSnapshot(league, extras));
  const packed = await gzip(text);
  // A fresh name every time: a friend saving at the same moment can never overwrite this file.
  const path = `${leagueId}/${version}-${Math.random().toString(36).slice(2, 10)}.json${packed ? '.gz' : ''}`;
  const body = packed ? new Blob([packed], { type: 'application/gzip' }) : new Blob([text], { type: 'application/json' });
  const { error } = await client.storage.from(BUCKET).upload(path, body, { upsert: false, contentType: packed ? 'application/gzip' : 'application/json' });
  if (error) fail(error);
  return path;
}

/** Downloads the league's latest version. */
export async function downloadOnlineState(l: OnlineLeague): Promise<UniverseSnapshot> {
  if (!l.statePath) throw new Error('This league has no save yet.');
  const client = await supa();
  const { data, error } = await client.storage.from(BUCKET).download(l.statePath);
  if (error || !data) fail(error);
  const text = l.statePath.endsWith('.gz') ? await new Response(data.stream().pipeThrough(new DecompressionStream('gzip'))).text() : await data.text();
  return parseUniverseFile(text);
}

/** A one-line summary of where the league stands (shown in lists without downloading it). */
export function statusLine(league: League): string {
  const played = league.schedule.filter(g => g.played).length;
  const phase = (league.seasonPhase ?? 'regular_season').replace(/_/g, ' ');
  return `${phase}${league.seasonPhase === 'regular_season' || !league.seasonPhase ? ` · ${played}/${league.schedule.length} games` : ''}`;
}

/** Saves your moves as the league's next version. Throws StaleError if a friend saved first. */
export async function saveOnlineState(l: OnlineLeague, league: League, extras: GMLeagueExtras, advanced: boolean): Promise<number> {
  const path = await upload(l.id, l.version + 1, league, extras);
  const client = await supa();
  const { data, error } = await client.rpc('commit_online_league', { p_league: l.id, p_expected: l.version, p_path: path, p_season: league.season ?? '', p_phase: league.seasonPhase ?? '', p_status: statusLine(league), p_advanced: advanced });
  if (error) { void client.storage.from(BUCKET).remove([path]).then(undefined, () => undefined); fail(error); }
  // Tidy up: the version before this one is no longer needed.
  if (l.statePath) void client.storage.from(BUCKET).remove([l.statePath]).then(undefined, () => undefined);
  return Number(data);
}

// ---------------------------------------------------------------- making and joining

/** Starts an online league from a league you already have: you are its commissioner and run `teamId`. */
export async function createOnlineLeague(name: string, league: League, extras: GMLeagueExtras, teamId: string, deadlineHours = 24): Promise<OnlineLeague> {
  const client = await supa();
  const teams = league.teams.map(t => ({ id: t.teamId, name: t.name }));
  const { data, error } = await client.rpc('create_online_league', { p_name: name.trim().slice(0, 40) || 'Online League', p_teams: teams, p_team: teamId, p_deadline_hours: deadlineHours });
  if (error) fail(error);
  const row = (Array.isArray(data) ? data[0] : data) as { league_id: string; league_code: string };
  const fresh = await loadOnlineLeague(row.league_id);
  const tagged: League = { ...league, online: { leagueId: fresh.id, code: fresh.code, humans: [teamId] } };
  await saveOnlineState(fresh, tagged, extras, false);
  return loadOnlineLeague(fresh.id);
}

export async function peekOnlineLeague(code: string): Promise<Peek | null> {
  const client = await supa();
  const { data, error } = await client.rpc('peek_online_league', { p_code: code.trim().toUpperCase() });
  if (error) fail(error);
  const r = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
  return r ? { id: String(r.id), name: String(r.name), teams: (r.teams as OnlineTeam[]) ?? [], taken: (r.taken as string[]) ?? [], members: Number(r.members ?? 0), season: String(r.season ?? '') } : null;
}

export async function joinOnlineLeague(code: string, teamId: string): Promise<string> {
  const client = await supa();
  const { data, error } = await client.rpc('join_online_league', { p_code: code.trim().toUpperCase(), p_team: teamId });
  if (error) fail(error);
  return String(data);
}
export async function leaveOnlineLeague(id: string): Promise<void> {
  const client = await supa();
  const { error } = await client.rpc('leave_online_league', { p_league: id });
  if (error) fail(error);
}
export async function setReady(id: string, ready: boolean): Promise<void> {
  const client = await supa();
  const { error } = await client.rpc('set_online_ready', { p_league: id, p_ready: ready });
  if (error) fail(error);
}

/** The league as you play it: every friend's team marked as run by a person (so the AI leaves it alone). */
export function withHumans(league: League, l: OnlineLeague, members: OnlineMember[]): League {
  return { ...league, online: { leagueId: l.id, code: l.code, humans: members.map(m => m.teamId) } };
}

// ---------------------------------------------------------------- trades between friends

export async function onlineTrades(id: string): Promise<OnlineTrade[]> {
  const client = await supa();
  const { data, error } = await client.from('online_trades').select('*').eq('league_id', id).eq('status', 'pending').order('created_at', { ascending: false });
  if (error) fail(error);
  return ((data ?? []) as Record<string, unknown>[]).map(r => ({ id: String(r.id), fromUser: String(r.from_user), toUser: String(r.to_user), proposal: r.proposal as TradeProposal, status: r.status as OnlineTrade['status'], createdAt: String(r.created_at) }));
}
export async function proposeOnlineTrade(id: string, toUser: string, proposal: TradeProposal): Promise<void> {
  const client = await supa();
  const { error } = await client.rpc('propose_online_trade', { p_league: id, p_to: toUser, p_proposal: proposal });
  if (error) fail(error);
}
export async function answerOnlineTrade(tradeId: string, status: 'accepted' | 'declined' | 'cancelled'): Promise<void> {
  const client = await supa();
  const { error } = await client.rpc('answer_online_trade', { p_trade: tradeId, p_status: status });
  if (error) fail(error);
}
