import type { PlayerSeason } from '../../simulation/types';
import { recentPlayerStats } from '../../simulation/playerLabels';
export function PlayerStatSummary({player}:{player:PlayerSeason}) {
  const row=recentPlayerStats(player); if(!row)return <small className="player-stat-summary">No season games yet</small>;
  const s=row.stats,g=s.gamesPlayed,per=(n:number)=>(n/g).toFixed(1);
  return <small className="player-stat-summary" title="Full season averages, including games with former teams">{row.previous?`${row.season} · `:''}{g} GP · {per(s.minutes)} MIN · {per(s.points)} PTS · {per(s.oreb+s.dreb)} REB · {per(s.ast)} AST · {per(s.stl)} STL · {per(s.blk)} BLK</small>;
}
