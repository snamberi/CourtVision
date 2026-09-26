import { TeamLink } from './TeamLink';
import { useState } from 'react';
import type { League } from '../simulation/league';
import { computeStandings } from '../simulation/league';
import { computeTeamFinances } from '../simulation/finances';
import type { GMLeagueExtras } from '../simulation/gm';
import { teamPayroll, capSpaceRemaining } from '../simulation/gm';
import { ExpenseLevelsPanel } from './ExpenseLevelsPanel';
import { hashRating } from './gmShared';

interface Props {
  sandboxMode?: boolean;
  league: League;
  extras: GMLeagueExtras;
  controlledTeamId: string | null;
  onChange: (league: League, extras: GMLeagueExtras) => void;
}

export function FinancesPage({ league, extras, controlledTeamId, onChange, sandboxMode = false }: Props) {
  const standings = computeStandings(league);
  const [selectedTeamId, setSelectedTeamId] = useState(league.teams[0]?.teamId ?? '');
  const myTeam = league.teams.find(t => t.teamId === (sandboxMode ? selectedTeamId : controlledTeamId));
  return (
    <div className="league-finances-page">
      {sandboxMode && <label>Manage finances for<select value={selectedTeamId} onChange={e => setSelectedTeamId(e.target.value)}>{league.teams.map(t => <option key={t.teamId} value={t.teamId}>{t.name}</option>)}</select></label>}
      {myTeam && (
        <ExpenseLevelsPanel
          team={myTeam}
          onSave={(teamId, levels) => onChange(
            { ...league, teams: league.teams.map((t) => (t.teamId === teamId ? { ...t, expenseLevels: levels } : t)) },
            extras,
          )}
        />
      )}
      <p className="hint-text">
        Salary cap: ${(extras.capSettings.salaryCap / 1_000_000).toFixed(1)}M (teams over this amount cannot sign
        free agents for more than the minimum contract) · Luxury tax line: ${(extras.capSettings.luxuryTaxLine / 1_000_000).toFixed(1)}M
        (teams above are taxed at {extras.capSettings.luxuryTaxMultiplier}x the overage)
      </p>
      <div className="finances-table-wrap">
        <table className="db-table stat-line-table finances-table">
          <thead>
            <tr>
              <th className="col-name">Team</th><th>Pop</th><th>Avg Att.</th><th>Ticket $</th><th>Revenue</th><th>Expenses</th><th>Profit</th>
              <th>Payroll</th><th>Cap Space</th><th>Roster</th><th>Strategy</th>
              <th>Scouting</th><th>Coaching</th><th>Health</th><th>Facilities</th>
            </tr>
          </thead>
          <tbody>
            {league.teams.map((t) => {
              const payroll = teamPayroll(extras.contracts, t);
              const space = capSpaceRemaining(extras.contracts, t, extras.capSettings);
              const winPct = standings.find((r) => r.teamId === t.teamId)?.winPct ?? 0.5;
              const finances = computeTeamFinances(t, extras.contracts, extras.capSettings, league.rulesSettings, winPct);
              const pop = 0.5 + finances.marketSize * 0.2; // millions, a rough population proxy from market size
              const avgAttendance = Math.round(12000 + finances.marketSize * 130 + winPct * 4000);
              const ticketPrice = Math.round(15 + finances.marketSize * 0.5 + winPct * 20);
              const openSpots = Math.max(0, 15 - t.seasons.length);
              const activeInjuries = Object.values(league.injuries ?? {}).filter((r) => r.teamId === t.teamId).length;
              const healthRating = Math.max(20, 100 - activeInjuries * 18);
              const coachingRating = t.coachIdentity?.rating ?? hashRating(t.teamId, 7);
              return (
                <tr key={t.teamId}>
                  <td className="col-name"><TeamLink name={t.name} /></td>
                  <td>{pop.toFixed(1)}M</td>
                  <td>{avgAttendance.toLocaleString()}</td>
                  <td>${ticketPrice}</td>
                  <td>${(finances.annualRevenue / 1_000_000).toFixed(1)}M</td>
                  <td>${(finances.expenseSpend / 1_000_000).toFixed(1)}M</td>
                  <td className={finances.operatingIncome >= 0 ? 'plus' : 'minus'}>
                    {finances.operatingIncome >= 0 ? '+' : ''}${(finances.operatingIncome / 1_000_000).toFixed(1)}M
                  </td>
                  <td>${(payroll / 1_000_000).toFixed(1)}M</td>
                  <td className={space < 0 ? 'minus' : 'plus'}>${(space / 1_000_000).toFixed(1)}M</td>
                  <td>{openSpots}</td>
                  <td>{winPct >= 0.55 ? 'Contending' : winPct >= 0.42 ? 'Retooling' : 'Rebuilding'}</td>
                  <td>{hashRating(t.teamId, 1)}</td>
                  <td>{coachingRating}</td>
                  <td className={healthRating < 60 ? 'minus' : undefined}>{healthRating}</td>
                  <td>{hashRating(t.teamId, 3)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
