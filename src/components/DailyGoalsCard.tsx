import { useEffect, useState } from 'react';
import { GOALS, ALL_DONE_BONUS, loadDaily, DAILY_EVENT, type DailyState } from '../profile/dailyGoals';
import { PixelIcon } from './PixelIcon';

/** Today's three goals on the dashboard, with progress and the XP they pay. */
export function DailyGoalsCard({ official }: { official: boolean }) {
  const [state, setState] = useState<DailyState>(() => loadDaily());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const sync = () => { setState(loadDaily()); setNow(Date.now()); };
    window.addEventListener(DAILY_EVENT, sync);
    const t = setInterval(sync, 60_000);
    return () => { window.removeEventListener(DAILY_EVENT, sync); clearInterval(t); };
  }, []);
  const midnight = Date.parse(`${state.date}T00:00:00Z`) + 86_400_000;
  const hours = Math.max(0, Math.ceil((midnight - now) / 3_600_000));
  const done = state.goals.filter(g => g.done).length;
  return <section className="daily-goals" aria-label="Daily goals">
    <header><span className="pixel-eyebrow"><PixelIcon name="star" size={12} /> DAILY GOALS</span><small>{done}/3 done · new goals in {hours}h{done === 3 ? ` · +${ALL_DONE_BONUS} XP bonus earned` : ` · all three: +${ALL_DONE_BONUS} XP bonus`}</small></header>
    <ul>{state.goals.map(p => { const d = GOALS.find(g => g.id === p.id); if (!d) return null; return <li key={p.id} className={p.done ? 'done' : ''}>
      <span className="dg-check" aria-hidden="true">{p.done ? '✓' : ''}</span>
      <span className="dg-text">{d.text}</span>
      {d.target > 1 && <span className="dg-bar" aria-label={`${Math.min(p.progress, d.target)} of ${d.target}`}><i style={{ width: `${Math.min(100, p.progress / d.target * 100)}%` }} /></span>}
      <b>{p.done ? 'Done' : d.target > 1 ? `${Math.min(p.progress, d.target)}/${d.target}` : ''}</b><small>+{d.xp} XP</small>
    </li>; })}</ul>
    {!official && <p className="hint-text">Sandbox or God Mode was used in this league: goals only count in other leagues.</p>}
  </section>;
}
