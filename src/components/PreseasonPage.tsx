import { TeamText } from './TeamLink';
import type { League } from '../simulation/league';
import { computeTeamOverallAverage } from '../simulation/teamStatus';
import { seasonStartDate, daysBetween, formatDisplayDate, formatSeasonYear } from '../simulation/calendar';

interface Props {
  league: League;
  controlledTeamId: string | null;
  onStartSeason: () => void;
}

export function PreseasonPage({ league, controlledTeamId, onStartSeason }: Props) {
  const team = controlledTeamId ? league.teams.find((t) => t.teamId === controlledTeamId) : null;
  const openingDay = seasonStartDate(league.season);
  const daysUntilOpeningDay = league.calendarDate ? Math.max(0, daysBetween(league.calendarDate, openingDay)) : null;

  return (
    <div className="settings-page">
      <section>
        <h4>Preseason — {formatSeasonYear(league.season)}</h4>
        <p className="hint-text">
          Free agency has closed. Rosters are set for the new season{team && <TeamText text={` — here's where ${team.name} stands`} />}.
        </p>
        {daysUntilOpeningDay != null && (
          <p className="hint-text">
            Opening night: {formatDisplayDate(openingDay)} ({daysUntilOpeningDay} day{daysUntilOpeningDay === 1 ? '' : 's'} away)
          </p>
        )}
        {team && (
          <p className="hint-text">
            Roster size: {team.seasons.length} · Average Overall: {computeTeamOverallAverage(team).toFixed(1)}
          </p>
        )}
      </section>
      <section>
        <button className="primary" onClick={onStartSeason}>Start Regular Season</button>
      </section>
    </div>
  );
}
