import { useEffect, useMemo, useRef, useState } from 'react';
import type { NbaHistory } from '../../history/nbaHistoryData';
import { cardPool, seasonLabel, RARITY_LABEL, type HuntCard } from '../../hunt/cards';
import { huntTeams, teamLabel } from '../../hunt/teams';
import { COACH_STYLE, coachRarity } from '../../hunt/coaches';
import { eraOf } from '../../hunt/eras';
import {
  newPerfectRun, pickPlayer, quickSpinCard, reelFiller, rerollTeam, rerollEra, applyPrime, rerollSpin, luckySpin, spinsLeft, luckyLeft, rollRerollsLeft, lineupOf, swapLineup, setLineup, ROTATION_MINUTES, pickCoach, playNext, rollPool, franchiseName, eraById, teamBonds,
  perfectRating, teamRating, summary, starCount, starCapReached, MAX_STARS, coachMatchup, coachMatchupText, streakPressure, STREAK_STEP, STREAK_MAX, OPP_EDGE, verdict, BOSS_TEAMS, QUICK_SLOTS, QUICK_SLOT_LABEL, SQUAD, SEASON_GAMES, ROUND_NAMES, WINS_NEEDED, SCORE, COACH_BY_ID,
  isCategoryMode, categoryPool, rerollCategory, categoryMultiplier, picksFromCategory, STARTERS,
  type PerfectRun, type PerfectMode, type PerfectGame,
} from '../../perfect/run';
import { categories, categoryById, TIER_LABEL, TIER_MULTIPLIER, type CategoryInfo } from '../../perfect/categories';
import { loadPerfectRun, savePerfectRun, loadPerfectRecords, recordPerfect, dailyPerfect, perfectWeeks, type PerfectRecords } from '../../perfect/storage';
import { weekKey } from '../../retention/week';
import { ClaimRankCard } from '../cloud/ClaimRankCard';
import { DuelPanel, DuelBanner } from '../hunt/DuelPanel';
import { takePendingDuel, encodeDuel } from '../../retention/duel';
import { challengePrefs, saveChallengePrefs, challengeMultiplier, isLevel, LEVEL_NAME, STANDARD_VIEW, type Level, type RunView } from '../../retention/challenge';
import { LevelPicker, ViewToggles } from '../ChallengeOptions';
import { noteRunHighs, noteFinalsMvp } from '../../retention/recordBook';
import { noteWeekRun, noteWeekRecords } from '../../retention/weekLog';
import { runMvp, perGame } from '../../hunt/statLines';
import { RunStatsTable, RecordBookPanel, RunHighs } from '../hunt/RunStats';
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
  quick: { name: 'Quick Spin', icon: 'play', blurb: 'Ten spins and a coach spin. Five starters by position, five off the bench. Three rerolls and two lucky spins (a sure Great or Star).' },
  franchise: { name: 'Franchise Spin', icon: 'team', blurb: 'Each spin rolls a franchise and an era. Pick ONE player from everyone who played there. Three team-or-era rerolls, two lucky rolls and one Absolute Prime boost.' },
  category: { name: 'Category Roll', icon: 'trophy', blurb: 'Roll a category (MVPs, 90s players, Duke, No. 1 picks, 7-footers, the Lakers... 150 of them) and take ANY five as your starters. A second roll is your bench. Weaker categories score more.' },
  slots: { name: 'Slot Spin', icon: 'shuffle', blurb: 'Every one of your ten spots spins its own category. Take one player from each. Three category rerolls and two lucky rolls (an S or A tier category).' },
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
      noteWeekRecords(noteRunHighs('perfect', r.highs).length);
      noteWeekRun('perfect', { score: s.score, line: `${s.w}-${s.l}${s.champion ? ', champions' : ''}` }, `p820-${r.seed}-${r.mode}`);
      const fmvp = s.champion ? runMvp(r.finalsLines) : null;
      if (fmvp) noteFinalsMvp({ name: fmvp.name, record: `${s.w}-${s.l}`, pts: fmvp.pts, g: fmvp.g });
      noteFeaturedXp('perfect', `p820-${r.seed}-${r.mode}`, perfectRunXp({ champion: s.champion, perfectSeason: s.perfectSeason, perfect98: s.perfectSeason && s.perfectPlayoffs, daily: !!r.daily }));
      window.dispatchEvent(new Event(FEATS_EVENT));
      trackOnce(`p820-${r.seed}-${r.mode}`, 'mode_finish', { mode: 'perfect', variant: r.mode, daily: !!r.daily, wins: s.w, champion: s.champion });
    }
  };
  // A duel link: start the challenger's exact run (asking first if a run is going).
  useEffect(() => {
    if (!h) return;
    const d = takePendingDuel('perfect');
    if (!d || !d.pm) return;
    if (run && run.stage !== 'done' && !window.confirm(`${d.n} challenged you to an 82-0 duel. Start it? Your run in progress will be replaced.`)) return;
    setRun({ ...newPerfectRun(h, d.pm, d.s, undefined, { level: isLevel(d.diff) ? d.diff : 'pro', view: d.vw ?? STANDARD_VIEW }), duel: encodeDuel(d) });
  }, [h]); // eslint-disable-line react-hooks/exhaustive-deps
  // From the menu's Category Draft card: start a Category Roll unless a run is going.
  useEffect(() => {
    if (!h) return;
    let want: string | null = null;
    try { want = localStorage.getItem('cv-p820-start'); localStorage.removeItem('cv-p820-start'); } catch { /* storage blocked */ }
    if (want === 'category' && (!run || run.stage === 'done')) start('category', Math.floor(Math.random() * 1_000_000_000), undefined, challengePrefs('perfect'));
  }, [h]); // eslint-disable-line react-hooks/exhaustive-deps
  const start = (mode: PerfectMode, seed: number, daily?: string, opts?: { level: Level; view: RunView }) => {
    if (!h) return;
    track('mode_start', { mode: 'perfect', variant: daily ? 'daily' : mode, level: daily ? 'pro' : opts?.level ?? 'pro' });
    setRun(newPerfectRun(h, mode, seed, daily, opts));
  };

  const header = <header className="hunt-top">
    <button className="hunt-exit" onClick={onExit}><PixelIcon name="exit" size={16} /> Main Menu</button>
    <div className="hunt-title"><span className="pixel-eyebrow">{run ? (run.from === 'hunt' ? 'HUNT SQUAD · BONUS RUN' : `${MODE_INFO[run.mode].name.toUpperCase()}${run.daily ? ' · DAILY' : ''}`) : 'BUILD A TEAM · PLAY ALL 82'}</span><h1>82-0 Challenge</h1></div>
    {run && run.stage !== 'done' && <button className="hunt-exit" onClick={() => { if (window.confirm('Give up this run? It will not count.')) setRun(null); }}>Give up</button>}
  </header>;
  if (error) return <div className="hunt p820">{header}<p className="empty-state">Could not load the NBA history data: {error}</p></div>;
  if (!h) return <div className="hunt p820">{header}<p className="empty-state">Loading 80 years of basketball…</p></div>;
  return <div className={`hunt p820 ${run?.view && !run.view.colors && run.stage !== 'done' ? 'no-rarity' : ''}`}>
    {header}
    {run && run.stage !== 'done' && <DuelBanner duel={run.duel} />}
    {run && (run.level || run.view) && <p className="p820-challenge-line">{LEVEL_NAME[run.level ?? 'pro']}{run.view?.numbers ? ' · ratings shown' : ''}{run.view && !run.view.colors ? ' · colours hidden' : ''} · score ×{challengeMultiplier(run.level, run.view)}</p>}
    {!run ? <Hub records={records} onStart={start} />
      : run.stage === 'draft' ? (run.mode === 'quick' ? <QuickDraft h={h} run={run} setRun={setRun} /> : isCategoryMode(run.mode) ? <CategoryDraft h={h} run={run} setRun={setRun} /> : <FranchiseDraft h={h} run={run} setRun={setRun} />)
      : run.stage === 'coach' ? <CoachPick h={h} run={run} setRun={setRun} />
      : run.stage === 'done' ? <Finished h={h} run={run} records={records} onAgain={() => setRun(null)} />
      : <Season h={h} run={run} setRun={setRun} />}
  </div>;
}

// ---------------------------------------------------------------- the hub

const LEVEL_BLURB: Record<Level, string> = {
  rookie: 'Every opponent plays 4 points worse. A relaxed run: scores ×0.8.',
  pro: 'The standard 82-0 Challenge (the Daily is always Pro).',
  legend: 'Every opponent plays 4 points better. For the brave: scores ×1.25.',
};

function Hub({ records, onStart }: { records: PerfectRecords; onStart: (mode: PerfectMode, seed: number, daily?: string, opts?: { level: Level; view: RunView }) => void }) {
  const today = todayUtc(), daily = dailyPerfect(today), todayBest = records.daily?.[today];
  const [prefs, setPrefs] = useState(() => challengePrefs('perfect'));
  const set = (p: Partial<typeof prefs>) => { const next = { ...prefs, ...p }; setPrefs(next); saveChallengePrefs('perfect', next); };
  const mult = challengeMultiplier(prefs.level, prefs.view);
  return <section className="p820-hub">
    <div className="p820-hero"><span className="p820-goal">82-0</span><span className="p820-goal-plus">+ 16-0</span>
      <p>Build a ten-man team from all of NBA history, play a full 82-game season against real teams from every era, then four playoff rounds. Bosses on the schedule: {BOSS_TEAMS.map(b => b.tag).join(', ')}.</p></div>
    <div className="p820-options">
      <div><h3 className="hunt-subhead">Difficulty</h3><LevelPicker value={prefs.level} onChange={level => set({ level })} blurbs={LEVEL_BLURB} /></div>
      <div><h3 className="hunt-subhead">Challenge yourself</h3><ViewToggles value={prefs.view} onChange={view => set({ view })} note={`Ratings shown: scores ×0.9. Colours hidden: scores ×1.1. This run: score ×${mult}. The Daily always uses the standard view.`} /></div>
    </div>
    <div className="p820-modes">
      {(['category', 'slots', 'quick', 'franchise'] as PerfectMode[]).map(m => <button key={m} className={`p820-mode ${isCategoryMode(m) ? 'p820-mode-new' : ''}`} onClick={() => onStart(m, Math.floor(Math.random() * 1_000_000_000), undefined, prefs)}>
        {isCategoryMode(m) && <span className="p820-new-tag">NEW</span>}
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
    <CategoryBook records={records} />
    <RecordBookPanel />
    <details className="hunt-how"><summary>How scoring and rewards work</summary>
      <ul>
        <li>Every win: {SCORE.win} points plus the margin (up to {SCORE.marginCap}). Beating a boss team: +{SCORE.boss}.</li>
        <li>Playoff win: +{SCORE.playoffWin}; a sweep: +{SCORE.sweep}; the title: +{SCORE.title.toLocaleString()}.</li>
        <li>82-0: +{SCORE.perfectSeason.toLocaleString()}. 16-0 in the playoffs too: another +{SCORE.perfectPlayoffs.toLocaleString()}.</li>
        <li>Lineups matter: start a guard and a big, and don't stack three at one position. Real teammates, franchise-mates and famous rivals add chemistry.</li>
        <li>Your rotation: during the season, tap two players to swap them and pick your own five starters and bench order, or leave it on auto (the coach starts his best five).</li>
        <li>Spin helpers: three rerolls (send a card back, or reroll the team or era) and two lucky spins (a sure Great or Star, or a roll with one waiting).</li>
        <li>Ratings are hidden until the season is over: pick on the name, the season and the numbers he put up. Your team rating, your coach's and the opponents' come out at the end.</li>
        <li>At most {MAX_STARS} Stars on a team in Quick and Franchise Spin: once you have {MAX_STARS}, the spins stop offering more.</li>
        <li>Category Roll and Slot Spin: every category has a tier, S (stacked) to D (brutal). Weaker categories pay more: S ×{TIER_MULTIPLIER.S}, A ×{TIER_MULTIPLIER.A}, B ×{TIER_MULTIPLIER.B}, C ×{TIER_MULTIPLIER.C}, D ×{TIER_MULTIPLIER.D} (starters count double). With any player in a category to choose from, their opponents are the toughest (+{OPP_EDGE.category} and +{OPP_EDGE.slots}).</li>
        <li>Streak pressure: every {STREAK_STEP} straight wins, everyone plays you harder (+1, up to +{STREAK_MAX}). A loss resets it. Franchise Spin opponents are +{OPP_EDGE.franchise} tougher, since you choose.</li>
        <li>Coaches have eras: a run-and-gun coach beats the slow 1990s, the triangle wins grinders, a five-out coach is lost without a three-point line. ±2 to your team that game.</li>
        <li>Every game is played under the rules of the opponent's era, and ratings are ranked within each season, so a 1965 star and a 2016 star stand on the same scale.</li>
        <li>Rewards: the <b>Undefeated</b> title and profile frame for 82-0; the gold <b>Perfection</b> title and frame for 98-0. Trophy Road points for your best season, titles and perfect seasons.</li>
      </ul></details>
  </section>;
}

// ---------------------------------------------------------------- cards and the squad

/** Ratings stay hidden until the run is over: you pick on the name, the season and the numbers he put up. */
const ratingsShown = (run: Pick<PerfectRun, 'stage' | 'view'>) => run.stage === 'done' || !!run.view?.numbers;
const HIDDEN = '?';

function CardTile({ c, onPick, prime, hide }: { c: HuntCard; onPick?: () => void; prime?: boolean; hide?: boolean }) {
  const body = <>
    <PlayerAvatar playerId={c.name} primaryColor={POS_COLOR[c.pos] ?? '#f47b20'} secondaryColor="#f4f0e6" size={44} mode="portrait" />
    <span className="p820-card-text"><b>{c.name}</b><small>{seasonLabel(c.end)} · {c.team} · {c.pos}</small><i>{c.ppg} pts · {c.rpg} reb · {c.apg} ast</i></span>
    <span className={`p820-ovr rarity-${c.rarity}`} title={hide ? `${RARITY_LABEL[c.rarity]} · rating hidden until the season is over` : RARITY_LABEL[c.rarity]}>{hide ? HIDDEN : c.ovr}</span>
    {prime && <em className="p820-prime-tag">PRIME</em>}
  </>;
  return onPick ? <button className={`p820-card rarity-${c.rarity}`} onClick={onPick}>{body}</button> : <div className={`p820-card rarity-${c.rarity}`}>{body}</div>;
}

function SquadPanel({ h, run }: { h: NbaHistory; run: PerfectRun }) {
  const pool = cardPool(h);
  const bonds = teamBonds(h, run);
  // Once you set a lineup, the team list follows it: your five starters first, then the bench.
  const lineup = lineupOf(run);
  const ids = lineup ?? run.squad;
  return <aside className="p820-squad">
    <h3>Your team <small>{run.squad.length}/{SQUAD}</small></h3>
    <ol>{Array.from({ length: SQUAD }, (_, i) => { const c = ids[i] ? pool.byId.get(ids[i]) : undefined; return <li key={i} className={c ? `rarity-${c.rarity}` : 'empty'}>
      <span className="p820-slot">{lineup ? i < 5 ? 'START' : 'BENCH' : run.mode === 'quick' && run.from !== 'hunt' ? QUICK_SLOTS[i] : run.from === 'hunt' && i < 6 ? 'HUNT' : i < 5 ? 'START' : 'BENCH'}</span>
      {c ? <><b>{c.name}</b><small>{seasonLabel(c.end)} {c.team} · {c.pos}{!lineup && run.cats?.[i] ? ` · ${categoryById(h, run.cats[i])?.name ?? ''}` : ''}</small><span className="p820-ovr-mini">{ratingsShown(run) ? c.ovr : HIDDEN}</span></> : <small>—</small>}</li>; })}</ol>
    {ratingsShown(run) && run.coach && COACH_BY_ID.get(run.coach) && <p className="p820-rating">Coach <b>{COACH_BY_ID.get(run.coach)!.name}</b> <small>({COACH_BY_ID.get(run.coach)!.bonus >= 0 ? '+' : ''}{COACH_BY_ID.get(run.coach)!.bonus})</small></p>}
    {run.squad.length >= 5 && <p className="p820-rating">Team rating <b>{ratingsShown(run) ? perfectRating(h, run) : '??'}</b> <small>{ratingsShown(run) ? '(100 = a 68-win team)' : '(revealed when the season is over)'}</small></p>}
    {run.stage === 'draft' && !isCategoryMode(run.mode) && <p className={`p820-stars ${starCapReached(h, run) ? 'full' : ''}`}><PixelIcon name="star" size={12} /> Stars {starCount(h, run)}/{MAX_STARS}{starCapReached(h, run) ? ': no more Stars on the reels' : ''}</p>}
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
  // A reroll sends the card back and spins this spot again (once the new card is ready).
  const respin = useRef(false);
  useEffect(() => { if (respin.current) { respin.current = false; spin(); } }, [run.spinSalt]); // eslint-disable-line react-hooks/exhaustive-deps
  const reroll = () => { respin.current = true; setLanded(null); setRun(rerollSpin(run)); };
  return <section className="p820-draft">
    <div className="p820-stage">
      <span className="pixel-eyebrow">{run.from === 'hunt' ? `YOUR HUNT SQUAD + BENCH SPIN ${run.squad.length - 5} OF ${SQUAD - 6}` : `SPIN ${run.squad.length + 1} OF ${SQUAD}`}</span>
      <h2>{QUICK_SLOT_LABEL[slot]}</h2>
      <div className={`p820-reel ${spinning ? 'spinning' : ''} ${landed ? 'landed' : ''}`} aria-live="polite">
        {landed ? <CardTile c={landed} hide={!ratingsShown(run)} />
          : <div className="p820-reel-strip" style={{ transform: spinning ? `translateY(-${(strip.length - 1) * 64}px)` : 'translateY(0)' }}>{strip.map((c, i) => <div key={i} className="p820-reel-row"><b>{c.name}</b><small>{seasonLabel(c.end)} {c.team}</small><span>{ratingsShown(run) ? c.ovr : HIDDEN}</span></div>)}</div>}
      </div>
      {run.lucky && !landed && <p className="p820-lucky-on"><PixelIcon name="star" size={12} /> Lucky spin: this reel lands on a Great or a Star{starCapReached(h, run) ? ' (a Great: you have your three Stars)' : ''}.</p>}
      {landed ? <div className="p820-spin-actions">
          <button className="primary p820-big" onClick={keep}>{run.squad.length + 1 >= SQUAD ? (run.coach ? 'Keep and start the season' : 'Keep and spin the coach') : 'Keep and spin again'}</button>
          <button onClick={reroll} disabled={spinsLeft(run) < 1} title="Send this card back and spin this spot again"><PixelIcon name="shuffle" size={14} /> Reroll ({spinsLeft(run)} left)</button>
        </div>
        : <div className="p820-spin-actions">
          <button className="primary p820-big" onClick={spin} disabled={spinning}>{spinning ? 'Spinning…' : run.lucky ? 'LUCKY SPIN' : 'SPIN'}</button>
          {!run.lucky && <button onClick={() => setRun(luckySpin(h, run))} disabled={spinning || luckyLeft(run) < 1} title="The next spin lands on a Great or a Star"><PixelIcon name="star" size={14} /> Use a lucky spin ({luckyLeft(run)} left)</button>}
        </div>}
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
  useEffect(() => {
    setRevealed(false);
    const t = window.setTimeout(() => setRevealed(true), window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 30 : 900);
    return () => window.clearTimeout(t);
  }, [rollKey]);
  // Listed by name, not by rating, so the order gives nothing away.
  const players = [...rollPool(h, run, roll)].sort((a, b) => a.name.localeCompare(b.name));
  return <section className="p820-draft">
    <div className="p820-stage">
      <span className="pixel-eyebrow">PICK {run.squad.length + 1} OF {SQUAD} · ONE PLAYER PER SPIN</span>
      <div className={`p820-roll ${revealed ? 'revealed' : 'rolling'}`} style={{ ['--team-a' as string]: col.primary, ['--team-b' as string]: col.secondary }}>
        <span className="p820-roll-team">{revealed ? name : '? ? ?'}</span>
        <span className="p820-roll-era">{revealed ? `${era.label} (${era.from}-${era.to})` : 'spinning…'}</span>
      </div>
      <div className="p820-tools">
        <button onClick={() => setRun(rerollTeam(h, run))} disabled={!revealed || rollRerollsLeft(run, 'team') < 1}><PixelIcon name="trade" size={14} /> Team reroll ({rollRerollsLeft(run, 'team')}{run.rerolls.roll != null ? ' left' : ''})</button>
        <button onClick={() => setRun(rerollEra(h, run))} disabled={!revealed || rollRerollsLeft(run, 'era') < 1}><PixelIcon name="calendar" size={14} /> Era reroll ({rollRerollsLeft(run, 'era')}{run.rerolls.roll != null ? ' left' : ''})</button>
        <button onClick={() => setRun(luckySpin(h, run))} disabled={!revealed || luckyLeft(run) < 1} title="A new franchise and era with a Great or a Star waiting"><PixelIcon name="shuffle" size={14} /> Lucky roll ({luckyLeft(run)})</button>
        <button className={run.prime ? 'on' : ''} onClick={() => setRun(applyPrime(run))} disabled={!revealed || run.rerolls.prime < 1} title="This spin's players at the best season of their whole career"><PixelIcon name="star" size={14} /> {run.prime ? 'Absolute Prime ON' : `Absolute Prime (${run.rerolls.prime})`}</button>
      </div>
      {run.rerolls.roll != null && <p className="hint-text p820-tools-note">Team and era rerolls share {run.rerolls.roll} left.</p>}
      {revealed && <>
        <p className="hint-text">{run.prime ? 'Absolute Prime: everyone at the best season of his career.' : `Each player at his best season with the ${name} in ${era.label.toLowerCase()}.`} Pick one.</p>
        <div className="p820-pool">{players.map(c => <CardTile key={c.id} c={c} prime={run.prime} hide={!ratingsShown(run)} onPick={() => setRun(pickPlayer(h, run, c.id))} />)}</div>
      </>}
    </div>
    <SquadPanel h={h} run={run} />
  </section>;
}

// ---------------------------------------------------------------- Category Roll and Slot Spin

const TIER_CLASS: Record<string, string> = { S: 'tier-s', A: 'tier-a', B: 'tier-b', C: 'tier-c', D: 'tier-d' };
const PAGE = 48;

function TierBadge({ c }: { c: CategoryInfo }) {
  return <span className={`p820-tier ${TIER_CLASS[c.tier]}`} title={`${TIER_LABEL[c.tier]} category: score ×${TIER_MULTIPLIER[c.tier]}`}><b>{c.tier}</b><small>{TIER_LABEL[c.tier]} · ×{TIER_MULTIPLIER[c.tier]}</small></span>;
}

function CategoryDraft({ h, run, setRun }: { h: NbaHistory; run: PerfectRun; setRun: (r: PerfectRun) => void }) {
  const cat = run.cat ? categoryById(h, run.cat) : undefined;
  const all = useMemo(() => categories(h), [h]);
  const [revealed, setRevealed] = useState(false);
  const [flash, setFlash] = useState('');
  const [q, setQ] = useState('');
  const [shown, setShown] = useState(PAGE);
  const rollKey = `${run.cat}|${run.rolls}`;
  // The roll: category names flicker past, then it lands.
  useEffect(() => {
    setRevealed(false); setQ(''); setShown(PAGE);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setRevealed(true); return; }
    let i = 0;
    const tick = window.setInterval(() => { setFlash(all[(run.rolls * 37 + i++ * 13) % all.length].name); }, 70);
    const done = window.setTimeout(() => { window.clearInterval(tick); setRevealed(true); }, 1100);
    return () => { window.clearInterval(tick); window.clearTimeout(done); };
  }, [rollKey]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!cat) return null;
  const starters = run.squad.length < STARTERS;
  const left = picksFromCategory(run);
  const needle = q.trim().toLowerCase();
  const pool = categoryPool(h, run).filter(c => !needle || c.name.toLowerCase().includes(needle));
  const startPos = run.squad.slice(0, STARTERS).map(id => cardPool(h).byId.get(id)!.pos);
  const hasGuard = startPos.some(p => ['PG', 'SG', 'G'].includes(p)), hasBig = startPos.some(p => ['PF', 'C'].includes(p));
  const label = run.mode === 'slots' ? `SPOT ${run.squad.length + 1} OF ${SQUAD} · ${starters ? 'STARTER' : 'BENCH'} · ONE PLAYER`
    : starters ? `YOUR STARTING FIVE · PICK ${run.squad.length + 1} OF ${STARTERS}` : `YOUR BENCH · PICK ${run.squad.length - STARTERS + 1} OF ${SQUAD - STARTERS}`;
  return <section className="p820-draft">
    <div className="p820-stage">
      <span className="pixel-eyebrow">{label}</span>
      <div className={`p820-catroll ${revealed ? 'revealed' : 'rolling'} ${revealed ? TIER_CLASS[cat.tier] : ''}`} aria-live="polite">
        {revealed ? <>
          <span className="p820-cat-group">{cat.group.toUpperCase()}</span>
          <span className="p820-cat-name">{cat.name}</span>
          <span className="p820-cat-blurb">{cat.blurb} · {cat.size} players</span>
          <TierBadge c={cat} />
        </> : <span className="p820-cat-name flicker">{flash || '? ? ?'}</span>}
      </div>
      <div className="p820-tools">
        <button onClick={() => setRun(rerollCategory(h, run))} disabled={!revealed || (run.rerolls.roll ?? 0) < 1} title="Send this category back and roll another"><PixelIcon name="shuffle" size={14} /> Reroll category ({run.rerolls.roll ?? 0} left)</button>
        <button onClick={() => setRun(luckySpin(h, run))} disabled={!revealed || luckyLeft(run) < 1} title="A new category from the S or A tier"><PixelIcon name="star" size={14} /> Lucky roll ({luckyLeft(run)})</button>
      </div>
      {revealed && <>
        <p className="hint-text">{run.mode === 'slots' ? 'Take one player from this category.' : `Take any ${left} more from this category${starters ? ' for your starting five' : ' for your bench'}.`} Each player comes in at his best season that fits.{starters && run.squad.length >= 3 && (!hasGuard || !hasBig) ? ` Your starters have no ${!hasGuard ? 'guard' : 'big man'} yet.` : ''}</p>
        <input className="year-input p820-search" value={q} onChange={e => { setQ(e.target.value); setShown(PAGE); }} placeholder={`Search ${cat.size} players`} aria-label="Search this category" />
        <div className="p820-pool">{pool.slice(0, shown).map(c => <CardTile key={c.id} c={c} hide={!ratingsShown(run)} onPick={() => setRun(pickPlayer(h, run, c.id))} />)}</div>
        {pool.length > shown && <button className="link-button" onClick={() => setShown(n => n + PAGE * 2)}>Show more ({pool.length - shown} left)</button>}
        {!pool.length && <p className="empty-state">Nobody by that name in this category.</p>}
      </>}
    </div>
    <SquadPanel h={h} run={run} />
  </section>;
}

/** Your best season with each starting category, by tier. */
function CategoryBook({ records }: { records: PerfectRecords }) {
  const done = Object.entries(records.categories ?? {});
  if (!done.length) return null;
  const titles = done.filter(([, x]) => x.champion).length, perfect = done.filter(([, x]) => x.l === 0).length;
  return <details className="hunt-how p820-catbook"><summary>Category Book · {done.length} played · {titles} won · {perfect} at 82-0</summary>
    <CategoryBookList entries={done} />
  </details>;
}
function CategoryBookList({ entries }: { entries: [string, { w: number; l: number; champion: boolean }][] }) {
  const [h, setH] = useState<NbaHistory | null>(null);
  useEffect(() => { let live = true; import('../../history/nbaHistoryData').then(m => m.loadNbaHistory()).then(d => { if (live) setH(d); }); return () => { live = false; }; }, []);
  if (!h) return <p className="hint-text">Loading…</p>;
  const rows = entries.map(([id, x]) => ({ c: categoryById(h, id), x })).filter(r => r.c).sort((a, b) => Number(b.x.champion) - Number(a.x.champion) || b.x.w - a.x.w);
  return <ul className="p820-catbook-list">{rows.map(({ c, x }) => <li key={c!.id} className={x.champion ? 'won' : ''}><span className={`p820-tier mini ${TIER_CLASS[c!.tier]}`}><b>{c!.tier}</b></span><b>{c!.name}</b><small>{x.w}-{x.l}{x.champion ? ' · champions' : ''}{x.l === 0 ? ' · 82-0' : ''}</small></li>)}</ul>;
}

// ---------------------------------------------------------------- the coach

function CoachPick({ h, run, setRun }: { h: NbaHistory; run: PerfectRun; setRun: (r: PerfectRun) => void }) {
  const offer = (run.coachOffer ?? []).map(id => COACH_BY_ID.get(id)!).filter(Boolean);
  const [shown, setShown] = useState(run.mode !== 'quick');
  return <section className="p820-draft">
    <div className="p820-stage">
      <span className="pixel-eyebrow">LAST SPIN</span><h2>{run.mode === 'quick' ? 'Spin your coach' : 'Pick your coach'}</h2>
      {!shown ? <button className="primary p820-big" onClick={() => setShown(true)}>SPIN THE COACH</button>
        : <div className="p820-coaches">{offer.map(x => <button key={x.id} className={`p820-coach rarity-${coachRarity(x)}`} onClick={() => setRun(pickCoach(h, run, x.id))}>
          <b>{x.name}</b><span className="p820-ovr-mini" title={ratingsShown(run) ? 'Coach bonus' : 'Coach rating hidden until the season is over'}>{ratingsShown(run) ? `${x.bonus >= 0 ? '+' : ''}${x.bonus}` : HIDDEN}</span><small>{COACH_STYLE[x.style]}</small><small className="p820-coach-eras">{coachMatchupText(x.style)}</small><i>{x.blurb}</i><em>{run.mode === 'quick' ? 'Start the season' : 'Choose'}</em></button>)}</div>}
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
        <small>Score {s.score.toLocaleString()} · bosses {s.bossWins}/{s.bosses}</small></div>
    </div>
    <ol className="p820-dots" aria-label="Season results">{Array.from({ length: SEASON_GAMES }, (_, i) => <GameDot key={i} n={i + 1} g={run.games[i]} boss={run.bosses.includes(i)} />)}</ol>
    {run.stage === 'playoffs' && <div className="p820-bracket">{ROUND_NAMES.map((name, i) => { const ser = run.playoffs[i]; const t = ser ? teams.get(ser.opp) : undefined; const w = ser?.games.filter(g => g.won).length ?? 0, l = (ser?.games.length ?? 0) - w;
      return <div key={i} className={`p820-series ${ser ? (w >= WINS_NEEDED ? 'won' : l >= WINS_NEEDED ? 'lost' : 'on') : 'later'}`}><small>{name}</small><b>{t ? teamLabel(t) : 'TBD'}</b>{t && <span>{w}-{l} · {t.w}-{t.l} in {seasonLabel(t.end)}</span>}</div>; })}</div>}
    <div className="p820-next">
      {nextOpp && <p>Next: <b>{teamLabel(nextOpp)}</b> ({nextOpp.w}-{nextOpp.l}{nextOpp.champion ? ', champions' : ''}){nextBoss && <em className="p820-boss-tag">BOSS · {nextBoss.tag}</em>}
        {(() => { const m = coachMatchup(run.coach ? COACH_BY_ID.get(run.coach)?.style : undefined, eraOf(nextOpp.end).id); return m ? <em className={`p820-matchup ${m > 0 ? 'good' : 'bad'}`}>Coach vs {eraOf(nextOpp.end).label.replace(/^The /, '')}: {m > 0 ? '+' : ''}{m}</em> : null; })()}
        {streakPressure(run) > 0 && <em className="p820-pressure">Streak pressure +{streakPressure(run)}</em>}</p>}
      {last && <p className="hint-text">Last game: {last.won ? 'W' : 'L'} {last.us}-{last.them} vs {teams.get(last.opp) ? teamLabel(teams.get(last.opp)!) : last.opp} · top scorer {last.top}</p>}
      <div className="p820-actions">
        <button onClick={() => setAuto('game')} disabled={!!auto}>Play next game</button>
        {run.stage === 'season' ? <button className="primary" onClick={() => setAuto('season')} disabled={!!auto}>{auto === 'season' ? 'Simming…' : 'Sim the season'}</button>
          : <><button onClick={() => setAuto('series')} disabled={!!auto}>Sim this series</button><button className="primary" onClick={() => setAuto('playoffs')} disabled={!!auto}>{auto === 'playoffs' ? 'Simming…' : 'Sim the playoffs'}</button></>}
        {auto && <button onClick={() => setAuto(null)}>Pause</button>}
      </div>
    </div>
    <LineupPanel h={h} run={run} setRun={setRun} locked={!!auto} />
    {run.stage === 'playoffs' && run.playoffLines ? <RunStatsTable lines={run.playoffLines} title="Playoff stats" /> : <RunStatsTable lines={run.lines} title="Season stats" note={`${run.games.length} game${run.games.length === 1 ? '' : 's'}`} />}
  </section>;
}

// ---------------------------------------------------------------- your lineup

/** Your rotation: tap a player, then another, to swap them. The first five start; the bench plays in order. */
function LineupPanel({ h, run, setRun, locked }: { h: NbaHistory; run: PerfectRun; setRun: (r: PerfectRun) => void; locked: boolean }) {
  const pool = cardPool(h);
  const custom = lineupOf(run);
  const order = custom ?? run.squad;
  const [picked, setPicked] = useState<string | null>(null);
  const bonds = teamBonds(h, run);
  const tap = (id: string) => {
    if (locked) return;
    if (!picked) { setPicked(id); return; }
    if (picked !== id) setRun(swapLineup(run, picked, id));
    setPicked(null);
  };
  return <aside className="p820-squad p820-lineup">
    <h3>Your rotation <small>{custom ? 'your lineup' : 'auto'}</small></h3>
    <p className="hint-text">{custom ? 'The first five start; the bench comes in in order.' : 'Auto: your coach starts his best five every game.'} Tap a player, then another, to swap them{locked ? ' (pause the sim first)' : ''}.</p>
    <ol>{order.map((id, i) => { const c = pool.byId.get(id); if (!c) return null; return <li key={id} className={`rarity-${c.rarity} ${picked === id ? 'picked' : ''} ${custom && i === 5 ? 'p820-bench-start' : ''}`}>
      <button type="button" onClick={() => tap(id)} disabled={locked} aria-pressed={picked === id}>
        <span className="p820-slot">{custom ? (i < 5 ? 'START' : i === 5 ? '6TH' : 'BENCH') : '—'}</span>
        <b>{c.name}</b><small>{seasonLabel(c.end)} {c.team} · {c.pos}{custom ? ` · ${ROTATION_MINUTES[i]} min` : ''}</small>
        <span className="p820-ovr-mini">{ratingsShown(run) ? c.ovr : HIDDEN}</span>
      </button></li>; })}</ol>
    {custom && <button className="link-button" disabled={locked} onClick={() => { setPicked(null); setRun(setLineup(run, null)); }}>Back to auto</button>}
    {ratingsShown(run) && run.coach && COACH_BY_ID.get(run.coach) && <p className="p820-rating">Coach <b>{COACH_BY_ID.get(run.coach)!.name}</b> <small>({COACH_BY_ID.get(run.coach)!.bonus >= 0 ? '+' : ''}{COACH_BY_ID.get(run.coach)!.bonus})</small></p>}
    <p className="p820-rating">Team rating <b>{ratingsShown(run) ? perfectRating(h, run) : '??'}</b> <small>{ratingsShown(run) ? '(100 = a 68-win team)' : '(revealed when the season is over)'}</small></p>
    {bonds.length > 0 && <ul className="p820-bonds">{bonds.map((b, i) => <li key={i} className={b.bonus < 0 ? 'bad' : 'good'}>{b.bonus > 0 ? '+' : ''}{b.bonus} · {b.label}</li>)}</ul>}
  </aside>;
}

// ---------------------------------------------------------------- the end

/** The run's MVP (regular season) and, with a title, the Finals MVP. */
function RunMvps({ run }: { run: PerfectRun }) {
  const mvp = runMvp(run.lines, 20), s = summary(run), fmvp = s.champion ? runMvp(run.finalsLines) : null;
  if (!mvp && !fmvp) return null;
  const card = (label: string, m: NonNullable<typeof mvp>) => <div className="hunt-mvp"><PlayerAvatar playerId={m.name} primaryColor="#f47b20" secondaryColor="#f4f0e6" size={64} />
    <div><span className="pixel-eyebrow">{label}</span><strong>{m.name}</strong><span>{perGame(m.pts, m.g)} PTS · {perGame(m.reb, m.g)} REB · {perGame(m.ast, m.g)} AST · {perGame(m.min, m.g)} MIN in {m.g} game{m.g === 1 ? '' : 's'}</span></div></div>;
  return <div className="p820-mvps">{mvp && card('RUN MVP', mvp)}{fmvp && card('FINALS MVP', fmvp)}</div>;
}

/** The guest pitch: a Daily 82-0 counts for the week's board (your best day of the week); other runs get the plain pitch. */
function PerfectClaim({ run, records, score }: { run: PerfectRun; records: PerfectRecords; score: number }) {
  const id = `perfect:${run.seed}:${run.daily ?? run.mode}`;
  if (run.daily) {
    const week = weekKey(new Date(`${run.daily}T12:00:00Z`)), best = perfectWeeks(records)[week]?.score ?? score;
    return <ClaimRankCard id={id} board={{ kind: 'weekly', board: 'perfect', week }} score={best} scored={`Your Daily 82-0 scored ${best.toLocaleString()}`} where="on this week's 82-0 board" />;
  }
  return <ClaimRankCard id={id} board={{ kind: 'players' }} score={0} scored={`Your 82-0 run scored ${score.toLocaleString()}`} where="" pitchOnly />;
}

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
      {!s.champion && lastSeries && teams.get(lastSeries.opp) && <p className="hint-text">Knocked out by the {teamLabel(teams.get(lastSeries.opp)!)} (their rating {teamRating(h, teams.get(lastSeries.opp)!)}).</p>}
    </div>
    <DuelPanel setup={{ m: 'perfect', s: run.seed, pm: run.mode, ...(run.level ? { diff: run.level } : {}), ...(run.view ? { vw: run.view } : {}) }} duel={run.duel}
      mine={{ score: s.score, won: s.champion, line: `${s.w}-${s.l} · playoffs ${s.pw}-${s.pl}${s.champion ? ' · champions' : ''}` }} />
    <PerfectClaim run={run} records={records} score={s.score} />
    <RunMvps run={run} />
    <table className="p820-score"><tbody>
      <tr><td>Wins ({s.w} × {SCORE.win} + margins)</td><td>{run.games.filter(g => g.won).reduce((n, g) => n + SCORE.win + Math.min(SCORE.marginCap, g.us - g.them), 0).toLocaleString()}</td></tr>
      <tr><td>Bosses beaten ({s.bossWins}/{s.bosses})</td><td>{(s.bossWins * SCORE.boss).toLocaleString()}</td></tr>
      <tr><td>Playoff wins and sweeps</td><td>{(s.pw * SCORE.playoffWin + run.playoffs.filter(x => x.games.length === WINS_NEEDED && x.games.every(g => g.won)).length * SCORE.sweep).toLocaleString()}</td></tr>
      {s.champion && <tr><td>Title</td><td>{SCORE.title.toLocaleString()}</td></tr>}
      {s.perfectSeason && <tr><td>82-0</td><td>{SCORE.perfectSeason.toLocaleString()}</td></tr>}
      {s.perfectPlayoffs && <tr><td>16-0</td><td>{SCORE.perfectPlayoffs.toLocaleString()}</td></tr>}
      {isCategoryMode(run.mode) && <tr><td>Categories ({[...new Set(run.cats ?? [])].map(id => categoryById(h, id)?.name).filter(Boolean).slice(0, 3).join(', ')}{(new Set(run.cats ?? [])).size > 3 ? '…' : ''})</td><td>×{categoryMultiplier(run)}</td></tr>}
      {s.multiplier !== 1 && <tr><td>{isCategoryMode(run.mode) ? 'Total multiplier' : 'Challenge'} ({LEVEL_NAME[run.level ?? 'pro']}{run.view?.numbers ? ', ratings shown' : ''}{run.view && !run.view.colors ? ', colours hidden' : ''})</td><td>×{s.multiplier}</td></tr>}
      <tr className="total"><td>Score</td><td>{s.score.toLocaleString()}</td></tr>
    </tbody></table>
    <p className="hint-text">Best ever: {records.best ? `${records.best.w}-${records.best.l}, ${records.best.score.toLocaleString()} points` : '—'} · {records.titles} title{records.titles === 1 ? '' : 's'} · {records.perfectSeasons} perfect season{records.perfectSeasons === 1 ? '' : 's'}{run.daily ? ' · Daily 82-0: your best try today counts on the weekly board.' : ''}</p>
    <SquadPanel h={h} run={run} />
    <RunStatsTable lines={run.lines} title="Regular season stats" />
    <RunStatsTable lines={run.playoffLines} title="Playoff stats" />
    <RunHighs highs={run.highs} mode="perfect" />
    <div className="p820-actions p820-end-actions"><button className="primary p820-big" onClick={onAgain}>Play again</button>
      <ShareCardButton tall fileName="82-0-challenge.png" label="Share card" text={`I went ${s.w}-${s.l}${s.champion ? ' and won the title' : ''} in the 82-0 Challenge${run.mode === 'category' && run.cats?.[0] ? ` with a starting five of ${categoryById(h, run.cats[0])?.name ?? 'one category'}` : ''} (score ${s.score.toLocaleString()}). Can you go 82-0?`} spec={{
        kicker: `82-0 Challenge · ${run.mode === 'category' && run.cats?.[0] ? categoryById(h, run.cats[0])?.name ?? MODE_INFO[run.mode].name : MODE_INFO[run.mode].name}${run.daily ? ` · Daily ${run.daily}` : run.from === 'hunt' ? ' · Hunt squad' : ''}`,
        title: `${s.w}-${s.l}`,
        subtitle: `${s.champion ? 'Champions' : `Out in the ${ROUND_NAMES[lastSeries?.round ?? 0].toLowerCase()}`} · playoffs ${s.pw}-${s.pl} · score ${s.score.toLocaleString()}`,
        badge: s.perfectSeason && s.perfectPlayoffs ? 'PERFECTION · 98-0' : s.perfectSeason ? 'UNDEFEATED · 82-0' : s.bossWins === s.bosses && s.bosses > 0 ? 'EVERY BOSS BEATEN' : undefined,
        stats: [{ label: 'Record', value: `${s.w}-${s.l}` }, { label: 'Playoffs', value: `${s.pw}-${s.pl}` }, { label: 'Bosses', value: `${s.bossWins}/${s.bosses}` }, { label: 'Score', value: s.score.toLocaleString() }],
        results: run.games.map(g => ({ won: g.won, boss: g.boss })),
        lines: [...(() => { const m = runMvp(run.lines, 20); return m ? [`Run MVP: ${m.name} ${perGame(m.pts, m.g)} PPG`] : []; })(), ...[...run.squad].map(id => cardPool(h).byId.get(id)!).sort((a, b) => b.ovr - a.ovr).map(c => `${c.name} ${seasonLabel(c.end)} · ${c.ovr}`)],
        avatar: (() => { const top = [...run.squad].map(id => cardPool(h).byId.get(id)!).sort((a, b) => b.ovr - a.ovr)[0]; return top ? { playerId: top.name, primary: POS_COLOR[top.pos] } : undefined; })(),
        accent: s.perfectSeason ? 'gold' : s.champion ? 'green' : 'orange',
      }} /></div>
  </section>;
}
