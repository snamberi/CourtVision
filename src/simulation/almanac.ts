import type { League, TeamSeasonSummary, PlayoffFinish } from './league';
import { computeConferenceStandings, computeStandings } from './league';
import type { PlayoffBracket } from './playoffs';
import type { GMLeagueExtras } from './gm';
import type { AwardWinner, SeasonAwards, AwardBallotKey, VotedAwardKey } from './awards';
import { seasonRows, type SeasonRow } from './records';

/* League almanac: one page per season with standings, the playoff bracket, stat leaders and the award vote.
 * Archived seasons read from franchiseHistory; the current season is built from live data. */

/** Bracket without box scores or replay logs: enough to redraw it years later. */
export function compactBracket(b: PlayoffBracket): PlayoffBracket {
  return { championTeamId: b.championTeamId, rounds: b.rounds.map(r => r.map(s => ({ ...s, games: [] }))), playIn: b.playIn?.map(g => ({ ...g, result: undefined })) };
}
export function conferenceSeeds(league: League): Record<string, number> {
  const { east, west } = computeConferenceStandings(league);
  return Object.fromEntries([...east.map((r, i) => [r.teamId, i + 1]), ...west.map((r, i) => [r.teamId, i + 1])]);
}

function hashUnit(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return ((h >>> 0) / 0xffffffff) * 2 - 1;
}

export interface VoteRow { playerId: string; teamId: string | null; teamName: string; first: number; points: number; share: number;
  /** Real NBA voting (imported history): share and first-place votes as recorded, not simulated. */
  real?: boolean;
  /** A season played before the panel's votes were saved: shares reconstructed from the final ballot. */
  estimated?: boolean;
  /** Set on the winner's row when every first-place vote went to him (a real NBA share of 1.000). */
  unanimous?: boolean }

/** The vote for one award: the panel's saved ballots, the real vote for imported seasons, or an estimate for older saves. */
export function voteRows(awards: SeasonAwards, key: VotedAwardKey | AwardBallotKey, season: string): VoteRow[] {
  const saved = awards.votes?.[key as VotedAwardKey];
  if (saved && saved.lines.length) return saved.lines.map((l, i) => ({ playerId: l.id, teamId: l.teamId, teamName: l.teamName, first: l.firstVotes, points: l.points, share: l.share,
    ...(i === 0 && saved.winners.length === 1 && saved.voters > 0 && l.firstVotes === saved.voters ? { unanimous: true } : {}) }));
  const ballot = awards.ballots?.[key as AwardBallotKey] ?? [];
  const winner = (awards as unknown as Record<string, AwardWinner | null | undefined>)[key];
  const field = ballot.length ? ballot : winner && 'playerId' in winner ? [winner] : [];
  const rows = awardVote(field, `${season}|${key}`).map(r => r.real ? r : { ...r, estimated: true });
  const top = rows[0];
  if (top && (top.real ? top.share >= 0.9995 : top.first >= 100 && rows[1]?.points !== top.points)) rows[0] = { ...top, unanimous: true };
  return rows;
}

/** True when the award's winner took every first-place vote. */
export function isUnanimous(awards: SeasonAwards, key: VotedAwardKey | AwardBallotKey, season: string, winnerId?: string): boolean {
  const top = voteRows(awards, key, season)[0];
  return !!top?.unanimous && (winnerId == null || top.playerId === winnerId);
}
/**
 * A 100-member media panel votes on a ranked ballot (10-7-5-3-1 points, like MVP voting). Each voter sees the
 * computed award scores with a little personal bias, so close races split first-place votes. Deterministic.
 */
export function awardVote(ballot: AwardWinner[], key: string, voters = 100): VoteRow[] {
  const field = ballot.slice(0, 10);
  if (!field.length) return [];
  // Imported history carries the real result: show it as recorded.
  if (field.some(w => w.voteShare != null)) return field.filter(w => w.voteShare != null)
    .map(w => ({ playerId: w.playerId, teamId: w.teamId, teamName: w.teamName, first: w.firstVotes ?? 0, points: w.points ?? w.score, share: w.voteShare!, real: true }))
    .sort((a, b) => b.share - a.share || b.first - a.first);
  const places = [10, 7, 5, 3, 1];
  // Voter disagreement scales with how tightly the chasing pack is bunched, so a runaway winner stays near-unanimous.
  const pack = field.length > 1 ? Math.abs(field[1].score - field[Math.min(4, field.length - 1)].score) : 0;
  const spread = Math.max(0.4, pack) * 0.6;
  const tally = new Map(field.map(w => [w.playerId, { first: 0, points: 0 }]));
  for (let v = 0; v < voters; v++) {
    const ranked = field.map(w => ({ id: w.playerId, s: w.score + (hashUnit(`${key}|${v}|${w.playerId}`) + hashUnit(`${key}|${v}|${w.playerId}|b`)) * spread })).sort((a, b) => b.s - a.s);
    ranked.slice(0, places.length).forEach((r, i) => { const t = tally.get(r.id)!; t.points += places[i]; if (i === 0) t.first++; });
  }
  return field.map(w => ({ playerId: w.playerId, teamId: w.teamId, teamName: w.teamName, ...tally.get(w.playerId)!, share: tally.get(w.playerId)!.points / (voters * places[0]) }))
    .filter(r => r.points > 0).sort((a, b) => b.points - a.points || b.first - a.first);
}

export interface LeaderRow { playerId: string; teamId: string | null; value: number }
export interface LeaderBoard { key: string; label: string; format: 'dec1' | 'dec3' | 'int'; rows: LeaderRow[] }
const LEADERS: { key: string; label: string; format: LeaderBoard['format']; value: (r: SeasonRow) => number | null }[] = [
  { key: 'ppg', label: 'Points', format: 'dec1', value: r => r.stats.points / r.stats.gamesPlayed },
  { key: 'rpg', label: 'Rebounds', format: 'dec1', value: r => (r.stats.oreb + r.stats.dreb) / r.stats.gamesPlayed },
  { key: 'apg', label: 'Assists', format: 'dec1', value: r => r.stats.ast / r.stats.gamesPlayed },
  { key: 'spg', label: 'Steals', format: 'dec1', value: r => r.stats.stl / r.stats.gamesPlayed },
  { key: 'bpg', label: 'Blocks', format: 'dec1', value: r => r.stats.blk / r.stats.gamesPlayed },
  { key: 'tpm', label: '3-Pointers made', format: 'int', value: r => r.stats.tpm },
  { key: 'per', label: 'PER', format: 'dec1', value: r => r.adv?.per ?? null },
  { key: 'ws', label: 'Win Shares', format: 'dec1', value: r => r.adv?.ws ?? null },
];
export function seasonLeaders(rows: SeasonRow[], season: string, minGames: number): LeaderBoard[] {
  const pool = rows.filter(r => r.season === season && r.stats.gamesPlayed >= minGames);
  return LEADERS.map(l => ({ key: l.key, label: l.label, format: l.format,
    rows: pool.map(r => ({ playerId: r.playerId, teamId: r.teamId, value: l.value(r) })).filter((r): r is LeaderRow => r.value != null && Number.isFinite(r.value))
      .sort((a, b) => b.value - a.value || a.playerId.localeCompare(b.playerId)).slice(0, 5) }));
}

export interface AlmanacStanding { teamId: string; teamName: string; wins: number; losses: number; finish?: PlayoffFinish; ortg?: number; drtg?: number }
export interface AlmanacSeason {
  season: string; inProgress: boolean;
  championTeamId: string | null; fmvpPlayerId: string | null;
  standings: AlmanacStanding[];
  bracket: PlayoffBracket | null; seeds: Record<string, number> | null;
  awards: SeasonAwards | null;
  leaders: LeaderBoard[];
}

/** Draft, re-signing, free agency and preseason: last season is archived, the new one hasn't started. */
export function isOffseason(league: League): boolean {
  return ['draft', 'resign_waive', 'free_agency', 'preseason'].includes(league.seasonPhase ?? 'regular_season');
}

/** Seasons with an almanac page, newest first. */
export function almanacSeasons(league: League): string[] {
  const archived = (league.franchiseHistory ?? []).map(r => r.season);
  // Between the draft and opening night the schedule still holds last season's games: the new season has no page yet.
  const played = !isOffseason(league) && league.schedule.some(g => g.played);
  return [...new Set([...(played && league.season ? [league.season] : []), ...archived.reverse()])];
}

export function almanacSeason(league: League, extras: GMLeagueExtras | undefined, season: string, liveAwards: () => SeasonAwards | null): AlmanacSeason | null {
  const record = (league.franchiseHistory ?? []).find(r => r.season === season);
  const { rows } = seasonRows(league, extras);
  const minGames = Math.max(5, Math.round((league.settings?.gamesPerSeason ?? 82) * 0.35));
  if (record) {
    const standings = (record.teamSeasons ?? []).map((t: TeamSeasonSummary) => ({ teamId: t.teamId, teamName: t.teamName, wins: t.wins, losses: t.losses, finish: t.playoffFinish, ortg: t.ortg, drtg: t.drtg }))
      .sort((a, b) => b.wins - a.wins || a.losses - b.losses);
    const games = standings[0] ? standings[0].wins + standings[0].losses : 82;
    return { season, inProgress: false, championTeamId: record.championTeamId, fmvpPlayerId: record.fmvpPlayerId, standings, bracket: record.bracket ?? null, seeds: record.seeds ?? null,
      awards: record.fullAwards ?? null, leaders: seasonLeaders(rows, season, Math.max(5, Math.round(games * 0.35))) };
  }
  if (season !== league.season) return null;
  const standings = computeStandings(league).map(r => ({ teamId: r.teamId, teamName: league.teams.find(t => t.teamId === r.teamId)?.name ?? r.teamId, wins: r.wins, losses: r.losses }));
  const played = standings[0] ? Math.max(...standings.map(s => s.wins + s.losses)) : 0;
  // Once a champion is crowned the season is over, even though it's archived only at the rollover.
  return { season, inProgress: !league.playoffBracket?.championTeamId, championTeamId: league.playoffBracket?.championTeamId ?? null, fmvpPlayerId: null, standings,
    bracket: league.playoffBracket ?? null, seeds: league.playoffBracket ? conferenceSeeds(league) : null, awards: liveAwards(),
    leaders: seasonLeaders(rows, season, Math.min(minGames, Math.max(1, Math.round(played * 0.35)))) };
}

/** The headline player awards, in ceremony order. */
export const CEREMONY_ORDER: { key: AwardBallotKey; label: string }[] = [
  { key: 'mip', label: 'Most Improved Player' }, { key: 'smoy', label: 'Sixth Man of the Year' }, { key: 'roy', label: 'Rookie of the Year' },
  { key: 'cpoy', label: 'Clutch Player of the Year' }, { key: 'dpoy', label: 'Defensive Player of the Year' }, { key: 'mvp', label: 'Most Valuable Player' },
];
