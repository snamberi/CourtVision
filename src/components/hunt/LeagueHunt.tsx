import { useEffect, useMemo, useState } from 'react';
import type { NbaHistory } from '../../history/nbaHistoryData';
import { cardPool, seasonLabel, RARITY_LABEL, type HuntCard } from '../../hunt/cards';
import { huntTeams, teamLabel, type HuntTeam } from '../../hunt/teams';
import { ERAS, eraOf } from '../../hunt/eras';
import { newRun, draftPick, playStop, takeReward, releaseCard, affordable, spent, strengthOf, squadBonuses, effectiveStrength, chooseRoad, moveOn, buyCard, buyItem, buyLife, rest, resolveEvent, cardPrice, SQUAD_SIZE, SQUAD_MAX, START_LIVES, LIFE_PRICE, MAX_TRAINING, type HuntRun, type HuntGame, type NodeKind } from '../../hunt/run';
import { ITEMS, MAX_ITEMS } from '../../hunt/items';
import { EVENTS } from '../../hunt/events';
import type { ChemistryBond } from '../../hunt/chemistry';
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
    {run && run.stage !== 'won' && run.stage !== 'lost' && run.stage !== 'draft' && <div className="hunt-purse"><span className="hunt-coins" title="Coins">● {run.coins}</span>
      {run.items.map(i => <span key={i} className="hunt-item-chip" title={ITEMS[i].blurb}>{ITEMS[i].name}</span>)}</div>}
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
      : run.stage === 'crossroads' ? <Crossroads run={run} onChoose={k => setRun(chooseRoad(h, run, k))} onSkip={() => setRun(moveOn(run))} />
      : run.stage === 'shop' ? <Shop h={h} run={run} onRun={setRun} />
      : run.stage === 'event' ? <EventView run={run} onChoose={o => setRun(resolveEvent(h, run, o))} onLeave={() => setRun(moveOn(run))} />
      : run.stage === 'rest' ? <RestView h={h} run={run} onRun={setRun} />
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
      <li><b>Chemistry.</b> Real teammates (Jordan + Pippen '96), the same franchise, players from the stop's era and famous rivals all play better together.</li>
      <li><b>The road.</b> Wins pay coins. After each win choose a road: the shop (players, items that last the hunt, a life), a story with a choice, or a rest stop.</li>
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

function SquadList({ h, run, onRelease, era }: { h: NbaHistory; run: HuntRun; onRelease?: (id: string) => void; era?: ReturnType<typeof eraOf> }) {
  const { cards: withBonus } = squadBonuses(h, run, era);
  const bonusOf = new Map(withBonus.map(c => [c.card.id, c]));
  const cards = withBonus.map(c => c.card).sort((a, b) => b.ovr - a.ovr);
  return <div className="hunt-squad">
    <div className="hunt-squad-head"><h3>Your squad</h3><span>Strength <b>{effectiveStrength(h, run, era)}</b>{effectiveStrength(h, run, era) !== strengthOf(cards) ? <small> (base {strengthOf(cards)})</small> : null} · {cards.length}/{SQUAD_MAX}</span></div>
    <ol>{cards.map((c, i) => { const b = bonusOf.get(c.id)!; return <li key={c.id} className={`rarity-${c.rarity}`}>
      <span className="hunt-squad-ovr">{c.ovr}</span>
      {b.bonus !== 0 ? <span className={`hunt-bonus ${b.bonus > 0 ? 'up' : 'down'}`} title={b.parts.join(', ')}>{b.bonus > 0 ? '+' : ''}{b.bonus}</span> : <span className="hunt-bonus" />}
      <span className="hunt-squad-name">{c.name} <small>'{String(c.end).slice(2)} · {c.pos}{i < 5 ? ' · starter' : ''}</small></span>
      <span className="hunt-squad-cost">{c.cost}</span>
      {onRelease && cards.length > 5 && <button className="link-button" onClick={() => onRelease(c.id)} title="Release to free Legacy Points">Release</button>}
    </li>; })}</ol>
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

function Bonds({ bonds }: { bonds: ChemistryBond[] }) {
  if (!bonds.length) return <p className="hint-text">No chemistry yet: real teammates, the same franchise, three players from the stop's era, or famous rivals all play better together.</p>;
  return <ul className="hunt-bonds">{bonds.map(b => <li key={b.label} className={b.bonus < 0 ? 'down' : ''}><b>{b.bonus > 0 ? '+' : ''}{b.bonus}</b> {b.label} <small>({b.cards.length})</small></li>)}</ul>;
}

function StopTrail({ h, run }: { h: NbaHistory; run: HuntRun }) {
  const teams = useMemo(() => new Map(huntTeams(h).map(t => [t.id, t])), [h]);
  return <ol className="hunt-trail">{run.stops.map((s, i) => { const t = teams.get(s.teamId)!; const era = ERAS.find(e => e.id === s.eraId)!; const res = run.results.filter(r => r.stop === i).at(-1);
    return <li key={s.teamId} className={`${i === run.stopIndex ? 'current' : ''} ${i < run.stopIndex || (res?.won) ? 'done' : ''} ${s.boss ? 'boss' : ''}`}>
      <small>{s.boss ? 'BOSS' : era.label.toUpperCase()}</small><b>{i <= run.stopIndex || s.boss || run.items.includes('scout') ? `${t.end - 1}-${String(t.end).slice(2)} ${t.name}` : '???'}</b>
      <span>{res ? `${res.won ? 'W' : 'L'} ${res.us}-${res.them}` : i <= run.stopIndex || s.boss || run.items.includes('scout') ? `Strength ${t.strength}` : ''}</span>
    </li>; })}</ol>;
}

function MapView({ h, run, onPlay, onRelease, onAbandon }: { h: NbaHistory; run: HuntRun; onPlay: (watch: boolean) => void; onRelease: (id: string) => void; onAbandon: () => void }) {
  const stop = run.stops[run.stopIndex];
  const team = huntTeams(h).find(t => t.id === stop.teamId)!;
  const era = ERAS.find(e => e.id === stop.eraId) ?? eraOf(team.end);
  const pool = cardPool(h);
  const mine = new Set(run.squad.map(id => pool.byId.get(id)?.playerId));
  const theirs = team.roster.map(id => pool.byId.get(id)!).filter(Boolean);
  const mineStrength = effectiveStrength(h, run, era);
  const { bonds } = squadBonuses(h, run, era);
  return <section className="hunt-stage">
    <StopTrail h={h} run={run} />
    <div className="hunt-matchup">
      <div className="hunt-era"><span className="pixel-eyebrow">{stop.boss ? 'THE BOSS' : `STOP ${run.stopIndex + 1} OF ${run.stops.length}`} · {era.label.toUpperCase()}</span>
        <h2>{teamLabel(team)}</h2>
        <p>{team.w}-{team.l}{team.champion ? ' · Champions' : ''} · Strength <b>{team.strength}</b> vs your <b>{mineStrength}</b></p>
        <p className="hunt-era-rules">Era rules: {era.blurb}</p>
        <div className="contest-actions"><button className="primary" onClick={() => onPlay(true)}>Watch the game</button><button onClick={() => onPlay(false)}>Sim it</button></div>
        {run.attempts > 0 && <p className="hint-text">Rematch {run.attempts + 1}. {run.lives} {run.lives === 1 ? 'life' : 'lives'} left.</p>}
        <h3 className="hunt-subhead">Chemistry for this game</h3>
        <Bonds bonds={bonds} />
      </div>
      <div className="hunt-opponent"><h3>Their rotation</h3><ol>{theirs.map(c => <li key={c.id} className={mine.has(c.playerId) ? 'gone' : ''}><span className="hunt-squad-ovr">{c.ovr}</span><span>{c.name} <small>{c.pos}</small></span>{mine.has(c.playerId) && <small>on your squad</small>}</li>)}</ol></div>
    </div>
    <CapBar h={h} run={run} />
    <SquadList h={h} run={run} onRelease={onRelease} era={era} />
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
      <p>Your squad vs {game.away.name} · <span className="hunt-coins">+{game.coins} coins</span></p>
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
    <button onClick={() => onTake(null)}>Skip the card</button>
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

const ROAD: Record<NodeKind, { title: string; blurb: string; icon: string }> = {
  shop: { title: 'The Shop', blurb: 'Spend coins on new cards, items that last the whole hunt, or a life.', icon: '●' },
  event: { title: 'A Story', blurb: 'Something happens on the road. Every choice has a price or a prize.', icon: '?' },
  rest: { title: 'Rest Stop', blurb: 'Win back a life, or put a player through two points of training.', icon: '♥' },
};

function Crossroads({ run, onChoose, onSkip }: { run: HuntRun; onChoose: (k: NodeKind) => void; onSkip: () => void }) {
  return <section className="hunt-stage">
    <div><span className="pixel-eyebrow">THE ROAD TO STOP {run.stopIndex + 2}{run.stops[run.stopIndex + 1]?.boss ? ' · THE BOSS' : ''}</span><h2>Choose your road</h2></div>
    <div className="hunt-roads">{(run.crossroads ?? []).map(k => <button key={k} className={`hunt-road road-${k}`} onClick={() => onChoose(k)}>
      <span className="hunt-road-icon" aria-hidden="true">{ROAD[k].icon}</span><b>{ROAD[k].title}</b><span>{ROAD[k].blurb}</span></button>)}</div>
    <button className="link-button" onClick={onSkip}>Take neither: straight to the next game</button>
  </section>;
}

function Shop({ h, run, onRun }: { h: NbaHistory; run: HuntRun; onRun: (r: HuntRun) => void }) {
  const pool = cardPool(h);
  const shop = run.shop!;
  const [choice, setChoice] = useState<string | null>(null);
  const squad = run.squad.map(id => pool.byId.get(id)!).sort((a, b) => a.ovr - b.ovr);
  const card = choice ? pool.byId.get(choice)! : null;
  return <section className="hunt-stage">
    <div className="hunt-stage-head"><div><span className="pixel-eyebrow">THE SHOP · <span className="hunt-coins">{run.coins}</span> COINS</span><h2>Spend your coins</h2></div><CapBar h={h} run={run} /></div>
    {run.note && <p className="hunt-note" role="status">{run.note}</p>}
    <h3 className="hunt-subhead">Players</h3>
    <div className="hunt-offer hunt-offer-4">{shop.cards.map(id => { const sold = shop.sold.includes(id), price = cardPrice(h, id); return <Card key={id} card={pool.byId.get(id)!} disabled={sold || run.coins < price} onClick={() => setChoice(id)} action={sold ? 'Signed' : choice === id ? 'Selected' : `${price} coins`} />; })}</div>
    {card && !shop.sold.includes(card.id) && <div className="hunt-reward-place">
      {run.squad.length < SQUAD_MAX && affordable(h, run, card.id) && <button className="primary" onClick={() => { onRun(buyCard(h, run, card.id)); setChoice(null); }}>Sign {card.name} ({cardPrice(h, card.id)} coins)</button>}
      <p>{run.squad.length < SQUAD_MAX && affordable(h, run, card.id) ? 'Or sign him in place of:' : 'Sign him in place of:'}</p>
      <div className="hunt-replace">{squad.map(c => <button key={c.id} disabled={!affordable(h, run, card.id, c.id)} onClick={() => { onRun(buyCard(h, run, card.id, c.id)); setChoice(null); }}>{c.ovr} {c.name} '{String(c.end).slice(2)} <small>{c.cost} LP</small></button>)}</div>
    </div>}
    <h3 className="hunt-subhead">Items <small>{run.items.length}/{MAX_ITEMS}</small></h3>
    <div className="hunt-items">{shop.items.map(i => { const it = ITEMS[i], sold = shop.sold.includes(i); return <button key={i} className="hunt-item" disabled={sold || run.coins < it.price || run.items.length >= MAX_ITEMS} onClick={() => onRun(buyItem(run, i))}>
      <b>{it.name}</b><span>{it.blurb}</span><small>{sold ? 'Bought' : `${it.price} coins`}</small></button>; })}
      <button className="hunt-item" disabled={!!shop.lifeBought || run.lives >= START_LIVES || run.coins < LIFE_PRICE} onClick={() => onRun(buyLife(run))}><b>♥ A life</b><span>Get back one lost life (once per shop).</span><small>{shop.lifeBought ? 'Bought' : `${LIFE_PRICE} coins`}</small></button>
    </div>
    <button className="primary" onClick={() => onRun(moveOn(run))}>Leave the shop</button>
    <SquadList h={h} run={run} onRelease={id => onRun(releaseCard(run, id))} />
  </section>;
}

function EventView({ run, onChoose, onLeave }: { run: HuntRun; onChoose: (optionId: string) => void; onLeave: () => void }) {
  const ev = run.eventId ? EVENTS[run.eventId] : null;
  return <section className="hunt-stage">
    <div><span className="pixel-eyebrow">ON THE ROAD · <span className="hunt-coins">{run.coins}</span> COINS</span><h2>{ev ? ev.title : 'What happened'}</h2></div>
    {ev ? <><p className="hunt-lede">{ev.text}</p>
      <div className="hunt-roads">{ev.options.map(o => <button key={o.id} className="hunt-road" onClick={() => onChoose(o.id)}><b>{o.label}</b><span>{o.detail}</span></button>)}</div></>
      : <><p className="hunt-note" role="status">{run.note}</p><button className="primary" onClick={onLeave}>On to the next game</button></>}
  </section>;
}

function RestView({ h, run, onRun }: { h: NbaHistory; run: HuntRun; onRun: (r: HuntRun) => void }) {
  const pool = cardPool(h);
  const cards = run.squad.map(id => pool.byId.get(id)!).sort((a, b) => b.ovr - a.ovr);
  return <section className="hunt-stage">
    <div><span className="pixel-eyebrow">REST STOP</span><h2>Recover or train</h2></div>
    <div className="hunt-roads">
      <button className="hunt-road road-rest" disabled={run.lives >= START_LIVES} onClick={() => onRun(rest(run, { heal: true }))}><span className="hunt-road-icon">♥</span><b>Recover</b><span>{run.lives >= START_LIVES ? 'All your lives are full.' : 'Win back one life.'}</span></button>
    </div>
    <h3 className="hunt-subhead">Or train one player (+2, up to +{MAX_TRAINING})</h3>
    <div className="hunt-replace">{cards.map(c => { const t = run.boosts[c.id] ?? 0; return <button key={c.id} disabled={t >= MAX_TRAINING} onClick={() => onRun(rest(run, { train: c.id }))}>{c.ovr} {c.name} '{String(c.end).slice(2)}{t ? <small> (+{t})</small> : null}</button>; })}</div>
    <button className="link-button" onClick={() => onRun(moveOn(run))}>Skip the rest stop</button>
  </section>;
}
