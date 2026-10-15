import { useMemo, useState } from 'react';
import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import type { RecordFormat } from '../simulation/records';
import { LEADER_STATS, careerTable, rankLeaders, type LeaderGroup } from '../simulation/allTimeLeaders';
import { TeamLink } from './TeamLink';

const GROUPS: LeaderGroup[] = ['Totals', 'Averages', 'Shooting', 'Feats', 'Advanced'];
const fmt = (v: number, f: RecordFormat) => f === 'pct' ? `${(v * 100).toFixed(1)}%` : f === 'dec1' ? v.toFixed(1) : f === 'dec2' ? v.toFixed(2) : f === 'dec3' ? v.toFixed(3).replace(/^0/, '') : Math.round(v).toLocaleString();
const PAGE = 50;

/** Records → All-Time Leaders: every player who has played in this league, ranked by any stat. */
export function AllTimeLeaders({ league, extras, onSelectPlayer }: { league: League; extras?: GMLeagueExtras; onSelectPlayer: (id: string) => void }) {
  const [group, setGroup] = useState<LeaderGroup>('Totals');
  const [statId, setStatId] = useState('pts');
  const [who, setWho] = useState<'all' | 'active' | 'retired'>('all');
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE);
  const table = useMemo(() => careerTable(league, extras), [league, extras]);
  const stat = LEADER_STATS.find(s => s.id === statId) ?? LEADER_STATS[0];
  const ranked = useMemo(() => rankLeaders(table, stat, who), [table, stat, who]);
  const teamNames = useMemo(() => new Map(league.teams.map(t => [t.teamId, t.name])), [league.teams]);
  const q = query.trim().toLowerCase();
  const rows = q ? ranked.filter(r => r.playerId.toLowerCase().includes(q)) : ranked.slice(0, shown);
  const pick = (g: LeaderGroup) => { setGroup(g); setStatId(LEADER_STATS.find(s => s.group === g)!.id); setShown(PAGE); };
  return <section className="all-time-leaders">
    <p className="hint-text">{table.careers.length.toLocaleString()} players have played in this league{league.historical ? ', counting the imported real careers' : ''}. Game feats and shooting by distance are counted from games played since they were added.</p>
    <div className="records-controls">
      <div className="stats-view-toggle" role="tablist" aria-label="Stat groups">{GROUPS.map(g => <button key={g} role="tab" aria-selected={group === g} className={group === g ? 'active' : ''} onClick={() => pick(g)}>{g}</button>)}</div>
      <label className="sr-only" htmlFor="atl-stat">Stat</label>
      <select id="atl-stat" className="year-input" value={stat.id} onChange={e => { setStatId(e.target.value); setShown(PAGE); }}>
        {LEADER_STATS.filter(s => s.group === group).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
      <div className="stats-view-toggle" role="radiogroup" aria-label="Which players">{(['all', 'active', 'retired'] as const).map(w => <button key={w} role="radio" aria-checked={who === w} className={who === w ? 'active' : ''} onClick={() => { setWho(w); setShown(PAGE); }}>{w === 'all' ? 'Everyone' : w === 'active' ? 'Active' : 'Not active'}</button>)}</div>
      <input className="db-search" type="search" placeholder="Find a player…" value={query} onChange={e => setQuery(e.target.value)} aria-label="Find a player in the list" />
    </div>
    <h4 className="atl-title">{stat.label}{stat.qualifier && <small> · {stat.qualifier}</small>}</h4>
    {ranked.length === 0 ? <p className="empty-state">No one has any {stat.label.toLowerCase()} yet{stat.qualify ? ' (or no one qualifies yet)' : ''}.</p> : <>
      <div className="stat-table-scroll"><table className="db-table stat-line-table atl-table">
        <thead><tr><th scope="col">#</th><th scope="col">Player</th><th scope="col">Team</th><th scope="col" className="num">YRS</th><th scope="col" className="num">GP</th><th scope="col" className="num">{stat.short}</th></tr></thead>
        <tbody>{rows.map(r => <tr key={r.playerId}>
          <td className="num">{r.rank}</td>
          <td><button className="link-button" onClick={() => onSelectPlayer(r.playerId)}>{r.playerId}</button>{r.active && <small className="atl-active" title="On a roster now"> ●</small>}</td>
          <td>{r.lastTeam ? <TeamLink teamId={r.lastTeam} name={teamNames.get(r.lastTeam) ?? r.lastTeam} /> : '—'}</td>
          <td className="num">{r.seasons}</td><td className="num">{r.games.toLocaleString()}</td><td className="num"><b>{fmt(r.value, stat.format)}</b></td>
        </tr>)}</tbody>
      </table></div>
      {q && rows.length === 0 && <p className="empty-state">No player matching “{query}” is on this list.</p>}
      {!q && shown < ranked.length && <button onClick={() => setShown(n => n + PAGE)}>Show {Math.min(PAGE, ranked.length - shown)} more ({ranked.length.toLocaleString()} ranked)</button>}
    </>}
  </section>;
}
