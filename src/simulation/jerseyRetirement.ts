import type { League, RetiredPlayerRecord } from './league';
import { retireJerseyNumber } from './league';
import { getPlayerAwardsHistory } from './leagueAnalytics';

/*
 * AI franchises retire the numbers of their legends when those players retire. The franchise where he spent the
 * most seasons honors him when his career there was big enough: an MVP, or several All-Star seasons, or a long run
 * with titles and a peak as one of the league's best. Your own team decides for itself (Team History).
 */

export interface JerseyHonor { teamId: string; playerId: string; number: number; reason: string }

export function jerseyHonorFor(league: League, record: RetiredPlayerRecord): Omit<JerseyHonor, 'teamId'> & { teamId: string } | null {
  const data = record.finalSeasonData;
  const career = data?.careerHistory ?? [];
  if (!data || data.jerseyNumber == null || career.length < 5) return null;
  const seasonsBy = new Map<string, string[]>();
  for (const c of career) if (c.teamId) seasonsBy.set(c.teamId, [...(seasonsBy.get(c.teamId) ?? []), c.season]);
  const [teamId, seasons] = [...seasonsBy].sort((a, b) => b[1].length - a[1].length)[0] ?? [];
  if (!teamId || seasons.length < 5) return null;
  const here = new Set(seasons);
  const awards = getPlayerAwardsHistory(league, record.playerId).filter(a => here.has(a.season));
  const count = (key: string) => awards.filter(a => a.key === key).length;
  const mvps = count('mvp'), allStars = count('allStar'), titles = count('champion'), fmvps = count('fmvp');
  const peak = Math.max(...career.filter(c => c.teamId === teamId).map(c => c.overall ?? 0));
  const reason = mvps ? `${mvps} MVP${mvps > 1 ? 's' : ''}` : fmvps ? `${fmvps} Finals MVP${fmvps > 1 ? 's' : ''}`
    : allStars >= 4 ? `${allStars} All-Star seasons` : titles >= 2 && allStars >= 1 ? `${titles} titles` : seasons.length >= 10 && peak >= 78 ? `${seasons.length} seasons` : null;
  if (!reason) return null;
  return { teamId, playerId: record.playerId, number: data.jerseyNumber, reason: `${reason} in ${seasons.length} seasons` };
}

/** Raises the numbers of this offseason's retirees on AI teams. Returns the league and the honors (for news). */
export function retireLegendJerseys(league: League, retirees: RetiredPlayerRecord[], userTeamId: string | null, season: string): { league: League; honors: JerseyHonor[] } {
  const honors: JerseyHonor[] = [];
  let teams = league.teams;
  for (const r of retirees) {
    const honor = jerseyHonorFor(league, r);
    if (!honor || honor.teamId === userTeamId) continue;
    const team = teams.find(t => t.teamId === honor.teamId);
    if (!team || team.retiredJerseys?.some(j => j.number === honor.number || j.playerId === honor.playerId)) continue;
    teams = teams.map(t => t.teamId === honor.teamId ? retireJerseyNumber(t, honor.number, honor.playerId, season) : t);
    honors.push(honor);
  }
  return { league: honors.length ? { ...league, teams } : league, honors };
}
