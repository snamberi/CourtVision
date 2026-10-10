import { useEffect, useRef, useState } from 'react';
import type { NbaHistory } from '../../history/nbaHistoryData';
import { cardPool, seasonLabel, type HuntCard } from '../../hunt/cards';
import { huntTeams, teamLabel } from '../../hunt/teams';
import { eraOf } from '../../hunt/eras';
import { todayUtc } from '../../hunt/storage';
import {
  newSurvivalRun, keepTen, tagFranchise, playRound, answerClaim, signPlayer, opponentOf, survivalRating, wins, roundNo, isBossRound,
  survivalScore, survivalShareText, opponentRating, oppLift, loadSurvivalRun, saveSurvivalRun, loadSurvivalRecords, recordSurvival, dailySeed, targetStrength,
  SURVIVAL_LEVELS, ROSTER, BOSS_EVERY, MAX_SHIELDS, type SurvivalRun, type SurvivalRecords, type SurvivalLevel,
} from '../../survival/run';
import { PlayerAvatar } from '../PlayerAvatar';
import { PixelIcon } from '../PixelIcon';
import { ShareCardButton } from '../ShareCardButton';
import { track, trackOnce } from '../../analytics/track';
import { noteWeekRun } from '../../retention/weekLog';
import '../hunt/hunt.css';
import './survival.css';

const SITE = 'https://courtvisiongame.com';
const posColor: Record<string, string> = { PG: '#4da3ff', SG: '#55c878', SF: '#ffd166', PF: '#f47b20', C: '#e85d5d', G: '#4da3ff', F: '#f47b20' };
const newSeed = () => Math.floor(Math.random() * 1_000_000_000);

/** Survival: start with legends, pay a player for every win, and see how long you last. */
export function Survival({ onExit }: { onExit: () => void }) {
  const [h, setH] = useState<NbaHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [run, setRunState] = useState<SurvivalRun | null>(loadSurvivalRun);
  const [records, setRecords] = useState<SurvivalRecords>(loadSurvivalRecords);
  const current = useRef(run);
  useEffect(() => {
    let live = true;
    import('../../history/nbaHistoryData').then(m => m.loadNbaHistory()).then(d => { if (live) setH(d); }, e => { if (live) setError(e instanceof Error ? e.message : String(e)); });
    return () => { live = false; };
  }, []);
  const setRun = (r: SurvivalRun | null) => {
    const prev = current.current;
    current.current = r;
    setRunState(r);
    saveSurvivalRun(r);
    if (r && r.stage === 'over' && prev?.stage !== 'over') {
      setRecords(recordSurvival(r));
      const w = wins(r);
      noteWeekRun('survival', { score: survivalScore(r), line: `${w} win${w === 1 ? '' : 's'}` }, `surv-${r.seed}-${r.level}`);
      trackOnce(`surv-${r.seed}-${r.level}`, 'mode_finish', { mode: 'survival', level: r.level, daily: !!r.daily, wins: w });
    }
  };
  const start = (level: SurvivalLevel, daily?: string) => {
    if (!h) return;
    track('mode_start', { mode: 'survival', level, daily: !!daily });
    setRun(newSurvivalRun(h, daily ? dailySeed(daily) : newSeed(), daily ? 'pro' : level, daily));
  };

  const header = <header className="hunt-top">
    <button className="hunt-exit" onClick={onExit}><PixelIcon name="exit" size={16} /> Main Menu</button>
    <div className="hunt-title"><span className="pixel-eyebrow">{run && run.stage !== 'over' ? `ROUND ${roundNo(run)} · ${SURVIVAL_LEVELS[run.level].name.toUpperCase()}${run.daily ? ' · DAILY' : ''}` : 'LAST TEAM STANDING'}</span><h1>Survival</h1></div>
    {run && run.stage !== 'over' && <button className="hunt-exit" onClick={() => { if (window.confirm('Give up this run? It will not count.')) setRun(null); }}>Give up</button>}
  </header>;
  if (error) return <div className="hunt surv">{header}<p className="empty-state">Could not load the NBA history data: {error}</p></div>;
  if (!h) return <div className="hunt surv">{header}<p className="empty-state">Loading 80 years of basketball…</p></div>;
  return <div className="hunt surv">
    {header}
    {!run ? <Hub records={records} onStart={start} />
      : run.stage === 'draft' ? <DraftView h={h} run={run} onKeep={ids => setRun(keepTen(run, ids))} />
      : run.stage === 'tag' ? <TagView h={h} run={run} onTag={id => setRun(tagFranchise(h, run, id))} />
      : run.stage === 'pregame' ? <Pregame h={h} run={run} onPlay={() => setRun(playRound(h, run))} />
      : run.stage === 'claim' ? <ClaimView h={h} run={run} onAnswer={shield => setRun(answerClaim(h, run, shield))} />
      : run.stage === 'sign' ? <SignView h={h} run={run} onSign={id => setRun(signPlayer(h, run, id))} />
      : <Over h={h} run={run} records={records} onNew={() => setRun(null)} onExit={onExit} />}
  </div>;
}

function CardTile({ c, selected, franchise, onClick, small }: { c: HuntCard; selected?: boolean; franchise?: boolean; onClick?: () => void; small?: boolean }) {
  const body = <>
    <PlayerAvatar playerId={c.name} primaryColor={posColor[c.pos] ?? '#f47b20'} secondaryColor="#f4f0e6" size={small ? 36 : 48} mode="portrait" />
    <span className="surv-card-text"><b>{franchise && <PixelIcon name="crown" size={12} />} {c.name}</b><small>{seasonLabel(c.end)} · {c.team} · {c.pos}</small><small>{c.ppg} PTS · {c.rpg} REB · {c.apg} AST</small></span>
    <span className={`hunt-reel-ovr rarity-${c.rarity}`}>{c.ovr}</span>
  </>;
  return onClick
    ? <button className={`surv-card rarity-${c.rarity} ${selected ? 'selected' : ''} ${small ? 'small' : ''}`} aria-pressed={selected} onClick={onClick}>{body}</button>
    : <div className={`surv-card rarity-${c.rarity} ${franchise ? 'franchise' : ''} ${small ? 'small' : ''}`}>{body}</div>;
}

function Hub({ records, onStart }: { records: SurvivalRecords; onStart: (level: SurvivalLevel, daily?: string) => void }) {
  const [level, setLevel] = useState<SurvivalLevel>('pro');
  const today = todayUtc(), doneToday = records.daily[today];
  return <section className="hunt-stage surv-hub">
    <div className="surv-pitch">
      <span className="pixel-eyebrow">HOW LONG CAN YOU LAST?</span>
      <h2>Start with legends. Every win costs you one.</h2>
      <ol className="surv-rules">
        <li><b>Draft:</b> fourteen all-time greats are dealt. Keep ten.</li>
        <li><b>Franchise Player:</b> tag one. Nobody can ever take him.</li>
        <li><b>Play:</b> one game against a real team from NBA history, under that era's rules. Opponents get tougher every round.</li>
        <li><b>Pay the price:</b> win, and the team you beat claims one of your best. You sign one of theirs.</li>
        <li><b>Bosses:</b> every {BOSS_EVERY}th round is a real champion. Beat it for a Shield, which blocks a claim (up to {MAX_SHIELDS}).</li>
        <li><b>One loss and it's over.</b></li>
      </ol>
    </div>
    <div className="cv-panel">
      <h3 className="hunt-subhead">Difficulty</h3>
      <div className="hunt-replace" role="radiogroup" aria-label="Difficulty">{(Object.keys(SURVIVAL_LEVELS) as SurvivalLevel[]).map(l => <button key={l} role="radio" aria-checked={level === l} className={level === l ? 'active' : ''} onClick={() => setLevel(l)}>{SURVIVAL_LEVELS[l].name} <small>×{SURVIVAL_LEVELS[l].mult}</small></button>)}</div>
      <p className="hint-text">{SURVIVAL_LEVELS[level].blurb}</p>
      <div className="contest-actions">
        <button className="primary hunt-play" onClick={() => onStart(level)}><PixelIcon name="play" size={16} /> Start a run</button>
        <button onClick={() => onStart('pro', today)} disabled={!!doneToday}>{doneToday ? `Daily Survival done: ${doneToday.wins} wins` : 'Daily Survival (same for everyone today)'}</button>
      </div>
    </div>
    <div className="hunt-over-stats surv-records">
      <div><small>RUNS</small><b>{records.runs}</b></div>
      {(Object.keys(SURVIVAL_LEVELS) as SurvivalLevel[]).map(l => <div key={l}><small>BEST {SURVIVAL_LEVELS[l].name.toUpperCase()}</small><b>{records.best[l]?.wins ?? 0}</b></div>)}
      <div><small>BOSSES BEATEN</small><b>{records.bossesBeaten}</b></div>
    </div>
  </section>;
}

function DraftView({ h, run, onKeep }: { h: NbaHistory; run: SurvivalRun; onKeep: (ids: string[]) => void }) {
  const pool = cardPool(h);
  const [keep, setKeep] = useState<string[]>(() => run.dealt.slice(0, ROSTER));
  const toggle = (id: string) => setKeep(k => (k.includes(id) ? k.filter(x => x !== id) : k.length < ROSTER ? [...k, id] : k));
  const guards = keep.filter(id => pool.byId.get(id)!.pos.includes('G')).length, bigs = keep.filter(id => pool.byId.get(id)!.pos.includes('C')).length;
  return <section className="hunt-stage">
    <div className="hunt-next"><span className="pixel-eyebrow">THE DEAL · KEEP {ROSTER} OF {run.dealt.length}</span><h2>Your legends</h2>
      <small>Team rating {survivalRating(h, keep)} · {keep.length}/{ROSTER} kept · {guards} guards · {bigs} centers</small></div>
    <p className="hint-text">Every win costs you one of your best, so depth matters as much as stars. Positions matter too: a team with no center gets punished on the boards.</p>
    <div className="surv-grid">{run.dealt.map(id => <CardTile key={id} c={pool.byId.get(id)!} selected={keep.includes(id)} onClick={() => toggle(id)} />)}</div>
    <div className="contest-actions"><button className="primary hunt-play" disabled={keep.length !== ROSTER} onClick={() => onKeep(keep)}>Keep these {keep.length}</button></div>
  </section>;
}

function TagView({ h, run, onTag }: { h: NbaHistory; run: SurvivalRun; onTag: (id: string) => void }) {
  const pool = cardPool(h);
  return <section className="hunt-stage">
    <div className="hunt-next"><span className="pixel-eyebrow">FRANCHISE TAG</span><h2>Who can never be taken?</h2>
      <small>Your Franchise Player stays with you for the whole run. Everyone else is up for grabs.</small></div>
    <div className="surv-grid">{run.roster.map(id => <CardTile key={id} c={pool.byId.get(id)!} onClick={() => onTag(id)} />)}</div>
  </section>;
}

function Strip({ run }: { run: SurvivalRun }) {
  if (!run.games.length) return null;
  return <ol className="surv-strip" aria-label="Your run so far">{run.games.map(g => <li key={g.round} className={g.won ? (g.boss ? 'boss' : 'won') : 'lost'} title={`Round ${g.round}: ${g.won ? 'W' : 'L'} ${g.us}-${g.them} vs ${g.oppName}`}>{g.boss ? <PixelIcon name="crown" size={10} /> : g.round}</li>)}</ol>;
}

function Pregame({ h, run, onPlay }: { h: NbaHistory; run: SurvivalRun; onPlay: () => void }) {
  const pool = cardPool(h);
  const opp = opponentOf(h, run)!;
  const era = eraOf(opp.end);
  const round = roundNo(run), boss = isBossRound(round);
  const ours = survivalRating(h, run.roster), them = opponentRating(h, run);
  const mine = new Set(run.roster.map(id => pool.byId.get(id)!.playerId));
  const theirs = opp.roster.map(id => pool.byId.get(id)!).filter(c => c && !mine.has(c.playerId)).slice(0, ROSTER);
  const roster = run.roster.map(id => pool.byId.get(id)!).sort((a, b) => b.ovr - a.ovr);
  const odds = ours - them;
  return <section className="hunt-stage">
    <Strip run={run} />
    <div className={`hunt-next ${boss ? 'hunt-next-boss' : ''}`}>
      <span className="pixel-eyebrow">ROUND {round}{boss ? ' · BOSS · A REAL CHAMPION' : ''} · {era.label.toUpperCase()}</span>
      <h2>{teamLabel(opp)}</h2>
      <small>{opp.w}-{opp.l}{opp.champion ? ' · Champions' : ''} · {wins(run)} win{wins(run) === 1 ? '' : 's'} so far · <PixelIcon name="star" size={12} /> {run.shields} shield{run.shields === 1 ? '' : 's'}</small>
    </div>
    <div className="hunt-versus-bar"><div><small>YOU</small><b className="hunt-rating">{ours}</b></div>
      <button className="primary hunt-play-big" onClick={onPlay}><PixelIcon name="play" size={22} /> PLAY</button>
      <div><small>THEM</small><b className="hunt-rating">{them}</b></div></div>
    <p className="hint-text hunt-odds">{odds >= 4 ? 'You are the favourite.' : odds <= -4 ? 'You are the underdog. One game: anything can happen.' : 'A coin flip.'} Era rules: {era.blurb}</p>
    <div className="surv-two">
      <div><h3 className="hunt-subhead">Your ten</h3><div className="surv-list">{roster.map(c => <CardTile key={c.id} c={c} small franchise={c.id === run.franchise} />)}</div></div>
      <div><h3 className="hunt-subhead">Their rotation</h3><ol className="hunt-their">{theirs.map(c => <li key={c.id}><b>{c.ovr}</b> {c.name} <small>{c.pos}</small></li>)}</ol>
        <p className="hint-text">{oppLift(round) ? `They play +${oppLift(round)} harder this deep into a run. ` : ''}Next round's teams are around {Math.round(targetStrength(round + 1, run.level) + oppLift(round + 1))}.</p></div>
    </div>
  </section>;
}

function LastGame({ run }: { run: SurvivalRun }) {
  const g = run.games.at(-1)!;
  return <div className={`hunt-result ${g.won ? 'won' : 'lost'}`}>
    <span className="pixel-eyebrow">ROUND {g.round}{g.boss ? ' · BOSS' : ''} · FINAL</span>
    <h2>{g.won ? 'W' : 'L'} {g.us}-{g.them} vs {g.oppName}</h2>
    {g.top && <p>Top scorer: {g.top}{g.boss && g.won ? ' · Boss beaten: +1 Shield' : ''}</p>}
  </div>;
}

function ClaimView({ h, run, onAnswer }: { h: NbaHistory; run: SurvivalRun; onAnswer: (shield: boolean) => void }) {
  const pool = cardPool(h);
  const c = pool.byId.get(run.claim!.cardId)!;
  const opp = huntTeams(h).find(t => t.id === run.games.at(-1)!.oppId);
  const canShield = run.shields > 0 && !run.games.at(-1)!.shielded;
  return <section className="hunt-stage">
    <Strip run={run} />
    <LastGame run={run} />
    <div className="surv-claim">
      <span className="pixel-eyebrow">THE PRICE OF VICTORY</span>
      <h2>{opp ? `The ${opp.name}` : 'They'} claim {c.name}</h2>
      <CardTile c={c} />
      {run.games.at(-1)!.shielded && <p className="hint-text">You shielded {pool.byId.get(run.games.at(-1)!.shielded!)?.name}, so they took their next choice.</p>}
      <div className="contest-actions">
        <button className="primary" onClick={() => onAnswer(false)}>Let him go</button>
        <button disabled={!canShield} onClick={() => onAnswer(true)}><PixelIcon name="star" size={14} /> Use a shield ({run.shields} left)</button>
      </div>
    </div>
  </section>;
}

function SignView({ h, run, onSign }: { h: NbaHistory; run: SurvivalRun; onSign: (id: string | null) => void }) {
  const pool = cardPool(h);
  const lost = pool.byId.get(run.games.at(-1)!.lost!);
  return <section className="hunt-stage">
    <Strip run={run} />
    <div className="hunt-next"><span className="pixel-eyebrow">SIGN ONE OF THEIRS</span><h2>Replace {lost?.name ?? 'him'}</h2>
      <small>Team rating now {survivalRating(h, run.roster)} with {run.roster.length} players.</small></div>
    <div className="surv-grid">{run.claim!.offer.map(id => <CardTile key={id} c={pool.byId.get(id)!} onClick={() => onSign(id)} />)}</div>
    <button className="link-button" onClick={() => onSign(null)}>Sign nobody (play with {run.roster.length})</button>
  </section>;
}

function Over({ h, run, records, onNew, onExit }: { h: NbaHistory; run: SurvivalRun; records: SurvivalRecords; onNew: () => void; onExit: () => void }) {
  const pool = cardPool(h);
  const [copied, setCopied] = useState(false);
  const w = wins(run), bosses = run.games.filter(g => g.won && g.boss).length, score = survivalScore(run);
  const last = run.games.at(-1);
  const best = records.best[run.level];
  const text = survivalShareText(run, SITE);
  const name = (id?: string) => (id ? pool.byId.get(id)?.name ?? id : '');
  const franchise = run.franchise ? pool.byId.get(run.franchise) : undefined;
  return <section className={`hunt-stage hunt-over ${w >= 10 ? 'won' : 'lost'}`}>
    <div className="hunt-over-banner">
      <span className="pixel-eyebrow">RUN OVER · {SURVIVAL_LEVELS[run.level].name.toUpperCase()}{run.daily ? ` · DAILY ${run.daily}` : ''}</span>
      <h2>You lasted {w} round{w === 1 ? '' : 's'}</h2>
      {last && !last.won && <p>Knocked out {last.us}-{last.them} by the {last.oppName}.</p>}
      <div className="hunt-over-stats">
        <div><small>WINS</small><b>{w}</b></div><div><small>BOSSES</small><b>{bosses}</b></div><div><small>SCORE</small><b>{score.toLocaleString()}</b></div>
        <div><small>BEST</small><b>{best?.wins ?? w}</b></div>
      </div>
    </div>
    <Strip run={run} />
    {franchise && <div className="hunt-mvp"><PlayerAvatar playerId={franchise.name} primaryColor="#f47b20" secondaryColor="#f4f0e6" size={72} />
      <div><span className="pixel-eyebrow">FRANCHISE PLAYER</span><strong>{franchise.name}</strong><span>{seasonLabel(franchise.end)} · there to the end</span></div></div>}
    <ol className="hunt-log">{run.games.map(g => <li key={g.round} className={g.won ? 'won' : 'lost'}>{g.won ? 'W' : 'L'} {g.us}-{g.them} vs {g.oppName}{g.boss ? ' (boss)' : ''}
      {g.lost && <small> · lost {name(g.lost)}{g.signed ? `, signed ${name(g.signed)}` : ''}{g.shielded ? ` · shielded ${name(g.shielded)}` : ''}</small>}</li>)}</ol>
    <div className="contest-actions">
      <button className="primary" onClick={onNew}>New run</button>
      <ShareCardButton tall fileName="survival.png" text={text} spec={{
        kicker: `Survival · ${SURVIVAL_LEVELS[run.level].name}${run.daily ? ` · Daily ${run.daily}` : ''}`,
        title: `Lasted ${w} round${w === 1 ? '' : 's'}`,
        subtitle: last && !last.won ? `Knocked out by the ${last.oppName}` : undefined,
        stats: [{ label: 'Wins', value: String(w) }, { label: 'Bosses', value: String(bosses) }, { label: 'Score', value: score.toLocaleString() }],
        lines: run.games.slice(-6).map(g => `${g.won ? 'W' : 'L'} ${g.us}-${g.them} vs ${g.oppName}`),
        avatar: franchise ? { playerId: franchise.name } : undefined, accent: w >= 10 ? 'gold' : 'red',
      }} />
      <button onClick={() => navigator.clipboard?.writeText(text).then(() => setCopied(true), () => setCopied(false))}>{copied ? 'Copied!' : 'Copy as text'}</button>
      <button onClick={onExit}>Main Menu</button>
    </div>
  </section>;
}
