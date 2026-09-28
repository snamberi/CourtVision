import { useMemo, useState } from 'react';
import type { NbaHistory } from '../../history/nbaHistoryData';
import { LEGEND_SCENARIOS, GAME_PLANS, legendRun, legendTeams, playLegendGame, scoreLegend, loadLegendRecords, saveLegendResult, loadLegendRun, storeLegendRun,
  type GamePlan, type LegendRunState, type LegendSide } from '../../hunt/legendChallenges';
import type { GameResult } from '../../simulation/boxscore';
import { calculateOverall } from '../../simulation/engine/overall';
import { BoxScoreTable } from '../BoxScoreTable';
import { WatchGame } from '../WatchGame';

const Stars = ({ n }: { n: number }) => <span className="legend-stars" aria-label={`${n} of 3 stars`}>{[1, 2, 3].map(i => <i key={i} className={i <= n ? 'on' : ''}>★</i>)}</span>;

/** Legend Challenges: pick a moment from NBA history, coach it game by game, score it. */
export function LegendChallenges({ h }: { h: NbaHistory }) {
  const [records, setRecords] = useState(loadLegendRecords);
  const [state, setState] = useState<LegendRunState | null>(loadLegendRun);
  const [plan, setPlan] = useState<GamePlan>('balanced');
  const [last, setLast] = useState<{ result: GameResult; home: LegendSide; away: LegendSide } | null>(null);
  const [watching, setWatching] = useState(false);
  const run = state ? legendRun(state) : null;
  const sc = run?.scenario();
  const scenarioId = state?.scenarioId;
  const sides = useMemo(() => { const s = LEGEND_SCENARIOS.find(x => x.id === scenarioId); return s ? legendTeams(h, s) : null; }, [h, scenarioId]);
  const set = (s: LegendRunState | null) => { setState(s); storeLegendRun(s); };

  if (watching && last) return <div className="hunt-watch"><WatchGame game={last.result} home={last.home} away={last.away} homeRoster={last.home.seasons} awayRoster={last.away.seasons} onBoxScore={() => setWatching(false)} /></div>;

  if (!run || !sc) return <div className="legend-list">
    <p className="hunt-lede">Short scenarios from real NBA history: one series or one game. Coach the real team against the real opponent under that era's rules, pick a game plan before every game, and chase three stars.</p>
    <p className="hint-text">★ push the favourite (win a game, or keep a one-game challenge within 5) · ★★ pull it off · ★★★ pull it off with the scenario's extra goal.</p>
    <div className="legend-grid">{LEGEND_SCENARIOS.map(s => { const rec = records[s.id]; return <article key={s.id} className="legend-card">
      <header><b>{s.title}</b><Stars n={rec?.stars ?? 0} /></header>
      <p>{s.blurb}</p>
      <p className="hint-text">{s.format === 'game' ? 'One game' : s.start ? `Best of seven, starting ${s.start[0]}-${s.start[1]}` : 'Best of seven'} · ★★★ {s.bonus.text.toLowerCase()}{rec ? ` · best ${rec.best.toLocaleString()} pts` : ''}</p>
      <button className="primary" onClick={() => { setLast(null); set({ scenarioId: s.id, games: [] }); }}>Play</button>
    </article>; })}</div>
  </div>;

  const done = run.done();
  const { score, stars } = scoreLegend(run);
  const next = () => {
    const out = playLegendGame(h, state!, plan, Math.floor(Math.random() * 1_000_000_000));
    if (!out) return;
    setLast(out); set(out.state);
    const r = legendRun(out.state);
    if (r.done()) setRecords(saveLegendResult(r));
    return out;
  };
  const top = (s: LegendSide | undefined) => s ? [...s.seasons].sort((a, b) => calculateOverall(b) - calculateOverall(a)).slice(0, 3).map(p => p.playerId.replace(/ '\d+$/, '').split(' ').slice(-1)[0]).join(', ') : '';
  return <div className="legend-run">
    <header className="legend-run-head">
      <div><span className="pixel-eyebrow">LEGEND CHALLENGE</span><h3>{sc.title}</h3><p className="hint-text">{sc.blurb}</p></div>
      <button onClick={() => { if (!done && run.games.length) setRecords(saveLegendResult(run)); set(null); setLast(null); }}>{done ? 'Back to challenges' : 'Give up'}</button>
    </header>
    <div className="legend-score">
      <div><small>{sides?.you.name}</small><b>{sc.format === 'series' ? run.wins() : run.games[0]?.us ?? '–'}</b><span>{top(sides?.you)}</span></div>
      <em>{sc.format === 'series' ? 'SERIES' : 'GAME'}</em>
      <div><small>{sides?.opp.name}</small><b>{sc.format === 'series' ? run.losses() : run.games[0]?.them ?? '–'}</b><span>{top(sides?.opp)}</span></div>
    </div>
    {run.games.length > 0 && <ol className="legend-games">{run.games.map((g, i) => <li key={i} className={g.us > g.them ? 'win' : 'loss'}>
      <span>{sc.format === 'series' ? `Game ${(sc.start ? sc.start[0] + sc.start[1] : 0) + i + 1}` : 'Game'} {g.home ? 'home' : 'away'}</span><b>{g.us > g.them ? 'W' : 'L'} {g.us}-{g.them}</b><small>{GAME_PLANS.find(p => p.id === g.plan)?.label}</small></li>)}</ol>}
    {done ? <div className="legend-final">
      <b>{run.won() ? 'You did it.' : 'History held.'}</b><Stars n={stars} /><span>{score.toLocaleString()} points</span>
      <p className="hint-text">★★★ goal: {sc.bonus.text}.</p>
      <div className="contest-actions"><button className="primary" onClick={() => { setLast(null); set({ scenarioId: sc.id, games: [] }); }}>Try again</button></div>
    </div> : <div className="legend-plan">
      <h4>Game plan</h4>
      <div className="legend-plans" role="radiogroup" aria-label="Game plan">{GAME_PLANS.map(p => <button key={p.id} role="radio" aria-checked={plan === p.id} className={plan === p.id ? 'active' : ''} onClick={() => setPlan(p.id)}><b>{p.label}</b><small>{p.note}</small></button>)}</div>
      <div className="contest-actions"><button className="primary" onClick={() => { if (next()) setWatching(true); }}>Watch the game</button><button onClick={() => next()}>Sim the game</button></div>
    </div>}
    {last && <>
      <div className="contest-actions"><button onClick={() => setWatching(true)}>Watch the last game</button></div>
      <div className="feature-table-scroll"><BoxScoreTable box={last.result.homeBox} title={last.home.name} /><BoxScoreTable box={last.result.awayBox} title={last.away.name} /></div>
    </>}
  </div>;
}
