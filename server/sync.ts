import { ARCADE_BOARDS, derive, sanitizeBlob, publicAvatar } from './derive';
import { mergeStorage, mergeCareers } from '../src/cloud/merge';
import { computeHonors, pvpHonor } from './honors';
import { getUser, rest, upsert, deleteUser, json, bearer, type SupaEnv, type Fetch } from './supabase';

/*
 * /api/sync: POST stores the signed-in player's merged progress and rebuilds their public rows from it;
 * DELETE deletes the account and everything with it.
 */

/** The upload as it travels (gzip-compressed by the game), and the progress once unpacked and merged. */
export const MAX_BYTES = 800_000;
export const MAX_RAW_BYTES = 6_000_000;
export const SYNC_ENCODING_HEADER = 'X-Sync-Encoding';
const tooLarge = (size: number) => json({ error: `Your progress is too large to sync (${(size / 1_000_000).toFixed(1)} MB; the limit is ${MAX_RAW_BYTES / 1_000_000} MB).`, size }, 413);

/** The request body as text: gzip-compressed when the game says so (much smaller on the wire), plain otherwise. */
async function bodyText(req: Request): Promise<{ text: string; wire: number } | { error: Response }> {
  const raw = new Uint8Array(await req.arrayBuffer());
  if (raw.length > MAX_BYTES) return { error: tooLarge(raw.length) };
  if (req.headers.get(SYNC_ENCODING_HEADER) !== 'gzip') return { text: new TextDecoder().decode(raw), wire: raw.length };
  try {
    const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'));
    const reader = stream.getReader(), chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_RAW_BYTES) { await reader.cancel(); return { error: tooLarge(total) }; }
      chunks.push(value);
    }
    const all = new Uint8Array(total);
    let at = 0;
    for (const c of chunks) { all.set(c, at); at += c.length; }
    return { text: new TextDecoder().decode(all), wire: raw.length };
  } catch { return { error: json({ error: 'Bad progress data.' }, 400) }; }
}
/** One push every few seconds per account is plenty (the game batches its own). */
export const MIN_GAP_MS = 3_000;

type CareerRow = { id: string; updatedAt: number; status: string };
const careerRows = (list: unknown[]) => list.filter((c): c is CareerRow => typeof (c as CareerRow).id === 'string' && typeof (c as CareerRow).updatedAt === 'number');

export async function handleSync(req: Request, env: SupaEnv | null, now = new Date(), f: Fetch = fetch): Promise<Response> {
  if (!env) return json({ error: 'Accounts are not set up on this site yet.' }, 503);
  const token = bearer(req);
  const user = token ? await getUser(env, token, f).catch(() => null) : null;
  if (!user) return json({ error: 'Please sign in again.' }, 401);
  const id = user.id, eq = `user_id=eq.${id}`;
  try {
    if (req.method === 'DELETE') { await deleteUser(env, id, f); return json({ ok: true }); }
    if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
    const body = await bodyText(req);
    if ('error' in body) return body.error;
    const { text } = body;
    if (text.length > MAX_RAW_BYTES) return tooLarge(text.length);
    let blob;
    try { blob = sanitizeBlob(JSON.parse(text)); } catch { blob = null; }
    if (!blob) return json({ error: 'Bad progress data.' }, 400);
    // Two devices can push around the same time: merge with what is stored (best of both) instead of overwriting it.
    const stored = ((await rest(env, 'GET', `progress?${eq}&select=data,updated_at`, undefined, undefined, f)) as { data: unknown; updated_at: string }[] | null)?.[0];
    if (stored && now.getTime() - Date.parse(stored.updated_at) < MIN_GAP_MS) return json({ error: 'Syncing too often.', retry: true }, 429);
    const prev = stored ? sanitizeBlob(stored.data) : null;
    if (prev) blob = { ...blob, storage: mergeStorage(blob.storage, prev.storage), careers: mergeCareers(careerRows(blob.careers), careerRows(prev.careers)) };
    const size = JSON.stringify(blob).length;
    if (size > MAX_RAW_BYTES) return tooLarge(size);
    const d = derive(blob, now);
    const own = <T extends object>(rows: T[]) => rows.map(r => ({ ...r, user_id: id }));
    await upsert(env, 'progress', [{ user_id: id, data: blob, size, updated_at: now.toISOString() }], 'user_id', f);
    // Leaderboard honors: compared with everyone else now; once earned they stay. A failure keeps what was there.
    // A database without the role column yet reads without it.
    const current = ((await rest(env, 'GET', `profiles?id=eq.${id}&select=stats,role`, undefined, undefined, f).catch(() => rest(env, 'GET', `profiles?id=eq.${id}&select=stats`, undefined, undefined, f))) as { stats?: { honors?: unknown }; role?: string | null }[] | null)?.[0];
    const owner = current?.role === 'owner';
    const previous = Array.isArray(current?.stats?.honors) ? (current!.stats!.honors as unknown[]).filter((h): h is string => typeof h === 'string') : [];
    let honors = previous;
    try {
      honors = await computeHonors(env, id, d, now, previous, f);
      const ghost = ((await rest(env, 'GET', `hunt_ghosts?${eq}&select=rating`, undefined, undefined, f)) as { rating: number }[] | null)?.[0];
      if (ghost && !honors.includes('pvp-10') && await pvpHonor(env, id, ghost.rating, f)) honors = [...honors, 'pvp-10'].sort();
    } catch { /* keep the honors already earned */ }
    // Your character on the boards (a database without the avatar column yet just skips it).
    const avatar = publicAvatar(blob, d.profile.level, honors, owner);
    if (avatar) await rest(env, 'PATCH', `profiles?id=eq.${id}`, { avatar }, 'return=minimal', f).catch(() => null);
    await Promise.all([
      rest(env, 'PATCH', `profiles?id=eq.${id}`, { level: d.profile.level, xp: d.profile.xp, stats: { ...d.profile.stats, honors }, updated_at: now.toISOString() }, 'return=minimal', f),
      rest(env, 'DELETE', `user_achievements?${eq}`, undefined, 'return=minimal', f).then(() => upsert(env, 'user_achievements', own(d.achievements.map(a => ({ achievement_id: a }))), 'user_id,achievement_id', f)),
      upsert(env, 'created_players', own(d.players), 'user_id,career_id', f),
      upsert(env, 'weekly_scores', own(d.weekly.filter(w => !ARCADE_BOARDS.includes(w.board)).map(w => ({ ...w, updated_at: now.toISOString() }))), 'board,week,user_id', f),
      // The quick games' boards on their own: a database that does not allow them yet keeps everything else.
      upsert(env, 'weekly_scores', own(d.weekly.filter(w => ARCADE_BOARDS.includes(w.board)).map(w => ({ ...w, updated_at: now.toISOString() }))), 'board,week,user_id', f).catch(() => null),
      upsert(env, 'daily_legend', own(d.daily), 'day,user_id', f),
      upsert(env, 'rebuild_records', own(d.rebuild), 'scenario,user_id', f),
      upsert(env, 'code_results', own(d.codes.map(c => ({ ...c, updated_at: now.toISOString() }))), 'code,user_id', f),
      upsert(env, 'ranked_events', own(d.ranked), 'user_id,event', f),
    ]);
    return json({ ok: true, level: d.profile.level, xp: d.profile.xp, honors, avatar, owner });
  } catch {
    return json({ error: 'Cloud sync is having trouble. Your progress is safe on this device; it will sync later.' }, 502);
  }
}
