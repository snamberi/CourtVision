import { TeamLink } from './TeamLink';
import { TeamLogo } from './TeamLogo';
import { useState } from 'react';
import type { League } from '../simulation/league';
import { computeStandings, computeConferenceStandings, computeDivisionStandings, hasConferenceStructure } from '../simulation/league';

interface Props {
  league: League;
}

type StandingsView = 'league' | 'conference' | 'division';

/** Pure standings viewer — no simulate controls here. Advancing the season lives entirely behind the
 * fixed Play button now (see PlayButton.tsx), so every page can stay focused on one thing. */
export function StandingsPage({ league }: Props) {
  const conferenceStructured = hasConferenceStructure(league);
  const [view, setView] = useState<StandingsView>(conferenceStructured ? 'conference' : 'league');
  const standings = computeStandings(league);
  const teamName = (id: string) => league.teams.find((t) => t.teamId === id)?.name ?? id;

  const standingsTable = (rows: typeof standings, showSeed: boolean, seedOffset = 0) => (
    <table className="standings-table">
      <thead>
        <tr>{showSeed && <th>#</th>}<th>Team</th><th>W</th><th>L</th><th>PCT</th><th>PF</th><th>PA</th><th>DIFF</th></tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.teamId} className={showSeed && i - seedOffset < 8 && i >= seedOffset ? 'playoff-seed' : undefined}>
            {showSeed && <td>{i - seedOffset + 1}</td>}
            <td><span className="team-name-logo"><TeamLogo team={league.teams.find(t => t.teamId === r.teamId) ?? { teamId: r.teamId, name: r.teamId }} size={28} /><TeamLink name={teamName(r.teamId)} /></span></td>
            <td>{r.wins}</td>
            <td>{r.losses}</td>
            <td>{r.winPct.toFixed(3)}</td>
            <td>{r.pointsFor}</td>
            <td>{r.pointsAgainst}</td>
            <td>{r.pointDiff >= 0 ? '+' : ''}{r.pointDiff}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="league-page">
      <div className="stats-section-header">
        <h4>Standings</h4>
        {conferenceStructured && (
          <div className="stats-view-toggle">
            <button className={view === 'conference' ? 'active' : ''} onClick={() => setView('conference')}>Conference</button>
            <button className={view === 'division' ? 'active' : ''} onClick={() => setView('division')}>Division</button>
            <button className={view === 'league' ? 'active' : ''} onClick={() => setView('league')}>League</button>
          </div>
        )}
      </div>

      {view === 'league' && standingsTable(standings, false)}

      {view === 'conference' && conferenceStructured && (() => {
        const { east, west } = computeConferenceStandings(league);
        return (
          <div className="conference-standings-grid">
            <div><h5 className="stats-subheading">Eastern Conference</h5>{standingsTable(east, true)}</div>
            <div><h5 className="stats-subheading">Western Conference</h5>{standingsTable(west, true)}</div>
          </div>
        );
      })()}

      {view === 'division' && conferenceStructured && (() => {
        const groups = computeDivisionStandings(league);
        const east = groups.filter((g) => g.conferenceId === 'east');
        const west = groups.filter((g) => g.conferenceId === 'west');
        return (
          <div className="conference-standings-grid">
            <div>
              <h5 className="stats-subheading">Eastern Conference</h5>
              {east.map((g) => <div key={g.divisionId}><h6 className="division-title">{g.divisionId}</h6>{standingsTable(g.rows, false)}</div>)}
            </div>
            <div>
              <h5 className="stats-subheading">Western Conference</h5>
              {west.map((g) => <div key={g.divisionId}><h6 className="division-title">{g.divisionId}</h6>{standingsTable(g.rows, false)}</div>)}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
