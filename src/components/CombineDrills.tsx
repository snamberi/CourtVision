import { useEffect, useRef, useState } from 'react';
import type { League } from '../simulation/league';
import type { DraftProspect, GMLeagueExtras } from '../simulation/gm';
import { combineResults, drillsFor, recordDrill, letterGrade, COMBINE_TESTS, DRILL_REVEALS, type Drill, type ScoutingReport } from '../simulation/scouting';
import { prospectComparison } from '../simulation/draftScouting';
import { primaryPosition } from '../simulation/teamStatus';
import { PlayerAvatar } from './PlayerAvatar';

/*
 * Draft combine mini-games. Three quick drills, each played by you and scored by the prospect's real (hidden) ability:
 *  - Shooting drill: ten shots. Stop the meter in the green; the green is wider for a better shooter.
 *  - Sprint: go on the green light. Your reaction counts a little, his speed counts a lot.
 *  - Vertical jump: stop the meter at the top; he leaps toward the vanes.
 * A drill clears the fog on the skills it tests (see scouting.ts). Only COMBINE_TESTS prospects a year.
 */

const DRILL_LABEL: Record<Drill, string> = { shooting: 'Shooting drill', sprint: 'Sprint', vertical: 'Vertical jump' };
const fmt = (d: Drill, v: number) => d === 'shooting' ? `${v}/10` : d === 'sprint' ? `${v.toFixed(2)}s` : `${v.toFixed(1)}"`;
const now = () => performance.now();

/** A marker sweeping a bar, 0-1. */
function useSweep(running: boolean, speed = 1.3) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!running) return;
    let raf = 0; const t0 = now();
    const tick = () => { const t = (now() - t0) / 1000 * speed; setV(0.5 - 0.5 * Math.cos(t * Math.PI)); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, speed]);
  return v;
}

function Meter({ value, zone }: { value: number; zone?: [number, number] }) {
  return <div className="combine-meter" aria-hidden="true">
    {zone && <i className="combine-zone" style={{ left: `${zone[0] * 100}%`, width: `${(zone[1] - zone[0]) * 100}%` }} />}
    <b className="combine-marker" style={{ left: `${value * 100}%` }} />
  </div>;
}

function ShootingDrill({ p, onDone }: { p: DraftProspect; onDone: (score: number) => void }) {
  const skill = prospectComparison(p.trueSeason).Shooting;
  const half = 0.05 + Math.max(0, Math.min(1, (skill - 25) / 60)) * 0.13;
  const zone: [number, number] = [0.5 - half, 0.5 + half];
  const [shots, setShots] = useState<boolean[]>([]);
  const [flight, setFlight] = useState<{ made: boolean; key: number } | null>(null);
  const v = useSweep(shots.length < 10 && !flight, 1.2 + shots.length * 0.05);
  const shoot = () => {
    if (flight || shots.length >= 10) return;
    const inZone = v >= zone[0] && v <= zone[1];
    const made = Math.random() < (inZone ? 0.55 + skill * 0.005 : 0.08 + skill * 0.003);
    setFlight({ made, key: shots.length });
    setTimeout(() => { setFlight(null); setShots(s => { const next = [...s, made]; if (next.length === 10) onDone(next.filter(Boolean).length); return next; }); }, 650);
  };
  useKey(' ', shoot);
  return <div className="combine-game">
    <div className="combine-stage combine-stage-shoot">
      <span className="combine-hoop" />
      <span className="combine-shooter"><PlayerAvatar playerId={p.playerId} size={56} jerseyNumber={p.trueSeason.jerseyNumber} age={p.trueSeason.age} /></span>
      {flight && <span key={flight.key} className={`combine-ball ${flight.made ? 'make' : 'miss'}`} />}
    </div>
    <Meter value={v} zone={zone} />
    <div className="combine-shots">{Array.from({ length: 10 }, (_, i) => <i key={i} className={i < shots.length ? shots[i] ? 'make' : 'miss' : ''} />)}</div>
    <button className="primary" onClick={shoot} disabled={!!flight || shots.length >= 10}>Shoot (space)</button>
  </div>;
}

function SprintDrill({ p, onDone }: { p: DraftProspect; onDone: (score: number) => void }) {
  const base = combineResults(p.trueSeason).sprint;
  const [phase, setPhase] = useState<'ready' | 'set' | 'go' | 'run' | 'done' | 'false'>('ready');
  const goAt = useRef(0);
  const [time, setTime] = useState<number | null>(null);
  useEffect(() => {
    if (phase !== 'set') return;
    const id = setTimeout(() => { goAt.current = now(); setPhase('go'); }, 900 + Math.random() * 1600);
    return () => clearTimeout(id);
  }, [phase]);
  const press = () => {
    if (phase === 'ready' || phase === 'false') { setPhase('set'); return; }
    if (phase === 'set') { setPhase('false'); return; }
    if (phase === 'go') {
      const reaction = (now() - goAt.current) / 1000;
      const t = Math.round((base + Math.max(0, reaction - 0.18) * 0.6) * 100) / 100;
      setTime(t); setPhase('run');
      setTimeout(() => { setPhase('done'); onDone(t); }, t * 400);
    }
  };
  useKey(' ', press);
  return <div className="combine-game">
    <div className="combine-stage combine-stage-sprint">
      <span className={`combine-light light-${phase === 'go' || phase === 'run' || phase === 'done' ? 'green' : phase === 'set' ? 'amber' : 'red'}`} />
      <span className="combine-lane" />
      <span className={`combine-runner${phase === 'run' || phase === 'done' ? ' running' : ''}`} style={time ? { transitionDuration: `${time * 0.4}s` } : undefined}>
        <PlayerAvatar playerId={p.playerId} size={48} jerseyNumber={p.trueSeason.jerseyNumber} age={p.trueSeason.age} /></span>
    </div>
    <p className="hint-text" role="status">{phase === 'ready' ? 'Press Start, then GO the moment the light turns green.' : phase === 'set' ? 'Set…' : phase === 'go' ? 'GO!' : phase === 'false' ? 'False start! Try again.' : time != null ? `${time.toFixed(2)} seconds` : ''}</p>
    <button className="primary" onClick={press} disabled={phase === 'run' || phase === 'done'}>{phase === 'ready' || phase === 'false' ? 'Start' : 'GO (space)'}</button>
  </div>;
}

function VerticalDrill({ p, onDone }: { p: DraftProspect; onDone: (score: number) => void }) {
  const max = combineResults(p.trueSeason).maxVertical;
  const [jumps, setJumps] = useState<number[]>([]);
  const [air, setAir] = useState<number | null>(null);
  const v = useSweep(jumps.length < 3 && air == null, 1.6);
  const jump = () => {
    if (air != null || jumps.length >= 3) return;
    const inches = Math.round(max * (0.84 + 0.16 * v) * 10) / 10;
    setAir(inches);
    setTimeout(() => { setAir(null); setJumps(j => { const next = [...j, inches]; if (next.length === 3) onDone(Math.max(...next)); return next; }); }, 800);
  };
  useKey(' ', jump);
  const best = jumps.length ? Math.max(...jumps) : null;
  return <div className="combine-game">
    <div className="combine-stage combine-stage-vert">
      <span className="combine-vanes">{Array.from({ length: 12 }, (_, i) => <i key={i} className={air != null && 26 + i * 2.5 <= air ? 'hit' : ''} />)}</span>
      <span className="combine-jumper" style={{ transform: `translateY(${air != null ? -(air - 20) * 4 : 0}px)` }}><PlayerAvatar playerId={p.playerId} size={56} jerseyNumber={p.trueSeason.jerseyNumber} age={p.trueSeason.age} /></span>
    </div>
    <Meter value={v} zone={[0.85, 1]} />
    <p className="hint-text" role="status">Three jumps, best one counts. Stop the meter at the top.{best != null ? ` Best: ${best.toFixed(1)}"` : ''}</p>
    <button className="primary" onClick={jump} disabled={air != null || jumps.length >= 3}>Jump (space)</button>
  </div>;
}

function useKey(key: string, fn: () => void) {
  const ref = useRef(fn);
  useEffect(() => { ref.current = fn; });
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === key && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); ref.current(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [key]);
}

export function CombineDrills({ league, extras, teamId, board, onChange, onSelectPlayer }: {
  league: League; extras: GMLeagueExtras; teamId: string; board: { p: DraftProspect; report: ScoutingReport; ovr: number }[];
  onChange: (league: League, extras: GMLeagueExtras) => void; onSelectPlayer: (id: string) => void;
}) {
  const [playing, setPlaying] = useState<{ id: string; drill: Drill } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const drills = drillsFor(extras, teamId);
  const tested = Object.keys(drills);
  const full = tested.length >= COMBINE_TESTS;
  const prospect = playing ? board.find(b => b.p.playerId === playing.id)?.p : undefined;
  const finish = (score: number) => {
    if (!playing) return;
    const r = recordDrill(extras, teamId, playing.id, playing.drill, score);
    setNote(r.error ?? `${playing.id}: ${DRILL_LABEL[playing.drill]} ${fmt(playing.drill, score)}. ${DRILL_REVEALS[playing.drill].join(' and ')} revealed.`);
    if (!r.error) onChange(league, r.extras);
  };
  return <div className="combine-drills">
    <p className="hint-text">Run prospects through the drills yourself. Each drill reveals the hidden skills it tests: shooting drill reveals <b>Shooting</b>; sprint reveals <b>Athleticism</b>; vertical jump reveals <b>Finishing</b> and <b>Rebounding</b>. You only have time to test <b>{COMBINE_TESTS}</b> prospects a year ({tested.length}/{COMBINE_TESTS} used).</p>
    {note && <p className="hint-text" role="status">{note}</p>}
    {playing && prospect && <section className="combine-panel" aria-label={`${DRILL_LABEL[playing.drill]}: ${playing.id}`}>
      <header><b>{DRILL_LABEL[playing.drill]}</b> · {playing.id} <button onClick={() => setPlaying(null)}>Close</button></header>
      {playing.drill === 'shooting' ? <ShootingDrill key={`${playing.id}s`} p={prospect} onDone={finish} />
        : playing.drill === 'sprint' ? <SprintDrill key={`${playing.id}r`} p={prospect} onDone={finish} />
        : <VerticalDrill key={`${playing.id}v`} p={prospect} onDone={finish} />}
    </section>}
    <div className="finances-table-wrap"><table className="db-table combine-drill-table">
      <thead><tr><th>#</th><th className="col-name">Player</th><th>Pos</th><th>OVR</th><th>Shooting</th><th>Sprint</th><th>Vertical</th><th>Revealed</th></tr></thead>
      <tbody>{board.slice(0, 40).map((b, i) => {
        const d = drills[b.p.playerId], locked = !d && full;
        const cell = (drill: Drill) => <td>{d?.[drill] != null ? <span className="combine-score">{fmt(drill, d[drill]!)}</span> : null}
          <button className="combine-run" disabled={locked || !!playing} onClick={() => { setNote(null); setPlaying({ id: b.p.playerId, drill }); }}>{d?.[drill] != null ? 'Retry' : 'Run'}</button></td>;
        return <tr key={b.p.playerId} className={d ? 'current-season-row' : undefined}>
          <td>{i + 1}</td><td className="col-name"><button className="prospect-name" onClick={() => onSelectPlayer(b.p.playerId)}>{b.p.playerId}</button></td>
          <td>{primaryPosition(b.p.trueSeason)}</td><td>{b.ovr}</td>{cell('shooting')}{cell('sprint')}{cell('vertical')}
          <td>{Object.entries(b.report.revealed).map(([c, v]) => <span key={c} className="combine-reveal" title={`${c} ${v}`}>{c} {letterGrade(v!)} <small>{v}</small></span>)}</td>
        </tr>;
      })}</tbody>
    </table></div>
  </div>;
}
