import type { TimelineSeason } from './timeline';
import type { TrophyKey } from './trophies';

export interface EarnedHonor { season: string; award: TrophyKey; winner?: string }
const INDIVIDUAL = ['mvp', 'dpoy', 'roy', 'mip', 'smoy', 'coy', 'cpoy', 'eoy', 'hustle', 'teammate', 'scoringChamp', 'reboundingChamp', 'assistsChamp', 'stealsChamp', 'blocksChamp', 'sharpshooter', 'floorGeneral', 'paintScorer', 'ironMan', 'rookieDefender'] as const;
/** Imported history belongs to the timeline; this room displays what this franchise earned in the save. */
export function earnedHonors(seasons: TimelineSeason[], teamId: string): EarnedHonor[] {
  return seasons.filter(s => !s.record?.imported).flatMap(s => {
    const honors: EarnedHonor[] = s.champion ? [{ season: s.season, award: 'champion' }] : [];
    const roster = new Set(s.summary?.roster.map(p => p.playerId) ?? []);
    for (const key of INDIVIDUAL) {
      const winner = s.record?.fullAwards?.[key];
      if (!winner) continue;
      const player = 'playerId' in winner ? winner.playerId : undefined;
      if (winner.teamId === teamId || (!winner.teamId && player && roster.has(player))) honors.push({ season: s.season, award: key, winner: player ?? ('coachName' in winner ? String(winner.coachName) : undefined) });
    }
    if (s.champion && s.record?.fmvpPlayerId) honors.push({ season: s.season, award: 'fmvp', winner: s.record.fmvpPlayerId });
    return honors;
  });
}
