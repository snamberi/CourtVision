import { useState } from 'react';
import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import { seasonText } from '../history/realDevelopment';
import { DataCredits } from './DataCredits';
import { parseTeamNameLines, MAX_TEAM_NAME as MAX_NAME } from '../history/teamNames';

/** League Settings → League Rules: the historical league's cutoff, data version and the Real Player Development switch. */
export function HistoricalSettingsCard({ league, extras, onChange }: { league: League; extras: GMLeagueExtras; onChange: (update: (l: League) => League) => void }) {
  const meta = league.historical;
  if (!meta) return null;
  const players = [...league.teams.flatMap(t => t.seasons), ...extras.freeAgents].filter(p => p.real);
  const following = players.filter(p => !p.real!.fallbackSince && p.real!.appliedSeason === league.season).length;
  const fallback = players.filter(p => p.real!.fallbackSince).length;
  const set = (on: boolean) => onChange(l => (l.historical ? { ...l, historical: { ...l.historical, realDevelopment: on } } : l));
  return (
    <section className="settings-card">
      <h4>NBA history</h4>
      <p className="hint-text">
        Started at the opening of {seasonText(meta.startYear)}. Imported history: {meta.startYear > 1946 ? `1946–47 to ${seasonText(meta.startYear - 1)}` : 'none (first season)'}; from {seasonText(meta.startYear)} on, this league’s own results are the history.
        Reference data: {meta.dataset}.
      </p>
      <label className="trade-value-toggle">
        <input type="checkbox" checked={meta.realDevelopment} onChange={e => set(e.target.checked)} /> Real Player Development
      </label>
      <p className="hint-text">
        {meta.realDevelopment
          ? 'On: each real player’s ratings follow his real season-by-season reference (Court Vision’s own ratings computed from his statistics), applied once at every season rollover. Training, coaching, facilities and minutes cannot raise or lower their ratings; they still affect workload, recovery, morale and familiarity. Games, awards and results are still simulated. Fictional players develop normally.'
          : 'Off: real players develop through Court Vision’s team, coaching, training, minutes and aging systems, starting from their current ratings. Turning it back on resumes each real player’s reference trajectory at the next season rollover; current ratings, stats and records are kept.'}
      </p>
      <p className="hint-text">
        {players.length} real players in the league · {following} on their reference this season · {fallback} past the end of their real data (developing through Court Vision).
        Missed seasons between two reference points are interpolated and labelled. The data ends with {seasonText(meta.lastDataStartYear)}; after that, and after a player’s real career, Court Vision development, aging and retirement take over.
      </p>
      <TeamNamesEditor league={league} onChange={onChange} />
      <DataCredits />
      {meta.notes.length > 0 && (
        <details>
          <summary>Data notes and simulated components</summary>
          <ul className="hint-text">{meta.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </details>
      )}
    </section>
  );
}

/** Teams start with city names; players can type their own (including real team names) for this league. */
function TeamNamesEditor({ league, onChange }: { league: League; onChange: (update: (l: League) => League) => void }) {
  const cities = league.historical?.cityNames ?? {};
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(league.teams.map(t => [t.teamId, t.name])));
  const [paste, setPaste] = useState('');
  const [message, setMessage] = useState('');
  const apply = (names: Record<string, string>, note: string) => {
    const clean = Object.fromEntries(Object.entries(names).map(([id, n]) => [id, n.trim().slice(0, MAX_NAME)]).filter(([, n]) => n));
    onChange(l => ({ ...l, teams: l.teams.map(t => (clean[t.teamId] ? { ...t, name: clean[t.teamId] } : t)) }));
    setDraft(d => ({ ...d, ...clean }));
    setMessage(note);
  };
  return (
    <details className="team-names-editor">
      <summary>Team names</summary>
      <p className="hint-text">Teams use city names; official team names are not included. You can type any names you like, such as the real team names or your own, and they are saved with this league only. Past seasons keep the names they had.</p>
      <div className="stat-table-scroll"><table className="db-table">
        <thead><tr><th>Team</th><th className="col-name">City</th><th className="col-name">Name shown</th></tr></thead>
        <tbody>{league.teams.map(t => <tr key={t.teamId}>
          <td>{t.teamId}</td><td className="col-name">{cities[t.teamId] ?? '—'}</td>
          <td className="col-name"><input aria-label={`Name for ${t.teamId}`} maxLength={MAX_NAME} value={draft[t.teamId] ?? t.name} onChange={e => setDraft(d => ({ ...d, [t.teamId]: e.target.value }))} /></td>
        </tr>)}</tbody>
      </table></div>
      <div className="code-mode-actions">
        <button className="primary" onClick={() => apply(draft, 'Team names saved.')}>Save team names</button>
        <button onClick={() => apply(Object.fromEntries(league.teams.map(t => [t.teamId, cities[t.teamId] ?? t.name])), 'Team names reset to city names.')}>Reset to city names</button>
      </div>
      <label className="team-names-paste"><span>Paste names, one per line (for example <code>GSW = Your Team Name</code>)</span>
        <textarea rows={4} value={paste} onChange={e => setPaste(e.target.value)} aria-label="Paste team names" />
      </label>
      <button onClick={() => {
        const { names, rejected } = parseTeamNameLines(paste, league.teams.map(t => t.teamId));
        apply(names, `${Object.keys(names).length} team name${Object.keys(names).length === 1 ? '' : 's'} applied.${rejected.length ? ` Skipped ${rejected.length} line${rejected.length === 1 ? '' : 's'} with an unknown team code: ${rejected.slice(0, 3).join('; ')}${rejected.length > 3 ? '…' : ''}` : ''}`);
      }}>Apply pasted names</button>
      {message && <p className="hint-text" role="status">{message}</p>}
    </details>
  );
}
