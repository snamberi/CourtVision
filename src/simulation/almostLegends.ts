import type { League, PlayoffFinish } from './league';
import type { HallOfFameCase } from './hallOfFame';
import { HOF_THRESHOLD } from './hallOfFame';
import { getPlayerAwardsHistory } from './leagueAnalytics';

export interface AlmostLegendRun {
  season: string;
  teamName: string;
  finish: PlayoffFinish;
  opponent?: string;
  result?: string;
}
export interface AlmostLegend { career: HallOfFameCase; runs: AlmostLegendRun[] }

const finishRank: Partial<Record<PlayoffFinish, number>> = { Finals: 5, 'Conference Finals': 4, 'Second Round': 3, 'First Round': 2, Playoffs: 1, 'Play-In': 1 };

/** Retired, Hall-caliber careers with no recorded championship. Runs use archived season rosters;
 * they establish team affiliation, not necessarily that the player appeared in the playoff series. */
export function almostLegends(league: League, cases: HallOfFameCase[]): AlmostLegend[] {
  const records = new Map((league.retiredPlayers ?? []).map(r => [r.playerId, r]));
  return cases.filter(c => c.score >= HOF_THRESHOLD).flatMap(career => {
    const player = records.get(career.playerId)?.finalSeasonData;
    if (!player || getPlayerAwardsHistory(league, career.playerId, player).some(a => a.key === 'champion')) return [];
    const runs: AlmostLegendRun[] = [];
    for (const history of league.franchiseHistory ?? []) for (const team of history.teamSeasons ?? []) {
      if (!finishRank[team.playoffFinish] || !team.roster?.some(p => p.playerId === career.playerId)) continue;
      const eliminated = history.bracket?.rounds.flat().find(s => s.winnerTeamId && s.winnerTeamId !== team.teamId && (s.teamAId === team.teamId || s.teamBId === team.teamId));
      const opponentId = eliminated?.winnerTeamId;
      const opponent = opponentId ? league.teams.find(t => t.teamId === opponentId)?.name ?? history.teamSeasons?.find(t => t.teamId === opponentId)?.teamName ?? opponentId : undefined;
      const result = eliminated ? team.teamId === eliminated.teamAId ? `${eliminated.teamAWins}–${eliminated.teamBWins}` : `${eliminated.teamBWins}–${eliminated.teamAWins}` : undefined;
      runs.push({ season: history.season, teamName: team.teamName, finish: team.playoffFinish, opponent, result });
    }
    runs.sort((a, b) => (finishRank[b.finish] ?? 0) - (finishRank[a.finish] ?? 0) || b.season.localeCompare(a.season));
    return [{ career, runs }];
  }).sort((a, b) => b.career.score - a.career.score || a.career.playerId.localeCompare(b.career.playerId));
}
