import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import { ARCHETYPE, rivalAgenda, rivalQuote, relationLabel, REFUSE_AT, type RivalGM } from '../simulation/gmRivals';
import { coachLook } from '../visuals/coachLook';
import { useTeamIdentity } from '../visuals/TeamIdentityContext';
import { CoachFigure } from './CoachFigure';
import { TeamLogo } from './TeamLogo';
import { formatSeasonYear } from '../simulation/calendar';

function RivalCard({ league, extras, rival }: { league: League; extras: GMLeagueExtras; rival: RivalGM }) {
  const team = league.teams.find(t => t.teamId === rival.teamId);
  const identity = useTeamIdentity(rival.teamId);
  const look = { ...coachLook(rival.name, rival.age), outfit: 'suit' as const };
  const agenda = rivalAgenda(league, extras, rival);
  const pct = (rival.relation + 100) / 2;
  return <article className={`gm-rival gm-rival-${rival.archetype}${rival.relation <= REFUSE_AT ? ' refuses' : ''}`}>
    <header>
      <svg viewBox="-24 -54 48 58" width="72" height="88" role="img" aria-label={rival.name}><rect x="-24" y="-54" width="48" height="58" fill="#0b1018" />
        <CoachFigure look={look} primary={identity?.primary ?? '#f47b20'} secondary={identity?.secondary ?? '#f4f0e6'} pose={rival.relation <= -15 ? 'cross' : rival.relation >= 40 ? 'up' : 'point'} /></svg>
      <div><span className="pixel-eyebrow">{ARCHETYPE[rival.archetype].label.toUpperCase()}</span><h3>{rival.name}</h3>
        <p className="gm-rival-team">{team && <TeamLogo team={team} size={22} />} GM, {team?.name ?? rival.teamId}</p></div>
    </header>
    <p className="hint-text">{ARCHETYPE[rival.archetype].blurb}</p>
    <div className="gm-rival-relation"><small>Grudge</small><span className="gm-rival-bar"><i style={{ left: `${pct}%` }} /></span><small>Respect</small></div>
    <p><b>{relationLabel(rival.relation)}</b> <small>({rival.relation > 0 ? '+' : ''}{rival.relation})</small></p>
    <blockquote>{rivalQuote(rival)}</blockquote>
    <p><b>His agenda:</b> {agenda.text}</p>
    {rival.memory.length > 0 ? <ul className="gm-rival-memory">{[...rival.memory].reverse().map((m, i) => <li key={i} className={m.delta < 0 ? 'bad' : 'good'}><small>{formatSeasonYear(m.season)}</small> {m.text} <em>{m.delta > 0 ? '+' : ''}{m.delta}</em></li>)}</ul>
      : <p className="hint-text">No deals with you yet. He'll remember the first one.</p>}
  </article>;
}

/** Your three GM rivals: who they are, what they think of you, what they remember, and what they want. */
export function GmRivalsPage({ league, extras }: { league: League; extras: GMLeagueExtras }) {
  const rivals = league.gmRivals?.rivals ?? [];
  return <div className="gm-rivals">
    <div className="season-feature-header"><div><span className="pixel-eyebrow">FRONT OFFICE</span><h2>GM Rivals</h2><p>Three general managers with long memories.</p></div></div>
    <p className="hint-text">They remember every trade they make with you. Fleece one and he holds a grudge; push it far enough and he won't take your calls at all. Fair deals (and giving the old-school GM his veterans) win them over. Grudges cool a little every season.</p>
    {rivals.length ? <div className="gm-rival-grid">{rivals.map(r => <RivalCard key={r.teamId} league={league} extras={extras} rival={r} />)}</div>
      : <p className="empty-state">Your rivals appear once you run a team.</p>}
  </div>;
}
