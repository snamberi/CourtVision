import type { CareerMeta } from '../../career/career';
import { careerResume } from '../../career/career';
import { cardTier, type CardTier } from '../../career/card';
import { formatSeasonYear as fy } from '../../simulation/calendar';
import { PlayerAvatar } from '../PlayerAvatar';

/*
 * Your created player as a trading card that changes with his career. The card's finish follows his overall (bronze,
 * silver, gold, holo) and turns to foil when he reaches the Hall of Fame; the ring shows his overall against 99; the
 * strip is last season (or the career once he retires); the badges count what he has won; and a row of pips, one per
 * season, draws the arc of the career in colour.
 */

const TIER_NAME: Record<CardTier, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', holo: 'Holo', foil: 'Hall of Fame foil' };
const per = (n: number, g: number) => (g ? String(Math.round(n / g)) : '0');

/** A season's pip colour class, by that season's overall. */
const pipTier = (ovr: number) => (ovr >= 90 ? 'p-holo' : ovr >= 80 ? 'p-gold' : ovr >= 70 ? 'p-silver' : 'p-bronze');

export function CareerCard({ meta, overall, age, teamName, prime }: { meta: CareerMeta; overall: number | null; age?: number; teamName: string; prime?: number }) {
  const retired = meta.status === 'retired' ? meta.retired : undefined;
  const hof = !!retired && retired.hallOfFame !== 'no';
  const ovr = overall ?? meta.years.at(-1)?.overall ?? 0;
  const tier = cardTier(ovr, hof);
  const last = meta.years.at(-1);
  const r = careerResume(meta);
  // The strip: last season while he plays, the whole career once he retires.
  const line = retired
    ? { label: 'CAREER', g: r.games, pts: r.pts, reb: r.reb, ast: r.ast }
    : last ? { label: fy(last.season), g: last.stats.gamesPlayed, pts: last.stats.points, reb: last.stats.oreb + last.stats.dreb, ast: last.stats.ast } : null;
  const badges = [
    r.titles && { k: 'ring', t: `${r.titles}× Champion`, s: `${r.titles}× RING${r.titles === 1 ? '' : 'S'}` },
    r.mvp && { k: 'mvp', t: `${r.mvp}× MVP`, s: 'MVP' },
    r.fmvp && { k: 'fmvp', t: `${r.fmvp}× Finals MVP`, s: 'FMVP' },
    r.allStar && { k: 'star', t: `${r.allStar}× All-Star`, s: `${r.allStar}× AS` },
    r.dpoy && { k: 'dpoy', t: `${r.dpoy}× Defensive Player of the Year`, s: 'DPOY' },
    r.roy && { k: 'roy', t: 'Rookie of the Year', s: 'ROY' },
  ].filter(Boolean) as { k: string; t: string; s: string }[];
  const circ = 2 * Math.PI * 26;
  return <figure className={`cv-card tier-${tier}`} aria-label={`${meta.playerId}: ${TIER_NAME[tier]} card, ${ovr} overall`}>
    <div className="cv-card-inner">
      <div className="cv-card-top">
        <span>{retired ? `RETIRED · ${fy(retired.season)}` : `${teamName.toUpperCase()}${last ? ` · SEASON ${meta.years.length + (meta.status === 'active' ? 1 : 0)}` : ' · ROOKIE'}`}</span>
        <span className="cv-card-tier">{TIER_NAME[tier].toUpperCase()}</span>
      </div>
      <div className="cv-card-art">
        <PlayerAvatar playerId={meta.playerId} primaryColor="#f47b20" secondaryColor="#f4f0e6" size={96} pose={hof ? 'raise' : 'stand'} />
        <svg className="cv-card-ring" viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="26" className="ring-back" />
          <circle cx="32" cy="32" r="26" className="ring-fill" strokeDasharray={`${(Math.min(99, ovr) / 99) * circ} ${circ}`} transform="rotate(-90 32 32)" />
          <text x="32" y="36" textAnchor="middle">{ovr || '—'}</text>
        </svg>
      </div>
      <div className="cv-card-name">
        <b>{meta.playerId}</b>
        <small>#{meta.identity.jersey} · {meta.identity.pos}{age ? ` · age ${age}` : ''}{prime ? ` · prime ${prime}` : ''}</small>
      </div>
      {line ? <dl className="cv-card-strip"><div><dt>{line.label}</dt><dd>{line.g} GP</dd></div><div><dt>PTS</dt><dd>{per(line.pts, line.g)}</dd></div><div><dt>REB</dt><dd>{per(line.reb, line.g)}</dd></div><div><dt>AST</dt><dd>{per(line.ast, line.g)}</dd></div></dl>
        : <p className="cv-card-empty">No games yet. His card fills in as he plays.</p>}
      {badges.length > 0 && <ul className="cv-card-badges">{badges.map(b => <li key={b.k} className={`b-${b.k}`} title={b.t}>{b.s}</li>)}</ul>}
      {meta.years.length > 0 && <ol className="cv-card-pips" aria-label="Overall by season">{meta.years.map(y => <li key={y.season} className={pipTier(y.overall)} title={`${fy(y.season)}: ${y.overall} overall`} />)}</ol>}
    </div>
  </figure>;
}
