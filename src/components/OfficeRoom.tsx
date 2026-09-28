import type { League } from '../simulation/league';
import { PixelIcon } from './PixelIcon';
import type { GMLeagueExtras } from '../simulation/gm';
import { projectedSecurity, securityLabel } from '../simulation/frontOffice';
import { teamColors } from '../simulation/teamColors';

/*
 * Your front office as a little pixel room at the top of the dashboard: titles on the shelf, retired numbers on the
 * wall, the owner on the TV, the phone and the whiteboard. Every object is a button to the page it stands for.
 */

type Go = (tab: string) => void;
const MAX_TROPHIES = 6, MAX_JERSEYS = 4;

function officeFacts(league: League, extras: GMLeagueExtras, teamId: string) {
  const titles = (league.franchiseHistory ?? []).filter(r => r.teamSeasons?.some(t => t.teamId === teamId && t.playoffFinish === 'Champion')).map(r => r.season);
  const team = league.teams.find(t => t.teamId === teamId);
  const jerseys = [...(team?.retiredJerseys ?? [])].sort((a, b) => a.number - b.number);
  const fo = league.frontOffice;
  const security = fo?.status === 'employed' && fo.teamId === teamId ? projectedSecurity(league, extras) : null;
  return { titles, jerseys, security };
}

const Trophy = ({ x }: { x: number }) => <g transform={`translate(${x} 0)`}><rect x="2" y="0" width="8" height="6" className="or-gold" /><rect x="0" y="1" width="2" height="3" className="or-gold" /><rect x="10" y="1" width="2" height="3" className="or-gold" /><rect x="5" y="6" width="2" height="3" className="or-gold" /><rect x="3" y="9" width="6" height="2" className="or-wood" /></g>;

export function OfficeRoom({ league, extras, teamId, onGoTo }: { league: League; extras: GMLeagueExtras; teamId: string; onGoTo: Go }) {
  const { titles, jerseys, security } = officeFacts(league, extras, teamId);
  const { primary, secondary } = teamColors(teamId);
  const mood = security == null ? null : securityLabel(security);
  const face = mood?.tone === 'good' ? 'happy' : mood?.tone === 'ok' ? 'calm' : mood?.tone === 'warn' ? 'worried' : mood ? 'angry' : 'off';
  return <section className="office-room" aria-label="Your office" style={{ ['--or-team' as string]: primary, ['--or-team2' as string]: secondary }}>
    <div className="or-wall" aria-hidden="true"><i className="or-window" /><i className="or-floor" /></div>
    <button className="or-obj or-shelf" onClick={() => onGoTo('teamHistory')} title={titles.length ? `Titles: ${titles.join(', ')}` : 'No titles yet'}>
      <svg viewBox="0 0 80 18" width="120" height="27" shapeRendering="crispEdges" aria-hidden="true">
        {titles.slice(0, MAX_TROPHIES).map((_, i) => <Trophy key={i} x={2 + i * 13} />)}
        <rect x="0" y="11" width="80" height="3" className="or-wood" /><rect x="4" y="14" width="3" height="4" className="or-wood" /><rect x="73" y="14" width="3" height="4" className="or-wood" />
      </svg>
      <span>{titles.length ? `${titles.length} title${titles.length === 1 ? '' : 's'}${titles.length > MAX_TROPHIES ? ` (+${titles.length - MAX_TROPHIES} more)` : ''}` : 'Empty shelf'}</span>
    </button>
    <button className="or-obj or-jerseys" onClick={() => onGoTo('teamHistory')} title="Retired numbers">
      <span className="or-frames">{jerseys.length ? jerseys.slice(0, MAX_JERSEYS).map(j => <i key={j.number} title={j.playerId}>{j.number}</i>) : <i className="empty">?</i>}</span>
      <span>{jerseys.length ? `${jerseys.length} retired` : 'No retired numbers'}</span>
    </button>
    <button className="or-obj or-tv" onClick={() => onGoTo(security == null ? 'news' : 'gmOffice')} title={security == null ? 'League news' : `Owner: ${mood!.label} (${security})`}>
      <span className={`or-screen face-${face}`}><i className="or-owner" /><b>{security == null ? 'NEWS' : `${security}`}</b></span>
      <span>{security == null ? 'League news' : `Owner: ${mood!.label}`}</span>
    </button>
    <button className="or-obj or-board" onClick={() => onGoTo('roster')} title="Rotation and depth chart"><span className="or-xo" aria-hidden="true">X O X<br />O → X</span><span>Rotation</span></button>
    <button className="or-obj or-desk" onClick={() => onGoTo('tradeOffers')} title="Trade offers"><span className="or-phone" aria-hidden="true"><PixelIcon name="phone" size={22} /></span><span>Phone lines</span></button>
  </section>;
}
