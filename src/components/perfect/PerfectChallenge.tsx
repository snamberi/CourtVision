import { useEffect, useMemo, useRef, useState } from 'react';
import type { NbaHistory } from '../../history/nbaHistoryData';
import { cardPool, seasonLabel, RARITY_LABEL, type HuntCard } from '../../hunt/cards';
import { huntTeams, teamLabel } from '../../hunt/teams';
import { COACH_STYLE, coachRarity } from '../../hunt/coaches';
import {
  newPerfectRun, pickPlayer, quickSpinCard, reelFiller, rerollTeam, rerollEra, applyPrime, pickCoach, playNext, rollPool, franchiseName, eraById, teamBonds,
  perfectRating, teamRating, summary, verdict, BOSS_TEAMS, QUICK_SLOTS, QUICK_SLOT_LABEL, SQUAD, SEASON_GAMES, ROUND_NAMES, WINS_NEEDED, SCORE, COACH_BY_ID,
  type PerfectRun, type PerfectMode, type PerfectGame,
} from '../../perfect/run';
import { loadPerfectRun, savePerfectRun, loadPerfectRecords, recordPerfect, dailyPerfect, type PerfectRecords } from '../../perfect/storage';
import { todayUtc } from '../../hunt/storage';
import { teamColors } from '../../simulation/teamColors';
import { FEATS_EVENT } from '../../profile/feats';
import { track, trackOnce } from '../../analytics/track';
import { PlayerAvatar } from '../PlayerAvatar';
import { PixelIcon } from '../PixelIcon';
import { ShareCardButton } from '../ShareCardButton';
import { FramedAvatar } from '../AvatarFrame';
import { useAvatar } from '../UserAvatar';
import '../hunt/hunt.css';
import { noteFeaturedXp } from '../../retention/modeOfWeek';
import { perfectRunXp } from '../../profile/profile';
import './perfect.css';

const POS_COLOR: Record<string, string> = { PG: '#4da3ff', SG: '#55c878', SF: '#f47b20', PF: '#b983ff', C: '#e85d5d', G: '#4da3ff', F: '#f47b20' };
const MODE_INFO: Record<PerfectMode, { name: string; blurb: string; icon: string }> = {
  quick: { name: 'Quick Spin', icon: 'play', blurb: 'Ten spins and a coach spin. Five starters by position, five off the bench. What the reel lands on is yours.' },
  franchise: { name: 'Franchise Spin', icon: 'team', blurb: 'Each spin rolls a franchise and an era. Pick ONE player from everyone who played there. One team reroll, one era reroll, one Absolute Prime boost.' },
};

/** The 82-0 Challenge: build a team, play all 82, then the playoffs. The goal: 82-0 and 16-0. */
export function PerfectChallenge({ onExit }: { onExit: () => void }) {
  const [h, setH] = useState<NbaHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [run, setRunState] = useState<PerfectRun | null>(() => loadPerfectRun());
  const [records, setRecords] = useState<PerfectRecords>(() => loadPerfectRecords());
  useEffect(() => {
    let live = true;
    import('../../history/nbaHistoryData').then(m => m.loadNbaHistory()).then(d => { if (live) setH(d); }, e => { if (live) setError(e instanceof Error ? e.message : String(e)); });
    return () => { live = false; };
  }, []);
  const current = useRef(run);
  const setRun = (r: PerfectRun | null) => {
    const prev = current.current;
    current.current = r;
    setRunState(r);
    savePerfectRun(r);
    if (r && r.stage === 'done' && prev?.stage !== 'done') {
      setRecords(recordPerfect(r));
      const s = summary(r);
      noteFeaturedXp('perfect', `p820-${r.seed}-${r.mode}`, perfectRunXp({ champion: s.champion, perfectSeason: s.perfectSeason, perfect98: s.perfectSeason && s.perfectPlayoffs, daily: !!r.daily }));
      window.dispatchEvent(new Event(FEATS_EVENT));
      trackOnce(`p820-${r.seed}-${r.mode}`, 'mode_finish', { mode: 'perfect', variant: r.mode, daily: !!r.daily, wins: s.w, champion: s.champion });
    }
  };
  const start = (mode: PerfectMode, seed: number, daily?: string) => {
    if (!h) return;
    track('mode_start', { mode: 'perfect', variant: daily ? 'daily' : mode });
    setRun(newPerfectRun(h, mode, seed, daily));
  };

  const header = <header className="hunt-top">
    <button className="hunt-exit" onClick={onExit}><PixelIcon name="exit" size={16} /> Main Menu</button>
    <div className="hunt-title"><span className="pixel-eyebrow">{run ? (run.from === 'hunt' ? 'HUNT SQUAD · BONUS RUN' : `${MODE_INFO[run.mode].name.toUpperCase()}${run.daily ? ' · DAILY' : ''}`) : 'BUILD A TEAM · PLAY ALL 82'}</span><h1>82-0 Challenge</h1></div>
    {run && run.stage !== 'done' && <button className="hunt-exit" onClick={() => { if (window.confirm('Give up this run? It will not count.')) setRun(null); }}>Give up</button>}
  </header>;
  if (error) return <div className="hunt p820">{header}<p className="empty-state">Could not load the NBA history data: {error}</p></div>;
  if (!h) return <div className="hunt p820">{header}<p className="empty-state">Loading 80 years of basketball…</p></div>;
  return <div className="hunt p820">
    {header}
    {!run ? <Hub records={records} onStart={start} />
      : run.stage === 'draft' ? (run.mode === 'quick' ? <QuickDraft h={h} run={run} setRun={setRun} /> : <FranchiseDraft h={h} run={run} setRun={setRun} />)
      : run.stage === 'coach' ? <CoachPick h={h} run={run} setRun={setRun} />
      : run.stage === 'done' ? <Finished h={h} run={run} records={records} onAgain={() => setRun(null)} />
      : <Season h={h} run={run} setRun={setRun} />}
  </div>;
}

// ---------------------------------------------------------------- the hub

function Hub({ records, onStart }: { records: PerfectRecords; onStart: (mode: PerfectMode, seed: number, daily?: string) => void }) {
  const today = todayUtc(), daily = dailyPerfect(today), todayBest = records.daily?.[today];
  return <section className="p820-hub">
    <div className="p820-hero"><span className="p820-goal">82-0</span><span className="p820-goal-plus">+ 16-0</span>
      <p>Build a ten-man team from all of NBA history, play a full 82-game season against real teams from every era, then four playoff rounds. Bosses on the schedule: {BOSS_TEAMS.map(b => b.tag).join(', ')}.</p></div>
    <div className="p820-modes">
      {(['quick', 'franchise'] as PerfectMode[]).map(m => <button key={m} className="p820-mode" onClick={() => onStart(m, Math.floor(Math.random() * 1_000_000_000))}>
        <span className="hunt-mode-icon"><PixelIcon name={MODE_INFO[m].icon} size={24} /></span><b>{MODE_INFO[m].name}</b><small>{MODE_INFO[m].blurb}</small><em>Start</em></button>)}
      <button className="p820-mode p820-daily" onClick={() => onStart(daily.mode, daily.seed, today)}>
        <span className="hunt-mode-icon"><PixelIcon name="calendar" size={24} /></span><b>Daily 82-0</b>
        <small>Today: {MODE_INFO[daily.mode].name}. The same spins for everyone; your best try counts on the weekly board.</small>
        <em>{todayBest ? `Best today: ${todayBest.w}-${todayBest.l} · ${todayBest.score.toLocaleString()}` : 'Play today'}</em></button>
    </div>
    <div className="p820-records">
      <span><b>{records.best ? `${records.best.w}-${records.best.l}` : '—'}</b><small>Best record</small></span>
      <span><b>{records.best?.score.toLocaleString() ?? '—'}</b><small>Best score</small></span>
      <span><b>{records.titles}</b><small>Titles</small></span>
      <span><b>{records.perfectSeasons}</b><small>82-0 seasons</small></span>
      <span><b>{records.runs}</b><small>Runs</small></span>
      {records.huntSquadBest && <span><b>{records.huntSquadBest.w}-{records.huntSquadBest.l}</b><small>Best Hunt squad</small></span>}
    </div>
    <details className="hunt-how"><summary>How scoring and rewards work</summary>
      <ul>
        <li>Every win: {SCORE.win} points plus the margin (up to {SCORE.marginCap}). Beating a boss team: +{SCORE.boss}.</li>
        <li>Playoff win: +{SCORE.playoffWin}; a sweep: +{SCORE.sweep}; the title: +{SCORE.title.toLocaleString()}.</li>
        <li>82-0: +{SCORE.perfectSeason.toLocaleString()}. 16-0 in the playoffs too: another +{SCORE.perfectPlayoffs.toLocaleString()}.</li>
        <li>Lineups matter: start a guard and a big, and don't stack three at one position. Real teammates, franchise-mates and famous rivals add chemistry.</li>
        <li>Every game is played under the rules of the opponent's era, and ratings are ranked within each season, so a 1965 star and a 2016 star stand on the same scale.</li>
        <li>Rewards: the <b>Undefeated</b> title and profile frame for 82-0; the gold <b>Perfection</b> title and frame for 98-0. Trophy Road points for your best season, titles and perfect seasons.</li>
      </ul></details>
  </section>;
}

// ---------------------------------------------------------------- cards and the squad

function CardTile({ c, onPick, prime }: { c: HuntCard; onPick?: () => void; prime?: boolean }) {
  const body = <>
    <PlayerAvatar playerId={c.name} primaryColor={POS_COLOR[c.pos] ?? '#f47b20'} secondaryColor="#f4f0e6" size={44} mode="portrait" />
    <span className="p820-card-text"><b>{c.name}</b><small>{seasonLabel(c.end)} · {c.team} · {c.pos}</small><i>{c.ppg} pts · {c.rpg} reb · {c.apg} ast</i></span>
    <span className={`p820-ovr rarity-${c.rarity}`} title={RARITY_LABEL[c.rarity]}>{c.ovr}</span>
    {prime && <em className="p820-prime-tag">PRIME</em>}
  </>;
  return onPick ? <button className={`p820-card rarity-${c.rarity}`} onClick={onPick}>{body}</button> : <div className={`p820-card rarity-${c.rarity}`}>{body}</div>;
}

function SquadPanel({ h, run }: { h: NbaHistory; run: PerfectRun }) {
  const pool = cardPool(h);
  const bonds = teamBonds(h, run);
  return <aside className="p820-squad">
    <h3>Your team <small>{run.squad.length}/{SQUAD}</small></h3>
    <ol>{Array.from({ length: SQUAD }, (_, i) => { const c = run.squad[i] ? pool.byId.get(run.squad[i]) : undefined; return <li key={i} className={c ? `rarity-${c.rarity}` : 'empty'}>
      <span className="p820-slot">{run.mode === 'quick' && run.from !== 'hunt' ? QUICK_SLOTS[i] : run.from === 'hunt' && i < 6 ? 'HUNT' : i < 5 ? 'START' : 'BENCH'}</span>
      {c ? <><b>{c.name}</b><small>{seasonLabel(c.end)} {c.team} · {c.pos}</small><span className="p820-ovr-mini">{c.ovr}</span></> : <small>—</small>}</li>; })}</ol>
    {run.squad.length >= 5 && <p className="p820-rating">Team rating <b>{perfectRating(h, run)}</b> <small>(100 = a 68-win team)</small></p>}
    {bonds.length > 0 && <ul className="p820-bonds">{bonds.map((b, i) => <li key={i} className={b.bonus < 0 ? 'bad' : 'good'}>{b.bonus > 0 ? '+' : ''}{b.bonus} · {b.label}</li>)}</ul>}
  </aside>;
}

// ---------------------------------------------------------------- Quick Spin

function QuickDraft({ h, run, setRun }: { h: NbaHistory; run: PerfectRun; setRun: (r: PerfectRun) => void }) {
  const slot = QUICK_SLOTS[run.squad.length];
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState<HuntCard | null>(null);
  const target = useMemo(() => quickSpinCard(h, run), [h, run]);
  const strip = useMemo(() => [...reelFiller(h, 14, run.seed + run.squad.length), target], [h, run.seed, run.squad.length, target]);
  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => { setSpinning(false); setLanded(target); }, reduce ? 50 : 1300);
  };
  const keep = () => { setLanded(null); setRun(pickPlayer(h, run)); };
  return <section className="p820-draft">
    <div className="p820-stage">
      <span className="pixel-eyebrow">{run.from === 'hunt' ? `YOUR HUNT SQUAD + BENCH SPIN ${run.squad.length - 5} OF ${SQUAD - 6}` : `SPIN ${run.squad.length + 1} OF ${SQUAD}`}</span>
      <h2>{QUICK_SLOT_LABEL[slot]}</h2>
      <div className={`p820-reel ${spinning ? 'spinning' : ''} ${landed ? 'landed' : ''}`} aria-live="polite">
        {landed ? <CardTile c={landed} />
          : <div className="p820-reel-strip" style={{ transform: spinning ? `translateY(-${(strip.length - 1) * 64}px)` : 'translateY(0)' }}>{strip.map((c, i) => <div key={i} className="p820-reel-row"><b>{c.name}</b><small>{seasonLabel(c.end)} {c.team}</small><span>{c.ovr}</span></div>)}</div>}
      </div>
      {landed ? <button className="primary p820-big" onClick={keep}>{run.squad.length + 1 >= SQUAD ? (run.coach ? 'Keep and start the season' : 'Keep and spin the coach') : 'Keep and spin again'}</button>
        : <button className="primary p820-big" onClick={spin} disabled={spinning}>{spinning ? 'Spinning…' : 'SPIN'}</button>}
    </div>
    <SquadPanel h={h} run={run} />
  </section>;
}

// ---------------------------------------------------------------- Franchise Spin

function FranchiseDraft({ h, run, setRun }: { h: NbaHistory; run: PerfectRun; setRun: (r: PerfectRun) => void }) {
  const roll = run.roll!;
  const era = eraById(roll.eraId);
  const name = franchiseName(h, roll.franchise);
  const col = teamColors(roll.franchise);
  const [revealed, setRevealed] = useState(false);
  const rollKey = `${roll.franchise}|${roll.eraId}|${run.rolls}`;
  const prevKey = useRef('');
  useEffect(() => {
    if (prevKey.current === rollKey) return;
    prevKey.current = rollKey;
    setRevealed(false);
    const t = window.setTimeout(() => setRevealed(true), window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 30 : 900);
    return () => window.clearTimeout(t);
  }, [rollKey]);
  const players = rollPool(h, run, roll);
  return <section className="p820-draft">
    <div className="p820-stage">
      <span className="pixel-eyebrow">PICK {run.squad.length + 1} OF {SQUAD} · ONE PLAYER PER SPIN</span>
      <div className={`p820-roll ${revealed ? 'revealed' : 'rolling'}`} style={{ ['--team-a' as string]: col.primary, ['--team-b' as string]: col.secondary }}>
        <span className="p820-roll-team">{revealed ? name : '? ? ?'}</span>
        <span className="p820-roll-era">{revealed ? `${era.label} (${era.from}-${era.to})` : 'spinning…'}</span>
      </div>
      <div className="p820-tools">
        <button onClick={() => setRun(rerollTeam(h, run))} disabled={!revealed || run.rerolls.team < 1}><PixelIcon name="trade" size={14} /> Team reroll ({run.rerolls.team})</button>
        <button onClick={() => setRun(rerollEra(h, run))} disabled={!revealed || run.rerolls.era < 1}><PixelIcon name="calendar" size={14} /> Era reroll ({run.rerolls.era})</button>
        <button className={run.prime ? 'on' : ''} onClick={() => setRun(applyPrime(run))} disabled={!revealed || run.rerolls.prime < 1} title="This spin's players at the best season of their whole career"><PixelIcon name="star" size={14} /> {run.prime ? 'Absolute Prime ON' : `Absolute Prime (${run.rerolls.prime})`}</button>
      </div>
      {revealed && <>
        <p className="hint-text">{run.prime ? 'Absolute Prime: everyone at the best season of his career.' : `Each player at his best season with the ${name} in ${era.label.toLowerCase()}.`} Pick one.</p>
        <div className="p820-pool">{players.map(c => <CardTile key={c.id} c={c} prime={run.prime} onPick={() => setRun(pickPlayer(h, run, c.id))} />)}</div>
      </>}
    </div>
    <SquadPanel h={h} run={run} />
  </section>;
}

// ---------------------------------------------------------------- the coach

function CoachPick({ h, run, setRun }: { h: NbaHistory; run: PerfectRun; setRun: (r: PerfectRun) => void }) {
  const offer = (run.coachOffer ?? []).map(id => COACH_BY_ID.get(id)!).filter(Boolean);
  const [shown, setShown] = useState(run.mode === 'franchise');
  return <section className="p820-draft">
    <div className="p820-stage">
      <span className="pixel-eyebrow">LAST SPIN</span><h2>{run.mode === 'quick' ? 'Spin your coach' : 'Pick your coach'}</h2>
      {!shown ? <button className="primary p820-big" onClick={() => setShown(true)}>SPIN THE COACH</button>
        : <div className="p820-coaches">{offer.map(x => <button key={x.id} className={`p820-coach rarity-${coachRarity(x)}`} onClick={() => setRun(pickCoach(h, run, x.id))}>
          <b>{x.name}</b><span className="p820-ovr-mini">{x.bonus >= 0 ? '+' : ''}{x.bonus}</span><small>{COACH_STYLE[x.style]}</small><i>{x.blurb}</i><em>{run.mode === 'quick' ? 'Start the season' : 'Choose'}</em></button>)}</div>}
    </div>
    <SquadPanel h={h} run={run} />
  </section>;
}

// ---------------------------------------------------------------- the season and the playoffs

function GameDot({ g, n, boss }: { g?: PerfectGame; n: number; boss: boolean }) {
  return <li className={`${g ? (g.won ? 'w' : 'l') : ''} ${boss ? 'boss' : ''}`} title={g ? `Game ${n}: ${g.won ? 'W' : 'L'} ${g.us}-${g.them}` : `Game ${n}${boss ? ' (boss)' : ''}`}>{boss && !g ? '★' : ''}</li>;
}

function Season({ h, run, setRun }: { h: NbaHistory; run: PerfectRun; setRun: (r: PerfectRun) => void }) {
  const [auto, setAuto] = useState<null | 'game' | 'season' | 'series' | 'playoffs'>(null);
  const runRef = useRef(run);
  useEffect(() => { runRef.current = run; }, [run]);
  const teams = useMemo(() => new Map(huntTeams(h).map(t => [t.id, t])), [h]);
  const s = summary(run);
  // Simulates one game per tick so the record ticks up live.
  useEffect(() => {
    if (!auto) return;
    const startSeries = run.playoffs.length;
    const t = window.setInterval(() => {
      const r = runRef.current;
      const next = playNext(h, r);
      runRef.current = next;
      setRun(next);
      const stop = auto === 'game' || next.stage === 'done' || (auto === 'season' && next.stage !== 'season') || (auto === 'series' && (next.playoffs.length !== startSeries || next.stage !== 'playoffs')) || next === r;
      if (stop) { window.clearInterval(t); setAuto(null); }
    }, auto === 'game' ? 0 : 45);
    return () => window.clearInterval(t);
  }, [auto]); // eslint-disable-line react-hooks/exhaustive-deps
  const last = run.stage === 'playoffs' ? run.playoffs.flatMap(x => x.games).at(-1) : run.games.at(-1);
  const nextOpp = run.stage === 'season' ? teams.get(run.schedule[run.games.length]) : teams.get(run.playoffs.at(-1)?.opp ?? '');
  const nextBoss = run.stage === 'season' && run.bosses.includes(run.games.length) ? BOSS_TEAMS.find(b => b.id === run.schedule[run.games.length]) : undefined;
  const alive = s.l === 0 && run.games.length > 0;
  return <section className="p820-season">
    <div className="p820-scoreboard">
      <div className={`p820-record ${alive ? 'alive' : s.l ? 'broken' : ''}`}><span>{s.w}-{s.l}</span><small>{run.stage === 'season' ? `${run.games.length}/${SEASON_GAMES} games` : `Regular season · playoffs ${s.pw}-${s.pl}`}</small></div>
      <div className="p820-status">{alive ? <b className="p820-alive">82-0 STILL ALIVE · {s.w} STRAIGHT</b> : s.firstLoss != null ? <b className="p820-broken">Perfect run ended in game {s.firstLoss + 1}{(() => { const g = run.games[s.firstLoss!]; const t = teams.get(g.opp); return t ? ` (${g.us}-${g.them} vs ${teamLabel(t)})` : ''; })()}</b> : <b>Tip-off</b>}
        <small>Score {s.score.toLocaleString()} · bosses {s.bossWins}/{s.bosses} · rating {perfectRating(h, run)}</small></div>
    </div>
    <ol className="p820-dots" aria-label="Season results">{Array.from({ length: SEASON_GAMES }, (_, i) => <GameDot key={i} n={i + 1} g={run.games[i]} boss={run.bosses.includes(i)} />)}</ol>
    {run.stage === 'playoffs' && <div className="p820-bracket">{ROUND_NAMES.map((name, i) => { const ser = run.playoffs[i]; const t = ser ? teams.get(ser.opp) : undefined; const w = ser?.games.filter(g => g.won).length ?? 0, l = (ser?.games.length ?? 0) - w;
      return <div key={i} className={`p820-series ${ser ? (w >= WINS_NEEDED ? 'won' : l >= WINS_NEEDED ? 'lost' : 'on') : 'later'}`}><small>{name}</small><b>{t ? teamLabel(t) : 'TBD'}</b>{t && <span>{w}-{l} · their rating {teamRating(h, t)}</span>}</div>; })}</div>}
    <div className="p820-next">
      {nextOpp && <p>Next: <b>{teamLabel(nextOpp)}</b> ({nextOpp.w}-{nextOpp.l}{nextOpp.champion ? ', champions' : ''}) · rating {teamRating(h, nextOpp)}{nextBoss && <em className="p820-boss-tag">BOSS · {nextBoss.tag}</em>}</p>}
      {last && <p className="hint-text">Last game: {last.won ? 'W' : 'L'} {last.us}-{last.them} vs {teams.get(last.opp) ? teamLabel(teams.get(last.opp)!) : last.opp} · top scorer {last.top}</p>}
      <div className="p820-actions">
        <button onClick={() => setAuto('game')} disabled={!!auto}>Play next game</button>
        {run.stage === 'season' ? <button className="primary" onClick={() => setAuto('season')} disabled={!!auto}>{auto === 'season' ? 'Simming…' : 'Sim the season'}</button>
          : <><button onClick={() => setAuto('series')} disabled={!!auto}>Sim this series</button><button className="primary" onClick={() => setAuto('playoffs')} disabled={!!auto}>{auto === 'playoffs' ? 'Simming…' : 'Sim the playoffs'}</button></>}
        {auto && <button onClick={() => setAuto(null)}>Pause</button>}
      </div>
    </div>
    <SquadPanel h={h} run={run} />
  </section>;
}

// ---------------------------------------------------------------- the end

function Finished({ h, run, records, onAgain }: { h: NbaHistory; run: PerfectRun; records: PerfectRecords; onAgain: () => void }) {
  const s = summary(run);
  const { look, team } = useAvatar();
  const teams = useMemo(() => new Map(huntTeams(h).map(t => [t.id, t])), [h]);
  const lastSeries = run.playoffs.at(-1);
  const frame = s.perfectSeason && s.perfectPlayoffs ? 'perfectGold' : s.perfectSeason ? 'undefeated' : null;
  return <section className="p820-done">
    <div className={`p820-final ${s.champion ? 'champ' : ''}`}>
      <span className="pixel-eyebrow">{s.champion ? 'CHAMPIONS' : `OUT IN THE ${ROUND_NAMES[lastSeries?.round ?? 0].toUpperCase()}`}</span>
      <div className="p820-final-record">{s.w}-{s.l}<small>playoffs {s.pw}-{s.pl}</small></div>
      <p>{verdict(s)}</p>
      {frame && <div className="p820-reward"><FramedAvatar look={look} team={team} frame={frame} size={96} /><span><b>{frame === 'perfectGold' ? 'Perfection' : 'Undefeated'}</b> title and profile frame unlocked. Equip them in your Player Profile.</span></div>}
      {!s.champion && lastSeries && teams.get(lastSeries.opp) && <p className="hint-text">Knocked out by the {teamLabel(teams.get(lastSeries.opp)!)}.</p>}
    </div>
    <table className="p820-score"><tbody>
      <tr><td>Wins ({s.w} × {SCORE.win} + margins)</td><td>{run.games.filter(g => g.won).reduce((n, g) => n + SCORE.win + Math.min(SCORE.marginCap, g.us - g.them), 0).toLocaleString()}</td></tr>
      <tr><td>Bosses beaten ({s.bossWins}/{s.bosses})</td><td>{(s.bossWins * SCORE.boss).toLocaleString()}</td></tr>
      <tr><td>Playoff wins and sweeps</td><td>{(s.pw * SCORE.playoffWin + run.playoffs.filter(x => x.games.length === WINS_NEEDED && x.games.every(g => g.won)).length * SCORE.sweep).toLocaleString()}</td></tr>
      {s.champion && <tr><td>Title</td><td>{SCORE.title.toLocaleString()}</td></tr>}
      {s.perfectSeason && <tr><td>82-0</td><td>{SCORE.perfectSeason.toLocaleString()}</td></tr>}
      {s.perfectPlayoffs && <tr><td>16-0</td><td>{SCORE.perfectPlayoffs.toLocaleString()}</td></tr>}
      <tr className="total"><td>Score</td><td>{s.score.toLocaleString()}</td></tr>
    </tbody></table>
    <p className="hint-text">Best ever: {records.best ? `${records.best.w}-${records.best.l}, ${records.best.score.toLocaleString()} points` : '—'} · {records.titles} title{records.titles === 1 ? '' : 's'} · {records.perfectSeasons} perfect season{records.perfectSeasons === 1 ? '' : 's'}{run.daily ? ' · Daily 82-0: your best try today counts on the weekly board.' : ''}</p>
    <SquadPanel h={h} run={run} />
    <div className="p820-actions p820-end-actions"><button className="primary p820-big" onClick={onAgain}>Play again</button>
      <ShareCardButton tall fileName="82-0-challenge.png" label="Share card" text={`I went ${s.w}-${s.l}${s.champion ? ' and won the title' : ''} in the 82-0 Challenge (score ${s.score.toLocaleString()}). Can you go 82-0?`} spec={{
        kicker: `82-0 Challenge · ${MODE_INFO[run.mode].name}${run.daily ? ` · Daily ${run.daily}` : run.from === 'hunt' ? ' · Hunt squad' : ''}`,
        title: `${s.w}-${s.l}`,
        subtitle: `${s.champion ? 'Champions' : `Out in the ${ROUND_NAMES[lastSeries?.round ?? 0].toLowerCase()}`} · playoffs ${s.pw}-${s.pl} · score ${s.score.toLocaleString()}`,
        badge: s.perfectSeason && s.perfectPlayoffs ? 'PERFECTION · 98-0' : s.perfectSeason ? 'UNDEFEATED · 82-0' : s.bossWins === s.bosses && s.bosses > 0 ? 'EVERY BOSS BEATEN' : undefined,
        stats: [{ label: 'Record', value: `${s.w}-${s.l}` }, { label: 'Playoffs', value: `${s.pw}-${s.pl}` }, { label: 'Bosses', value: `${s.bossWins}/${s.bosses}` }, { label: 'Score', value: s.score.toLocaleString() }],
        results: run.games.map(g => ({ won: g.won, boss: g.boss })),
        lines: [...run.squad].map(id => cardPool(h).byId.get(id)!).sort((a, b) => b.ovr - a.ovr).map(c => `${c.name} ${seasonLabel(c.end)} · ${c.ovr}`),
        avatar: (() => { const top = [...run.squad].map(id => cardPool(h).byId.get(id)!).sort((a, b) => b.ovr - a.ovr)[0]; return top ? { playerId: top.name, primary: POS_COLOR[top.pos] } : undefined; })(),
        accent: s.perfectSeason ? 'gold' : s.champion ? 'green' : 'orange',
      }} /></div>
  </section>;
}
