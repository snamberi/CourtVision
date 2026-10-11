import { PixelIcon } from './PixelIcon';
import './modeCards.css';

export interface DifficultyOption<T extends string> { id: T; name: string; blurb: string; /** 1 (easiest) to 4. */ level: number; /** Why it's locked, if it is. */ locked?: string; extra?: string; /** An icon instead of the heat meter (for choices that aren't difficulty). */ icon?: string }

/** Difficulty as cards: a heat meter, the name, what it changes, and a lock with the unlock rule when it's closed. */
export function DifficultyCards<T extends string>({ options, value, onChange, label = 'Difficulty' }: { options: DifficultyOption<T>[]; value: T; onChange: (id: T) => void; label?: string }) {
  return <div className="difficulty-cards" role="radiogroup" aria-label={label}>
    {options.map(o => <button key={o.id} type="button" role="radio" aria-checked={value === o.id} className="difficulty-card" disabled={!!o.locked} title={o.locked} onClick={() => onChange(o.id)}>
      <b>{o.locked ? <PixelIcon name="lock" size={14} /> : o.icon ? <PixelIcon name={o.icon} size={14} /> : <span className={`difficulty-meter ${o.level >= 4 ? 'max' : o.level >= 3 ? 'hot' : ''}`} aria-hidden="true">{[1, 2, 3, 4].map(n => <i key={n} className={n <= o.level ? 'on' : ''} />)}</span>}{o.name}{o.extra && <small>{o.extra}</small>}</b>
      <small>{o.locked ? `Locked: ${o.locked}` : o.blurb}</small>
    </button>)}
  </div>;
}
