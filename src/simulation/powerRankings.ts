import type { League, LeagueTeam } from './league';
import { computeStandings } from './league';
import { calculateOverall } from './engine/overall';
import type { PlayerSeason } from './types';

export interface PowerRankingEntry {
  teamId: string;
  teamName: string;
  rank: number;
  previousRank: number | null;
  winPct: number;
  pointDiff: number;
  blurb: string;
}

/** Ranks every team by a blend of win% and point differential (point differential is the standard proxy
 * for "true" team strength, since it catches teams over/under-performing their record), with a plain
 * templated blurb based on where the team sits. `previousRoundsBack` lets the caller diff against an
 * earlier snapshot of the season to show movement — 0 means no comparison. */
export function computePowerRankings(league: League, previousRoundsBack = 0): PowerRankingEntry[] {
  const teamNameById = new Map(league.teams.map((t) => [t.teamId, t.name]));
  const standings = computeStandings(league);
  const maxDiff = Math.max(1, ...standings.map((r) => Math.abs(r.pointDiff)));

  const scored = standings.map((r) => ({
    ...r,
    score: r.winPct * 0.65 + (r.pointDiff / maxDiff) * 0.35,
  })).sort((a, b) => b.score - a.score);

  let previousRankById: Map<string, number> | null = null;
  if (previousRoundsBack > 0) {
    const maxRound = Math.max(0, ...league.schedule.map((g) => g.round));
    const cutoffRound = Math.max(0, maxRound - previousRoundsBack);
    const trimmedSchedule = league.schedule.map((g) => (g.round > cutoffRound ? { ...g, played: false, result: undefined } : g));
    const earlier = computeStandings({ ...league, schedule: trimmedSchedule })
      .map((r) => ({ ...r, score: r.winPct * 0.65 + (r.pointDiff / maxDiff) * 0.35 }))
      .sort((a, b) => b.score - a.score);
    previousRankById = new Map(earlier.map((r, i) => [r.teamId, i + 1]));
  }

  return scored.map((r, i) => {
    const rank = i + 1;
    const games = r.wins + r.losses;
    const blurb = powerRankingBlurb(rank, scored.length, pointDiff(r), games);
    return {
      teamId: r.teamId,
      teamName: teamNameById.get(r.teamId) ?? r.teamId,
      rank,
      previousRank: previousRankById?.get(r.teamId) ?? null,
      winPct: r.winPct,
      pointDiff: r.pointDiff,
      blurb,
    };
  });
}

function pointDiff(r: { pointDiff: number }): number {
  return r.pointDiff;
}

function powerRankingBlurb(rank: number, total: number, diff: number, games: number): string {
  if (games === 0) return 'No games played yet — too early to say much of anything.';
  const tier = rank <= Math.ceil(total * 0.15) ? 'elite'
    : rank <= Math.ceil(total * 0.4) ? 'good'
    : rank <= Math.ceil(total * 0.7) ? 'middling'
    : 'struggling';
  const diffFlavor = diff > 8 ? 'a dominant scoring margin'
    : diff > 2 ? 'a healthy scoring margin'
    : diff > -2 ? 'a razor-thin scoring margin'
    : diff > -8 ? 'a concerning scoring margin'
    : 'a brutal scoring margin';
  switch (tier) {
    case 'elite': return `Playing like a true title contender, backed by ${diffFlavor}.`;
    case 'good': return `A solid playoff-caliber team with ${diffFlavor}.`;
    case 'middling': return `Stuck in the middle of the pack, with ${diffFlavor} to show for it.`;
    default: return `In rebuild mode, weighed down by ${diffFlavor}.`;
  }
}

// ---------------------------------------------------------------------------
// Full ratings-table view (BBGM-style): team rating + per-category rank across the whole league.
// ---------------------------------------------------------------------------

export const RATING_RANK_CATEGORIES = [
  { key: 'hgt', label: 'Hgt' }, { key: 'str', label: 'Str' }, { key: 'spd', label: 'Spd' }, { key: 'jmp', label: 'Jmp' },
  { key: 'end', label: 'End' }, { key: 'dnk', label: 'Dnk' }, { key: 'ft', label: 'FT' }, { key: 'tpt', label: '3PT' },
  { key: 'oiq', label: 'oIQ' }, { key: 'diq', label: 'dIQ' }, { key: 'drb', label: 'Drb' }, { key: 'pss', label: 'Pss' },
  { key: 'reb', label: 'Reb' },
] as const;
export type RatingCategoryKey = typeof RATING_RANK_CATEGORIES[number]['key'];

function categoryValue(season: PlayerSeason, key: RatingCategoryKey): number {
  const a = season.attributes;
  switch (key) {
    case 'hgt': return a.physical.heightInches;
    case 'str': return a.physical.strength;
    case 'spd': return a.physical.speed;
    case 'jmp': return a.physical.vertical;
    case 'end': return a.physical.stamina;
    case 'dnk': return a.offense.drivingDunk;
    case 'ft': return a.offense.freeThrow;
    case 'tpt': return a.offense.aboveBreak3;
    case 'oiq': return a.offense.offensiveIQ;
    case 'diq': return a.defense.defensiveIQ;
    case 'drb': return a.offense.ballHandling;
    case 'pss': return a.offense.passing;
    case 'reb': return (a.offense.offensiveRebounding + a.defense.defensiveRebounding) / 2;
  }
}

function teamAverage(team: LeagueTeam, f: (s: PlayerSeason) => number): number {
  if (team.seasons.length === 0) return 0;
  return team.seasons.reduce((sum, s) => sum + f(s), 0) / team.seasons.length;
}

export interface RatingsTableRow {
  teamId: string;
  teamName: string;
  conferenceId?: string;
  divisionId?: string;
  rating: number; // team-wide average Overall — reflects player ratings only, not record
  wins: number;
  losses: number;
  last10: string; // "W-L"
  mov: number; // margin of victory, i.e. average point differential per game
  avgAge: number;
  ranks: Record<RatingCategoryKey, number>; // 1 = best in the league at that category
}

/** The full BBGM-style ratings table: one row per team with its overall rating, record snapshot, and a
 * rank (1 = best in the league) in each of 13 skill/physical categories, averaged across the roster. */
export function computeRatingsTable(league: League): RatingsTableRow[] {
  const standings = computeStandings(league);
  const standingsById = new Map(standings.map((r) => [r.teamId, r]));

  const categoryAverages = new Map<string, Record<RatingCategoryKey, number>>();
  for (const t of league.teams) {
    const row = {} as Record<RatingCategoryKey, number>;
    for (const cat of RATING_RANK_CATEGORIES) row[cat.key] = teamAverage(t, (s) => categoryValue(s, cat.key));
    categoryAverages.set(t.teamId, row);
  }

  const ranks = new Map<string, Record<RatingCategoryKey, number>>(league.teams.map((t) => [t.teamId, {} as Record<RatingCategoryKey, number>]));
  for (const cat of RATING_RANK_CATEGORIES) {
    const sorted = [...league.teams].sort((a, b) => categoryAverages.get(b.teamId)![cat.key] - categoryAverages.get(a.teamId)![cat.key]);
    sorted.forEach((t, i) => { ranks.get(t.teamId)![cat.key] = i + 1; });
  }

  return league.teams.map((t) => {
    const standing = standingsById.get(t.teamId);
    const last10Games = league.schedule
      .filter((g) => g.played && (g.homeTeamId === t.teamId || g.awayTeamId === t.teamId))
      .slice(-10);
    const last10Wins = last10Games.filter((g) => {
      const won = g.homeTeamId === t.teamId ? g.result!.homeScore > g.result!.awayScore : g.result!.awayScore > g.result!.homeScore;
      return won;
    }).length;

    return {
      teamId: t.teamId,
      teamName: t.name,
      conferenceId: t.conferenceId,
      divisionId: t.divisionId,
      rating: Math.round(teamAverage(t, (s) => calculateOverall(s))),
      wins: standing?.wins ?? 0,
      losses: standing?.losses ?? 0,
      last10: `${last10Wins}-${last10Games.length - last10Wins}`,
      mov: standing?.pointDiff ? standing.pointDiff / Math.max(1, standing.wins + standing.losses) : 0,
      avgAge: teamAverage(t, (s) => s.age),
      ranks: ranks.get(t.teamId)!,
    };
  }).sort((a, b) => b.rating - a.rating);
}
