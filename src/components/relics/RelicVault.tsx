import { useEffect, useRef, useState } from 'react';
import {
  loadRelics, saveRelics, spinRelic, luckPercent, collectionProgress, RELICS, RELIC_BY_ID, RELIC_RARITY, RARITY_ORDER,
  SECRET_RELICS, SECRET_BY_ID, SECRET_CHANCE, MAX_LUCK, RELICS_EVENT, type RelicState, type SpinResult,
} from '../../relics/relics';
import { claimAchievementSpins } from '../../relics/rewards';
import { PixelIcon } from '../PixelIcon';
import '../hunt/hunt.css';
import './relics.css';

const pct = (odds: number) => `${+(odds * 100).toFixed(2)}%`;
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** The Relic Vault: spend Relic Spins, see your collection, luck and coins. */
export function RelicVault({ onExit }: { onExit: () => void }) {
  const [state, setState] = useState<RelicState>(loadRelics);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [rolling, setRolling] = useState(false);
  const [claimed, setClaimed] = useState(0);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    let live = true;
    claimAchievementSpins().then(n => { if (live && n) { setClaimed(n); setState(loadRelics()); } }, () => {});
    const on = () => setState(loadRelics());
    window.addEventListener(RELICS_EVENT, on);
    return () => { live = false; window.removeEventListener(RELICS_EVENT, on); window.clearTimeout(timer.current); };
  }, []);

  const spin = () => {
    if (rolling) return;
    const out = spinRelic(loadRelics());
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
      <div><span>Luck</span><b>+{luck}%</b><small>max +{MAX_LUCK}%</small></div>
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
      <button className="primary relic-spin" onClick={spin} disabled={rolling || state.spins <= 0}>
        <PixelIcon name="star" size={16} /> {state.spins > 0 ? `Spin (${state.spins} left)` : 'No spins left'}
      </button>
    </section>

    <section className="relic-section">
      <h2>Relics</h2>
      <p className="relic-help">Each relic you own adds its luck once. Luck makes the best results of a spin likelier in League Hunt, the 82-0 Challenge, the Career wheel and the Survival deal. A duplicate pays coins instead. Dailies, Weeklies and duels ignore luck, so boards stay fair.</p>
      {RARITY_ORDER.map(r => <div key={r} className="relic-tier">
        <h3 className={`r-${r}`}>{RELIC_RARITY[r].name} <small>{pct(RELIC_RARITY[r].odds)} · +{RELIC_RARITY[r].luck}% luck · duplicate {RELIC_RARITY[r].coins} coins</small></h3>
        <div className="relic-grid">{RELICS.filter(x => x.rarity === r).map(x => {
          const n = state.owned[x.id] ?? 0;
          return <div key={x.id} className={`relic-card r-${r} ${n ? '' : 'missing'}`}>
            <PixelIcon name={n ? x.icon : 'lock'} size={24} />
            <span><b>{n ? x.name : '???'}</b><small>{n ? x.blurb : 'Not found yet.'}</small>{n > 1 && <em>×{n}</em>}</span>
          </div>;
        })}</div>
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
      </ul>
      <p className="relic-help">Coins are saved for later: something to spend them on is on the way.</p>
    </section>
  </div>;
}

function Reveal({ result }: { result: SpinResult }) {
  if (result.kind === 'secret') {
    const s = SECRET_BY_ID.get(result.id as never)!;
    return <><PixelIcon name="crown" size={40} /><span className="pixel-eyebrow">SECRET RELIC</span><b>{s.name}</b><small>{s.mode}: {s.ability}</small></>;
  }
  const r = RELIC_BY_ID.get(result.id)!;
  const rar = RELIC_RARITY[r.rarity];
  return <><PixelIcon name={r.icon} size={40} /><span className="pixel-eyebrow">{rar.name.toUpperCase()}{result.duplicate ? ' · DUPLICATE' : ' · NEW'}</span><b>{r.name}</b>
    <small>{result.duplicate ? `You already had it: +${result.coins} coins.` : `+${rar.luck}% luck. ${r.blurb}`}</small></>;
}
