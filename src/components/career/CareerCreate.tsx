import { useCallback, useEffect, useState } from 'react';
import { LuckChip } from '../relics/RelicReward';
import type { NbaHistory } from '../../history/nbaHistoryData';
import { cardPool, seasonLabel, RARITY_LABEL } from '../../hunt/cards';
import { CATEGORIES, categoryLabel, categoryScore, feetInches, type CategoryId, type CategoryValues } from '../../career/categories';
import { eliteRanks, newWheel, spin, respin, move, take, landed, neighbour, wheelCategories, primeBoost, mustTake, canSpin, isComplete, openWheels, luckyLeft, boostLeft, REEL_LENGTH, STAR_BONUS, ELITE_MAX, SURGE_SKILLS, type WheelState, type Wheel } from '../../career/wheel';
import {
  READINESS, NORMAL_READINESS, sandboxBuild, setSandbox, primeFromSandbox, categoryPaths, SANDBOX_MIN, SANDBOX_MAX, SANDBOX_HEIGHT, SANDBOX_WEIGHT, type SandboxBuild,
  suggestPosition, primeOverall, projectedPrime, buildPlayer, startProgress, primeFromBuild, capFor, buildSpent, rollPotential, RATING_CATEGORIES, BUILD_MIN, START_AGE, POTENTIAL_REROLLS,
  type Prime, type Readiness, type Position, type Build,
} from '../../career/create';
import { MyPlayerBoard, BodyBoard, type BoardCell } from './MyPlayerBoard';
import { calculateOverall } from '../../simulation/engine/overall';
import { PlayerAvatar } from '../PlayerAvatar';

const SLICE = 132;
/** Slices the strip travels before it stops, and slices kept after the stop (so the right side is never empty). */
const LEAD = 40, TAIL = 16, START = 6;
/** Jersey colour on the wheel by rarity, so a Star stands out as the strip flies past. */
const SLICE_KIT: Record<string, string> = { common: '#5b6b82', rare: '#2f6fb8', epic: '#7e4fc9', legendary: '#d99a1e' };
const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * One wheel: a strip of real players that spins to a stop; the slices either side are the Move Left/Right options.
 * The strip is built around where it stops (LEAD slices of travel, TAIL after), so it is full on both sides from the
 * first frame to the last. It is keyed by the spin, so a Move only slides it one slice. `onSettled` fires when it stops.
 */
function Reel({ h, wheel, onSettled }: { h: NbaHistory; wheel: Wheel; onSettled: () => void }) {
  const pool = cardPool(h);
  const [stop0] = useState(wheel.stop);
  const shift = ((wheel.stop - stop0 + REEL_LENGTH + 12) % REEL_LENGTH) - 12;
  const at = (i: number) => wheel.reel[(((stop0 - LEAD + i) % REEL_LENGTH) + REEL_LENGTH) % REEL_LENGTH];
  const strip = Array.from({ length: LEAD + 1 + TAIL }, (_, i) => at(i));
  const target = LEAD + shift;
  const hit = pool.byId.get(landed(wheel))!;
  useEffect(() => { if (reducedMotion()) onSettled(); }, [onSettled]);
  return <div className={`cv-reel ${wheel.lucky ? 'lucky' : ''}`} aria-label="The wheel">
    <div className={`cv-reel-marker rarity-${hit.rarity}`} aria-hidden="true" />
    <div className="cv-reel-strip" onAnimationEnd={e => { if (e.animationName === 'cv-spin') onSettled(); }} style={{ transform: `translateX(${-(target * SLICE + SLICE / 2)}px)`, ['--from' as string]: `${-(START * SLICE + SLICE / 2)}px` }}>
      {strip.map((id, i) => { const c = pool.byId.get(id)!; return <div key={i} className={`cv-slice rarity-${c.rarity} ${i === target ? 'on' : ''}`}>
        <PlayerAvatar playerId={c.name} mode="portrait" size={30} primaryColor={SLICE_KIT[c.rarity]} secondaryColor="#f4f0e6" />
        <span><b>{c.name}</b><small>'{String(c.end).slice(2)} · {c.ovr}</small></span>
      </div>; })}
    </div>
  </div>;
}

/** The player a wheel landed on, with his ten categories to take from. */
function Landed({ h, s, wheel, index, onTake, onBoost }: { h: NbaHistory; s: WheelState; wheel: Wheel; index: number; onTake: (cat: CategoryId) => void; onBoost: () => void }) {
  const pool = cardPool(h);
  const id = landed(wheel), c = pool.byId.get(id)!;
  const cats = wheelCategories(h, wheel);
  const elite = eliteRanks(h).get(id);
  const used = s.takenFrom.includes(index);
  const star = c.rarity === 'legendary';
  const boost = wheel.boost;
  const raised = (cat: CategoryId) => !!boost && Object.keys(cats[cat]).some(k => boost.raised.includes(k));
  const canBoost = !used && !boost && mustTake(s) && boostLeft(s) > 0;
  return <div className={`cv-landed rarity-${c.rarity} ${used ? 'used' : ''}`}>
    {star && !used && <div className="cv-star-burst" aria-hidden="true">STAR!</div>}
    <div className="cv-landed-head"><PlayerAvatar playerId={c.name} primaryColor={SLICE_KIT[c.rarity]} secondaryColor="#f4f0e6" size={56} pose={star ? 'raise' : 'stand'} />
      <div><small>{RARITY_LABEL[c.rarity].toUpperCase()} · {c.pos}{star ? ` · +${STAR_BONUS} TO EVERY SKILL` : ''}</small><strong>{c.name}{boost && <span className="cv-boost-badge">{boost.mode === 'prime' ? 'PRIME' : 'SURGE'}</span>}</strong><span>{seasonLabel(c.end)} {c.teamName} · {c.ovr} OVR</span></div></div>
    {boost
      ? <p className="hint-text">{boost.mode === 'prime' ? `In his absolute prime: ${boost.raised.length} skills at the best he ever had them.` : `Already at his peak: ${boost.raised.length} skills up 10-20%.`} Height never changes; nothing passes {ELITE_MAX}.</p>
      : !used && <button className="cv-boost-btn" disabled={!canBoost} onClick={onBoost}
        title={boostLeft(s) <= 0 ? 'Prime Boost used' : `His absolute prime (or ${SURGE_SKILLS} skills up 10-20% if he is already there). One, free.`}>
        Prime Boost {boostLeft(s) > 0 ? '(1 free)' : '(used)'}</button>}
    <ul className="cv-cats">{CATEGORIES.map(cat => { const taken = s.picks[cat.id]; return <li key={cat.id}>
      <span>{cat.name}{elite?.[cat.id] ? <small className="cv-elite-tag"> #{elite[cat.id]} ever</small> : null}</span><b className={`${categoryScore(cats[cat.id]) > 99 ? 'cv-elite' : ''} ${raised(cat.id) ? 'cv-raised' : ''}`}>{categoryLabel(cat.id, cats[cat.id])}</b>
      {taken ? <small>{taken.cardId === id ? 'Taken' : 'Filled'}</small> : <button className="cv-take" disabled={used} onClick={() => onTake(cat.id)}>Take</button>}
    </li>; })}</ul>
  </div>;
}

/**
 * Your build so far on the same pixel body board as MyPlayer: each category filled from the wheel shows its rating and
 * who it came from. With one wheel waiting, the open callouts show what you would take and take it when clicked.
 */
function WheelBoard({ h, s, settled, onTake }: { h: NbaHistory; s: WheelState; settled: boolean; onTake: (cat: CategoryId) => void }) {
  const pool = cardPool(h);
  const filled = CATEGORIES.filter(c => s.picks[c.id]).length;
  const offer = settled && mustTake(s) && s.current!.length === 1 ? s.current![0] : null;
  const partial = Object.fromEntries(CATEGORIES.filter(c => s.picks[c.id]).map(c => [c.id, s.picks[c.id]!.values])) as Partial<Prime>;
  const est = projectedPrime(partial), estPos = suggestPosition(est), estOvr = primeOverall(est, 'balanced', estPos);
  const offered = offer ? wheelCategories(h, offer) : null;
  const heightIn = Math.round(s.picks.size?.values['physical.heightInches'] ?? 79);
  // The callouts are narrow: height alone for the frame (the list above shows the span).
  const short = (id: CategoryId, v: CategoryValues) => (id === 'size' ? feetInches(v['physical.heightInches']) : categoryLabel(id, v));
  const cells = Object.fromEntries(CATEGORIES.map(cat => {
    const p = s.picks[cat.id];
    if (p) {
      const from = pool.byId.get(p.cardId);
      return [cat.id, { value: short(cat.id, p.values), sub: from ? `${from.name} '${String(from.end).slice(2)}` : undefined, state: 'filled' }];
    }
    if (offered) return [cat.id, { value: short(cat.id, offered[cat.id]), sub: 'Click to take', state: 'pickable' }];
    return [cat.id, { value: '—', state: 'empty' }];
  })) as Record<CategoryId, BoardCell>;
  return <div className="cv-board-wrap"><h3><span>Your player</span><span>{filled}/10</span></h3>
    <div className="cv-prime-calc" aria-live="polite"><div><small>PRIME OVR</small><b>{estOvr}</b></div><div><small>POSITION</small><b>{estPos}</b></div>
      <span>{filled === CATEGORIES.length ? 'His overall at his prime (balanced readiness).' : `Projected at his prime: the ${CATEGORIES.length - filled} empty categor${CATEGORIES.length - filled === 1 ? 'y counts' : 'ies count'} as plain 65s until you fill ${CATEGORIES.length - filled === 1 ? 'it' : 'them'}.`}</span></div>
    <BodyBoard heightIn={heightIn} name="" cells={cells} onSelect={offered ? onTake : undefined} label="Your player's build from the wheel" /></div>;
}

export function WheelBuilder({ h, seed, fav, relics, onDone, onBack }: { h: NbaHistory; seed: number; /** Your favourite player (not in the weekly career). */ fav?: string; /** Relic luck and The Eternal Spin (not in the weekly career). */ relics?: { luck: number; eternalSpin: boolean }; onDone: (prime: Prime) => void; onBack: () => void }) {
  const [s, setS] = useState<WheelState>(() => newWheel(seed, fav, relics));
  /** The spin whose wheels have stopped: nothing about where they landed shows before that. */
  const [settledSpin, setSettledSpin] = useState(0);
  const settle = useCallback((spinCount: number) => setSettledSpin(n => Math.max(n, spinCount)), []);
  const done = isComplete(s);
  const single = s.current?.length === 1;
  const pool = cardPool(h);
  const w0 = s.current?.[0];
  const settled = !s.current || settledSpin >= s.spinCount;
  const busy = !settled;
  return <section className="hunt-stage cv-builder">
    <CreateSteps step={0} />
    <div className="cv-builder-head"><span className="pixel-eyebrow">RANDOM MODE · SPIN {s.spinCount}</span> <LuckChip luck={relics?.luck} /><h2>{done ? 'Your player is built' : busy ? 'Spinning…' : mustTake(s) ? 'Take one category' : 'Spin the wheel'}</h2></div>
    <div className="cv-tools">
      <button className="primary cv-spin-btn" disabled={!canSpin(s)} onClick={() => setS(spin(h, s))}>Spin</button>
      <button className="cv-lucky-btn" disabled={!canSpin(s) || luckyLeft(s) <= 0} onClick={() => setS(spin(h, s, false, true))} title="Always lands on a Star or a Great">Lucky Spin ({luckyLeft(s)})</button>
      <button disabled={!canSpin(s) || !s.triple} onClick={() => setS(spin(h, s, true))} title="Three wheels at once; take from any of them">Triple Spin {s.triple ? '(1)' : '(used)'}</button>
      <button disabled={busy || !mustTake(s) || s.respins <= 0 || !!s.current?.some(w => w.boost)} onClick={() => setS(respin(h, s))} title="Spin again without taking anything">Respin ({s.respins})</button>
      <button disabled={busy || !mustTake(s) || !single || !s.moves.left || !!w0?.boost} onClick={() => setS(move(s, 'left'))} title={w0 && !busy ? `Move to ${pool.byId.get(neighbour(w0, 'left'))?.name}` : ''}>← Move left</button>
      <button disabled={busy || !mustTake(s) || !single || !s.moves.right || !!w0?.boost} onClick={() => setS(move(s, 'right'))} title={w0 && !busy ? `Move to ${pool.byId.get(neighbour(w0, 'right'))?.name}` : ''}>Move right →</button>
    </div>
    <details className="cv-howto"><summary>How the wheel works</summary>
      <p className="hint-text">Every player in NBA history is on the wheel once, at his best season; the odds lean a little toward good players (Star about 7%, Great about 18%), and among Stars the all-time greats come up most. Take one category from the player it stops on: you get his exact ratings as your player's prime, +{STAR_BONUS} on every skill from a Star. The best ever at a skill go past 99, up to {ELITE_MAX}. Two Lucky Spins (each one always lands on a Star or a Great), Move Left and Move Right once each, two respins, one triple spin (take one category from each of the three), and one free Prime Boost: the player you landed on in his absolute prime, or six of his skills up 10-20% if he is already there (never his height, never past {ELITE_MAX}).</p></details>
    {s.current?.[0]?.lucky && <p className="cv-lucky-note">LUCKY SPIN · a Star or a Great, guaranteed</p>}
    {s.current ? <div className="cv-wheels">{s.current.map((w, i) => <Reel key={`${s.spinCount}-${i}`} h={h} wheel={w} onSettled={() => settle(s.spinCount)} />)}</div>
      : !done && <p className="empty-state">Spin to start. Ten categories to fill.</p>}
    <div className="cv-build-grid">
      {s.current && <div className="cv-landed-col">{settled
        ? s.current.map((w, i) => <Landed key={i} h={h} s={s} wheel={w} index={i} onTake={cat => setS(take(h, s, i, cat))} onBoost={() => setS(primeBoost(h, s, i))} />)
        : <div className="cv-landed cv-landed-wait" aria-live="polite"><strong>The wheel is spinning…</strong><span>Who it lands on shows when it stops.</span></div>}
        {settled && openWheels(s).length > 0 && s.takenFrom.length > 0 && !done && <p className="hint-text">You can take from the other wheels too, or spin again.</p>}
      </div>}
      <WheelBoard h={h} s={s} settled={settled} onTake={cat => setS(take(h, s, 0, cat))} />
    </div>
    {done && <button className="primary hunt-play" onClick={() => onDone(Object.fromEntries(CATEGORIES.map(c => [c.id, s.picks[c.id]!.values])) as Prime)}>Next: name your player</button>}
    <button className="link-button" onClick={onBack}>Back</button>
  </section>;
}

/** Where you are in making a player: build him, name him, the draft. */
export function CreateSteps({ step }: { step: 0 | 1 | 2 }) {
  return <ol className="cv-steps" aria-label="Create your player">{['Build him', 'Name him', 'The draft'].map((l, i) => <li key={l} className={i < step ? 'done' : i === step ? 'on' : ''} aria-current={i === step ? 'step' : undefined}><b>{i + 1}</b>{l}</li>)}</ol>;
}

// ---------------------------------------------------------------- MyPlayer

const DEFAULT_BUILD: Build = { heightIn: 79, weightLbs: 215, wingspanIn: 83, ratings: { body: 65, athleticism: 72, finishing: 72, midRange: 70, threePoint: 72, playmaking: 70, perimeterD: 68, interiorD: 60, iq: 71 } };

/** Brings a build within a budget, taking points from the highest ratings first. */
function fitBuild(b: Build, budget: number): Build {
  const ratings = { ...b.ratings };
  for (let over = buildSpent(b) - budget; over > 0; over--) {
    const top = RATING_CATEGORIES.reduce((a, c) => (ratings[c] > ratings[a] ? c : a));
    if (ratings[top] <= BUILD_MIN) break;
    ratings[top]--;
  }
  return { ...b, ratings };
}

export function MyPlayerBuilder({ seed, onDone, onBack }: { seed: number; onDone: (prime: Prime) => void; onBack: () => void }) {
  const [b, setB] = useState<Build>(() => fitBuild(DEFAULT_BUILD, rollPotential(seed, 0).budget));
  const [roll, setRoll] = useState(0);
  const [selected, setSelected] = useState<CategoryId>('threePoint');
  const stock = rollPotential(seed, roll);
  const budget = stock.budget;
  const spent = buildSpent(b), left = budget - spent;
  const setRating = (id: (typeof RATING_CATEGORIES)[number], v: number) => {
    const cap = capFor(id, b.heightIn);
    const room = left + b.ratings[id];
    setB({ ...b, ratings: { ...b.ratings, [id]: Math.max(BUILD_MIN, Math.min(cap, room, v)) } });
  };
  const setHeight = (h: number) => {
    // A new height changes the caps: anything above its new cap comes down.
    const ratings = { ...b.ratings };
    for (const id of RATING_CATEGORIES) ratings[id] = Math.min(ratings[id], capFor(id, h));
    setB({ ...b, heightIn: h, wingspanIn: Math.max(h - 2, Math.min(h + 10, b.wingspanIn + (h - b.heightIn))), weightLbs: Math.round(Math.max(165, Math.min(300, b.weightLbs + (h - b.heightIn) * 6))), ratings });
  };
  const prime = primeFromBuild(b, seed);
  const pos = suggestPosition(prime);
  const cat = CATEGORIES.find(c => c.id === selected)!;
  const ratingId = selected === 'size' ? null : selected as (typeof RATING_CATEGORIES)[number];
  return <section className="hunt-stage cv-builder">
    <CreateSteps step={0} />
    <div className="hunt-stage-head"><div><span className="pixel-eyebrow">MYPLAYER</span><h2>Build him yourself</h2></div>
      <div className="cv-budget"><span>POINTS LEFT</span><b className={left < 0 ? 'down' : ''}>{left}</b></div></div>
    <div className={`mp-stock tier-${stock.tier.id}`}>
      <div><small>DRAFT STOCK</small><b>{stock.tier.name}</b><span>{stock.tier.blurb} {budget} points for his prime.</span></div>
      <button disabled={roll >= POTENTIAL_REROLLS} onClick={() => { setRoll(roll + 1); setB(fitBuild(b, rollPotential(seed, roll + 1).budget)); }}>Reroll ({POTENTIAL_REROLLS - roll})</button>
    </div>
    <p className="hint-text">These are his prime ratings: what he grows into. Pick a part of him to work on. Height sets the limits: a big man can't handle like a point guard, and a guard can't protect the rim like a center.</p>
    <div className="mp-layout">
      <MyPlayerBoard b={b} name="" selected={selected} onSelect={setSelected} />
      <div className="mp-editor">
        <span className="pixel-eyebrow">{cat.short}</span>
        <h3>{cat.name}</h3>
        <p className="hint-text">{cat.blurb}</p>
        {selected === 'size' ? <div className="cv-sliders mp-sliders">
          <label><span>Height <b>{feetInches(b.heightIn)}</b></span><input type="range" min={69} max={89} value={b.heightIn} onChange={e => setHeight(Number(e.target.value))} /></label>
          <label><span>Wingspan <b>{feetInches(b.wingspanIn)}</b></span><input type="range" min={b.heightIn - 2} max={b.heightIn + 10} value={b.wingspanIn} onChange={e => setB({ ...b, wingspanIn: Number(e.target.value) })} /></label>
        </div> : <div className="cv-sliders mp-sliders">
          <label><span>{cat.name} <b>{b.ratings[ratingId!]}</b><small> max {capFor(ratingId!, b.heightIn)}</small></span>
            <span className="mp-stepper">
              <button type="button" aria-label={`Lower ${cat.name}`} onClick={() => setRating(ratingId!, b.ratings[ratingId!] - 1)}>−</button>
              <input type="range" min={BUILD_MIN} max={capFor(ratingId!, b.heightIn)} value={b.ratings[ratingId!]} onChange={e => setRating(ratingId!, Number(e.target.value))} />
              <button type="button" aria-label={`Raise ${cat.name}`} onClick={() => setRating(ratingId!, b.ratings[ratingId!] + 1)}>+</button>
            </span></label>
          {selected === 'body' && <label><span>Weight <b>{b.weightLbs} lb</b></span><input type="range" min={165} max={300} value={b.weightLbs} onChange={e => setB({ ...b, weightLbs: Number(e.target.value) })} /></label>}
        </div>}
        <ul className="mp-summary">{RATING_CATEGORIES.map(id => <li key={id} className={id === selected ? 'on' : ''}><button type="button" onClick={() => setSelected(id)}><span>{CATEGORIES.find(c => c.id === id)!.short}</span><b>{b.ratings[id]}</b></button></li>)}</ul>
        <p>Suggested position: <b>{pos}</b> · prime overall about <b>{primeOverall(prime, 'balanced', pos)}</b></p>
      </div>
    </div>
    <div className="contest-actions"><button className="primary" disabled={left < 0} onClick={() => onDone(prime)}>Next: name your player</button><button className="link-button" onClick={onBack}>Back</button></div>
  </section>;
}

// ---------------------------------------------------------------- Create Anything (unranked)

const FIELD_LABEL = (k: string) => k.replace(/([A-Z0-9])/g, ' $1').replace(/^./, c => c.toUpperCase()).replace(/ I Q/g, ' IQ').replace(/ 3$/, ' 3');
const avgOf = (b: SandboxBuild, paths: string[]) => Math.round(paths.reduce((n, p) => n + (b.values[p] ?? 0), 0) / Math.max(1, paths.length));

/** Create Anything: every rating 1-120, any size, no budget. Just for fun: it never counts anywhere. */
export function SandboxBuilder({ onDone, onBack }: { onDone: (prime: Prime) => void; onBack: () => void }) {
  const [b, setB] = useState<SandboxBuild>(() => sandboxBuild(75));
  const [open, setOpen] = useState<CategoryId | null>(null);
  const prime = primeFromSandbox(b);
  const pos = suggestPosition(prime);
  const rated = CATEGORIES.filter(c => c.id !== 'size');
  const setAll = (v: number) => setB(x => rated.reduce((acc, c) => setSandbox(acc, categoryPaths(c.id), v), x));
  return <section className="hunt-stage cv-builder cv-sandbox">
    <CreateSteps step={0} />
    <div className="hunt-stage-head"><div><span className="pixel-eyebrow">CREATE ANYTHING</span><h2>Make him whatever you want</h2></div>
      <div className="cv-budget"><span>PRIME OVERALL</span><b>{primeOverall(prime, 'exact', pos)}</b></div></div>
    <p className="hint-text">Every rating from {SANDBOX_MIN} to {SANDBOX_MAX}, any height, no points to spend. <b>Just for fun:</b> this career never counts for leaderboards, XP, achievements or rewards.</p>
    <div className="cv-sandbox-presets" role="group" aria-label="Set every rating">
      <span>Set everything to</span>{[1, 50, 75, 99, 120].map(v => <button key={v} type="button" onClick={() => setAll(v)}>{v}</button>)}
    </div>
    <div className="cv-sliders cv-sandbox-size">
      <label><span>Height <b>{feetInches(b.heightIn)}</b></span><input type="range" min={SANDBOX_HEIGHT.min} max={SANDBOX_HEIGHT.max} value={b.heightIn} onChange={e => { const h = Number(e.target.value); setB({ ...b, heightIn: h, wingspanIn: b.wingspanIn + (h - b.heightIn) }); }} /></label>
      <label><span>Wingspan <b>{feetInches(prime.size['physical.wingspanInches'])}</b></span><input type="range" min={b.heightIn - 12} max={b.heightIn + 18} value={b.wingspanIn} onChange={e => setB({ ...b, wingspanIn: Number(e.target.value) })} /></label>
      <label><span>Weight <b>{b.weightLbs} lb</b></span><input type="range" min={SANDBOX_WEIGHT.min} max={SANDBOX_WEIGHT.max} value={b.weightLbs} onChange={e => setB({ ...b, weightLbs: Number(e.target.value) })} /></label>
    </div>
    <ul className="cv-sandbox-cats">{rated.map(c => { const paths = categoryPaths(c.id), v = avgOf(b, paths);
      return <li key={c.id}>
        <label><span><b>{c.name}</b> <small>{c.blurb}</small></span>
          <span className="mp-stepper">
            <button type="button" aria-label={`Lower ${c.name}`} onClick={() => setB(setSandbox(b, paths, v - 1))}>−</button>
            <input type="range" min={SANDBOX_MIN} max={SANDBOX_MAX} value={v} onChange={e => setB(setSandbox(b, paths, Number(e.target.value)))} aria-label={c.name} />
            <button type="button" aria-label={`Raise ${c.name}`} onClick={() => setB(setSandbox(b, paths, v + 1))}>+</button>
            <input className="year-input cv-sandbox-num" type="number" min={SANDBOX_MIN} max={SANDBOX_MAX} value={v} onChange={e => setB(setSandbox(b, paths, Number(e.target.value) || SANDBOX_MIN))} aria-label={`${c.name} value`} />
          </span></label>
        <button type="button" className="link-button" aria-expanded={open === c.id} onClick={() => setOpen(open === c.id ? null : c.id)}>{open === c.id ? 'Hide each rating' : `Fine-tune ${paths.length} ratings`}</button>
        {open === c.id && <div className="cv-sandbox-fields">{paths.map(p => <label key={p}><span>{FIELD_LABEL(p.split('.')[1])} <b>{b.values[p]}</b></span>
          <input type="range" min={SANDBOX_MIN} max={SANDBOX_MAX} value={b.values[p]} onChange={e => setB(setSandbox(b, [p], Number(e.target.value)))} /></label>)}</div>}
      </li>; })}</ul>
    <p>Suggested position: <b>{pos}</b> · prime overall <b>{primeOverall(prime, 'exact', pos)}</b> <small className="hint-text">(over 99 a rating unlocks superstar effects: 110 athleticism plays all 48 minutes, 110 body owns the paint, 110 IQ lifts the team)</small></p>
    <div className="contest-actions"><button className="primary" onClick={() => onDone(prime)}>Next: name your player</button><button className="link-button" onClick={onBack}>Back</button></div>
  </section>;
}

// ---------------------------------------------------------------- name, position, number

const FIRST = ['Marcus', 'Jalen', 'Andre', 'Tyrese', 'Devin', 'Malik', 'Isaiah', 'Caleb', 'Darius', 'Jordan', 'Cam', 'Trey', 'Xavier', 'Elijah', 'Kobe', 'Zion'];
const LAST = ['Carter', 'Hayes', 'Brooks', 'Walker', 'Ellis', 'Grant', 'Mitchell', 'Reed', 'Coleman', 'Vaughn', 'Porter', 'Banks', 'Fields', 'Harlan', 'Stokes', 'Monroe'];

export interface IdentityChoice { name: string; pos: Position; jersey: number; readiness: Readiness }

export function IdentityView({ prime, seed, onDone, onBack, ready, pct, sandbox }: { prime: Prime; seed: number; onDone: (c: IdentityChoice) => void; onBack: () => void; ready: boolean; pct: number | null; /** Create Anything: "Exactly as built" is offered (and picked). */ sandbox?: boolean }) {
  const [name, setName] = useState(() => `${FIRST[seed % FIRST.length]} ${LAST[Math.floor(seed / 7) % LAST.length]}`);
  const [pos, setPos] = useState<Position>(() => suggestPosition(prime));
  const [jersey, setJersey] = useState(() => (seed % 50) + 1);
  const [readiness, setReadiness] = useState<Readiness>(sandbox ? 'exact' : 'balanced');
  const rookie = calculateOverall(buildPlayer({ name: 'x', pos, jersey }, prime, startProgress(), readiness, '2025-26', START_AGE, seed));
  const primeOvr = primeOverall(prime, readiness, pos);
  const h = prime.size['physical.heightInches'];
  return <section className="hunt-stage cv-builder">
    <CreateSteps step={1} />
    <div className="cv-builder-head"><span className="pixel-eyebrow">WHO IS HE?</span><h2>Name your player</h2></div>
    <div className="cv-identity">
      <PlayerAvatar playerId={name || 'You'} primaryColor="#f47b20" secondaryColor="#f4f0e6" size={96} />
      <div className="cv-sliders">
        <label><span>Name</span><input className="year-input" value={name} maxLength={28} onChange={e => setName(e.target.value)} /></label>
        <label><span>Position <small>(suggested: {suggestPosition(prime)})</small></span><select value={pos} onChange={e => setPos(e.target.value as Position)}>{(['PG', 'SG', 'SF', 'PF', 'C'] as Position[]).map(p => <option key={p}>{p}</option>)}</select></label>
        <label><span>Jersey number</span><input className="year-input" type="number" min={0} max={99} value={jersey} onChange={e => setJersey(Math.max(0, Math.min(99, Number(e.target.value) || 0)))} /></label>
      </div>
    </div>
    <h3 className="hunt-subhead">How ready is he?</h3>
    <div className="hunt-choices">{(sandbox ? ['exact', ...NORMAL_READINESS] as Readiness[] : NORMAL_READINESS).map(r => <button key={r} className={`hunt-choice ${readiness === r ? 'on' : ''}`} aria-pressed={readiness === r} onClick={() => setReadiness(r)}><b>{READINESS[r].name}</b><span>{READINESS[r].blurb}</span></button>)}</div>
    <div className="hunt-versus"><div><small>ROOKIE</small><b className="hunt-rating">{rookie}</b></div><span>→</span><div><small>PRIME</small><b className="hunt-rating">{primeOvr}</b></div><span className="hint-text">{feetInches(h)} · {prime.body['physical.weightLbs']} lb · age {START_AGE}</span></div>
    <div className="contest-actions">
      <button className="primary hunt-play" disabled={!name.trim()} onClick={() => onDone({ name: name.trim(), pos, jersey, readiness })}>{ready ? 'Enter the draft' : `Enter the draft (the season before is being played${pct != null ? `: ${pct}%` : ''})`}</button>
      <button className="link-button" onClick={onBack}>Back</button>
    </div>
  </section>;
}
