import { eloDelta } from '../src/hunt/pvp';
import { ERAS } from '../src/hunt/eras';
import { getUser, rest, upsert, json, bearer, type SupaEnv, type Fetch } from './supabase';

/*
 * /api/pvp: League Hunt PvP.
 *   publish  your finished hunt squad becomes your ghost (your rating stays)
 *   find     a match against a ghost near your rating: the server picks the opponent, the seed and the era, and the
 *            match counts as a loss until its result comes in (no rerolling a bad matchup)
 *   result   the series you played; ratings move by Elo
 * A pending match older than 20 minutes is settled as a loss.
 */

const STALE_MS = 20 * 60_000;
interface Match { id: string; challenger: string; defender: string; seed: number; era: string; status: string; created_at: string }
interface GhostRow { user_id: string; squad: unknown; rating: number; wins: number; losses: number }

function ghostShapeOk(g: unknown): boolean {
  const x = g as { squad?: unknown[]; items?: unknown[]; boosts?: unknown[]; growth?: object; training?: object; reached?: number };
  return !!x && Array.isArray(x.squad) && x.squad.length === 6 && x.squad.every(id => typeof id === 'string' && id.length < 80) && Array.isArray(x.items) && x.items.length <= 6
    && Array.isArray(x.boosts) && x.boosts.length <= 3 && typeof x.growth === 'object' && typeof x.training === 'object' && JSON.stringify(g).length < 4000;
}

async function ghost(env: SupaEnv, id: string, f: Fetch): Promise<GhostRow | null> {
  const rows = await rest(env, 'GET', `hunt_ghosts?user_id=eq.${id}&select=*`, undefined, undefined, f) as GhostRow[];
  return rows[0] ?? null;
}

async function settle(env: SupaEnv, m: Match, won: boolean, games: unknown, f: Fetch): Promise<{ delta: number; rating: number }> {
  const [me, them] = await Promise.all([ghost(env, m.challenger, f), ghost(env, m.defender, f)]);
  const delta = eloDelta(me?.rating ?? 1000, them?.rating ?? 1000, won);
  await rest(env, 'PATCH', `pvp_matches?id=eq.${m.id}&status=eq.pending`, { status: won ? 'won' : 'lost', games, delta }, 'return=minimal', f);
  if (me) await rest(env, 'PATCH', `hunt_ghosts?user_id=eq.${m.challenger}`, { rating: me.rating + delta, wins: me.wins + (won ? 1 : 0), losses: me.losses + (won ? 0 : 1) }, 'return=minimal', f);
  if (them) await rest(env, 'PATCH', `hunt_ghosts?user_id=eq.${m.defender}`, { rating: them.rating - delta, wins: them.wins + (won ? 0 : 1), losses: them.losses + (won ? 1 : 0) }, 'return=minimal', f);
  return { delta, rating: (me?.rating ?? 1000) + delta };
}

export async function handlePvp(req: Request, env: SupaEnv | null, now = new Date(), f: Fetch = fetch, random = Math.random): Promise<Response> {
  if (!env) return json({ error: 'Accounts are not set up on this site yet.' }, 503);
  const token = bearer(req);
  const user = token ? await getUser(env, token, f).catch(() => null) : null;
  if (!user) return json({ error: 'Please sign in again.' }, 401);
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  let body: { action?: string; ghost?: unknown; matchId?: string; won?: boolean; games?: { won?: boolean }[] };
  try { body = JSON.parse(await req.text()); } catch { return json({ error: 'Bad request.' }, 400); }
  const me = user.id;
  try {
    if (body.action === 'publish') {
      if (!ghostShapeOk(body.ghost)) return json({ error: 'That squad cannot be published.' }, 400);
      await upsert(env, 'hunt_ghosts', [{ user_id: me, squad: body.ghost, updated_at: now.toISOString() }], 'user_id', f);
      return json({ ok: true });
    }
    if (body.action === 'find') {
      const mine = await ghost(env, me, f);
      if (!mine) return json({ error: 'Finish a League Hunt first: your squad becomes your PvP team.' }, 400);
      const pending = await rest(env, 'GET', `pvp_matches?challenger=eq.${me}&status=eq.pending&select=*&order=created_at.desc`, undefined, undefined, f) as Match[];
      for (const m of pending) if (now.getTime() - Date.parse(m.created_at) > STALE_MS) await settle(env, m, false, null, f);
      let match = pending.find(m => now.getTime() - Date.parse(m.created_at) <= STALE_MS) ?? null;
      if (!match) {
        const r = mine.rating;
        const [up, down] = await Promise.all([
          rest(env, 'GET', `hunt_ghosts?user_id=neq.${me}&rating=gte.${r}&select=user_id,rating&order=rating.asc&limit=15`, undefined, undefined, f) as Promise<GhostRow[]>,
          rest(env, 'GET', `hunt_ghosts?user_id=neq.${me}&rating=lt.${r}&select=user_id,rating&order=rating.desc&limit=15`, undefined, undefined, f) as Promise<GhostRow[]>,
        ]);
        const recent = await rest(env, 'GET', `pvp_matches?challenger=eq.${me}&select=defender&order=created_at.desc&limit=3`, undefined, undefined, f) as { defender: string }[];
        let pool = [...up, ...down].filter(g => !recent.some(x => x.defender === g.user_id));
        if (!pool.length) pool = [...up, ...down];
        if (!pool.length) return json({ error: 'No opponents yet. Invite a friend: their finished hunt becomes a ghost to play.' }, 404);
        const opp = pool[Math.floor(random() * pool.length)];
        const created = await rest(env, 'POST', 'pvp_matches', [{ challenger: me, defender: opp.user_id, seed: Math.floor(random() * 1_000_000_000), era: ERAS[Math.floor(random() * ERAS.length)].id, created_at: now.toISOString() }], 'return=representation', f) as Match[];
        match = created[0];
      }
      const [opp] = await rest(env, 'GET', `lb_pvp?user_id=eq.${match.defender}&select=user_id,username,title,rating,wins,losses,squad`, undefined, undefined, f) as Record<string, unknown>[];
      if (!opp) { await settle(env, match, false, null, f); return json({ error: 'That opponent is gone. Try again.' }, 409); }
      return json({ match: { id: match.id, seed: Number(match.seed), era: match.era }, you: { rating: mine.rating, squad: mine.squad }, opponent: opp });
    }
    if (body.action === 'result') {
      const [m] = await rest(env, 'GET', `pvp_matches?id=eq.${encodeURIComponent(String(body.matchId))}&challenger=eq.${me}&select=*`, undefined, undefined, f) as Match[];
      if (!m || m.status !== 'pending') return json({ error: 'That match is already settled.' }, 409);
      const games = Array.isArray(body.games) ? body.games.slice(0, 7) : [];
      const wins = games.filter(g => g?.won).length, losses = games.length - wins;
      const consistent = games.length >= 4 && (body.won ? wins === 4 && losses <= 3 : losses === 4 && wins <= 3);
      if (!consistent) return json({ error: 'That result does not add up.' }, 400);
      const { delta, rating } = await settle(env, m, !!body.won, games, f);
      return json({ ok: true, delta, rating });
    }
    return json({ error: 'Unknown action.' }, 400);
  } catch {
    return json({ error: 'PvP is having trouble. Try again soon.' }, 502);
  }
}
