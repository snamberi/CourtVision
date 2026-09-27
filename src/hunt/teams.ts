import type { NbaHistory } from '../history/nbaHistoryData';
import { cardPool, type HuntCard } from './cards';

/*
 * The teams you hunt: real team-seasons from NBA history, each with its real roster (the ten who played the most
 * minutes that season) as cards. Strength is the rating of its best eight, so a stop can ask for "a good 1980s
 * team" and the boss can be one of the best teams ever.
 */

export interface HuntTeam {
  /** `${abbr}@${end}` */
  id: string;
  abbr: string;
  name: string;
  end: number;
  w: number; l: number;
  champion: boolean;
  /** Card ids of the rotation, best first. */
  roster: string[];
  strength: number;
}

const NBA = new Set(['BAA', 'NBA']);
const cache = new WeakMap<NbaHistory, HuntTeam[]>();

export function huntTeams(h: NbaHistory): HuntTeam[] {
  const cached = cache.get(h);
  if (cached) return cached;
  const pool = cardPool(h);
  const champs = new Set(h.champions.map(c => `${c.champion}@${c.season}`));
  // Minutes per player per team-season (team stints, not season totals).
  const minutes = new Map<string, { idx: number; mp: number }[]>();
  for (const r of h.seasons) {
    if (r.isAggregate || !NBA.has(r.league)) continue;
    const k = `${r.team}@${r.season}`;
    (minutes.get(k) ?? minutes.set(k, []).get(k)!).push({ idx: r.player, mp: r.stats.mp ?? (r.stats.g ?? 0) * 20 });
  }
  const out: HuntTeam[] = [];
  for (const t of h.teams) {
    if (!NBA.has(t.league) || t.w == null || t.l == null) continue;
    const id = `${t.abbr}@${t.season}`;
    const rows = (minutes.get(id) ?? []).sort((a, b) => b.mp - a.mp);
    const roster: HuntCard[] = [];
    for (const r of rows) {
      const card = pool.byId.get(`${h.players[r.idx].id}@${t.season}`);
      if (card && !roster.some(c => c.id === card.id)) roster.push(card);
      if (roster.length === 10) break;
    }
    if (roster.length < 8) continue;
    const best = [...roster].sort((a, b) => b.ovr - a.ovr);
    const strength = Math.round(best.slice(0, 8).reduce((n, c, i) => n + c.ovr * (i < 5 ? 1.2 : 0.7), 0) / (5 * 1.2 + 3 * 0.7) * 10) / 10;
    out.push({ id, abbr: t.abbr, name: t.name, end: t.season, w: t.w, l: t.l, champion: champs.has(id), roster: best.map(c => c.id), strength });
  }
  cache.set(h, out);
  return out;
}

export const teamLabel = (t: HuntTeam) => `${t.end - 1}-${String(t.end).slice(2)} ${t.name}`;
