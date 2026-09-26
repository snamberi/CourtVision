import { TeamLink } from './TeamLink';
import { useMemo, useState } from 'react';
import type { LeagueTeam } from '../simulation/league';
import type { PlayerSeason } from '../simulation/types';
import { PlayerNameTag } from './PlayerAvatar';

interface Props {
  teams: LeagueTeam[];
  onSelect: (playerId: string) => void;
  selectedPlayerId?: string;
}

const PAGE_SIZES = [25, 50, 100];

type SortKey = 'name' | 'team' | 'threePoint' | 'ballHandling' | 'potential' | 'height';

export function PlayerDatabase({ teams, onSelect, selectedPlayerId }: Props) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [teamFilter, setTeamFilter] = useState<string>('ALL');
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(0);

  // Any change to what's being listed sends you back to the first page.
  const resetPage = () => setPage(0);

  const rows = useMemo(() => {
    const all: { season: PlayerSeason; teamName: string }[] = [];
    for (const t of teams) {
      if (teamFilter !== 'ALL' && t.teamId !== teamFilter) continue;
      for (const s of t.seasons) all.push({ season: s, teamName: t.name });
    }
    const filtered = query
      ? all.filter((r) => r.season.playerId.toLowerCase().includes(query.toLowerCase()))
      : all;
    const sorted = [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'name': return a.season.playerId.localeCompare(b.season.playerId);
        case 'team': return a.teamName.localeCompare(b.teamName);
        case 'threePoint': return b.season.attributes.offense.threePoint - a.season.attributes.offense.threePoint;
        case 'ballHandling': return b.season.attributes.offense.ballHandling - a.season.attributes.offense.ballHandling;
        case 'potential': return b.season.development.potential - a.season.development.potential;
        case 'height': return b.season.attributes.physical.heightInches - a.season.attributes.physical.heightInches;
        default: return 0;
      }
    });
    return sorted;
  }, [teams, query, sortKey, teamFilter]);

  // Only the current page is ever rendered - a full 30-team league has 500+ players, each with an SVG avatar.
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(safePage * pageSize, (safePage + 1) * pageSize);
  const firstShown = rows.length === 0 ? 0 : safePage * pageSize + 1;
  const lastShown = safePage * pageSize + pageRows.length;

  const pager = rows.length > pageSize && (
    <div className="db-pager">
      <button onClick={() => setPage(0)} disabled={safePage === 0} aria-label="First page">«</button>
      <button onClick={() => setPage(safePage - 1)} disabled={safePage === 0}>‹ Prev</button>
      <span className="hint-text">{firstShown}–{lastShown} of {rows.length} players · page {safePage + 1} of {pageCount}</span>
      <button onClick={() => setPage(safePage + 1)} disabled={safePage >= pageCount - 1}>Next ›</button>
      <button onClick={() => setPage(pageCount - 1)} disabled={safePage >= pageCount - 1} aria-label="Last page">»</button>
    </div>
  );

  return (
    <div className="player-database">
      <div className="db-controls">
        <input
          className="db-search" type="text" placeholder="Search players…"
          value={query} onChange={(e) => { setQuery(e.target.value); resetPage(); }}
        />
        <select value={teamFilter} onChange={(e) => { setTeamFilter(e.target.value); resetPage(); }}>
          <option value="ALL">All Teams</option>
          {teams.map((t) => <option key={t.teamId} value={t.teamId}>{t.name}</option>)}
        </select>
        <select value={sortKey} onChange={(e) => { setSortKey(e.target.value as SortKey); resetPage(); }}>
          <option value="name">Sort: Name</option>
          <option value="team">Sort: Team</option>
          <option value="threePoint">Sort: 3PT</option>
          <option value="ballHandling">Sort: Ball Handling</option>
          <option value="potential">Sort: Potential</option>
          <option value="height">Sort: Height</option>
        </select>
        <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); resetPage(); }} aria-label="Players per page">
          {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} per page</option>)}
        </select>
      </div>
      {pager}
      <table className="db-table">
        <thead>
          <tr><th>Player</th><th>Team</th><th>Ht</th><th>3PT</th><th>Handle</th><th>Def</th><th>POT</th></tr>
        </thead>
        <tbody>
          {pageRows.map(({ season, teamName }) => (
            <tr
              key={season.playerId}
              className={selectedPlayerId === season.playerId ? 'selected' : ''}
              onClick={() => onSelect(season.playerId)}
            >
              <td><PlayerNameTag playerId={season.playerId} teamId={season.teamId} jerseyNumber={season.jerseyNumber} size={22} /></td>
              <td><TeamLink name={teamName} /></td>
              <td>{Math.floor(season.attributes.physical.heightInches / 12)}'{season.attributes.physical.heightInches % 12}"</td>
              <td>{season.attributes.offense.threePoint.toFixed(0)}</td>
              <td>{season.attributes.offense.ballHandling.toFixed(0)}</td>
              <td>{season.attributes.defense.perimeterDefense.toFixed(0)}</td>
              <td>{season.development.potential.toFixed(0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {pager}
      {rows.length === 0 && <p className="empty-state">No players match your search.</p>}
    </div>
  );
}
