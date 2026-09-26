import { useMemo, useState } from 'react';
import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import { RNG } from '../simulation/engine/rng';
import { calculateOverall } from '../simulation/engine/overall';
import { primaryPosition } from '../simulation/teamStatus';
import { prepareExpansionDraft, pickBlocked, autoPick, completeExpansionDraft, type ExpansionSetup } from '../simulation/expansionDraft';
import { TeamLogo } from './TeamLogo';
import { PlayerAvatar } from './PlayerAvatar';

interface Props {
  league: League;
  extras: GMLeagueExtras;
  onDone: (league: League, extras: GMLeagueExtras, teamId: string) => void;
}

const money = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;
type Sort = 'value' | 'ovr' | 'pot' | 'age' | 'salary';

/**
 * Create-a-team expansion draft, in the real order: name the club, watch every team file its protection list, then
 * make the picks yourself from the exposed players (or let the scouts auto-pick the rest).
 */
export function ExpansionDraftBoard({ league, extras, onDone }: Props) {
  const [step, setStep] = useState<'setup' | 'protect' | 'draft'>('setup');
  const [name, setName] = useState('Expansion Squad');
  const [rosterSize, setRosterSize] = useState(14);
  const [protectCount, setProtectCount] = useState(8);
  const [setup, setSetup] = useState<ExpansionSetup | null>(null);
  const [picks, setPicks] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [position, setPosition] = useState('All');
  const [sort, setSort] = useState<Sort>('value');
  const [openTeam, setOpenTeam] = useState<string | null>(null);
  const teamName = (id: string) => league.teams.find(t => t.teamId === id)?.name ?? id;
  const byId = useMemo(() => new Map(setup?.pool.map(e => [e.player.playerId, e]) ?? []), [setup]);

  const start = () => {
    const s = prepareExpansionDraft(league, extras, name.trim() || 'Expansion Squad', rosterSize, protectCount, Date.now() % 100000);
    if (league.teams.some(t => t.teamId === s.newTeamId)) { setMessage('A team with that name already exists.'); return; }
    setSetup(s); setPicks([]); setMessage(null); setStep('protect');
  };

  if (step === 'setup') return <div className="expansion-setup">
    <label>Team name <input className="year-input" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Team name" /></label>
    <label>Roster size <b>{rosterSize}</b><input type="range" min={10} max={15} value={rosterSize} onChange={e => setRosterSize(Number(e.target.value))} /></label>
    <label>Players each team protects <b>{protectCount}</b><input type="range" min={5} max={11} value={protectCount} onChange={e => setProtectCount(Number(e.target.value))} /></label>
    <p className="hint-text">Fewer protected players means a stronger pool for you. Each team loses at most {Math.max(1, Math.ceil(rosterSize / Math.max(1, league.teams.length)))} player{Math.ceil(rosterSize / Math.max(1, league.teams.length)) === 1 ? '' : 's'} to you.</p>
    {message && <p className="hint-text" role="alert">{message}</p>}
    <button className="primary menu-start" onClick={start}>Collect the protection lists ▶</button>
  </div>;

  if (!setup) return null;

  if (step === 'protect') return <div className="expansion-protect">
    <h3>Protection lists</h3>
    <p className="hint-text">Every team has protected {setup.protectCount} players. Young players with upside are protected first; older, expensive contracts are often left exposed. Open a team to see its list.</p>
    <div className="expansion-team-grid">{league.teams.map(t => {
      const kept = setup.protectedIds[t.teamId] ?? [];
      const exposed = setup.pool.filter(e => e.fromTeamId === t.teamId);
      const open = openTeam === t.teamId;
      return <article key={t.teamId} className={`expansion-team${open ? ' open' : ''}`}>
        <button className="expansion-team-head" onClick={() => setOpenTeam(open ? null : t.teamId)} aria-expanded={open}>
          <TeamLogo team={t} size={28} /><span>{t.name}</span><small>{kept.length} protected · {exposed.length} exposed</small>
        </button>
        {open && <div className="expansion-lists">
          <div><h5>Protected</h5><ul>{kept.map(id => { const p = t.seasons.find(s => s.playerId === id)!; return <li key={id}>🔒 {id} <small>{calculateOverall(p)} OVR · {p.age}</small></li>; })}</ul></div>
          <div><h5>Exposed</h5><ul>{exposed.map(e => <li key={e.player.playerId}>{e.player.playerId} <small>{e.overall} OVR · {e.player.age}</small></li>)}</ul></div>
        </div>}
      </article>;
    })}</div>
    <div className="expansion-actions">
      <button onClick={() => setStep('setup')}>◀ Back</button>
      <button className="primary menu-start" onClick={() => setStep('draft')}>Open the draft ({setup.pool.length} exposed) ▶</button>
    </div>
  </div>;

  const positions = ['All', ...new Set(setup.pool.map(e => primaryPosition(e.player)))];
  const sortKey = (e: typeof setup.pool[number]) => sort === 'ovr' ? e.overall : sort === 'pot' ? Math.round(e.player.development?.potential ?? e.overall) : sort === 'age' ? -e.player.age : sort === 'salary' ? -(extras.contracts[e.player.playerId]?.annualSalary ?? 0) : e.value;
  const board = setup.pool.filter(e => !picks.includes(e.player.playerId) && (position === 'All' || primaryPosition(e.player) === position)).sort((a, b) => sortKey(b) - sortKey(a));
  const payroll = picks.reduce((n, id) => n + (extras.contracts[id]?.annualSalary ?? 3_000_000), 0);
  const draft = (id: string) => { const why = pickBlocked(setup, picks, id); if (why) { setMessage(why); return; } setMessage(null); setPicks([...picks, id]); };
  const autoRest = () => { const rng = new RNG(picks.length * 97 + 11); const next = [...picks]; for (;;) { const id = autoPick(setup, next, rng); if (!id || next.length >= setup.rosterSize) break; next.push(id); } setPicks(next); };
  const full = picks.length >= setup.rosterSize;
  const th = (key: Sort, label: string) => <th aria-sort={sort === key ? 'descending' : 'none'}><button className="link-button" onClick={() => setSort(key)}>{label}{sort === key ? ' ▼' : ''}</button></th>;

  return <div className="expansion-draft">
    <section className="expansion-board">
      <header><h3>Draft board</h3>
        <label>Position <select value={position} onChange={e => setPosition(e.target.value)}>{positions.map(p => <option key={p}>{p}</option>)}</select></label>
        <span className="hint-text">Max {setup.perTeamLimit} per team</span>
      </header>
      {message && <p className="hint-text" role="alert">{message}</p>}
      <div className="feature-table-scroll"><table className="db-table">
        <thead><tr><th className="col-name">Player</th><th>From</th><th>Pos</th>{th('age', 'Age')}{th('ovr', 'OVR')}{th('pot', 'POT')}{th('salary', 'Salary')}<th>Yrs</th>{th('value', 'Value')}<th /></tr></thead>
        <tbody>{board.map(e => { const c = extras.contracts[e.player.playerId], why = pickBlocked(setup, picks, e.player.playerId);
          return <tr key={e.player.playerId} className={why ? 'is-blocked' : ''}>
            <td className="col-name">{e.player.playerId}</td><td>{teamName(e.fromTeamId)}</td><td>{primaryPosition(e.player)}</td><td>{e.player.age}</td>
            <td>{e.overall}</td><td>{Math.round(e.player.development?.potential ?? e.overall)}</td><td>{c ? money(c.annualSalary) : '—'}</td><td>{c?.yearsRemaining ?? '—'}</td><td>{e.value.toFixed(0)}</td>
            <td><button className={why ? '' : 'primary'} disabled={!!why} title={why ?? 'Draft this player'} onClick={() => draft(e.player.playerId)}>Draft</button></td>
          </tr>; })}</tbody>
      </table></div>
    </section>
    <aside className="expansion-roster">
      <h3>{name}</h3>
      <p className="hint-text">{picks.length} of {setup.rosterSize} picked · payroll {money(payroll)}</p>
      <ol>{picks.map(id => { const e = byId.get(id)!; return <li key={id}>
        <PlayerAvatar playerId={id} jerseyNumber={e.player.jerseyNumber} age={e.player.age} size={26} />
        <span>{id}<small>{primaryPosition(e.player)} · {e.overall} OVR · from {teamName(e.fromTeamId)}</small></span>
        <button className="link-button" onClick={() => setPicks(picks.filter(p => p !== id))} aria-label={`Release ${id}`}>✕</button>
      </li>; })}</ol>
      <div className="expansion-actions">
        <button onClick={() => setStep('protect')}>◀ Lists</button>
        {!full && <button onClick={autoRest}>Auto-pick the rest</button>}
        <button className="primary menu-start" disabled={!full} onClick={() => { const r = completeExpansionDraft(league, extras, name.trim() || 'Expansion Squad', setup, picks); onDone(r.league, r.extras, setup.newTeamId); }}>
          {full ? 'Start with this team ▶' : `Pick ${setup.rosterSize - picks.length} more`}
        </button>
      </div>
    </aside>
  </div>;
}
