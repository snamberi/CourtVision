import { useEffect, useRef, useState } from 'react';
import { totalXp, PROFILE_EVENT } from '../../profile/profile';
import { SEASON_REWARDS, SEASON_TIERS, SEASON_COSMETIC_EVERY, daysLeft, noteSeason, type SeasonCosmetic } from '../../retention/season';
import { paySeasonSpins } from '../../relics/rewards';
import { loadRelics, RELICS_EVENT } from '../../relics/relics';
import type { TrophyRewardKind } from '../../profile/trophyRoad';
import { PixelIcon } from '../PixelIcon';
import { SeasonPass } from '../locker/SeasonPass';
import { RoadReward } from './RoadReward';
import '../hunt/hunt.css';
import '../locker/locker.css';
import './roads.css';

const AVATAR_KINDS = new Set(['skin', 'hair', 'hairColor', 'beard', 'outfit', 'hat', 'eyes', 'neck', 'shoes', 'aura']);
/** A season cosmetic as a road reward (character pieces are "category:id"). */
const asReward = (r: SeasonCosmetic): { kind: TrophyRewardKind; id: string } => AVATAR_KINDS.has(r.kind) ? { kind: 'avatar', id: `${r.kind}:${r.id}` } : { kind: r.kind as TrophyRewardKind, id: r.id };

/** Tier column width, in pixels. */
const COL = 76;

/**
 * The Season Pass page: the season's banner and your tier, then the pass itself, five tiers to a block: the
 * season cosmetic on top, the tier track in the middle, and a free Lucky Spin for every tier underneath. Below it:
 * the weekly missions, the monthly pass and the daily streak.
 */
export function SeasonPassPage({ onExit, onRelics }: { onExit: () => void; onRelics?: () => void }) {
  // Opening the pass pays the Lucky Spins for any tier reached since the last look.
  const [paid, setPaid] = useState(() => paySeasonSpins(totalXp()));
  const [, setTick] = useState(0);
  useEffect(() => {
    const bump = () => { const more = paySeasonSpins(totalXp()); if (more) setPaid(p => p + more); setTick(t => t + 1); };
    window.addEventListener(PROFILE_EVENT, bump); window.addEventListener('courtvision:progress', bump); window.addEventListener(RELICS_EVENT, bump);
    return () => { window.removeEventListener(PROFILE_EVENT, bump); window.removeEventListener('courtvision:progress', bump); window.removeEventListener(RELICS_EVENT, bump); };
  }, []);
  const p = noteSeason(totalXp());
  const rewards = SEASON_REWARDS[p.season.id] ?? [];
  const free = loadRelics().luckySpins ?? 0;
  const left = daysLeft(p.season);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = scroller.current; if (el) el.scrollLeft = Math.max(0, (p.tier + 0.5) * COL - el.clientWidth / 2); }, [p.tier]);
  const blocks = Array.from({ length: SEASON_TIERS / SEASON_COSMETIC_EVERY }, (_, b) => b);
  const fill = p.tier >= SEASON_TIERS ? SEASON_TIERS * COL : (p.tier + p.into / p.need) * COL;

  return <div className="hunt road-page season-page">
    <header className="hunt-top">
      <button className="hunt-exit" onClick={onExit}><PixelIcon name="exit" size={16} /> Main Menu</button>
      <div className="hunt-title"><span className="pixel-eyebrow">FREE FOR EVERYONE · EVERY MODE COUNTS</span><h1>Season Pass</h1></div>
      {onRelics && <button className="relic-switch" onClick={onRelics}><PixelIcon name="flame" size={16} /> Relic Vault{free ? ` · ${free} free Lucky Spin${free === 1 ? '' : 's'}` : ''}</button>}
    </header>

    <section className={`sp-banner season-${p.season.id}`} aria-label={`Season ${p.season.number}: ${p.season.name}`}>
      <div className="sp-banner-text">
        <span className="sp-season">SEASON {p.season.number}</span>
        <h2 className="sp-name" data-text={p.season.name.toUpperCase()}>{p.season.name.toUpperCase()}</h2>
        <p>{p.season.tagline}</p>
        <small>{left > 0 ? `Ends in ${left} day${left === 1 ? '' : 's'}` : 'Season over: what you unlocked is yours for good'}</small>
      </div>
      <div className="sp-tier-box" aria-label={`Tier ${p.tier} of ${SEASON_TIERS}`}>
        <small>TIER</small><b>{p.tier}</b>
        <i className="sp-tier-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, p.into / p.need * 100)}%` }} /></i>
        <small>{p.tier >= SEASON_TIERS ? 'Pass complete' : `${p.need - p.into} XP to tier ${p.tier + 1}`}</small>
      </div>
    </section>
    {paid > 0 && <p className="relic-note" role="status"><PixelIcon name="flame" size={14} /> The pass paid {paid} free Lucky Spin{paid === 1 ? '' : 's'}. {onRelics ? 'Open them in the Relic Vault.' : ''}</p>}

    <div className="sp-road" ref={scroller} role="region" aria-label="Season Pass tiers" tabIndex={0}>
      <div className="sp-inner" style={{ width: SEASON_TIERS * COL, ['--sp-col' as string]: `${COL}px` }}>
        <ol className="sp-top">{blocks.map(b => {
          const tier = (b + 1) * SEASON_COSMETIC_EVERY, r = rewards.find(x => x.tier === tier);
          const got = p.tier >= tier, next = !got && p.tier >= tier - SEASON_COSMETIC_EVERY;
          return <li key={b} className={`sp-card ${got ? 'got' : ''} ${next ? 'next' : ''} ${tier === SEASON_TIERS ? 'final' : ''}`}>
            <span className="sp-card-tier">TIER {tier}</span>
            {r ? <RoadReward {...asReward(r)} titleNote={tier === SEASON_TIERS ? 'Final title' : 'Title'} /> : null}
            <span className="sp-card-label">{r?.label}</span>
            {got ? <span className="brawl-check" aria-label="Unlocked"><PixelIcon name="check" size={12} /></span> : <span className="brawl-lock" aria-hidden="true"><PixelIcon name="lock" size={12} /></span>}
          </li>;
        })}</ol>
        <div className="sp-track" aria-hidden="true">
          <i className="sp-fill" style={{ width: fill }} />
          {Array.from({ length: SEASON_TIERS }, (_, i) => <b key={i} className={`sp-node ${i + 1 <= p.tier ? 'got' : ''} ${(i + 1) % SEASON_COSMETIC_EVERY === 0 ? 'big' : ''}`} style={{ left: i * COL + COL / 2 }}>{i + 1}</b>)}
        </div>
        <ol className="sp-bottom">{Array.from({ length: SEASON_TIERS }, (_, i) => {
          const tier = i + 1, got = p.tier >= tier;
          return <li key={tier} className={`sp-spin ${got ? 'got' : ''}`} aria-label={`Tier ${tier}: free Lucky Spin${got ? ', earned' : ''}`}>
            <PixelIcon name={got ? 'check' : 'flame'} size={14} /><small>Lucky Spin</small>
          </li>;
        })}</ol>
      </div>
    </div>
    <p className="hint-text">Every XP you earn this season, in any mode, fills the pass ({p.need} XP a tier). Every tier pays a free Lucky Spin for the Relic Vault (2× luck, no Commons), and every {SEASON_COSMETIC_EVERY} tiers unlocks a {p.season.name} cosmetic for good: icon, name colour, title and title colour, card frame, court, phone, app look, picture frame and a whole character set. Equip them on your Profile.</p>

    <SeasonPass />
  </div>;
}
