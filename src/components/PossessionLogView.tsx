import { useMemo, useState } from 'react';
import type { PossessionLogEntry } from '../simulation/boxscore';

const RESULT_OPTIONS: Array<PossessionLogEntry['result'] | 'ALL'> = ['ALL', 'MAKE', 'MISS', 'TURNOVER', 'FOUL'];

export function PossessionLogView({ log }: { log: PossessionLogEntry[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [resultFilter, setResultFilter] = useState<typeof RESULT_OPTIONS[number]>('ALL');
  const [playerQuery, setPlayerQuery] = useState('');

  const filtered = useMemo(() => {
    return log.filter((e) => {
      if (resultFilter !== 'ALL' && e.result !== resultFilter) return false;
      if (playerQuery) {
        const q = playerQuery.toLowerCase();
        const involvesPlayer = e.ballHandlerId.toLowerCase().includes(q) || e.events.some((ev) => ev.toLowerCase().includes(q));
        if (!involvesPlayer) return false;
      }
      return true;
    }).map((e) => ({ entry: e, originalIndex: log.indexOf(e) }));
  }, [log, resultFilter, playerQuery]);

  return (
    <div className="possession-log">
      <h4>Possession Log ({filtered.length} / {log.length} possessions)</h4>
      <div className="log-filters">
        <select value={resultFilter} onChange={(e) => setResultFilter(e.target.value as typeof resultFilter)}>
          {RESULT_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <input
          type="text" placeholder="Filter by player…" value={playerQuery}
          onChange={(e) => setPlayerQuery(e.target.value)}
        />
      </div>
      <div className="possession-list">
        {filtered.map(({ entry, originalIndex }) => (
          <div
            key={originalIndex}
            className={`possession-entry result-${entry.result.toLowerCase()}`}
            onClick={() => setOpenIdx(openIdx === originalIndex ? null : originalIndex)}
          >
            <div className="possession-summary">
              <span className="pq">Q{entry.quarter} {Math.floor(entry.clockSeconds / 60)}:{String(Math.round(entry.clockSeconds % 60)).padStart(2, '0')}</span>
              <span className="pteam">{entry.offenseTeamId}</span>
              <span className="pball">{entry.ballHandlerId}</span>
              <span className={`presult tag-${entry.result.toLowerCase()}`}>{entry.result}</span>
            </div>
            {openIdx === originalIndex && (
              <div className="possession-detail">
                <ol>{entry.events.map((e, j) => <li key={j}>{e}</li>)}</ol>
                <p className="hint-text">On court (home): {entry.onCourtHome.join(', ')}</p>
                <p className="hint-text">On court (away): {entry.onCourtAway.join(', ')}</p>
                {entry.debug && <pre>{JSON.stringify(entry.debug, null, 2)}</pre>}
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && <p className="empty-state">No possessions match this filter.</p>}
      </div>
    </div>
  );
}
