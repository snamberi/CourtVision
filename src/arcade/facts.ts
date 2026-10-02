import type { NbaHistory, HistPlayer } from '../history/nbaHistoryData';

/*
 * Career facts for the quick games (Guess the Player, Higher or Lower): one line per player from real NBA history.
 * Computed once per loaded dataset.
 */

export interface PlayerFacts {
  idx: number; name: string;
  /** The franchise he played the most games for, by its latest name ("Golden State"), and its code. */
  team: string; franchise: string;
  pos: string; heightIn: number | null; debut: number; last: number;
  games: number; points: number; ppg: number; rpg: number; apg: number;
  /** NBA All-Star selections (ABA games not counted). */
  allStars: number; rings: number; hallOfFame: boolean;
}

const cache = new WeakMap<NbaHistory, PlayerFacts[]>();
const round1 = (n: number) => Math.round(n * 10) / 10;

export function allFacts(h: NbaHistory): PlayerFacts[] {
  const hit = cache.get(h);
  if (hit) return hit;
  // Franchise of each team-season, and each franchise's latest name.
  const franchiseOf = new Map<string, string>(), latest = new Map<string, { season: number; name: string }>();
  for (const t of h.teams) {
    const f = t.franchise ?? t.abbr;
    franchiseOf.set(`${t.abbr}@${t.season}`, f);
    const l = latest.get(f);
    if (!l || t.season > l.season) latest.set(f, { season: t.season, name: t.name });
  }
  const allStars = new Map<number, Set<number>>();
  for (const a of h.allStars) { if (a.league !== 'NBA') continue; const s = allStars.get(a.player) ?? new Set(); s.add(a.season); allStars.set(a.player, s); }
  const rings = new Map<number, number>();
  for (const c of h.champions) for (const p of c.rosterCredit) rings.set(p, (rings.get(p) ?? 0) + 1);

  const out: PlayerFacts[] = [];
  for (const p of h.players) {
    const rows = h.seasonsByPlayer.get(p.idx) ?? [];
    if (!rows.length || p.firstSeason == null) continue;
    let games = 0, pts = 0, trb = 0, ast = 0, trbGames = 0, astGames = 0;
    const gamesByFranchise = new Map<string, number>();
    const seasonsCounted = new Set<number>();
    for (const r of rows) {
      const g = r.stats.g ?? 0;
      if (!r.isAggregate) { const f = franchiseOf.get(`${r.team}@${r.season}`) ?? r.team; gamesByFranchise.set(f, (gamesByFranchise.get(f) ?? 0) + g); }
      // Totals: the whole-season row for a traded player, otherwise the one stint.
      const hasAggregate = rows.some(x => x.season === r.season && x.isAggregate);
      if ((hasAggregate && !r.isAggregate) || seasonsCounted.has(r.season)) continue;
      seasonsCounted.add(r.season);
      games += g; pts += r.stats.pts ?? 0;
      if (r.stats.trb != null) { trb += r.stats.trb; trbGames += g; }
      if (r.stats.ast != null) { ast += r.stats.ast; astGames += g; }
    }
    if (!games) continue;
    const [franchise] = [...gamesByFranchise].sort((a, b) => b[1] - a[1])[0] ?? [rows[0].team];
    out.push({
      idx: p.idx, name: p.displayName, franchise, team: latest.get(franchise)?.name ?? franchise,
      pos: p.pos ?? '?', heightIn: p.heightIn, debut: p.firstSeason, last: p.lastSeason ?? p.firstSeason,
      games, points: pts, ppg: round1(pts / games), rpg: trbGames ? round1(trb / trbGames) : 0, apg: astGames ? round1(ast / astGames) : 0,
      allStars: allStars.get(p.idx)?.size ?? 0, rings: rings.get(p.idx) ?? 0, hallOfFame: p.hallOfFame,
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  cache.set(h, out);
  return out;
}

/** Players most fans would know: three or more NBA All-Star games and a real career, since 1960. */
export const isNotable = (f: PlayerFacts) => f.debut >= 1960 && f.games >= 400 && (f.allStars >= 3 || (f.hallOfFame && f.allStars >= 1));
/** Players you can type in as a guess: a real career (100+ games) or any All-Star. */
export const isGuessable = (f: PlayerFacts) => f.games >= 100 || f.allStars > 0;

export const heightLabel = (inches: number | null) => (inches == null ? '—' : `${Math.floor(inches / 12)}'${inches % 12}"`);
/** The positions in a label like "G-F", as letters. */
export const posLetters = (pos: string) => new Set(pos.toUpperCase().split(/[^A-Z]+/).flatMap(p => (p === 'PG' || p === 'SG' ? ['G'] : p === 'SF' || p === 'PF' ? ['F'] : p.split(''))).filter(Boolean));

export type { HistPlayer };
