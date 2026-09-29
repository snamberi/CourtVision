import { useEffect, useRef, useState } from 'react';
import { NAME_COLORS, iconDef } from '../../profile/cosmetics';
import { TROPHY_ROAD, TROPHY_STEP, TROPHY_MAX, TITLE_COLORS, trophyParts, type TrophyRewardKind } from '../../profile/trophyRoad';
import { THEME_BY_ID, type ThemeId } from '../../theme/themes';
import { PROFILE_EVENT } from '../../profile/profile';
import { ProfileIcon, NameTag } from '../ProfileIcon';
import { PixelIcon } from '../PixelIcon';

function Reward({ kind, id }: { kind: TrophyRewardKind; id: string }) {
  if (kind === 'icon') return <span className="road-reward"><ProfileIcon id={id} size={34} /><small>{iconDef(id).name} · animated icon</small></span>;
  if (kind === 'color') return <span className="road-reward"><NameTag name={NAME_COLORS.find(c => c.id === id)?.name ?? id} icon={null} color={id} /><small>Animated name colour</small></span>;
  if (kind === 'titleColor') return <span className="road-reward"><NameTag name="Title colour" icon={null} title={TITLE_COLORS.find(c => c.id === id)?.name ?? id} titleColor={id} /><small>Title colour</small></span>;
  if (kind === 'title') return <span className="road-reward"><b className="road-title trophy-road-title">{id}</b><small>Legendary title</small></span>;
  const t = THEME_BY_ID.get(id as ThemeId), p = t?.preview;
  return <span className="road-reward road-look-reward">{p && <i className="road-look" aria-hidden="true" style={{ background: p.bg, borderColor: p.line }}><i style={{ background: p.panel, borderColor: p.line }} /><i style={{ background: p.accent }} /></i>}<small>{t?.name ?? id} app look</small></span>;
}

/** The Trophy Road: a legendary reward every 5,000 trophies up to 200,000, and where the trophies come from. */
export function TrophyRoad() {
  const [, setTick] = useState(0);
  useEffect(() => { const bump = () => setTick(t => t + 1); window.addEventListener(PROFILE_EVENT, bump); window.addEventListener('courtvision:progress', bump); return () => { window.removeEventListener(PROFILE_EVENT, bump); window.removeEventListener('courtvision:progress', bump); }; }, []);
  const parts = trophyParts();
  const trophies = parts.reduce((n, p) => n + p.trophies, 0);
  const stops = [...new Set(TROPHY_ROAD.map(([t]) => t))];
  const next = stops.find(t => t > trophies);
  const nextRef = useRef<HTMLLIElement>(null);
  useEffect(() => { nextRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'center' }); }, []);
  const prev = next ? next - TROPHY_STEP : TROPHY_MAX;
  const opened = TROPHY_ROAD.filter(([t]) => t <= trophies).length;
  return <section className="locker-bay level-road trophy-road">
    <h2><PixelIcon name="trophy" size={18} /> Trophy road</h2>
    <div className="road-head">
      <div className="profile-level trophy-count"><small>TROPHIES</small><b>{trophies.toLocaleString()}</b></div>
      <div className="profile-progress"><strong>{next ? `Next reward at ${next.toLocaleString()} trophies` : 'Every legendary reward is yours'}</strong>
        <div className="hunt-cap-bar trophy-bar"><i style={{ width: `${next ? Math.min(100, (trophies - prev) / TROPHY_STEP * 100) : 100}%` }} /></div>
        <small>{next ? `${(next - trophies).toLocaleString()} to go · ` : ''}{opened} of {TROPHY_ROAD.length} rewards · the road ends at {TROPHY_MAX.toLocaleString()}</small></div>
    </div>
    <ol className="road-stops">{stops.map(t => {
      const got = t <= trophies, isNext = t === next;
      return <li key={t} ref={isNext ? nextRef : undefined} className={`road-stop ${got ? 'got' : ''} ${isNext ? 'next' : ''} ${t % 50_000 === 0 ? 'major' : ''}`}>
        <span className="road-level">{t >= 1000 ? `${t / 1000}K` : t}</span>
        {TROPHY_ROAD.filter(([x]) => x === t).map(([, k, id]) => <Reward key={`${k}-${id}`} kind={k} id={id} />)}
        {got && <span className="road-check" aria-label="Unlocked">✓</span>}
      </li>;
    })}</ol>
    <table className="db-table profile-xp"><tbody>{parts.map(p => <tr key={p.id}><td className="col-name">{p.label}</td><td>{p.trophies.toLocaleString()} trophies</td></tr>)}</tbody></table>
    <p className="hint-text">Trophies come from winning: GM wins, seasons and titles (official leagues), achievements, careers and Hall of Famers, League Hunt runs and wins, Rebuild stars and titles, weekly challenges, daily goals, Legend Challenge stars and your card album. Equip what you unlock on the Profile tab: it shows on the leaderboards too.</p>
  </section>;
}
