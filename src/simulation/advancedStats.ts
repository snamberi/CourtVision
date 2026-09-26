import type { GameResult, PlayerStatLine, TeamBoxScore } from './boxscore';
import type { League } from './league';
import type { PlayerSeason, SeasonStatTotals, SeasonStint } from './types';
import { seasonStintsFor } from './stints';

/* Basketball-Reference style advanced stats, computed from real box scores.
 * Team context (possessions, pace, opponent stats) comes from the season's regular-season games. */

export interface TeamTotals {
  games: number; wins: number; losses: number; min: number; pts: number;
  fgm: number; fga: number; tpm: number; tpa: number; ftm: number; fta: number;
  oreb: number; dreb: number; ast: number; stl: number; blk: number; tov: number; pf: number;
}
export interface TeamSeasonContext extends TeamTotals {
  teamId: string; opp: TeamTotals; poss: number; pace: number; ortg: number; drtg: number; net: number;
}
export interface SeasonContext {
  teams: Map<string, TeamSeasonContext>;
  league: TeamTotals; lgPoss: number; lgPace: number; lgPPP: number; lgPPG: number;
}
export interface PlayerAdvanced {
  per: number; tsPct: number; efgPct: number; tpar: number; ftr: number;
  orbPct: number; drbPct: number; trbPct: number; astPct: number; stlPct: number; blkPct: number; tovPct: number; usgPct: number;
  ortg: number; drtg: number; ows: number; dws: number; ws: number; ws48: number;
}

const emptyTotals = (): TeamTotals => ({ games: 0, wins: 0, losses: 0, min: 0, pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0 });
function boxTotals(box: TeamBoxScore): Omit<TeamTotals, 'games' | 'wins' | 'losses'> {
  const t = { min: 0, pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0 };
  if (!box?.players) return t; // results without a box score (stripped or synthetic) add nothing
  for (const l of Object.values(box.players) as PlayerStatLine[]) {
    t.min += l.minutes; t.pts += l.points; t.fgm += l.fgm; t.fga += l.fga; t.tpm += l.tpm; t.tpa += l.tpa; t.ftm += l.ftm; t.fta += l.fta;
    t.oreb += l.oreb; t.dreb += l.dreb; t.ast += l.ast; t.stl += l.stl; t.blk += l.blk; t.tov += l.tov; t.pf += l.pf;
  }
  return t;
}
function add(into: TeamTotals, t: Omit<TeamTotals, 'games' | 'wins' | 'losses'>) { for (const k of Object.keys(t) as (keyof typeof t)[]) into[k] += t[k]; }
/** Possessions for one side, the standard NBA estimate. An offensive rebound continues the same possession, so it
 * is subtracted (the second-chance shot is already in FGA). */
function possessions(t: TeamTotals): number {
  return Math.max(1, t.fga + 0.44 * t.fta + t.tov - t.oreb);
}

export function buildSeasonContext(results: GameResult[]): SeasonContext {
  const teams = new Map<string, { own: TeamTotals; opp: TeamTotals }>();
  const league = emptyTotals();
  const side = (id: string) => { let s = teams.get(id); if (!s) { s = { own: emptyTotals(), opp: emptyTotals() }; teams.set(id, s); } return s; };
  for (const r of results) {
    const h = boxTotals(r.homeBox), a = boxTotals(r.awayBox), H = side(r.homeTeamId), A = side(r.awayTeamId);
    add(H.own, h); add(H.opp, a); add(A.own, a); add(A.opp, h); add(league, h); add(league, a);
    H.own.games++; A.own.games++; H.opp.games++; A.opp.games++; league.games += 2;
    if (r.homeScore > r.awayScore) { H.own.wins++; A.own.losses++; } else { A.own.wins++; H.own.losses++; }
  }
  const out = new Map<string, TeamSeasonContext>();
  let lgPoss = 0;
  for (const [teamId, { own, opp }] of teams) {
    const poss = Math.max(1, 0.5 * (possessions(own) + possessions(opp)));
    lgPoss += poss;
    const pace = own.min > 0 ? 48 * poss / (own.min / 5) : 0;
    out.set(teamId, { ...own, teamId, opp, poss, pace, ortg: 100 * own.pts / poss, drtg: 100 * opp.pts / poss, net: 100 * (own.pts - opp.pts) / poss });
  }
  return { teams: out, league, lgPoss, lgPace: league.min > 0 ? 48 * lgPoss / (league.min / 5) : 0, lgPPP: lgPoss > 0 ? league.pts / lgPoss : 1, lgPPG: league.games > 0 ? league.pts / league.games : 100 };
}
export function regularSeasonContext(league: League): SeasonContext {
  return buildSeasonContext(league.schedule.filter(g => g.played && g.result).map(g => g.result!));
}

/** Hollinger's unadjusted PER before pace and league normalization. */
function unadjustedPer(p: SeasonStatTotals, tm: TeamSeasonContext, ctx: SeasonContext): number {
  const lg = ctx.league;
  if (p.minutes <= 0 || lg.fgm <= 0 || lg.ftm <= 0 || lg.pf <= 0) return 0;
  const factor = 2 / 3 - (0.5 * (lg.ast / lg.fgm)) / (2 * (lg.fgm / lg.ftm));
  const vop = lg.pts / Math.max(1, lg.fga - lg.oreb + lg.tov + 0.44 * lg.fta);
  const drbPct = (lg.dreb) / Math.max(1, lg.oreb + lg.dreb);
  const tmAstFg = tm.fgm > 0 ? tm.ast / tm.fgm : 0;
  const trb = p.oreb + p.dreb;
  return (1 / p.minutes) * (
    p.tpm + (2 / 3) * p.ast + (2 - factor * tmAstFg) * p.fgm
    + p.ftm * 0.5 * (1 + (1 - tmAstFg) + (2 / 3) * tmAstFg)
    - vop * p.tov - vop * drbPct * (p.fga - p.fgm) - vop * 0.44 * (0.44 + 0.56 * drbPct) * (p.fta - p.ftm)
    + vop * (1 - drbPct) * (trb - p.oreb) + vop * drbPct * p.oreb + vop * p.stl + vop * drbPct * p.blk
    - p.pf * ((lg.ftm / lg.pf) - 0.44 * (lg.fta / lg.pf) * vop));
}

/** Advanced numbers for every player in `lines` (player totals + the team they played for). */
export function computeAdvancedFor(lines: { playerId: string; teamId: string | null; totals: SeasonStatTotals; key?: string }[], ctx: SeasonContext): Map<string, PlayerAdvanced> {
  const out = new Map<string, PlayerAdvanced>();
  const lgPace = ctx.lgPace || 100;
  // League PER scale: minutes-weighted average adjusted PER is 15 by definition.
  let aSum = 0, mSum = 0;
  const aPer = new Map<string, number>();
  for (const l of lines) {
    const tm = l.teamId ? ctx.teams.get(l.teamId) : undefined;
    if (!tm || l.totals.minutes <= 0) continue;
    const a = (tm.pace > 0 ? lgPace / tm.pace : 1) * unadjustedPer(l.totals, tm, ctx);
    aPer.set(l.key ?? l.playerId, a); aSum += a * l.totals.minutes; mSum += l.totals.minutes;
  }
  const lgAPer = mSum > 0 ? aSum / mSum : 1;
  // Win Shares: points above a 0.92×league baseline on offense and below 1.08×league on defense, per marginal point per win.
  const marginalPtsPerWin = (tm: TeamSeasonContext) => 0.32 * ctx.lgPPG * (tm.pace > 0 && lgPace > 0 ? tm.pace / lgPace : 1);
  // Individual stops relative to the league shift a player's defensive rating off his team's.
  let stopSum = 0, stopMin = 0;
  for (const l of lines) { const t = l.totals; if (t.minutes > 0) { stopSum += t.stl + 0.7 * t.blk + 0.3 * t.dreb; stopMin += t.minutes; } }
  const lgStopsPer48 = stopMin > 0 ? 48 * stopSum / stopMin : 0;
  for (const l of lines) {
    const t = l.totals, tm = l.teamId ? ctx.teams.get(l.teamId) : undefined;
    if (!tm || t.minutes <= 0) continue;
    const share = t.minutes / Math.max(1, tm.min / 5); // fraction of team minutes (one of five spots)
    const trb = t.oreb + t.dreb;
    const plays = t.fga + 0.44 * t.fta + t.tov;
    const oppPoss = tm.poss;
    // Assisted baskets are shared: the passer earns part of the points, the scorer gives up the same part,
    // so a team's points produced add up to its actual points.
    const assistedShare = tm.fgm > 0 ? tm.ast / tm.fgm : 0;
    const pprod = t.points + 0.77 * (t.ast - t.fgm * assistedShare);
    const uposs = plays;
    const ortg = uposs > 0 ? 100 * pprod / uposs : 0;
    const stopsPer48 = 48 * (t.stl + 0.7 * t.blk + 0.3 * t.dreb) / t.minutes;
    const drtg = tm.drtg - Math.max(-8, Math.min(8, (stopsPer48 - lgStopsPer48) * 0.9));
    const mppw = marginalPtsPerWin(tm);
    const ows = mppw > 0 ? (pprod - 0.92 * ctx.lgPPP * uposs) / mppw : 0;
    const dws = mppw > 0 ? (t.minutes / Math.max(1, tm.min)) * oppPoss * (1.08 * ctx.lgPPP - drtg / 100) / mppw : 0;
    const ws = ows + dws;
    out.set(l.key ?? l.playerId, {
      per: lgAPer > 0 ? (aPer.get(l.key ?? l.playerId) ?? 0) * 15 / lgAPer : 0,
      tsPct: t.fga + 0.44 * t.fta > 0 ? t.points / (2 * (t.fga + 0.44 * t.fta)) : 0,
      efgPct: t.fga > 0 ? (t.fgm + 0.5 * t.tpm) / t.fga : 0,
      tpar: t.fga > 0 ? t.tpa / t.fga : 0,
      ftr: t.fga > 0 ? t.fta / t.fga : 0,
      orbPct: share > 0 ? 100 * t.oreb / (share * (tm.oreb + tm.opp.dreb)) : 0,
      drbPct: share > 0 ? 100 * t.dreb / (share * (tm.dreb + tm.opp.oreb)) : 0,
      trbPct: share > 0 ? 100 * trb / (share * (tm.oreb + tm.dreb + tm.opp.oreb + tm.opp.dreb)) : 0,
      astPct: 100 * t.ast / Math.max(1, share * tm.fgm - t.fgm),
      stlPct: share > 0 ? 100 * t.stl / Math.max(1, share * oppPoss) : 0,
      blkPct: share > 0 ? 100 * t.blk / Math.max(1, share * (tm.opp.fga - tm.opp.tpa)) : 0,
      tovPct: plays > 0 ? 100 * t.tov / plays : 0,
      usgPct: share > 0 ? 100 * plays / (share * Math.max(1, tm.fga + 0.44 * tm.fta + tm.tov)) : 0,
      ortg, drtg, ows, dws, ws, ws48: t.minutes > 0 ? ws * 48 / t.minutes : 0,
    });
  }
  return out;
}

/** Current-season advanced stats for every rostered player (regular season only), plus any `extraPlayers`
 * (free agents who played earlier in the season). A player who changed teams is rated per stint against each
 * team's context, then combined (see seasonAdvancedWithStints). */
export function currentSeasonAdvanced(league: League, ctx = regularSeasonContext(league), extraPlayers: PlayerSeason[] = []): Map<string, PlayerAdvanced> {
  return seasonAdvancedWithStints(league, ctx, extraPlayers).combined;
}

/** Combines per-team advanced lines into one season line: Win Shares add up, rates are minute-weighted and
 * shooting percentages come from the combined totals. */
export function combineAdvanced(parts: { adv: PlayerAdvanced; minutes: number }[], total: SeasonStatTotals): PlayerAdvanced {
  if (parts.length === 1) return parts[0].adv;
  const min = parts.reduce((n, p) => n + p.minutes, 0) || 1;
  const w = (k: keyof PlayerAdvanced) => parts.reduce((n, p) => n + p.adv[k] * p.minutes, 0) / min;
  const sum = (k: keyof PlayerAdvanced) => parts.reduce((n, p) => n + p.adv[k], 0);
  const t = total, ws = sum('ws');
  return {
    per: w('per'), tsPct: t.fga + 0.44 * t.fta > 0 ? t.points / (2 * (t.fga + 0.44 * t.fta)) : 0, efgPct: t.fga > 0 ? (t.fgm + 0.5 * t.tpm) / t.fga : 0,
    tpar: t.fga > 0 ? t.tpa / t.fga : 0, ftr: t.fga > 0 ? t.fta / t.fga : 0,
    orbPct: w('orbPct'), drbPct: w('drbPct'), trbPct: w('trbPct'), astPct: w('astPct'), stlPct: w('stlPct'), blkPct: w('blkPct'), tovPct: w('tovPct'), usgPct: w('usgPct'),
    ortg: w('ortg'), drtg: w('drtg'), ows: sum('ows'), dws: sum('dws'), ws, ws48: t.minutes > 0 ? ws * 48 / t.minutes : 0,
  };
}

export function seasonAdvancedWithStints(league: League, ctx = regularSeasonContext(league), extraPlayers: PlayerSeason[] = []): { combined: Map<string, PlayerAdvanced>; stints: Map<string, SeasonStint[]> } {
  const players: { p: PlayerSeason; teamId: string | null }[] = [
    ...league.teams.flatMap(t => t.seasons.map(p => ({ p, teamId: t.teamId as string | null }))),
    ...extraPlayers.map(p => ({ p, teamId: null })),
  ];
  const lines: { playerId: string; teamId: string | null; totals: SeasonStatTotals; key: string }[] = [];
  const rowsByPlayer = new Map<string, SeasonStint[]>();
  for (const { p, teamId } of players) {
    // A free agent waived before stints existed has no record of them: credit his last team from his history.
    const fallbackTeam = teamId ?? [...(p.history ?? [])].reverse().find(e => e.teamId)?.teamId ?? '';
    const rows = p.seasonStints?.length ? seasonStintsFor(p, teamId) : [{ teamId: fallbackTeam, stats: p.seasonStats ?? emptyLine() }];
    rowsByPlayer.set(p.playerId, rows);
    rows.forEach((r, i) => lines.push({ playerId: p.playerId, teamId: r.teamId || null, totals: r.stats, key: `${p.playerId}\u0000${i}` }));
  }
  const byKey = computeAdvancedFor(lines, ctx);
  const combined = new Map<string, PlayerAdvanced>(), stints = new Map<string, SeasonStint[]>();
  for (const { p } of players) {
    const rows = rowsByPlayer.get(p.playerId) ?? [];
    const parts = rows.map((r, i) => ({ row: r, adv: byKey.get(`${p.playerId}\u0000${i}`) })).filter((x): x is { row: SeasonStint; adv: PlayerAdvanced } => !!x.adv);
    if (!parts.length) continue;
    combined.set(p.playerId, combineAdvanced(parts.map(x => ({ adv: x.adv, minutes: x.row.stats.minutes })), p.seasonStats ?? emptyLine()));
    if (rows.length > 1) stints.set(p.playerId, parts.map(x => ({ ...x.row, advanced: x.adv })));
  }
  return { combined, stints };
}
function emptyLine(): SeasonStatTotals {
  return { gamesPlayed: 0, minutes: 0, points: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, ba: 0, blkAtt: 0, clutchPoints: 0 };
}
