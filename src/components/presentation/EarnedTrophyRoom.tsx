import type { TimelineSeason } from '../../simulation/timeline';
import type { TeamIdentity } from '../../simulation/teamIdentity';
import { TROPHIES } from '../../simulation/trophies';
import { earnedHonors } from '../../simulation/earnedHonors';
import { formatSeasonYear } from '../../simulation/calendar';
import { PixelTrophy } from '../PixelTrophy';
import { TitleBanner } from '../Banners';
import './nextLevel.css';

export function EarnedTrophyRoom({ seasons, teamId, identity, selected, onSeason }: { seasons: TimelineSeason[]; teamId: string; identity: TeamIdentity; selected?: string; onSeason: (season: string) => void }) {
  const honors = earnedHonors(seasons, teamId);
  const titles = honors.filter(h => h.award === 'champion');
  return <section className="earned-room" aria-label="Earned trophy room">
    <header><div><span className="pixel-eyebrow">BUILT SEASON BY SEASON</span><h3>Your trophy room</h3></div><span>{titles.length} titles · {honors.length} trophies</span></header>
    {titles.length > 0 && <div className="earned-rafters" aria-label="Earned championship banners">{titles.map(t => <button key={t.season} className="banner-select" aria-label={`Revisit championship ${formatSeasonYear(t.season)}`} aria-pressed={selected === t.season} onClick={() => onSeason(t.season)}><TitleBanner identity={identity} year={formatSeasonYear(t.season)} /></button>)}</div>}
    {honors.length ? <div className="earned-shelves">{[...honors].reverse().map(h => <button key={`${h.season}-${h.award}`} className="earned-trophy" aria-pressed={selected === h.season} aria-label={`${TROPHIES[h.award].label}${h.winner ? `, ${h.winner}` : ''}, ${formatSeasonYear(h.season)}. Revisit season`} onClick={() => onSeason(h.season)}>
      <span className="earned-glass"><PixelTrophy award={h.award} size={52} /></span><b>{TROPHIES[h.award].short}</b><small>{formatSeasonYear(h.season)}</small>{h.winner && <em>{h.winner}</em>}
    </button>)}</div> : <div className="earned-empty"><PixelTrophy award="champion" size={52} dim /><div><b>The first shelf is yours to fill.</b><p>Win a title or an individual season award with this franchise. Each trophy will open the season that earned it.</p></div></div>}
    {honors.length > 0 && <p className="earned-room-note">Select a trophy or banner to revisit its roster, awards and playoff run below.</p>}
  </section>;
}
