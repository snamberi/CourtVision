import { useEffect, useMemo, useState } from 'react';
import type { NbaHistory } from '../../history/nbaHistoryData';
import { legendsField, opponentFor, playRound, simulateBracket, tournamentWeek, ROUND_NAMES, playStreet, type Baller, type StreetGame } from '../../arcade/street';
import { RNG } from '../../simulation/engine/rng';
import { PlayerAvatar } from '../PlayerAvatar';
import { MyAvatar } from '../UserAvatar';
import { PixelIcon } from '../PixelIcon';
import { totalXp, levelFor, localName } from '../../profile/profile';
import { weekEndsAt } from '../../retention/week';
import { noteWeekRun } from '../../retention/weekLog';

/*
 * Two street games on real history: the Legends Tournament (pick one of the 64 greatest, win six 1v1 games to 11)
 * and 3v3 Street (you and two legends against crews that get tougher, first to 21).
 */

const LEGENDS_KEY = 'cv-legends-1v1';
interface LegendsRun { week: string; legend: string; round: number; alive: boolean; results: { opp: string; score: [number, number]; won: boolean }[] }
const readRun = (week: string): LegendsRun | null => { try { const r = JSON.parse(localStorage.getItem(LEGENDS_KEY) ?? 'null') as LegendsRun | null; return r && r.week === week ? r : null; } catch { return null; } };
const writeRun = (r: LegendsRun) => { try { localStorage.setItem(LEGENDS_KEY, JSON.stringify(r)); } catch { /* storage blocked */ } };

/** Plays a game's possessions out over a couple of seconds, then shows the final. */
function LiveScore({ game, left, right, onDone }: { game: StreetGame; left: React.ReactNode; right: React.ReactNode; onDone?: () => void }) {
  const [i, setI] = useState(0);
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    if (reduce) { setI(game.plays.length); return; }
    setI(0);
    const t = window.setInterval(() => setI(n => { if (n >= game.plays.length) { window.clearInterval(t); return n; } return n + 1; }), Math.max(40, 2400 / game.plays.length));
    return () => window.clearInterval(t);
  }, [game, reduce]);
  const done = i >= game.plays.length;
  useEffect(() => { if (done) onDone?.(); }, [done]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = game.plays[Math.min(i, game.plays.length) - 1];
  const score = done ? game.score : shown?.score ?? [0, 0];
  return <div className={`street-court ${done ? 'final' : ''}`}>
    <div className="street-side">{left}<b>{score[0]}</b></div>
    <div className="street-mid"><small>{done ? 'FINAL' : 'LIVE'}</small><span>{done ? (game.winner === 0 ? 'You win' : 'You lose') : shown?.text ?? 'Check ball'}</span></div>
    <div className="street-side">{right}<b>{score[1]}</b></div>
  </div>;
}

// ---------------------------------------------------------------- Legends Tournament (1v1)

export function LegendsGame({ h }: { h: NbaHistory }) {
  const week = tournamentWeek();
  const field = useMemo(() => legendsField(h), [h]);
  const champ = useMemo(() => simulateBracket(field, week).champion, [field, week]);
  const [run, setRun] = useState<LegendsRun | null>(() => readRun(week));
  const [q, setQ] = useState('');
  const [game, setGame] = useState<{ g: StreetGame; opp: Baller } | null>(null);
  const [revealed, setRevealed] = useState(false);
  const mine = run ? field.find(p => p.id === run.legend) ?? null : null;
  const days = Math.max(1, Math.ceil((weekEndsAt() - Date.now()) / 86_400_000));
  const pick = (b: Baller) => { const r = { week, legend: b.id, round: 0, alive: true, results: [] }; writeRun(r); setRun(r); };
  const play = () => {
    if (!run || !mine || !run.alive || run.round >= ROUND_NAMES.length) return;
    const opp = opponentFor(field, week, mine, run.round);
    if (!opp) return;
    const g = playRound(week, run.round, mine, opp);
    setGame({ g, opp }); setRevealed(false);
    const won = g.winner === 0;
    const next: LegendsRun = { ...run, round: run.round + (won ? 1 : 0), alive: won, results: [...run.results, { opp: opp.name, score: g.score, won }] };
    writeRun(next); setRun(next);
    if (!won || next.round >= ROUND_NAMES.length) noteWeekRun('bracket', { score: next.round * 10, line: `${mine.name}: ${next.round >= ROUND_NAMES.length ? 'Legends champion' : `out in the ${ROUND_NAMES[run.round]}`}` }, `legends-${week}`);
  };
  const avatar = (b: Baller, size = 64) => <PlayerAvatar playerId={b.name} teamId={b.team} size={size} title={b.name} />;
  const list = field.filter(b => b.name.toLowerCase().includes(q.trim().toLowerCase()));
  return <section className="street-game">
    <p className="hunt-lede">The 64 greatest at their best, one bracket for everyone this week. Pick your legend and win six 1v1 games to 11 (ones and twos, win by two) to take the title. New bracket in {days} day{days === 1 ? '' : 's'}.</p>
    <p className="hint-text">The AI bracket's champion this week: <b>{champ.name}</b>.</p>
    {!mine ? <>
      <input className="year-input" value={q} onChange={e => setQ(e.target.value)} placeholder="Find a legend" aria-label="Find a legend" />
      <ul className="street-pick">{list.map(b => <li key={b.id}><button onClick={() => pick(b)}>{avatar(b, 40)}<b>{b.name}</b><small>#{field.indexOf(b) + 1} seed · {b.ovr}</small></button></li>)}</ul>
    </> : <>
      <div className="street-path">{ROUND_NAMES.map((n, i) => <span key={n} className={i < run!.round ? 'won' : i === run!.round && run!.alive ? 'next' : !run!.alive && i === run!.round ? 'lost' : ''}>{n}</span>)}</div>
      {game && <LiveScore game={game.g} left={<>{avatar(mine)}<small>{mine.name}</small></>} right={<>{avatar(game.opp)}<small>{game.opp.name}</small></>} onDone={() => setRevealed(true)} />}
      {run!.alive && run!.round < ROUND_NAMES.length && (!game || revealed) && <button className="primary" onClick={play}>Play the {ROUND_NAMES[run!.round]}{(() => { const o = opponentFor(field, week, mine, run!.round); return o ? ` vs ${o.name}` : ''; })()}</button>}
      {revealed && !run!.alive && <p className="empty-state">{mine.name} is out. A new bracket comes next week.</p>}
      {run!.round >= ROUND_NAMES.length && <p className="street-champ"><PixelIcon name="trophy" size={18} /> {mine.name} wins the Legends Tournament!</p>}
      {run!.results.length > 0 && <ol className="street-results">{run!.results.map((r, i) => <li key={i} className={r.won ? 'won' : 'lost'}>{ROUND_NAMES[i]}: {r.won ? 'W' : 'L'} {r.score[0]}-{r.score[1]} vs {r.opp}</li>)}</ol>}
    </>}
  </section>;
}

// ---------------------------------------------------------------- 3v3 Street

const STREET_KEY = 'cv-street-best';
const readBest = () => { try { return Number(localStorage.getItem(STREET_KEY) ?? 0) || 0; } catch { return 0; } };

/** You, as a street baller: your level makes you better (60 to 90). */
function me(): Baller {
  const lv = levelFor(totalXp()).level, r = Math.min(90, 60 + Math.floor(lv / 8));
  return { id: '__me__', name: localName(), inside: r, mid: r - 2, three: r - 4, handle: r, perD: r - 3, intD: r - 6, reb: r - 4, height: 76, ovr: r };
}

export function StreetGame({ h }: { h: NbaHistory }) {
  const field = useMemo(() => legendsField(h), [h]);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const choices = useMemo(() => { const rng = new RNG(seed); return [...field].sort(() => rng.next() - 0.5).slice(0, 6); }, [field, seed]);
  const [team, setTeam] = useState<Baller[]>([]);
  const [streak, setStreak] = useState(0);
  const [game, setGame] = useState<{ g: StreetGame; crew: Baller[] } | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [lost, setLost] = useState(false);
  const [best, setBest] = useState(readBest);
  const crewFor = (n: number) => { const rng = new RNG(seed + 31 * n); const pool = field.slice(Math.max(0, 48 - n * 10), 64 - n * 8 > 8 ? 64 - n * 8 : 12); return [...pool].sort(() => rng.next() - 0.5).slice(0, 3); };
  const play = () => {
    const crew = crewFor(streak);
    const g = playStreet([me(), ...team], crew, 21, seed ^ (streak + 1) * 7919);
    setGame({ g, crew }); setRevealed(false);
    if (g.winner === 0) { const s = streak + 1; setStreak(s); if (s > best) { setBest(s); try { localStorage.setItem(STREET_KEY, String(s)); } catch { /* storage blocked */ } } }
    else { setLost(true); noteWeekRun('hilo', { score: streak, line: `3v3 Street: ${streak} win${streak === 1 ? '' : 's'} in a row` }); }
  };
  const restart = () => { setSeed(Math.floor(Math.random() * 1e9)); setTeam([]); setStreak(0); setGame(null); setLost(false); };
  const face = (b: Baller, size = 48) => b.id === '__me__' ? <MyAvatar size={size} mode="full" title={b.name} /> : <PlayerAvatar playerId={b.name} teamId={b.team} size={size} title={b.name} />;
  return <section className="street-game">
    <p className="hunt-lede">Half court, first to 21, ones and twos. You and two legends against street crews that get tougher every win. How long can you run the court? <small>Your level makes you better.</small></p>
    <p className="hint-text">Best run: <b>{best}</b> win{best === 1 ? '' : 's'} in a row.</p>
    {team.length < 2 ? <>
      <h3 className="hunt-subhead">Pick two legends ({team.length}/2)</h3>
      <ul className="street-pick">{choices.map(b => <li key={b.id}><button aria-pressed={team.includes(b)} disabled={team.includes(b)} onClick={() => setTeam(t => [...t, b])}>{face(b, 40)}<b>{b.name}</b><small>{b.ovr}</small></button></li>)}</ul>
    </> : <>
      <div className="street-team">{[me(), ...team].map(b => <span key={b.id}>{face(b)}<small>{b.name}</small></span>)}</div>
      {game && <LiveScore game={game.g} left={<span className="street-trio">{[me(), ...team].map(b => <span key={b.id}>{face(b, 34)}</span>)}</span>} right={<span className="street-trio">{game.crew.map(b => <span key={b.id}>{face(b, 34)}</span>)}</span>} onDone={() => setRevealed(true)} />}
      {!lost && (!game || revealed) && <button className="primary" onClick={play}>{streak ? `Next crew (${streak} in a row)` : 'Check ball'}</button>}
      {lost && revealed && <><p className="empty-state">Your run ends at {streak} win{streak === 1 ? '' : 's'}.</p><button className="primary" onClick={restart}>New run</button></>}
    </>}
  </section>;
}
