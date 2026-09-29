import type { League } from './league';
import { withLegacySons } from './family';
import { computeStandings, defaultCoachTendencies } from './league';
import type { DraftProspect, GMLeagueExtras, SalaryCapSettings } from './gm';
import { currentDraftOrder, generateDraftClass, pickDraftClassSize, rookieContract } from './gm';
import type { PlayerSeason } from './types';
import type { TeamBoxScore } from './boxscore';
import { simulateGame } from './engine/game';
import { RNG } from './engine/rng';
import { calculateOverall } from './engine/overall';
import { primaryPosition } from './teamStatus';
import { weakestPositions } from './aiGM';
import { previousSeasonsPlayed } from './rookieEligibility';
import { collectPlayerIds } from './playerIds';
import { nextSeasonLabel } from './seasonTransition';

/* Draft Season: the next draft class is on the board from opening night, a mock draft tracks it all year,
 * rookie contracts follow a published pay scale by slot, and a Summer League after the draft puts the
 * rookies and young players on the floor. */

function hash(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return h >>> 0;
}

// ---- The upcoming class, all season ----

/** The label prospects in the class drafted after this season carry. */
export const upcomingDraftLabel = (league: League) => nextSeasonLabel(league.season);

/** Generates next summer's draft class once the regular season is under way, so it can be scouted all year.
 * Historical leagues draft real classes (picked at the draft), and a class already on the board is kept. */
export function ensureUpcomingDraftClass(league: League, extras: GMLeagueExtras): GMLeagueExtras {
  if (league.historical || extras.draftDayOpen || extras.draftClass.length > 0 || !league.teams.length) return extras;
  if ((league.seasonPhase ?? 'regular_season') !== 'regular_season') return extras;
  const label = upcomingDraftLabel(league);
  const rng = new RNG(hash(`draftclass:${label}`));
  const draftClass = withLegacySons(generateDraftClass(pickDraftClassSize(league.teams.length, rng), hash(`draftclass-seed:${label}`), label, collectPlayerIds(league, extras)), league, hash(`legacy:${label}`));
  return { ...extras, draftClass, draftWorkouts: {} };
}

/** 0 before opening night, 1 once the regular season is over. */
export function seasonProgress(league: League): number {
  const phase = league.seasonPhase ?? 'regular_season';
  if (phase !== 'regular_season') return phase === 'preseason' ? 0 : 1;
  const total = league.schedule.length;
  return total ? league.schedule.filter(g => g.played).length / total : 0;
}

// ---- Rookie scale ----

export interface ScaleRow { pick: number; round: 1 | 2; salary: number; years: number; teamOption: boolean }
/** First-round length follows League Rules (default 4 years); second-rounders sign two-year minimum-level deals. */
export function rookieScale(league: League, cap: SalaryCapSettings): ScaleRow[] {
  const n = Math.max(1, league.teams.length);
  return Array.from({ length: n * 2 }, (_, pick) => {
    const c = rookieContract(pick, n, cap, league.rulesSettings?.rookieContractLengthYears);
    const round = pick < n ? 1 : 2;
    return { pick: pick + 1, round, salary: c.annualSalary, years: c.yearsRemaining, teamOption: c.teamOption };
  });
}

// ---- Mock draft ----

export interface MockPick { pick: number; teamId: string; prospectId: string; position: string; school: string; note: string; salary: number }

/** The draft order a mock would use: the real order once set, otherwise reverse standings (no lottery luck). */
export function projectedOrder(league: League, extras: GMLeagueExtras): string[] {
  if (league.seasonPhase === 'draft' && extras.draftOrder?.length) return currentDraftOrder(league, extras);
  const rows = computeStandings(league).sort((a, b) => a.winPct - b.winPct || a.pointDiff - b.pointDiff || a.teamId.localeCompare(b.teamId));
  const round = rows.map(r => r.teamId);
  return [...round, ...round];
}

/** A consensus mock: public scouting (not any one team's private read) plus each team's thinnest position.
 * Real teams draft from their own reads, so the real draft will surprise it. */
export function mockDraft(league: League, extras: GMLeagueExtras): MockPick[] {
  const order = projectedOrder(league, extras);
  const start = league.seasonPhase === 'draft' ? extras.draftPickIndex : 0;
  const scale = rookieScale(league, extras.capSettings);
  const pool = [...extras.draftClass];
  const teams = new Map(league.teams.map(t => [t.teamId, t]));
  const out: MockPick[] = [];
  for (let slot = start; slot < order.length && pool.length; slot++) {
    const team = teams.get(order[slot]);
    const need = team ? weakestPositions(team) : [];
    const value = (p: DraftProspect) => p.scoutedPotential * 0.65 + calculateOverall(p.trueSeason) * 0.35 + (need.includes(primaryPosition(p.trueSeason)) ? 2.5 : 0);
    pool.sort((a, b) => value(b) - value(a) || a.playerId.localeCompare(b.playerId));
    const p = pool.shift()!;
    const pos = primaryPosition(p.trueSeason);
    out.push({ pick: slot + 1, teamId: order[slot], prospectId: p.playerId, position: pos, school: p.trueSeason.college ?? p.trueSeason.nationality ?? '—',
      note: need.includes(pos) ? `Fills a need at ${pos}` : calculateOverall(p.trueSeason) >= 58 ? 'Ready to contribute' : p.scoutedPotential - calculateOverall(p.trueSeason) >= 18 ? 'Long-term swing' : 'Best available',
      salary: scale[slot]?.salary ?? 0 });
  }
  return out;
}

// ---- Summer League ----

export interface SummerLine { playerId: string; teamId: string; gp: number; min: number; pts: number; reb: number; ast: number; stl: number; blk: number; fgm: number; fga: number; tpm: number; tpa: number }
export interface SummerGame { id: string; day: number; homeTeamId: string; awayTeamId: string; homeScore: number; awayScore: number; final?: boolean
  /** Box scores are kept only for your team's games, so you can watch how your rookies played. */
  homeBox?: TeamBoxScore; awayBox?: TeamBoxScore }
export interface SummerLeagueRecord {
  season: string; rosters: Record<string, string[]>; invitees: string[]; games: SummerGame[];
  lines: Record<string, SummerLine>; championTeamId: string | null; mvpId: string | null; allSummer: string[];
}

const GAMES_EACH = 4;

/** Rookies and second-year players first, then young players. Teams short of eight invite young free agents,
 * and any team still short fills out with its own end-of-bench players, so all teams take part. */
export function summerRosters(league: League, extras: GMLeagueExtras): { rosters: Record<string, PlayerSeason[]>; invitees: string[] } {
  const taken = new Set<string>();
  const rosters: Record<string, PlayerSeason[]> = {};
  const young = (p: PlayerSeason) => previousSeasonsPlayed(p) <= 2 || p.age <= 24;
  for (const t of league.teams) {
    const list = t.seasons.filter(young).sort((a, b) => previousSeasonsPlayed(a) - previousSeasonsPlayed(b) || calculateOverall(b) - calculateOverall(a)).slice(0, 10);
    list.forEach(p => taken.add(p.playerId));
    rosters[t.teamId] = list;
  }
  const pool = extras.freeAgents.filter(p => p.age <= 26 && !taken.has(p.playerId)).sort((a, b) => calculateOverall(b) - calculateOverall(a));
  const invitees: string[] = [];
  // Hand out invites one at a time to the shortest roster, so the pool is shared fairly.
  for (;;) {
    const short = league.teams.filter(t => rosters[t.teamId].length < 8).sort((a, b) => rosters[a.teamId].length - rosters[b.teamId].length)[0];
    if (!short || !pool.length) break;
    const p = pool.shift()!;
    rosters[short.teamId].push(p); invitees.push(p.playerId); taken.add(p.playerId);
  }
  for (const t of league.teams) {
    const bench = t.seasons.filter(p => !taken.has(p.playerId)).sort((a, b) => calculateOverall(a) - calculateOverall(b));
    while (rosters[t.teamId].length < 8 && bench.length) { const p = bench.shift()!; rosters[t.teamId].push(p); taken.add(p.playerId); }
  }
  return { rosters, invitees };
}

function summerPairings(teamIds: string[], seed: number): [string, string][][] {
  // Rotate a shuffled circle so every team plays GAMES_EACH different opponents (one team sits out a day when odd).
  const rng = new RNG(seed);
  const ids = [...teamIds];
  for (let i = ids.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  if (ids.length % 2) ids.push('');
  const days: [string, string][][] = [];
  const half = ids.length / 2;
  let circle = ids;
  for (let d = 0; d < GAMES_EACH && d < ids.length - 1; d++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < half; i++) { const a = circle[i], b = circle[ids.length - 1 - i]; if (a && b) pairs.push(d % 2 ? [b, a] : [a, b]); }
    days.push(pairs);
    circle = [circle[0], circle[circle.length - 1], ...circle.slice(1, -1)];
  }
  return days;
}

/** Plays the whole Summer League: GAMES_EACH games per team, then a title game between the two best records.
 * Uses the real game engine on 40-minute games; nothing here changes ratings, stats or contracts. */
export function simulateSummerLeague(league: League, extras: GMLeagueExtras, controlledTeamId: string | null, seed: number): SummerLeagueRecord {
  const { rosters, invitees } = summerRosters(league, extras);
  const teamIds = league.teams.map(t => t.teamId).filter(id => rosters[id].length >= 5);
  const coach = { ...defaultCoachTendencies(), paceTendency: 75, rotationDepth: 10, starUsage: 45, benchUsage: 70 };
  const era = { ...league.settings.era, numberOfQuarters: 4, quarterLengthMinutes: 10 };
  const minutesFor = (roster: PlayerSeason[]) => roster.map((s, i) => ({ ...s, rotationRole: i < 5 ? 'starter' as const : 'bench' as const,
    minutes: { mode: 'TARGET' as const, target: Math.round(200 / Math.max(5, roster.length) * (i < 5 ? 1.2 : 0.8)) } }));
  const lines: Record<string, SummerLine> = {};
  const record: Record<string, { w: number; l: number; diff: number }> = Object.fromEntries(teamIds.map(id => [id, { w: 0, l: 0, diff: 0 }]));
  const games: SummerGame[] = [];
  const play = (home: string, away: string, day: number, final = false) => {
    const result = simulateGame({
      home: { teamId: home, seasons: minutesFor(rosters[home]), coach, chemistry: 50 },
      away: { teamId: away, seasons: minutesFor(rosters[away]), coach, chemistry: 50 },
      settings: { ...league.settings, era, seed: seed + games.length * 7919, teamChemistryEnabled: false, injuriesEnabled: false },
      rules: league.rulesSettings,
    });
    for (const [teamId, box] of [[home, result.homeBox], [away, result.awayBox]] as const) {
      for (const s of Object.values(box.players)) {
        if (s.minutes <= 0) continue;
        const l = lines[s.playerId] ??= { playerId: s.playerId, teamId, gp: 0, min: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0 };
        l.gp++; l.min += s.minutes; l.pts += s.points; l.reb += s.oreb + s.dreb; l.ast += s.ast; l.stl += s.stl; l.blk += s.blk;
        l.fgm += s.fgm; l.fga += s.fga; l.tpm += s.tpm; l.tpa += s.tpa;
      }
    }
    const mine = !!controlledTeamId && (home === controlledTeamId || away === controlledTeamId);
    games.push({ id: `sl-${day}-${home}-${away}`, day, homeTeamId: home, awayTeamId: away, homeScore: result.homeScore, awayScore: result.awayScore,
      ...(final ? { final: true } : {}), ...(mine || final ? { homeBox: result.homeBox, awayBox: result.awayBox } : {}) });
    return result;
  };
  summerPairings(teamIds, seed).forEach((pairs, day) => pairs.forEach(([h, a]) => {
    const r = play(h, a, day + 1);
    const homeWon = r.homeScore > r.awayScore;
    record[h][homeWon ? 'w' : 'l']++; record[a][homeWon ? 'l' : 'w']++;
    record[h].diff += r.homeScore - r.awayScore; record[a].diff += r.awayScore - r.homeScore;
  }));
  const seeded = [...teamIds].sort((a, b) => record[b].w - record[a].w || record[b].diff - record[a].diff || a.localeCompare(b));
  let championTeamId: string | null = null;
  if (seeded.length >= 2) {
    const r = play(seeded[0], seeded[1], GAMES_EACH + 1, true);
    championTeamId = r.homeScore > r.awayScore ? seeded[0] : seeded[1];
  }
  const ranked = Object.values(lines).filter(l => l.gp >= 3)
    .map(l => ({ l, v: (l.pts + l.reb * 1.1 + l.ast * 1.4 + (l.stl + l.blk) * 1.8 - (l.fga - l.fgm) * 0.6) / l.gp + (l.teamId === championTeamId ? 1.5 : 0) }))
    .sort((a, b) => b.v - a.v || a.l.playerId.localeCompare(b.l.playerId));
  return {
    season: league.season ?? '', rosters: Object.fromEntries(Object.entries(rosters).map(([id, r]) => [id, r.map(p => p.playerId)])), invitees, games, lines,
    championTeamId, mvpId: ranked[0]?.l.playerId ?? null, allSummer: ranked.slice(0, 5).map(r => r.l.playerId),
  };
}

/** Summer League is played once per offseason, after the draft closes and before re-signing opens. */
export function canPlaySummerLeague(league: League, extras: GMLeagueExtras): boolean {
  return league.seasonPhase === 'draft' && !extras.draftDayOpen && league.summerLeague?.season !== league.season && league.teams.length >= 2;
}

export function summerStandings(sl: SummerLeagueRecord): { teamId: string; w: number; l: number; diff: number }[] {
  const rows: Record<string, { teamId: string; w: number; l: number; diff: number }> = {};
  for (const g of sl.games.filter(x => !x.final)) {
    for (const [id, pts, opp] of [[g.homeTeamId, g.homeScore, g.awayScore], [g.awayTeamId, g.awayScore, g.homeScore]] as const) {
      const r = rows[id] ??= { teamId: id, w: 0, l: 0, diff: 0 };
      if (pts > opp) r.w++; else r.l++;
      r.diff += pts - opp;
    }
  }
  return Object.values(rows).sort((a, b) => b.w - a.w || b.diff - a.diff || a.teamId.localeCompare(b.teamId));
}

