import { memo, useMemo, useState } from 'react';
import type { LiveTeam } from '../simulation/liveBox';
import type { Highlight } from '../simulation/highlights';
import { HIGHLIGHT_LABEL, HIGHLIGHT_MIN, formatGameClock } from '../simulation/highlights';
import { TIMEOUTS_PER_GAME, type LiveCoachingCommand, type LiveDefense, type LivePace } from '../simulation/engine/game';
import type { PlayerSeason } from '../simulation/types';
import { primaryPosition } from '../simulation/teamStatus';

const mmss = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const shortName = (id: string) => { const parts = id.split(/\s+/); return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(' ')}` : id; };

function TeamTable({ team, name, foulLimit }: { team: LiveTeam; name: string; foulLimit: number }) {
  const bonus = team.teamFouls >= 5;
  return <div className="live-box-team">
    <div className="live-box-head"><strong>{name}</strong><span>{team.points} PTS</span>
      <span className={bonus ? 'live-box-bonus' : ''}>TEAM FOULS {team.teamFouls}{bonus ? ' · BONUS' : ''}</span>
      <span>TIMEOUTS {Math.max(0, TIMEOUTS_PER_GAME - team.timeoutsUsed)}</span></div>
    <div className="live-box-scroll"><table className="live-box-table">
      <thead><tr><th className="col-name">Player</th><th>MIN</th><th>PTS</th><th>FG</th><th>3P</th><th>FT</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>TO</th><th>PF</th><th>+/-</th></tr></thead>
      <tbody>{team.lines.map(l => <tr key={l.playerId} className={l.onCourt ? 'on-court' : l.seconds === 0 ? 'dnp' : ''}>
        <td className="col-name"><span className="live-dot" aria-label={l.onCourt ? 'On court' : undefined}>{l.onCourt ? '●' : ''}</span>{shortName(l.playerId)}</td>
        <td>{l.seconds ? mmss(l.seconds) : '—'}</td><td><b>{l.pts}</b></td><td>{l.fgm}-{l.fga}</td><td>{l.tpm}-{l.tpa}</td><td>{l.ftm}-{l.fta}</td>
        <td>{l.oreb + l.dreb}</td><td>{l.ast}</td><td>{l.stl}</td><td>{l.blk}</td><td>{l.tov}</td>
        <td className={l.pf >= foulLimit - 1 ? 'foul-trouble' : ''}>{l.pf}</td><td>{l.pm > 0 ? `+${l.pm}` : l.pm}</td></tr>)}</tbody>
    </table></div>
  </div>;
}
export const LiveBoxPanel = memo(function LiveBoxPanel({ home, away, homeName, awayName, foulLimit = 6 }: { home: LiveTeam; away: LiveTeam; homeName: string; awayName: string; foulLimit?: number }) {
  return <div className="live-box" aria-label="Live box score">
    <TeamTable team={home} name={homeName} foulLimit={foulLimit} /><TeamTable team={away} name={awayName} foulLimit={foulLimit} />
    <p className="hint-text">● on the floor now. Counts only what has been shown so far; the full box score has every stat.</p>
  </div>;
});

export interface CoachingProps {
  teamId: string;
  teamName: string;
  roster: PlayerSeason[];
  commands: LiveCoachingCommand[];
  onCommand: (command: LiveCoachingCommand) => string | null;
}
const DEFENSES: { id: LiveDefense; label: string }[] = [
  { id: 'man', label: 'Man-to-man' }, { id: 'switch', label: 'Switch everything' }, { id: 'drop', label: 'Drop coverage' },
  { id: 'zone', label: 'Zone' }, { id: 'pressure', label: 'Full-court pressure' },
];
export function CoachPanel({ coaching, team, atPossession, finished, onDecision, clockLabel }: { coaching: CoachingProps; team: LiveTeam; atPossession: number; finished: boolean; onDecision: () => void; clockLabel: string }) {
  const [picked, setPicked] = useState<string[]>(() => team.lines.filter(l => l.onCourt).map(l => l.playerId));
  const [message, setMessage] = useState<string | null>(null);
  const mine = coaching.commands.filter(c => c.teamId === coaching.teamId);
  const timeoutsLeft = TIMEOUTS_PER_GAME - mine.filter(c => c.kind === 'timeout').length;
  const pace = ([...mine].reverse().find(c => c.kind === 'pace') as Extract<LiveCoachingCommand, { kind: 'pace' }> | undefined)?.pace ?? 'normal';
  const defense = ([...mine].reverse().find(c => c.kind === 'defense') as Extract<LiveCoachingCommand, { kind: 'defense' }> | undefined)?.defense ?? 'default';
  const lines = new Map(team.lines.map(l => [l.playerId, l]));
  const available = coaching.roster.filter(p => lines.has(p.playerId));
  const send = (command: LiveCoachingCommand, done: string) => {
    onDecision();
    const error = coaching.onCommand(command);
    setMessage(error ?? done);
  };
  const toggle = (id: string) => setPicked(cur => cur.includes(id) ? cur.filter(x => x !== id) : cur.length >= 5 ? cur : [...cur, id]);
  const onFloor = team.lines.filter(l => l.onCourt).map(l => l.playerId).sort().join();
  return <div className="watch-coach-panel">
    <p className="hint-text">You are coaching {coaching.teamName}. Decisions apply from the next possession; everything already shown stays exactly as it happened, and the rest of the game is re-simulated.</p>
    {finished && <p className="empty-state">The game is final. Coaching decisions are locked in.</p>}
    <div className="coach-row">
      <button className="primary" disabled={finished || timeoutsLeft <= 0} onClick={() => send({ kind: 'timeout', atPossession, teamId: coaching.teamId }, 'Timeout called. Your players catch their breath.')}>Call Timeout ({timeoutsLeft} left)</button>
      <label>Pace<select aria-label="Pace" disabled={finished} value={pace} onChange={e => send({ kind: 'pace', atPossession, teamId: coaching.teamId, pace: e.target.value as LivePace }, `Pace set to ${e.target.value}.`)}>
        <option value="slow">Slow it down</option><option value="normal">Normal</option><option value="fast">Push the pace</option></select></label>
      <label>Defense<select aria-label="Defense" disabled={finished} value={defense} onChange={e => send({ kind: 'defense', atPossession, teamId: coaching.teamId, defense: e.target.value as LiveDefense }, `Defense switched to ${DEFENSES.find(d => d.id === e.target.value)?.label}.`)}>
        {defense === 'default' && <option value="default">Coach's game plan</option>}
        {DEFENSES.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}</select></label>
    </div>
    <fieldset className="coach-lineup" disabled={finished}><legend>Lineup — pick five ({picked.length}/5)</legend>
      <div className="coach-lineup-grid">{available.map(p => { const l = lines.get(p.playerId)!; const out = l.pf >= 6; return <label key={p.playerId} className={picked.includes(p.playerId) ? 'picked' : ''}>
        <input type="checkbox" checked={picked.includes(p.playerId)} disabled={out || (!picked.includes(p.playerId) && picked.length >= 5)} onChange={() => toggle(p.playerId)} />
        <span>{p.jerseyNumber != null ? `#${p.jerseyNumber} ` : ''}{shortName(p.playerId)}</span><small>{primaryPosition(p)} · {l.pts} PTS · {l.pf} PF{l.onCourt ? ' · ON' : ''}{out ? ' · FOULED OUT' : ''}</small></label>; })}</div>
      <button disabled={picked.length !== 5 || [...picked].sort().join() === onFloor} onClick={() => send({ kind: 'lineup', atPossession, teamId: coaching.teamId, lineup: picked }, 'Substitution made. That five stays in for the rest of the period unless someone fouls out.')}>Send In Lineup</button>
    </fieldset>
    {message && <p role="status" className="coach-status">{message}</p>}
    {mine.length > 0 && <details className="coach-log"><summary>Your decisions ({mine.length})</summary><ol>{mine.map((c, i) => <li key={i}>Possession {c.atPossession + 1}: {c.kind === 'timeout' ? 'Timeout' : c.kind === 'pace' ? `Pace → ${c.pace}` : c.kind === 'defense' ? `Defense → ${c.defense}` : `Lineup → ${c.lineup.map(shortName).join(', ')}`}</li>)}</ol></details>}
    <p className="hint-text">Now: {clockLabel}.</p>
  </div>;
}

export function HighlightsPanel({ highlights, completed, finished, regulationPeriods, onJump, onReel, reelCount, onShare, shareStatus, onVideo, videoStatus }: {
  highlights: Highlight[]; completed: number; finished: boolean; regulationPeriods: number; onJump: (h: Highlight) => void;
  onReel: () => void; reelCount: number; onShare: () => void; shareStatus: string | null; onVideo?: () => void; videoStatus: string | null;
}) {
  const seen = useMemo(() => highlights.filter(h => h.index < completed && h.score >= HIGHLIGHT_MIN).reverse(), [highlights, completed]);
  return <div className="highlights-panel">
    <div className="coach-row">
      <button className="primary" disabled={!reelCount} onClick={onReel}>▶ {reelCount}-play highlight reel (~60s)</button>
      <button disabled={!reelCount} onClick={onShare}>Share highlights</button>
      {onVideo && <button disabled={!reelCount || !!videoStatus?.startsWith('Recording')} onClick={onVideo}>Save reel as video</button>}
    </div>
    {!finished && <p className="hint-text">The reel covers the whole game, including how it ends.</p>}
    {(shareStatus || videoStatus) && <p role="status" className="coach-status">{videoStatus ?? shareStatus}</p>}
    {seen.length ? <ol className="highlight-list">{seen.map(h => <li key={h.index}><button onClick={() => onJump(h)}>
      <span className={`hl-kind hl-${h.kind}`}>{HIGHLIGHT_LABEL[h.kind]}</span><span>{h.text}</span><small>{formatGameClock(h.quarter, h.clockSeconds, regulationPeriods)} · {h.homeScoreAfter}–{h.awayScoreAfter}</small></button></li>)}</ol>
      : <p className="empty-state">Key moments appear here as they happen.</p>}
  </div>;
}
