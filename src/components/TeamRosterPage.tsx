import { LockerRoomPanel, MoraleCell } from './MoralePanels';
import { plural } from '../lib/humanize';
import { ChemistryWeb } from './ChemistryWeb';
import { TeamIdentityPanel } from './TeamIdentityPanel';
import type { TeamIdentity } from '../simulation/teamIdentity';
import type { FranchiseHistoryRecord } from '../simulation/league';
import { useMemo, useState } from 'react';
import { recentForm } from '../simulation/form';
import { FormCell } from './FormCell';
import type { LeagueTeam, InjuryRecord, StandingsRow, ScheduledGame } from '../simulation/league';
import { calculateOverall } from '../simulation/engine/overall';
import { computeTradeValue } from '../simulation/gm';
import type { Contract, SalaryCapSettings } from '../simulation/gm';
import type { PlayerSeason } from '../simulation/types';
import { perGameAverages } from '../simulation/careerStats';
import { teamLeader, effectiveRotation, primaryPosition } from '../simulation/teamStatus';
import { StarIcon } from './Icons';
import { coachStrengths, coachWeaknesses, relationshipWith, relationshipLabel, COACH_TRAIT_LABELS, type CoachTraitKey, type CoachIdentity } from '../simulation/coaching';
import { formatSeasonYear } from '../simulation/calendar';
import { PlayerNameTag } from './PlayerAvatar';
import { stat1 } from './statFormat';

interface Props {
  initialTeamId?: string | null;
  franchiseHistory?: FranchiseHistoryRecord[]; currentChampion?: string | null; currentSeason?: string;
  canEditIdentity?: (teamId: string) => boolean;
  onIdentityChange?: (teamId: string, identity: TeamIdentity) => void;
  showTradeValues?: boolean;
  teams: LeagueTeam[];
  onRunDevelopmentPass?: () => void;
  onSelectPlayer?: (playerId: string) => void;
  injuries?: Record<string, InjuryRecord>;
  contracts?: Record<string, Contract>;
  capSettings?: SalaryCapSettings;
  standings?: StandingsRow[];
  onRelease?: (teamId: string, playerId: string) => void;
  onTradeAway?: (playerId: string) => void;
  /** The season's games, for the last-five-games form column. */
  schedule?: ScheduledGame[];
  onOpenCoachMarket?: (teamId: string) => void;
  onHireCoach?: (teamId: string, candidate: CoachIdentity) => void;
  coachCandidates?: CoachIdentity[] | null;
  retiredPlayers?: { playerId: string; finalTeamId: string }[];
  onRetireJersey?: (teamId: string, number: number, playerId: string) => void;
  onUnretireJersey?: (teamId: string, number: number) => void;
}

export function TeamRosterPage({
  showTradeValues = false, initialTeamId, teams, onRunDevelopmentPass, onSelectPlayer, injuries,
  contracts, capSettings, standings, onRelease, onTradeAway, schedule,
  onOpenCoachMarket, onHireCoach, coachCandidates,
  retiredPlayers, onRetireJersey, onUnretireJersey, franchiseHistory, currentChampion, currentSeason, canEditIdentity, onIdentityChange,
}: Props) {
  const [retireNumber, setRetireNumber] = useState('');
  const [retirePlayerId, setRetirePlayerId] = useState('');
  const [teamId, setTeamId] = useState(initialTeamId ?? teams[0]?.teamId ?? '');
  const team = teams.find((t) => t.teamId === teamId) ?? teams[0];
  const form = useMemo(() => schedule && team ? recentForm(schedule, team.teamId, id => perGameAverages(team.seasons.find(p => p.playerId === id)?.seasonStats).ppg) : null, [schedule, team]);
  const canManage = !!team && canEditIdentity?.(team.teamId) === true;
  const leader = team ? teamLeader(team) : null;
  const rotation = team ? effectiveRotation(team) : {};
  const coach = team?.coachIdentity;

  return (
    <div className="roster-page">
      <div className="roster-controls">
        <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
          {teams.map((t) => <option key={t.teamId} value={t.teamId}>{t.name}</option>)}
        </select>
        {onRunDevelopmentPass && <button onClick={onRunDevelopmentPass} title="Ages every player in the league by one season">
          Run Offseason Development Pass (all teams)
        </button>}
      </div>

      {team && <TeamIdentityPanel key={team.teamId} team={team} history={franchiseHistory} currentChampion={currentChampion} currentSeason={currentSeason}
        onChange={onIdentityChange && canEditIdentity?.(team.teamId) ? identity => onIdentityChange(team.teamId, identity) : undefined} />}
      {team && (
        <div className="roster-team-summary">
          {(() => {
            const record = standings?.find((r) => r.teamId === team.teamId);
            const games = record ? record.wins + record.losses : 0;
            const rating = Math.round(team.seasons.reduce((s, p) => s + calculateOverall(p), 0) / Math.max(1, team.seasons.length));
            const avgAge = team.seasons.reduce((s, p) => s + p.age, 0) / Math.max(1, team.seasons.length);
            const payroll = contracts ? Object.values(contracts).filter((c) => c.teamId === team.teamId).reduce((s, c) => s + c.annualSalary, 0) : 0;
            const mov = record && games > 0 ? record.pointDiff / games : 0;
            return (
              <>
                <span><strong>Record:</strong> {record ? `${record.wins}-${record.losses}` : '0-0'}</span>
                <span><strong>MOV:</strong> {mov >= 0 ? '+' : ''}{mov.toFixed(1)}</span>
                <span><strong>Team rating:</strong> {rating}/100</span>
                <span><strong>Avg age:</strong> {avgAge.toFixed(1)}</span>
                <span><strong>Open spots:</strong> {Math.max(0, 15 - team.seasons.length)}</span>
                {contracts && <span><strong>Payroll:</strong> ${(payroll / 1_000_000).toFixed(1)}M</span>}
                {capSettings && <span><strong>Cap:</strong> ${(capSettings.salaryCap / 1_000_000).toFixed(1)}M</span>}
              </>
            );
          })()}
        </div>
      )}

      {team && (
        <div className="retired-jerseys-panel">
          <h5 className="stats-subheading">Retired Numbers</h5>
          <div className="retired-jerseys-list">
            {(team.retiredJerseys ?? []).length === 0 ? (
              <span className="hint-text">No retired numbers yet.</span>
            ) : (team.retiredJerseys ?? []).map((j) => (
              <div key={j.number} className="retired-jersey-banner">
                <span className="retired-jersey-number">{j.number}</span>
                <span className="award-team-player" onClick={() => onSelectPlayer?.(j.playerId)}>
                  <PlayerNameTag playerId={j.playerId} teamId={team.teamId} jerseyNumber={j.number} size={20} />
                </span>
                <span className="hint-text">{formatSeasonYear(j.season)}</span>
                {canManage && onUnretireJersey && <button onClick={() => onUnretireJersey(team.teamId, j.number)}>Undo</button>}
              </div>
            ))}
          </div>
          {canManage && onRetireJersey && (
            <details className="retire-form"><summary>Retire a number</summary><div className="identity-grid">
              <label>
                Player
                <select value={retirePlayerId} onChange={(e) => {
                  const id = e.target.value;
                  setRetirePlayerId(id);
                  // Fill in the number he wore, when the save knows it.
                  const worn = team.seasons.find(x => x.playerId === id)?.jerseyNumber;
                  if (worn != null) setRetireNumber(String(worn));
                }}>
                  <option value="">— choose —</option>
                  {team.seasons.map((s) => <option key={s.playerId} value={s.playerId}>{s.playerId} (current)</option>)}
                  {(retiredPlayers ?? []).filter((r) => r.finalTeamId === team.teamId).map((r) => (
                    <option key={r.playerId} value={r.playerId}>{r.playerId} (retired)</option>
                  ))}
                </select>
              </label>
              <label>Number<input type="number" min={0} max={99} value={retireNumber} onChange={(e) => setRetireNumber(e.target.value)} /></label>
              <button
                className="primary"
                disabled={!retirePlayerId || retireNumber === ''}
                onClick={() => { onRetireJersey(team.teamId, Number(retireNumber), retirePlayerId); setRetireNumber(''); setRetirePlayerId(''); }}
              >
                Retire Number
              </button>
            </div></details>
          )}
        </div>
      )}

      {team && (
        <div className="coach-panel">
          {coach ? (
            <>
              <div className="coach-panel-main">
                <span className="coach-card-name">Head Coach: {coach.coachId}</span>
                <span className="hint-text">
                  Rating {coach.rating} · Age {coach.age} · Career {coach.careerWins}-{coach.careerLosses}
                  {coach.championships > 0 && ` · ${coach.championships}x champion`} ·{' '}
                  ${(coach.contract.annualSalary / 1_000_000).toFixed(1)}M/yr, {plural(coach.contract.yearsRemaining, 'year')} left ·{' '}
                  Hired {formatSeasonYear(coach.hiredSeason)}
                </span>
                <div className="coach-tags">
                  {coachStrengths(coach).map((k) => (
                    <span key={k} className="coach-tag coach-tag-strength">+ {COACH_TRAIT_LABELS[k]}</span>
                  ))}
                  {coachWeaknesses(coach).map((k) => (
                    <span key={k} className="coach-tag coach-tag-weakness">− {COACH_TRAIT_LABELS[k]}</span>
                  ))}
                  {coachStrengths(coach).length === 0 && coachWeaknesses(coach).length === 0 && (
                    <span className="hint-text">A well-rounded coach with no standout strengths or weaknesses.</span>
                  )}
                </div>
              </div>
              <div className="coach-traits">
                {(Object.keys(coach.traits) as CoachTraitKey[]).map((k) => (
                  <div key={k} className="coach-trait-row">
                    <span className="coach-trait-label">{COACH_TRAIT_LABELS[k]}</span>
                    <span className="coach-trait-bar">
                      <span className="coach-trait-fill" style={{ width: `${coach.traits[k]}%` }} />
                    </span>
                    <span className="coach-trait-value">{coach.traits[k]}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <span className="hint-text">No head coach on file for this team.</span>
          )}
          <div className="coach-panel-actions">
            {canManage && onOpenCoachMarket && <button onClick={() => onOpenCoachMarket(team.teamId)}>{coach ? 'Fire & Hire New Coach' : 'Hire Coach'}</button>}
          </div>
        </div>
      )}

      {canManage && coachCandidates && coachCandidates.length > 0 && team && (
        <div className="coach-market">
          <h5 className="stats-subheading">Available Coaches</h5>
          <div className="coach-market-grid">
            {coachCandidates.map((cand) => (
              <div key={cand.coachId} className="coach-candidate-card">
                <span className="coach-card-name">{cand.coachId}</span>
                <span className="hint-text">Rating {cand.rating} · Age {cand.age} · ${(cand.contract.annualSalary / 1_000_000).toFixed(1)}M/yr</span>
                <div className="coach-tags">
                  {coachStrengths(cand).map((k) => <span key={k} className="coach-tag coach-tag-strength">+ {COACH_TRAIT_LABELS[k]}</span>)}
                  {coachWeaknesses(cand).map((k) => <span key={k} className="coach-tag coach-tag-weakness">− {COACH_TRAIT_LABELS[k]}</span>)}
                </div>
                <button className="primary" disabled={!canManage} onClick={() => onHireCoach?.(team.teamId, cand)}>Hire</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="hint-text">
        The Delta column shows the Overall change from the last development pass (blank until you
        run one). Young players below their Peak Age grow toward Potential; players at/past Peak
        Age decline. PPG/RPG/APG/MPG and EFF reflect this season's games so far. The{' '}
        <StarIcon className="inline-star" /> marks the team leader (highest Overall); an injured
        player's name is followed by a <strong>+</strong> and the Status column shows days remaining.
      </p>

      {team && <LockerRoomPanel team={team} />}
      {team && (
        <table className="db-table roster-table">
          <thead>
            <tr>
              <th>Player</th><th>Role</th><th>Pos</th><th>Age</th><th>OVR</th><th>POT</th><th>Delta</th>
              <th>Contract</th><th>YWT</th>{showTradeValues && <th>Trade Value</th>}
              <th>PPG</th>{schedule && <th title="Points in the last five games">Form</th>}<th>RPG</th><th>APG</th><th>MPG</th><th>EFF</th><th>Mood</th><th>Status</th>
              {canManage && (onRelease || onTradeAway) && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {[...team.seasons]
              .sort((a, b) => calculateOverall(b) - calculateOverall(a))
              .map((s) => {
                const overall = calculateOverall(s);
                const delta = s.previousOverall != null ? overall - s.previousOverall : null;
                const injury = injuries?.[s.playerId];
                const isInjured = !!injury && injury.gamesRemaining > 0;
                const avg = perGameAverages(s.seasonStats);
                const isLeader = leader?.playerId === s.playerId;
                const contract = contracts?.[s.playerId];
                const yearsWithTeam = countYearsWithTeam(s, team.teamId);
                return (
                  <tr key={s.playerId}>
                    <td onClick={() => onSelectPlayer?.(s.playerId)} style={onSelectPlayer ? { cursor: 'pointer' } : undefined}>
                      {isLeader && <StarIcon className="inline-star" />}
                      <PlayerNameTag playerId={s.playerId} teamId={s.teamId} jerseyNumber={s.jerseyNumber} size={24} />
                      {isInjured && <span className="injury-plus">+</span>}
                    </td>
                    <td>{rotation[s.playerId] === 'starter' ? 'Starter' : 'Bench'}</td>
                    <td>{primaryPosition(s)}</td>
                    <td>{s.age}</td>
                    <td>{overall}</td>
                    <td>{s.development.potential.toFixed(0)}</td>
                    <td className={delta == null ? '' : delta > 0 ? 'delta-up' : delta < 0 ? 'delta-down' : ''}>
                      {delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta}`}
                    </td>
                    <td className="roster-contract">
                      {contract ? `$${(contract.annualSalary / 1_000_000).toFixed(2)}M · ${contract.yearsRemaining}y` : '—'}
                    </td>
                    <td>{yearsWithTeam}</td>
                    {showTradeValues && <td>{computeTradeValue(s).toFixed(0)}</td>}
                    <td>{avg.gamesPlayed > 0 ? stat1(avg.ppg) : '—'}</td>
                    {schedule && <td><FormCell form={form?.get(s.playerId)} /></td>}
                    <td>{avg.gamesPlayed > 0 ? stat1(avg.rpg) : '—'}</td>
                    <td>{avg.gamesPlayed > 0 ? stat1(avg.apg) : '—'}</td>
                    <td>{avg.gamesPlayed > 0 ? stat1(avg.mpg) : '—'}</td>
                    <td>{avg.gamesPlayed > 0 ? stat1(avg.efficiency) : '—'}</td>
                    <MoraleCell p={s} fallback={relationshipLabel(relationshipWith(coach, s.playerId))} fallbackTitle={`Relationship with coach: ${Math.round(relationshipWith(coach, s.playerId))}/100`} />
                    <td>{isInjured ? <span className="injury-out-tag">{injury!.gamesRemaining}d</span> : ''}</td>
                    {canManage && (onRelease || onTradeAway) && (
                      <td className="roster-actions">
                        {canManage && onRelease && <button onClick={() => onRelease(team.teamId, s.playerId)}>Release</button>}
                        {canManage && onTradeAway && <button onClick={() => onTradeAway(s.playerId)}>Trade away</button>}
                      </td>
                    )}
                  </tr>
                );
              })}
          </tbody>
        </table>
      )}
      {team && <ChemistryWeb team={team} onSelectPlayer={onSelectPlayer} />}
    </div>
  );
}

/** How many seasons this player's history shows them joining/being on this same team, minimum 1. */
function countYearsWithTeam(season: PlayerSeason, teamId: string): number {
  const joinEvents = (season.history ?? []).filter((e) => e.teamId === teamId && (e.type === 'signed' || e.type === 'drafted' || e.type === 'traded' || e.type === 'moved'));
  if (joinEvents.length === 0) return 1;
  const joinSeason = joinEvents[joinEvents.length - 1].season;
  const joinYear = parseInt(joinSeason.slice(0, 4), 10);
  const nowYear = parseInt(season.season.slice(0, 4), 10);
  if (Number.isNaN(joinYear) || Number.isNaN(nowYear)) return 1;
  return Math.max(1, nowYear - joinYear + 1);
}

