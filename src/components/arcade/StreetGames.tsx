import { useEffect, useMemo, useRef, useState } from 'react';
import type { NbaHistory } from '../../history/nbaHistoryData';
import { legendsField, opponentFor, playRound, simulateBracket, tournamentWeek, ROUND_NAMES, playStreet, type Baller, type StreetGame } from '../../arcade/street';
import { RNG } from '../../simulation/engine/rng';
import { PlayerAvatar } from '../PlayerAvatar';
import { MyAvatar } from '../UserAvatar';
import { PixelIcon } from '../PixelIcon';
import { totalXp, levelFor, localName } from '../../profile/profile';
import { loadMyRatings, myOverall } from '../../profile/myRatings';
import { weekEndsAt } from '../../retention/week';
import { noteWeekRun } from '../../retention/weekLog';
import { noteHolidayFinish } from '../../retention/holiday';
import { noteFeat } from '../../profile/feats';
import { CourtLineup, type LineupPlayer } from '../CourtLineup';
import { assignToSpots, THREE_SPOTS } from '../lineupSpots';
import { teamColors } from '../../simulation/teamColors';
import { burst, celebrate, shake } from '../../fx/effects';
import { aiTeams, canAfford, roundDay, roundsOpen, runTournament, teamCost, tourCost, tourPool, TOUR_BUDGET, TOUR_PICKS, TOUR_ROUNDS, flipGame, type TourGame, type TourTeam } from '../../arcade/gmTournament';

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
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!done) return;
    onDone?.();
    // The final whistle: sparks over the winner's side, and a shake when it's you.
    const side = box.current?.querySelectorAll('.street-side')[game.winner];
    burst(side, { colors: game.winner === 0 ? ['#55c878', '#ffd166', '#f4f0e6'] : ['#e85d5d', '#94a0b2'], count: game.winner === 0 ? 34 : 14 });
    if (game.winner === 0) shake(box.current);
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = game.plays[Math.min(i, game.plays.length) - 1];
  const score = done ? game.score : shown?.score ?? [0, 0];
  return <div ref={box} className={`street-court ${done ? 'final' : ''}`}>
    <div className="street-side">{left}<b key={`a${score[0]}`} className="fx-pop">{score[0]}</b></div>
    <div className="street-mid"><small>{done ? 'FINAL' : 'LIVE'}</small><span>{done ? (game.winner === 0 ? 'You win' : 'You lose') : shown?.text ?? 'Check ball'}</span></div>
    <div className="street-side">{right}<b key={`b${score[1]}`} className="fx-pop">{score[1]}</b></div>
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
    if (won && next.round >= ROUND_NAMES.length) window.setTimeout(() => celebrate(), 2600);
    if (!won || next.round >= ROUND_NAMES.length) noteHolidayFinish(won, `legends-${week}`);
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

/** You, as a street baller: the ratings you build in the Closet (Ratings tab), points earned by your level. */
function me(): Baller {
  const r = loadMyRatings(levelFor(totalXp()).level), k = r.skills;
  // Athleticism and IQ help everything a little; the body helps inside and on the boards.
  const lift = ((k.athleticism - 45) + (k.iq - 45)) * 0.15;
  return { id: '__me__', name: localName(), inside: (k.finishing * 2 + k.body) / 3 + lift, mid: k.midRange + lift, three: k.threePoint + lift, handle: k.playmaking + lift,
    perD: k.perimeterD + lift, intD: k.interiorD + lift, reb: (k.interiorD + k.body) / 2, height: r.height, ovr: myOverall(r) };
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
    else { setLost(true); noteHolidayFinish(streak >= 3); noteWeekRun('hilo', { score: streak, line: `3v3 Street: ${streak} win${streak === 1 ? '' : 's'} in a row` }); }
  };
  const restart = () => { setSeed(Math.floor(Math.random() * 1e9)); setTeam([]); setStreak(0); setGame(null); setLost(false); };
  const face = (b: Baller, size = 48) => b.id === '__me__' ? <MyAvatar size={size} mode="full" title={b.name} /> : <PlayerAvatar playerId={b.name} teamId={b.team} size={size} title={b.name} />;
  return <section className="street-game">
    <p className="hunt-lede">Half court, first to 21, ones and twos. You and two legends against street crews that get tougher every win. How long can you run the court? <small>You play with the ratings you build in the Closet (Ratings tab); every 5 levels earn 7 points.</small></p>
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

// ---------------------------------------------------------------- GM Tournament (16 GMs, one week)

const TOUR_KEY = 'cv-gm-tour';
interface TourRun { week: string; picks: string[]; revealed: number }
const readTour = (week: string): TourRun | null => { try { const r = JSON.parse(localStorage.getItem(TOUR_KEY) ?? 'null') as TourRun | null; return r && r.week === week ? r : null; } catch { return null; } };
const writeTour = (r: TourRun) => { try { localStorage.setItem(TOUR_KEY, JSON.stringify(r)); } catch { /* storage blocked */ } };

export function GmTournament({ h }: { h: NbaHistory }) {
  const week = tournamentWeek();
  const pool = useMemo(() => tourPool(h, week), [h, week]);
  const ai = useMemo(() => aiTeams(pool, week), [pool, week]);
  const [run, setRun] = useState<TourRun | null>(() => readTour(week));
  const [picked, setPicked] = useState<Baller[]>([]);
  const [live, setLive] = useState<TourGame | null>(null);
  const [revealed, setRevealed] = useState(true);
  const mine: TourTeam | null = run ? { gm: localName(), you: true, players: run.picks.map(id => pool.find(b => b.id === id)).filter((b): b is Baller => !!b) } : null;
  const result = useMemo(() => mine && mine.players.length === TOUR_PICKS ? runTournament(mine, ai, week) : null, [run, ai, week]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = roundsOpen();
  const face = (b: Baller, size = 34) => <PlayerAvatar playerId={b.name} teamId={b.team} size={size} title={b.name} />;
  const lockIn = () => { const r = { week, picks: picked.map(b => b.id), revealed: 0 }; writeTour(r); setRun(r); };
  const myGame = (round: number) => result?.games.find(g => g.round === round && (g.a.you || g.b.you)) ?? null;
  const out = result ? result.games.find(g => (g.a.you || g.b.you) && !g.winner.you) : undefined;
  const next = run && result && run.revealed < TOUR_ROUNDS.length && !(out && out.round < run.revealed) ? run.revealed : null;
  const reveal = () => {
    if (!run || next == null || next >= open) return;
    const g = myGame(next);
    const r = { ...run, revealed: next + 1 };
    writeTour(r); setRun(r);
    if (g) { setLive(g); setRevealed(false); }
    if (g?.winner.you && next === TOUR_ROUNDS.length - 1) window.setTimeout(() => celebrate(), 2600);
    const lost = g && !g.winner.you, champ = g?.winner.you && next === TOUR_ROUNDS.length - 1;
    if (lost || champ) {
      noteHolidayFinish(!!champ, `gm-tour-${week}`);
      noteWeekRun('bracket', { score: (next + (champ ? 1 : 0)) * 10, line: `GM Tournament: ${champ ? 'champion' : `out in the ${TOUR_ROUNDS[next]}`}` }, `gm-tour-${week}`);
      if (champ) noteFeat('tourTitles', 1);
    }
  };
  const team = (t: TourTeam) => <span className={`tour-team${t.you ? ' you' : ''}`}><span className="street-trio">{t.players.map(b => <span key={b.id}>{face(b, 22)}</span>)}</span><b>{t.you ? `${t.gm} (you)` : t.gm}</b></span>;
  return <section className="street-game gm-tour">
    <p className="hunt-lede">Sixteen GMs, one bracket, one week. Draft three legends under a {TOUR_BUDGET}-point budget, then win four 3v3 games to 21: the Round of 16 opens Monday, the quarterfinals Wednesday, the semifinals Friday and the final Sunday (UTC).</p>
    {!run ? <>
      <h3 className="hunt-subhead">Your draft ({picked.length}/{TOUR_PICKS}) · budget {teamCost(picked)}/{TOUR_BUDGET}</h3>
      <i className="tour-budget" aria-hidden="true"><i style={{ width: `${Math.min(100, teamCost(picked) / TOUR_BUDGET * 100)}%` }} /></i>
      <CourtLineup spots={THREE_SPOTS} players={assignToSpots(picked.map(onCourt), THREE_SPOTS)} active={picked.length < TOUR_PICKS ? assignToSpots(picked.map(onCourt), THREE_SPOTS).findIndex(p => !p) : undefined} label="Your three" />
      <ul className="street-pick">{pool.map(b => { const on = picked.some(p => p.id === b.id); return <li key={b.id}><button aria-pressed={on} disabled={!on && !canAfford(pool, picked, b)} onClick={() => setPicked(cur => on ? cur.filter(p => p.id !== b.id) : [...cur, b])}>{face(b, 40)}<b>{b.name}</b><small>{b.ovr} OVR · costs {tourCost(b)}</small></button></li>; })}</ul>
      <button className="primary" disabled={picked.length !== TOUR_PICKS} onClick={lockIn}>Lock in my three</button>
      <p className="hint-text">Once you lock in, your team is set for the week. Stars cost more: you can't take three of the best.</p>
    </> : result && <>
      <div className="street-path">{TOUR_ROUNDS.map((n, i) => { const g = myGame(i); const shown = i < run.revealed; return <span key={n} className={shown && g ? (g.winner.you ? 'won' : 'lost') : i === next ? 'next' : ''}>{n}{i >= open ? ` · ${roundDay(i)}` : ''}</span>; })}</div>
      {live && <LiveScore game={live.a.you ? live.game : flipGame(live.game)} left={team(live.a.you ? live.a : live.b)} right={team(live.a.you ? live.b : live.a)} onDone={() => setRevealed(true)} />}
      {next != null && revealed && (next < open
        ? <button className="primary" onClick={reveal}>Play the {TOUR_ROUNDS[next]}{(() => { const g = myGame(next); const o = g && (g.a.you ? g.b : g.a); return o ? ` vs ${o.gm}` : ''; })()}</button>
        : <p className="hint-text">The {TOUR_ROUNDS[next]} opens {roundDay(next)} (UTC). Come back then.</p>)}
      {out && out.round < run.revealed && revealed && <p className="empty-state">Knocked out in the {TOUR_ROUNDS[out.round]}. A new tournament starts Monday.</p>}
      {run.revealed >= TOUR_ROUNDS.length && result.champion.you && revealed && <p className="street-champ"><PixelIcon name="trophy" size={18} /> You win the GM Tournament!</p>}
      <div className="tour-bracket">{TOUR_ROUNDS.map((n, r) => <div key={n} className="tour-round"><h4>{n}</h4>
        {r < run.revealed || (out && out.round < run.revealed && r < open) ? result.games.filter(g => g.round === r).map((g, i) => <p key={i} className={g.a.you || g.b.you ? 'mine' : ''}>
          <span className={g.winner === g.a ? 'w' : ''}>{g.a.you ? 'You' : g.a.gm} {g.score[0]}</span><span className={g.winner === g.b ? 'w' : ''}>{g.b.you ? 'You' : g.b.gm} {g.score[1]}</span></p>)
          : <p className="hint-text">{r < open ? 'Play your game to see it.' : `Opens ${roundDay(r)}`}</p>}
      </div>)}</div>
    </>}
  </section>;
}

/** A legend on the 3v3 court: guard, wing or big by height. */
function onCourt(b: Baller): LineupPlayer {
  const c = teamColors(b.team);
  return { id: b.id, name: b.name, pos: b.height <= 77 ? 'PG' : b.height <= 81 ? 'SF' : 'C', colors: [c.primary, c.secondary], sub: `${b.ovr} OVR` };
}
