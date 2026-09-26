import { PixelIcon } from './PixelIcon';
import { TeamLink } from './TeamLink';
import { useMemo, useState } from 'react';
import type { League } from '../simulation/league';
import { computeStandings, simulateRounds } from '../simulation/league';
import { calculateOverall } from '../simulation/engine/overall';
import { teamLeader } from '../simulation/teamStatus';

interface Props {
  league: League;
  onChange: (league: League) => void;
}

export function DailySchedulePage({ league, onChange }: Props) {
  const rounds = useMemo(() => [...new Set(league.schedule.map((g) => g.round))].sort((a, b) => a - b), [league.schedule]);
  const currentRound = league.schedule.find((g) => !g.played)?.round ?? rounds[rounds.length - 1] ?? 0;
  const [round, setRound] = useState(currentRound);
  const standings = computeStandings(league);
  const teamById = new Map(league.teams.map((t) => [t.teamId, t]));

  const games = league.schedule.filter((g) => g.round === round);
  const roundIndex = rounds.indexOf(round);

  const simToThisDay = () => {
    if (round <= (league.calendarRound ?? -1)) return;
    const delta = round - (league.calendarRound ?? -1);
    onChange(simulateRounds(league, delta, Date.now()));
  };

  const teamCard = (teamId: string) => {
    const t = teamById.get(teamId);
    const record = standings.find((r) => r.teamId === teamId);
    const rating = t ? Math.round(t.seasons.reduce((s, p) => s + calculateOverall(p), 0) / Math.max(1, t.seasons.length)) : 0;
    const star = t ? teamLeader(t) : null;
    return (
      <div className="daily-team">
        <div className="daily-team-name"><TeamLink name={t?.name ?? teamId} /></div>
        <div className="hint-text">{record ? `${record.wins}-${record.losses}` : '0-0'}, {rating} ovr</div>
        {star && <div className="daily-team-star">{star.playerId}</div>}
      </div>
    );
  };

  return (
    <div className="daily-schedule-page">
      <div className="daily-schedule-header">
        <h4>Daily Schedule — Round {round + 1}</h4>
        <div className="daily-schedule-nav">
          <button aria-label="Previous day" disabled={roundIndex <= 0} onClick={() => setRound(rounds[roundIndex - 1])}><span className="pixel-chevron previous"><PixelIcon name="play" size={16} /></span></button>
          <button aria-label="Next day" disabled={roundIndex >= rounds.length - 1} onClick={() => setRound(rounds[roundIndex + 1])}><PixelIcon name="play" size={16} /></button>
          <button className="primary" onClick={simToThisDay} disabled={round <= (league.calendarRound ?? -1)}>Sim to This Day</button>
        </div>
      </div>

      {games.length === 0 ? (
        <p className="empty-state">No games scheduled for this round.</p>
      ) : (
        <div className="daily-schedule-grid">
          {games.map((g) => (
            <div key={g.id} className="daily-schedule-card">
              {teamCard(g.awayTeamId)}
              <div className="daily-schedule-score">
                {g.played && g.result ? `${g.result.awayScore} - ${g.result.homeScore}` : 'vs'}
                {g.cupGroupId && <span className="cup-tag" title="Also an In-Season Cup group game">CUP</span>}
              </div>
              {teamCard(g.homeTeamId)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
