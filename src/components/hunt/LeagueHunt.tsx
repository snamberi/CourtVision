import { useEffect, useMemo, useState } from 'react';
import type { NbaHistory } from '../../history/nbaHistoryData';
import { cardPool, seasonLabel, RARITY_LABEL, type HuntCard } from '../../hunt/cards';
import { huntTeams, teamLabel, type HuntTeam } from '../../hunt/teams';
import { ERAS, eraOf } from '../../hunt/eras';
import { newRun, draftPick, playStop, takeReward, releaseCard, affordable, spent, strengthOf, SQUAD_SIZE, SQUAD_MAX, START_LIVES, type HuntRun, type HuntGame } from '../../hunt/run';
import { loadRun, saveRun, clearRun, loadRecords, recordRun, type HuntRecords } from '../../hunt/storage';
import { PlayerAvatar } from '../PlayerAvatar';
import { BoxScoreTable } from '../BoxScoreTable';
import { WatchGame } from '../WatchGame';
import { PixelIcon } from '../PixelIcon';
import './hunt.css';

/** League Hunt: a run through basketball history with a squad of real player-season cards. */
export function LeagueHunt({ onExit }: { onExit: () => void }) {
  const [h, setH] = useState<NbaHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [run, setRunState] = useState<HuntRun | null>(() => loadRun());
  const [records, setRecords] = useState<HuntRecords>(() => loadRecords());
  const [game, setGame] = useState<HuntGame | null>(null);
  const [watching, setWatching] = useState(false);
  useEffect(() => {
    let live = true;
    import('../../history/nbaHistoryData').then(m => m.loadNbaHistory()).then(d => { if (live) setH(d); }, e => { if (live) setError(e instanceof Error ? e.message : String(e)); });
    return () => { live = false; };
  }, []);
  const setRun = (r: HuntRun | null) => {
    setRunState(r);
    if (!r) clearRun();
    else saveRun(r);
    if (r && (r.stage === 'won' || r.stage === 'lost') && run?.stage !== r.stage) setRecords(recordRun(r));
  };

  const header = <header className="hunt-top">
    <button className="hunt-exit" onClick={onExit}><PixelIcon name="exit" size={16} /> Main Menu</button>
    <div className="hunt-title"><span className="pixel-eyebrow">A RUN THROUGH BASKETBALL HISTORY</span><h1>League Hunt</h1></div>
    {run && run.stage !== 'won' && run.stage !== 'lost' && <div className="hunt-lives" aria-label={`${run.lives} lives left`}>{Array.from({ length: START_LIVES }, (_, i) => <span key={i} className={i < run.lives ? 'on' : ''}>♥</span>)}</div>}
  </header>;

  if (error) return <div className="hunt">{header}<p className="empty-state">Could not load the NBA history data: {error}</p></div>;
  if (!h) return <div className="hunt">{header}<p className="empty-state">Loading 80 years of basketball…</p></div>;
  if (watching && game) return <div className="hunt hunt-watch">{header}<WatchGame game={game.result} home={game.home} away={game.away} homeRoster={game.home.seasons} awayRoster={game.away.seasons} onBoxScore={() => setWatching(false)} /></div>;

  return <div className="hunt">
    {header}
    {!run ? <Intro records={records} onStart={() => { setGame(null); setRun(newRun(h, Math.floor(Math.random() * 1_000_000_000))); }} />
      : run.stage === 'draft' ? <Draft h={h} run={run} onPick={id => setRun(draftPick(h, run, id))} onAbandon={() => setRun(null)} />
      : game ? <GameResultView h={h} run={run} game={game} onWatch={() => setWatching(true)} onContinue={() => setGame(null)} />
      : run.stage === 'reward' ? <Reward h={h} run={run} onTake={(id, replacing) => setRun(takeReward(h, run, id, replacing))} onRelease={id => setRun(releaseCard(run, id))} />
      : run.stage === 'won' || run.stage === 'lost' ? <RunOver h={h} run={run} records={records} onNew={() => { setGame(null); setRun(newRun(h, Math.floor(Math.random() * 1_000_000_000))); }} onExit={() => { setRun(null); onExit(); }} />
      : <MapView h={h} run={run} onPlay={watch => { const r = playStop(h, run); if (!r) return; setGame(r.game); setRun(r.run); if (watch) setWatching(true); }} onRelease={id => setRun(releaseCard(run, id))} onAbandon={() => setRun(null)} />}
  </div>;
}

function Intro({ records, onStart }: { records: HuntRecords; onStart: () => void }) {
  return <section className="hunt-intro">
    <p className="hunt-lede">Draft real players from any season in NBA history, then travel through the eras and take on the great teams of their time, each game under the rules of its era. Beat five teams and the boss, one of the best teams ever, before you run out of lives.</p>
    <ul className="hunt-rules">
      <li><b>Cards are player-seasons.</b> 1996 Jordan and 2003 Jordan are different cards. Ratings are ranked within each season, so every era is fair.</li>
      <li><b>Legacy Points.</b> Better cards cost more. Draft {SQUAD_SIZE} under the cap; each win raises it.</li>
      <li><b>Era rules.</b> No three-point line before 1979-80, hand-checking in the 90s, the pace of the time. Shooters shine in 2016 and fade in 1970.</li>
      <li><b>{START_LIVES} lives.</b> Lose a game and you replay it; lose them all and the hunt is over.</li>
    </ul>
    <button className="primary hunt-start" onClick={onStart}>Start a new hunt</button>
    {records.runs > 0 && <p className="hint-text">Your hunts: {records.runs} · won {records.wins} · furthest stop {records.bestStop + 1} of 6</p>}
  </section>;
}

const posColor: Record<string, string> = { PG: '#4da3ff', SG: '#55c878', SF: '#ffd166', PF: '#f47b20', C: '#e85d5d', G: '#4da3ff', F: '#f47b20' };

function Card({ card, onClick, disabled, action, note }: { card: HuntCard; onClick?: () => void; disabled?: boolean; action?: string; note?: string }) {
  const body = <>
    <span className="hunt-card-top"><small>{RARITY_LABEL[card.rarity].toUpperCase()}</small><b className="hunt-card-cost" title="Legacy Points">{card.cost} LP</b></span>
    <PlayerAvatar playerId={card.name} primaryColor={posColor[card.pos] ?? '#f47b20'} secondaryColor="#f4f0e6" size={64} />
    <strong className="hunt-card-name">{card.name}</strong>
    <span className="hunt-card-season">{seasonLabel(card.end)} · {card.teamName}</span>
    <span className="hunt-card-ovr"><b>{card.ovr}</b><small>{card.pos}</small></span>
    <span className="hunt-card-line">{card.ppg} PTS · {card.rpg} REB · {card.apg} AST</span>
    {action && <span className="hunt-card-action">{action}</span>}
    {note && <span className="hunt-card-note">{note}</span>}
  </>;
  return onClick ? <button className={`hunt-card rarity-${card.rarity}`} disabled={disabled} onClick={onClick}>{body}</button> : <div className={`hunt-card rarity-${card.rarity}`}>{body}</div>;
}

function CapBar({ h, run }: { h: NbaHistory; run: HuntRun }) {
  const used = spent(h, run.squad);
  return <div className="hunt-cap" aria-label={`Legacy Points ${used} of ${run.cap}`}>
    <span>LEGACY POINTS</span><div className="hunt-cap-bar"><i style={{ width: `${Math.min(100, used / run.cap * 100)}%` }} /></div><b>{used} / {run.cap}</b>
  </div>;
}

function SquadList({ h, run, onRelease }: { h: NbaHistory; run: HuntRun; onRelease?: (id: string) => void }) {
  const pool = cardPool(h);
  const cards = run.squad.map(id => pool.byId.get(id)!).filter(Boolean).sort((a, b) => b.ovr - a.ovr);
  return <div className="hunt-squad">
    <div className="hunt-squad-head"><h3>Your squad</h3><span>Strength <b>{strengthOf(cards)}</b> · {cards.length}/{SQUAD_MAX}</span></div>
    <ol>{cards.map((c, i) => <li key={c.id} className={`rarity-${c.rarity}`}>
      <span className="hunt-squad-ovr">{c.ovr}</span>
      <span className="hunt-squad-name">{c.name} <small>'{String(c.end).slice(2)} · {c.pos}{i < 5 ? ' · starter' : ''}</small></span>
      <span className="hunt-squad-cost">{c.cost}</span>
      {onRelease && cards.length > 5 && <button className="link-button" onClick={() => onRelease(c.id)} title="Release to free Legacy Points">Release</button>}
    </li>)}</ol>
  </div>;
}

function Draft({ h, run, onPick, onAbandon }: { h: NbaHistory; run: HuntRun; onPick: (id: string) => void; onAbandon: () => void }) {
  const pool = cardPool(h);
  return <section className="hunt-stage">
    <div className="hunt-stage-head"><div><span className="pixel-eyebrow">THE DRAFT · PICK {run.squad.length + 1} OF {SQUAD_SIZE}</span><h2>{run.squad.length === 0 ? 'Choose your franchise star' : 'Build around him'}</h2></div><CapBar h={h} run={run} /></div>
    <div className="hunt-offer">{run.offer.map(id => { const c = pool.byId.get(id)!; const ok = affordable(h, run, id); return <Card key={id} card={c} disabled={!ok} onClick={() => onPick(id)} action={ok ? 'Draft' : 'Over the cap'} />; })}</div>
    <p className="hint-text">Leave room: every open spot needs at least 6 Legacy Points.</p>
    {run.squad.length > 0 && <SquadList h={h} run={run} />}
    <button className="link-button" onClick={onAbandon}>Abandon this hunt</button>
  </section>;
}

function StopTrail({ h, run }: { h: NbaHistory; run: HuntRun }) {
  const teams = useMemo(() => new Map(huntTeams(h).map(t => [t.id, t])), [h]);
  return <ol className="hunt-trail">{run.stops.map((s, i) => { const t = teams.get(s.teamId)!; const era = ERAS.find(e => e.id === s.eraId)!; const res = run.results.filter(r => r.stop === i).at(-1);
    return <li key={s.teamId} className={`${i === run.stopIndex ? 'current' : ''} ${i < run.stopIndex || (res?.won) ? 'done' : ''} ${s.boss ? 'boss' : ''}`}>
      <small>{s.boss ? 'BOSS' : era.label.toUpperCase()}</small><b>{i <= run.stopIndex || s.boss ? `${t.end - 1}-${String(t.end).slice(2)} ${t.name}` : '???'}</b>
      <span>{res ? `${res.won ? 'W' : 'L'} ${res.us}-${res.them}` : i <= run.stopIndex || s.boss ? `Strength ${t.strength}` : ''}</span>
    </li>; })}</ol>;
}

function MapView({ h, run, onPlay, onRelease, onAbandon }: { h: NbaHistory; run: HuntRun; onPlay: (watch: boolean) => void; onRelease: (id: string) => void; onAbandon: () => void }) {
  const stop = run.stops[run.stopIndex];
  const team = huntTeams(h).find(t => t.id === stop.teamId)!;
  const era = ERAS.find(e => e.id === stop.eraId) ?? eraOf(team.end);
  const pool = cardPool(h);
  const mine = new Set(run.squad.map(id => pool.byId.get(id)?.playerId));
  const theirs = team.roster.map(id => pool.byId.get(id)!).filter(Boolean);
  const mineStrength = strengthOf(run.squad.map(id => pool.byId.get(id)!));
  return <section className="hunt-stage">
    <StopTrail h={h} run={run} />
    <div className="hunt-matchup">
      <div className="hunt-era"><span className="pixel-eyebrow">{stop.boss ? 'THE BOSS' : `STOP ${run.stopIndex + 1} OF ${run.stops.length}`} · {era.label.toUpperCase()}</span>
        <h2>{teamLabel(team)}</h2>
        <p>{team.w}-{team.l}{team.champion ? ' · Champions' : ''} · Strength <b>{team.strength}</b> vs your <b>{mineStrength}</b></p>
        <p className="hunt-era-rules">Era rules: {era.blurb}</p>
        <div className="contest-actions"><button className="primary" onClick={() => onPlay(true)}>Watch the game</button><button onClick={() => onPlay(false)}>Sim it</button></div>
        {run.attempts > 0 && <p className="hint-text">Rematch {run.attempts + 1}. {run.lives} {run.lives === 1 ? 'life' : 'lives'} left.</p>}
      </div>
      <div className="hunt-opponent"><h3>Their rotation</h3><ol>{theirs.map(c => <li key={c.id} className={mine.has(c.playerId) ? 'gone' : ''}><span className="hunt-squad-ovr">{c.ovr}</span><span>{c.name} <small>{c.pos}</small></span>{mine.has(c.playerId) && <small>on your squad</small>}</li>)}</ol></div>
    </div>
    <CapBar h={h} run={run} />
    <SquadList h={h} run={run} onRelease={onRelease} />
    <button className="link-button" onClick={onAbandon}>Abandon this hunt</button>
  </section>;
}

function GameResultView({ h, run, game, onWatch, onContinue }: { h: NbaHistory; run: HuntRun; game: HuntGame; onWatch: () => void; onContinue: () => void }) {
  const r = game.result;
  void h;
  return <section className="hunt-stage">
    <div className={`hunt-result ${game.won ? 'won' : 'lost'}`}>
      <span className="pixel-eyebrow">{game.era.label.toUpperCase()} RULES</span>
      <h2>{game.won ? 'Win!' : 'Loss'}</h2>
      <strong className="hunt-score">{r.homeScore} — {r.awayScore}</strong>
      <p>Your squad vs {game.away.name}</p>
      <p className="hint-text">{run.stage === 'won' ? 'You beat the boss. The hunt is yours.' : run.stage === 'lost' ? 'Out of lives. The hunt ends here.' : game.won ? 'A new card is waiting for you.' : `${run.lives} ${run.lives === 1 ? 'life' : 'lives'} left. Change your squad and try again.`}</p>
      <div className="contest-actions"><button className="primary" onClick={onContinue}>Continue</button><button onClick={onWatch}>Watch the replay</button></div>
    </div>
    <div className="feature-table-scroll"><BoxScoreTable box={r.homeBox} title="Your squad" /><BoxScoreTable box={r.awayBox} title={game.away.name} /></div>
  </section>;
}

function Reward({ h, run, onTake, onRelease }: { h: NbaHistory; run: HuntRun; onTake: (id: string | null, replacing?: string) => void; onRelease: (id: string) => void }) {
  const pool = cardPool(h);
  const [choice, setChoice] = useState<string | null>(null);
  const squad = run.squad.map(id => pool.byId.get(id)!).sort((a, b) => a.ovr - b.ovr);
  const card = choice ? pool.byId.get(choice)! : null;
  const fitsOpen = !!choice && run.squad.length < SQUAD_MAX && affordable(h, run, choice);
  return <section className="hunt-stage">
    <div className="hunt-stage-head"><div><span className="pixel-eyebrow">VICTORY SPOILS · CAP +8</span><h2>Choose a new card</h2></div><CapBar h={h} run={run} /></div>
    <div className="hunt-offer">{run.offer.map(id => <Card key={id} card={pool.byId.get(id)!} onClick={() => setChoice(id)} action={choice === id ? 'Selected' : 'Choose'} />)}</div>
    {card && <div className="hunt-reward-place">
      {fitsOpen && <button className="primary" onClick={() => onTake(card.id)}>Add {card.name} to the squad</button>}
      <p>{fitsOpen ? 'Or replace someone:' : run.squad.length >= SQUAD_MAX ? 'Your squad is full. Replace someone:' : 'Over the cap as an addition. Replace someone:'}</p>
      <div className="hunt-replace">{squad.map(c => { const ok = affordable(h, run, card.id, c.id); return <button key={c.id} disabled={!ok} onClick={() => onTake(card.id, c.id)}>{c.ovr} {c.name} '{String(c.end).slice(2)} <small>{c.cost} LP</small></button>; })}</div>
    </div>}
    <button onClick={() => onTake(null)}>Skip the card and move on</button>
    <SquadList h={h} run={run} onRelease={onRelease} />
  </section>;
}

function RunOver({ h, run, records, onNew, onExit }: { h: NbaHistory; run: HuntRun; records: HuntRecords; onNew: () => void; onExit: () => void }) {
  const teams = new Map(huntTeams(h).map((t: HuntTeam) => [t.id, t]));
  return <section className="hunt-stage hunt-over">
    <span className="pixel-eyebrow">{run.stage === 'won' ? 'HUNT COMPLETE' : 'HUNT OVER'}</span>
    <h2>{run.stage === 'won' ? 'You conquered basketball history' : `You reached stop ${run.stopIndex + 1} of ${run.stops.length}`}</h2>
    <ol className="hunt-log">{run.results.map((r, i) => { const t = teams.get(r.teamId)!; return <li key={i} className={r.won ? 'won' : 'lost'}>{r.won ? 'W' : 'L'} {r.us}-{r.them} vs {teamLabel(t)}</li>; })}</ol>
    <SquadList h={h} run={run} />
    <p className="hint-text">Your hunts: {records.runs} · won {records.wins}</p>
    <div className="contest-actions"><button className="primary" onClick={onNew}>Start a new hunt</button><button onClick={onExit}>Main Menu</button></div>
  </section>;
}
