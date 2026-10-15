import { useEffect, useMemo, useState } from 'react';
import type { NbaHistory } from '../../history/nbaHistoryData';
import { noteHolidayFinish } from '../../retention/holiday';
import { ModeIcon } from '../ModeIcon';
import { PixelIcon } from '../PixelIcon';
import { PlayerAvatar } from '../PlayerAvatar';
import { track } from '../../analytics/track';
import { noteWeekRun } from '../../retention/weekLog';
import { todayUtc } from '../../hunt/storage';
import { burst } from '../../fx/effects';
import { categorizePuzzle, dailyCategorize, checkPick, CATEGORIZE_MISTAKES, type CategorizeLevel, type CategorizePuzzle } from '../../arcade/categorize';
import { readArcade, updateArcade, endlessOf, ARCADE_EVENT } from '../../arcade/storage';
import { relicRunOpts } from '../../relics/apply';
import { uncoverSecret, categorizeSecret } from '../../relics/rewards';
import './categorize.css';

const SITE = 'https://courtvisiongame.com';
type Mode = 'daily' | 'endless';
const LEVELS: { id: CategorizeLevel; label: string; blurb: string }[] = [
  { id: 'easy', label: 'Easy', blurb: 'Big names; teams, awards, titles and eras.' },
  { id: 'normal', label: 'Normal', blurb: 'Adds the draft, colleges, stats and careers.' },
  { id: 'hard', label: 'Hard', blurb: 'Deep cuts: jerseys, teammates, names, the world.' },
];
/** Each solved row gets a colour in solving order, and a word so colour is never the only sign. */
const ROW_TONES = ['gold', 'green', 'blue', 'purple'] as const;
const DAY_KEY = 'cv-categorize-day';

interface Progress { solved: string[]; mistakes: number; tried: string[] }
const fresh = (): Progress => ({ solved: [], mistakes: 0, tried: [] });
function readDay(day: string): Progress {
  try {
    const d = JSON.parse(localStorage.getItem(DAY_KEY) ?? 'null') as (Progress & { day: string }) | null;
    if (d?.day === day && Array.isArray(d.solved) && Array.isArray(d.tried)) return { solved: d.solved, mistakes: Math.min(CATEGORIZE_MISTAKES, Number(d.mistakes) || 0), tried: d.tried };
  } catch { /* storage blocked: start fresh */ }
  return fresh();
}
const writeDay = (day: string, p: Progress) => { try { localStorage.setItem(DAY_KEY, JSON.stringify({ day, ...p })); } catch { /* this visit only */ } };

async function share(text: string) {
  try { if (navigator.share) { await navigator.share({ text }); return; } } catch { /* cancelled: copy instead */ }
  try { await navigator.clipboard.writeText(text); } catch { /* nothing to do */ }
}

/** Categorize: sixteen players, four hidden categories. A daily board for everyone, then endless boards. */
export function CategorizeGame({ h }: { h: NbaHistory }) {
  const [mode, setMode] = useState<Mode>('daily');
  const [level, setLevel] = useState<CategorizeLevel>('normal');
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 2 ** 31));
  const today = todayUtc();
  const puzzle = useMemo(() => mode === 'daily' ? dailyCategorize(h, today) : categorizePuzzle(h, seed, level), [h, mode, today, seed, level]);
  // Sixth Sense (a secret relic): one more mistake on Endless boards (the daily board stays the same for everyone).
  const [sixthSense] = useState(() => relicRunOpts().sixthSense);
  return <section className="arcade-categorize">
    <div className="arcade-switch" role="radiogroup" aria-label="Categorize mode">
      {(['daily', 'endless'] as Mode[]).map(m => <button key={m} role="radio" aria-checked={mode === m} className={mode === m ? 'selected' : ''} onClick={() => setMode(m)}><ModeIcon mode={`arcade-${m}`} size={28} />{m === 'daily' ? 'Daily board' : 'Endless boards'}</button>)}
    </div>
    {mode === 'endless' && <div className="cat-levels" role="radiogroup" aria-label="Difficulty">
      {LEVELS.map(l => <button key={l.id} role="radio" aria-checked={level === l.id} className={level === l.id ? 'selected' : ''} onClick={() => { setLevel(l.id); setSeed(Math.floor(Math.random() * 2 ** 31)); }}><b>{l.label}</b><small>{l.blurb}</small></button>)}
    </div>}
    <Board key={mode === 'daily' ? `d-${today}` : `e-${seed}-${level}`} puzzle={puzzle} day={mode === 'daily' ? today : null} maxMistakes={CATEGORIZE_MISTAKES + (mode === 'endless' && sixthSense ? 1 : 0)} onNext={mode === 'endless' ? () => setSeed(Math.floor(Math.random() * 2 ** 31)) : undefined} />
    <p className="hint-text">Pick four players who share something, then press Submit. Every player belongs to exactly one of the four hidden categories. {CATEGORIZE_MISTAKES} mistakes and the board is over. "One away" means three of your four belong together.</p>
  </section>;
}

function Board({ puzzle, day, maxMistakes, onNext }: { puzzle: CategorizePuzzle; day: string | null; maxMistakes: number; onNext?: () => void }) {
  const [progress, setProgress] = useState<Progress>(() => day ? readDay(day) : fresh());
  const [picked, setPicked] = useState<string[]>([]);
  const [order, setOrder] = useState(() => puzzle.tiles.map(t => t.playerId));
  const [note, setNote] = useState<{ text: string; tone: 'bad' | 'close' | 'good' } | null>(null);
  const [shake, setShake] = useState(false);
  const [rec, setRec] = useState(readArcade);
  useEffect(() => { const sync = () => setRec(readArcade()); window.addEventListener(ARCADE_EVENT, sync); return () => window.removeEventListener(ARCADE_EVENT, sync); }, []);
  const names = useMemo(() => new Map(puzzle.tiles.map(t => [t.playerId, t.name])), [puzzle]);
  const won = progress.solved.length === 4, lost = progress.mistakes >= maxMistakes, over = won || lost;
  const solvedSet = new Set(progress.solved.flatMap(id => puzzle.groups.find(g => g.id === id)?.players ?? []));
  const open = order.filter(id => !solvedSet.has(id));
  const stats = endlessOf(rec).categorize;

  const save = (p: Progress) => {
    setProgress(p);
    if (day) writeDay(day, p);
    const nowWon = p.solved.length === 4, nowLost = p.mistakes >= maxMistakes;
    if (nowWon || nowLost) {
      updateArcade(r => { const x = endlessOf(r).categorize, streak = nowWon ? x.streak + 1 : 0; return { ...r, endless: { ...endlessOf(r), categorize: { played: x.played + 1, won: x.won + (nowWon ? 1 : 0), perfect: x.perfect + (nowWon && p.mistakes === 0 ? 1 : 0), streak, best: Math.max(x.best, streak) } } }; });
      noteHolidayFinish(nowWon, `categorize-${day ?? puzzle.seed}`);
      track('mode_finish', { mode: 'categorize', won: nowWon, mistakes: p.mistakes, daily: !!day });
      uncoverSecret(`categorize-perfect:${day ?? puzzle.seed}`, categorizeSecret({ won: nowWon, mistakes: p.mistakes }));
      noteWeekRun('categorize', { score: nowWon ? (maxMistakes - p.mistakes + 1) * 100 : p.solved.length * 50, line: nowWon ? `Solved with ${p.mistakes} mistake${p.mistakes === 1 ? '' : 's'}` : `${p.solved.length}/4 categories` }, `categorize-${day ?? puzzle.seed}`);
    }
  };
  const toggle = (id: string) => {
    if (over) return;
    setNote(null);
    setPicked(cur => cur.includes(id) ? cur.filter(x => x !== id) : cur.length >= 4 ? cur : [...cur, id]);
  };
  const submit = () => {
    if (picked.length !== 4 || over) return;
    const key = [...picked].sort().join('|');
    if (progress.tried.includes(key)) { setNote({ text: 'You already tried those four.', tone: 'bad' }); return; }
    const r = checkPick(puzzle, picked, progress.solved);
    if (r.kind === 'solved') {
      setPicked([]);
      setNote({ text: `${r.group.name}!`, tone: 'good' });
      burst(document.querySelector('.cat-solved:last-of-type') as HTMLElement | null, { colors: ['#ffd166', '#55c878', '#f4f0e6'], count: 26, power: 4 });
      save({ ...progress, solved: [...progress.solved, r.group.id], tried: [...progress.tried, key] });
    } else if (r.kind === 'miss') {
      setShake(true); window.setTimeout(() => setShake(false), 380);
      setNote({ text: r.oneAway ? 'One away…' : 'Not a category.', tone: r.oneAway ? 'close' : 'bad' });
      save({ ...progress, mistakes: progress.mistakes + 1, tried: [...progress.tried, key] });
    }
  };
  const shareText = () => {
    const rows = progress.solved.map(id => ['🟨', '🟩', '🟦', '🟪'][progress.solved.indexOf(id)].repeat(4)).join('\n');
    return `Court Vision Categorize${day ? ` ${day}` : ''}: ${won ? `solved with ${progress.mistakes} mistake${progress.mistakes === 1 ? '' : 's'}` : `${progress.solved.length}/4`} 🏀\n${rows}\n${SITE}`;
  };
  // Solved rows in solving order, then (once the board is over) the ones still hidden.
  const shownGroups = [...progress.solved.map(id => puzzle.groups.find(g => g.id === id)!), ...(over ? puzzle.groups.filter(g => !progress.solved.includes(g.id)) : [])];

  return <div className="cat-board">
    <div className="arcade-hilo-top">
      <span>Mistakes left <b className="cat-lives" aria-label={`${maxMistakes - progress.mistakes} of ${maxMistakes}`}>{Array.from({ length: maxMistakes }, (_, i) => <i key={i} className={i < maxMistakes - progress.mistakes ? 'on' : ''} aria-hidden="true" />)}</b></span>
      <span>Solved <b>{progress.solved.length}</b>/4</span>
      <span>Streak <b>{stats.streak}</b></span>
    </div>
    {shownGroups.map((g, i) => {
      const solvedByYou = progress.solved.includes(g.id);
      return <div key={g.id} className={`cat-solved tone-${solvedByYou ? ROW_TONES[i] : 'missed'}`}>
        <b>{g.name}</b><small>{g.blurb}</small>
        <span>{g.players.map(id => names.get(id)).join(' · ')}</span>
        {!solvedByYou && <em>Missed</em>}
      </div>;
    })}
    {!over && <div className={`cat-grid ${shake ? 'shake' : ''}`} role="group" aria-label="Players">
      {open.map(id => <button key={id} className={`cat-tile ${picked.includes(id) ? 'picked' : ''}`} aria-pressed={picked.includes(id)} onClick={() => toggle(id)}>
        <PlayerAvatar playerId={names.get(id) ?? id} size={40} mode="portrait" />
        <span>{names.get(id)}</span>
      </button>)}
    </div>}
    {note && !over && <p className={`cat-note ${note.tone}`} role="status">{note.text}</p>}
    {!over && <div className="contest-actions">
      <button onClick={() => { setOrder(o => [...o].sort(() => Math.random() - 0.5)); }}><PixelIcon name="shuffle" size={14} /> Shuffle</button>
      <button disabled={!picked.length} onClick={() => setPicked([])}>Deselect all</button>
      <button className="primary" disabled={picked.length !== 4} onClick={submit}>Submit {picked.length}/4</button>
    </div>}
    {over && <div className={`arcade-reveal ${won ? 'won' : 'lost'}`}>
      <span className="pixel-eyebrow">{won ? 'BOARD SOLVED' : 'OUT OF MISTAKES'}</span>
      <h2>{won ? (progress.mistakes === 0 ? 'Perfect board!' : `Solved with ${progress.mistakes} mistake${progress.mistakes === 1 ? '' : 's'}`) : `${progress.solved.length} of 4 categories`}</h2>
      <div className="arcade-stats"><span><b>{stats.won}</b><small>Boards solved</small></span><span><b>{stats.perfect}</b><small>Perfect boards</small></span><span><b>{stats.best}</b><small>Best streak</small></span></div>
      <div className="contest-actions">
        {onNext && <button className="primary arcade-big" onClick={onNext}><PixelIcon name="play" size={16} /> Next board</button>}
        <button onClick={() => void share(shareText())}>Share</button>
      </div>
      {day && <p>A new daily board at midnight UTC. Endless boards are always open.</p>}
    </div>}
  </div>;
}
