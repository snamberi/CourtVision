import { Modal } from './Modal';
import { PixelIcon } from './PixelIcon';
import { STREAK_REWARDS, streakTrophies } from '../retention/streak';
import { plural } from '../lib/humanize';

/** The phone's Streak app: your streak today, your best, and every streak reward with how far away it is. */
export function StreakDialog({ streak, onClose, onProfile }: { streak: { current: number; best: number }; onClose: () => void; onProfile?: () => void }) {
  const next = STREAK_REWARDS.find(r => streak.best < r.days);
  const prevDays = [...STREAK_REWARDS].reverse().find(r => streak.best >= r.days)?.days ?? 0;
  const pct = next ? Math.round(((streak.current - prevDays) / (next.days - prevDays)) * 100) : 100;
  const earned = streakTrophies({ last: '', current: streak.current, best: streak.best });
  return <Modal label="Your daily streak" onClose={onClose} className="streak-dialog">
    <div className="streak-hero">
      <span className="streak-flame"><PixelIcon name="flame" size={40} /></span>
      <div><b>{plural(streak.current, 'day')}</b><small>in a row · best {plural(streak.best, 'day')}</small></div>
    </div>
    <p className="hint-text">Open Court Vision once a day (by UTC) to keep it going; a missed day starts it again. Rewards go by your <b>best</b> streak, so a broken streak never takes one back.</p>
    {next
      ? <div className="streak-next"><span>Next: <b>day {next.days}</b>, {next.title ? `the ${next.title} title and ` : ''}{next.trophies.toLocaleString()} trophies. {plural(Math.max(0, next.days - streak.current), 'day')} to go{streak.current < streak.best ? ' on this streak' : ''}.</span>
        <i className="streak-bar" aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></i></div>
      : <div className="streak-next"><span>Every streak reward is yours.</span></div>}
    <ol className="streak-rewards">{STREAK_REWARDS.map(r => {
      const got = streak.best >= r.days;
      return <li key={r.days} className={got ? 'got' : ''}>
        <small>DAY {r.days}</small>
        <b>{r.title ? `"${r.title}" title` : 'Trophies'}</b>
        <span>+{r.trophies.toLocaleString()} trophies</span>
        <em>{got ? <><PixelIcon name="check" size={12} /> Earned</> : `${plural(r.days - streak.current, 'day')} to go`}</em>
      </li>;
    })}</ol>
    <p className="hint-text">Earned so far: <b>{earned.toLocaleString()} trophies</b> from your streak. Titles show in Profile → Title.</p>
    <div className="streak-actions">
      {onProfile && <button className="primary" onClick={() => { onClose(); onProfile(); }}>Your profile</button>}
      <button onClick={onClose}>Close</button>
    </div>
  </Modal>;
}
