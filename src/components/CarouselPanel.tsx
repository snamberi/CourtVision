import type { League } from '../simulation/league';
import { hotSeats } from '../simulation/coachingCarousel';
import { formatSeasonYear } from '../simulation/calendar';
import { TeamLink } from './TeamLink';

/** The coaching carousel around the league: this year's moves and the coaches on the hot seat. */
export function CarouselPanel({ league, controlledTeamId }: { league: League; controlledTeamId: string | null }) {
  const events = league.coachingCarousel?.events ?? [];
  const latest = events.length ? events[events.length - 1].season : null;
  const moves = events.filter(e => e.season === latest).slice().reverse();
  const inSeason = ['regular_season', 'all_star', 'playoffs', 'awards_recap'].includes(league.seasonPhase ?? 'regular_season') && league.schedule.some(g => g.played);
  const seats = inSeason ? hotSeats(league, controlledTeamId).filter(s => s.heat >= 45).slice(0, 6) : [];
  const name = (id: string) => league.teams.find(t => t.teamId === id)?.name ?? id;
  return <section className="carousel-panel" aria-label="Coaching carousel">
    <h3>Coaching Carousel</h3>
    <div className="carousel-grid">
      <div>
        <h5>{latest ? `${formatSeasonYear(latest)} moves` : 'Moves'}</h5>
        {moves.length ? <ul className="carousel-moves">{moves.map((e, i) => <li key={i} className={`carousel-${e.kind}`}>
          <span className="carousel-tag">{e.kind === 'fired' ? 'FIRED' : e.kind === 'interim' ? 'INTERIM' : 'HIRED'}</span>
          <span><b>{e.coachId}</b> · <TeamLink name={name(e.teamId)} />{e.midseason ? ' · mid-season' : ''}<small>{e.detail}</small></span>
        </li>)}</ul> : <p className="hint-text">No coaching changes yet. AI owners review their head coaches after the season, and a disastrous start can cost a coach his job mid-season.</p>}
      </div>
      <div>
        <h5>Hot seat</h5>
        {seats.length ? <ul className="carousel-seats">{seats.map(s => <li key={s.teamId}>
          <span className="carousel-heat" style={{ ['--heat' as string]: `${s.heat}%` }} aria-label={`Heat ${s.heat} of 100`}><i /></span>
          <span><b>{s.coachId}</b> · <TeamLink name={name(s.teamId)} /><small>{s.reason}</small></span>
        </li>)}</ul> : <p className="hint-text">{inSeason ? 'No coach is in real trouble right now.' : 'The hot seat heats up once games are played.'}</p>}
      </div>
    </div>
  </section>;
}
