import { useEffect, useMemo, useRef, useState } from 'react';
import type { NbaHistory } from '../../history/nbaHistoryData';
import { PixelIcon } from '../PixelIcon';
import { ClaimRankCard } from '../cloud/ClaimRankCard';
import { track } from '../../analytics/track';
import { noteWeekRun } from '../../retention/weekLog';
import { todayUtc } from '../../hunt/storage';
import { weekKey } from '../../retention/week';
import { allFacts, heightLabel, type PlayerFacts } from '../../arcade/facts';
import { dailyAnswer, guessable, compare, searchPlayers, shareText, puzzleNumber, isOver, randomAnswer, type Cell, type GuessPool } from '../../arcade/guess';
import { quizRound, quizPoints, QUIZ_ERAS, QUIZ_LENGTH, type QuizEra, type QuizQuestion } from '../../arcade/quiz';
import { hiloPool, nextRound, isRight, statDef, mulberry, type HiloRound } from '../../arcade/hilo';
import { bracketField, slotTeams, playSeries, scorePicks, seedOf, teamLabel, ROUND_NAMES, ROUND_SLOTS, roundOf, BRACKET_ERAS, type Series, type BracketEra } from '../../arcade/bracket';
import { readArcade, updateArcade, guessWeeks, guessStreak, guessPoints, endlessOf, GUESS_TRIES, BRACKET_POINTS, BRACKET_MAX, ARCADE_EVENT, type ArcadeRecords, type GuessDay, type BracketResult } from '../../arcade/storage';
import '../hunt/hunt.css';
import '../locker/locker.css';
import './arcade.css';

export type ArcadeTab = 'guess' | 'hilo' | 'bracket' | 'quiz';
const TABS: { id: ArcadeTab; label: string; icon: string }[] = [
  { id: 'guess', label: 'Guess the Player', icon: 'search' },
  { id: 'hilo', label: 'Higher or Lower', icon: 'up' },
  { id: 'bracket', label: 'Bracket Challenge', icon: 'trophy' },
  { id: 'quiz', label: 'NBA Quiz', icon: 'star' },
];
const SITE = 'https://courtvisiongame.com';

function useArcade(): ArcadeRecords {
  const [r, setR] = useState(readArcade);
  useEffect(() => { const sync = () => setR(readArcade()); window.addEventListener(ARCADE_EVENT, sync); return () => window.removeEventListener(ARCADE_EVENT, sync); }, []);
  return r;
}

async function share(text: string): Promise<'shared' | 'copied' | 'failed'> {
  try { if (navigator.share) { await navigator.share({ text }); return 'shared'; } } catch { /* cancelled: fall back to copying */ }
  try { await navigator.clipboard.writeText(text); return 'copied'; } catch { return 'failed'; }
}

/** Quick games on real NBA history: Guess the Player (daily and endless), Higher or Lower, the Bracket Challenge
 *  (weekly and random) and the NBA Quiz. */
export function Arcade({ tab, onTab, onExit }: { tab: ArcadeTab; onTab: (t: ArcadeTab) => void; onExit: () => void }) {
  const [h, setH] = useState<NbaHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    import('../../history/nbaHistoryData').then(m => m.loadNbaHistory()).then(d => { if (live) setH(d); }, e => { if (live) setError(e instanceof Error ? e.message : String(e)); });
    return () => { live = false; };
  }, []);
  return <div className="hunt locker arcade">
    <header className="hunt-top">
      <button className="hunt-exit" onClick={onExit}><PixelIcon name="exit" size={16} /> Main Menu</button>
      <div className="hunt-title"><span className="pixel-eyebrow">QUICK GAMES · REAL NBA HISTORY</span><h1>{TABS.find(t => t.id === tab)!.label}</h1></div>
    </header>
    <nav className="arcade-tabs" role="tablist" aria-label="Quick games">
      {TABS.map(t => <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'selected' : ''} onClick={() => onTab(t.id)}><PixelIcon name={t.icon} size={16} /> {t.label}</button>)}
    </nav>
    {error ? <p className="empty-state">Could not load the NBA history data: {error}</p>
      : !h ? <p className="empty-state">Loading 80 years of basketball…</p>
      : tab === 'guess' ? <GuessGame h={h} onNext={() => onTab('hilo')} /> : tab === 'hilo' ? <HiloGame h={h} /> : tab === 'quiz' ? <QuizGame h={h} /> : <BracketGame h={h} />}
  </div>;
}

// ---------------------------------------------------------------- Guess the Player

const untilMidnight = () => { const now = new Date(), next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1); const m = Math.ceil((next - now.getTime()) / 60000); return `${Math.floor(m / 60)}h ${m % 60}m`; };

/** Daily or endless: a small switch at the top of a game. */
function PlaySwitch<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return <div className="arcade-switch" role="radiogroup" aria-label={label}>
    {options.map(o => <button key={o.id} role="radio" aria-checked={value === o.id} className={value === o.id ? 'selected' : ''} onClick={() => onChange(o.id)}>{o.label}</button>)}
  </div>;
}

/** The guess box and the grid of guesses, shared by the daily puzzle and endless play. */
function GuessBoard({ h, answer, guesses, onGuess, ended }: { h: NbaHistory; answer: PlayerFacts; guesses: number[]; onGuess: (f: PlayerFacts) => void; ended?: boolean }) {
  const list = useMemo(() => guessable(h), [h]);
  const byIdx = useMemo(() => new Map(allFacts(h).map(f => [f.idx, f])), [h]);
  const over = !!ended || guesses.includes(answer.idx) || guesses.length >= GUESS_TRIES;
  const [text, setText] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const tried = new Set(guesses);
  const matches = searchPlayers(list.filter(f => !tried.has(f.idx)), text);
  const rows: Cell[][] = guesses.map(i => compare(byIdx.get(i)!, answer));
  const guess = (f: PlayerFacts) => { if (over || tried.has(f.idx)) return; onGuess(f); setText(''); setActive(0); inputRef.current?.focus(); };
  return <>
    {!over && <div className="arcade-guess-box">
      <input ref={inputRef} className="year-input" value={text} onChange={e => { setText(e.target.value); setActive(0); }} placeholder={`Guess ${guesses.length + 1} of ${GUESS_TRIES}: type a player`} aria-label="Type a player's name"
        aria-activedescendant={matches[active] ? `guess-opt-${matches[active].idx}` : undefined} autoFocus
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(matches.length - 1, i + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(0, i - 1)); }
          else if (e.key === 'Escape') setText('');
          else if (e.key === 'Enter' && matches[active]) guess(matches[active]);
        }} autoComplete="off" />
      {matches.length > 0 && <ul className="arcade-suggest" role="listbox">{matches.map((f, i) => <li key={f.idx}><button id={`guess-opt-${f.idx}`} role="option" aria-selected={i === active} className={i === active ? 'active' : ''} onMouseEnter={() => setActive(i)} onClick={() => guess(f)}><b>{f.name}</b><small>{f.team} · {f.debut}-{String(f.last).slice(2)}</small></button></li>)}</ul>}
    </div>}
    <div className="arcade-grid" role="table" aria-label="Your guesses">
      <div className="arcade-row arcade-head" role="row"><span role="columnheader">Player</span>{['Team', 'Pos', 'Height', 'Debut', 'PPG', 'All-Star'].map(l => <span key={l} role="columnheader">{l}</span>)}</div>
      {Array.from({ length: GUESS_TRIES }, (_, i) => {
        const r = rows[i], f = guesses[i] != null ? byIdx.get(guesses[i]) : null;
        return <div key={i} className={`arcade-row ${r ? '' : 'empty'}`} role="row">
          <span className="arcade-name" role="cell">{f ? f.name : ''}</span>
          {r ? r.map(c => <span key={c.label} role="cell" className={`arcade-cell ${c.mark}`} aria-label={`${c.label}: ${c.value}, ${c.mark === 'hit' ? 'right' : c.mark === 'close' ? 'close' : 'wrong'}${c.arrow ? `, answer is ${c.arrow === 'up' ? 'higher' : 'lower'}` : ''}`}>{c.value}{c.arrow && <em aria-hidden="true">{c.arrow === 'up' ? '▲' : '▼'}</em>}</span>)
            : Array.from({ length: 6 }, (_, j) => <span key={j} role="cell" className="arcade-cell blank" />)}
        </div>;
      })}
    </div>
  </>;
}

function AnswerLine({ answer }: { answer: PlayerFacts }) {
  return <>
    <h2>{answer.name}</h2>
    <p>{answer.team} · {answer.pos} · {heightLabel(answer.heightIn)} · {answer.debut}-{answer.last}</p>
    <p>{answer.ppg.toFixed(1)} PPG · {answer.rpg.toFixed(1)} RPG · {answer.apg.toFixed(1)} APG · {answer.allStars}× All-Star{answer.rings ? ` · ${answer.rings} ring${answer.rings > 1 ? 's' : ''}` : ''}{answer.hallOfFame ? ' · Hall of Fame' : ''}</p>
  </>;
}

const GUESS_MODES = [{ id: 'daily' as const, label: 'Daily puzzle' }, { id: 'endless' as const, label: 'Endless' }];

function GuessGame({ h, onNext }: { h: NbaHistory; onNext: () => void }) {
  const [mode, setMode] = useState<'daily' | 'endless'>('daily');
  return <section className="arcade-guess">
    <PlaySwitch value={mode} options={GUESS_MODES} onChange={setMode} label="Guess the Player mode" />
    {mode === 'daily' ? <DailyGuess h={h} onNext={onNext} onEndless={() => setMode('endless')} /> : <EndlessGuess h={h} />}
    <p className="hint-text">Close means: the same position letter, height within 2 inches, debut within 3 seasons, within 2 points a game, within 1 All-Star game. Every solved daily puzzle adds 100-600 points to your weekly score (fewer guesses, more points); endless rounds are just for fun and your streak.</p>
  </section>;
}

function DailyGuess({ h, onNext, onEndless }: { h: NbaHistory; onNext: () => void; onEndless: () => void }) {
  const today = todayUtc(), week = weekKey();
  const answer = useMemo(() => dailyAnswer(h, today), [h, today]);
  const byIdx = useMemo(() => new Map(allFacts(h).map(f => [f.idx, f])), [h]);
  const rec = useArcade();
  const day: GuessDay = rec.guess[today] ?? { guesses: [], won: false };
  const over = isOver(day);
  const [note, setNote] = useState<string | null>(null);
  const [, setClock] = useState(0);
  // The "next player in" countdown ticks once a minute.
  useEffect(() => { const t = window.setInterval(() => setClock(c => c + 1), 60_000); return () => window.clearInterval(t); }, []);
  const rows: Cell[][] = day.guesses.map(i => compare(byIdx.get(i)!, answer));
  const guess = (f: PlayerFacts) => {
    const won = f.idx === answer.idx, guesses = [...day.guesses, f.idx];
    updateArcade(r => ({ ...r, guess: { ...r.guess, [today]: { guesses, won } } }));
    if (won || guesses.length >= GUESS_TRIES) {
      track('mode_finish', { mode: 'guess', won, tries: guesses.length });
      noteWeekRun('guess', { score: guessPoints({ guesses, won }), line: won ? `solved in ${guesses.length}` : 'missed' }, `guess-${today}`);
    }
  };
  const streak = guessStreak(rec, today), weekScore = guessWeeks(rec)[week]?.score ?? 0;
  return <>
    <p className="hunt-lede">Puzzle #{puzzleNumber(today)}: one real NBA player, the same for everyone today. {GUESS_TRIES} guesses. <span className="arcade-legend"><i className="hit" /> right <i className="close" /> close <span aria-hidden="true">▲▼</span> higher or lower</span></p>
    <GuessBoard h={h} answer={answer} guesses={day.guesses} onGuess={guess} />
    {over && <div className={`arcade-reveal ${day.won ? 'won' : 'lost'}`}>
      <span className="pixel-eyebrow">{day.won ? `GOT IT IN ${day.guesses.length}` : 'OUT OF GUESSES'}</span>
      <AnswerLine answer={answer} />
      <div className="arcade-stats">
        <span><b>{guessPoints(day)}</b><small>Points today</small></span>
        <span><b>{weekScore.toLocaleString()}</b><small>This week</small></span>
        <span><b>{streak.current}</b><small>Streak</small></span>
        <span><b>{streak.best}</b><small>Best streak</small></span>
      </div>
      <div className="contest-actions">
        <button className="primary" onClick={onEndless}><PixelIcon name="play" size={14} /> Keep playing: endless</button>
        <button onClick={async () => { const r = await share(shareText(today, day, rows, SITE)); setNote(r === 'copied' ? 'Copied: paste it anywhere.' : r === 'failed' ? 'Could not share from this browser.' : null); }}><PixelIcon name="star" size={14} /> Share result</button>
        <button onClick={onNext}><PixelIcon name="up" size={14} /> Play Higher or Lower</button>
        <span className="hint-text">Next daily player in {untilMidnight()}.</span>
      </div>
      {note && <p className="hint-text" role="status">{note}</p>}
      <ClaimRankCard id={`guess:${today}`} board={{ kind: 'weekly', board: 'guess', week }} score={weekScore} scored={`Your Guess the Player week is ${weekScore.toLocaleString()} points`} where="on this week's board" />
    </div>}
  </>;
}

const POOLS: { id: GuessPool; label: string }[] = [{ id: 'famous', label: 'Famous players' }, { id: 'deep', label: 'Deep cuts' }];

/** Endless Guess the Player: a new random player every round, as many rounds as you like. */
function EndlessGuess({ h }: { h: NbaHistory }) {
  const rec = useArcade(), e = endlessOf(rec);
  const [pool, setPool] = useState<GuessPool>('famous');
  const recent = useRef(new Set<number>([dailyAnswer(h, todayUtc()).idx]));
  const draw = (p: GuessPool) => { const a = randomAnswer(h, p, Math.random, recent.current); recent.current.add(a.idx); return a; };
  const [answer, setAnswer] = useState(() => draw('famous'));
  const [guesses, setGuesses] = useState<number[]>([]);
  const [gaveUp, setGaveUp] = useState(false);
  const won = guesses.includes(answer.idx), over = won || gaveUp || guesses.length >= GUESS_TRIES;
  const next = (p = pool) => { setAnswer(draw(p)); setGuesses([]); setGaveUp(false); };
  const guess = (f: PlayerFacts) => {
    const g = [...guesses, f.idx], w = f.idx === answer.idx;
    setGuesses(g);
    if (w || g.length >= GUESS_TRIES) {
      updateArcade(r => { const x = endlessOf(r); const streak = w ? x.guess.streak + 1 : 0; return { ...r, endless: { ...x, guess: { played: x.guess.played + 1, won: x.guess.won + (w ? 1 : 0), streak, best: Math.max(x.guess.best, streak) } } }; });
      track('mode_finish', { mode: 'guess-endless', won: w, tries: g.length });
    }
  };
  // Enter on the result starts the next player.
  useEffect(() => {
    if (!over) return;
    const on = (ev: KeyboardEvent) => { if (ev.key === 'Enter' && !(ev.target as HTMLElement)?.closest('button, input')) next(); };
    window.addEventListener('keydown', on); return () => window.removeEventListener('keydown', on);
  });
  return <>
    <div className="arcade-endless-bar">
      <PlaySwitch value={pool} options={POOLS} onChange={p => { setPool(p); next(p); }} label="Which players" />
      <span className="arcade-endless-stats"><span>Streak <b>{e.guess.streak}</b></span><span>Best <b>{e.guess.best}</b></span><span>Solved <b>{e.guess.won}/{e.guess.played}</b></span></span>
    </div>
    <p className="hunt-lede">{pool === 'famous' ? 'A random well-known player every round.' : 'Any NBA All-Star since 1960: harder.'} Same rules as the daily puzzle, no limit on rounds. <span className="arcade-legend"><i className="hit" /> right <i className="close" /> close</span></p>
    <GuessBoard key={answer.idx} h={h} answer={answer} guesses={guesses} onGuess={guess} ended={gaveUp} />
    {!over && <div className="contest-actions"><button onClick={() => { setGaveUp(true); updateArcade(r => { const x = endlessOf(r); return { ...r, endless: { ...x, guess: { ...x.guess, played: x.guess.played + 1, streak: 0 } } }; }); }}>Give up and reveal</button></div>}
    {over && <div className={`arcade-reveal ${won ? 'won' : 'lost'}`}>
      <span className="pixel-eyebrow">{won ? `GOT IT IN ${guesses.length}` : 'THE ANSWER'}</span>
      <AnswerLine answer={answer} />
      <div className="contest-actions"><button className="primary arcade-big" onClick={() => next()}><PixelIcon name="play" size={16} /> Next player</button><span className="hint-text">Enter for the next one.</span></div>
    </div>}
  </>;
}

// ---------------------------------------------------------------- Higher or Lower

function HiloCard({ f, value, label, hidden }: { f: PlayerFacts; value: string; label: string; hidden?: boolean }) {
  return <div className={`arcade-hilo-card ${hidden ? 'hidden' : ''}`}>
    <span className="pixel-eyebrow">{f.team.toUpperCase()}</span>
    <h3>{f.name}</h3>
    <small>{f.pos} · {f.debut}-{f.last}</small>
    <b className="arcade-hilo-value">{hidden ? '?' : value}</b>
    <small>{label}</small>
  </div>;
}

function HiloGame({ h }: { h: NbaHistory }) {
  const pool = useMemo(() => hiloPool(h), [h]);
  const byIdx = useMemo(() => new Map(pool.map(f => [f.idx, f])), [pool]);
  const rec = useArcade();
  const week = weekKey();
  const rand = useRef(mulberry(Date.now() % 1_000_000_007));
  const [round, setRound] = useState<HiloRound | null>(null);
  const [streak, setStreak] = useState(0);
  const [reveal, setReveal] = useState<'right' | 'wrong' | null>(null);
  const [over, setOver] = useState(false);
  const seen = useRef(new Set<number>());
  const recent = useRef<HiloRound['stat'][]>([]);
  const start = () => {
    rand.current = mulberry(Math.floor(Math.random() * 1_000_000_007));
    const a = pool[Math.floor(rand.current() * pool.length)];
    seen.current = new Set([a.idx]);
    const r = nextRound(pool, a, rand.current, seen.current);
    recent.current = [r.stat];
    setRound(r); setStreak(0); setReveal(null); setOver(false);
    track('mode_start', { mode: 'hilo' });
  };
  const pick = (higher: boolean) => {
    if (!round || reveal) return;
    const right = isRight(round, byIdx, higher);
    setReveal(right ? 'right' : 'wrong');
    window.setTimeout(() => {
      if (right) {
        const b = byIdx.get(round.b)!; seen.current.add(b.idx);
        const next = nextRound(pool, b, rand.current, seen.current, recent.current);
        recent.current = [next.stat, ...recent.current].slice(0, 2);
        setStreak(s => s + 1); setRound(next); setReveal(null);
      } else {
        setOver(true);
        updateArcade(r => ({ ...r, hilo: { best: Math.max(r.hilo.best, streak), runs: r.hilo.runs + 1, weeks: { ...r.hilo.weeks, [week]: Math.max(r.hilo.weeks[week] ?? 0, streak) } } }));
        track('mode_finish', { mode: 'hilo', streak });
        noteWeekRun('hilo', { score: streak, line: `streak of ${streak}` }, `hilo-${Date.now()}`);
      }
    }, 1100);
  };
  // Keys: ↑ higher, ↓ lower, Enter to play (again).
  const keys = useRef<(e: KeyboardEvent) => void>(() => {});
  keys.current = e => {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    if (e.key === 'ArrowUp' && round && !over) { e.preventDefault(); pick(true); }
    else if (e.key === 'ArrowDown' && round && !over) { e.preventDefault(); pick(false); }
    else if (e.key === 'Enter' && (!round || over) && !(e.target as HTMLElement)?.closest('button:not([role="tab"])')) start();
  };
  useEffect(() => { const on = (e: KeyboardEvent) => keys.current(e); window.addEventListener('keydown', on); return () => window.removeEventListener('keydown', on); }, []);
  const best = rec.hilo.best, weekBest = rec.hilo.weeks[week] ?? 0;
  if (!round) return <section className="arcade-hilo-intro">
    <p className="hunt-lede">Two real players, one career number. Does the second one have more or less? Keep the streak going: one miss and it is over.</p>
    <div className="arcade-stats"><span><b>{best}</b><small>Best streak</small></span><span><b>{weekBest}</b><small>Best this week</small></span><span><b>{rec.hilo.runs}</b><small>Runs</small></span></div>
    <button className="primary arcade-big" onClick={start}><PixelIcon name="play" size={16} /> Play</button>
    <p className="hint-text">Your best streak of the week goes on the weekly board. <span className="key-hint">Keys: ↑ higher, ↓ lower, Enter to play. </span>Numbers: points, rebounds and assists per game, career points, All-Star selections and championships (well-known players from 1974 on).</p>
  </section>;
  const a = byIdx.get(round.a)!, b = byIdx.get(round.b)!, stat = statDef(round.stat);
  return <section className="arcade-hilo">
    <div className="arcade-hilo-top"><span>Streak <b>{streak}</b></span><span>Best <b>{Math.max(best, streak)}</b></span></div>
    <p className="arcade-hilo-q">Does <b>{b.name}</b> have more or fewer <b>{stat.label}</b> than {a.name}?</p>
    <div className="arcade-hilo-pair">
      <HiloCard f={a} value={stat.show(a)} label={stat.label} />
      <span className="arcade-vs">VS</span>
      <HiloCard f={b} value={stat.show(b)} label={stat.label} hidden={!reveal && !over} />
    </div>
    {reveal && !over && <p className={`arcade-verdict ${reveal}`} role="status">{reveal === 'right' ? 'Right!' : 'Wrong!'}</p>}
    {!over ? <div className="arcade-hilo-buttons">
      <button className="primary" disabled={!!reveal} onClick={() => pick(true)}><PixelIcon name="up" size={16} /> Higher</button>
      <button className="primary" disabled={!!reveal} onClick={() => pick(false)}><PixelIcon name="down" size={16} /> Lower</button>
    </div> : <div className="arcade-reveal lost">
      <span className="pixel-eyebrow">RUN OVER</span>
      <h2>Streak: {streak}</h2>
      <p>{b.name}: {stat.show(b)} {stat.label}, against {a.name}'s {stat.show(a)}.</p>
      <div className="contest-actions">
        <button className="primary" onClick={start}><PixelIcon name="play" size={14} /> Play again</button>
        <button onClick={() => void share(`I got a streak of ${streak} on Court Vision's Higher or Lower 🏀 Can you beat it?\n${SITE}`)}>Share</button>
      </div>
      <ClaimRankCard id={`hilo:${week}:${Math.max(weekBest, streak)}`} board={{ kind: 'weekly', board: 'hilo', week }} score={Math.max(weekBest, streak)} scored={`Your best streak this week is ${Math.max(weekBest, streak)}`} where="on this week's board" />
    </div>}
  </section>;
}

// ---------------------------------------------------------------- the Bracket Challenge

const tick = () => new Promise(r => window.setTimeout(r, 30));
const BRACKET_MODES = [{ id: 'weekly' as const, label: "This week's bracket" }, { id: 'random' as const, label: 'Random bracket' }];

function BracketGame({ h }: { h: NbaHistory }) {
  const [mode, setMode] = useState<'weekly' | 'random'>('weekly');
  const [era, setEra] = useState<BracketEra>('all');
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const rec = useArcade(), e = endlessOf(rec);
  return <section className="arcade-bracket">
    <PlaySwitch value={mode} options={BRACKET_MODES} onChange={setMode} label="Bracket mode" />
    {mode === 'weekly'
      ? <BracketBoard key="weekly" h={h} keyId={weekKey()} era="all" weekly />
      : <>
        <div className="arcade-endless-bar">
          <PlaySwitch value={era} options={BRACKET_ERAS.map(x => ({ id: x.id, label: x.label }))} onChange={x => { setEra(x); setSeed(Math.floor(Math.random() * 1e9)); }} label="Era" />
          <span className="arcade-endless-stats"><span>Played <b>{e.bracket.played}</b></span><span>Best <b>{e.bracket.best}</b></span></span>
        </div>
        <BracketBoard key={`${era}-${seed}`} h={h} keyId={`random-${seed}`} era={era} onNew={() => setSeed(Math.floor(Math.random() * 1e9))} />
      </>}
  </section>;
}

/** One bracket: this week's (kept, scored on the board) or a random one (as many as you like). */
function BracketBoard({ h, keyId, era, weekly, onNew }: { h: NbaHistory; keyId: string; era: BracketEra; weekly?: boolean; onNew?: () => void }) {
  const week = keyId;
  const field = useMemo(() => bracketField(h, keyId, era), [h, keyId, era]);
  const byId = useMemo(() => new Map(field.map(t => [t.id, t])), [field]);
  const rec = useArcade();
  const saved = weekly ? rec.bracket[week] : undefined;
  const [picks, setPicks] = useState<(string | null)[]>(() => saved?.picks?.length === 15 ? saved.picks.map(p => p || null) : Array(15).fill(null));
  const [results, setResults] = useState<BracketResult[]>(saved?.results ?? []);
  const [running, setRunning] = useState(false);
  const [local, setLocal] = useState<{ locked: boolean; played: boolean; champion?: string }>({ locked: false, played: false });
  const locked = weekly ? !!saved?.locked : local.locked;
  const played = weekly ? !!saved?.played : local.played;
  const champion = weekly ? saved?.champion : local.champion;
  // Weekly picks are kept as you make them (not locked), so leaving the page doesn't lose them.
  const savePicks = (next: (string | null)[]) => {
    setPicks(next);
    if (weekly) updateArcade(r => (r.bracket[week]?.locked ? r : { ...r, bracket: { ...r.bracket, [week]: { picks: next.map(p => p ?? ''), locked: false, played: false, score: 0 } } }));
  };
  const choose = (slot: number, id: string) => {
    if (locked) return;
    const next = [...picks]; next[slot] = id;
    // Later picks that no longer have their team in the matchup are cleared.
    for (let s = slot + 1; s < 15; s++) { const [x, y] = slotTeams(field, next, s); if (next[s] && next[s] !== x && next[s] !== y) next[s] = null; }
    savePicks(next);
  };
  /** Every series to the better seed. */
  const favourites = () => {
    const next: string[] = [];
    for (let s = 0; s < 15; s++) { const [x, y] = slotTeams(field, next, s); next[s] = seedOf(field, x!) < seedOf(field, y!) ? x! : y!; }
    savePicks(next);
  };
  /** A random pick in every series. */
  const coinFlips = () => {
    const next: string[] = [];
    for (let s = 0; s < 15; s++) { const [x, y] = slotTeams(field, next, s); next[s] = Math.random() < 0.5 ? x! : y!; }
    savePicks(next);
  };
  const tipOff = async () => {
    if (picks.some(p => !p) || running) return;
    const locks = picks as string[];
    if (weekly) updateArcade(r => ({ ...r, bracket: { ...r.bracket, [week]: { picks: locks, locked: true, played: false, score: 0 } } }));
    else setLocal({ locked: true, played: false });
    track('mode_start', { mode: weekly ? 'bracket' : 'bracket-random' });
    setRunning(true);
    const winners: string[] = [], out: BracketResult[] = [];
    for (let slot = 0; slot < 15; slot++) {
      const [x, y] = slotTeams(field, winners, slot);
      const tx = byId.get(x!)!, ty = byId.get(y!)!;
      const [high, low] = seedOf(field, tx.id) < seedOf(field, ty.id) ? [tx, ty] : [ty, tx];
      const s: Series = playSeries(h, week, slot, high, low);
      winners[slot] = s.winner;
      out.push({ slot, high: s.high, low: s.low, wh: s.winsHigh, wl: s.winsLow, winner: s.winner });
      setResults([...out]);
      await tick();
    }
    const score = scorePicks(locks, out.map(r => ({ slot: r.slot, high: r.high, low: r.low, winsHigh: r.wh, winsLow: r.wl, winner: r.winner, games: [] })));
    if (weekly) {
      updateArcade(r => ({ ...r, bracket: { ...r.bracket, [week]: { picks: locks, locked: true, played: true, score, champion: out[14].winner, results: out } } }));
      noteWeekRun('bracket', { score, line: `${score}/${BRACKET_MAX}` }, `bracket-${week}`);
    } else {
      setLocal({ locked: true, played: true, champion: out[14].winner });
      updateArcade(r => { const x = endlessOf(r); return { ...r, endless: { ...x, bracket: { played: x.bracket.played + 1, best: Math.max(x.bracket.best, score) } } }; });
    }
    track('mode_finish', { mode: weekly ? 'bracket' : 'bracket-random', score });
    setRunning(false);
  };
  const resultBySlot = new Map(results.map(r => [r.slot, r]));
  const showWinners = results.length ? results.map(r => r.winner) : [];
  const score = results.length ? scorePicks(picks, results.map(r => ({ slot: r.slot, high: r.high, low: r.low, winsHigh: r.wh, winsLow: r.wl, winner: r.winner, games: [] }))) : 0;
  const name = (id: string | null) => (id ? teamLabel(byId.get(id)!) : 'TBD');
  const seed = (id: string | null) => (id ? seedOf(field, id) : '');
  return <>
    <p className="hunt-lede">{weekly
      ? <>This week's sixteen: champions and 60-win teams from every era. Pick every series winner, then tip off. The same games for everyone this week; {BRACKET_POINTS.join(' / ')} points a correct pick by round, {BRACKET_MAX} for a perfect bracket.</>
      : <>A random sixteen{era === 'all' ? ' from every era' : ` from ${BRACKET_ERAS.find(x => x.id === era)!.label}`}. Pick every series, tip off, then roll a new bracket. Not on the weekly board: play as many as you like.</>} Best of seven, the better seed at home under its era's rules.</p>
    <p className="hint-text arcade-bracket-swipe">Swipe the bracket sideways for the quarterfinals, semis and final →</p>
    <div className="arcade-bracket-cols">
      {ROUND_NAMES.map((rn, r) => <div key={rn} className="arcade-bracket-col"><h3 className="hunt-subhead">{rn} <small>{BRACKET_POINTS[r]} pts</small></h3>
        {Array.from({ length: ROUND_SLOTS[r][1] - ROUND_SLOTS[r][0] }, (_, i) => {
          const slot = ROUND_SLOTS[r][0] + i;
          const res = resultBySlot.get(slot);
          const teams = res ? [res.high, res.low] : slotTeams(field, results.length ? showWinners : picks, slot);
          return <div key={slot} className={`arcade-match ${res ? (picks[slot] === res.winner ? 'right' : 'wrong') : ''}`}>
            {teams.map((id, k) => <button key={k} disabled={!id || locked || !!res} className={`arcade-team ${picks[slot] && picks[slot] === id ? 'picked' : ''} ${res?.winner === id ? 'won' : ''}`} onClick={() => id && choose(slot, id)}>
              <i>{seed(id)}</i><span>{name(id)}</span>{res && <b>{id === res.high ? res.wh : res.wl}</b>}
            </button>)}
            {res && <small className="arcade-match-note">{picks[slot] === res.winner ? `✓ +${BRACKET_POINTS[roundOf(slot)]}` : `✗ you picked ${picks[slot] ? name(picks[slot]).replace(/^\S+ /, '') : '—'}`}</small>}
          </div>;
        })}
      </div>)}
    </div>
    {!locked && <div className="contest-actions"><button className="primary arcade-big" disabled={picks.some(p => !p)} onClick={tipOff}><PixelIcon name="play" size={16} /> Lock picks and tip off</button>
      <button onClick={favourites}>Pick all favourites</button>
      <button onClick={coinFlips}>Random picks</button>
      <button disabled={!picks.some(Boolean)} onClick={() => savePicks(Array(15).fill(null))}>Clear picks</button>
      {onNew && <button onClick={onNew}>New teams</button>}
      <span className="hint-text">{picks.filter(Boolean).length} of 15 picked. Picks lock at tip-off.</span></div>}
    {locked && !played && !running && <div className="contest-actions"><button className="primary arcade-big" onClick={tipOff}><PixelIcon name="play" size={16} /> Play the bracket</button><span className="hint-text">Your picks are locked.</span></div>}
    {running && <p className="hint-text" role="status">Playing series {results.length + 1} of 15…</p>}
    {played && !running && <div className="arcade-reveal won">
      <span className="pixel-eyebrow">CHAMPION</span><h2>{name(champion ?? null)}</h2>
      <div className="arcade-stats"><span><b>{score}</b><small>Your score (of {BRACKET_MAX})</small></span><span><b>{results.filter(r => picks[r.slot] === r.winner).length}/15</b><small>Right picks</small></span></div>
      <div className="contest-actions">
        {onNew && <button className="primary arcade-big" onClick={onNew}><PixelIcon name="play" size={16} /> New bracket</button>}
        <button className={onNew ? '' : 'primary'} onClick={() => void share(weekly ? `My Court Vision Bracket Challenge (${week}): ${score}/${BRACKET_MAX} points 🏀 Champion: ${name(champion ?? null)}\n${SITE}` : `I scored ${score}/${BRACKET_MAX} on a Court Vision random bracket 🏀 Champion: ${name(champion ?? null)}\n${SITE}`)}>Share</button>
        {weekly && <span className="hint-text">A new weekly bracket every Monday. Random brackets any time.</span>}
      </div>
      {weekly && <ClaimRankCard id={`bracket:${week}`} board={{ kind: 'weekly', board: 'bracket', week }} score={score} scored={`Your bracket scored ${score}`} where="on this week's board" />}
    </div>}
  </>;
}

// ---------------------------------------------------------------- the NBA Quiz

const LETTERS = ['A', 'B', 'C', 'D'];

function QuizGame({ h }: { h: NbaHistory }) {
  const rec = useArcade(), e = endlessOf(rec).quiz;
  const [era, setEra] = useState<QuizEra>('all');
  const [round, setRound] = useState<QuizQuestion[] | null>(null);
  const [at, setAt] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [points, setPoints] = useState(0);
  const [right, setRight] = useState(0);
  const shownAt = useRef(Date.now());
  const done = !!round && at >= round.length;
  const start = () => {
    setRound(quizRound(h, era, Math.random)); setAt(0); setChosen(null); setPoints(0); setRight(0); shownAt.current = Date.now();
    track('mode_start', { mode: 'quiz', era });
  };
  const answer = (i: number) => {
    if (!round || chosen != null || done) return;
    const q = round[at], ok = i === q.answer;
    setChosen(i);
    setPoints(p => p + quizPoints(ok, Date.now() - shownAt.current));
    if (ok) setRight(r => r + 1);
  };
  const next = () => {
    if (!round || chosen == null) return;
    const n = at + 1;
    setAt(n); setChosen(null); shownAt.current = Date.now();
    if (n >= round.length) {
      updateArcade(r => { const x = endlessOf(r); return { ...r, endless: { ...x, quiz: { played: x.quiz.played + 1, best: Math.max(x.quiz.best, points), right: x.quiz.right + right, answered: x.quiz.answered + round.length } } }; });
      track('mode_finish', { mode: 'quiz', era, score: points, right });
      noteWeekRun('quiz', { score: points, line: `${right}/${round.length} right` }, `quiz-${Date.now()}`);
    }
  };
  // Keys: 1-4 or A-D to answer, Enter for the next question (or a new round).
  const keys = useRef<(ev: KeyboardEvent) => void>(() => {});
  keys.current = ev => {
    if ((ev.target as HTMLElement)?.tagName === 'INPUT') return;
    const k = ev.key.toUpperCase(), i = '1234'.indexOf(k) >= 0 ? '1234'.indexOf(k) : LETTERS.indexOf(k);
    if (round && !done && chosen == null && i >= 0 && i < round[at].options.length) { ev.preventDefault(); answer(i); }
    else if (ev.key === 'Enter' && !(ev.target as HTMLElement)?.closest('button:not([role="tab"]):not([role="radio"])')) { if (round && !done && chosen != null) next(); else if (!round || done) start(); }
  };
  useEffect(() => { const on = (ev: KeyboardEvent) => keys.current(ev); window.addEventListener('keydown', on); return () => window.removeEventListener('keydown', on); }, []);
  const accuracy = e.answered ? Math.round((e.right / e.answered) * 100) : 0;
  if (!round || done) return <section className="arcade-quiz">
    {done && <div className={`arcade-reveal ${right >= QUIZ_LENGTH / 2 ? 'won' : 'lost'}`}>
      <span className="pixel-eyebrow">ROUND OVER</span>
      <h2>{right} of {round!.length} right</h2>
      <div className="arcade-stats"><span><b>{points.toLocaleString()}</b><small>Points</small></span><span><b>{Math.max(e.best, points).toLocaleString()}</b><small>Best round</small></span></div>
      <div className="contest-actions"><button className="primary arcade-big" onClick={start}><PixelIcon name="play" size={16} /> New round</button>
        <button onClick={() => void share(`I got ${right}/${round!.length} (${points} points) on the Court Vision NBA Quiz 🏀 Can you beat it?\n${SITE}`)}>Share</button></div>
    </div>}
    {!done && <p className="hunt-lede">Ten questions from real NBA history: champions, MVPs, Finals MVPs, Rookies of the Year, No. 1 picks, scoring titles and career numbers. A new round every time. 100 points a right answer, up to 50 more for answering fast.</p>}
    <h3 className="hunt-subhead">Era</h3>
    <PlaySwitch value={era} options={QUIZ_ERAS.map(x => ({ id: x.id, label: x.label }))} onChange={setEra} label="Quiz era" />
    <div className="arcade-stats"><span><b>{e.best.toLocaleString()}</b><small>Best round</small></span><span><b>{e.played}</b><small>Rounds</small></span><span><b>{accuracy}%</b><small>Right answers</small></span></div>
    {!done && <button className="primary arcade-big" onClick={start}><PixelIcon name="play" size={16} /> Start the quiz</button>}
    <p className="hint-text key-hint">Keys: 1-4 (or A-D) to answer, Enter for the next question.</p>
  </section>;
  const q = round[at];
  return <section className="arcade-quiz">
    <div className="arcade-hilo-top"><span>Question <b>{at + 1}</b>/{round.length}</span><span>Points <b>{points.toLocaleString()}</b></span><span>Right <b>{right}</b></span></div>
    <div className="arcade-quiz-progress" aria-hidden="true"><i style={{ width: `${(at / round.length) * 100}%` }} /></div>
    <h2 className="arcade-quiz-q">{q.text}</h2>
    <div className="arcade-quiz-options">
      {q.options.map((o, i) => <button key={o} className={`arcade-quiz-option ${chosen == null ? '' : i === q.answer ? 'right' : i === chosen ? 'wrong' : 'faded'}`} disabled={chosen != null} onClick={() => answer(i)}>
        <i>{LETTERS[i]}</i><span>{o}</span>{chosen != null && i === q.answer && <b aria-label="right answer">✓</b>}{chosen === i && i !== q.answer && <b aria-label="your answer, wrong">✗</b>}
      </button>)}
    </div>
    {chosen != null && <div className="arcade-quiz-after" role="status">
      <p><b className={chosen === q.answer ? 'arcade-ok' : 'arcade-no'}>{chosen === q.answer ? 'Right!' : 'Not quite.'}</b> {q.fact}</p>
      <button className="primary" onClick={next} autoFocus>{at + 1 >= round.length ? 'See your score' : 'Next question'}</button>
    </div>}
  </section>;
}
