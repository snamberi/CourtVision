import type { League, AllStarWeekendRecord } from './league';
import { computeStandings, hasConferenceStructure, isAllStarBreakPending } from './league';
import { positionGroup, type AwardWinner } from './awards';
import { perGameAverages } from './careerStats';
import { calculateOverall } from './engine/overall';

export interface AllStarVoteStanding extends AwardWinner {
  fanVotes: number;
  playerVotes: number;
  coachVotes: number;
  games: number;
  ppg: number;
  apg: number;
  rpg: number;
}
export interface AllStarVotingRecord {
  ballot: string[];
  locked: boolean;
  standings?: AllStarVoteStanding[];
  selected?: AwardWinner[];
}

export function currentAllStarWeekend(league: League): AllStarWeekendRecord {
  return league.allStarWeekend?.season === (league.season ?? '') ? league.allStarWeekend : { season: league.season ?? '', completed: false };
}

/** Simulated fan, player and coach electorates use distinct, transparent preferences. No network votes. */
export function allStarVoteStandings(league: League, minGames = 5): AllStarVoteStanding[] {
  const current = currentAllStarWeekend(league);
  if (current.voting?.locked && current.voting.standings) return current.voting.standings;
  const wins = new Map(computeStandings(league).map(t => [t.teamId, t.winPct]));
  const maxGames = Math.max(0, ...league.teams.flatMap(t => t.seasons.map(s => s.seasonStats?.gamesPlayed ?? 0)));
  const qualifying = Math.max(1, Math.min(minGames, Math.ceil(maxGames * 0.25)));
  const ballot = current.voting?.ballot ?? [];
  const candidates = league.teams.flatMap(t => t.seasons.filter(s => (s.seasonStats?.gamesPlayed ?? 0) >= qualifying).map(s => {
    const avg = perGameAverages(s.seasonStats);
    const rating = calculateOverall(s);
    const availability = Math.sqrt(avg.gamesPlayed / Math.max(1, maxGames));
    const production = Math.max(0, avg.ppg + avg.rpg * 1.2 + avg.apg * 1.5 + avg.spg * 2 + avg.bpg * 2 - avg.tovPg);
    const fanVotes = Math.round((avg.ppg * 2 + rating * 0.6 + (t.marketSize ?? 50) * 0.25) * avg.gamesPlayed * 10) + (ballot.includes(s.playerId) ? 1 : 0);
    const playerVotes = Math.round((production + rating * 0.4) * availability * 10);
    const coachVotes = Math.round((production + Math.max(0, avg.efficiency) * 0.4 + (wins.get(t.teamId) ?? 0) * 20) * availability * 10);
    return { playerId: s.playerId, teamId: t.teamId, teamName: t.name, fanVotes, playerVotes, coachVotes,
      games: avg.gamesPlayed, ppg: avg.ppg, rpg: avg.rpg, apg: avg.apg, score: 0, position: positionGroup(s), ...(t.conferenceId ? { conference: t.conferenceId } : {}) };
  }));
  const weights = [league.rulesSettings?.allStarFanWeight ?? 50, league.rulesSettings?.allStarPlayerWeight ?? 25, league.rulesSettings?.allStarCoachWeight ?? 25].map(n => Math.max(0, n));
  const total = weights.reduce((a, b) => a + b, 0);
  if (!total) { weights[0] = 50; weights[1] = 25; weights[2] = 25; }
  const groups = ['fanVotes', 'playerVotes', 'coachVotes'] as const;
  const maxima = groups.map(k => Math.max(1, ...candidates.map(c => c[k])));
  return candidates.map(c => ({ ...c, score: groups.reduce((n, k, i) => n + c[k] / maxima[i] * weights[i], 0) / (total || 100) * 100 }))
    .sort((a, b) => b.score - a.score || b.coachVotes - a.coachVotes || a.playerId.localeCompare(b.playerId));
}

export function castAllStarBallot(league: League, playerIds: string[]): League {
  const current = currentAllStarWeekend(league);
  if (current.completed || current.voting?.locked || isAllStarBreakPending(league) || league.rulesSettings?.allStarEnabled === false) return league;
  const valid = new Set(league.teams.flatMap(t => t.seasons.map(s => s.playerId)));
  const ballot = [...new Set(playerIds)].filter(id => valid.has(id)).slice(0, 10);
  return { ...league, allStarWeekend: { ...current, voting: { ballot, locked: false } } };
}

export function lockAllStarVoting(league: League, count = 24, minGames = 5): League {
  const current = currentAllStarWeekend(league);
  if (current.voting?.locked) return league;
  const standings = allStarVoteStandings(league, minGames);
  const selected = hasConferenceStructure(league) ? conferenceSelection(standings, count) : leagueSelection(standings, count);
  return { ...league, allStarWeekend: { ...current, voting: { ballot: current.voting?.ballot ?? [], locked: true, standings, selected } } };
}

/** No conferences: the top ten vote-getters start and the coaches pick the reserves. */
function leagueSelection(standings: AllStarVoteStanding[], count: number): AwardWinner[] {
  const size = Math.max(0, Math.floor(count / 2) * 2);
  const starters = standings.slice(0, Math.min(10, size));
  const starterIds = new Set(starters.map(s => s.playerId));
  const reserves = standings.filter(s => !starterIds.has(s.playerId)).sort((a, b) => b.coachVotes - a.coachVotes || b.score - a.score).slice(0, Math.max(0, size - starters.length));
  return [...starters, ...reserves].map((s, i) => ({ playerId: s.playerId, teamId: s.teamId, teamName: s.teamName, score: 1000 - i, starter: i < starters.length }));
}

/**
 * East and West each send half the All-Stars: the vote picks two backcourt and three frontcourt starters,
 * the coaches pick the reserves. Starters come first (East, then West), so "the first ten start" still holds.
 */
function conferenceSelection(standings: AllStarVoteStanding[], count: number): AwardWinner[] {
  const per = Math.max(5, Math.floor(count / 2));
  const picks = (['east', 'west'] as const).map((conf) => {
    const pool = standings.filter(s => s.conference === conf);
    const guards = pool.filter(s => s.position === 'G').slice(0, 2);
    const front = pool.filter(s => s.position !== 'G').slice(0, 3);
    let starters = [...guards, ...front];
    // A conference short on guards or bigs fills the starting five with its next-best vote-getters.
    for (const s of pool) { if (starters.length >= 5) break; if (!starters.includes(s)) starters.push(s); }
    starters = starters.slice(0, 5).sort((a, b) => b.score - a.score);
    const reserves = pool.filter(s => !starters.includes(s)).sort((a, b) => b.coachVotes - a.coachVotes || b.score - a.score).slice(0, per - starters.length);
    return { conf, starters, reserves };
  });
  const tag = (s: AllStarVoteStanding, conf: 'east' | 'west', starter: boolean) => ({ playerId: s.playerId, teamId: s.teamId, teamName: s.teamName, score: 0, conference: conf, starter });
  const ordered = [...picks.flatMap(p => p.starters.map(s => tag(s, p.conf, true))), ...picks.flatMap(p => p.reserves.map(s => tag(s, p.conf, false)))];
  return ordered.map((w, i) => ({ ...w, score: 1000 - i }));
}
