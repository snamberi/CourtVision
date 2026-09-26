import { TeamText } from './TeamLink';
import { useMemo, useState } from 'react';
import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import { collectLeagueTransactions, TRANSACTION_TYPE_LABELS } from '../simulation/transactions';
import type { PlayerHistoryEventType } from '../simulation/types';
import { formatSeasonYear } from '../simulation/calendar';
import { PlayerNameTag } from './PlayerAvatar';

interface Props {
  league: League;
  extras: GMLeagueExtras;
  onSelectPlayer: (playerId: string) => void;
}

export function TransactionsPage({ league, extras, onSelectPlayer }: Props) {
  const [typeFilter, setTypeFilter] = useState<PlayerHistoryEventType | 'all'>('all');
  const [query, setQuery] = useState('');
  const all = useMemo(() => collectLeagueTransactions(league, extras), [league, extras]);
  const teamIdByName = useMemo(() => new Map(league.teams.map((t) => [t.name, t.teamId])), [league.teams]);

  const rows = all
    .filter((e) => typeFilter === 'all' || e.type === typeFilter)
    .filter((e) => !query || e.playerId.toLowerCase().includes(query.toLowerCase()) || e.description.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 300);

  return (
    <div className="transactions-page">
      <h4>Transactions</h4>
      <div className="fa-controls">
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)}>
          <option value="all">All types</option>
          {Object.entries(TRANSACTION_TYPE_LABELS).map(([type, label]) => <option key={type} value={type}>{label}</option>)}
        </select>
        <input className="db-search" type="text" placeholder="Search player or description…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {rows.length === 0 ? (
        <p className="empty-state">No transactions match yet.</p>
      ) : (
        <ul className="history-log">
          {rows.map((e, i) => (
            <li key={i} className={`history-entry history-${e.type}`}>
              <span className="history-season">{formatSeasonYear(e.season)}</span>
              <span className={`transaction-type-tag transaction-${e.type}`}>{TRANSACTION_TYPE_LABELS[e.type]}</span>
              <span className="history-desc">
                <span className="award-team-player" onClick={() => onSelectPlayer(e.playerId)}>
                  <PlayerNameTag playerId={e.playerId} teamId={e.teamName ? teamIdByName.get(e.teamName) : null} size={20} />
                </span> — <TeamText text={e.description} />
              </span>
            </li>
          ))}
        </ul>
      )}
      {all.length > rows.length && <p className="hint-text">Showing the {rows.length} most relevant of {all.length} total events.</p>}
    </div>
  );
}
