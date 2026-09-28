import { useState } from 'react';
import type { League } from '../simulation/league';
import { calculateOverall } from '../simulation/engine/overall';
import { campState, setSummerPlan, trainerSlots, FOCUS, TRAINER, type CampFocus, type TrainerTier, type CampReport } from '../simulation/summerCamp';
import { PixelIcon } from './PixelIcon';

interface Props {
  league: League;
  controlledTeamId: string | null;
  onChange: (league: League) => void;
  onSelectPlayer: (id: string) => void;
}

/** Summer plans for your players, and the Training Camp Report of how they came back. */
export function SummerCampPage({ league, controlledTeamId, onChange, onSelectPlayer }: Props) {
  const [note, setNote] = useState<string | null>(null);
  const team = league.teams.find(t => t.teamId === controlledTeamId);
  if (!team) return <p className="empty-state">Summer camp is for the team you run.</p>;
  const state = campState(league, team.teamId);
  const slots = trainerSlots(team);
  const used = (tier: TrainerTier) => Object.values(state.plans).filter(p => p.trainer === tier).length;
  const report = league.campReport?.teamId === team.teamId && league.campReport.season === league.season ? league.campReport : null;
  const realLocked = !!league.historical?.realDevelopment;
  const roster = [...team.seasons].sort((a, b) => calculateOverall(b) - calculateOverall(a));
  const set = (playerId: string, focus: CampFocus | '', trainer: TrainerTier) => {
    const r = setSummerPlan(league, team.teamId, playerId, focus ? { focus, trainer: focus === 'rest' ? 'none' : trainer } : null);
    setNote(r.error ?? null);
    if (!r.error) onChange(r.league);
  };

  return <div className="summer-camp-page">
    <header><span className="pixel-eyebrow">PLAYER DEVELOPMENT</span><h2><PixelIcon name="star" size={24} /> Summer Camp</h2></header>
    {report && <CampReportView report={report} onSelectPlayer={onSelectPlayer} onSeen={() => onChange({ ...league, campReport: { ...report, seen: true } })} />}
    <section>
      <h3>Plans for this summer</h3>
      <p className="hint-text">Give each player a summer focus. Camps run when the next season begins, on top of normal development: young, hard-working players gain the most, and a personal trainer multiplies it. Heavy strength work can nick a player up; rest clears his legs.{realLocked ? ' Real players on Real Player Development follow their real careers, so camps only help generated players.' : ''}</p>
      <div className="summer-trainers">
        <span>Skills trainers <b>{used('skills')}/{slots.skills}</b></span>
        <span>Elite trainers <b>{used('elite')}/{slots.elite}</b></span>
        <span className="hint-text">More with a bigger coaching budget (Finances).</span>
      </div>
      {note && <p className="hint-text" role="alert">{note}</p>}
      <div className="finances-table-wrap"><table className="db-table summer-table">
        <thead><tr><th className="col-name">Player</th><th>Age</th><th>OVR</th><th>POT</th><th>Work ethic</th><th>Focus</th><th>Trainer</th></tr></thead>
        <tbody>{roster.map(p => { const plan = state.plans[p.playerId]; return <tr key={p.playerId}>
          <td className="col-name"><button className="link-button" onClick={() => onSelectPlayer(p.playerId)}>{p.playerId}</button></td>
          <td>{p.age}</td><td>{calculateOverall(p)}</td><td>{p.development.potential}</td><td>{p.development.workEthic}</td>
          <td><select aria-label={`Summer focus for ${p.playerId}`} value={plan?.focus ?? ''} onChange={e => set(p.playerId, e.target.value as CampFocus | '', plan?.trainer ?? 'none')}>
            <option value="">— none —</option>{(Object.keys(FOCUS) as CampFocus[]).map(f => <option key={f} value={f} title={FOCUS[f].detail}>{FOCUS[f].label}</option>)}</select></td>
          <td><select aria-label={`Trainer for ${p.playerId}`} disabled={!plan || plan.focus === 'rest'} value={plan?.trainer ?? 'none'} onChange={e => plan && set(p.playerId, plan.focus, e.target.value as TrainerTier)}>
            {(Object.keys(TRAINER) as TrainerTier[]).map(t => <option key={t} value={t}>{TRAINER[t].label}</option>)}</select></td>
        </tr>; })}</tbody>
      </table></div>
    </section>
  </div>;
}

/** The reveal: each player's card turns over to show how he came back. */
function CampReportView({ report, onSelectPlayer, onSeen }: { report: CampReport; onSelectPlayer: (id: string) => void; onSeen: () => void }) {
  const [shown, setShown] = useState(() => (report.seen ? report.rows.length : 0));
  const all = shown >= report.rows.length;
  const reveal = (n: number) => { setShown(n); if (n >= report.rows.length && !report.seen) onSeen(); };
  const counts = report.rows.reduce((m, r) => ({ ...m, [r.label]: (m[r.label] ?? 0) + 1 }), {} as Record<string, number>);
  return <section className="camp-report" aria-label="Training Camp Report">
    <h3>Training Camp Report</h3>
    <p className="hint-text">{all ? `${counts.Breakout ?? 0} breakout${counts.Breakout === 1 ? '' : 's'}, ${counts.Leap ?? 0} leap${counts.Leap === 1 ? '' : 's'}, ${(counts.Dip ?? 0) + (counts.Regression ?? 0)} slipped.` : 'Your players are reporting to camp. See how the summer went.'}</p>
    <div className="camp-cards">{report.rows.map((r, i) => i < shown
      ? <button key={r.playerId} className={`camp-card camp-${r.label.toLowerCase()}`} onClick={() => onSelectPlayer(r.playerId)}>
        <small>{r.label.toUpperCase()}</small><b>{r.playerId}</b>
        <span className="camp-ovr">{r.before} → {r.after} <em>{r.after - r.before >= 0 ? '+' : ''}{r.after - r.before}</em></span>
        <span className="hint-text">{r.skipped ?? r.note}{r.campGain > 0 ? ` Camp: +${r.campGain} OVR.` : ''}</span>
      </button>
      : <div key={r.playerId} className="camp-card camp-hidden" aria-hidden="true"><small>AGE {r.age}</small><b>?</b></div>)}</div>
    {!all && <div className="contest-actions"><button className="primary" onClick={() => reveal(shown + 1)}>Next player</button><button onClick={() => reveal(report.rows.length)}>Reveal all</button></div>}
  </section>;
}
