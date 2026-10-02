import { LEVELS, LEVEL_NAME, type Level, type RunView } from '../retention/challenge';

/** Rookie / Pro / Legend, with what each one changes in this mode. */
export function LevelPicker({ value, onChange, blurbs, label = 'Difficulty' }: { value: Level; onChange: (l: Level) => void; blurbs: Record<Level, string>; label?: string }) {
  return <div className="challenge-opt">
    <div className="hunt-pills" role="radiogroup" aria-label={label}>{LEVELS.map(l => <button key={l} role="radio" aria-checked={value === l} className={`hunt-pill ${value === l ? 'on' : ''}`} onClick={() => onChange(l)}>{LEVEL_NAME[l]}</button>)}</div>
    <p className="hunt-step-note">{blurbs[value]}</p>
  </div>;
}

/** Show the ratings / show the rarity colours on the spins: switch them off to challenge yourself. */
export function ViewToggles({ value, onChange, note }: { value: RunView; onChange: (v: RunView) => void; note?: string }) {
  return <div className="challenge-opt challenge-toggles">
    <label><input type="checkbox" checked={value.numbers} onChange={e => onChange({ ...value, numbers: e.target.checked })} /> Show ratings <small>(numbers on every player)</small></label>
    <label><input type="checkbox" checked={value.colors} onChange={e => onChange({ ...value, colors: e.target.checked })} /> Show rarity colours <small>(off: every card looks the same)</small></label>
    {note && <p className="hunt-step-note">{note}</p>}
  </div>;
}
