import { useState } from 'react';
import type { League } from '../simulation/league';
import { GAME_LENGTH_PRESETS, MAX_PERIODS, MIN_PERIOD_MINUTES, MAX_PERIOD_MINUTES, cleanGameLength, gameLengthText, periodWord, withGameLength } from '../simulation/gameLength';
import './gameLength.css';

const PERIOD_COUNTS = Array.from({ length: MAX_PERIODS }, (_, i) => i + 1);
const countLabel = (n: number) => `${n} ${periodWord(n) === 'half' ? 'halves' : `${periodWord(n)}${n === 1 ? '' : 's'}`}`;

/** Game length: a preset, or any number of periods (1-8) of any whole number of minutes (1-30). */
export function GameLengthPicker({ periods, minutes, onChange, id }: { periods: number; minutes: number; onChange: (periods: number, minutes: number) => void; id: string }) {
  // While what is typed is not a valid length (empty, 0, 45) the box shows it as typed; leaving the box puts the
  // current length back.
  const [draft, setDraft] = useState<string | null>(null);
  const set = (p: number, m: number) => { const g = cleanGameLength(p, m); onChange(g.periods, g.minutes); };
  const typeMinutes = (v: string) => {
    const n = Number(v);
    if (v.trim() && Number.isInteger(n) && n >= MIN_PERIOD_MINUTES && n <= MAX_PERIOD_MINUTES) { setDraft(null); set(periods, n); }
    else setDraft(v);
  };
  return <div className="game-length">
    <div className="game-length-presets" role="radiogroup" aria-label="Game length presets">{GAME_LENGTH_PRESETS.map(g => {
      const on = g.periods === periods && g.minutes === minutes;
      return <button key={g.label} type="button" role="radio" aria-checked={on} className={on ? 'selected' : ''} onClick={() => set(g.periods, g.minutes)}>{g.label}<small>{g.periods}×{g.minutes}</small></button>;
    })}</div>
    <div className="game-length-inputs">
      <label htmlFor={`${id}-periods`}>Periods</label>
      <select id={`${id}-periods`} className="year-input" value={periods} onChange={e => set(Number(e.target.value), minutes)}>{PERIOD_COUNTS.map(n => <option key={n} value={n}>{countLabel(n)}</option>)}</select>
      <span aria-hidden="true">×</span>
      <label htmlFor={`${id}-minutes`}>Minutes each</label>
      <input id={`${id}-minutes`} className="year-input" type="number" inputMode="numeric" min={MIN_PERIOD_MINUTES} max={MAX_PERIOD_MINUTES} step={1} value={draft ?? String(minutes)}
        onChange={e => typeMinutes(e.target.value)} onBlur={() => setDraft(null)} />
    </div>
    <small className="game-length-total">{gameLengthText(periods, minutes)}. Minutes, stats and fatigue scale with the length.</small>
  </div>;
}

/** League Settings → League Rules: change the game length of a league already being played. */
export function GameLengthCard({ league, onChange }: { league: League; onChange: (update: (l: League) => League) => void }) {
  const era = league.settings.era;
  return <section className="settings-card">
    <h4>Game length</h4>
    <p className="hint-text">Applies from the next game played. Rotations and minutes targets stretch or shrink to fit; per-game stats follow the minutes, and per-48 numbers stay comparable.</p>
    <GameLengthPicker id="league-length" periods={era.numberOfQuarters} minutes={era.quarterLengthMinutes}
      onChange={(periods, minutes) => onChange(l => ({ ...l, settings: { ...l.settings, era: withGameLength(l.settings.era, periods, minutes) } }))} />
  </section>;
}
