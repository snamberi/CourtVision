import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { AREA_LABEL, formatPlayTime, type PlayArea } from '../../retention/playTime';
import { loadWeeklyRanks } from '../../cloud/boards';
import { weekKey } from '../../retention/week';
import { teamColors } from '../../simulation/teamColors';
import { REAL_FRANCHISES } from '../../profile/favorites';
import { PixelIcon } from '../PixelIcon';

/* The public profile's extras: the banner behind the name, the featured trophy, recent activity with this week's
 * board places, and time played by mode as one bar. Your choices are made on your card (PublicProfileEditor). */

/** One colour per part of the game, used by every time-played bar. */
export const AREA_COLOR: Record<PlayArea, string> = { gm: '#f47b20', career: '#55c878', hunt: '#ffd166', perfect: '#4da3ff', draft: '#c18cff', rebuild: '#e85d5d', arcade: '#55c8c8', menu: '#94a0b2', other: '#ff7aa2' };

/** Time played split by mode, as one bar with a legend. */
export function PlayTimeBar({ areas }: { areas: Partial<Record<PlayArea, number>> }) {
  const parts = (Object.entries(areas) as [PlayArea, number][]).filter(([k, v]) => k in AREA_LABEL && v >= 60).sort((a, b) => b[1] - a[1]);
  const total = parts.reduce((n, [, v]) => n + v, 0);
  if (!total) return null;
  return <div className="play-bar">
    <div className="play-bar-track" role="img" aria-label={parts.map(([k, v]) => `${AREA_LABEL[k]} ${Math.round(v / total * 100)}%`).join(', ')}>
      {parts.map(([k, v]) => <i key={k} style={{ width: `${v / total * 100}%`, background: AREA_COLOR[k] }} title={`${AREA_LABEL[k]}: ${formatPlayTime(v)}`} />)}
    </div>
    <ul className="play-bar-legend">{parts.map(([k, v]) => <li key={k}><i style={{ background: AREA_COLOR[k] }} aria-hidden="true" /><small>{AREA_LABEL[k]}</small> <b>{formatPlayTime(v)}</b></li>)}</ul>
  </div>;
}

/** The banner behind a name: a team's colours, or the clan flag (passed in) on the clan's colours. */
export function ProfileBanner({ banner, flag, children }: { banner: string | undefined; flag?: ReactNode; children: ReactNode }) {
  const team = banner?.startsWith('team:') && REAL_FRANCHISES.some(t => t.id === banner.slice(5)) ? banner.slice(5) : null;
  const c = team ? teamColors(team) : null;
  const style = c ? { '--banner-a': c.primary, '--banner-b': c.secondary } as CSSProperties : undefined;
  if (!c && !(banner === 'clan' && flag)) return <>{children}</>;
  return <div className={`profile-banner ${c ? 'team' : 'clan'}`} style={style}>
    {!c && <span className="profile-banner-flag" aria-hidden="true">{flag}</span>}
    <div className="profile-banner-body">{children}</div>
  </div>;
}

export interface Featured { kind: 'title' | 'achievement'; name: string; detail?: string }
export function FeaturedTrophy({ featured }: { featured: Featured | null | undefined }) {
  if (!featured?.name) return null;
  return <div className={`featured-trophy ${featured.kind}`}>
    <span className="featured-trophy-icon"><PixelIcon name={featured.kind === 'title' ? 'crown' : 'trophy'} size={22} /></span>
    <div><small>FEATURED {featured.kind === 'title' ? 'TITLE' : 'ACHIEVEMENT'}</small><b>{featured.name}</b>{featured.detail && <span>{featured.detail}</span>}</div>
  </div>;
}

const KIND_ICON: Record<string, string> = { title: 'trophy', achievement: 'check', hunt: 'crown', perfect: 'star', career: 'user', rebuild: 'hammer', draft: 'cards', survival: 'shield', story: 'book', bracket: 'list' };
const ago = (at: number, now: number) => { const m = Math.max(0, Math.round((now - at) / 60000)); return m < 60 ? `${m || 1}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`; };

/** The last five things they finished, and where they stand on this week's boards. */
export function RecentActivity({ userId, activity }: { userId: string; activity: { at: number; kind: string; line: string }[] | undefined }) {
  const [ranks, setRanks] = useState<{ board: string; label: string; rank: number; of: number }[] | null>(null);
  const [now] = useState(() => Date.now());
  useEffect(() => { let live = true; loadWeeklyRanks(userId, weekKey()).then(r => { if (live) setRanks(r); }, () => { if (live) setRanks([]); }); return () => { live = false; }; }, [userId]);
  const items = (activity ?? []).slice(0, 5);
  if (!items.length && !ranks?.length) return null;
  return <div className="recent-activity">
    <small className="showcase-sub">RECENT ACTIVITY</small>
    <ul>
      {(ranks ?? []).slice(0, 3).map(r => <li key={`w-${r.board}`} className="weekly"><PixelIcon name="chart" size={14} /><span><b>#{r.rank}</b> of {r.of} on the {r.label}</span><small>this week</small></li>)}
      {items.map((a, i) => <li key={`${a.at}-${i}`}><PixelIcon name={KIND_ICON[a.kind] ?? 'star'} size={14} /><span>{a.line}</span><small>{ago(a.at, now)}</small></li>)}
    </ul>
  </div>;
}
