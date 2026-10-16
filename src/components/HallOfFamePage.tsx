import { formatSeasonYear } from '../simulation/calendar';
import { TeamLink } from './TeamLink';
import { useMemo, useState } from 'react';
import type { League } from '../simulation/league';
import { computeHallOfFame, HOF_THRESHOLD } from '../simulation/hallOfFame';
import { hallOfFameClasses, hallOfFamers, INDUCTION_SHARE } from '../simulation/hofVoting';
import '../improvements.css';

interface Props {
  league: League;
  onSelectPlayer: (playerId: string) => void;
}

type View = 'inducted' | 'ballots' | 'near';
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const ordinal = (n: number) => (n === 1 ? 'first' : n === 2 ? 'second' : n === 3 ? 'third' : `${n}th`);

export function HallOfFamePage({ league, onSelectPlayer }: Props) {
  const [view, setView] = useState<View>('inducted');
  const cases = useMemo(() => computeHallOfFame(league), [league]);
  const classes = useMemo(() => hallOfFameClasses(league, cases), [league, cases]);
  const members = useMemo(() => hallOfFamers(league, cases, classes), [league, cases, classes]);
  const voteOf = useMemo(() => new Map(classes.flatMap(c => c.inducted.map(i => [i.playerId, { ...i, season: c.season }] as const))), [classes]);
  const inducted = cases.filter((c) => members.has(c.playerId));
  const nearMisses = cases.filter((c) => !members.has(c.playerId));
  const latest = [...classes].reverse().find(c => c.inducted.length);
  const shown = view === 'near' ? nearMisses : inducted;

  return (
    <div className="hall-of-fame-page">
      <h4>Hall of Fame</h4>
      <p className="hint-text">
        Every season a class is voted in. Retired players are eligible the season after they retire and stay on the ballot for up to ten years;
        {` ${pct(INDUCTION_SHARE)}`} of the vote gets a player in. Support follows the Hall of Fame case (career totals, per-game production,
        longevity and awards; {HOF_THRESHOLD} is the bar) and grows a little each year on the ballot.
      </p>

      {latest && <section className="hof-ceremony" aria-label="Latest induction class">
        <span className="pixel-eyebrow">INDUCTION CEREMONY</span>
        <h3>Class of {formatSeasonYear(latest.season)}</h3>
        <div className="hof-ceremony-row">{latest.inducted.map(i => (
          <button key={i.playerId} className="hof-inductee" onClick={() => onSelectPlayer(i.playerId)}>
            <b>{i.playerId}</b><small>{pct(i.share)} · {i.year === 1 ? 'first ballot' : `${ordinal(i.year)} year on the ballot`}</small>
          </button>))}</div>
      </section>}

      <div className="stats-view-toggle">
        <button className={view === 'inducted' ? 'active' : ''} onClick={() => setView('inducted')}>Inducted ({inducted.length})</button>
        <button className={view === 'ballots' ? 'active' : ''} onClick={() => setView('ballots')}>Ballots ({classes.length})</button>
        <button className={view === 'near' ? 'active' : ''} onClick={() => setView('near')}>Not inducted ({nearMisses.length})</button>
      </div>

      {view === 'ballots' ? (
        classes.length === 0 ? <p className="empty-state">The first vote comes after the first completed season.</p> : (
          <div className="hof-ballots">{[...classes].reverse().map(c => (
            <div key={c.season} className="hof-ballot">
              <h5>{formatSeasonYear(c.season)} vote</h5>
              {c.ballot.length === 0 ? <p className="hint-text">Nobody eligible.</p> : <table className="db-table"><tbody>{c.ballot.map(b => (
                <tr key={b.playerId} className={b.inducted ? 'hof-yes' : ''}>
                  <td className="col-name"><button className="link-button" onClick={() => onSelectPlayer(b.playerId)}>{b.playerId}</button></td>
                  <td className="num">{pct(b.share)}</td><td className="muted">year {b.year}</td><td>{b.inducted ? <span className="cv-chip gold">Inducted</span> : null}</td>
                </tr>))}</tbody></table>}
            </div>))}</div>)
      ) : shown.length === 0 ? (
        <p className="empty-state">
          {cases.length === 0
            ? 'Nobody has retired yet — advance a few seasons and the first classes will start filling in.'
            : view === 'near' ? 'Every retiree so far made it in.' : 'No inductees yet.'}
        </p>
      ) : (
        <div className="hof-grid">
          {shown.map((c) => {
            const vote = voteOf.get(c.playerId);
            return (
              <div key={c.playerId} className={`hof-card ${members.has(c.playerId) ? 'inducted' : ''}`}>
                <div className="hof-card-header">
                  <span className="hof-name" onClick={() => onSelectPlayer(c.playerId)}>{c.playerId}</span>
                  <span className="hof-score">{c.score}</span>
                </div>
                <p className="hint-text hof-sub">
                  Retired {formatSeasonYear(c.finalSeason)} · <TeamLink name={c.finalTeamName} />
                  {vote ? ` · Class of ${formatSeasonYear(vote.season)}, ${pct(vote.share)}` : members.has(c.playerId) ? ' · retired before this league began' : ''}
                </p>
                <ul className="hof-resume">
                  {c.resume.map((line, i) => <li key={i}>{line}</li>)}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
