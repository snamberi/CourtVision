import { useEffect, useRef, useState } from 'react';
import {
  loadRelics, saveRelics, spinRelic, luckySpin, buySpin, buyRelic, upgradeRelic, refreshShop, canUpgrade, canGain, relicLuck, luckPercent,
  collectionProgress, RELICS, RELIC_BY_ID, RELIC_RARITY, RARITY_ORDER, LUCKY_ODDS, SECRET_RELICS, SECRET_BY_ID, SECRET_CHANCE, MAX_LUCK,
  RELICS_EVENT, RELICS_FOCUS_KEY, SPIN_PRICE, LUCKY_SPIN_PRICE, RELIC_PRICE, UPGRADE_PRICE, STACK_MAX, type RelicState, type SpinResult, type Relic,
} from '../../relics/relics';
import { claimAchievementSpins } from '../../relics/rewards';
import { PixelIcon } from '../PixelIcon';
import '../hunt/hunt.css';
import './relics.css';

const pct = (odds: number) => `${+(odds * 100).toFixed(2)}%`;
const fmtLuck = (n: number) => `+${+n.toFixed(1)}%`;
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** The Relic Vault: spend Relic Spins, see your collection, luck and coins. */
export function RelicVault({ onExit }: { onExit: () => void }) {
  // Today's shop is rolled on the first visit of the day.
  const [state, setState] = useState<RelicState>(() => { const s = loadRelics(), r = refreshShop(s); if (r !== s) saveRelics(r); return r; });
  const [result, setResult] = useState<SpinResult | null>(null);
  const [rolling, setRolling] = useState(false);
  const [claimed, setClaimed] = useState(0);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    let live = true;
    claimAchievementSpins().then(n => { if (live && n) { setClaimed(n); setState(loadRelics()); } }, () => {});
    const on = () => setState(loadRelics());
    window.addEventListener(RELICS_EVENT, on);
    // Opened from the phone's Shop app: jump to the shop.
    let focus: string | null = null;
    try { focus = sessionStorage.getItem(RELICS_FOCUS_KEY); sessionStorage.removeItem(RELICS_FOCUS_KEY); } catch { /* storage blocked */ }
    if (focus === 'shop') window.requestAnimationFrame(() => document.getElementById('relic-shop')?.scrollIntoView({ block: 'start' }));
    return () => { live = false; window.removeEventListener(RELICS_EVENT, on); window.clearTimeout(timer.current); };
  }, []);

  /** Saves a purchase or upgrade made on the latest stored state. */
  const commit = (fn: (s: RelicState) => RelicState | null) => { const next = fn(loadRelics()); if (next) { saveRelics(next); setState(next); } };
  const spin = (lucky = false) => {
    if (rolling) return;
    const out = lucky ? luckySpin(loadRelics()) : spinRelic(loadRelics());
    if (!out) return;
    saveRelics(out.state);
    setResult(null);
    setRolling(true);
    timer.current = window.setTimeout(() => { setState(out.state); setResult(out.result); setRolling(false); }, reduceMotion() ? 0 : 900);
  };

  const luck = luckPercent(state), prog = collectionProgress(state);
  return <div className="hunt relic-vault">
    <header className="hunt-top">
      <button className="hunt-exit" onClick={onExit}><PixelIcon name="exit" size={16} /> Main Menu</button>
      <div className="hunt-title"><span className="pixel-eyebrow">YOUR COLLECTION · EVERY MODE</span><h1>Relic Vault</h1></div>
    </header>

    <section className="relic-stats" aria-label="Your relics">
      <div><span>Relic Spins</span><b>{state.spins}</b></div>
      <div><span>Luck</span><b>{fmtLuck(luck)}</b><small>max +{MAX_LUCK}%</small></div>
      <div><span>Coins</span><b>{state.coins.toLocaleString()}</b><small>from duplicates</small></div>
      <div><span>Collection</span><b>{prog.owned}/{prog.total}</b><small>{prog.secrets}/{SECRET_RELICS.length} secrets</small></div>
    </section>
    {claimed > 0 && <p className="relic-note" role="status">Your achievements earned {claimed} Relic Spin{claimed === 1 ? '' : 's'}.</p>}

    <section className="relic-machine" aria-live="polite">
      <div className={`relic-slot ${rolling ? 'rolling' : ''} ${result ? `r-${result.rarity}` : ''}`}>
        {rolling ? <><PixelIcon name="shuffle" size={40} /><b>Spinning…</b></>
          : result ? <Reveal result={result} />
          : <><PixelIcon name="lock" size={40} /><b>{state.spins ? 'A spin is waiting' : 'No spins yet'}</b><small>{state.spins ? 'Press Spin to open it.' : 'Win runs and unlock achievements to earn spins.'}</small></>}
      </div>
      <button className="primary relic-spin" onClick={() => spin()} disabled={rolling || state.spins <= 0}>
        <PixelIcon name="star" size={16} /> {state.spins > 0 ? `Spin (${state.spins} left)` : 'No spins left'}
      </button>
    </section>

    <section className="relic-section" aria-labelledby="relic-shop">
      <h2 id="relic-shop">Shop</h2>
      <p className="relic-help">You have <b>{state.coins.toLocaleString()} coins</b>. Earn more from duplicates.</p>
      <div className="relic-shop-grid">
        <div className="relic-offer">
          <PixelIcon name="star" size={24} /><span><b>Relic Spin</b><small>A normal spin, saved for when you want it.</small></span>
          <button onClick={() => commit(buySpin)} disabled={rolling || state.coins < SPIN_PRICE}>{SPIN_PRICE} coins</button>
        </div>
        <div className="relic-offer r-legendary">
          <PixelIcon name="flame" size={24} /><span><b>Lucky Spin</b><small>2× luck, no Commons. Spins straight away.</small></span>
          <button className="primary" onClick={() => spin(true)} disabled={rolling || state.coins < LUCKY_SPIN_PRICE}>{LUCKY_SPIN_PRICE} coins</button>
        </div>
      </div>
      <p className="relic-help relic-odds">Lucky Spin odds: Rare {pct(LUCKY_ODDS.rare)} · Epic {pct(LUCKY_ODDS.epic)} · Legendary {pct(LUCKY_ODDS.legendary)} · Mythic {pct(LUCKY_ODDS.mythic)}</p>
      <h3 className="relic-daily-title">Today's relics <small>new at midnight UTC</small></h3>
      <div className="relic-shop-grid">{(state.shop?.offers ?? []).map(id => {
        const r = RELIC_BY_ID.get(id)!, sold = state.shop!.bought.includes(id), price = RELIC_PRICE[r.rarity], full = !canGain(state, r);
        return <div key={id} className={`relic-offer r-${r.rarity}`}>
          <PixelIcon name={r.icon} size={24} /><span><b>{r.name}</b><small>{RELIC_RARITY[r.rarity].name}{r.stack ? ` · stacks (+1% a copy, up to ${STACK_MAX})` : ` · +${RELIC_RARITY[r.rarity].luck}% luck`}</small></span>
          <button onClick={() => commit(s => buyRelic(s, id))} disabled={rolling || sold || full || state.coins < price}>{sold ? 'Bought' : full ? 'Owned' : `${price.toLocaleString()} coins`}</button>
        </div>;
      })}{!state.shop?.offers.length && <p className="relic-help">Nothing left to sell you today. Impressive.</p>}</div>
    </section>

    <section className="relic-section">
      <h2>Relics</h2>
      <p className="relic-help">Each relic you own adds its luck once; a duplicate pays coins instead. <b>Stacking</b> relics add +1% a copy, up to {STACK_MAX} copies. <b>Upgrade</b> any other relic with coins for +50% luck. Luck makes the best results of a spin likelier in League Hunt, the 82-0 Challenge, the Career wheel and the Survival deal (up to +{MAX_LUCK}%). Dailies, Weeklies and duels ignore luck, so boards stay fair.</p>
      {RARITY_ORDER.map(r => <div key={r} className="relic-tier">
        <h3 className={`r-${r}`}>{RELIC_RARITY[r].name} <small>{pct(RELIC_RARITY[r].odds)} · +{RELIC_RARITY[r].luck}% luck · duplicate {RELIC_RARITY[r].coins} coins</small></h3>
        <div className="relic-grid">{RELICS.filter(x => x.rarity === r).map(x => <RelicCard key={x.id} relic={x} state={state} onUpgrade={() => commit(s => upgradeRelic(s, x.id))} />)}</div>
      </div>)}
    </section>

    <section className="relic-section">
      <h2>Secret relics</h2>
      <p className="relic-help">Eight hidden relics, each a permanent ability. Any spin has a {pct(SECRET_CHANCE)} chance to uncover one you don't have.</p>
      <div className="relic-grid">{SECRET_RELICS.map(s => {
        const got = state.secrets.includes(s.id);
        return <div key={s.id} className={`relic-card r-secret ${got ? '' : 'missing'}`}>
          <PixelIcon name={got ? 'crown' : 'lock'} size={24} />
          <span><b>{got ? s.name : '???'}</b><small>{got ? `${s.mode}: ${s.ability}` : s.mode}</small></span>
        </div>;
      })}</div>
    </section>

    <section className="relic-section">
      <h2>How to earn spins</h2>
      <ul className="relic-earn">
        <li><b>League Hunt</b>: win a hunt (2 on Legend, +1 without losing a life).</li>
        <li><b>82-0 Challenge</b>: win the title, +1 for a perfect season, +1 for 98-0.</li>
        <li><b>Survival</b>: reach 5, 10 and 15 wins.</li>
        <li><b>Story Mode</b>: finish a story (+1 for the legend ending).</li>
        <li><b>Career Mode</b>: retire (+1 for the Hall of Fame).</li>
        <li><b>Franchise</b>: win a title with your team (not in Sandbox).</li>
        <li><b>Achievements</b>: one spin for every mode achievement.</li>
        <li><b>The shop</b>: {SPIN_PRICE} coins a spin, {LUCKY_SPIN_PRICE} for a Lucky Spin.</li>
      </ul>
    </section>
  </div>;
}

function RelicCard({ relic: x, state, onUpgrade }: { relic: Relic; state: RelicState; onUpgrade: () => void }) {
  const n = state.owned[x.id] ?? 0, up = state.upgraded.includes(x.id), cost = UPGRADE_PRICE[x.rarity];
  return <div className={`relic-card r-${x.rarity} ${n ? '' : 'missing'} ${up ? 'upgraded' : ''}`}>
    <PixelIcon name={n ? x.icon : 'lock'} size={24} />
    <span><b>{n ? x.name : '???'}{up && <em> ★</em>}</b><small>{n ? x.blurb : x.stack ? 'A stacking relic. Not found yet.' : 'Not found yet.'}</small>
      {n > 0 && <em>{x.stack ? `${Math.min(n, STACK_MAX)}/${STACK_MAX} stacked · ${fmtLuck(relicLuck(x, n))} luck` : `${fmtLuck(relicLuck(x, n, up))} luck${up ? ' (upgraded)' : ''}${n > 1 ? ` · found ×${n}` : ''}`}</em>}
      {canUpgrade(state, x) && <button className="link-button relic-upgrade" onClick={onUpgrade} disabled={state.coins < cost}>Upgrade to {fmtLuck(relicLuck(x, 1, true))}: {cost.toLocaleString()} coins</button>}
    </span>
  </div>;
}

function Reveal({ result }: { result: SpinResult }) {
  if (result.kind === 'secret') {
    const s = SECRET_BY_ID.get(result.id as never)!;
    return <><PixelIcon name="crown" size={40} /><span className="pixel-eyebrow">SECRET RELIC</span><b>{s.name}</b><small>{s.mode}: {s.ability}</small></>;
  }
  const r = RELIC_BY_ID.get(result.id)!;
  const rar = RELIC_RARITY[r.rarity];
  const tag = result.duplicate ? ' · DUPLICATE' : result.stack && result.stack > 1 ? ` · STACK ${result.stack}/${STACK_MAX}` : ' · NEW';
  return <><PixelIcon name={r.icon} size={40} /><span className="pixel-eyebrow">{result.lucky ? 'LUCKY SPIN · ' : ''}{rar.name.toUpperCase()}{tag}</span><b>{r.name}</b>
    <small>{result.duplicate ? `${r.stack ? 'Fully stacked already' : 'You already had it'}: +${result.coins} coins.` : r.stack ? `+1% luck (${result.stack}/${STACK_MAX} stacked). ${r.blurb}` : `+${rar.luck}% luck. ${r.blurb}`}</small></>;
}
