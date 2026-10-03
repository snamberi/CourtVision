import { supa, getAccount } from './account';

/*
 * The online boards, read straight from the database's public views (see supabase/schema.sql). Each query returns
 * the top rows and, when signed in, your own rank on that board.
 */

export interface BoardRow { rank: number; userId: string; username: string; title?: string; icon?: string; color?: string; /** Their character's look code. */ avatar?: string; score: number; detail: string; you: boolean; extra?: Record<string, unknown> }
export interface BoardResult { rows: BoardRow[]; total: number; you: { rank: number; score: number } | null }

export type BoardSpec =
  | { kind: 'gms' }
  | { kind: 'players'; week?: string | null }
  | { kind: 'weekly'; board: 'rebuild' | 'career' | 'hunt' | 'perfect' | 'guess' | 'hilo' | 'bracket'; week: string }
  | { kind: 'daily'; day: string }
  | { kind: 'rebuild'; scenario: string }
  | { kind: 'ranked'; season: string }
  | { kind: 'pvp' }
  | { kind: 'code'; code: string }
  | { kind: 'friends' };

interface Q { view: string; score: string; filters: [string, string | number][]; detail: (r: Record<string, unknown>) => string; asc?: boolean }
const plural = (n: unknown, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

function query(spec: BoardSpec): Q {
  switch (spec.kind) {
    case 'gms': return { view: 'lb_users', score: 'xp', filters: [], detail: r => `LV ${r.level} · ${(r.stats as { summary?: string })?.summary ?? ''}` };
    case 'players': return { view: 'lb_players', score: 'legacy', filters: spec.week ? [['weekly', spec.week]] : [],
      detail: r => `${r.name} · ${plural(r.seasons, 'season')} · ${r.ppg}/${r.rpg}/${r.apg} · ${plural(r.titles, 'title')} · ${plural(r.mvps, 'MVP')}${r.hall_of_fame !== 'no' ? ' · HOF' : ''}` };
    case 'weekly': return { view: 'lb_weekly', score: 'score', filters: [['board', spec.board], ['week', spec.week]], detail: r => String(r.detail ?? '') };
    case 'daily': return { view: 'lb_daily', score: 'score', filters: [['day', spec.day]], detail: r => (r.won ? `Won it · ${r.wins}-${r.losses} in games` : `Reached series ${Number(r.stop) + 1}`) };
    case 'rebuild': return { view: 'lb_rebuild', score: 'best', filters: [['scenario', spec.scenario]], detail: r => `${'★'.repeat(Number(r.stars))}${'☆'.repeat(3 - Number(r.stars))}${r.title_in ? ` · title in year ${r.title_in}` : ''}` };
    case 'ranked': return { view: 'lb_ranked', score: 'points', filters: [['season', spec.season]], detail: r => plural(r.events, 'result') };
    case 'pvp': return { view: 'lb_pvp', score: 'rating', filters: [], detail: r => `${r.wins}-${r.losses}` };
    case 'code': return { view: 'lb_codes', score: 'score', filters: [['code', spec.code]], detail: r => `${r.wins}-${r.losses} · ${r.finish}${r.team ? ` · ${r.team}` : ''}` };
    case 'friends': return { view: 'lb_users', score: 'xp', filters: [], detail: r => `LV ${r.level} · ${(r.stats as { summary?: string })?.summary ?? ''}` };
  }
}
const idColumn = (view: string) => (view === 'lb_users' ? 'id' : 'user_id');

export async function loadBoard(spec: BoardSpec, limit = 100): Promise<BoardResult> {
  const client = await supa();
  const q = query(spec);
  const me = getAccount().userId;
  const idCol = idColumn(q.view);
  let sel = client.from(q.view).select('*', { count: 'exact' });
  for (const [col, v] of q.filters) sel = sel.eq(col, v);
  if (spec.kind === 'friends') {
    if (!me) return { rows: [], total: 0, you: null };
    const { data: f } = await client.from('follows').select('target_id').eq('user_id', me);
    sel = sel.in('id', [me, ...((f ?? []) as { target_id: string }[]).map(x => x.target_id)]);
  }
  const { data, count, error } = await sel.order(q.score, { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  const rows = ((data ?? []) as Record<string, unknown>[]).map((r, i) => ({
    rank: i + 1, userId: String(r[idCol]), username: String(r.username ?? ''), title: r.title as string | undefined, icon: r.icon as string | undefined, color: r.color as string | undefined, avatar: r.avatar as string | undefined, score: Number(r[q.score]), detail: q.detail(r), you: r[idCol] === me, extra: r,
  }));
  let you: BoardResult['you'] = null;
  if (me) {
    const mine = rows.find(r => r.you);
    if (mine) you = { rank: mine.rank, score: mine.score };
    else {
      let own = client.from(q.view).select(q.score);
      for (const [col, v] of q.filters) own = own.eq(col, v);
      const { data: m } = await own.eq(idCol, me).order(q.score, { ascending: false }).limit(1);
      const score = (m?.[0] as Record<string, number> | undefined)?.[q.score];
      if (score != null) {
        let above = client.from(q.view).select('*', { count: 'exact', head: true });
        for (const [col, v] of q.filters) above = above.eq(col, v);
        const { count: c } = await above.gt(q.score, score);
        you = { rank: (c ?? 0) + 1, score };
      }
    }
  }
  return { rows, total: count ?? rows.length, you };
}

/** A public profile by username. */
export async function loadProfile(username: string) {
  const client = await supa();
  const { data: p } = await client.from('lb_users').select('*').ilike('username', username).maybeSingle();
  if (!p) return null;
  const id = (p as { id: string }).id;
  const [players, ach, rebuild, ghost, followers, following] = await Promise.all([
    client.from('created_players').select('*').eq('user_id', id).order('legacy', { ascending: false }).limit(10),
    client.from('user_achievements').select('achievement_id').eq('user_id', id),
    client.from('rebuild_records').select('*').eq('user_id', id),
    client.from('hunt_ghosts').select('rating, wins, losses, squad').eq('user_id', id).maybeSingle(),
    client.from('follows').select('*', { count: 'exact', head: true }).eq('target_id', id),
    getAccount().userId ? client.from('follows').select('target_id').eq('user_id', getAccount().userId!).eq('target_id', id) : Promise.resolve({ data: [] }),
  ]);
  return {
    profile: p as { id: string; username: string; title: string; frame: string; icon?: string; color?: string; avatar?: string; level: number; xp: number; stats: Record<string, unknown> },
    players: (players.data ?? []) as Record<string, unknown>[], achievements: ((ach.data ?? []) as { achievement_id: string }[]).map(a => a.achievement_id),
    rebuild: (rebuild.data ?? []) as { scenario: string; best: number; stars: number; title_in: number | null }[],
    pvp: ghost.data as { rating: number; wins: number; losses: number; squad?: unknown } | null, followers: followers.count ?? 0, following: ((following.data ?? []) as unknown[]).length > 0,
  };
}

export async function setFollow(targetId: string, on: boolean): Promise<void> {
  const client = await supa();
  const me = getAccount().userId;
  if (!me) throw new Error('Sign in first.');
  const r = on ? await client.from('follows').insert({ user_id: me, target_id: targetId }) : await client.from('follows').delete().eq('user_id', me).eq('target_id', targetId);
  if (r.error && r.error.code !== '23505') throw new Error(r.error.message);
}

export async function report(targetId: string, reason: string): Promise<void> {
  const client = await supa();
  const me = getAccount().userId;
  if (!me) throw new Error('Sign in first.');
  const { error } = await client.from('reports').insert({ reporter: me, target: targetId, reason: reason.slice(0, 200) });
  if (error) throw new Error(error.message);
}

export async function searchUsers(prefix: string) {
  const client = await supa();
  const { data, error } = await client.from('lb_users').select('*').ilike('username', `${prefix.replace(/[%_]/g, '')}%`).order('xp', { ascending: false }).limit(10);
  if (error) throw error;
  return (data ?? []) as { id: string; username: string; title: string; level: number; icon?: string; color?: string; avatar?: string }[];
}

export async function achievementRarity(): Promise<Record<string, number>> {
  const client = await supa();
  const { data } = await client.from('achievement_rarity').select('achievement_id, pct');
  return Object.fromEntries(((data ?? []) as { achievement_id: string; pct: number }[]).map(r => [r.achievement_id, Number(r.pct)]));
}

export interface ActivityItem { at: string; username: string; icon?: string; color?: string; text: string }
const BOARD_NAME: Record<string, string> = { hunt: 'the Weekly Hunt', perfect: 'the 82-0 Challenge', career: 'Career of the Week', rebuild: 'Rebuild of the Week', guess: 'Guess the Player', hilo: 'Higher or Lower', bracket: 'the Bracket Challenge' };
/** What the GMs you follow have been up to: their latest weekly-board results and Daily Legend runs, newest first. */
export async function friendActivity(limit = 20): Promise<ActivityItem[]> {
  const me = getAccount().userId;
  if (!me) return [];
  const client = await supa();
  const { data: f, error: fe } = await client.from('follows').select('target_id').eq('user_id', me);
  if (fe) throw new Error(fe.message);
  const ids = ((f ?? []) as { target_id: string }[]).map(x => x.target_id);
  if (!ids.length) return [];
  const [weekly, daily] = await Promise.all([
    client.from('lb_weekly').select('*').in('user_id', ids).order('updated_at', { ascending: false }).limit(limit),
    client.from('lb_daily').select('*').in('user_id', ids).order('day', { ascending: false }).limit(limit),
  ]);
  const items: ActivityItem[] = [];
  for (const r of (weekly.data ?? []) as Record<string, unknown>[]) items.push({ at: String(r.updated_at ?? ''), username: String(r.username ?? ''), icon: r.icon as string | undefined, color: r.color as string | undefined,
    text: `scored ${Number(r.score).toLocaleString()} on ${BOARD_NAME[String(r.board)] ?? String(r.board)}${r.detail ? ` (${String(r.detail).slice(0, 60)})` : ''}` });
  for (const r of (daily.data ?? []) as Record<string, unknown>[]) items.push({ at: `${String(r.day)}T12:00:00Z`, username: String(r.username ?? ''), icon: r.icon as string | undefined, color: r.color as string | undefined,
    text: r.won ? `won the Daily Legend (${r.wins}-${r.losses} in games)` : `reached series ${Number(r.stop) + 1} of the Daily Legend` });
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
