import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { NbaHistory } from '../../history/nbaHistoryData';
import { PixelIcon } from '../PixelIcon';
import { relicRunOpts } from '../../relics/apply';
import { track } from '../../analytics/track';
import { noteWeekRun } from '../../retention/weekLog';
import { todayUtc } from '../../hunt/storage';
import { readArcade, updateArcade, gridStreak, ARCADE_EVENT } from '../../arcade/storage';
import { dailyGrid, codeGrid, newGridCode, cleanGridCode, isGridCode, gridTheme, emptyPlay, guessesAllowed, isGridDone, guessCell, gridScore, rarity, answers, gridNumber, gridShareText, gridCandidates, searchCandidates, GRID_SIZE, GRID_GUESSES, type Grid, type GridPlay } from '../../arcade/grid';

const SITE = 'https://courtvisiongame.com';
type Mode = 'daily' | 'endless';

async function share(text: string): Promise<'shared' | 'copied' | 'failed'> {
  try { if (navigator.share) { await navigator.share({ text }); return 'shared'; } } catch { /* cancelled: copy instead */ }
  try { await navigator.clipboard.writeText(text); return 'copied'; } catch { return 'failed'; }
}

/** The Daily Grid (one a day, the same for everyone) and endless random grids. */
export function GridGame({ h }: { h: NbaHistory }) {
  const [mode, setMode] = useState<Mode>('daily');
  const [endlessCode, setEndlessCode] = useState(() => newGridCode());
  const [codeInput, setCodeInput] = useState('');
  return <section className="arcade-gridgame">
    <div className="arcade-switch" role="radiogroup" aria-label="Grid mode">
      {(['daily', 'endless'] as Mode[]).map(m => <button key={m} role="radio" aria-checked={mode === m} className={mode === m ? 'selected' : ''} onClick={() => setMode(m)}>{m === 'daily' ? 'Daily Grid' : 'Endless grids'}</button>)}
    </div>
    {mode === 'daily' ? <DailyGrid h={h} /> : <>
      <div className="cv-grid-code"><span>Grid code <b>{endlessCode}</b>: send it to a friend and compare scores.</span>
        <label><input className="year-input" value={codeInput} maxLength={8} placeholder="Friend's code" aria-label="A friend's grid code" onChange={e => setCodeInput(cleanGridCode(e.target.value))} />
          <button disabled={!isGridCode(codeInput)} onClick={() => { setEndlessCode(codeInput); setCodeInput(''); }}>Play it</button></label></div>
      <EndlessGrid key={endlessCode} h={h} code={endlessCode} onNew={() => setEndlessCode(newGridCode())} />
    </>}
    <p className="hint-text">Each square needs a player who played for the team on its row <b>and</b> fits the column at any point in his career (a Laker who won MVP in Houston counts). Each player once. {GRID_GUESSES} guesses, right or wrong. Rarity: how deep a cut your answer is among everyone who fits the square (100 = the deepest).</p>
  </section>;
}

function DailyGrid({ h }: { h: NbaHistory }) {
  const today = todayUtc();
  const grid = useMemo(() => dailyGrid(h, today), [h, today]);
  const [rec, setRec] = useState(readArcade);
  useEffect(() => { const sync = () => setRec(readArcade()); window.addEventListener(ARCADE_EVENT, sync); return () => window.removeEventListener(ARCADE_EVENT, sync); }, []);
  const play: GridPlay = rec.grid?.[today] ?? emptyPlay();
  const onPlay = (next: GridPlay) => {
    updateArcade(r => ({ ...r, grid: { ...(r.grid ?? {}), [today]: next } }));
    if (isGridDone(next) && !isGridDone(play)) {
      const s = gridScore(h, grid, next);
      track('mode_finish', { mode: 'grid', filled: s.filled });
      noteWeekRun('grid', { score: s.score, line: `${s.filled}/9 squares` }, `grid-${today}`);
    }
  };
  const streak = gridStreak(rec, today);
  const theme = gridTheme(today);
  return <>{theme && <p className="cv-grid-theme"><b>{theme.name}</b> {theme.blurb}</p>}<GridBoard h={h} grid={grid} play={play} onPlay={onPlay} title={`Grid #${gridNumber(today)}`} shareDay={today}
    extra={<><span><b>{streak.current}</b><small>Streak</small></span><span><b>{streak.best}</b><small>Best streak</small></span></>} /></>;
}

function EndlessGrid({ h, code, onNew }: { h: NbaHistory; code: string; onNew: () => void }) {
  const grid = useMemo(() => codeGrid(h, code), [h, code]);
  // The Last Look (a secret relic): one more guess on Endless grids.
  const [play, setPlay] = useState<GridPlay>(() => emptyPlay(relicRunOpts().lastLook ? GRID_GUESSES + 1 : undefined));
  return <GridBoard h={h} grid={grid} play={play} onPlay={setPlay} title="Endless grid" shareDay={null} onNew={onNew} />;
}

function GridBoard({ h, grid, play, onPlay, title, shareDay, extra, onNew }: { h: NbaHistory; grid: Grid; play: GridPlay; onPlay: (p: GridPlay) => void; title: string; shareDay: string | null; extra?: ReactNode; onNew?: () => void }) {
  const [active, setActive] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [hi, setHi] = useState(0);
  const [flash, setFlash] = useState<{ i: number; ok: boolean } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [reveal, setReveal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const list = useMemo(() => gridCandidates(h), [h]);
  const names = useMemo(() => new Map(list.map(p => [p.id, p.name])), [list]);
  const done = isGridDone(play);
  const used = new Set(play.cells.filter(Boolean));
  const matches = active == null ? [] : searchCandidates(list, text, used);
  const s = gridScore(h, grid, play);
  useEffect(() => { if (active != null) inputRef.current?.focus(); }, [active]);
  useEffect(() => { if (!flash) return; const t = window.setTimeout(() => setFlash(null), 700); return () => window.clearTimeout(t); }, [flash]);
  const open = (i: number) => { if (done || play.cells[i]) return; setActive(i); setText(''); setHi(0); };
  const guess = (id: string) => {
    if (active == null) return;
    const r = guessCell(grid, play, active, id);
    onPlay(r.play);
    setFlash({ i: active, ok: r.right });
    setActive(null); setText('');
  };
  const rowOf = (i: number) => grid.rows[Math.floor(i / GRID_SIZE)], colOf = (i: number) => grid.cols[i % GRID_SIZE];
  return <div className="cv-grid-wrap">
    <div className="cv-grid-head"><span className="pixel-eyebrow">{title}</span>
      <span className="cv-grid-left" aria-live="polite">{done ? 'Grid finished' : `${guessesAllowed(play) - play.used} guesses left`}</span></div>
    <div className="cv-grid" role="grid" aria-label="The grid">
      <div className="cv-grid-corner" aria-hidden="true"><PixelIcon name="star" size={22} /></div>
      {grid.cols.map(c => <div key={c.id} className="cv-grid-label col" role="columnheader" title={c.blurb}><small>{c.group}</small><b>{c.name}</b><i>{c.blurb}</i></div>)}
      {grid.rows.map((r, ri) => <div key={r.id} className="cv-grid-rowwrap" role="row">
        <div className="cv-grid-label row" role="rowheader"><b>{r.name}</b></div>
        {grid.cols.map((c, ci) => {
          const i = ri * GRID_SIZE + ci, id = play.cells[i];
          const cls = ['cv-grid-cell', id ? 'filled' : '', active === i ? 'active' : '', flash?.i === i ? (flash.ok ? 'ok' : 'no') : ''].filter(Boolean).join(' ');
          if (id) { const rv = rarity(h, r, c, id); return <div key={c.id} className={cls} role="gridcell"><b>{names.get(id)}</b><small>Rarity {rv}</small></div>; }
          if (done && reveal) { const sample = answers(r, c).map(x => names.get(x)).filter(Boolean).slice(0, 3); return <div key={c.id} className="cv-grid-cell reveal" role="gridcell"><small>e.g. {sample.join(', ')}</small><small>{answers(r, c).length} fit</small></div>; }
          return <button key={c.id} className={cls} role="gridcell" disabled={done} onClick={() => open(i)} aria-label={`${r.name} and ${c.name}`}>{done ? '—' : <PixelIcon name="search" size={18} />}</button>;
        })}
      </div>)}
    </div>
    {active != null && !done && <div className="cv-grid-picker" role="dialog" aria-label={`Guess for ${rowOf(active).name} and ${colOf(active).name}`}>
      <p><b>{rowOf(active).name}</b> × <b>{colOf(active).name}</b></p>
      <div className="arcade-guess-box">
        <input ref={inputRef} className="year-input" value={text} placeholder="Type a player" aria-label="Type a player's name" autoComplete="off"
          onChange={e => { setText(e.target.value); setHi(0); }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setHi(x => Math.min(matches.length - 1, x + 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(x => Math.max(0, x - 1)); }
            else if (e.key === 'Escape') setActive(null);
            else if (e.key === 'Enter' && matches[hi]) guess(matches[hi].id);
          }} />
        {matches.length > 0 && <ul className="arcade-suggest" role="listbox">{matches.map((p, k) => <li key={p.id}><button role="option" aria-selected={k === hi} className={k === hi ? 'active' : ''} onMouseEnter={() => setHi(k)} onClick={() => guess(p.id)}><b>{p.name}</b><small>{p.years}</small></button></li>)}</ul>}
      </div>
      <button className="link-button" onClick={() => setActive(null)}>Cancel</button>
    </div>}
    {flash && !flash.ok && <p className="cv-grid-miss" role="status">Not a fit (or already used). That cost a guess.</p>}
    {done && <div className={`arcade-reveal ${s.filled >= 6 ? 'won' : 'lost'}`}>
      <span className="pixel-eyebrow">{s.filled === 9 ? 'IMMACULATE' : `${s.filled} OF 9`}</span>
      <div className="arcade-stats">
        <span><b>{s.filled}/9</b><small>Squares</small></span>
        <span><b>{s.rarity}</b><small>Rarity points</small></span>
        <span><b>{s.score}</b><small>Score</small></span>
        {extra}
      </div>
      <div className="contest-actions">
        <button className="primary" onClick={async () => { const r = await share(gridShareText(shareDay, h, grid, play, SITE)); setNote(r === 'copied' ? 'Copied: paste it anywhere.' : r === 'failed' ? 'Could not share from this browser.' : null); }}><PixelIcon name="star" size={14} /> Share</button>
        {!reveal && s.filled < 9 && <button onClick={() => setReveal(true)}><PixelIcon name="search" size={14} /> Show answers</button>}
        {onNew && <button onClick={onNew}><PixelIcon name="play" size={14} /> New grid</button>}
      </div>
      {note && <p className="hint-text" role="status">{note}</p>}
    </div>}
  </div>;
}
