import { useEffect, useRef, useState } from 'react';
import {
  loadRelics, saveRelics, spinRelic, spinMany, luckySpin, buySpin, buyRelic, buySlot, upgradeRelic, equipRelic, unequipRelic, refreshShop, canUpgrade,
  canGain, relicLuck, luckPercent, collectionProgress, collectDailyCoins, slotCount, setComplete, setBonus, RELICS, RELIC_BY_ID, RELIC_RARITY,
  RARITY_ORDER, RELIC_SETS, LUCKY_ODDS, SECRET_RELICS, SECRET_BY_ID, SECRET_CHANCE, MAX_LUCK, PITY, LUCKY_PITY, BASE_SLOTS, EXTRA_SLOTS, SLOT_PRICES,
  DAILY_COINS, RELICS_EVENT, RELICS_FOCUS_KEY, SHOP_SEEN_KEY, SPIN_PRICE, LUCKY_SPIN_PRICE, RELIC_PRICE, UPGRADE_PRICE, STACK_MAX,
  type RelicState, type SpinResult, type Relic,
} from '../../relics/relics';
import { claimAchievementSpins, runCoins } from '../../relics/rewards';
import { PixelIcon } from '../PixelIcon';
import '../hunt/hunt.css';
import './relics.css';

const pct = (odds: number) => `${+(odds * 100).toFixed(2)}%`;
const fmtLuck = (n: number) => `+${+n.toFixed(1)}%`;
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
/** Pulls worth a full-screen moment. */
const isBig = (r: SpinResult) => r.kind === 'secret' || r.rarity === 'legendary' || r.rarity === 'mythic';
const nameOf = (r: SpinResult) => (r.kind === 'secret' ? SECRET_BY_ID.get(r.id as never)?.name : RELIC_BY_ID.get(r.id)?.name) ?? r.id;
const rarityName = (r: SpinResult) => (r.kind === 'secret' ? 'Secret' : RELIC_RARITY[r.rarity as keyof typeof RELIC_RARITY].name);

/** The Relic Vault: spend Relic Spins, see your collection, luck and coins. */
export function RelicVault({ onExit }: { onExit: () => void }) {
  // Today's shop is rolled, and the daily coins paid, on the first visit of the day.
  const [state, setState] = useState<RelicState>(() => { const s = loadRelics(), r = collectDailyCoins(refreshShop(s)); if (r !== s) saveRelics(r); return r; });
  const [result, setResult] = useState<SpinResult | null>(null);
  const [batch, setBatch] = useState<SpinResult[] | null>(null);
  const [big, setBig] = useState<SpinResult | null>(null);
  const [rolling, setRolling] = useState(false);
  const [claimed, setClaimed] = useState(0);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    let live = true;
    claimAchievementSpins().then(n => { if (live && n) { setClaimed(n); setState(loadRelics()); } }, () => {});
    const on = () => setState(loadRelics());
    window.addEventListener(RELICS_EVENT, on);
    try { localStorage.setItem(SHOP_SEEN_KEY, new Date().toISOString().slice(0, 10)); } catch { /* storage blocked */ }
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
    setResult(null); setBatch(null);
    setRolling(true);
    timer.current = window.setTimeout(() => { setState(out.state); setResult(out.result); setRolling(false); if (isBig(out.result)) setBig(out.result); }, reduceMotion() ? 0 : 900);
  };
  /** Opens up to ten spins at once. */
  const spinAll = () => {
    if (rolling) return;
    const out = spinMany(loadRelics(), 10);
    if (!out.results.length) return;
    saveRelics(out.state);
    setResult(null); setBatch(null);
    setRolling(true);
    timer.current = window.setTimeout(() => {
      setState(out.state); setBatch(out.results); setRolling(false);
      const best = [...out.results].sort((a, b) => rank(b) - rank(a))[0];
      if (best && isBig(best)) setBig(best);
    }, reduceMotion() ? 0 : 1100);
  };

  const luck = luckPercent(state), prog = collectionProgress(state), slots = slotCount(state);
  const toEpic = PITY.epic - state.pity.epic, toLegendary = PITY.legendary - state.pity.legendary, toMythic = PITY.mythic - state.pity.mythic;
  const toLucky = LUCKY_PITY - (state.pity.lucky % LUCKY_PITY);
  return <div className="hunt relic-vault">
    <header className="hunt-top">
      <button className="hunt-exit" onClick={onExit}><PixelIcon name="exit" size={16} /> Main Menu</button>
      <div className="hunt-title"><span className="pixel-eyebrow">YOUR COLLECTION · EVERY MODE</span><h1>Relic Vault</h1></div>
    </header>

    <section className="relic-stats" aria-label="Your relics">
      <div><span>Relic Spins</span><b>{state.spins}</b></div>
      <div><span>Luck</span><b>{fmtLuck(luck)}</b><small>{state.equipped.length}/{slots} slots · max +{MAX_LUCK}%</small></div>
      <div><span>Coins</span><b>{state.coins.toLocaleString()}</b><small>+{DAILY_COINS} every day you visit</small></div>
      <div><span>Collection</span><b>{prog.owned}/{prog.total}</b><small>{prog.secrets}/{SECRET_RELICS.length} secrets</small></div>
    </section>
    {claimed > 0 && <p className="relic-note" role="status">Your achievements earned {claimed} Relic Spin{claimed === 1 ? '' : 's'}.</p>}

    <section className="relic-machine" aria-live="polite">
      <div className={`relic-slot ${rolling ? 'rolling' : ''} ${result ? `r-${result.rarity}` : ''}`}>
        {rolling ? <><PixelIcon name="shuffle" size={40} /><b>Spinning…</b></>
          : batch ? <BatchSummary results={batch} />
          : result ? <Reveal result={result} />
          : <><PixelIcon name="lock" size={40} /><b>{state.spins ? 'A spin is waiting' : 'No spins yet'}</b><small>{state.spins ? 'Press Spin to open it.' : 'Win runs and unlock achievements to earn spins.'}</small></>}
      </div>
      <div className="relic-spin-row">
        <button className="primary relic-spin" onClick={() => spin()} disabled={rolling || state.spins <= 0}>
          <PixelIcon name="star" size={16} /> {state.spins > 0 ? `Spin (${state.spins} left)` : 'No spins left'}
        </button>
        {state.spins > 1 && <button onClick={spinAll} disabled={rolling}>Spin {Math.min(10, state.spins)} at once</button>}
      </div>
      <p className="relic-pity" aria-label="Guarantees">Guaranteed: <b>Epic</b> within {toEpic} spin{toEpic === 1 ? '' : 's'} · <b>Legendary</b> within {toLegendary} · <b>Mythic</b> within {toMythic} · Lucky Spins: <b>Legendary</b> within {toLucky}</p>
    </section>
    {big && <BigReveal result={big} onClose={() => setBig(null)} />}

    <section className="relic-section" aria-labelledby="relic-shop">
      <h2 id="relic-shop">Shop</h2>
      <p className="relic-help">You have <b>{state.coins.toLocaleString()} coins</b>. Earn them from every finished run, duplicates and a daily visit.</p>
      <div className="relic-shop-grid">
        <div className="relic-offer">
          <PixelIcon name="star" size={24} /><span><b>Relic Spin</b><small>A normal spin, saved for when you want it.</small></span>
          <button onClick={() => commit(buySpin)} disabled={rolling || state.coins < SPIN_PRICE}>{SPIN_PRICE} coins</button>
        </div>
        <div className="relic-offer r-legendary">
          <PixelIcon name="flame" size={24} /><span><b>Lucky Spin</b><small>2× luck, no Commons. Spins straight away.</small></span>
          <button className="primary" onClick={() => spin(true)} disabled={rolling || state.coins < LUCKY_SPIN_PRICE}>{LUCKY_SPIN_PRICE} coins</button>
        </div>
        {state.slotsBought < EXTRA_SLOTS && <div className="relic-offer">
          <PixelIcon name="unlock" size={24} /><span><b>Relic slot {slots + 1}</b><small>One more relic adds its luck. {EXTRA_SLOTS - state.slotsBought} left to buy.</small></span>
          <button onClick={() => commit(buySlot)} disabled={rolling || state.coins < SLOT_PRICES[state.slotsBought]}>{SLOT_PRICES[state.slotsBought].toLocaleString()} coins</button>
        </div>}
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

    <section className="relic-section" aria-labelledby="relic-slots">
      <h2 id="relic-slots">Your slots <small className="relic-count">{state.equipped.length}/{slots}</small></h2>
      <p className="relic-help">Only relics in your slots add luck. New relics go into a free slot by themselves; swap them in the collection below. {BASE_SLOTS} slots to start, {EXTRA_SLOTS} more in the shop.</p>
      <div className="relic-slots">
        {Array.from({ length: BASE_SLOTS + EXTRA_SLOTS }, (_, i) => {
          const id = state.equipped[i], r = id ? RELIC_BY_ID.get(id) : undefined;
          if (i >= slots) return <div key={i} className="relic-socket locked" title={`Buy in the shop: ${SLOT_PRICES[i - BASE_SLOTS].toLocaleString()} coins`}><PixelIcon name="lock" size={16} /><small>{SLOT_PRICES[i - BASE_SLOTS].toLocaleString()}</small></div>;
          if (!r) return <div key={i} className="relic-socket empty"><small>Empty</small></div>;
          return <button key={id} className={`relic-socket r-${r.rarity}`} onClick={() => commit(st => unequipRelic(st, id))} title={`${r.name}: ${fmtLuck(relicLuck(r, state.owned[id] ?? 0, state.upgraded.includes(id)))} luck. Click to take it out.`} aria-label={`${r.name}, in a slot. Take it out`}>
            <PixelIcon name={r.icon} size={20} /><small>{fmtLuck(relicLuck(r, state.owned[id] ?? 0, state.upgraded.includes(id)))}</small>
          </button>;
        })}
      </div>
    </section>

    <section className="relic-section" aria-labelledby="relic-sets">
      <h2 id="relic-sets">Sets <small className="relic-count">+{setBonus(state)}% luck</small></h2>
      <p className="relic-help">Own every relic in a set for bonus luck (no slots needed).</p>
      <div className="relic-sets">{RELIC_SETS.map(set => {
        const have = set.relics.filter(id => (state.owned[id] ?? 0) > 0).length, done = setComplete(state, set);
        return <div key={set.id} className={`relic-set ${done ? 'done' : ''}`}>
          <b>{set.name} <em>+{set.bonus}%</em></b>
          <small>{set.relics.map(id => ((state.owned[id] ?? 0) > 0 ? RELIC_BY_ID.get(id)!.name : '???')).join(' · ')}</small>
          <span className="relic-set-bar" aria-label={`${have} of ${set.relics.length}`}><i style={{ width: `${(have / set.relics.length) * 100}%` }} /></span>
        </div>;
      })}</div>
    </section>

    <section className="relic-section">
      <h2>Relics</h2>
      <p className="relic-help">Each relic in a slot adds its luck once; a duplicate pays coins instead. <b>Stacking</b> relics add +1% a copy, up to {STACK_MAX} copies. <b>Upgrade</b> any other relic with coins for +50% luck. Luck makes the best results of a spin likelier in League Hunt, the 82-0 Challenge, the Career wheel and the Survival deal (up to +{MAX_LUCK}%). Dailies, Weeklies and duels ignore luck, so boards stay fair.</p>
      {RARITY_ORDER.map(r => <div key={r} className="relic-tier">
        <h3 className={`r-${r}`}>{RELIC_RARITY[r].name} <small>{pct(RELIC_RARITY[r].odds)} · +{RELIC_RARITY[r].luck}% luck · duplicate {RELIC_RARITY[r].coins} coins</small></h3>
        <div className="relic-grid">{RELICS.filter(x => x.rarity === r).map(x => <RelicCard key={x.id} relic={x} state={state} onUpgrade={() => commit(s => upgradeRelic(s, x.id))}
          onToggle={() => commit(s => (s.equipped.includes(x.id) ? unequipRelic(s, x.id) : equipRelic(s, x.id)))} />)}</div>
      </div>)}
    </section>

    <section className="relic-section">
      <h2>Secret relics</h2>
      <p className="relic-help">Eight hidden relics, each a permanent ability (no slot needed). Any spin has a {pct(SECRET_CHANCE)} chance to uncover one you don't have, and some answer to a feat.</p>
      <div className="relic-grid">{SECRET_RELICS.map(s => {
        const got = state.secrets.includes(s.id);
        return <div key={s.id} className={`relic-card r-secret ${got ? '' : 'missing'}`}>
          <PixelIcon name={got ? 'crown' : 'lock'} size={24} />
          <span><b>{got ? s.name : '???'}</b><small>{got ? `${s.mode}: ${s.ability}` : <><i>"{s.hint}"</i> ({s.mode})</>}</small></span>
        </div>;
      })}</div>
    </section>

    <section className="relic-section">
      <h2>How to earn spins and coins</h2>
      <ul className="relic-earn">
        <li><b>League Hunt</b>: win a hunt (2 on Legend, +1 without losing a life).</li>
        <li><b>82-0 Challenge</b>: win the title, +1 for a perfect season, +1 for 98-0.</li>
        <li><b>Survival</b>: reach 5, 10 and 15 wins.</li>
        <li><b>Story Mode</b>: finish a story (+1 for the legend ending).</li>
        <li><b>Career Mode</b>: retire (+1 for the Hall of Fame).</li>
        <li><b>Franchise</b>: win a title with your team (not in Sandbox).</li>
        <li><b>Achievements</b>: one spin for every mode achievement.</li>
        <li><b>Coins</b>: every finished run pays {runCoins(0)} coins, plus {runCoins(1) - runCoins(0)} for each spin it earned. {DAILY_COINS} coins a day for visiting. Duplicates pay by rarity.</li>
        <li><b>The shop</b>: {SPIN_PRICE} coins a spin, {LUCKY_SPIN_PRICE} for a Lucky Spin.</li>
      </ul>
    </section>

    <section className="relic-section">
      <details className="relic-ledger"><summary>Coin history</summary>
        {state.ledger.length ? <ul>{[...state.ledger].reverse().slice(0, 20).map((e, i) => <li key={i}><span>{e.why}</span><small>{new Date(e.at).toLocaleDateString()}</small><b className={e.amount < 0 ? 'out' : 'in'}>{e.amount > 0 ? '+' : '−'}{Math.abs(e.amount).toLocaleString()}</b></li>)}</ul>
          : <p className="relic-help">No coins in or out yet.</p>}
      </details>
    </section>
  </div>;
}

function RelicCard({ relic: x, state, onUpgrade, onToggle }: { relic: Relic; state: RelicState; onUpgrade: () => void; onToggle: () => void }) {
  const n = state.owned[x.id] ?? 0, up = state.upgraded.includes(x.id), cost = UPGRADE_PRICE[x.rarity], on = state.equipped.includes(x.id);
  const full = !on && state.equipped.length >= slotCount(state);
  return <div className={`relic-card r-${x.rarity} ${n ? '' : 'missing'} ${up ? 'upgraded' : ''} ${on ? 'equipped' : ''}`}>
    <PixelIcon name={n ? x.icon : 'lock'} size={24} />
    <span><b>{n ? x.name : '???'}{up && <em> ★</em>}</b><small>{n ? x.blurb : x.stack ? 'A stacking relic. Not found yet.' : 'Not found yet.'}</small>
      {n > 0 && <em>{x.stack ? `${Math.min(n, STACK_MAX)}/${STACK_MAX} stacked · ${fmtLuck(relicLuck(x, n))} luck` : `${fmtLuck(relicLuck(x, n, up))} luck${up ? ' (upgraded)' : ''}${n > 1 ? ` · found ×${n}` : ''}`}</em>}
      {n > 0 && <button className="link-button relic-upgrade" onClick={onToggle} disabled={full} title={full ? 'Your slots are full: take a relic out first' : undefined}>{on ? 'In a slot · take out' : full ? 'Slots full' : 'Put in a slot'}</button>}
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

const rank = (r: SpinResult) => (r.kind === 'secret' ? 9 : RARITY_ORDER.indexOf(r.rarity as never));

function BatchSummary({ results }: { results: SpinResult[] }) {
  const coins = results.reduce((n, r) => n + r.coins, 0);
  const best = [...results].sort((a, b) => rank(b) - rank(a));
  return <div className="relic-batch">
    <span className="pixel-eyebrow">{results.length} SPINS</span>
    <ul>{best.map((r, i) => <li key={i} className={`r-${r.rarity}`}><b>{nameOf(r)}</b> <small>{rarityName(r)}{r.duplicate ? ` · +${r.coins} coins` : r.stack ? ` · stack ${r.stack}/${STACK_MAX}` : ' · new'}</small></li>)}</ul>
    {coins > 0 && <small>+{coins} coins from duplicates</small>}
  </div>;
}

/** The full-screen moment for a Legendary, Mythic or secret relic, with a share button. */
function BigReveal({ result, onClose }: { result: SpinResult; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  const [shared, setShared] = useState('');
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', on);
    return () => { window.removeEventListener('keydown', on); prev?.focus?.(); };
  }, [onClose]);
  const name = nameOf(result), rarity = rarityName(result);
  const text = `I just pulled ${name} (${rarity} relic) in Court Vision! https://courtvisiongame.com`;
  const share = async () => {
    try {
      if (navigator.share) { await navigator.share({ text }); setShared('Shared!'); }
      else { await navigator.clipboard.writeText(text); setShared('Copied to your clipboard.'); }
    } catch { setShared(''); }
  };
  const relic = result.kind === 'relic' ? RELIC_BY_ID.get(result.id) : undefined, secret = result.kind === 'secret' ? SECRET_BY_ID.get(result.id as never) : undefined;
  return <div className="relic-big-backdrop" onClick={onClose}>
    <div className={`relic-big r-${result.rarity}`} role="dialog" aria-modal="true" aria-label={`${rarity} relic: ${name}`} onClick={e => e.stopPropagation()}>
      <div className="relic-big-rays" aria-hidden="true" />
      <PixelIcon name={relic?.icon ?? 'crown'} size={72} />
      <span className="pixel-eyebrow">{result.kind === 'secret' ? 'SECRET RELIC UNCOVERED' : `${rarity.toUpperCase()} RELIC`}</span>
      <h2>{name}</h2>
      <p>{secret ? `${secret.mode}: ${secret.ability}` : relic?.blurb}</p>
      <div className="relic-big-actions"><button className="primary" onClick={share}>Share</button><button ref={close} onClick={onClose}>Nice!</button></div>
      {shared && <small role="status">{shared}</small>}
    </div>
  </div>;
}
