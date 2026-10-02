import { useEffect, useMemo, useRef, useState } from 'react';
import type { NbaHistory } from '../../history/nbaHistoryData';
import { PixelIcon } from '../PixelIcon';
import { ClaimRankCard } from '../cloud/ClaimRankCard';
import { track } from '../../analytics/track';
import { todayUtc } from '../../hunt/storage';
import { weekKey } from '../../retention/week';
import { allFacts, heightLabel, type PlayerFacts } from '../../arcade/facts';
import { dailyAnswer, guessable, compare, searchPlayers, shareText, puzzleNumber, isOver, type Cell } from '../../arcade/guess';
import { hiloPool, nextRound, isRight, statDef, mulberry, type HiloRound } from '../../arcade/hilo';
import { bracketField, slotTeams, playSeries, scorePicks, seedOf, teamLabel, ROUND_NAMES, ROUND_SLOTS, roundOf, type Series } from '../../arcade/bracket';
import { readArcade, updateArcade, guessWeeks, guessStreak, guessPoints, GUESS_TRIES, BRACKET_POINTS, BRACKET_MAX, ARCADE_EVENT, type ArcadeRecords, type GuessDay, type BracketResult } from '../../arcade/storage';
import '../hunt/hunt.css';
import '../locker/locker.css';
import './arcade.css';

export type ArcadeTab = 'guess' | 'hilo' | 'bracket';
const TABS: { id: ArcadeTab; label: string; icon: string }[] = [
  { id: 'guess', label: 'Guess the Player', icon: 'search' },
  { id: 'hilo', label: 'Higher or Lower', icon: 'up' },
  { id: 'bracket', label: 'Bracket Challenge', icon: 'trophy' },
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

/** Quick games on real NBA history: the daily Guess the Player, Higher or Lower and the weekly Bracket Challenge. */
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
      : tab === 'guess' ? <GuessGame h={h} /> : tab === 'hilo' ? <HiloGame h={h} /> : <BracketGame h={h} />}
  </div>;
}

// ---------------------------------------------------------------- Guess the Player

const untilMidnight = () => { const now = new Date(), next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1); const m = Math.ceil((next - now.getTime()) / 60000); return `${Math.floor(m / 60)}h ${m % 60}m`; };

function GuessGame({ h }: { h: NbaHistory }) {
  const today = todayUtc(), week = weekKey();
  const answer = useMemo(() => dailyAnswer(h, today), [h, today]);
  const list = useMemo(() => guessable(h), [h]);
  const byIdx = useMemo(() => new Map(allFacts(h).map(f => [f.idx, f])), [h]);
  const rec = useArcade();
  const day: GuessDay = rec.guess[today] ?? { guesses: [], won: false };
  const over = isOver(day);
  const [text, setText] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tried = new Set(day.guesses);
  const matches = searchPlayers(list.filter(f => !tried.has(f.idx)), text);
  const rows: Cell[][] = day.guesses.map(i => compare(byIdx.get(i)!, answer));
  const guess = (f: PlayerFacts) => {
    if (over || tried.has(f.idx)) return;
    const won = f.idx === answer.idx, guesses = [...day.guesses, f.idx];
    updateArcade(r => ({ ...r, guess: { ...r.guess, [today]: { guesses, won } } }));
    if (won || guesses.length >= GUESS_TRIES) track('mode_finish', { mode: 'guess', won, tries: guesses.length });
    setText(''); inputRef.current?.focus();
  };
  const streak = guessStreak(rec, today), weekScore = guessWeeks(rec)[week]?.score ?? 0;
  return <section className="arcade-guess">
    <p className="hunt-lede">Puzzle #{puzzleNumber(today)}: one real NBA player, the same for everyone today. {GUESS_TRIES} guesses. <span className="arcade-legend"><i className="hit" /> right <i className="close" /> close <span aria-hidden="true">▲▼</span> higher or lower</span></p>
    {!over && <div className="arcade-guess-box">
      <input ref={inputRef} className="year-input" value={text} onChange={e => setText(e.target.value)} placeholder={`Guess ${day.guesses.length + 1} of ${GUESS_TRIES}: type a player`} aria-label="Type a player's name"
        onKeyDown={e => { if (e.key === 'Enter' && matches[0]) guess(matches[0]); }} autoComplete="off" />
      {matches.length > 0 && <ul className="arcade-suggest" role="listbox">{matches.map(f => <li key={f.idx}><button role="option" aria-selected="false" onClick={() => guess(f)}><b>{f.name}</b><small>{f.team} · {f.debut}-{String(f.last).slice(2)}</small></button></li>)}</ul>}
    </div>}
    <div className="arcade-grid" role="table" aria-label="Your guesses">
      <div className="arcade-row arcade-head" role="row"><span role="columnheader">Player</span>{['Team', 'Pos', 'Height', 'Debut', 'PPG', 'All-Star'].map(l => <span key={l} role="columnheader">{l}</span>)}</div>
      {Array.from({ length: GUESS_TRIES }, (_, i) => {
        const r = rows[i], f = day.guesses[i] != null ? byIdx.get(day.guesses[i]) : null;
        return <div key={i} className={`arcade-row ${r ? '' : 'empty'}`} role="row">
          <span className="arcade-name" role="cell">{f ? f.name : ''}</span>
          {r ? r.map(c => <span key={c.label} role="cell" className={`arcade-cell ${c.mark}`} aria-label={`${c.label}: ${c.value}, ${c.mark === 'hit' ? 'right' : c.mark === 'close' ? 'close' : 'wrong'}${c.arrow ? `, answer is ${c.arrow === 'up' ? 'higher' : 'lower'}` : ''}`}>{c.value}{c.arrow && <em aria-hidden="true">{c.arrow === 'up' ? '▲' : '▼'}</em>}</span>)
            : Array.from({ length: 6 }, (_, j) => <span key={j} role="cell" className="arcade-cell blank" />)}
        </div>;
      })}
    </div>
    {over && <div className={`arcade-reveal ${day.won ? 'won' : 'lost'}`}>
      <span className="pixel-eyebrow">{day.won ? `GOT IT IN ${day.guesses.length}` : 'OUT OF GUESSES'}</span>
      <h2>{answer.name}</h2>
      <p>{answer.team} · {answer.pos} · {heightLabel(answer.heightIn)} · {answer.debut}-{answer.last}</p>
      <p>{answer.ppg} PPG · {answer.rpg} RPG · {answer.apg} APG · {answer.allStars}× All-Star{answer.rings ? ` · ${answer.rings} ring${answer.rings > 1 ? 's' : ''}` : ''}{answer.hallOfFame ? ' · Hall of Fame' : ''}</p>
      <div className="arcade-stats">
        <span><b>{guessPoints(day)}</b><small>Points today</small></span>
        <span><b>{weekScore.toLocaleString()}</b><small>This week</small></span>
        <span><b>{streak.current}</b><small>Streak</small></span>
        <span><b>{streak.best}</b><small>Best streak</small></span>
      </div>
      <div className="contest-actions">
        <button className="primary" onClick={async () => { const r = await share(shareText(today, day, rows, SITE)); setNote(r === 'copied' ? 'Copied: paste it anywhere.' : r === 'failed' ? 'Could not share from this browser.' : null); }}><PixelIcon name="star" size={14} /> Share result</button>
        <span className="hint-text">Next player in {untilMidnight()}.</span>
      </div>
      {note && <p className="hint-text" role="status">{note}</p>}
      <ClaimRankCard id={`guess:${today}`} board={{ kind: 'weekly', board: 'guess', week }} score={weekScore} scored={`Your Guess the Player week is ${weekScore.toLocaleString()} points`} where="on this week's board" />
    </div>}
    <p className="hint-text">Close means: the same position letter, height within 2 inches, debut within 3 seasons, within 2 points a game, within 1 All-Star game. Every solved day adds 100-600 points to your weekly score (fewer guesses, more points).</p>
  </section>;
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
  const start = () => {
    rand.current = mulberry(Math.floor(Math.random() * 1_000_000_007));
    const a = pool[Math.floor(rand.current() * pool.length)];
    seen.current = new Set([a.idx]);
    setRound(nextRound(pool, a, rand.current, seen.current)); setStreak(0); setReveal(null); setOver(false);
    track('mode_start', { mode: 'hilo' });
  };
  const pick = (higher: boolean) => {
    if (!round || reveal) return;
    const right = isRight(round, byIdx, higher);
    setReveal(right ? 'right' : 'wrong');
    window.setTimeout(() => {
      if (right) {
        const b = byIdx.get(round.b)!; seen.current.add(b.idx);
        setStreak(s => s + 1); setRound(nextRound(pool, b, rand.current, seen.current)); setReveal(null);
      } else {
        setOver(true);
        updateArcade(r => ({ ...r, hilo: { best: Math.max(r.hilo.best, streak), runs: r.hilo.runs + 1, weeks: { ...r.hilo.weeks, [week]: Math.max(r.hilo.weeks[week] ?? 0, streak) } } }));
        track('mode_finish', { mode: 'hilo', streak });
      }
    }, 1100);
  };
  const best = rec.hilo.best, weekBest = rec.hilo.weeks[week] ?? 0;
  if (!round) return <section className="arcade-hilo-intro">
    <p className="hunt-lede">Two real players, one career number. Does the second one have more or less? Keep the streak going: one miss and it is over.</p>
    <div className="arcade-stats"><span><b>{best}</b><small>Best streak</small></span><span><b>{weekBest}</b><small>Best this week</small></span><span><b>{rec.hilo.runs}</b><small>Runs</small></span></div>
    <button className="primary arcade-big" onClick={start}><PixelIcon name="play" size={16} /> Play</button>
    <p className="hint-text">Your best streak of the week goes on the weekly board. Numbers: points, rebounds and assists per game, career points, All-Star selections and championships (well-known players from 1974 on).</p>
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

function BracketGame({ h }: { h: NbaHistory }) {
  const week = weekKey();
  const field = useMemo(() => bracketField(h, week), [h, week]);
  const byId = useMemo(() => new Map(field.map(t => [t.id, t])), [field]);
  const rec = useArcade();
  const saved = rec.bracket[week];
  const [picks, setPicks] = useState<(string | null)[]>(() => saved?.picks?.length === 15 ? saved.picks : Array(15).fill(null));
  const [results, setResults] = useState<BracketResult[]>(saved?.results ?? []);
  const [running, setRunning] = useState(false);
  const locked = !!saved?.locked;
  const played = !!saved?.played;
  const choose = (slot: number, id: string) => {
    if (locked) return;
    const next = [...picks]; next[slot] = id;
    // Later picks that no longer have their team in the matchup are cleared.
    for (let s = slot + 1; s < 15; s++) { const [x, y] = slotTeams(field, next, s); if (next[s] && next[s] !== x && next[s] !== y) next[s] = null; }
    setPicks(next);
  };
  const tipOff = async () => {
    if (picks.some(p => !p) || running) return;
    const locks = picks as string[];
    updateArcade(r => ({ ...r, bracket: { ...r.bracket, [week]: { picks: locks, locked: true, played: false, score: 0 } } }));
    track('mode_start', { mode: 'bracket' });
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
    updateArcade(r => ({ ...r, bracket: { ...r.bracket, [week]: { picks: locks, locked: true, played: true, score, champion: out[14].winner, results: out } } }));
    track('mode_finish', { mode: 'bracket', score });
    setRunning(false);
  };
  const resultBySlot = new Map(results.map(r => [r.slot, r]));
  const showWinners = results.length ? results.map(r => r.winner) : [];
  const score = results.length ? scorePicks(picks, results.map(r => ({ slot: r.slot, high: r.high, low: r.low, winsHigh: r.wh, winsLow: r.wl, winner: r.winner, games: [] }))) : 0;
  const name = (id: string | null) => (id ? teamLabel(byId.get(id)!) : 'TBD');
  const seed = (id: string | null) => (id ? seedOf(field, id) : '');
  return <section className="arcade-bracket">
    <p className="hunt-lede">This week's sixteen: champions and 60-win teams from every era. Pick every series winner, then tip off. Best of seven, the better seed at home under its era's rules. The same games for everyone this week; {BRACKET_POINTS.join(' / ')} points a correct pick by round, {BRACKET_MAX} for a perfect bracket.</p>
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
      <span className="hint-text">{picks.filter(Boolean).length} of 15 picked. Picks lock at tip-off.</span></div>}
    {locked && !played && !running && <div className="contest-actions"><button className="primary arcade-big" onClick={tipOff}><PixelIcon name="play" size={16} /> Play the bracket</button><span className="hint-text">Your picks are locked.</span></div>}
    {running && <p className="hint-text" role="status">Playing series {results.length + 1} of 15…</p>}
    {played && !running && <div className="arcade-reveal won">
      <span className="pixel-eyebrow">CHAMPION</span><h2>{name(saved!.champion ?? null)}</h2>
      <div className="arcade-stats"><span><b>{score}</b><small>Your score (of {BRACKET_MAX})</small></span><span><b>{results.filter(r => picks[r.slot] === r.winner).length}/15</b><small>Right picks</small></span></div>
      <div className="contest-actions"><button className="primary" onClick={() => void share(`My Court Vision Bracket Challenge (${week}): ${score}/${BRACKET_MAX} points 🏀 Champion: ${name(saved!.champion ?? null)}\n${SITE}`)}>Share</button><span className="hint-text">A new bracket every Monday.</span></div>
      <ClaimRankCard id={`bracket:${week}`} board={{ kind: 'weekly', board: 'bracket', week }} score={score} scored={`Your bracket scored ${score}`} where="on this week's board" />
    </div>}
  </section>;
}
