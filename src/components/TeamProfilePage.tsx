import { CoachProfile } from './StaffPage';
import { staffMembers } from '../simulation/staffManagement';
import { STAFF_LABELS } from '../simulation/coachingModel';
import type { League } from '../simulation/league';
import { computeStandings, defaultCoachTendencies } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import { capSpaceRemaining } from '../simulation/gm';
import { computeTeamFinances } from '../simulation/finances';
import { calculateOverall } from '../simulation/engine/overall';
import { perGameAverages } from '../simulation/careerStats';
import { primaryPosition } from '../simulation/teamStatus';
import { TeamIdentityPanel } from './TeamIdentityPanel';
import { PlayerNameTag } from './PlayerAvatar';
import { PixelIcon } from './PixelIcon';
import { statWhole } from './statFormat';
export function TeamProfilePage({ league, extras, teamId, onSelectPlayer }: { league: League; extras: GMLeagueExtras; teamId: string; onSelectPlayer: (id: string) => void }) {
  const team = league.teams.find(t => t.teamId === teamId);
  if (!team) return <p className="empty-state">This team is no longer in the league.</p>;
  const record = computeStandings(league).find(r => r.teamId === teamId);
  const finances = computeTeamFinances(team, extras.contracts, extras.capSettings, league.rulesSettings, record?.winPct ?? .5);
  const plan = { ...defaultCoachTendencies(), ...team.coach };
  const money = (n: number) => `$${(n / 1_000_000).toFixed(2)}M`;
  return <article className="team-profile-page">
    <span className="pixel-eyebrow"><PixelIcon name="search" /> TEAM PROFILE · READ ONLY</span>
    <TeamIdentityPanel team={team} history={league.franchiseHistory} currentChampion={league.playoffBracket?.championTeamId} currentSeason={league.season} />
    <p>{record?.wins ?? 0}–{record?.losses ?? 0} · {team.conferenceId ?? 'League'} · {team.divisionId ?? 'No division'} · {team.seasons.length} players</p>
    <section><h3>Coaching</h3><div className="team-profile-facts"><div><small>Head coach</small><strong>{team.coachIdentity?.coachId ?? 'Vacant'}</strong></div><div><small>Coach rating</small><strong>{team.coachIdentity?.rating ?? '—'}</strong></div><div><small>Offense</small><strong>{plan.offensiveSystem ?? 'balanced'}</strong></div><div><small>Defense</small><strong>{plan.defensiveScheme ?? 'man'}</strong></div><div><small>Training</small><strong>{plan.trainingFocus ?? 'balanced'}</strong></div><div><small>Rotation depth</small><strong>{plan.rotationDepth ?? 10}</strong></div></div>
      <dl className="team-profile-facts">{([['Pace',plan.paceTendency],['Three-point frequency',plan.threePointFrequency],['Star usage',plan.starUsage],['Defensive aggression',plan.defensiveAggression],['Double teams',plan.doubleTeamFrequency],['Bench usage',plan.benchUsage]] as const).map(([label,n]) => <div key={label}><dt>{label}</dt><dd>{n}/100</dd></div>)}</dl></section>
    <section><h3>Coaching Staff</h3>{staffMembers(team).map(s=><details key={s.role}><summary>{STAFF_LABELS[s.role]} · {s.coach.coachId}</summary><CoachProfile coach={s.coach} role={s.role}/></details>)}</section>
    <section><h3>Roster</h3><div className="feature-table-scroll"><table className="db-table"><thead><tr><th>Player</th><th>Pos</th><th>Age</th><th>OVR</th><th>PPG</th><th>RPG</th><th>APG</th><th>Salary</th></tr></thead><tbody>{team.seasons.map(p => { const stats = perGameAverages(p.seasonStats); return <tr key={p.playerId}><td><button className="link-button" onClick={() => onSelectPlayer(p.playerId)}><PlayerNameTag playerId={p.playerId} teamId={teamId} jerseyNumber={p.jerseyNumber} size={26} /></button></td><td>{primaryPosition(p)}</td><td>{p.age}</td><td>{calculateOverall(p)}</td><td>{statWhole(stats.ppg)}</td><td>{statWhole(stats.rpg)}</td><td>{statWhole(stats.apg)}</td><td>{extras.contracts[p.playerId] ? money(extras.contracts[p.playerId].annualSalary) : '—'}</td></tr>; })}</tbody></table></div></section>
    <section><h3>Finances</h3><div className="team-profile-facts">{Object.entries({ Payroll: money(finances.payroll), 'Cap space': money(capSpaceRemaining(extras.contracts, team, extras.capSettings)), 'Projected annual revenue': money(finances.annualRevenue), 'Staff and facilities': money(finances.expenseSpend), 'Projected operating income': money(finances.operatingIncome), 'Financial health': finances.financialHealth }).map(([label,value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div></section>
  </article>;
}
