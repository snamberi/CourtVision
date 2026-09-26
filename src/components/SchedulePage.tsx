import { TeamLink } from './TeamLink';
import type { League } from '../simulation/league';

interface Props {
  league: League;
  onViewGame: (gameId: string) => void;
}

/** Pure schedule viewer — no simulate controls here. Advancing the season lives entirely behind the
 * fixed Play button now (see PlayButton.tsx), so every page can stay focused on one thing. */
export function SchedulePage({ league, onViewGame }: Props) {
  return (
    <div className="league-page">
      <h4>Schedule</h4>
      <div className="schedule-list">
        {league.schedule.slice(0, 500).map((g) => (
          <div key={g.id} className={`schedule-row ${g.played ? 'played' : ''}`} onClick={() => g.played && onViewGame(g.id)}>
            <span className="sched-round">R{g.round + 1}</span>
            <span><TeamLink teamId={g.homeTeamId} /></span>
            <span className="sched-vs">vs</span>
            <span><TeamLink teamId={g.awayTeamId} /></span>
            {g.cupGroupId && <span className="cup-tag" title="Also an In-Season Cup group game">CUP</span>}
            {g.played && g.result ? (
              <span className="sched-score">{g.result.homeScore} - {g.result.awayScore}</span>
            ) : (
              <span className="sched-score pending">-</span>
            )}
          </div>
        ))}
        {league.schedule.length === 0 && <p className="empty-state">No schedule generated yet.</p>}
        {league.schedule.length > 500 && <p className="hint-text">Showing first 500 of {league.schedule.length} games.</p>}
      </div>
    </div>
  );
}
