import { useMemo, useState } from 'react';
import { perGame, pct, HIGH_CATS, HIGH_LABEL, lineValue, type RunLine, type GameHighs } from '../../hunt/statLines';
import { readRecordBook, type RunMode } from '../../retention/recordBook';

type SortKey = 'value' | 'min' | 'pts' | 'reb' | 'ast' | 'stl' | 'blk' | 'fg' | 'tp';
const COLS: { key: SortKey; label: string; title: string }[] = [
  { key: 'min', label: 'MIN', title: 'Minutes a game' }, { key: 'pts', label: 'PTS', title: 'Points a game' }, { key: 'reb', label: 'REB', title: 'Rebounds a game' },
  { key: 'ast', label: 'AST', title: 'Assists a game' }, { key: 'stl', label: 'STL', title: 'Steals a game' }, { key: 'blk', label: 'BLK', title: 'Blocks a game' },
  { key: 'fg', label: 'FG%', title: 'Field goal percentage' }, { key: 'tp', label: '3P%', title: 'Three-point percentage' },
];
const sortValue = (l: RunLine, k: SortKey) => {
  if (k === 'value') return lineValue(l) / Math.max(1, l.g);
  if (k === 'fg') return l.fga ? (l.fgm ?? 0) / l.fga : -1;
  if (k === 'tp') return l.tpa ? (l.tpm ?? 0) / l.tpa : -1;
  return (l[k] ?? -1) / Math.max(1, l.g);
};

/** Per-game stats for a run's players: minutes, the counting stats and shooting, sortable. */
export function RunStatsTable({ lines, title, note }: { lines: Record<string, RunLine> | undefined; title: string; note?: string }) {
  const [sort, setSort] = useState<SortKey>('value');
  const rows = useMemo(() => Object.entries(lines ?? {}).map(([name, l]) => ({ name, ...l })).sort((a, b) => sortValue(b, sort) - sortValue(a, sort)), [lines, sort]);
  if (!rows.length) return null;
  const head = (k: SortKey, label: string, t: string) => <th key={k} title={t} aria-sort={sort === k ? 'descending' : 'none'}><button className="run-stats-sort" onClick={() => setSort(sort === k ? 'value' : k)}>{label}{sort === k ? ' ▼' : ''}</button></th>;
  return <div className="run-stats">
    <h3 className="hunt-subhead">{title}{note && <small> {note}</small>}</h3>
    <div className="feature-table-scroll"><table className="db-table run-stats-table">
      <thead><tr><th className="col-name">Player</th><th title="Games played">G</th>{COLS.map(c => head(c.key, c.label, c.title))}</tr></thead>
      <tbody>{rows.map(l => <tr key={l.name}><td className="col-name">{l.name}</td><td>{l.g}</td>
        <td>{perGame(l.min, l.g)}</td><td>{perGame(l.pts, l.g)}</td><td>{perGame(l.reb, l.g)}</td><td>{perGame(l.ast, l.g)}</td>
        <td>{perGame(l.stl, l.g)}</td><td>{perGame(l.blk, l.g)}</td><td>{pct(l.fgm, l.fga)}</td><td>{pct(l.tpm, l.tpa)}</td></tr>)}</tbody>
    </table></div>
  </div>;
}

/** This run's best single games, with a star where one is your all-time record. */
export function RunHighs({ highs, mode }: { highs: GameHighs | undefined; mode: RunMode }) {
  if (!highs || !Object.keys(highs).length) return null;
  const book = readRecordBook();
  return <div className="run-highs"><span className="pixel-eyebrow">BEST GAMES THIS RUN</span>
    <ul>{HIGH_CATS.filter(k => highs[k]).map(k => { const x = highs[k]!, rec = book.highs[k], isRecord = rec && rec.mode === mode && rec.v === x.v && rec.name === x.name;
      return <li key={k} className={isRecord ? 'record' : ''}><b>{x.v}</b><small>{HIGH_LABEL[k].toLowerCase()}</small><span>{x.name} vs {x.vs}</span>{isRecord && <em>★ RECORD</em>}</li>; })}</ul>
  </div>;
}

/** The record book: your best single games across League Hunt and the 82-0 Challenge, and the 82-0 Finals MVPs. */
export function RecordBookPanel() {
  const book = readRecordBook();
  const cats = HIGH_CATS.filter(k => book.highs[k]);
  if (!cats.length && !book.finals.length) return null;
  return <div className="record-book"><h3 className="hunt-subhead">Record book <small>League Hunt and 82-0, best single games</small></h3>
    <ul className="record-book-list">{cats.map(k => { const x = book.highs[k]!; return <li key={k}><small>Most {HIGH_LABEL[k].toLowerCase()}</small><b>{x.v}</b><span>{x.name} vs {x.vs}</span><i>{x.mode === 'hunt' ? 'League Hunt' : '82-0'}</i></li>; })}</ul>
    {book.finals.length > 0 && <p className="hint-text">Finals MVPs: {book.finals.slice(0, 6).map(f => `${f.name} (${f.record}, ${perGame(f.pts, f.g)} PPG)`).join(' · ')}</p>}
  </div>;
}
