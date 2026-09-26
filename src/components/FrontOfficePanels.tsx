import { useEffect, useId, useRef } from 'react';
import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import { formatSeasonYear } from '../simulation/calendar';
import {
  ACHIEVEMENTS, ACHIEVEMENT_BY_ID, OWNER_STYLE_BLURB, OWNER_STYLE_LABEL, goalProgress, projectedSecurity, securityLabel,
  type GoalStatus, type OwnerReview, type ReviewOutcome,
} from '../simulation/frontOffice';
import { PixelTrophy } from './PixelTrophy';
import { PixelIcon } from './PixelIcon';
import { TeamLogo } from './TeamLogo';

const STATUS_TEXT: Record<GoalStatus, string> = { met: 'Met', on_track: 'On track', at_risk: 'At risk', off_track: 'Off track', missed: 'Missed' };
const OUTCOME_TEXT: Record<ReviewOutcome, string> = { extended: 'Extended', retained: 'Retained', warned: 'Hot seat', fired: 'Fired' };

/** The 0–100 job security meter, in ten pixel blocks. */
export function SecurityMeter({ value, projected }: { value: number; projected?: number }) {
  const shown = projected ?? value;
  const { label, tone } = securityLabel(shown);
  const blocks = Math.round(shown / 10);
  return <div className={`fo-meter fo-tone-${tone}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={shown} aria-label={`Job security ${shown} of 100: ${label}`}>
    <div className="fo-meter-blocks" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <span key={i} className={i < blocks ? 'on' : ''} />)}</div>
    <div className="fo-meter-text"><b>{shown}</b><span>{label}</span>{projected != null && projected !== value && <small>{projected > value ? '▲' : '▼'} from {value} at last review</small>}</div>
  </div>;
}

function GoalList({ league, extras, compact }: { league: League; extras: GMLeagueExtras; compact?: boolean }) {
  const fo = league.frontOffice!;
  if (!fo.goals.length) return <p className="hint-text">The owner sets this season's goals when the regular season starts.</p>;
  return <ul className={`fo-goals${compact ? ' fo-goals--compact' : ''}`}>{fo.goals.map(g => {
    const p = goalProgress(league, extras, fo.teamId!, g);
    return <li key={g.id} className={`fo-goal fo-goal--${p.status}`}>
      <span className="fo-goal-weight" title={g.weight === 3 ? 'Main goal' : g.weight === 2 ? 'Important' : 'Bonus'}>{'◆'.repeat(g.weight)}</span>
      <span className="fo-goal-label">{g.label}</span>
      <span className="fo-goal-status">{STATUS_TEXT[p.status]}</span>
      {!compact && <span className="fo-goal-bar" aria-hidden="true"><span style={{ width: `${Math.round(p.ratio * 100)}%` }} /></span>}
      <small className="hint-text fo-goal-detail">{p.text}</small>
    </li>;
  })}</ul>;
}

/** Compact Home panel: owner, meter and goals. */
export function OwnerOfficeCard({ league, extras, onOpen }: { league: League; extras: GMLeagueExtras; onOpen: () => void }) {
  const fo = league.frontOffice;
  if (!fo) return null;
  if (fo.status !== 'employed' || !fo.teamId) {
    if (fo.status === 'spectator' && !fo.reviews.length) return null;
    return <section className="dashboard-panel fo-card"><h5>Front Office</h5>
      <p>{fo.status === 'unemployed' ? 'You are between jobs. Teams are calling.' : 'You are watching the league as a spectator. Offers arrive each offseason.'}</p>
      <button className="dashboard-link" onClick={onOpen}>» GM Office</button></section>;
  }
  const owner = fo.owners[fo.teamId];
  return <section className="dashboard-panel fo-card" aria-label="Owner's office">
    <h5>Owner's Office</h5>
    <div className="fo-card-row">
      <div className="fo-owner"><b>{owner?.name}</b><span className={`fo-style fo-style--${owner?.style}`}>{owner ? OWNER_STYLE_LABEL[owner.style] : ''}</span></div>
      <SecurityMeter value={fo.security} projected={projectedSecurity(league, extras)} />
    </div>
    <GoalList league={league} extras={extras} compact />
    <button className="dashboard-link" onClick={onOpen}>» GM Office</button>
  </section>;
}

/** The full front-office page: owner and goals, job security, career, achievements and front-office news. */
export function GmOfficePage({ league, extras, onAcceptOffer, onSpectate, onToggleFiring }: {
  league: League; extras: GMLeagueExtras; onAcceptOffer: (teamId: string) => void; onSpectate: () => void; onToggleFiring: (on: boolean) => void;
}) {
  const fo = league.frontOffice;
  if (!fo) return <div className="gm-office"><p className="hint-text">The front office opens when a league is loaded.</p></div>;
  const team = fo.teamId ? league.teams.find(t => t.teamId === fo.teamId) : null;
  const owner = fo.teamId ? fo.owners[fo.teamId] : null;
  const sandbox = league.settings.sandboxMode === true;
  const career = fo.reviews;
  const titles = career.filter(r => r.finish === 'Champion').length;
  const wins = career.reduce((n, r) => n + r.wins, 0), losses = career.reduce((n, r) => n + r.losses, 0);
  const unlocked = ACHIEVEMENTS.filter(a => fo.achievements[a.id]);
  const events = [...fo.events].reverse().slice(0, 12);

  return <div className="gm-office">
    <div className="stats-section-header"><h4>GM Office</h4></div>

    {fo.status === 'unemployed' && fo.offers.length > 0 && <JobOffersPanel league={league} onAccept={onAcceptOffer} onSpectate={onSpectate} />}

    <div className="gm-office-grid">
      <section className="dashboard-panel">
        <h5>{team ? 'Your owner' : 'Your status'}</h5>
        {team && owner ? <>
          <div className="fo-owner-head"><TeamLogo team={team} size={40} /><div><b>{owner.name}</b><span className="hint-text">Owner, {team.name}</span></div></div>
          <p><span className={`fo-style fo-style--${owner.style}`}>{OWNER_STYLE_LABEL[owner.style]}</span> <span className="hint-text">{OWNER_STYLE_BLURB[owner.style]}</span></p>
          <SecurityMeter value={fo.security} projected={projectedSecurity(league, extras)} />
          <p className="hint-text">{fo.seasonsWithTeam === 0 ? 'First season with this team: a bad year costs half as much.' : `${fo.seasonsWithTeam} completed season${fo.seasonsWithTeam === 1 ? '' : 's'} with this team.`}{fo.warned ? ' You are on the hot seat: another poor season can end it.' : ''}</p>
        </> : <p>{fo.status === 'spectator' ? 'Spectating. You can take a job when teams make offers in the offseason.' : 'Unemployed.'}</p>}
      </section>

      <section className="dashboard-panel">
        <h5>{formatSeasonYear(league.season)} goals</h5>
        {team ? <GoalList league={league} extras={extras} /> : <p className="hint-text">No team, no goals.</p>}
        <label className="fo-toggle"><input type="checkbox" checked={fo.firingEnabled && !sandbox} disabled={sandbox} onChange={e => onToggleFiring(e.target.checked)} />
          The owner can fire me{sandbox ? ' (off in Sandbox mode)' : ''}</label>
      </section>
    </div>

    <section className="dashboard-panel">
      <h5>GM career</h5>
      {career.length ? <>
        <p className="fo-career-line"><b>{wins}–{losses}</b> <span className="hint-text">({(wins / Math.max(1, wins + losses)).toFixed(3).replace(/^0/, '')}) · {career.length} season{career.length === 1 ? '' : 's'} · {titles} title{titles === 1 ? '' : 's'} · {new Set(career.map(r => r.teamId)).size} team{new Set(career.map(r => r.teamId)).size === 1 ? '' : 's'}</span></p>
        <div className="finances-table-wrap"><table className="db-table stat-line-table fo-career">
          <thead><tr><th>Season</th><th>Team</th><th>W</th><th>L</th><th>Finish</th><th>Goals</th><th>Security</th><th>Review</th></tr></thead>
          <tbody>{[...career].reverse().map(r => <tr key={`${r.season}-${r.teamId}`}>
            <td>{formatSeasonYear(r.season)}</td><td>{r.teamName}</td><td>{r.wins}</td><td>{r.losses}</td><td>{r.finish}</td>
            <td>{r.goals.filter(g => g.met).length}/{r.goals.length}</td>
            <td>{r.securityBefore} → {r.securityAfter}</td>
            <td><span className={`fo-outcome fo-outcome--${r.outcome}`}>{OUTCOME_TEXT[r.outcome]}</span></td>
          </tr>)}</tbody>
        </table></div>
      </> : <p className="hint-text">Your record starts after your first full season.</p>}
    </section>

    <section className="dashboard-panel">
      <h5>Achievements <span className="hint-text">{unlocked.length} / {ACHIEVEMENTS.length}</span></h5>
      <ul className="fo-achievements">{ACHIEVEMENTS.map(a => {
        const got = fo.achievements[a.id];
        const hidden = !got && a.secret;
        return <li key={a.id} className={got ? 'got' : 'locked'} title={got ? `Unlocked ${formatSeasonYear(got.season)}${got.teamName ? ` with ${got.teamName}` : ''}` : 'Locked'}>
          <PixelTrophy award={a.icon} size={28} dim={!got} />
          <div><b>{hidden ? '???' : a.name}</b><small>{hidden ? 'A secret achievement.' : a.description}</small>
            {got && <small className="fo-ach-when">{formatSeasonYear(got.season)}{got.teamName ? ` · ${got.teamName}` : ''}</small>}</div>
        </li>;
      })}</ul>
    </section>

    {events.length > 0 && <section className="dashboard-panel">
      <h5>Front office news</h5>
      <ul className="fo-events">{events.map(e => <li key={`${e.season}-${e.order}`}><small>{formatSeasonYear(e.season)}</small> {e.headline}</li>)}</ul>
    </section>}
  </div>;
}

function JobOffersPanel({ league, onAccept, onSpectate }: { league: League; onAccept: (teamId: string) => void; onSpectate: () => void }) {
  const fo = league.frontOffice!;
  return <section className="fo-offers" aria-label="Job offers">
    <h5><PixelIcon name="trade" size={16} /> Job offers</h5>
    <div className="fo-offer-list">{fo.offers.map(o => {
      const team = league.teams.find(t => t.teamId === o.teamId);
      return <div key={o.teamId} className="fo-offer">
        {team && <TeamLogo team={team} size={36} />}
        <div><b>{o.teamName}</b><small>{o.ownerName} · <span className={`fo-style fo-style--${o.ownerStyle}`}>{OWNER_STYLE_LABEL[o.ownerStyle]}</span></small><small className="hint-text">{o.pitch}</small></div>
        <button className="primary" onClick={() => onAccept(o.teamId)}>Take the job</button>
      </div>;
    })}</div>
    <button onClick={onSpectate}>Sit out and watch as a spectator</button>
  </section>;
}

/** Modal after a firing: pick a new team or spectate. The league can't move on until you decide. */
export function JobOffersDialog({ league, onAccept, onSpectate }: { league: League; onAccept: (teamId: string) => void; onSpectate: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => { const el = dialog.current!; if (!el.open) el.showModal(); return () => el.close(); }, []);
  const last = league.frontOffice?.reviews.at(-1);
  return <dialog ref={dialog} className="pixel-confirm fo-dialog" aria-labelledby={titleId} onCancel={e => e.preventDefault()}>
    <div className="pixel-confirm-heading"><PixelIcon name="exit" size={30} /><h2 id={titleId}>{last?.outcome === 'fired' ? "You're fired" : 'Teams are calling'}</h2></div>
    <div className="pixel-confirm-body">
      {last?.outcome === 'fired' && <p>{last.note}</p>}
      <p className="hint-text">Your career, record and achievements come with you.</p>
      <JobOffersPanel league={league} onAccept={onAccept} onSpectate={onSpectate} />
    </div>
  </dialog>;
}

/** The owner's end-of-season verdict, shown once when the offseason begins. */
export function OwnerReviewDialog({ review, newAchievements, onClose }: { review: OwnerReview; newAchievements: string[]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), ok = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useEffect(() => { const el = dialog.current!; if (!el.open) el.showModal(); ok.current?.focus(); return () => el.close(); }, []);
  const delta = review.securityAfter - review.securityBefore;
  return <dialog ref={dialog} className={`pixel-confirm fo-dialog fo-review fo-review--${review.outcome}`} aria-labelledby={titleId} onCancel={e => { e.preventDefault(); onClose(); }}>
    <div className="pixel-confirm-heading"><PixelTrophy award="eoy" size={30} /><h2 id={titleId}>Owner's review · {formatSeasonYear(review.season)}</h2></div>
    <div className="pixel-confirm-body">
      <p className="fo-review-verdict"><span className={`fo-outcome fo-outcome--${review.outcome}`}>{OUTCOME_TEXT[review.outcome]}</span> {review.note}</p>
      <p className="hint-text">{review.teamName}: {review.wins}–{review.losses}, {review.finish}.</p>
      <ul className="fo-goals">{review.goals.map(g => <li key={g.id} className={`fo-goal fo-goal--${g.met ? 'met' : 'missed'}`}>
        <span className="fo-goal-weight">{'◆'.repeat(g.weight)}</span><span className="fo-goal-label">{g.label}</span>
        <span className="fo-goal-status">{g.met ? 'Met' : 'Missed'}</span><small className="hint-text fo-goal-detail">{g.value}</small></li>)}</ul>
      <SecurityMeter value={review.securityAfter} />
      <p className="hint-text">Job security {delta >= 0 ? '+' : ''}{delta} this season.</p>
      {newAchievements.length > 0 && <div className="fo-new-ach"><b>Achievements unlocked</b>
        <ul>{newAchievements.map(id => { const a = ACHIEVEMENT_BY_ID.get(id); return a ? <li key={id}><PixelTrophy award={a.icon} size={20} /> {a.name}</li> : null; })}</ul></div>}
    </div>
    <div className="pixel-confirm-actions"><button ref={ok} className="primary" onClick={onClose}>{review.outcome === 'fired' ? 'See job offers' : 'Back to work'}</button></div>
  </dialog>;
}
