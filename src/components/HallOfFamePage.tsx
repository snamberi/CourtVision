import { formatSeasonYear } from '../simulation/calendar';
import { TeamLink } from './TeamLink';
import { useMemo, useState } from 'react';
import type { League } from '../simulation/league';
import { computeHallOfFame, HOF_THRESHOLD } from '../simulation/hallOfFame';

interface Props {
  league: League;
  onSelectPlayer: (playerId: string) => void;
}

export function HallOfFamePage({ league, onSelectPlayer }: Props) {
  const [showNearMisses, setShowNearMisses] = useState(false);
  const cases = useMemo(() => computeHallOfFame(league), [league]);
  const inducted = cases.filter((c) => c.inducted);
  const nearMisses = cases.filter((c) => !c.inducted);
  const shown = showNearMisses ? nearMisses : inducted;

  return (
    <div className="hall-of-fame-page">
      <h4>Hall of Fame</h4>
      <p className="hint-text">
        Players are enshrined automatically when they retire with a career score of {HOF_THRESHOLD}+,
        blending career totals, per-game production, longevity, and awards won.
      </p>

      <div className="stats-view-toggle">
        <button className={!showNearMisses ? 'active' : ''} onClick={() => setShowNearMisses(false)}>
          Inducted ({inducted.length})
        </button>
        <button className={showNearMisses ? 'active' : ''} onClick={() => setShowNearMisses(true)}>
          Not Inducted ({nearMisses.length})
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="empty-state">
          {cases.length === 0
            ? 'Nobody has retired yet — advance a few seasons and the first classes will start filling in.'
            : showNearMisses ? 'Every retiree so far made it in.' : 'No inductees yet.'}
        </p>
      ) : (
        <div className="hof-grid">
          {shown.map((c) => (
            <div key={c.playerId} className={`hof-card ${c.inducted ? 'inducted' : ''}`}>
              <div className="hof-card-header">
                <span className="hof-name" onClick={() => onSelectPlayer(c.playerId)}>{c.playerId}</span>
                <span className="hof-score">{c.score}</span>
              </div>
              <p className="hint-text hof-sub">
                Retired {formatSeasonYear(c.finalSeason)} · <TeamLink name={c.finalTeamName} />
              </p>
              <ul className="hof-resume">
                {c.resume.map((line, i) => <li key={i}>{line}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
