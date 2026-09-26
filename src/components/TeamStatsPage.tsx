import { TeamLink } from './TeamLink';
import { useMemo, useState } from 'react';
import type { League } from '../simulation/league';
import { computeTeamStats, type TeamStatsRow } from '../simulation/teamStats';

interface Col { key: keyof TeamStatsRow; label: string; title?: string; fmt: (v: number) => string; lowerIsBetter?: boolean; signed?: boolean }
const f1 = (v: number) => v.toFixed(1), pct = (v: number) => (v * 100).toFixed(1), i0 = (v: number) => String(v);
const COLS: Col[] = [
  { key: 'wins', label: 'W', fmt: i0 }, { key: 'losses', label: 'L', fmt: i0, lowerIsBetter: true },
  { key: 'ortg', label: 'ORtg', title: 'Offensive rating: points scored per 100 possessions', fmt: f1 },
  { key: 'drtg', label: 'DRtg', title: 'Defensive rating: points allowed per 100 possessions (lower is better)', fmt: f1, lowerIsBetter: true },
  { key: 'netRtg', label: 'Net', title: 'Net rating per 100 possessions', fmt: f1, signed: true },
  { key: 'pace', label: 'Pace', title: 'Possessions per 48 minutes', fmt: f1 },
  { key: 'ppg', label: 'PPG', fmt: f1 }, { key: 'oppPpg', label: 'OPP', title: 'Points allowed per game', fmt: f1, lowerIsBetter: true },
  { key: 'fgPct', label: 'FG%', fmt: pct }, { key: 'tpPct', label: '3P%', fmt: pct }, { key: 'ftPct', label: 'FT%', fmt: pct },
  { key: 'tpmPg', label: '3PM', fmt: f1 }, { key: 'rpg', label: 'RPG', fmt: f1 }, { key: 'apg', label: 'APG', fmt: f1 },
  { key: 'spg', label: 'SPG', fmt: f1 }, { key: 'bpg', label: 'BPG', fmt: f1 }, { key: 'tovPg', label: 'TOV', fmt: f1, lowerIsBetter: true },
  { key: 'oppFgPct', label: 'OPP FG%', fmt: pct, lowerIsBetter: true }, { key: 'oppTpPct', label: 'OPP 3P%', fmt: pct, lowerIsBetter: true },
  { key: 'oppRpg', label: 'OPP REB', fmt: f1, lowerIsBetter: true }, { key: 'oppTovPg', label: 'OPP TOV', title: 'Turnovers forced per game', fmt: f1 },
];

export function TeamStatsPage({ league }: { league: League }) {
  const [sortKey, setSortKey] = useState<keyof TeamStatsRow>('netRtg');
  const col = COLS.find(c => c.key === sortKey) ?? COLS[4];
  const rows = useMemo(() => [...computeTeamStats(league)].sort((a, b) => {
    const av = a[col.key] as number, bv = b[col.key] as number;
    return col.lowerIsBetter ? av - bv : bv - av;
  }), [league, col]);
  return (
    <div className="team-stats-page">
      <h4>Team Stats</h4>
      <p className="hint-text">Regular season. Ratings are per 100 possessions, so fast and slow teams compare fairly. Click a column to sort.</p>
      {rows.length === 0 ? <p className="empty-state">No teams yet.</p> : (
        <div className="stat-table-scroll"><table className="db-table stat-line-table">
          <thead><tr><th className="col-name">Team</th><th>GP</th>{COLS.map(c => <th key={c.key} title={c.title} aria-sort={c.key === col.key ? (c.lowerIsBetter ? 'ascending' : 'descending') : undefined}>
            <button className={`th-sort${c.key === col.key ? ' active' : ''}`} onClick={() => setSortKey(c.key)}>{c.label}{c.key === col.key ? (c.lowerIsBetter ? ' ▲' : ' ▼') : ''}</button></th>)}</tr></thead>
          <tbody>{rows.map(r => <tr key={r.teamId}><td className="col-name"><TeamLink name={r.teamName} /></td><td>{r.gamesPlayed}</td>
            {COLS.map(c => { const v = r[c.key] as number; return <td key={c.key} className={c.signed ? (v >= 0 ? 'plus' : 'minus') : undefined}>{c.signed && v >= 0 ? '+' : ''}{c.fmt(v)}</td>; })}</tr>)}</tbody>
        </table></div>
      )}
    </div>
  );
}
