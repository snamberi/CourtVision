import { useState } from 'react';
import type { NbaHistory } from '../../history/nbaHistoryData';
import { cardPool, seasonLabel, RARITY_LABEL } from '../../hunt/cards';
import { CATEGORIES, categoryLabel, categoryScore, feetInches, type CategoryId } from '../../career/categories';
import { eliteRanks, newWheel, spin, respin, move, take, landed, neighbour, donorCategories, mustTake, canSpin, isComplete, openWheels, REEL_LENGTH, type WheelState, type Wheel } from '../../career/wheel';
import {
  READINESS, suggestPosition, primeOverall, buildPlayer, startProgress, primeFromBuild, capFor, buildSpent, RATING_CATEGORIES, BUILD_BUDGET, BUILD_MIN, START_AGE,
  type Prime, type Readiness, type Position, type Build,
} from '../../career/create';
import { calculateOverall } from '../../simulation/engine/overall';
import { PlayerAvatar } from '../PlayerAvatar';

const SLICE = 132;

/** One wheel: a strip of real players that spins to a stop; the slices either side are the Move Left/Right options. */
function Reel({ h, wheel, spinKey }: { h: NbaHistory; wheel: Wheel; spinKey: number }) {
  const pool = cardPool(h);
  // Three copies of the reel so it can travel a long way before stopping on the middle copy.
  const strip = [...wheel.reel, ...wheel.reel, ...wheel.reel];
  const target = REEL_LENGTH * 2 + wheel.stop;
  const to = -(target * SLICE) + SLICE * 3;
  return <div className="cv-reel" aria-label={`Stopped on ${pool.byId.get(landed(wheel))?.name}`}>
    <div className="cv-reel-marker" aria-hidden="true" />
    <div key={spinKey} className="cv-reel-strip" style={{ transform: `translateX(${to}px)`, ['--from' as string]: `${SLICE * 3}px` }}>
      {strip.map((id, i) => { const c = pool.byId.get(id)!; return <div key={i} className={`cv-slice rarity-${c.rarity} ${i === target ? 'on' : ''}`}><b>{c.name}</b><small>'{String(c.end).slice(2)} · {c.ovr}</small></div>; })}
    </div>
  </div>;
}

/** The player a wheel landed on, with his ten categories to take from. */
function Landed({ h, s, wheel, index, onTake }: { h: NbaHistory; s: WheelState; wheel: Wheel; index: number; onTake: (cat: CategoryId) => void }) {
  const pool = cardPool(h);
  const id = landed(wheel), c = pool.byId.get(id)!;
  const cats = donorCategories(h, id);
  const elite = eliteRanks(h).get(id);
  const used = s.takenFrom.includes(index);
  return <div className={`cv-landed rarity-${c.rarity} ${used ? 'used' : ''}`}>
    <div className="cv-landed-head"><PlayerAvatar playerId={c.name} primaryColor="#f47b20" secondaryColor="#f4f0e6" size={48} />
      <div><small>{RARITY_LABEL[c.rarity].toUpperCase()} · {c.pos}</small><strong>{c.name}</strong><span>{seasonLabel(c.end)} {c.teamName} · {c.ovr} OVR</span></div></div>
    <ul className="cv-cats">{CATEGORIES.map(cat => { const taken = s.picks[cat.id]; return <li key={cat.id}>
      <span>{cat.name}{elite?.[cat.id] ? <small className="cv-elite-tag"> #{elite[cat.id]} ever</small> : null}</span><b className={categoryScore(cats[cat.id]) > 99 ? 'cv-elite' : ''}>{categoryLabel(cat.id, cats[cat.id])}</b>
      {taken ? <small>{taken.cardId === id ? 'Taken' : 'Filled'}</small> : <button className="cv-take" disabled={used} onClick={() => onTake(cat.id)}>Take</button>}
    </li>; })}</ul>
  </div>;
}

/** Your build so far: the ten categories and where each came from. */
function BuildBoard({ h, s }: { h: NbaHistory; s: WheelState }) {
  const pool = cardPool(h);
  const filled = CATEGORIES.filter(c => s.picks[c.id]).length;
  return <div className="hunt-squad cv-build"><div className="hunt-squad-head"><h3>Your player</h3><span>{filled}/10</span></div>
    <ol>{CATEGORIES.map(cat => { const p = s.picks[cat.id]; return <li key={cat.id} className={p ? '' : 'empty'}>
      <span className="hunt-slot">{cat.short}</span>
      {p ? <><span className="hunt-squad-ovr">{categoryLabel(cat.id, p.values)}</span><span className="hunt-squad-name"><small>from</small> {pool.byId.get(p.cardId)?.name} <small>'{String(pool.byId.get(p.cardId)?.end ?? 0).slice(2)}</small></span></>
        : <span className="hunt-squad-name"><small>{cat.blurb}</small></span>}
    </li>; })}</ol></div>;
}

export function WheelBuilder({ h, seed, onDone, onBack }: { h: NbaHistory; seed: number; onDone: (prime: Prime) => void; onBack: () => void }) {
  const [s, setS] = useState<WheelState>(() => newWheel(seed));
  const done = isComplete(s);
  const single = s.current?.length === 1;
  const pool = cardPool(h);
  const w0 = s.current?.[0];
  return <section className="hunt-stage">
    <div className="hunt-stage-head"><div><span className="pixel-eyebrow">RANDOM MODE · SPIN {s.spinCount}</span><h2>{done ? 'Your player is built' : mustTake(s) ? 'Take one category' : 'Spin the wheel'}</h2></div>
      <div className="cv-tools">
        <button className="primary" disabled={!canSpin(s)} onClick={() => setS(spin(h, s))}>Spin</button>
        <button disabled={!canSpin(s) || !s.triple} onClick={() => setS(spin(h, s, true))} title="Three wheels at once; take from any of them">Triple Spin {s.triple ? '(1)' : '(used)'}</button>
        <button disabled={!mustTake(s) || s.respins <= 0} onClick={() => setS(respin(h, s))} title="Spin again without taking anything">Respin ({s.respins})</button>
        <button disabled={!mustTake(s) || !single || !s.moves.left} onClick={() => setS(move(s, 'left'))} title={w0 ? `Move to ${pool.byId.get(neighbour(w0, 'left'))?.name}` : ''}>← Move left</button>
        <button disabled={!mustTake(s) || !single || !s.moves.right} onClick={() => setS(move(s, 'right'))} title={w0 ? `Move to ${pool.byId.get(neighbour(w0, 'right'))?.name}` : ''}>Move right →</button>
      </div></div>
    <p className="hint-text">Every player in NBA history is on the wheel once, at his best season; the odds lean a little toward good players (Star about 7%, Great about 18%). The best ever at a skill go past 99, up to 120. Take one category from the player it stops on: you get his exact ratings as your player's prime. Move Left and Move Right work once each; two respins; one triple spin, where you can take one category from each of the three.</p>
    {s.current ? <div className="cv-wheels">{s.current.map((w, i) => <div key={i} className="cv-wheel">
      <Reel h={h} wheel={w} spinKey={s.spinCount * 10 + i} />
      <Landed h={h} s={s} wheel={w} index={i} onTake={cat => setS(take(h, s, i, cat))} />
    </div>)}</div> : !done && <p className="empty-state">Spin to start. Ten categories to fill.</p>}
    {s.current && openWheels(s).length > 0 && s.takenFrom.length > 0 && !done && <p className="hint-text">You can take from the other wheels too, or spin again.</p>}
    {done && <button className="primary hunt-play" onClick={() => onDone(Object.fromEntries(CATEGORIES.map(c => [c.id, s.picks[c.id]!.values])) as Prime)}>Next: name your player</button>}
    <BuildBoard h={h} s={s} />
    <button className="link-button" onClick={onBack}>Back</button>
  </section>;
}

// ---------------------------------------------------------------- MyPlayer

const DEFAULT_BUILD: Build = { heightIn: 79, weightLbs: 215, wingspanIn: 83, ratings: { body: 65, athleticism: 72, finishing: 72, midRange: 70, threePoint: 72, playmaking: 70, perimeterD: 68, interiorD: 60, iq: 71 } };

export function MyPlayerBuilder({ seed, onDone, onBack }: { seed: number; onDone: (prime: Prime) => void; onBack: () => void }) {
  const [b, setB] = useState<Build>(DEFAULT_BUILD);
  const spent = buildSpent(b), left = BUILD_BUDGET - spent;
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
  return <section className="hunt-stage">
    <div className="hunt-stage-head"><div><span className="pixel-eyebrow">MYPLAYER</span><h2>Build him yourself</h2></div>
      <div className="cv-budget"><span>POINTS LEFT</span><b className={left < 0 ? 'down' : ''}>{left}</b></div></div>
    <p className="hint-text">These are his prime ratings: what he grows into. Height sets the limits: a big man can't handle like a point guard, and a guard can't protect the rim like a center.</p>
    <div className="cv-sliders">
      <label><span>Height <b>{feetInches(b.heightIn)}</b></span><input type="range" min={69} max={89} value={b.heightIn} onChange={e => setHeight(Number(e.target.value))} /></label>
      <label><span>Wingspan <b>{feetInches(b.wingspanIn)}</b></span><input type="range" min={b.heightIn - 2} max={b.heightIn + 10} value={b.wingspanIn} onChange={e => setB({ ...b, wingspanIn: Number(e.target.value) })} /></label>
      <label><span>Weight <b>{b.weightLbs} lb</b></span><input type="range" min={165} max={300} value={b.weightLbs} onChange={e => setB({ ...b, weightLbs: Number(e.target.value) })} /></label>
      {RATING_CATEGORIES.map(id => { const cat = CATEGORIES.find(c => c.id === id)!, cap = capFor(id, b.heightIn); return <label key={id}>
        <span>{cat.name} <b>{b.ratings[id]}</b><small> max {cap}</small></span>
        <input type="range" min={BUILD_MIN} max={cap} value={b.ratings[id]} onChange={e => setRating(id, Number(e.target.value))} />
      </label>; })}
    </div>
    <p>Suggested position: <b>{pos}</b> · prime overall about <b>{primeOverall(prime, 'balanced', pos)}</b></p>
    <div className="contest-actions"><button className="primary" disabled={left < 0} onClick={() => onDone(prime)}>Next: name your player</button><button className="link-button" onClick={onBack}>Back</button></div>
  </section>;
}

// ---------------------------------------------------------------- name, position, number

const FIRST = ['Marcus', 'Jalen', 'Andre', 'Tyrese', 'Devin', 'Malik', 'Isaiah', 'Caleb', 'Darius', 'Jordan', 'Cam', 'Trey', 'Xavier', 'Elijah', 'Kobe', 'Zion'];
const LAST = ['Carter', 'Hayes', 'Brooks', 'Walker', 'Ellis', 'Grant', 'Mitchell', 'Reed', 'Coleman', 'Vaughn', 'Porter', 'Banks', 'Fields', 'Harlan', 'Stokes', 'Monroe'];

export interface IdentityChoice { name: string; pos: Position; jersey: number; readiness: Readiness }

export function IdentityView({ prime, seed, onDone, onBack, ready, pct }: { prime: Prime; seed: number; onDone: (c: IdentityChoice) => void; onBack: () => void; ready: boolean; pct: number | null }) {
  const [name, setName] = useState(() => `${FIRST[seed % FIRST.length]} ${LAST[Math.floor(seed / 7) % LAST.length]}`);
  const [pos, setPos] = useState<Position>(() => suggestPosition(prime));
  const [jersey, setJersey] = useState(() => (seed % 50) + 1);
  const [readiness, setReadiness] = useState<Readiness>('balanced');
  const rookie = calculateOverall(buildPlayer({ name: 'x', pos, jersey }, prime, startProgress(), readiness, '2025-26', START_AGE, seed));
  const primeOvr = primeOverall(prime, readiness, pos);
  const h = prime.size['physical.heightInches'];
  return <section className="hunt-stage">
    <div><span className="pixel-eyebrow">WHO IS HE?</span><h2>Name your player</h2></div>
    <div className="cv-identity">
      <PlayerAvatar playerId={name || 'You'} primaryColor="#f47b20" secondaryColor="#f4f0e6" size={96} />
      <div className="cv-sliders">
        <label><span>Name</span><input className="year-input" value={name} maxLength={28} onChange={e => setName(e.target.value)} /></label>
        <label><span>Position <small>(suggested: {suggestPosition(prime)})</small></span><select value={pos} onChange={e => setPos(e.target.value as Position)}>{(['PG', 'SG', 'SF', 'PF', 'C'] as Position[]).map(p => <option key={p}>{p}</option>)}</select></label>
        <label><span>Jersey number</span><input className="year-input" type="number" min={0} max={99} value={jersey} onChange={e => setJersey(Math.max(0, Math.min(99, Number(e.target.value) || 0)))} /></label>
      </div>
    </div>
    <h3 className="hunt-subhead">How ready is he?</h3>
    <div className="hunt-choices">{(Object.keys(READINESS) as Readiness[]).map(r => <button key={r} className={`hunt-choice ${readiness === r ? 'on' : ''}`} aria-pressed={readiness === r} onClick={() => setReadiness(r)}><b>{READINESS[r].name}</b><span>{READINESS[r].blurb}</span></button>)}</div>
    <div className="hunt-versus"><div><small>ROOKIE</small><b className="hunt-rating">{rookie}</b></div><span>→</span><div><small>PRIME</small><b className="hunt-rating">{primeOvr}</b></div><span className="hint-text">{feetInches(h)} · {prime.body['physical.weightLbs']} lb · age {START_AGE}</span></div>
    <div className="contest-actions">
      <button className="primary hunt-play" disabled={!name.trim()} onClick={() => onDone({ name: name.trim(), pos, jersey, readiness })}>{ready ? 'Enter the draft' : `Enter the draft (the season before is being played${pct != null ? `: ${pct}%` : ''})`}</button>
      <button className="link-button" onClick={onBack}>Back</button>
    </div>
  </section>;
}
