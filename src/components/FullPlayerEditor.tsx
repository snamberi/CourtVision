import { PixelIcon } from './PixelIcon';
import { plural } from '../lib/humanize';
import { TeamLink } from './TeamLink';
import { useState } from 'react';
import type { PlayerSeason } from '../simulation/types';
import { AttributeGroupEditor } from './AttributeGroupEditor';
import { RatingSlider } from './RatingSlider';
import { OFFENSE_HINTS, DEFENSE_HINTS, ROLE_HINTS } from '../simulation/hints';
import { NORMAL_BADGES, EXPERIMENTAL_BADGES } from '../simulation/badges';
import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import { renamePlayer, movePlayerToTeam, updateContractDirect } from '../simulation/gm';
import { perGameAverages } from '../simulation/careerStats';
import { AppearancePanel } from './AppearancePanel';
import { PlayerAvatar } from './PlayerAvatar';
import { calculateOverall } from '../simulation/engine/overall';
import { primaryPosition } from '../simulation/teamStatus';
import { statWhole, pctWhole } from './statFormat';

interface Props {
  season: PlayerSeason;
  onChange: (next: PlayerSeason) => void;
  sandboxMode: boolean;
  /** Optional — when provided, unlocks the Identity & Contract panel (name/draft/team/contract editing). */
  league?: League;
  extras?: GMLeagueExtras;
  onLeagueExtrasChange?: (league: League, extras: GMLeagueExtras, newPlayerId?: string) => void;
}

type Category = 'look' | 'identity' | 'physical' | 'offense' | 'defense' | 'mental' | 'shotTendencies' | 'passingTendencies'
  | 'drivingTendencies' | 'roles' | 'minutes' | 'development' | 'badges' | 'overall';

const CATEGORY_LABELS: Record<Category, string> = {
  look: 'Look',
  identity: 'Identity & Contract',
  physical: 'Physical',
  offense: 'Offense',
  defense: 'Defense',
  mental: 'Mental',
  shotTendencies: 'Shot Tendencies',
  passingTendencies: 'Passing Tendencies',
  drivingTendencies: 'Driving Tendencies',
  roles: 'Roles',
  minutes: 'Minutes',
  development: 'Development',
  badges: 'Badges',
  overall: 'Overall',
};

function inchesToFeetInches(inches: number): string {
  const ft = Math.floor(inches / 12);
  const inch = Math.round(inches % 12);
  return `${ft}'${inch}"`;
}

export function FullPlayerEditor({ season, onChange, sandboxMode, league, extras, onLeagueExtrasChange }: Props) {
  const [open, setOpen] = useState<Record<Category, boolean>>({
    look: false, identity: true, physical: true, offense: true, defense: false, mental: false, shotTendencies: false,
    passingTendencies: false, drivingTendencies: false, roles: false, minutes: true,
    development: false, badges: false, overall: false,
  });
  const max = sandboxMode ? 200 : 99;
  const update = (patch: Partial<PlayerSeason>) => onChange({ ...season, ...patch });
  const toggle = (c: Category) => setOpen((o) => ({ ...o, [c]: !o[c] }));

  const positionSum = season.positions;
  const avg = perGameAverages(season.seasonStats);
  const overall = calculateOverall(season);
  const pos = primaryPosition(season);

  return (
    <div className="editor-panel full-editor">
      <h3>{season.playerId} — Player Editor</h3>

      <div className="player-editor-stats-panel">
        <div className="player-editor-stats-header">
          <PlayerAvatar playerId={season.playerId} teamId={season.teamId} jerseyNumber={season.jerseyNumber} heightInches={season.attributes.physical.heightInches} age={season.age} mode="portrait" size={56} />
          <span className="badge-chip">{pos}</span>
          <span className="badge-chip">Age {season.age}</span>
          <span className="badge-chip">OVR {overall}</span>
          <span className="badge-chip">POT {season.development.potential.toFixed(0)}</span>
          <span className="hint-text">{plural(avg.gamesPlayed, 'game')} played this season</span>
        </div>
        {avg.gamesPlayed > 0 ? (
          <div className="finances-table-wrap">
            <table className="db-table stat-line-table">
              <thead>
                <tr>
                  <th>MPG</th><th>PPG</th><th>RPG</th><th>APG</th><th>SPG</th><th>BPG</th><th>TOV</th>
                  <th>FG%</th><th>3P%</th><th>FT%</th><th>TS%</th><th>EFF</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{statWhole(avg.mpg)}</td>
                  <td>{statWhole(avg.ppg)}</td>
                  <td>{statWhole(avg.rpg)}</td>
                  <td>{statWhole(avg.apg)}</td>
                  <td>{statWhole(avg.spg)}</td>
                  <td>{statWhole(avg.bpg)}</td>
                  <td>{statWhole(avg.tovPg)}</td>
                  <td>{pctWhole(avg.fgPct)}%</td>
                  <td>{pctWhole(avg.tpPct)}%</td>
                  <td>{pctWhole(avg.ftPct)}%</td>
                  <td>{pctWhole(avg.tsPct)}%</td>
                  <td>{statWhole(avg.efficiency)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="hint-text">No games played yet this season — stats will appear here once they've taken the floor.</p>
        )}
      </div>

      <Collapsible title={CATEGORY_LABELS.look} isOpen={open.look} onToggle={() => toggle('look')}>
        <AppearancePanel key={season.playerId} season={season} onChange={onChange} />
      </Collapsible>

      {league && extras && onLeagueExtrasChange && (
        <Collapsible title={CATEGORY_LABELS.identity} isOpen={open.identity} onToggle={() => toggle('identity')}>
          <IdentityContractPanel season={season} onChange={onChange} league={league} extras={extras} sandboxMode={sandboxMode} onLeagueExtrasChange={onLeagueExtrasChange} />
        </Collapsible>
      )}

      <Collapsible title={CATEGORY_LABELS.physical} isOpen={open.physical} onToggle={() => toggle('physical')}>
        {!sandboxMode && <LockedNotice />}
        <div className={`rating-row${sandboxMode ? '' : ' locked'}`}>
          <span className="rating-label">Height</span>
          <input
            type="range" min={60} max={96} value={season.attributes.physical.heightInches} disabled={!sandboxMode}
            onChange={(e) => update({ attributes: { ...season.attributes, physical: { ...season.attributes.physical, heightInches: Number(e.target.value) } } })}
          />
          <span className="rating-number">{inchesToFeetInches(season.attributes.physical.heightInches)}</span>
        </div>
        <AttributeGroupEditor
          title="" max={max} disabled={!sandboxMode} excludeKeys={['heightInches', 'weightLbs', 'wingspanInches', 'standingReachInches']}
          values={season.attributes.physical as unknown as Record<string, number>}
          onChange={(k, v) => update({ attributes: { ...season.attributes, physical: { ...season.attributes.physical, [k]: v } } })}
        />
      </Collapsible>

      <Collapsible title={CATEGORY_LABELS.offense} isOpen={open.offense} onToggle={() => toggle('offense')}>
        {!sandboxMode && <LockedNotice />}
        <AttributeGroupEditor
          title="" max={max} disabled={!sandboxMode} hints={OFFENSE_HINTS}
          values={season.attributes.offense as unknown as Record<string, number>}
          onChange={(k, v) => update({ attributes: { ...season.attributes, offense: { ...season.attributes.offense, [k]: v } } })}
        />
      </Collapsible>

      <Collapsible title={CATEGORY_LABELS.defense} isOpen={open.defense} onToggle={() => toggle('defense')}>
        {!sandboxMode && <LockedNotice />}
        <AttributeGroupEditor
          title="" max={max} disabled={!sandboxMode} hints={DEFENSE_HINTS}
          values={season.attributes.defense as unknown as Record<string, number>}
          onChange={(k, v) => update({ attributes: { ...season.attributes, defense: { ...season.attributes.defense, [k]: v } } })}
        />
      </Collapsible>

      <Collapsible title={CATEGORY_LABELS.mental} isOpen={open.mental} onToggle={() => toggle('mental')}>
        {!sandboxMode && <LockedNotice />}
        <AttributeGroupEditor
          title="" max={max} disabled={!sandboxMode}
          values={season.attributes.mental as unknown as Record<string, number>}
          onChange={(k, v) => update({ attributes: { ...season.attributes, mental: { ...season.attributes.mental, [k]: v } } })}
        />
      </Collapsible>

      <Collapsible title="Positional Suitability" isOpen={false} onToggle={() => {}}>
        {(['PG', 'SG', 'SF', 'PF', 'C'] as const).map((pos) => (
          <RatingSlider
            key={pos} label={pos} max={100} value={positionSum[pos]}
            onChange={(v) => update({ positions: { ...season.positions, [pos]: v } })}
          />
        ))}
      </Collapsible>

      <Collapsible title={CATEGORY_LABELS.shotTendencies} isOpen={open.shotTendencies} onToggle={() => toggle('shotTendencies')}>
        <AttributeGroupEditor
          title="" max={sandboxMode ? 200 : 100}
          values={season.tendencies.shot as unknown as Record<string, number>}
          onChange={(k, v) => update({ tendencies: { ...season.tendencies, shot: { ...season.tendencies.shot, [k]: v } } })}
        />
        <RatingSlider
          label="Target 3PA (per game)" max={40} value={season.tendencies.threePointTargets?.target ?? 0}
          onChange={(v) => update({ tendencies: { ...season.tendencies, threePointTargets: { ...season.tendencies.threePointTargets, target: v } } })}
          hint="Explicit user override the engine must respect: desired three-point attempts per game."
        />
      </Collapsible>

      <Collapsible title={CATEGORY_LABELS.passingTendencies} isOpen={open.passingTendencies} onToggle={() => toggle('passingTendencies')}>
        <AttributeGroupEditor
          title="" max={100}
          values={season.tendencies.passing as unknown as Record<string, number>}
          onChange={(k, v) => update({ tendencies: { ...season.tendencies, passing: { ...season.tendencies.passing, [k]: v } } })}
        />
      </Collapsible>

      <Collapsible title={CATEGORY_LABELS.drivingTendencies} isOpen={open.drivingTendencies} onToggle={() => toggle('drivingTendencies')}>
        <AttributeGroupEditor
          title="" max={100}
          values={season.tendencies.driving as unknown as Record<string, number>}
          onChange={(k, v) => update({ tendencies: { ...season.tendencies, driving: { ...season.tendencies.driving, [k]: v } } })}
        />
      </Collapsible>

      <Collapsible title={CATEGORY_LABELS.roles} isOpen={open.roles} onToggle={() => toggle('roles')}>
        <AttributeGroupEditor
          title="" max={100} hints={ROLE_HINTS}
          values={season.tendencies.role as unknown as Record<string, number>}
          onChange={(k, v) => update({ tendencies: { ...season.tendencies, role: { ...season.tendencies.role, [k]: v } } })}
        />
        <RatingSlider
          label="Ball Dominance" max={100} value={season.tendencies.ballDominance} hint={ROLE_HINTS.ballDominance}
          onChange={(v) => update({ tendencies: { ...season.tendencies, ballDominance: v } })}
        />
        <label className="rating-row">
          <span className="rating-label">Ball Handler Priority</span>
          <input
            type="range" min={0} max={100} value={season.ballHandlerPriority}
            onChange={(e) => update({ ballHandlerPriority: Number(e.target.value) })}
          />
          <span className="rating-number">{season.ballHandlerPriority}</span>
        </label>
      </Collapsible>

      <Collapsible title={CATEGORY_LABELS.minutes} isOpen={open.minutes} onToggle={() => toggle('minutes')}>
        <label className="rating-row">
          <span className="rating-label">Mode</span>
          <select
            value={season.minutes.mode}
            onChange={(e) => update({ minutes: { ...season.minutes, mode: e.target.value as PlayerSeason['minutes']['mode'] } })}
          >
            <option value="AI">AI</option>
            <option value="TARGET">Target</option>
            <option value="EXACT">Exact</option>
            <option value="MANUAL">Manual</option>
          </select>
        </label>
        <RatingSlider label="Target Minutes" max={48} value={season.minutes.target} onChange={(v) => update({ minutes: { ...season.minutes, target: v } })} />
        {season.minutes.mode === 'EXACT' && (
          <div className="rating-row">
            <span className="rating-label">Per-Quarter (Q1-Q4)</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {[0, 1, 2, 3].map((qi) => (
                <input
                  key={qi} type="number" min={0} max={15} className="rating-number"
                  value={season.minutes.perQuarter?.[qi] ?? 0}
                  onChange={(e) => {
                    const pq = [...(season.minutes.perQuarter ?? [0, 0, 0, 0])] as [number, number, number, number];
                    pq[qi] = Number(e.target.value);
                    update({ minutes: { ...season.minutes, perQuarter: pq } });
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </Collapsible>

      <Collapsible title={CATEGORY_LABELS.development} isOpen={open.development} onToggle={() => toggle('development')}>
        {!sandboxMode && <LockedNotice />}
        <AttributeGroupEditor
          title="" max={sandboxMode ? 200 : 99} disabled={!sandboxMode}
          values={season.development as unknown as Record<string, number>}
          onChange={(k, v) => update({ development: { ...season.development, [k]: v } })}
        />
      </Collapsible>

      <Collapsible title={CATEGORY_LABELS.badges} isOpen={open.badges} onToggle={() => toggle('badges')}>
        {!sandboxMode && <p className="hint-text">Badges are generated with the player. Enable Sandbox Mode to change them.</p>}
        <h5>Normal</h5>
        <div className="badge-grid">
          {NORMAL_BADGES.map((b) => (
            <label key={b.id} className="badge-chip" title={b.description}>
              <input
                type="checkbox"
                disabled={!sandboxMode}
                checked={season.badges.includes(b.id)}
                onChange={(e) => { if (sandboxMode) update({ badges: toggleBadge(season.badges, b.id, e.target.checked) }); }}
              />
              {b.name}
            </label>
          ))}
        </div>
        <h5>Experimental {!sandboxMode && <span className="hint-text">(sandbox mode only)</span>}</h5>
        <div className="badge-grid">
          {EXPERIMENTAL_BADGES.map((b) => (
            <label key={b.id} className="badge-chip experimental" title={b.description}>
              <input
                type="checkbox"
                disabled={!sandboxMode}
                checked={season.badges.includes(b.id)}
                onChange={(e) => { if (sandboxMode) update({ badges: toggleBadge(season.badges, b.id, e.target.checked) }); }}
              />
              {b.name}
            </label>
          ))}
        </div>
      </Collapsible>

      <Collapsible title={CATEGORY_LABELS.overall} isOpen={open.overall} onToggle={() => toggle('overall')}>
        <label className="rating-row">
          <span className="rating-label">Mode</span>
          <select
            value={season.overall.mode}
            onChange={(e) => update({ overall: { ...season.overall, mode: e.target.value as 'AUTO' | 'MANUAL' } })}
          >
            <option value="AUTO">Auto (computed)</option>
            <option value="MANUAL">Manual override</option>
          </select>
        </label>
        {season.overall.mode === 'MANUAL' && (
          <>
            {!sandboxMode && <LockedNotice />}
            <RatingSlider
              label="Manual Overall" max={max} value={season.overall.manualOverall ?? 75} disabled={!sandboxMode}
              onChange={(v) => update({ overall: { ...season.overall, manualOverall: v } })}
            />
          </>
        )}
        <p className="hint-text">Overall is a summary display only — it never drives the simulation directly.</p>
      </Collapsible>
    </div>
  );
}

/** Season label + N years remaining → the single display year the contract runs through (rough label, not calendar-precise, just for display). */
function seasonPlusYears(seasonLabel: string | undefined, years: number): string {
  if (!seasonLabel) return '—';
  const startYear = parseInt(seasonLabel.slice(0, 4), 10);
  if (Number.isNaN(startYear)) return '—';
  return `${startYear + Math.max(0, years - 1)}`;
}

function IdentityContractPanel({ season, onChange, league, extras, sandboxMode, onLeagueExtrasChange }: {
  season: PlayerSeason; onChange: (next: PlayerSeason) => void; league: League; extras: GMLeagueExtras; sandboxMode: boolean;
  onLeagueExtrasChange: (league: League, extras: GMLeagueExtras, newPlayerId?: string) => void;
}) {
  const [firstName, setFirstName] = useState(season.firstName ?? season.playerId.split(' ')[0] ?? '');
  const [lastName, setLastName] = useState(season.lastName ?? season.playerId.split(' ').slice(1).join(' ') ?? '');
  const [moveToTeamId, setMoveToTeamId] = useState(season.teamId ?? '');
  const contract = extras.contracts[season.playerId];
  const [salary, setSalary] = useState(contract ? contract.annualSalary : 1_000_000);
  const [years, setYears] = useState(contract ? contract.yearsRemaining : 1);
  const [playerOption, setPlayerOption] = useState(contract?.playerOption ?? false);
  const [teamOption, setTeamOption] = useState(contract?.teamOption ?? false);
  const [renameError, setRenameError] = useState<string | null>(null);

  if (!sandboxMode) {
    return <p className="locked-notice"><PixelIcon name="lock" /> Identity, draft info, team, and contract editing require Sandbox Mode. Enable it in navigation.</p>;
  }

  const update = (patch: Partial<PlayerSeason>) => onChange({ ...season, ...patch });
  const currentTeamName = league.teams.find((t) => t.teamId === season.teamId)?.name ?? 'Free Agent';

  return (
    <div className="identity-contract-panel">
      <h5 className="stats-subheading">Name</h5>
      <div className="identity-grid">
        <label>First Name<input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} /></label>
        <label>Last Name<input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} /></label>
        <button
          className="primary"
          onClick={() => {
            const result = renamePlayer(league, extras, season.playerId, firstName, lastName);
            setRenameError(result.error ?? null);
            if (!result.error) onLeagueExtrasChange(result.league, result.extras, result.newPlayerId);
          }}
        >
          Save Name
        </button>
      </div>
      {renameError && <p className="locked-notice" role="alert">{renameError}</p>}

      <h5 className="stats-subheading">Biographical</h5>
      <div className="identity-grid">
        <label>Age<input type="number" min={16} max={50} value={season.age} onChange={(e) => update({ age: Number(e.target.value) })} /></label>
        <label>Jersey #<input type="number" min={0} max={99} value={season.jerseyNumber ?? ''} onChange={(e) => update({ jerseyNumber: Number(e.target.value) })} /></label>
        <label>College<input type="text" value={season.college ?? ''} placeholder="e.g. Duke" onChange={(e) => update({ college: e.target.value })} /></label>
        <label>Nationality<input type="text" value={season.nationality ?? ''} placeholder="e.g. USA" onChange={(e) => update({ nationality: e.target.value })} /></label>
      </div>

      <h5 className="stats-subheading">Draft</h5>
      <div className="identity-grid">
        <label>Draft Year<input type="text" value={season.draftYear ?? ''} placeholder="Undrafted" onChange={(e) => update({ draftYear: e.target.value || null })} /></label>
        <label>Round<input type="number" min={1} max={2} value={season.draftRound ?? ''} onChange={(e) => update({ draftRound: e.target.value ? Number(e.target.value) : null })} /></label>
        <label>Pick #<input type="number" min={1} max={60} value={season.draftPick ?? ''} onChange={(e) => update({ draftPick: e.target.value ? Number(e.target.value) : null })} /></label>
        <label>
          Draft Team
          <select value={season.draftTeamId ?? ''} onChange={(e) => update({ draftTeamId: e.target.value || null })}>
            <option value="">— None —</option>
            {league.teams.map((t) => <option key={t.teamId} value={t.teamId}>{t.name}</option>)}
          </select>
        </label>
      </div>

      <h5 className="stats-subheading">Team</h5>
      <div className="identity-grid">
        <span className="hint-text">Currently: <TeamLink name={currentTeamName} /></span>
        <label>
          Move to
          <select value={moveToTeamId} onChange={(e) => setMoveToTeamId(e.target.value)}>
            {league.teams.map((t) => <option key={t.teamId} value={t.teamId}>{t.name}</option>)}
          </select>
        </label>
        <button
          onClick={() => {
            const result = movePlayerToTeam(league, extras, season.playerId, moveToTeamId);
            onLeagueExtrasChange(result.league, result.extras);
          }}
          disabled={moveToTeamId === season.teamId}
        >
          Move Player
        </button>
      </div>

      <h5 className="stats-subheading">Contract</h5>
      {contract ? (
        <div className="identity-grid">
          <label>Annual Salary ($)<input type="number" step={100000} min={0} value={salary} onChange={(e) => setSalary(Number(e.target.value))} /></label>
          <label>Years Remaining<input type="number" min={0} max={10} value={years} onChange={(e) => setYears(Number(e.target.value))} /></label>
          <span className="hint-text">Ends after: {seasonPlusYears(league.season, years)}</span>
          <label className="checkbox-label"><input type="checkbox" checked={playerOption} onChange={(e) => setPlayerOption(e.target.checked)} /> Player Option</label>
          <label className="checkbox-label"><input type="checkbox" checked={teamOption} onChange={(e) => setTeamOption(e.target.checked)} /> Team Option</label>
          <button
            className="primary"
            onClick={() => {
              const result = updateContractDirect(league, extras, season.playerId, { annualSalary: salary, yearsRemaining: years, playerOption, teamOption });
              onLeagueExtrasChange(result.league, result.extras);
            }}
          >
            Save Contract
          </button>
        </div>
      ) : (
        <p className="hint-text">No active contract (free agent, or not yet on a roster).</p>
      )}
    </div>
  );
}

function LockedNotice() {
  return (
    <p className="locked-notice">
      <PixelIcon name="lock" /> Actual ratings are locked outside Sandbox Mode. Enable Sandbox Mode in navigation to
      edit them directly — in Realistic mode, players develop only through simulated games
      (or Code Mode, for testing). Tendencies, roles, and minutes below remain editable either way.
    </p>
  );
}

function Collapsible({ title, isOpen, onToggle, children }: { title: string; isOpen: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <section className="collapsible">
      <button type="button" className="collapsible-header" onClick={onToggle}>
        <span><span className={isOpen ? "pixel-chevron expanded" : "pixel-chevron"}><PixelIcon name="play" size={14} /></span> {title}</span>
      </button>
      {isOpen && <div className="collapsible-body">{children}</div>}
    </section>
  );
}

function toggleBadge(arr: string[], id: string, on: boolean) {
  return on ? [...new Set([...arr, id])] : arr.filter((b) => b !== id);
}
