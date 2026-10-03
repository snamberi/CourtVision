import type { League } from '../simulation/league';
import { ROLE_LABEL, ROLE_BLURB, gmRole } from '../simulation/gmCareer';
import { formatSeasonYear } from '../simulation/calendar';
import { PixelIcon } from './PixelIcon';

/** GM Career on the dashboard: your title, what it lets you do, the road so far, and any job offer. */
export function GmCareerCard({ league, onTakeOffer }: { league: League; onTakeOffer: () => void }) {
  const c = league.gmCareer;
  if (!c) return null;
  const role = gmRole(league);
  const steps: (typeof role)[] = ['scout', 'assistant', 'gm'];
  return <section className="dashboard-panel gm-career-card" aria-label="GM Career">
    <h5><PixelIcon name="up" size={14} /> GM Career · {ROLE_LABEL[role]}</h5>
    <ol className="gm-career-steps">{steps.map(s => <li key={s} className={s === role ? 'now' : steps.indexOf(s) < steps.indexOf(role) ? 'done' : ''}>{ROLE_LABEL[s]}</li>)}</ol>
    <p className="hint-text">{ROLE_BLURB[role]}{role !== 'gm' ? ' The next step comes at the end of the season.' : ''}</p>
    {c.offer && role !== 'gm' && <div className="gm-career-offer"><b>The {c.offer.teamName} want you as their GM.</b><button className="primary" onClick={onTakeOffer}>Take the job</button></div>}
    {c.log.length > 0 && <ul className="gm-career-log">{[...c.log].reverse().slice(0, 5).map((e, i) => <li key={i}><small>{formatSeasonYear(e.season)}</small> {e.text}</li>)}</ul>}
  </section>;
}
