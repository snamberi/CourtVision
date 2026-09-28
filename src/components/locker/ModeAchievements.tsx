import { MODE_ACHIEVEMENTS, MODE_LABELS, isEarned, type Mode, type ModeStats } from '../../profile/modeAchievements';
import { PixelTrophy } from '../PixelTrophy';
import { PixelIcon } from '../PixelIcon';

/** The mode achievements in the Player Profile: grouped by mode, with progress on the ones still locked. */
export function ModeAchievements({ stats, rarity }: { stats: ModeStats; rarity: Record<string, number> }) {
  const modes = Object.keys(MODE_LABELS) as Mode[];
  const earned = MODE_ACHIEVEMENTS.filter(a => isEarned(a, stats)).length;
  return <section className="locker-bay">
    <h2><PixelIcon name="star" size={18} /> Mode achievements <small className="locker-count">{earned}/{MODE_ACHIEVEMENTS.length}</small></h2>
    {modes.map(mode => <div key={mode} className="locker-mode">
      <h3 className="hunt-subhead">{MODE_LABELS[mode]}</h3>
      <ul className="locker-achievements">{MODE_ACHIEVEMENTS.filter(a => a.mode === mode).map(a => {
        const [n, goal] = a.progress(stats), got = n >= goal, pct = rarity[`mode-${a.id}`];
        return <li key={a.id} className={got ? 'got' : ''}>
          <PixelTrophy award={a.icon} size={30} dim={!got} />
          <div><b>{a.name}</b><small>{a.description}</small>
            {!got && goal > 1 && <small className="locker-progress"><span className="locker-bar" aria-hidden="true"><i style={{ width: `${Math.round(n / goal * 100)}%` }} /></span>{a.label ? a.label(n, goal) : `${n.toLocaleString()} / ${goal.toLocaleString()}`}</small>}
            {pct != null && <small className="locker-rarity">{pct}% of GMs have this</small>}</div>
        </li>;
      })}</ul>
    </div>)}
  </section>;
}
