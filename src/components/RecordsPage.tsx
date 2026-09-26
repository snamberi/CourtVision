import { useMemo, useState } from 'react';
import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import { computeRecords, type RecordEntry, type RecordFormat, type RecordGroup, type RecordResult } from '../simulation/records';
import { TeamLink } from './TeamLink';
import { formatSeasonYear } from '../simulation/calendar';
import { resolveTeamIdentity } from '../simulation/teamIdentity';

const GROUPS: RecordGroup[] = ['Single Game', 'Season', 'Career', 'Playoffs', 'Team', 'Awards'];
const fmt = (v: number, f: RecordFormat) => f === 'pct' ? `${(v * 100).toFixed(1)}%` : f === 'dec1' ? v.toFixed(1) : f === 'dec2' ? v.toFixed(2) : f === 'dec3' ? v.toFixed(3).replace(/^0/, '') : Math.round(v).toLocaleString();
const seasonLabel = (s: string) => /^\d{4}/.test(s) ? formatSeasonYear(s) : s;

function Holder({ e, onSelectPlayer, teamName, teamAbbr }: { e: RecordEntry; onSelectPlayer: (id: string) => void; teamName: (id?: string) => string | undefined; teamAbbr: (id?: string) => string | undefined }) {
  return <span className="record-holder">
    {e.playerId ? <button className="link-button" onClick={() => onSelectPlayer(e.playerId!)}>{e.playerId}</button> : <TeamLink teamId={e.teamId} name={teamName(e.teamId)} />}
    {(e.playerId && e.teamId || e.opponentId) && <small className="record-teams">{e.playerId && e.teamId && <TeamLink teamId={e.teamId} name={teamAbbr(e.teamId)} />}{e.opponentId && <> vs <TeamLink teamId={e.opponentId} name={teamAbbr(e.opponentId)} /></>}</small>}
  </span>;
}

function RecordCard({ r, onSelectPlayer, teamName, teamAbbr }: { r: RecordResult; onSelectPlayer: (id: string) => void; teamName: (id?: string) => string | undefined; teamAbbr: (id?: string) => string | undefined }) {
  const [first, ...rest] = r.entries;
  return <article className={`record-card${first ? '' : ' record-empty'}`}>
    <header><h5>{r.def.title}</h5>{r.def.qualifier && <small className="record-qualifier">{r.def.qualifier}</small>}</header>
    {first ? <>
      <div className="record-top"><b className="record-value">{fmt(first.value, r.def.format)}</b>
        <div><Holder e={first} onSelectPlayer={onSelectPlayer} teamName={teamName} teamAbbr={teamAbbr} /><small className="record-meta">{seasonLabel(first.season)}{first.detail ? ` · ${first.detail}` : ''}</small></div></div>
      {rest.length > 0 && <ol className="record-rest" start={2}>{rest.map((e, i) => <li key={i}><span className="record-rest-value">{fmt(e.value, r.def.format)}</span><Holder e={e} onSelectPlayer={onSelectPlayer} teamName={teamName} teamAbbr={teamAbbr} /><small className="record-meta">{seasonLabel(e.season)}</small></li>)}</ol>}
    </> : <p className="hint-text">No one has set this record yet.</p>}
  </article>;
}

export function RecordsPage({ league, extras, onSelectPlayer }: { league: League; extras?: GMLeagueExtras; onSelectPlayer: (id: string) => void }) {
  const [group, setGroup] = useState<RecordGroup>('Single Game');
  const [query, setQuery] = useState('');
  const records = useMemo(() => computeRecords(league, extras), [league, extras]);
  const teamNames = useMemo(() => new Map(league.teams.map(t => [t.teamId, t.name])), [league.teams]);
  const teamName = (id?: string) => id ? teamNames.get(id) ?? id : undefined;
  const abbrs = useMemo(() => new Map(league.teams.map(t => [t.teamId, resolveTeamIdentity(t).abbreviation])), [league.teams]);
  const teamAbbr = (id?: string) => id ? abbrs.get(id) ?? id : undefined;
  const q = query.trim().toLowerCase();
  const shown = records.filter(r => (q ? true : r.def.group === group) && (!q || r.def.title.toLowerCase().includes(q) || r.entries.some(e => e.playerId?.toLowerCase().includes(q) || teamName(e.teamId)?.toLowerCase().includes(q))));
  const sections = [...new Set(shown.map(r => `${q ? `${r.def.group} · ` : ''}${r.def.section}`))];
  const held = records.filter(r => r.entries.length).length;
  return <div className="records-page">
    <span className="pixel-eyebrow">THE RECORD BOOK</span><h2>League Records</h2>
    <p className="hint-text">{records.length} records, {held} set so far. Single-game records are tracked from every game played since this update; season, career, playoff and award records use every archived season, including retired players.</p>
    {league.historical && <p className="hint-text">Historical league: season and career records include the imported real seasons of players who are in this league. Players who retired before it started are not in the record book — see NBA History. Seasons that did not record a stat (e.g. steals before 1973–74) never count toward that stat's records.</p>}
    <div className="records-controls">
      <div className="stats-view-toggle" role="tablist" aria-label="Record groups">{GROUPS.map(g => <button key={g} role="tab" aria-selected={!q && group === g} className={!q && group === g ? 'active' : ''} onClick={() => { setGroup(g); setQuery(''); }}>{g} <small>{records.filter(r => r.def.group === g).length}</small></button>)}</div>
      <input className="db-search" type="search" placeholder="Search records or players…" value={query} onChange={e => setQuery(e.target.value)} aria-label="Search records" />
    </div>
    {shown.length === 0 && <p className="empty-state">No records match “{query}”.</p>}
    {sections.map(section => <section key={section} className="records-section">
      <h4>{section}</h4>
      <div className="records-grid">{shown.filter(r => `${q ? `${r.def.group} · ` : ''}${r.def.section}` === section).map(r => <RecordCard key={r.def.id} r={r} onSelectPlayer={onSelectPlayer} teamName={teamName} teamAbbr={teamAbbr} />)}</div>
    </section>)}
  </div>;
}
