import { useEffect, useState, type ReactNode } from 'react';
import { readFavorites } from '../../profile/favorites';
import type { NbaHistory } from '../../history/nbaHistoryData';
import { cardNotes } from '../../hunt/cardNotes';
import { cardPool, seasonLabel, RARITY_LABEL, type HuntCard } from '../../hunt/cards';
import { huntTeams, teamLabel, type HuntTeam } from '../../hunt/teams';
import { ERAS, eraOf } from '../../hunt/eras';
import {
  newRun, stopReels, lockReel, openSpins, chooseFocus, playSeries, takeBoost, buyCard, buyCoach, buyItem, buyLife, canBuyLife, train, leaveShop, gameBonuses, squadRating, baseSquadRating, opponentRating, buffValue, coachBonus,
  cardPrice, coachPrice, maxLives, spinWeights, draftGrade, slotName, shopItems, NEUTRAL_GAME, SPINS, SLOTS, FOCUS, FOCUS_IDS, DECKS, DIFFICULTIES, SERIES_COUNT, WINS_NEEDED, LIFE_PRICE, TRAIN_PRICE, TRAIN_STEP, MAX_TRAINING, BOOST_CAP, MAX_BOOSTS,
  type HuntRun, type HuntSeries, type SeriesPlay, type Focus, type Slot, type SpinKind,
} from '../../hunt/run';
import { ITEMS, MAX_ITEMS } from '../../hunt/items';
import { BOOSTS } from '../../hunt/boosts';
import { BUFFS } from '../../hunt/buffs';
import { COACHES, COACH_BY_ID, COACH_STYLE, coachRarity } from '../../hunt/coaches';
import type { ChemistryBond } from '../../hunt/chemistry';
import { track, trackOnce } from '../../analytics/track';
import { ghostFromRun } from '../../hunt/pvp';
import { publishGhost, saveLocalGhost } from '../../cloud/pvp';
import { loadRun, saveRun, clearRun, loadRecords, recordRun, type HuntRecords } from '../../hunt/storage';
import { PlayerAvatar } from '../PlayerAvatar';
import { PixelIcon } from '../PixelIcon';
import { HuntHub } from './HuntHub';
import { HuntMap } from './HuntMap';
import { CoachFigure } from '../CoachFigure';
import { coachLook } from '../../visuals/coachLook';
import { ShareCardButton } from '../ShareCardButton';
import './hunt.css';

/** League Hunt: spin a six-man squad and a coach from all of basketball history, then win ten best-of-seven series. */
export function LeagueHunt({ onExit }: { onExit: () => void }) {
  const [h, setH] = useState<NbaHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [run, setRunState] = useState<HuntRun | null>(() => loadRun());
  const [records, setRecords] = useState<HuntRecords>(() => loadRecords());
  /** The series just played, while its scoreboard runs (it is already recorded in the run). */
  const [play, setPlay] = useState<{ play: SeriesPlay; series: HuntSeries; index: number; before: HuntRun; revealed: boolean } | null>(null);
  useEffect(() => {
    let live = true;
    import('../../history/nbaHistoryData').then(m => m.loadNbaHistory()).then(d => { if (live) setH(d); }, e => { if (live) setError(e instanceof Error ? e.message : String(e)); });
    return () => { live = false; };
  }, []);
  const setRun = (r: HuntRun | null) => {
    setRunState(r);
    if (!r) clearRun();
    else saveRun(r);
    if (r && (r.stage === 'won' || r.stage === 'lost') && run?.stage !== r.stage) {
      setRecords(recordRun(r));
      // The finished squad becomes your League Hunt PvP team (published when you are signed in).
      const ghost = ghostFromRun(r);
      if (ghost) { saveLocalGhost(ghost); void publishGhost(ghost).catch(() => {}); }
      trackOnce(`hunt-${r.seed}`, 'mode_finish', { mode: 'hunt', result: r.stage, reached: r.seriesIndex + 1, difficulty: r.difficulty ?? 'pro', deck: r.deck ?? 'classic', daily: !!r.daily });
    }
    if (r && r.stage === 'draft' && r.seed !== run?.seed) track('mode_start', { mode: 'hunt', variant: r.daily ? 'daily' : r.weekly ? 'weekly' : 'run', difficulty: r.difficulty ?? 'pro', deck: r.deck ?? 'classic' });
  };

  /** PLAY: out of the shop (if it is open) and straight into the series. */
  const startSeries = () => {
    if (!h || !run) return;
    const ready = run.stage === 'shop' ? leaveShop(run) : run;
    const r = playSeries(h, ready); if (!r) return;
    setPlay({ play: r.play, series: ready.series[ready.seriesIndex], index: ready.seriesIndex, before: ready, revealed: false }); setRun(r.run);
  };
  // While the scoreboard runs, the header still shows the lives and coins from before the series (no spoilers).
  const shown = play && !play.revealed ? play.before : run;
  const header = <header className="hunt-top">
    <button className="hunt-exit" onClick={onExit}><PixelIcon name="exit" size={16} /> Main Menu</button>
    <div className="hunt-title"><span className="pixel-eyebrow">A RUN THROUGH BASKETBALL HISTORY</span><h1>League Hunt</h1></div>
    {shown && shown.stage !== 'won' && shown.stage !== 'lost' && shown.stage !== 'draft' && <div className="hunt-purse"><span className="hunt-coins" title="Coins">{shown.coins} coins</span>
      {shown.items.map(i => <span key={i} className="hunt-item-chip" title={ITEMS[i].blurb}>{ITEMS[i].name}</span>)}</div>}
    {shown && shown.stage !== 'won' && shown.stage !== 'lost' && <div className="hunt-lives" aria-label={`${shown.lives} lives left`}>{Array.from({ length: maxLives(shown) }, (_, i) => <span key={i} className={i < shown.lives ? 'on' : ''}><PixelIcon name="heart" size={18} /></span>)}</div>}
  </header>;

  if (error) return <div className="hunt">{header}<p className="empty-state">Could not load the NBA history data: {error}</p></div>;
  if (!h) return <div className="hunt">{header}<p className="empty-state">Loading 80 years of basketball…</p></div>;

  return <div className={`hunt ${play ? `era-${play.play.era.id}` : ''}`}>
    {header}
    {!run ? <HuntHub h={h} records={records} onStart={(seed, opts) => { setPlay(null); setRun(newRun(h, seed, { ...opts, fav: readFavorites().player })); }} />
      : play ? <SeriesView h={h} run={run} play={play.play} series={play.series} index={play.index} onReveal={() => setPlay(p => (p && !p.revealed ? { ...p, revealed: true } : p))} onContinue={() => setPlay(null)} />
      : run.stage === 'draft' ? <SlotMachine key={run.seed} h={h} run={run} onRun={setRun} onAbandon={() => setRun(null)} />
      : run.stage === 'focus' ? <FocusView run={run} onChoose={f => setRun(chooseFocus(h, run, f))} />
      : run.stage === 'shop' ? <HuntBase h={h} run={run} onRun={setRun} onPlay={startSeries} onAbandon={() => setRun(null)} />
      : run.stage === 'boost' ? <BoostPick h={h} run={run} onTake={b => setRun(takeBoost(h, run, b))} />
      : run.stage === 'won' || run.stage === 'lost' ? <RunOver h={h} run={run} records={records} onNew={() => { setPlay(null); setRun(newRun(h, Math.floor(Math.random() * 1_000_000_000), { deck: run.deck, difficulty: run.difficulty, fav: readFavorites().player })); }} onExit={() => { setRun(null); onExit(); }} />
      : <HuntBase h={h} run={run} onRun={setRun} onPlay={startSeries} onAbandon={() => setRun(null)} />}
  </div>;
}

const posColor: Record<string, string> = { PG: '#4da3ff', SG: '#55c878', SF: '#ffd166', PF: '#f47b20', C: '#e85d5d', G: '#4da3ff', F: '#f47b20' };
const pct = (v: number) => `${Math.round(v)}%`;

/** The six slots and the coach, filled or waiting. */
function SlotBoard({ h, run, series }: { h: NbaHistory; run: HuntRun; series?: HuntSeries }) {
  const era = series ? ERAS.find(e => e.id === series.eraId) : undefined;
  const bonuses = run.squad.length ? gameBonuses(h, run, era, NEUTRAL_GAME, series).cards : [];
  const coach = run.coach ? COACH_BY_ID.get(run.coach) : undefined;
  const rating = run.squad.length === SLOTS.length ? squadRating(h, run, series) : null;
  return <div className="hunt-squad">
    <div className="hunt-squad-head"><h3>Your squad</h3>{rating != null && <span>Rating <b className="hunt-rating">{rating}</b>{rating !== baseSquadRating(h, run) ? <small> (cards alone {baseSquadRating(h, run)})</small> : null}</span>}</div>
    <ol>{SLOTS.map((slot, i) => { const b = bonuses[i]; const c = b?.card; return <li key={slot} className={c ? `rarity-${c.rarity}` : 'empty'}>
      <span className="hunt-slot">{slot === '6TH' ? '6TH' : slot}</span>
      {c ? <><span className="hunt-squad-ovr">{c.ovr}</span>
        {b.bonus !== 0 ? <span className={`hunt-bonus ${b.bonus > 0 ? 'up' : 'down'}`} title={b.parts.join(', ')}>{b.bonus > 0 ? '+' : ''}{b.bonus}</span> : <span className="hunt-bonus" />}
        <span className="hunt-squad-name">{c.name} <small>'{String(c.end).slice(2)} · {c.pos} · {RARITY_LABEL[c.rarity]}{run.training[c.id] ? ` · trained +${run.training[c.id]}` : ''}</small></span></>
        : <span className="hunt-squad-name"><small>Waiting for the {slot === '6TH' ? 'sixth man' : slot} spin</small></span>}
    </li>; })}
      <li className={coach ? `rarity-${coachRarity(coach)}` : 'empty'}><span className="hunt-slot">COACH</span>
        {coach ? <><span className="hunt-squad-ovr">{coachBonus(run) > 0 ? '+' : ''}{coachBonus(run)}</span><span className="hunt-bonus" /><span className="hunt-squad-name">{coach.name} <small>{COACH_STYLE[coach.style]}</small></span></>
          : <span className="hunt-squad-name"><small>Waiting for the coach spin</small></span>}</li>
    </ol>
  </div>;
}

const TICK_MS = 85, STOP_STAGGER = 120;
const REEL_LABEL: Record<SpinKind, string> = { PG: 'PG', SG: 'SG', SF: 'SF', PF: 'PF', C: 'C', '6TH': '6TH MAN', COACH: 'COACH' };
const initials = (name: string) => name.split(' ').map(w => w[0]).filter(ch => /[A-Z]/.test(ch)).slice(0, 2).join('');

/** Faces for a spinning reel: random real players who fit the slot (display only; where it stops is seeded in run.ts). */
function useReelFaces(h: NbaHistory) {
  const [faces] = useState(() => {
    const pool = cardPool(h).cards.filter(c => c.ovr >= 60);
    const fits = (c: HuntCard, s: SpinKind) => s === '6TH' || c.pos === s || (c.pos === 'G' && (s === 'PG' || s === 'SG')) || (c.pos === 'F' && (s === 'SF' || s === 'PF'));
    const out = {} as Record<SpinKind, { name: string; sub: string }[]>;
    for (const s of SPINS) {
      out[s] = s === 'COACH' ? COACHES.map(x => ({ name: x.name, sub: x.franchises.slice(0, 2).join(' · ') }))
        : Array.from({ length: 30 }, () => { const list = pool.filter(c => fits(c, s)); const c = list[Math.floor(Math.random() * list.length)]; return { name: c.name, sub: `${seasonLabel(c.end)} · ${c.team}` }; });
    }
    return out;
  });
  return faces;
}

/**
 * The slot-machine draft: every open slot spins at once. STOP freezes them one after another (left to right), you lock
 * one, and the rest spin again, until the squad and the coach are all locked. Ratings stay hidden until you lock.
 */
function SlotMachine({ h, run, onRun, onAbandon }: { h: NbaHistory; run: HuntRun; onRun: (r: HuntRun) => void; onAbandon: () => void }) {
  const pool = cardPool(h);
  const faces = useReelFaces(h);
  const [tick, setTick] = useState(0);
  /** When STOP was hit: the reels settle one after another from then. */
  const [stoppedAt, setStoppedAt] = useState<number | null>(() => (run.reels ? 0 : null));
  const [justLocked, setJustLocked] = useState<SpinKind | null>(null);
  const open = openSpins(run);
  const frozen = !!run.reels;
  const settled = (i: number) => frozen && (stoppedAt === 0 || reducedMotion() || (stoppedAt != null && tick * TICK_MS >= i * STOP_STAGGER + 200));
  const allSettled = frozen && open.every((_, i) => settled(i));
  const animating = !frozen || !allSettled;
  useEffect(() => {
    if (!animating || reducedMotion()) return;
    const t = setInterval(() => setTick(n => n + 1), TICK_MS);
    return () => clearInterval(t);
  }, [animating]);
  const stop = () => { setTick(0); setStoppedAt(Date.now()); setJustLocked(null); onRun(stopReels(h, run)); };
  const lock = (k: SpinKind) => { if (!allSettled) return; setJustLocked(k); setStoppedAt(null); onRun(lockReel(h, run, k)); };
  const w = spinWeights(run.spin), total = w.common + w.rare + w.epic + w.legendary;
  const guaranteed = run.spin === run.guarantees.star ? 'A Star lands on these reels.' : run.spin === run.guarantees.great ? 'A Great player lands on these reels.' : null;
  const message = !frozen ? <>Everything is spinning. Hit <b className="hunt-stop-word">STOP</b> when you are ready</>
    : !allSettled ? <>Stopping…</>
    : open.length === 1 ? <>Last reel: lock it in</>
    : <>Frozen! Lock <b className="hunt-stop-word">one</b> and the other {open.length - 1} respin</>;

  const tile = (k: SpinKind) => {
    const isOpen = open.includes(k), idx = open.indexOf(k);
    const lockedId = k === 'COACH' ? run.coach : run.squad[SLOTS.indexOf(k as Slot)];
    const cls = ['hunt-reel', k === 'COACH' ? 'coach' : '', !isOpen ? 'locked' : settled(idx) ? 'frozen' : 'spinning', justLocked === k && !isOpen ? 'just-locked' : ''].filter(Boolean).join(' ');
    let body: ReactNode;
    if (!isOpen && lockedId) {
      if (k === 'COACH') { const x = COACH_BY_ID.get(lockedId)!; body = <><span className="hunt-reel-face coach">{initials(x.name)}</span><span className="hunt-reel-text"><b>{x.name}</b><small>{COACH_STYLE[x.style]}</small></span><span className={`hunt-reel-ovr rarity-${coachRarity(x)}`}>{x.bonus > 0 ? '+' : ''}{x.bonus}</span></>; }
      else { const c = pool.byId.get(lockedId)!; body = <><PlayerAvatar playerId={c.name} primaryColor={posColor[c.pos] ?? '#f47b20'} secondaryColor="#f4f0e6" size={56} /><span className="hunt-reel-text"><b>{c.name}</b><small>{seasonLabel(c.end)} · {c.team}</small></span><span className={`hunt-reel-ovr rarity-${c.rarity}`}>{c.ovr}</span></>; }
    } else if (isOpen && settled(idx) && run.reels?.[k]) {
      const id = run.reels[k]!;
      if (k === 'COACH') { const x = COACH_BY_ID.get(id)!; body = <><span className="hunt-reel-face coach">{initials(x.name)}</span><span className="hunt-reel-text"><b>{x.name}</b><small>{x.franchises.slice(0, 2).join(' · ')}</small></span></>; }
      else { const c = pool.byId.get(id)!; const notes = cardNotes(h, c); body = <><PlayerAvatar playerId={c.name} primaryColor={posColor[c.pos] ?? '#f47b20'} secondaryColor="#f4f0e6" size={56} /><span className="hunt-reel-text"><b>{c.name}</b><small>{seasonLabel(c.end)} · {c.team}</small>{notes.length > 0 && <i>{notes.slice(0, 2).join(' · ')}</i>}</span></>; }
    } else {
      const f = faces[k][(tick + idx * 7) % faces[k].length];
      body = k === 'COACH' ? <><span className="hunt-reel-face coach">{initials(f.name)}</span><span className="hunt-reel-text"><b>{f.name}</b><small>{f.sub}</small></span></>
        : <><PlayerAvatar playerId={f.name} primaryColor="#3a3f4a" secondaryColor="#f4f0e6" size={56} /><span className="hunt-reel-text"><b>{f.name}</b><small>{f.sub}</small></span></>;
    }
    const label = <span className="hunt-reel-pos">{REEL_LABEL[k]}{!isOpen && <em>LOCKED</em>}</span>;
    return isOpen && allSettled
      ? <button key={k} className={cls} onClick={() => lock(k)} aria-label={`Lock ${REEL_LABEL[k]}`}>{label}{body}</button>
      : <div key={k} className={cls} aria-hidden={isOpen && !settled(idx) ? true : undefined}>{label}{body}</div>;
  };

  return <section className="hunt-stage hunt-slots">
    <div className="hunt-slots-head">
      <span className="pixel-eyebrow">ROUND {Math.min(run.spin + 1, SPINS.length)} OF {SPINS.length}</span>
      <ol className="hunt-slot-dots" aria-label={`${SPINS.length - open.length} of ${SPINS.length} locked`}>{SPINS.map((_, i) => <li key={i} className={i < SPINS.length - open.length ? 'on' : ''} />)}</ol>
    </div>
    <p className="hunt-slots-msg" role="status">{message}</p>
    <div className="hunt-reel-grid">{SLOTS.map(s => tile(s))}</div>
    {tile('COACH')}
    {!frozen ? <button className="hunt-stop" onClick={stop} autoFocus><span aria-hidden="true">■</span> STOP</button>
      : <p className={`hunt-lock-hint ${allSettled ? 'ready' : ''}`}><PixelIcon name="lock" size={14} /> PICK ONE TO LOCK</p>}
    <p className="hint-text hunt-slots-odds">Ratings are hidden until you lock. Odds this round: Star {pct(w.legendary / total * 100)} · Great {pct(w.epic / total * 100)} · Good {pct(w.rare / total * 100)}; every round is a little poorer. {guaranteed && <b className="hunt-guarantee">{guaranteed}</b>}</p>
    <button className="link-button" onClick={onAbandon}>Abandon this hunt</button>
  </section>;
}

const GRADE_WORD: Record<string, string> = { 'A+': 'Perfect read', A: 'Sharp eye', B: 'Solid scouting', C: 'Some misses', D: 'Rough draft', F: 'Blind as a bat' };

function FocusView({ run, onChoose }: { run: HuntRun; onChoose: (f: Focus) => void }) {
  const grade = draftGrade(run);
  return <section className="hunt-stage">
    {grade && <div className={`hunt-grade g-${grade.grade.replace('+', 'plus')}`}><span className="pixel-eyebrow">DRAFT GRADE</span><b>{grade.grade}</b><span>{GRADE_WORD[grade.grade]} · locked the best player on the reels {grade.bestPicks} of {grade.spins} times{grade.missed ? ` · ${grade.missed} points left on the table` : ''}</span></div>}
    <div><span className="pixel-eyebrow">TRAINING CAMP</span><h2>What does the team work on?</h2></div>
    <p className="hint-text">It grows with every series you win. <b>Choose carefully: the focus is set for the whole hunt and can't be changed.</b></p>
    <div className="hunt-roads">{FOCUS_IDS.map(f => <button key={f} className={`hunt-road ${run.focus === f ? 'on' : ''}`} onClick={() => onChoose(f)}><b>{FOCUS[f].name}</b><span>{FOCUS[f].blurb}</span></button>)}</div>
  </section>;
}

function Bonds({ bonds }: { bonds: ChemistryBond[] }) {
  if (!bonds.length) return <p className="hint-text">No chemistry yet: real teammates, the same franchise, three players from the series' era, or famous rivals all play better together.</p>;
  return <ul className="hunt-bonds">{bonds.map(b => <li key={b.label} className={b.bonus < 0 ? 'down' : ''}><b>{b.bonus > 0 ? '+' : ''}{b.bonus}</b> {b.label} <small>({b.cards.length})</small></li>)}</ul>;
}

const kindLabel = (s: HuntSeries, i: number) => (s.kind === 'boss' ? 'BOSS' : s.kind === 'semi' ? 'SEMI-BOSS' : `SERIES ${i + 1}`);

const SERIES_MS = 10_000;
const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
/** How far into a game the scoreboard is (0-1) for each side: two different curves, so the lead changes hands. */
const curve = (frac: number, k: number) => Math.min(1, Math.max(0, frac ** k));

function SeriesView({ h, run, play, series, index, onReveal, onContinue }: { h: NbaHistory; run: HuntRun; play: SeriesPlay; series: HuntSeries; index: number; onReveal: () => void; onContinue: () => void }) {
  const [t, setT] = useState(() => (reducedMotion() ? SERIES_MS : 0));
  useEffect(() => {
    if (reducedMotion()) return;
    let raf = 0;
    const start = performance.now();
    // Never runs backwards: "Skip to the end" jumps t to the end and the clock only catches up.
    const tick = (now: number) => { const e = now - start; setT(prev => Math.max(prev, Math.min(SERIES_MS, e))); if (e < SERIES_MS) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const n = play.games.length, per = SERIES_MS / n, done = t >= SERIES_MS;
  useEffect(() => { if (done) onReveal(); }, [done, onReveal]);
  const gi = Math.min(n - 1, Math.floor(t / per));
  const frac = done ? 1 : Math.min(1, (t - gi * per) / (per * 0.82));
  const g = play.games[gi];
  const ku = 0.8 + ((gi * 37 + index * 11) % 7) / 10, kt = 0.8 + ((gi * 53 + index * 5 + 3) % 7) / 10;
  const cu = curve(frac, ku), ct = curve(frac, kt);
  const us = Math.round(g.us * cu), them = Math.round(g.them * ct);
  const finished = play.games.slice(0, gi + (frac >= 1 ? 1 : 0));
  const ourWins = finished.filter(x => x.won).length, theirWins = finished.length - ourWins;
  const team = huntTeams(h).find(x => x.id === series.teamId)!;
  const quarter = frac >= 1 ? 'FINAL' : `Q${Math.min(4, Math.floor((cu + ct) / 2 * 4) + 1)}`;
  return <section className="hunt-stage hunt-series">
    <div className="hunt-series-head"><span className="pixel-eyebrow">{kindLabel(series, index)} · {play.era.label.toUpperCase()} RULES</span><h2>Your squad vs {teamLabel(team)}</h2></div>
    <div className="hunt-series-count" aria-live="polite"><div><small>YOU</small><b>{ourWins}</b></div><span>–</span><div><small>THEM</small><b>{theirWins}</b></div></div>
    <div className={`hunt-scoreboard ${frac >= 1 ? (g.won ? 'won' : 'lost') : ''}`}>
      <span className="pixel-eyebrow">GAME {gi + 1} · {quarter}</span>
      <strong className="hunt-score">{us} — {them}</strong>
      <div className="hunt-cap-bar" aria-hidden="true"><i style={{ width: `${Math.round(frac * 100)}%` }} /></div>
    </div>
    {/* Always seven tiles, so the length of the series is not given away. */}
    <ol className="hunt-games">{Array.from({ length: 7 }, (_, i) => { const x = play.games[i]; const shownGame = x && i < finished.length;
      return <li key={i} className={shownGame ? (x.won ? 'won' : 'lost') : done ? 'unneeded' : 'pending'}>
        <small>G{i + 1}</small>{shownGame ? <><b>{x.won ? 'W' : 'L'} {x.us}-{x.them}</b><span>{x.top}</span></> : <b>{done ? '—' : '…'}</b>}</li>; })}</ol>
    {done ? <div className={`hunt-result ${play.won ? 'won' : 'lost'}`}>
      <h2>{play.won ? `Series won ${WINS_NEEDED}-${n - WINS_NEEDED}` : `Series lost ${n - WINS_NEEDED}-${WINS_NEEDED}`}</h2>
      <p>{play.mvp ? `Series MVP: ${play.mvp.name}, ${(play.mvp.pts / play.mvp.g).toFixed(1)} PTS · ${(play.mvp.reb / play.mvp.g).toFixed(1)} REB · ${(play.mvp.ast / play.mvp.g).toFixed(1)} AST` : ''}</p>
      <p><span className="hunt-coins">+{play.coins} coins</span></p>
      <p className="hint-text">{run.stage === 'won' ? 'You beat the boss. The hunt is yours.' : run.stage === 'lost' ? 'Out of lives. The hunt ends here.' : run.stage === 'boost' ? 'Pick a boost for the road.' : run.note ?? `${run.lives} ${run.lives === 1 ? 'life' : 'lives'} left. Change your squad in the next shop, or run it back.`}</p>
      <div className="contest-actions"><button className="primary" onClick={onContinue}>Continue</button></div>
    </div> : <button className="link-button" onClick={() => setT(SERIES_MS)}>Skip to the end</button>}
  </section>;
}

function BoostPick({ h, run, onTake }: { h: NbaHistory; run: HuntRun; onTake: (b: Parameters<typeof takeBoost>[2]) => void }) {
  void h;
  return <section className="hunt-stage">
    <div><span className="pixel-eyebrow">SERIES WON · {run.seriesIndex + 1} OF {SERIES_COUNT} · BOOST {run.boosts.length + 1} OF {MAX_BOOSTS}</span><h2>Pick a boost</h2></div>
    <p className="hint-text">Boosts last the whole hunt, and you only get {MAX_BOOSTS}{run.boosts.length ? ` (${MAX_BOOSTS - run.boosts.length} left, this one included)` : ''}. Together they add up to +{BOOST_CAP} per player in one game.</p>
    <div className="hunt-roads">{(run.boostOffer ?? []).map((b, i) => <button key={b} className="hunt-road hunt-boost hunt-spin-in" style={{ animationDelay: `${i * 140}ms` }} onClick={() => onTake(b)}><b>{BOOSTS[b].name}</b><span>{BOOSTS[b].blurb}</span></button>)}</div>
    <button className="link-button" onClick={() => onTake(null)}>Save the slot for later</button>
  </section>;
}

/** A spot on the mini court for each starter (PG at the top, the bigs low), in % of the court. */
const COURT_SPOT: Record<string, [number, number]> = { PG: [50, 16], SG: [18, 38], SF: [82, 38], PF: [30, 72], C: [70, 72] };

/**
 * The hunt's home base between series: the road on top; your team on a court in the middle with the PLAY button; the
 * shop on the left (players, a coach, shop boosts, a life, training; shut until you win a series); your coach, your
 * boosts and the team's chemistry on the right.
 */
function HuntBase({ h, run, onRun, onPlay, onAbandon }: { h: NbaHistory; run: HuntRun; onRun: (r: HuntRun) => void; onPlay: () => void; onAbandon: () => void }) {
  const pool = cardPool(h);
  const s = run.series[run.seriesIndex];
  const team = huntTeams(h).find(t => t.id === s.teamId)!;
  const era = ERAS.find(e => e.id === s.eraId) ?? eraOf(team.end);
  const ours = squadRating(h, run, s), them = opponentRating(h, run, s);
  const { cards: bonuses, bonds } = gameBonuses(h, run, era, NEUTRAL_GAME, s);
  const coach = run.coach ? COACH_BY_ID.get(run.coach) : undefined;
  const shop = run.stage === 'shop' ? run.shop : undefined;
  const shopCoach = shop?.coach ? COACH_BY_ID.get(shop.coach) : undefined;
  const mine = new Set(run.squad.map(id => pool.byId.get(id)?.playerId));
  const theirs = team.roster.map(id => pool.byId.get(id)!).filter(c => c && !mine.has(c.playerId)).slice(0, SLOTS.length);
  const odds = ours - them;
  return <section className="hunt-base">
    <div className="hunt-base-road"><HuntMap h={h} run={run} /></div>
    {run.note && <p className="hunt-note" role="status">{run.note}</p>}
    <div className="hunt-base-grid">
      {/* ---------------- the shop ---------------- */}
      <aside className={`hunt-shop ${shop ? '' : 'closed'}`} aria-label="Shop">
        <div className="hunt-shop-awning" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} />)}</div>
        <div className="hunt-shop-sign"><span>SHOP</span><small><b className="hunt-coins">{run.coins}</b> coins</small></div>
        {!shop ? <div className="hunt-shop-shut"><PixelIcon name="lock" size={28} /><b>Closed</b><p>The shop opens after every series you win: new players, coaches, shop boosts and training.</p></div> : <>
          <h3 className="hunt-shop-shelf">Players</h3>
          <div className="hunt-shop-items">{shop.cards.map(({ id, slot }) => { const c = pool.byId.get(id)!, sold = shop.sold.includes(id), price = cardPrice(h, id), out = pool.byId.get(run.squad[slot])!;
            return <button key={id} className={`hunt-ware rarity-${c.rarity}`} disabled={sold || run.coins < price} onClick={() => onRun(buyCard(h, run, id))} title={`Replaces ${out.name} (${out.ovr})`}>
              <PlayerAvatar playerId={c.name} primaryColor={posColor[c.pos] ?? '#f47b20'} secondaryColor="#f4f0e6" size={40} mode="portrait" />
              <span className="hunt-ware-name"><b>{c.name}</b><small>{c.ovr} OVR · {slotName(slot)} · for {out.name.split(' ').slice(-1)[0]} ({out.ovr})</small></span>
              <span className="hunt-price">{sold ? 'SOLD' : price}</span></button>; })}</div>
          {shopCoach && <><h3 className="hunt-shop-shelf">Coach</h3>
            <button className="hunt-ware" disabled={shop.sold.includes(shopCoach.id) || run.coins < coachPrice(shopCoach)} onClick={() => onRun(buyCoach(run))}>
              <span className="hunt-ware-coach"><svg viewBox="-22 -50 44 54" aria-hidden="true"><CoachFigure look={coachLook(shopCoach.name, 60)} primary="#f47b20" secondary="#f4f0e6" /></svg></span>
              <span className="hunt-ware-name"><b>{shopCoach.name} ({shopCoach.bonus > 0 ? '+' : ''}{shopCoach.bonus})</b><small>{COACH_STYLE[shopCoach.style]}</small></span>
              <span className="hunt-price">{shop.sold.includes(shopCoach.id) ? 'HIRED' : coachPrice(shopCoach)}</span></button></>}
          <h3 className="hunt-shop-shelf">Boosts <small>{shopItems(run).length}/{MAX_ITEMS}</small></h3>
          <div className="hunt-shop-items">{shop.items.map(i => { const it = ITEMS[i], sold = shop.sold.includes(i); return <button key={i} className="hunt-ware" disabled={sold || run.coins < it.price || shopItems(run).length >= MAX_ITEMS} onClick={() => onRun(buyItem(run, i))}>
            <span className="hunt-ware-icon"><PixelIcon name="star" size={20} /></span><span className="hunt-ware-name"><b>{it.name}</b><small>{it.blurb}</small></span><span className="hunt-price">{sold ? 'SOLD' : it.price}</span></button>; })}
            {canBuyLife(run) && <button className="hunt-ware" disabled={!!shop.lifeBought || run.lives >= maxLives(run) || run.coins < LIFE_PRICE} onClick={() => onRun(buyLife(run))}>
              <span className="hunt-ware-icon life"><PixelIcon name="heart" size={20} /></span><span className="hunt-ware-name"><b>A life</b><small>Get one lost life back.</small></span><span className="hunt-price">{shop.lifeBought ? 'SOLD' : LIFE_PRICE}</span></button>}</div>
          <h3 className="hunt-shop-shelf">Training <small>+{TRAIN_STEP} each, up to +{MAX_TRAINING} · {TRAIN_PRICE} coins</small></h3>
          <div className="hunt-train">{run.squad.map((id, i) => { const c = pool.byId.get(id)!, t = run.training[id] ?? 0; return <button key={id} disabled={t >= MAX_TRAINING || run.coins < TRAIN_PRICE} onClick={() => onRun(train(h, run, id))}>
            <b>{slotName(i).toUpperCase()}</b><span>{c.name.split(' ').slice(-1)[0]}</span><small>{t ? `+${t}` : '+0'}</small></button>; })}</div>
        </>}
      </aside>

      {/* ---------------- your team and PLAY ---------------- */}
      <main className="hunt-center">
        <div className={`hunt-next ${s.kind !== 'normal' ? `hunt-next-${s.kind}` : ''}`}>
          <span className="pixel-eyebrow">{kindLabel(s, run.seriesIndex)} OF {SERIES_COUNT} · BEST OF SEVEN · {era.label.toUpperCase()}</span>
          <h2>{teamLabel(team)}</h2>
          <small>{team.w}-{team.l}{team.champion ? ' · Champions' : ''} · {run.daily ? `Daily Legend ${run.daily}` : run.weekly ? `Weekly Hunt ${run.weekly}` : `${DECKS[run.deck ?? 'classic'].name} · ${DIFFICULTIES[run.difficulty ?? 'pro'].name}`}</small>
        </div>
        <div className="hunt-court" aria-label="Your starting five">
          <i className="hunt-court-key" aria-hidden="true" /><i className="hunt-court-arc" aria-hidden="true" />
          {SLOTS.slice(0, 5).map((slot, i) => { const b = bonuses[i], c = b?.card; if (!c) return null; const [x, y] = COURT_SPOT[slot] ?? [50, 50];
            return <div key={slot} className={`hunt-court-man rarity-${c.rarity}`} style={{ left: `${x}%`, top: `${y}%` }}>
              <PlayerAvatar playerId={c.name} primaryColor="#f47b20" secondaryColor="#f4f0e6" size={46} />
              <span className="hunt-court-tag"><b>{c.ovr}{b.bonus ? <i className={b.bonus > 0 ? 'up' : 'down'}>{b.bonus > 0 ? '+' : ''}{b.bonus}</i> : null}</b>{slot} {c.name.split(' ').slice(-1)[0]}{run.training[c.id] ? ` +${run.training[c.id]}` : ''}</span>
            </div>; })}
        </div>
        <div className="hunt-bench">{(() => { const b = bonuses[5], c = b?.card; return c ? <span><small>6TH MAN</small> <b>{c.ovr}</b> {c.name}</span> : null; })()}</div>
        <div className="hunt-versus-bar"><div><small>YOU</small><b className="hunt-rating">{ours}</b></div>
          <button className="primary hunt-play-big" onClick={onPlay}><PixelIcon name="play" size={22} /> PLAY</button>
          <div><small>THEM</small><b className="hunt-rating">{them}</b></div></div>
        <p className="hint-text hunt-odds">{odds >= 3 ? 'You are the favourite.' : odds <= -3 ? 'You are the underdog: shop and train first.' : 'A close series.'}{run.attempts > 0 ? ` Rematch ${run.attempts + 1}. ${run.lives} ${run.lives === 1 ? 'life' : 'lives'} left.` : ''}</p>
        <details className="hunt-scout"><summary>Scout {teamLabel(team)}</summary>
          <p className="hunt-era-rules">Era rules: {era.blurb}</p>
          {s.buffs.length > 0 && <ul className="hunt-buffs">{s.buffs.map(b => <li key={b}><b>{BUFFS[b].name}</b> {BUFFS[b].blurb(buffValue(run, b, s.kind))}</li>)}
            {s.lift > 0 && <li><b>{s.kind === 'boss' ? 'Dynasty Aura' : s.kind === 'semi' ? 'Contender' : 'Hungry'}</b> Everyone +{Number.isInteger(s.lift) ? s.lift : s.lift.toFixed(1)}.</li>}</ul>}
          <ol className="hunt-their">{theirs.map(c => <li key={c.id}><b>{c.ovr}</b> {c.name} <small>{c.pos}</small></li>)}</ol>
        </details>
      </main>

      {/* ---------------- your coach and boosts ---------------- */}
      <aside className="hunt-locker" aria-label="Your coach and boosts">
        <h3>Your coach</h3>
        {coach ? <div className={`hunt-coach-card rarity-${coachRarity(coach)}`}>
          <span className="hunt-coach-art"><svg viewBox="-22 -50 44 54" aria-hidden="true"><CoachFigure look={coachLook(coach.name, 60)} primary="#f47b20" secondary="#f4f0e6" pose="cross" /></svg></span>
          <div><b>{coach.name}</b><span className="hunt-coach-bonus">{coachBonus(run) > 0 ? '+' : ''}{coachBonus(run)}</span><small>{COACH_STYLE[coach.style]}</small></div>
        </div> : <p className="hint-text">No coach yet.</p>}
        <h3>Boosts <small>{run.boosts.length}/{MAX_BOOSTS}</small></h3>
        {run.boosts.length ? <ul className="hunt-chips">{run.boosts.map(b => <li key={b} title={BOOSTS[b].blurb}><PixelIcon name="flame" size={14} /><b>{BOOSTS[b].name}</b><small>{BOOSTS[b].blurb}</small></li>)}</ul> : <p className="hint-text">Win a series to pick one (up to {MAX_BOOSTS}).</p>}
        <h3>Shop boosts <small>{shopItems(run).length}/{MAX_ITEMS}</small></h3>
        {run.items.length ? <ul className="hunt-chips">{run.items.map(i => <li key={i} title={ITEMS[i].blurb}><PixelIcon name="star" size={14} /><b>{ITEMS[i].name}</b><small>{ITEMS[i].blurb}</small></li>)}</ul> : <p className="hint-text">Buy up to {MAX_ITEMS} in the shop.</p>}
        <h3>Chemistry</h3>
        <Bonds bonds={bonds} />
        {run.focus && <p className="hint-text">Team focus: <b>{FOCUS[run.focus].name}</b>.</p>}
      </aside>
    </div>
    <button className="link-button hunt-abandon" onClick={onAbandon}>Abandon this hunt</button>
  </section>;
}

function RunOver({ h, run, records, onNew, onExit }: { h: NbaHistory; run: HuntRun; records: HuntRecords; onNew: () => void; onExit: () => void }) {
  const teams = new Map(huntTeams(h).map((t: HuntTeam) => [t.id, t]));
  const [copied, setCopied] = useState(false);
  const won = run.stage === 'won';
  const lines = Object.entries(run.lines ?? {}).map(([name, l]) => ({ name, ...l, score: l.pts + l.reb * 1.2 + l.ast * 1.5 })).sort((a, b) => b.score - a.score);
  const mvp = lines[0];
  const seriesWon = run.results.filter(r => r.won).length, seriesLost = run.results.length - seriesWon;
  const gamesWon = run.results.reduce((n, r) => n + r.games.filter(g => g.won).length, 0), gamesPlayed = run.results.reduce((n, r) => n + r.games.length, 0);
  const per = (v: number, g: number) => (g ? (v / g).toFixed(1) : '0.0');
  const wl = (r: HuntRun['results'][number]) => { const w = r.games.filter(g => g.won).length; return `${w}-${r.games.length - w}`; };
  const share = [
    `League Hunt · ${won ? 'HUNT COMPLETE 🏆' : `reached series ${run.seriesIndex + 1} of ${SERIES_COUNT}`} · series ${seriesWon}-${seriesLost}`,
    ...run.results.map(r => `${r.won ? '✅' : '❌'} ${wl(r)} ${teamLabel(teams.get(r.teamId)!)}`),
    mvp ? `MVP: ${mvp.name} (${per(mvp.pts, mvp.g)} PPG)` : '',
  ].filter(Boolean).join('\n');
  const copy = () => { navigator.clipboard?.writeText(share).then(() => setCopied(true), () => setCopied(false)); };
  return <section className={`hunt-stage hunt-over ${won ? 'won' : 'lost'}`}>
    <div className="hunt-over-banner">
      <span className="pixel-eyebrow">{won ? 'HUNT COMPLETE' : 'HUNT OVER'}</span>
      <h2>{won ? 'You conquered basketball history' : `You reached series ${run.seriesIndex + 1} of ${SERIES_COUNT}`}</h2>
      <div className="hunt-over-stats">
        <div><small>SERIES</small><b>{seriesWon}-{seriesLost}</b></div>
        <div><small>GAMES</small><b>{gamesWon}-{gamesPlayed - gamesWon}</b></div>
        <div><small>BOOSTS</small><b>{run.boosts.length}</b></div>
        {draftGrade(run) && <div><small>DRAFT GRADE</small><b>{draftGrade(run)!.grade}</b></div>}
        <div><small>COINS LEFT</small><b>{run.coins}</b></div>
      </div>
    </div>
    {mvp && <div className="hunt-mvp"><PlayerAvatar playerId={mvp.name} primaryColor="#f47b20" secondaryColor="#f4f0e6" size={72} />
      <div><span className="pixel-eyebrow">HUNT MVP</span><strong>{mvp.name}</strong><span>{per(mvp.pts, mvp.g)} PTS · {per(mvp.reb, mvp.g)} REB · {per(mvp.ast, mvp.g)} AST in {mvp.g} game{mvp.g === 1 ? '' : 's'}</span></div></div>}
    <ol className="hunt-log">{run.results.map((r, i) => { const t = teams.get(r.teamId)!; return <li key={i} className={r.won ? 'won' : 'lost'}>{r.won ? 'W' : 'L'} {wl(r)} vs {teamLabel(t)} <small>· {eraOf(t.end).label}</small></li>; })}</ol>
    {lines.length > 0 && <div className="feature-table-scroll"><table className="db-table hunt-lines"><thead><tr><th className="col-name">Player</th><th>G</th><th>PTS</th><th>REB</th><th>AST</th></tr></thead>
      <tbody>{lines.slice(0, 8).map(l => <tr key={l.name}><td className="col-name">{l.name}</td><td>{l.g}</td><td>{per(l.pts, l.g)}</td><td>{per(l.reb, l.g)}</td><td>{per(l.ast, l.g)}</td></tr>)}</tbody></table></div>}
    <SlotBoard h={h} run={run} />
    <p className="hint-text">Your hunts: {records.runs} · won {records.wins} · furthest series {records.bestStop + 1} of {SERIES_COUNT}{records.bestGrade ? ` · best draft grade ${records.bestGrade}` : ''}</p>
    <div className="contest-actions"><button className="primary" onClick={onNew}>Start a new hunt</button><ShareCardButton fileName="league-hunt.png" text={share} spec={{
      kicker: `League Hunt${run.daily ? ` · Daily Legend ${run.daily}` : run.weekly ? ` · Weekly Hunt ${run.weekly}` : ` · ${DIFFICULTIES[run.difficulty ?? 'pro'].name}`}`,
      title: won ? 'Hunt complete' : `Reached series ${run.seriesIndex + 1} of ${SERIES_COUNT}`,
      subtitle: mvp ? `MVP ${mvp.name}: ${per(mvp.pts, mvp.g)} PTS · ${per(mvp.reb, mvp.g)} REB · ${per(mvp.ast, mvp.g)} AST` : undefined,
      stats: [{ label: 'Series', value: `${seriesWon}-${seriesLost}` }, { label: 'Games', value: `${gamesWon}-${gamesPlayed - gamesWon}` }, draftGrade(run) ? { label: 'Draft grade', value: draftGrade(run)!.grade } : { label: 'Boosts', value: String(run.boosts.length) }],
      lines: run.results.slice(-6).map(r => `${r.won ? 'W' : 'L'} ${wl(r)} vs ${teamLabel(teams.get(r.teamId)!)}`),
      avatar: mvp ? { playerId: mvp.name } : undefined, accent: won ? 'gold' : 'red',
    }} /><button onClick={copy}>{copied ? 'Copied!' : 'Copy as text'}</button><button onClick={onExit}>Main Menu</button></div>
  </section>;
}
