import { useEffect, useRef, useState } from 'react';
import { totalXp, PROFILE_EVENT } from '../../profile/profile';
import { SEASON_REWARDS, SEASON_TIERS, SEASON_COSMETIC_EVERY, STREAK_BONUS_MAX, daysLeft, daysUntil, nextSeason, noteSeason, streakBonus, type Season, type SeasonCosmetic } from '../../retention/season';
import { readStreak } from '../../retention/streak';
import { paySeasonRewards } from '../../relics/rewards';
import { loadRelics, RELICS_EVENT } from '../../relics/relics';
import type { FrameId } from '../../profile/profile';
import { ShareCardButton } from '../ShareCardButton';
import { SeasonTierUp } from './SeasonTierUp';
import { asRoadReward } from './seasonEquip';
import { RELIC_BY_ID, RARITY_ORDER } from '../../relics/relics';
import { PixelIcon } from '../PixelIcon';
import { SeasonPass } from '../locker/SeasonPass';
import { RoadReward } from './RoadReward';
import '../hunt/hunt.css';
import '../locker/locker.css';
import './roads.css';

const asReward = asRoadReward;

/** Tier column width, in pixels. */
const COL = 76;

/**
 * The Season Pass page: the season's banner and your tier, then the pass itself, five tiers to a block: the
 * season cosmetic on top, the tier track in the middle, and a free Lucky Spin for every tier underneath. Below it:
 * the weekly missions, the monthly pass and the daily streak.
 */
export function SeasonPassPage({ onExit, onRelics }: { onExit: () => void; onRelics?: () => void }) {
  // Opening the pass pays the Lucky Spins for any tier reached since the last look.
  const [first] = useState(() => paySeasonRewards(totalXp()));
  const [paid, setPaid] = useState(first.spins);
  const [unlocked, setUnlocked] = useState<SeasonCosmetic[]>(first.cosmetics);
  const [, setTick] = useState(0);
  useEffect(() => {
    const bump = () => { const more = paySeasonRewards(totalXp()); if (more.spins) setPaid(p => p + more.spins); if (more.cosmetics.length) setUnlocked(u => [...u, ...more.cosmetics]); setTick(t => t + 1); };
    window.addEventListener(PROFILE_EVENT, bump); window.addEventListener('courtvision:progress', bump); window.addEventListener(RELICS_EVENT, bump);
    return () => { window.removeEventListener(PROFILE_EVENT, bump); window.removeEventListener('courtvision:progress', bump); window.removeEventListener(RELICS_EVENT, bump); };
  }, []);
  const p = noteSeason(totalXp());
  const upcoming = nextSeason();
  const [preview, setPreview] = useState(false);
  // The next season's track, all locked, as a preview.
  const shown: Season = preview && upcoming ? upcoming : p.season;
  const tier = preview ? 0 : p.tier;
  const rewards = SEASON_REWARDS[shown.id] ?? [];
  const free = loadRelics().luckySpins ?? 0;
  const left = daysLeft(p.season);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = scroller.current; if (el) el.scrollLeft = Math.max(0, (p.tier + 0.5) * COL - el.clientWidth / 2); }, [p.tier]);
  const blocks = Array.from({ length: SEASON_TIERS / SEASON_COSMETIC_EVERY }, (_, b) => b);
  const fill = preview ? 0 : tier >= SEASON_TIERS ? SEASON_TIERS * COL : (tier + p.into / p.need) * COL;
  // The season recap card: tier, spins and the best relic pulled since the season started.
  const since = Date.parse(`${p.season.start}T00:00:00Z`);
  const best = loadRelics().history.filter(h => h.at >= since && h.kind === 'relic').sort((a, b) => RARITY_ORDER.indexOf(b.rarity as never) - RARITY_ORDER.indexOf(a.rarity as never))[0];
  const bestName = best ? RELIC_BY_ID.get(best.id)?.name : undefined;
  const got = rewards.filter(r => r.tier <= p.tier).length;

  return <div className="hunt road-page season-page">
    <header className="hunt-top">
      <button className="hunt-exit" onClick={onExit}><PixelIcon name="exit" size={16} /> Main Menu</button>
      <div className="hunt-title"><span className="pixel-eyebrow">FREE FOR EVERYONE · EVERY MODE COUNTS</span><h1>Season Pass</h1></div>
      {onRelics && <button className="relic-switch" onClick={onRelics}><PixelIcon name="flame" size={16} /> Relic Vault{free ? ` · ${free} free Lucky Spin${free === 1 ? '' : 's'}` : ''}</button>}
    </header>

    {upcoming && <div className="sp-season-tabs" role="tablist" aria-label="Seasons">
      <button role="tab" aria-selected={!preview} className={!preview ? 'active' : ''} onClick={() => setPreview(false)}>Season {p.season.number}: {p.season.name}</button>
      <button role="tab" aria-selected={preview} className={preview ? 'active' : ''} onClick={() => setPreview(true)}>Next: Season {upcoming.number}: {upcoming.name} <small>in {daysUntil(upcoming)} days</small></button>
    </div>}

    <section className={`sp-banner season-${shown.id}`} aria-label={`Season ${shown.number}: ${shown.name}`}>
      <div className="sp-banner-text">
        <span className="sp-season">SEASON {shown.number}{preview ? ' · COMING SOON' : ''}</span>
        <h2 className="sp-name" data-text={shown.name.toUpperCase()}>{shown.name.toUpperCase()}</h2>
        <p>{shown.tagline}</p>
        <small>{preview ? `Starts ${new Date(`${shown.start}T00:00:00Z`).toLocaleDateString(undefined, { month: 'long', day: 'numeric', timeZone: 'UTC' })}: a fresh pass of 100 tiers` : left > 0 ? `Ends in ${left} day${left === 1 ? '' : 's'}` : 'Season over: what you unlocked is yours for good'}</small>
      </div>
      {!preview && <div className="sp-tier-box" aria-label={`Tier ${p.tier} of ${SEASON_TIERS}`}>
        <small>TIER</small><b>{p.tier}</b>
        <i className="sp-tier-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, p.into / p.need * 100)}%` }} /></i>
        <small>{p.tier >= SEASON_TIERS ? 'Pass complete' : `${p.need - p.into} XP to tier ${p.tier + 1}`}</small>
      </div>}
    </section>
    {paid > 0 && <p className="relic-note" role="status"><PixelIcon name="flame" size={14} /> The pass paid {paid} free Lucky Spin{paid === 1 ? '' : 's'}. {onRelics ? 'Open them in the Relic Vault.' : ''}</p>}
    {!preview && <div className="sp-actions">
      <span className="hint-text"><PixelIcon name="flame" size={12} /> Streak bonus: +{streakBonus(readStreak().current)} pass XP a day for your {readStreak().current}-day streak (up to +{STREAK_BONUS_MAX} at 10 days).</span>
      <ShareCardButton tall fileName={`season-${p.season.number}.png`} text={`Season ${p.season.number} (${p.season.name}) in Court Vision: tier ${p.tier} of ${SEASON_TIERS}!`} spec={{
        kicker: `SEASON ${p.season.number} · ${p.season.name.toUpperCase()}`, title: `Tier ${p.tier}`, subtitle: p.tier >= SEASON_TIERS ? 'The whole pass, done.' : `${SEASON_TIERS - p.tier} tiers to go`,
        stats: [{ label: 'Tier', value: `${p.tier}` }, { label: 'Lucky Spins', value: `${p.paid}` }, { label: 'Cosmetics', value: `${got}/${rewards.length}` }, { label: 'XP', value: p.xp.toLocaleString() }],
        lines: [bestName ? `Best relic pulled: ${bestName}` : 'No relics pulled yet', ...rewards.filter(r => r.tier <= p.tier).slice(-3).map(r => `Unlocked: ${r.name} (${r.label.toLowerCase()})`)],
        frame: (['glitch', 'frozen', 'inferno'].includes(p.season.id) ? p.season.id : 'classic') as FrameId, accent: 'gold',
      }} />
    </div>}

    <div className="sp-road" ref={scroller} role="region" aria-label="Season Pass tiers" tabIndex={0}>
      <div className="sp-inner" style={{ width: SEASON_TIERS * COL, ['--sp-col' as string]: `${COL}px` }}>
        <ol className="sp-top">{blocks.map(b => {
          const at = (b + 1) * SEASON_COSMETIC_EVERY, r = rewards.find(x => x.tier === at);
          const done = tier >= at, next = !preview && !done && tier >= at - SEASON_COSMETIC_EVERY;
          return <li key={b} className={`sp-card ${done ? 'got' : ''} ${next ? 'next' : ''} ${at === SEASON_TIERS ? 'final' : ''}`}>
            <span className="sp-card-tier">TIER {at}</span>
            {r ? <RoadReward {...asReward(r)} titleNote={at === SEASON_TIERS ? 'Final title' : 'Title'} /> : null}
            <span className="sp-card-label">{r?.label}</span>
            {done ? <span className="brawl-check" aria-label="Unlocked"><PixelIcon name="check" size={12} /></span> : <span className="brawl-lock" aria-hidden="true"><PixelIcon name="lock" size={12} /></span>}
          </li>;
        })}</ol>
        <div className="sp-track" aria-hidden="true">
          <i className="sp-fill" style={{ width: fill }} />
          {Array.from({ length: SEASON_TIERS }, (_, i) => <b key={i} className={`sp-node ${i + 1 <= tier ? 'got' : ''} ${(i + 1) % SEASON_COSMETIC_EVERY === 0 ? 'big' : ''}`} style={{ left: i * COL + COL / 2 }}>{i + 1}</b>)}
        </div>
        <ol className="sp-bottom">{Array.from({ length: SEASON_TIERS }, (_, i) => {
          const t = i + 1, done = tier >= t;
          return <li key={t} className={`sp-spin ${done ? 'got' : ''}`} aria-label={`Tier ${t}: free Lucky Spin${done ? ', earned' : ''}`}>
            <PixelIcon name={done ? 'check' : 'flame'} size={14} /><small>Lucky Spin</small>
          </li>;
        })}</ol>
      </div>
    </div>
    <p className="hint-text">Every XP you earn this season, in any mode, fills the pass ({p.need} XP a tier), and your daily streak adds a bonus every day. Every tier pays a free Lucky Spin for the Relic Vault (2× luck, no Commons), and every {SEASON_COSMETIC_EVERY} tiers unlocks a {shown.name} cosmetic for good: icon, name colour, title and title colour, card frame, court, phone, app look, picture frame and a whole character set. Wear them from your Closet.</p>
    {unlocked.length > 0 && <SeasonTierUp cosmetics={unlocked} spins={0} onClose={() => setUnlocked([])} />}

    <SeasonPass />
  </div>;
}
