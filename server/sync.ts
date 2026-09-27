import { derive, sanitizeBlob } from './derive';
import { getUser, rest, upsert, deleteUser, json, bearer, type SupaEnv, type Fetch } from './supabase';

/*
 * /api/sync: POST stores the signed-in player's merged progress and rebuilds their public rows from it;
 * DELETE deletes the account and everything with it.
 */

export const MAX_BYTES = 800_000;

export async function handleSync(req: Request, env: SupaEnv | null, now = new Date(), f: Fetch = fetch): Promise<Response> {
  if (!env) return json({ error: 'Accounts are not set up on this site yet.' }, 503);
  const token = bearer(req);
  const user = token ? await getUser(env, token, f).catch(() => null) : null;
  if (!user) return json({ error: 'Please sign in again.' }, 401);
  const id = user.id, eq = `user_id=eq.${id}`;
  try {
    if (req.method === 'DELETE') { await deleteUser(env, id, f); return json({ ok: true }); }
    if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
    const text = await req.text();
    if (text.length > MAX_BYTES) return json({ error: 'Your progress is too large to sync.' }, 413);
    let blob;
    try { blob = sanitizeBlob(JSON.parse(text)); } catch { blob = null; }
    if (!blob) return json({ error: 'Bad progress data.' }, 400);
    const d = derive(blob, now);
    const own = <T extends object>(rows: T[]) => rows.map(r => ({ ...r, user_id: id }));
    await upsert(env, 'progress', [{ user_id: id, data: blob, size: text.length, updated_at: now.toISOString() }], 'user_id', f);
    await Promise.all([
      rest(env, 'PATCH', `profiles?id=eq.${id}`, { level: d.profile.level, xp: d.profile.xp, stats: d.profile.stats, updated_at: now.toISOString() }, 'return=minimal', f),
      rest(env, 'DELETE', `user_achievements?${eq}`, undefined, 'return=minimal', f).then(() => upsert(env, 'user_achievements', own(d.achievements.map(a => ({ achievement_id: a }))), 'user_id,achievement_id', f)),
      upsert(env, 'created_players', own(d.players), 'user_id,career_id', f),
      upsert(env, 'weekly_scores', own(d.weekly.map(w => ({ ...w, updated_at: now.toISOString() }))), 'board,week,user_id', f),
      upsert(env, 'daily_legend', own(d.daily), 'day,user_id', f),
      upsert(env, 'rebuild_records', own(d.rebuild), 'scenario,user_id', f),
      upsert(env, 'code_results', own(d.codes.map(c => ({ ...c, updated_at: now.toISOString() }))), 'code,user_id', f),
      upsert(env, 'ranked_events', own(d.ranked), 'user_id,event', f),
    ]);
    return json({ ok: true, level: d.profile.level, xp: d.profile.xp });
  } catch {
    return json({ error: 'Cloud sync is having trouble. Your progress is safe on this device; it will sync later.' }, 502);
  }
}
