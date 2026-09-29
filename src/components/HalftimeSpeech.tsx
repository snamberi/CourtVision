import { useMemo, useState } from 'react';
import type { PlayerSeason } from '../simulation/types';
import { SPEECHES, speechOutcome, type Speech } from '../simulation/halftime';
import { personalityOf } from '../simulation/personality';
import { PlayerAvatar } from './PlayerAvatar';

/**
 * The halftime locker room: pick a speech, see how the room takes it, then send them out. The outcome is fixed when
 * you give it (by personality and the score), and the second half is re-simulated with it.
 */
export function HalftimeSpeech({ teamName, roster, starters, margin, onGive, onSkip }: {
  teamName: string; roster: PlayerSeason[]; starters: string[]; margin: number;
  onGive: (speech: Speech, boost: Record<string, number>, headline: string) => void; onSkip: () => void;
}) {
  const [pick, setPick] = useState<Speech | null>(null);
  const outcome = useMemo(() => pick ? speechOutcome(pick, roster, margin, starters) : null, [pick, roster, margin, starters]);
  const shown = outcome ? [...outcome.reactions].filter(r => r.delta !== 0).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 6) : [];
  return <div className="halftime" role="dialog" aria-modal="true" aria-labelledby="halftime-head">
    <div className="halftime-box">
      <span className="pixel-eyebrow">HALFTIME · LOCKER ROOM</span>
      <h3 id="halftime-head">{teamName} {margin > 0 ? `lead by ${margin}` : margin < 0 ? `trail by ${-margin}` : 'are tied'}</h3>
      <p className="hint-text">What do you tell them? Players react by personality and the score; their reaction carries into the second half.</p>
      <div className="halftime-speeches" role="radiogroup" aria-label="Halftime speech">{SPEECHES.map(s => <button key={s.id} role="radio" aria-checked={pick === s.id} className={pick === s.id ? 'active' : ''} onClick={() => setPick(s.id)}>
        <b>{s.label}</b><small>{s.line}</small></button>)}</div>
      {outcome && <div className="halftime-room">
        <b className="halftime-headline">{outcome.headline}</b>
        <ul>{shown.map(r => { const p = roster.find(x => x.playerId === r.playerId); return <li key={r.playerId} className={r.delta > 0 ? 'up' : 'down'}>
          {p && <PlayerAvatar playerId={p.playerId} teamId={p.teamId} size={30} jerseyNumber={p.jerseyNumber} age={p.age} />}
          <span><b>{r.playerId}</b> <small>{p ? personalityOf(p).type : ''}</small><br />{r.note}</span><em>{r.delta > 0 ? '+' : ''}{r.delta}</em></li>; })}</ul>
      </div>}
      <div className="contest-actions">
        <button className="primary" disabled={!outcome} onClick={() => outcome && onGive(outcome.speech, outcome.boost, outcome.headline)}>Send them out</button>
        <button onClick={onSkip}>Say nothing</button>
      </div>
    </div>
  </div>;
}
