import { Fragment, useMemo, useState } from 'react';
import type { League } from '../simulation/league';
import type { DraftProspect, GMLeagueExtras } from '../simulation/gm';
import { calculateOverall } from '../simulation/engine/overall';
import { primaryPosition } from '../simulation/teamStatus';
import { combineResults, perceivedPotential, scoutingAccuracy, scoutingLevel, scoutingReport, toggleWorkout, workoutSlots, workoutsFor, type CombineResults } from '../simulation/scouting';
import { PlayerNameTag } from './PlayerAvatar';

const ftIn = (inches: number) => `${Math.floor(inches / 12)}′ ${(inches % 12).toFixed(inches % 1 ? 2 : 0).replace(/\.?0+$/, '')}″`;
type View = 'board' | 'combine' | 'workouts';
type CombineKey = keyof CombineResults;
const COMBINE_COLS: { key: CombineKey; label: string; fmt: (v: number) => string; lowerIsBetter?: boolean }[] = [
  { key: 'heightNoShoes', label: 'Ht (no shoes)', fmt: ftIn }, { key: 'wingspan', label: 'Wingspan', fmt: ftIn },
  { key: 'standingReach', label: 'Reach', fmt: ftIn }, { key: 'weight', label: 'Wt', fmt: v => `${v}` },
  { key: 'maxVertical', label: 'Max vert', fmt: v => `${v.toFixed(1)}″` }, { key: 'standingVertical', label: 'Standing vert', fmt: v => `${v.toFixed(1)}″` },
  { key: 'laneAgility', label: 'Lane agility', fmt: v => `${v.toFixed(2)}s`, lowerIsBetter: true }, { key: 'sprint', label: '¾ sprint', fmt: v => `${v.toFixed(2)}s`, lowerIsBetter: true },
  { key: 'benchReps', label: 'Bench', fmt: v => `${v}` },
];

interface Props {
  league: League; extras: GMLeagueExtras; controlledTeamId: string | null; myTurn: boolean;
  onDraft: (prospectId: string) => void; onChange: (league: League, extras: GMLeagueExtras) => void; onSelectPlayer: (id: string) => void;
}

/** The draft board as the user's front office sees it: fogged potential ranges, combine numbers and workouts. */
export function ScoutingBoard({ league, extras, controlledTeamId, myTurn, onDraft, onChange, onSelectPlayer }: Props) {
  const [view, setView] = useState<View>('board');
  const [open, setOpen] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: CombineKey; dir: 1 | -1 }>({ key: 'maxVertical', dir: -1 });
  const [note, setNote] = useState<string | null>(null);
  const team = controlledTeamId;
  const workouts = workoutsFor(extras, team);
  const slots = workoutSlots(league, team);
  const level = scoutingLevel(league, team), accuracy = scoutingAccuracy(league, team);
  const board = useMemo(() => extras.draftClass.map(p => ({ p, report: scoutingReport(p, league, extras, team), ovr: calculateOverall(p.trueSeason), combine: combineResults(p.trueSeason) }))
    .sort((a, b) => (perceivedPotential(b.p, league, extras, team) * 0.65 + b.ovr * 0.35) - (perceivedPotential(a.p, league, extras, team) * 0.65 + a.ovr * 0.35) || a.p.playerId.localeCompare(b.p.playerId)), [league, extras, team]);
  const best = useMemo(() => {
    const out = {} as Record<CombineKey, number>;
    for (const c of COMBINE_COLS) { const vals = board.map(b => b.combine[c.key]); out[c.key] = vals.length ? (c.lowerIsBetter ? Math.min(...vals) : Math.max(...vals)) : NaN; }
    return out;
  }, [board]);
  const invite = (p: DraftProspect) => {
    if (!team) return;
    const r = toggleWorkout(league, extras, team, p.playerId);
    setNote(r.error ?? null);
    if (!r.error) onChange(league, r.extras);
  };
  const rows = view === 'workouts' ? board.filter(b => workouts.includes(b.p.playerId)) : board;
  const combineRows = [...board].sort((a, b) => (a.combine[sort.key] - b.combine[sort.key]) * sort.dir);

  return <section className="scouting-board" aria-label="Scouting board">
    <header className="scouting-head">
      <div><span className="section-label">SCOUTING DEPARTMENT</span><h4>Big board · {extras.draftClass.length} prospects</h4></div>
      <div className="scouting-meters">
        <span title="Set in Finances → expense levels">Budget <b>{Math.round(level)}</b></span>
        <span title="How far your read on potential can be off">Read ±<b>{Math.round(3 + (1 - accuracy) * 22)}</b> POT</span>
        {team && <span>Workouts <b>{workouts.length}/{slots}</b></span>}
      </div>
    </header>
    <p className="hint-text">Potential shows as your scouts' range. A bigger scouting budget narrows it and adds workout slots; a workout nearly removes the guesswork and reveals character. Other front offices draft from their own reads.</p>
    <div className="stats-view-toggle" role="tablist" aria-label="Scouting views">
      {(['board', 'combine', 'workouts'] as View[]).map(v => <button key={v} role="tab" aria-selected={view === v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>{v === 'board' ? 'Big Board' : v === 'combine' ? 'Draft Combine' : `Workouts (${workouts.length})`}</button>)}
    </div>
    {note && <p className="hint-text" role="status">{note}</p>}

    {view !== 'combine' ? <div className="finances-table-wrap"><table className="db-table scouting-table">
      <thead><tr><th>#</th><th>Player</th><th>Pos</th><th>Age</th><th>OVR</th><th>POT (scouted)</th><th>Read</th><th>Best tool</th><th>Flags</th><th></th><th></th></tr></thead>
      <tbody>{rows.map((b, i) => {
        const { p, report: r } = b, isOpen = open === p.playerId, worked = workouts.includes(p.playerId);
        const topGrade = Object.entries(r.grades).sort((x, y) => gradeRank(y[1]) - gradeRank(x[1]))[0];
        return <Fragment key={p.playerId}>
          <tr className={isOpen ? 'scouting-row-open' : ''}>
            <td>{view === 'board' ? i + 1 : board.indexOf(b) + 1}</td>
            <td><button className="prospect-name" onClick={() => onSelectPlayer(p.playerId)}><PlayerNameTag playerId={p.playerId} size={24} /></button></td>
            <td>{primaryPosition(p.trueSeason)}</td><td>{p.trueSeason.age}</td><td>{b.ovr}</td>
            <td className="scouting-pot"><PotBar low={r.potLow} high={r.potHigh} />{r.potLow === r.potHigh ? r.potLow : `${r.potLow}–${r.potHigh}`}</td>
            <td><span className={`scout-conf scout-conf-${r.confidence.toLowerCase()}`}>{r.confidence}</span></td>
            <td>{topGrade ? `${topGrade[0]} ${topGrade[1]}` : '—'}</td>
            <td className="scouting-flags">{r.flags.length ? r.flags.map(f => <span key={f} title={f} className={f.startsWith('Medical') || f.startsWith('Interview') || f.startsWith('Raw') ? 'flag-risk' : 'flag-good'}>{f.startsWith('Medical') ? '✚' : f.startsWith('Interview') ? '?' : f.startsWith('Raw') ? '◆' : f.startsWith('Older') ? '⌛' : '★'}</span>) : '—'}</td>
            <td className="scouting-actions">
              <button onClick={() => setOpen(isOpen ? null : p.playerId)} aria-expanded={isOpen}>{isOpen ? 'Close' : 'Report'}</button>
              {team && <button className={worked ? 'active' : ''} aria-pressed={worked} onClick={() => invite(p)} disabled={!worked && workouts.length >= slots}>{worked ? 'Worked out' : 'Invite'}</button>}
            </td>
            <td><button disabled={!myTurn} onClick={() => onDraft(p.playerId)}>Draft</button></td>
          </tr>
          {isOpen && <tr className="scouting-report-row"><td colSpan={11}><ReportCard b={b} /></td></tr>}
        </Fragment>;
      })}</tbody>
    </table>{rows.length === 0 && <p className="empty-state">{view === 'workouts' ? 'No workouts scheduled. Invite prospects from the Big Board.' : 'No prospects remaining.'}</p>}</div>
      : <div className="finances-table-wrap"><table className="db-table combine-table">
        <thead><tr><th>Player</th><th>Pos</th>{COMBINE_COLS.map(c => <th key={c.key} aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
          <button className="th-sort" onClick={() => setSort(s => ({ key: c.key, dir: s.key === c.key ? (s.dir === 1 ? -1 : 1) : (c.lowerIsBetter ? 1 : -1) }))}>{c.label}{sort.key === c.key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}</button></th>)}</tr></thead>
        <tbody>{combineRows.map(b => <tr key={b.p.playerId}>
          <td><button className="prospect-name" onClick={() => onSelectPlayer(b.p.playerId)}><PlayerNameTag playerId={b.p.playerId} size={22} /></button></td><td>{primaryPosition(b.p.trueSeason)}</td>
          {COMBINE_COLS.map(c => <td key={c.key} className={b.combine[c.key] === best[c.key] ? 'prospect-best' : ''}>{c.fmt(b.combine[c.key])}</td>)}
        </tr>)}</tbody>
      </table><p className="hint-text">Combine results are public. The best mark in each drill is highlighted.</p></div>}
  </section>;
}

const GRADES = ['F', 'D', 'D+', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+'];
const gradeRank = (g: string) => GRADES.indexOf(g);

function PotBar({ low, high }: { low: number; high: number }) {
  const x = (v: number) => Math.max(0, Math.min(100, (v - 40) / 59 * 100));
  return <span className="pot-bar" aria-hidden="true"><span style={{ left: `${x(low)}%`, width: `${Math.max(3, x(high) - x(low))}%` }} /></span>;
}

function ReportCard({ b }: { b: { p: DraftProspect; report: ReturnType<typeof scoutingReport>; combine: CombineResults } }) {
  const { report: r, combine: c, p } = b;
  return <div className="scouting-report">
    <div className="scouting-report-grades">
      {Object.entries(r.grades).map(([k, g]) => <div key={k} className={`grade-chip grade-${g[0]}`}><small>{k}</small><b>{g}</b></div>)}
    </div>
    <div className="scouting-report-text">
      <p><b>Projects as:</b> {p.trueSeason.archetypeLabel ?? primaryPosition(p.trueSeason)} · potential {r.potLow === r.potHigh ? r.potLow : `${r.potLow}–${r.potHigh}`} ({r.confidence === 'Workout' ? 'seen in a private workout' : `${r.confidence.toLowerCase()} confidence`})</p>
      <p className="scout-plus">+ {r.strengths.join(' · ')}</p>
      <p className="scout-minus">− {r.weaknesses.join(' · ')}</p>
      {r.flags.length > 0 && <p className="scout-flags">{r.flags.join(' · ')}</p>}
      <p className="hint-text">Combine: {ftIn(c.heightNoShoes)} without shoes · {ftIn(c.wingspan)} wingspan · {c.maxVertical.toFixed(1)}″ max vertical · {c.laneAgility.toFixed(2)}s lane agility</p>
    </div>
  </div>;
}
