import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import type { Attributes, PlayerSeason, SeasonStatTotals } from '../simulation/types';
import type { NbaHistory } from '../history/nbaHistoryData';
import { superFactor, athleticismOf, bodyOf, iqOf } from '../simulation/engine/superstar';
import { blockLength } from '../simulation/engine/ballHandler';
import type { CareerYear } from './career';

/*
 * Career Mode read-outs built from data the career already has (no new save fields):
 *  - superstar traits: what each rating past 99 (and height past 7'0") is doing for him right now;
 *  - season goals: three targets for the coming season, set from the last one, graded when it ends;
 *  - league ranks: where his last season placed among everyone in the league;
 *  - career highs: his best single games and double/triple-double counts;
 *  - all-time ranks: his career totals against every NBA player ever, and the next legend to pass.
 */

// ---------------------------------------------------------------- superstar traits

export interface Trait { id: 'iron' | 'paint' | 'tower' | 'general'; name: string; category: string; rating: number; unlockAt: number; fullAt: number; active: boolean; progress: number; effect: string;
  /** The signature move a trait at full power (110, or 7'8") unlocks. */
  signature: string; signed: boolean }
const SIGNATURE: Record<Trait['id'], string> = { iron: 'Perpetual Motion', paint: 'The Bulldozer', tower: 'No Fly Zone', general: 'The Maestro' };

const pctOf = (n: number) => `${Math.round(n * 100)}%`;
export function superstarTraits(a: Attributes): Trait[] {
  const ath = athleticismOf(a), body = bodyOf(a), iq = iqOf(a), h = a.physical.heightInches || 0;
  const fa = Math.min(1, superFactor(ath)), fb = Math.min(1, superFactor(body)), fi = Math.min(1, superFactor(iq));
  const prog = (v: number, from: number, to: number) => Math.max(0, Math.min(1, (v - from) / (to - from)));
  return withSignatures([
    { id: 'iron', name: 'Iron Man', category: 'Athleticism', rating: Math.round(ath), unlockAt: 100, fullAt: 110, active: fa > 0, progress: prog(ath, 99, 110),
      effect: fa >= 1 ? 'Never needs a rest: plays the whole game.' : fa > 0 ? `Tires ${pctOf(0.8 * fa)} slower and gets hurt ${pctOf(0.6 * fa)} less.` : 'Past 99, he tires slower and plays more minutes (all 48 at 110).' },
    { id: 'paint', name: 'Paint Beast', category: 'Body', rating: Math.round(body), unlockAt: 100, fullAt: 110, active: fb > 0, progress: prog(body, 99, 110),
      effect: fb > 0 ? `+${Math.round(16 * fb)} points at the rim and ${pctOf(fb)} more shots inside.` : 'Past 99, he owns the paint: more shots at the rim, and he makes them.' },
    { id: 'tower', name: 'Skyscraper', category: 'Height', rating: h, unlockAt: 85, fullAt: 92, active: h > 84, progress: prog(h, 84, 92),
      effect: h > 84 ? `Blocks reach ×${blockLength(h).toFixed(1)}, and more rebounds every inch.` : 'Over 7\'0", every inch adds rebounds and blocks.' },
    { id: 'general', name: 'Floor General', category: 'IQ & Clutch', rating: Math.round(iq), unlockAt: 100, fullAt: 110, active: fi > 0, progress: prog(iq, 99, 110),
      effect: fi > 0 ? `Runs the offense: ${pctOf(0.25 * fi)} more passes, and teammates shoot +${Math.round(4 * fi)} points better with him on the floor.` : 'Past 99, the offense runs through him: assists, better shots, more wins.' },
  ]);
}
function withSignatures(list: Omit<Trait, 'signature' | 'signed'>[]): Trait[] {
  return list.map(t => ({ ...t, signature: SIGNATURE[t.id], signed: t.progress >= 1 }));
}

// ---------------------------------------------------------------- season goals

export interface Goal { id: string; text: string }
export interface GoalResult extends Goal { hit: boolean; got: string }

const pg = (n: number, g: number) => (g > 0 ? n / g : 0);
const ALL_NBA = ['allLeague1', 'allLeague2', 'allLeague3'];

/** Three goals for the season after `prev` (or a rookie's first). */
export function seasonGoals(prev: CareerYear | undefined): Goal[] {
  if (!prev || prev.stats.gamesPlayed === 0) return [
    { id: 'pts:10', text: 'Average 10+ points' },
    { id: 'gp:60', text: 'Play 60+ games' },
    { id: 'award:rookie', text: 'Make an All-Rookie team' },
  ];
  const s = prev.stats, g = s.gamesPlayed;
  const ppg = pg(s.points, g), rpg = pg(s.oreb + s.dreb, g), apg = pg(s.ast, g);
  const goals: Goal[] = [{ id: `pts:${Math.max(10, Math.floor(ppg) + 2)}`, text: `Average ${Math.max(10, Math.floor(ppg) + 2)}+ points` }];
  if (rpg >= apg) { const t = Math.max(4, Math.floor(rpg) + 1); goals.push({ id: `reb:${t}`, text: `Average ${t}+ rebounds` }); }
  else { const t = Math.max(3, Math.floor(apg) + 1); goals.push({ id: `ast:${t}`, text: `Average ${t}+ assists` }); }
  const keys = prev.awards.map(a => a.key as string);
  if (keys.includes('mvp')) goals.push({ id: 'award:champion', text: 'Win the title' });
  else if (keys.some(k => ALL_NBA.includes(k))) goals.push({ id: 'award:mvp', text: 'Win MVP' });
  else if (keys.includes('allStar')) goals.push({ id: 'award:allnba', text: 'Make an All-NBA team' });
  else if (ppg >= 15) goals.push({ id: 'award:allStar', text: 'Make the All-Star team' });
  else goals.push({ id: 'gp:70', text: 'Play 70+ games' });
  return goals;
}

export function gradeGoals(goals: Goal[], year: CareerYear): GoalResult[] {
  const s = year.stats, g = s.gamesPlayed, keys = year.awards.map(a => a.key as string);
  return goals.map(goal => {
    const [kind, arg] = goal.id.split(':');
    const n = Number(arg);
    if (kind === 'pts') { const v = pg(s.points, g); return { ...goal, hit: v >= n, got: `${v.toFixed(1)} PPG` }; }
    if (kind === 'reb') { const v = pg(s.oreb + s.dreb, g); return { ...goal, hit: v >= n, got: `${v.toFixed(1)} RPG` }; }
    if (kind === 'ast') { const v = pg(s.ast, g); return { ...goal, hit: v >= n, got: `${v.toFixed(1)} APG` }; }
    if (kind === 'gp') return { ...goal, hit: g >= n, got: `${g} games` };
    const hit = arg === 'rookie' ? keys.some(k => k.startsWith('allRookie')) : arg === 'allnba' ? keys.some(k => ALL_NBA.includes(k)) : keys.includes(arg);
    return { ...goal, hit, got: hit ? 'Done' : 'Missed' };
  });
}

/** Every finished season's goals, graded: how many he hit over his career. */
export function goalRecord(years: CareerYear[]): { hit: number; total: number } {
  let hit = 0, total = 0;
  years.forEach((y, i) => { for (const r of gradeGoals(seasonGoals(years[i - 1]), y)) { total++; if (r.hit) hit++; } });
  return { hit, total };
}

// ---------------------------------------------------------------- league ranks

export interface LeagueRank { stat: 'PTS' | 'REB' | 'AST' | 'STL' | 'BLK'; rank: number; value: number }
const RANKED: [LeagueRank['stat'], (s: SeasonStatTotals) => number][] = [
  ['PTS', s => s.points], ['REB', s => s.oreb + s.dreb], ['AST', s => s.ast], ['STL', s => s.stl], ['BLK', s => s.blk],
];

/** His per-game rank in each stat for `season`, among players who played at least half as many games as the most. */
export function leagueRanks(league: League, extras: GMLeagueExtras, playerId: string, season: string): LeagueRank[] {
  const everyone: PlayerSeason[] = [...league.teams.flatMap(t => t.seasons), ...extras.freeAgents];
  const rows = everyone.map(p => ({ id: p.playerId, s: p.careerHistory?.findLast(r => r.season === season)?.stats })).filter((r): r is { id: string; s: SeasonStatTotals } => !!r.s && r.s.gamesPlayed > 0);
  const me = rows.find(r => r.id === playerId);
  if (!me) return [];
  const minGames = Math.max(...rows.map(r => r.s.gamesPlayed)) / 2;
  const qualified = rows.filter(r => r.s.gamesPlayed >= minGames || r.id === playerId);
  return RANKED.map(([stat, get]) => {
    const v = get(me.s) / me.s.gamesPlayed;
    return { stat, value: v, rank: 1 + qualified.filter(r => r.id !== playerId && get(r.s) / r.s.gamesPlayed > v).length };
  });
}

// ---------------------------------------------------------------- career highs

export interface CareerHighs { points: number; rebounds: number; assists: number; steals: number; blocks: number; doubleDoubles: number; tripleDoubles: number }
export function careerHighs(years: CareerYear[]): CareerHighs {
  const out: CareerHighs = { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, doubleDoubles: 0, tripleDoubles: 0 };
  for (const y of years) {
    const m = y.highs;
    if (!m) continue;
    out.points = Math.max(out.points, m.gameHighPoints); out.rebounds = Math.max(out.rebounds, m.gameHighRebounds); out.assists = Math.max(out.assists, m.gameHighAssists);
    out.steals = Math.max(out.steals, m.gameHighSteals); out.blocks = Math.max(out.blocks, m.gameHighBlocks);
    out.doubleDoubles += m.doubleDoubles; out.tripleDoubles += m.tripleDoubles;
  }
  return out;
}

// ---------------------------------------------------------------- all-time ranks

type Total = { pts: number; trb: number; ast: number };
const totalsCache = new WeakMap<NbaHistory, Map<number, Total>>();
/** Regular-season career totals of every BAA/NBA player (one row per season: the whole season for a traded player). */
function historyTotals(h: NbaHistory): Map<number, Total> {
  const hit = totalsCache.get(h);
  if (hit) return hit;
  const bySeason = new Map<string, NbaHistory['seasons'][number]>();
  for (const r of h.seasons) {
    if (r.league === 'ABA') continue;
    const k = `${r.player}:${r.season}`, cur = bySeason.get(k);
    if (!cur || r.isAggregate) bySeason.set(k, r);
    else if (!cur.isAggregate) bySeason.set(k, { ...cur, stats: { ...cur.stats, pts: (cur.stats.pts ?? 0) + (r.stats.pts ?? 0), trb: (cur.stats.trb ?? 0) + (r.stats.trb ?? 0), ast: (cur.stats.ast ?? 0) + (r.stats.ast ?? 0) } });
  }
  const out = new Map<number, Total>();
  for (const r of bySeason.values()) {
    const t = out.get(r.player) ?? { pts: 0, trb: 0, ast: 0 };
    t.pts += r.stats.pts ?? 0; t.trb += r.stats.trb ?? 0; t.ast += r.stats.ast ?? 0;
    out.set(r.player, t);
  }
  totalsCache.set(h, out);
  return out;
}

export interface AllTimeRank { stat: 'Points' | 'Rebounds' | 'Assists'; total: number; rank: number; next: { name: string; total: number } | null }
export function allTimeRanks(h: NbaHistory, years: CareerYear[]): AllTimeRank[] {
  const totals = historyTotals(h);
  const mine: Total = years.reduce((t, y) => ({ pts: t.pts + y.stats.points, trb: t.trb + y.stats.oreb + y.stats.dreb, ast: t.ast + y.stats.ast }), { pts: 0, trb: 0, ast: 0 });
  const names = new Map(h.players.map(p => [p.idx, p.displayName]));
  return ([['Points', 'pts'], ['Rebounds', 'trb'], ['Assists', 'ast']] as const).map(([stat, k]) => {
    let rank = 1, next: { name: string; total: number } | null = null;
    for (const [idx, t] of totals) {
      if (t[k] <= mine[k]) continue;
      rank++;
      if (!next || t[k] < next.total) next = { name: names.get(idx) ?? 'a legend', total: t[k] };
    }
    return { stat, total: mine[k], rank, next };
  });
}

// ---------------------------------------------------------------- the draft-class rival

export interface RivalLine { name: string; pick: number | null; teamName: string; ovr: number; seasons: number; g: number; pts: number; reb: number; ast: number }
export interface DraftRival { rival: RivalLine; you: RivalLine; draftYear: string }

function lineOf(p: PlayerSeason, teamName: string): RivalLine {
  const rows = p.careerHistory ?? [];
  const sum = rows.reduce((t, r) => ({ g: t.g + r.stats.gamesPlayed, pts: t.pts + r.stats.points, reb: t.reb + r.stats.oreb + r.stats.dreb, ast: t.ast + r.stats.ast }), { g: 0, pts: 0, reb: 0, ast: 0 });
  return { name: p.playerId, pick: p.draftPick ?? null, teamName, ovr: Math.round(p.overall.overall ?? 0), seasons: rows.length, ...sum };
}

/**
 * Your draft class's measuring stick: the #1 pick (or the #2 when you went first). Compared on career totals
 * (finished seasons only), so it is fair at any point of the year.
 */
export function draftRival(league: League, extras: GMLeagueExtras, playerId: string): DraftRival | null {
  const all: { p: PlayerSeason; team: string }[] = [
    ...league.teams.flatMap(t => t.seasons.map(p => ({ p, team: t.name }))),
    ...extras.freeAgents.map(p => ({ p, team: 'Free agent' })),
  ];
  const me = all.find(x => x.p.playerId === playerId);
  if (!me || !me.p.draftYear) return null;
  const classmates = all.filter(x => x.p.playerId !== playerId && x.p.draftYear === me.p.draftYear && x.p.draftPick != null).sort((a, b) => (a.p.draftPick ?? 99) - (b.p.draftPick ?? 99));
  const rival = classmates[0];
  if (!rival) return null;
  return { rival: lineOf(rival.p, rival.team), you: lineOf(me.p, me.team), draftYear: me.p.draftYear };
}
