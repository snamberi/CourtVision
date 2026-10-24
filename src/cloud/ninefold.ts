import type { SupabaseClient } from '@supabase/supabase-js';
import type { CloudProfile } from './account';
import { HONORS, LEVEL_ROAD } from '../profile/cosmetics';
import { TIERS } from './ranked';

/*
 * Ninefold profile card: a small public summary of this account's Court Vision progress, shown on the NineFoldVision
 * site next to the player's other games. It only reads Court Vision's own data; nothing here changes progression.
 */

const SECONDS_PER_HOUR = 3600;
const HOURS_PRECISION = 10;
const MAX_MOMENTS = 3;
const MAX_ACTIVITY_TEXT = 140;

export interface CourtSummary {
  v: 1;
  level: number;
  xp: number;
  title: string;
  scoutRank: string | null;
  hours: number | null;
  placements: { board: string; rank: number; season: string | null }[];
  cosmetics: { frame: string | null; icon: string | null; color: string | null; titles: number };
  achievements: number;
  updatedAt: string;
}

/** The highest title on the level road this level has reached ("Scout" at 10, …). */
export function roadRank(level: number): string | null {
  const titles = LEVEL_ROAD.filter(([lv, kind]) => kind === 'title' && lv <= level);
  return titles.length ? titles[titles.length - 1][2] : null;
}

const honorsOf = (stats: Record<string, unknown>): string[] =>
  Array.isArray(stats.honors) ? stats.honors.filter((h): h is string => typeof h === 'string' && HONORS.some(x => x.id === h)) : [];

export function buildSummary(p: CloudProfile, achievements: number, now = new Date()): CourtSummary {
  const stats = p.stats ?? {};
  const secs = typeof stats.playSeconds === 'number' ? stats.playSeconds : null;
  const honors = honorsOf(stats);
  return {
    v: 1,
    level: p.level,
    xp: p.xp,
    title: p.title,
    scoutRank: roadRank(p.level),
    hours: secs == null ? null : Math.round((secs / SECONDS_PER_HOUR) * HOURS_PRECISION) / HOURS_PRECISION,
    placements: honors.map(id => ({ board: HONORS.find(h => h.id === id)!.title, rank: Number(id.split('-').pop()) || 1, season: null })),
    cosmetics: { frame: p.frame ?? null, icon: p.icon ?? null, color: p.color ?? null, titles: LEVEL_ROAD.filter(([lv, kind]) => kind === 'title' && lv <= p.level).length + 1 + honors.length },
    achievements,
    updatedAt: now.toISOString(),
  };
}

interface Snapshot { level: number; honors: string[]; ranked: string | null }
export interface ActivityRow { kind: string; text: string }

/** Big moments since the last published snapshot: level ups, new honors, a better ranked tier. At most three. */
export function newMoments(prev: Snapshot | null, next: Snapshot): ActivityRow[] {
  if (!prev) return [];
  const out: ActivityRow[] = [];
  if (next.level > prev.level) {
    const rank = roadRank(next.level);
    out.push({ kind: 'level-up', text: `Reached level ${next.level}${rank ? ` (${rank})` : ''} in Court Vision` });
  }
  out.push(...next.honors.filter(x => !prev.honors.includes(x)).map(h => ({ kind: 'honor', text: `Earned ${HONORS.find(x => x.id === h)?.title ?? h} in Court Vision` })));
  const tierIndex = (t: string | null) => (t ? TIERS.findIndex(x => x.id === t) : -1);
  if (tierIndex(next.ranked) > tierIndex(prev.ranked)) {
    const name = TIERS.find(t => t.id === next.ranked)?.name ?? next.ranked;
    out.push({ kind: 'ranked-tier', text: `Reached ${name} in Court Vision ranked` });
  }
  return out.slice(0, MAX_MOMENTS).map(r => ({ ...r, text: r.text.slice(0, MAX_ACTIVITY_TEXT) }));
}

const SNAPSHOT_KEY = 'cv-ninefold-snapshot';
let lastSent = '';


/** Publishes the profile card and any new big moments. Failures are logged and never reach the player. */
export async function publishNinefold(client: SupabaseClient, userId: string, profile: CloudProfile | null): Promise<void> {
  if (!profile) return;
  try {
    const { count } = await client.from('user_achievements').select('achievement_id', { count: 'exact', head: true }).eq('user_id', userId);
    const summary = buildSummary(profile, count ?? 0);
    const fingerprint = JSON.stringify({ userId, ...summary, updatedAt: undefined });
    if (fingerprint !== lastSent) {
      const { error } = await client.from('game_summaries').upsert({ user_id: userId, game: 'courtvision', summary, updated_at: summary.updatedAt });
      if (error) throw new Error(error.message);
      lastSent = fingerprint;
    }
    const stats = profile.stats ?? {};
    const snap: Snapshot = { level: profile.level, honors: honorsOf(stats), ranked: typeof stats.rankedBest === 'string' ? stats.rankedBest : null };
    let prev: Snapshot | null = null;
    try { prev = JSON.parse(localStorage.getItem(`${SNAPSHOT_KEY}:${userId}`) ?? 'null') as Snapshot | null; } catch { prev = null; }
    const rows = newMoments(prev, snap);
    if (rows.length) {
      const { error } = await client.from('activity').insert(rows.map(r => ({ user_id: userId, game: 'courtvision', ...r })));
      if (error) throw new Error(error.message);
    }
    try { localStorage.setItem(`${SNAPSHOT_KEY}:${userId}`, JSON.stringify(snap)); } catch { /* storage blocked */ }
  } catch (e) {
    console.warn('Ninefold profile card not updated:', e instanceof Error ? e.message : e);
  }
}
