import { count, type SupaEnv, type Fetch } from './supabase';
import type { Derived } from './derive';
import { weekKey } from '../src/retention/week';
import { seasonOf } from '../src/cloud/ranked';

/*
 * Leaderboard honors, worked out at sync by comparing the player with everyone else on the boards. Once earned they
 * stay (a #1 finish is a #1 finish). They unlock titles, the medal icon and the prism name colour in the game
 * (src/profile/cosmetics.ts). A board needs a real field before it hands out honors, so an empty league can't.
 */

const MIN_FIELD = { gm: 10, weekly: 3, daily: 3, pvp: 20, ranked: 20 };
const enc = encodeURIComponent;

export async function computeHonors(env: SupaEnv, userId: string, d: Derived, now: Date, previous: string[], f: Fetch = fetch): Promise<string[]> {
  const honors = new Set(previous);
  const others = `user_id=neq.${userId}`;
  // The GM board, by XP.
  const gms = await count(env, `lb_users?select=id`, f);
  if (gms >= MIN_FIELD.gm) {
    const rank = (await count(env, `lb_users?select=id&xp=gt.${d.profile.xp}&id=neq.${userId}`, f)) + 1;
    if (rank === 1) honors.add('gm-1');
    if (rank <= 10) honors.add('gm-10');
    if (rank <= 100) honors.add('gm-100');
  }
  // Weekly boards and Daily Legends that are over: #1 of a real field.
  const today = now.toISOString().slice(0, 10), thisWeek = weekKey(now);
  for (const w of d.weekly.filter(x => x.week < thisWeek).slice(-6)) {
    const q = `weekly_scores?select=user_id&board=eq.${enc(w.board)}&week=eq.${enc(w.week)}&${others}`;
    if ((await count(env, q, f)) + 1 >= MIN_FIELD.weekly && (await count(env, `${q}&score=gt.${w.score}`, f)) === 0) honors.add('weekly-1');
  }
  for (const day of d.daily.filter(x => x.day < today).slice(-7)) {
    const q = `daily_legend?select=user_id&day=eq.${enc(day.day)}&${others}`;
    if ((await count(env, q, f)) + 1 >= MIN_FIELD.daily && (await count(env, `${q}&score=gt.${day.score}`, f)) === 0) honors.add('daily-1');
  }
  // Ranked this month (the points board).
  const season = seasonOf(today);
  const mine = d.ranked.filter(r => r.season === season).reduce((n, r) => n + r.points, 0);
  if (mine > 0) {
    const q = `lb_ranked?select=user_id&season=eq.${enc(season)}&${others}`;
    if ((await count(env, q, f)) + 1 >= MIN_FIELD.ranked && (await count(env, `${q}&points=gt.${mine}`, f)) < 10) honors.add('ranked-10');
  }
  return [...honors].sort();
}

/** PvP is rated on the server (hunt_ghosts), so its honor is checked there after each result. */
export async function pvpHonor(env: SupaEnv, userId: string, rating: number, f: Fetch = fetch): Promise<boolean> {
  const q = `hunt_ghosts?select=user_id&user_id=neq.${userId}`;
  return (await count(env, q, f)) + 1 >= MIN_FIELD.pvp && (await count(env, `${q}&rating=gt.${rating}`, f)) < 10;
}
