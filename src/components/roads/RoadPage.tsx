import { useEffect, useState, type ReactNode } from 'react';
import { LEVEL_ROAD } from '../../profile/cosmetics';
import { TROPHY_ROAD, TROPHY_MAX, trophyParts } from '../../profile/trophyRoad';
import { MAX_LEVEL, levelFor, totalXp, PROFILE_EVENT } from '../../profile/profile';
import { PixelIcon } from '../PixelIcon';
import { BrawlRoad, type RoadStop } from './BrawlRoad';
import { RoadReward } from './RoadReward';
import '../hunt/hunt.css';
import '../locker/locker.css';
import './roads.css';

/** At most three rewards on a card; the rest are counted. */
const cap = (nodes: ReactNode[]) => nodes.length > 3 ? [...nodes.slice(0, 3), <small key="more" className="brawl-more">+{nodes.length - 3} more</small>] : nodes;
const short = (t: number) => (t >= 1000 ? `${+(t / 1000).toFixed(1)}K` : `${t}`);

/** Re-renders when XP or trophies change. */
function useProgressTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick(t => t + 1);
    window.addEventListener(PROFILE_EVENT, bump); window.addEventListener('courtvision:progress', bump);
    return () => { window.removeEventListener(PROFILE_EVENT, bump); window.removeEventListener('courtvision:progress', bump); };
  }, []);
}

/** The Level Road or the Trophy Road, as its own page (the phone's Level Road and Trophy Road apps). */
export function RoadPage({ road, onExit, onSwitch }: { road: 'level' | 'trophy'; onExit: () => void; onSwitch?: () => void }) {
  useProgressTick();
  const level = road === 'level';
  return <div className="hunt road-page">
    <header className="hunt-top">
      <button className="hunt-exit" onClick={onExit}><PixelIcon name="exit" size={16} /> Main Menu</button>
      <div className="hunt-title"><span className="pixel-eyebrow">{level ? 'XP FROM EVERY MODE' : 'WIN TO CLIMB'}</span><h1>{level ? 'Level Road' : 'Trophy Road'}</h1></div>
      {onSwitch && <button className="relic-switch" onClick={onSwitch}><PixelIcon name={level ? 'trophy' : 'chart'} size={16} /> {level ? 'Trophy Road' : 'Level Road'}</button>}
    </header>
    {level ? <LevelRoadView /> : <TrophyRoadView />}
  </div>;
}

function LevelRoadView() {
  const xp = totalXp();
  const { level, into, need } = levelFor(xp);
  const levels = [...new Set(LEVEL_ROAD.map(([l]) => l))];
  const stops: RoadStop[] = levels.map(l => ({
    at: l, tick: `LV ${l}`, major: l % 50 === 0,
    rewards: cap(LEVEL_ROAD.filter(([x]) => x === l).map(([, k, id]) => <RoadReward key={`${k}-${id}`} kind={k} id={id} />)),
  }));
  const next = levels.find(l => l > level);
  const opened = LEVEL_ROAD.filter(([l]) => l <= level).length;
  return <section className="road-panel">
    <div className="road-summary">
      <div className="road-big"><small>LEVEL</small><b>{level}</b></div>
      <div><strong>{next ? `Next reward at level ${next}` : 'The whole road is yours'}</strong>
        <small>{xp.toLocaleString()} XP{need ? ` · ${(need - into).toLocaleString()} XP to level ${level + 1}` : ''} · {opened} of {LEVEL_ROAD.length} rewards · max level {MAX_LEVEL}</small></div>
    </div>
    <BrawlRoad stops={stops} value={level + (need ? into / need : 0)} marker={`LV ${level}`} label="Level Road" icon="star" />
    <p className="hint-text">XP comes from everything you finish in every mode. Wear what you unlock in your Closet (a phone app). Ranked tiers, leaderboards, achievements and the Season Pass unlock more on top of the road.</p>
  </section>;
}

function TrophyRoadView() {
  const parts = trophyParts();
  const trophies = parts.reduce((n, p) => n + p.trophies, 0);
  const at = [...new Set(TROPHY_ROAD.map(([t]) => t))];
  const stops: RoadStop[] = at.map(t => ({
    at: t, tick: short(t), major: t % 50_000 === 0,
    rewards: cap(TROPHY_ROAD.filter(([x]) => x === t).map(([, k, id]) => <RoadReward key={`${k}-${id}`} kind={k} id={id} titleNote="Legendary title" />)),
  }));
  const next = at.find(t => t > trophies);
  const opened = TROPHY_ROAD.filter(([t]) => t <= trophies).length;
  return <section className="road-panel">
    <div className="road-summary">
      <div className="road-big trophy"><small>TROPHIES</small><b>{trophies.toLocaleString()}</b></div>
      <div><strong>{next ? `Next reward at ${next.toLocaleString()} trophies` : 'Every legendary reward is yours'}</strong>
        <small>{next ? `${(next - trophies).toLocaleString()} to go · ` : ''}{opened} of {TROPHY_ROAD.length} rewards · the road ends at {TROPHY_MAX.toLocaleString()}</small></div>
    </div>
    <BrawlRoad stops={stops} value={trophies} marker={trophies.toLocaleString()} label="Trophy Road" />
    <h2 className="road-sub">Where your trophies come from</h2>
    <table className="db-table profile-xp"><tbody>{parts.map(p => <tr key={p.id}><td className="col-name">{p.label}</td><td>{p.trophies.toLocaleString()} trophies</td></tr>)}</tbody></table>
    <p className="hint-text">Trophies come from winning: GM wins, seasons and titles (official leagues), achievements, careers and Hall of Famers, League Hunt runs and wins, Rebuild stars and titles, weekly challenges, daily goals, Legend Challenge stars, the Season Pass and your card album. Wear what you unlock in your Closet (a phone app): it shows on the leaderboards too.</p>
  </section>;
}
