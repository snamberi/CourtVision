import { useEffect, useMemo, useState } from 'react';
import type { NbaHistory } from '../../history/nbaHistoryData';
import { cardPool, seasonLabel, RARITY_LABEL, type HuntCard } from '../../hunt/cards';
import { huntTeams, teamLabel, type HuntTeam } from '../../hunt/teams';
import { ERAS, eraOf } from '../../hunt/eras';
import {
  newRun, spinPick, chooseFocus, playSeries, takeBoost, buyCard, buyCoach, buyItem, buyLife, canBuyLife, train, leaveShop, gameBonuses, squadRating, baseSquadRating, opponentRating, buffValue, coachBonus,
  cardPrice, coachPrice, maxLives, spinWeights, slotName, NEUTRAL_GAME, SPINS, SLOTS, FOCUS, FOCUS_IDS, DECKS, DIFFICULTIES, SERIES_COUNT, WINS_NEEDED, LIFE_PRICE, TRAIN_PRICE, TRAIN_STEP, MAX_TRAINING, BOOST_CAP, MAX_BOOSTS,
  type HuntRun, type HuntSeries, type SeriesPlay, type Focus,
} from '../../hunt/run';
import { ITEMS, MAX_ITEMS } from '../../hunt/items';
import { BOOSTS } from '../../hunt/boosts';
import { BUFFS } from '../../hunt/buffs';
import { COACH_BY_ID, COACH_STYLE, coachRarity, type HuntCoach } from '../../hunt/coaches';
import type { ChemistryBond } from '../../hunt/chemistry';
import { track, trackOnce } from '../../analytics/track';
import { ghostFromRun } from '../../hunt/pvp';
import { publishGhost, saveLocalGhost } from '../../cloud/pvp';
import { loadRun, saveRun, clearRun, loadRecords, recordRun, type HuntRecords } from '../../hunt/storage';
import { PlayerAvatar } from '../PlayerAvatar';
import { PixelIcon } from '../PixelIcon';
import { HuntHub } from './HuntHub';
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
    if (r && r.stage === 'draft' && r.seed !== run?.seed) track('mode_start', { mode: 'hunt', variant: r.daily ? 'daily' : 'run', difficulty: r.difficulty ?? 'pro', deck: r.deck ?? 'classic' });
  };

  // While the scoreboard runs, the header still shows the lives and coins from before the series (no spoilers).
  const shown = play && !play.revealed ? play.before : run;
  const header = <header className="hunt-top">
    <button className="hunt-exit" onClick={onExit}><PixelIcon name="exit" size={16} /> Main Menu</button>
    <div className="hunt-title"><span className="pixel-eyebrow">A RUN THROUGH BASKETBALL HISTORY</span><h1>League Hunt</h1></div>
    {shown && shown.stage !== 'won' && shown.stage !== 'lost' && shown.stage !== 'draft' && <div className="hunt-purse"><span className="hunt-coins" title="Coins">{shown.coins} coins</span>
      {shown.items.map(i => <span key={i} className="hunt-item-chip" title={ITEMS[i].blurb}>{ITEMS[i].name}</span>)}</div>}
    {shown && shown.stage !== 'won' && shown.stage !== 'lost' && <div className="hunt-lives" aria-label={`${shown.lives} lives left`}>{Array.from({ length: maxLives(shown) }, (_, i) => <span key={i} className={i < shown.lives ? 'on' : ''}>♥</span>)}</div>}
  </header>;

  if (error) return <div className="hunt">{header}<p className="empty-state">Could not load the NBA history data: {error}</p></div>;
  if (!h) return <div className="hunt">{header}<p className="empty-state">Loading 80 years of basketball…</p></div>;

  return <div className={`hunt ${play ? `era-${play.play.era.id}` : ''}`}>
    {header}
    {!run ? <HuntHub h={h} records={records} onStart={(seed, opts) => { setPlay(null); setRun(newRun(h, seed, opts)); }} />
      : play ? <SeriesView h={h} run={run} play={play.play} series={play.series} index={play.index} onReveal={() => setPlay(p => (p && !p.revealed ? { ...p, revealed: true } : p))} onContinue={() => setPlay(null)} />
      : run.stage === 'draft' ? <Spins h={h} run={run} onPick={id => setRun(spinPick(h, run, id))} onAbandon={() => setRun(null)} />
      : run.stage === 'focus' ? <FocusView run={run} onChoose={f => setRun(chooseFocus(h, run, f))} />
      : run.stage === 'shop' ? <Shop h={h} run={run} onRun={setRun} />
      : run.stage === 'boost' ? <BoostPick h={h} run={run} onTake={b => setRun(takeBoost(h, run, b))} />
      : run.stage === 'won' || run.stage === 'lost' ? <RunOver h={h} run={run} records={records} onNew={() => { setPlay(null); setRun(newRun(h, Math.floor(Math.random() * 1_000_000_000), { deck: run.deck, difficulty: run.difficulty })); }} onExit={() => { setRun(null); onExit(); }} />
      : <SeriesPreview h={h} run={run} onPlay={() => { const r = playSeries(h, run); if (!r) return; setPlay({ play: r.play, series: run.series[run.seriesIndex], index: run.seriesIndex, before: run, revealed: false }); setRun(r.run); }} onAbandon={() => setRun(null)} />}
  </div>;
}

const posColor: Record<string, string> = { PG: '#4da3ff', SG: '#55c878', SF: '#ffd166', PF: '#f47b20', C: '#e85d5d', G: '#4da3ff', F: '#f47b20' };
const pct = (v: number) => `${Math.round(v)}%`;

function Card({ card, onClick, disabled, action, note, delay }: { card: HuntCard; onClick?: () => void; disabled?: boolean; action?: string; note?: string; delay?: number }) {
  const body = <>
    <span className="hunt-card-top"><small>{RARITY_LABEL[card.rarity].toUpperCase()}</small><b>{card.pos}</b></span>
    <PlayerAvatar playerId={card.name} primaryColor={posColor[card.pos] ?? '#f47b20'} secondaryColor="#f4f0e6" size={64} />
    <strong className="hunt-card-name">{card.name}</strong>
    <span className="hunt-card-season">{seasonLabel(card.end)} · {card.teamName}</span>
    <span className="hunt-card-ovr"><b>{card.ovr}</b><small>OVR</small></span>
    <span className="hunt-card-line">{card.ppg} PTS · {card.rpg} REB · {card.apg} AST</span>
    {action && <span className="hunt-card-action">{action}</span>}
    {note && <span className="hunt-card-note">{note}</span>}
  </>;
  const style = delay != null ? { animationDelay: `${delay}ms` } : undefined;
  return onClick ? <button className={`hunt-card hunt-spin-in rarity-${card.rarity}`} style={style} disabled={disabled} onClick={onClick}>{body}</button> : <div className={`hunt-card rarity-${card.rarity}`}>{body}</div>;
}

function CoachCard({ coach, onClick, action, disabled, delay }: { coach: HuntCoach; onClick?: () => void; action?: string; disabled?: boolean; delay?: number }) {
  const r = coachRarity(coach);
  const body = <>
    <span className="hunt-card-top"><small>{RARITY_LABEL[r].toUpperCase()} COACH</small><b>{coach.franchises.slice(0, 2).join(' · ')}</b></span>
    <span className="hunt-coach-badge" aria-hidden="true">{coach.name.split(' ').map(w => w[0]).filter(ch => /[A-Z]/.test(ch)).slice(0, 2).join('')}</span>
    <strong className="hunt-card-name">{coach.name}</strong>
    <span className="hunt-card-season">{coach.blurb}</span>
    <span className="hunt-card-ovr"><b className={coach.bonus < 0 ? 'down' : ''}>{coach.bonus > 0 ? '+' : ''}{coach.bonus}</b><small>TO EVERYONE</small></span>
    <span className="hunt-card-line">{COACH_STYLE[coach.style]}</span>
    {action && <span className="hunt-card-action">{action}</span>}
  </>;
  const style = delay != null ? { animationDelay: `${delay}ms` } : undefined;
  return onClick ? <button className={`hunt-card hunt-spin-in rarity-${r}`} style={style} disabled={disabled} onClick={onClick}>{body}</button> : <div className={`hunt-card rarity-${r}`}>{body}</div>;
}

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

function Spins({ h, run, onPick, onAbandon }: { h: NbaHistory; run: HuntRun; onPick: (id: string) => void; onAbandon: () => void }) {
  const kind = SPINS[run.spin];
  const w = spinWeights(run.spin), total = w.common + w.rare + w.epic + w.legendary;
  const pool = cardPool(h);
  const guaranteed = run.spin === run.guarantees.star ? 'A Star is guaranteed on this spin.' : run.spin === run.guarantees.great ? 'A Great player is guaranteed on this spin.' : null;
  const title = kind === 'COACH' ? 'Spin for your coach' : kind === '6TH' ? 'Spin for your sixth man (any position)' : `Spin for your ${kind}`;
  return <section className="hunt-stage">
    <div className="hunt-stage-head"><div><span className="pixel-eyebrow">SPIN {run.spin + 1} OF {SPINS.length} · {kind === '6TH' ? 'SIXTH MAN' : kind}</span><h2>{title}</h2></div>
      <ol className="hunt-spin-track" aria-label="Spins">{SPINS.map((s, i) => <li key={s} className={i < run.spin ? 'done' : i === run.spin ? 'current' : ''}>{s === '6TH' ? '6TH' : s === 'COACH' ? 'HC' : s}</li>)}</ol></div>
    <p className="hint-text">Odds on this spin: Star {pct(w.legendary / total * 100)} · Great {pct(w.epic / total * 100)} · Good {pct(w.rare / total * 100)}. Every spin is a little poorer than the last. {guaranteed && <b className="hunt-guarantee">{guaranteed}</b>}</p>
    <div className="hunt-offer" key={run.spin}>{kind === 'COACH'
      ? run.offer.map((id, i) => <CoachCard key={id} coach={COACH_BY_ID.get(id)!} delay={i * 140} onClick={() => onPick(id)} action="Hire" />)
      : run.offer.map((id, i) => <Card key={id} card={pool.byId.get(id)!} delay={i * 140} onClick={() => onPick(id)} action="Keep" />)}</div>
    <SlotBoard h={h} run={run} />
    <button className="link-button" onClick={onAbandon}>Abandon this hunt</button>
  </section>;
}

function FocusView({ run, onChoose }: { run: HuntRun; onChoose: (f: Focus) => void }) {
  return <section className="hunt-stage">
    <div><span className="pixel-eyebrow">TRAINING CAMP</span><h2>What does the team work on?</h2></div>
    <p className="hint-text">It grows with every series you win. You can change it in any shop (what has been built stays).</p>
    <div className="hunt-roads">{FOCUS_IDS.map(f => <button key={f} className={`hunt-road ${run.focus === f ? 'on' : ''}`} onClick={() => onChoose(f)}><b>{FOCUS[f].name}</b><span>{FOCUS[f].blurb}</span></button>)}</div>
  </section>;
}

function Bonds({ bonds }: { bonds: ChemistryBond[] }) {
  if (!bonds.length) return <p className="hint-text">No chemistry yet: real teammates, the same franchise, three players from the series' era, or famous rivals all play better together.</p>;
  return <ul className="hunt-bonds">{bonds.map(b => <li key={b.label} className={b.bonus < 0 ? 'down' : ''}><b>{b.bonus > 0 ? '+' : ''}{b.bonus}</b> {b.label} <small>({b.cards.length})</small></li>)}</ul>;
}

const kindLabel = (s: HuntSeries, i: number) => (s.kind === 'boss' ? 'BOSS' : s.kind === 'semi' ? 'SEMI-BOSS' : `SERIES ${i + 1}`);

function SeriesTrail({ h, run }: { h: NbaHistory; run: HuntRun }) {
  const teams = useMemo(() => new Map(huntTeams(h).map(t => [t.id, t])), [h]);
  return <ol className="hunt-trail hunt-trail-10">{run.series.map((s, i) => { const t = teams.get(s.teamId)!; const res = run.results.filter(r => r.index === i).at(-1);
    const seen = i <= run.seriesIndex || s.kind !== 'normal' || run.items.includes('scout');
    const w = res ? res.games.filter(g => g.won).length : 0;
    return <li key={s.teamId} className={`${i === run.seriesIndex ? 'current' : ''} ${i < run.seriesIndex ? 'done' : ''} ${s.kind}`}>
      <small>{kindLabel(s, i)}{i % 2 === 0 ? ' · SHOP' : ''}</small><b>{seen ? `'${String(t.end).slice(2)} ${t.name}` : '???'}</b>
      <span>{res ? `${res.won ? 'W' : 'L'} ${w}-${res.games.length - w}` : seen ? `Rating ${opponentRating(h, run, s)}` : ''}</span>
    </li>; })}</ol>;
}

function SeriesPreview({ h, run, onPlay, onAbandon }: { h: NbaHistory; run: HuntRun; onPlay: () => void; onAbandon: () => void }) {
  const s = run.series[run.seriesIndex];
  const team = huntTeams(h).find(t => t.id === s.teamId)!;
  const era = ERAS.find(e => e.id === s.eraId) ?? eraOf(team.end);
  const pool = cardPool(h);
  const mine = new Set(run.squad.map(id => pool.byId.get(id)?.playerId));
  const theirs = team.roster.map(id => pool.byId.get(id)!).filter(c => c && !mine.has(c.playerId)).slice(0, SLOTS.length);
  const ours = squadRating(h, run, s), them = opponentRating(h, run, s);
  const { bonds } = gameBonuses(h, run, era, NEUTRAL_GAME, s);
  return <section className="hunt-stage">
    <SeriesTrail h={h} run={run} />
    {run.note && <p className="hunt-note" role="status">{run.note}</p>}
    <div className="hunt-matchup">
      <div className={`hunt-era ${s.kind !== 'normal' ? `hunt-era-${s.kind}` : ''}`}>
        <span className="pixel-eyebrow">{kindLabel(s, run.seriesIndex)} OF {SERIES_COUNT} · BEST OF SEVEN · {era.label.toUpperCase()}</span>
        <small className="hunt-mode">{run.daily ? `Daily Legend ${run.daily}` : `${DECKS[run.deck ?? 'classic'].name} deck · ${DIFFICULTIES[run.difficulty ?? 'pro'].name}`}</small>
        <h2>{teamLabel(team)}</h2>
        <p>{team.w}-{team.l}{team.champion ? ' · Champions' : ''}</p>
        <div className="hunt-versus"><div><small>YOU</small><b className="hunt-rating">{ours}</b></div><span>vs</span><div><small>THEM</small><b className="hunt-rating">{them}</b></div></div>
        <p className="hunt-era-rules">Era rules: {era.blurb}</p>
        {s.buffs.length > 0 && <><h3 className="hunt-subhead">Their buffs</h3><ul className="hunt-buffs">{s.buffs.map(b => <li key={b}><b>{BUFFS[b].name}</b> {BUFFS[b].blurb(buffValue(run, b, s.kind))}</li>)}
          {s.lift > 0 && <li><b>{s.kind === 'boss' ? 'Dynasty Aura' : s.kind === 'semi' ? 'Contender' : 'Hungry'}</b> Everyone +{Number.isInteger(s.lift) ? s.lift : s.lift.toFixed(1)}.</li>}</ul></>}
        <button className="primary hunt-play" onClick={onPlay}>Play</button>
        {run.attempts > 0 && <p className="hint-text">Rematch {run.attempts + 1}. {run.lives} {run.lives === 1 ? 'life' : 'lives'} left.</p>}
      </div>
      <div className="hunt-opponent"><h3>Their six</h3><ol>{theirs.map(c => <li key={c.id}><span className="hunt-squad-ovr">{c.ovr}</span><span>{c.name} <small>{c.pos}</small></span></li>)}</ol></div>
    </div>
    <div className="hunt-matchup">
      <SlotBoard h={h} run={run} series={s} />
      <div className="hunt-opponent">
        <h3>Boosts {run.boosts.length}/{MAX_BOOSTS} <small>(up to +{BOOST_CAP} per player per game)</small></h3>
        {run.boosts.length ? <ul className="hunt-buffs">{run.boosts.map(b => <li key={b}><b>{BOOSTS[b].name}</b> {BOOSTS[b].blurb}</li>)}</ul> : <p className="hint-text">Win a series to pick your first boost. You can hold {MAX_BOOSTS}, so choose well.</p>}
        <h3 className="hunt-subhead">Chemistry for this series</h3>
        <Bonds bonds={bonds} />
        {run.focus && <p className="hint-text">Team focus: <b>{FOCUS[run.focus].name}</b>.</p>}
      </div>
    </div>
    <button className="link-button" onClick={onAbandon}>Abandon this hunt</button>
  </section>;
}

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

function Shop({ h, run, onRun }: { h: NbaHistory; run: HuntRun; onRun: (r: HuntRun) => void }) {
  const pool = cardPool(h);
  const shop = run.shop!;
  const coach = shop.coach ? COACH_BY_ID.get(shop.coach) : undefined;
  const next = run.series[run.seriesIndex];
  return <section className="hunt-stage">
    <div className="hunt-stage-head"><div><span className="pixel-eyebrow">THE SHOP · <span className="hunt-coins">{run.coins}</span> COINS · NEXT: {kindLabel(next, run.seriesIndex)}</span><h2>Spend your coins</h2></div>
      <button className="primary" onClick={() => onRun(leaveShop(run))}>On to {next.kind === 'boss' ? 'the boss' : next.kind === 'semi' ? 'the semi-boss' : `series ${run.seriesIndex + 1}`}</button></div>
    {run.note && <p className="hunt-note" role="status">{run.note}</p>}
    <h3 className="hunt-subhead">Players <small>(each one replaces the player in his slot)</small></h3>
    <div className="hunt-offer">{shop.cards.map(({ id, slot }) => { const sold = shop.sold.includes(id), price = cardPrice(h, id), out = pool.byId.get(run.squad[slot])!;
      return <Card key={id} card={pool.byId.get(id)!} disabled={sold || run.coins < price} onClick={() => onRun(buyCard(h, run, id))} action={sold ? 'Signed' : `${price} coins`} note={`New ${slotName(slot)}: replaces ${out.name} (${out.ovr})`} />; })}</div>
    <h3 className="hunt-subhead">{canBuyLife(run) ? 'Coach, items and a life' : 'Coach and items'} <small>{run.items.length}/{MAX_ITEMS} items</small></h3>
    <div className="hunt-items">
      {coach && <button className="hunt-item" disabled={shop.sold.includes(coach.id) || run.coins < coachPrice(coach)} onClick={() => onRun(buyCoach(run))}><b>Coach {coach.name} ({coach.bonus > 0 ? '+' : ''}{coach.bonus})</b><span>{COACH_STYLE[coach.style]}. Replaces {run.coach ? COACH_BY_ID.get(run.coach)!.name : 'your coach'}.</span><small>{shop.sold.includes(coach.id) ? 'Hired' : `${coachPrice(coach)} coins`}</small></button>}
      {shop.items.map(i => { const it = ITEMS[i], sold = shop.sold.includes(i); return <button key={i} className="hunt-item" disabled={sold || run.coins < it.price || run.items.length >= MAX_ITEMS} onClick={() => onRun(buyItem(run, i))}>
        <b>{it.name}</b><span>{it.blurb}</span><small>{sold ? 'Bought' : `${it.price} coins`}</small></button>; })}
      {canBuyLife(run) && <button className="hunt-item" disabled={!!shop.lifeBought || run.lives >= maxLives(run) || run.coins < LIFE_PRICE} onClick={() => onRun(buyLife(run))}><b>♥ A life</b><span>Get back one lost life (once per shop).</span><small>{shop.lifeBought ? 'Bought' : `${LIFE_PRICE} coins`}</small></button>}
    </div>
    <h3 className="hunt-subhead">Training <small>(+{TRAIN_STEP} for one player, up to +{MAX_TRAINING}; {TRAIN_PRICE} coins)</small></h3>
    <div className="hunt-replace">{run.squad.map((id, i) => { const c = pool.byId.get(id)!, t = run.training[id] ?? 0; return <button key={id} disabled={t >= MAX_TRAINING || run.coins < TRAIN_PRICE} onClick={() => onRun(train(h, run, id))}>{slotName(i).toUpperCase()} {c.ovr} {c.name}{t ? <small> (+{t})</small> : null}</button>; })}</div>
    <h3 className="hunt-subhead">Team focus</h3>
    <div className="hunt-replace">{FOCUS_IDS.map(f => <button key={f} aria-pressed={run.focus === f} className={run.focus === f ? 'active' : ''} onClick={() => onRun(chooseFocus(h, run, f))} title={FOCUS[f].blurb}>{FOCUS[f].name}</button>)}</div>
    <SlotBoard h={h} run={run} series={next} />
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
        <div><small>COINS LEFT</small><b>{run.coins}</b></div>
      </div>
    </div>
    {mvp && <div className="hunt-mvp"><PlayerAvatar playerId={mvp.name} primaryColor="#f47b20" secondaryColor="#f4f0e6" size={72} />
      <div><span className="pixel-eyebrow">HUNT MVP</span><strong>{mvp.name}</strong><span>{per(mvp.pts, mvp.g)} PTS · {per(mvp.reb, mvp.g)} REB · {per(mvp.ast, mvp.g)} AST in {mvp.g} game{mvp.g === 1 ? '' : 's'}</span></div></div>}
    <ol className="hunt-log">{run.results.map((r, i) => { const t = teams.get(r.teamId)!; return <li key={i} className={r.won ? 'won' : 'lost'}>{r.won ? 'W' : 'L'} {wl(r)} vs {teamLabel(t)} <small>· {eraOf(t.end).label}</small></li>; })}</ol>
    {lines.length > 0 && <div className="feature-table-scroll"><table className="db-table hunt-lines"><thead><tr><th className="col-name">Player</th><th>G</th><th>PTS</th><th>REB</th><th>AST</th></tr></thead>
      <tbody>{lines.slice(0, 8).map(l => <tr key={l.name}><td className="col-name">{l.name}</td><td>{l.g}</td><td>{per(l.pts, l.g)}</td><td>{per(l.reb, l.g)}</td><td>{per(l.ast, l.g)}</td></tr>)}</tbody></table></div>}
    <SlotBoard h={h} run={run} />
    <p className="hint-text">Your hunts: {records.runs} · won {records.wins} · furthest series {records.bestStop + 1} of {SERIES_COUNT}</p>
    <div className="contest-actions"><button className="primary" onClick={onNew}>Start a new hunt</button><ShareCardButton fileName="league-hunt.png" text={share} spec={{
      kicker: `League Hunt${run.daily ? ` · Daily Legend ${run.daily}` : ` · ${DIFFICULTIES[run.difficulty ?? 'pro'].name}`}`,
      title: won ? 'Hunt complete' : `Reached series ${run.seriesIndex + 1} of ${SERIES_COUNT}`,
      subtitle: mvp ? `MVP ${mvp.name}: ${per(mvp.pts, mvp.g)} PTS · ${per(mvp.reb, mvp.g)} REB · ${per(mvp.ast, mvp.g)} AST` : undefined,
      stats: [{ label: 'Series', value: `${seriesWon}-${seriesLost}` }, { label: 'Games', value: `${gamesWon}-${gamesPlayed - gamesWon}` }, { label: 'Boosts', value: String(run.boosts.length) }],
      lines: run.results.slice(-6).map(r => `${r.won ? 'W' : 'L'} ${wl(r)} vs ${teamLabel(teams.get(r.teamId)!)}`),
      avatar: mvp ? { playerId: mvp.name } : undefined, accent: won ? 'gold' : 'red',
    }} /><button onClick={copy}>{copied ? 'Copied!' : 'Copy as text'}</button><button onClick={onExit}>Main Menu</button></div>
  </section>;
}
