import { ModeIcon } from '../ModeIcon';
import { useEffect, useRef, useState } from 'react';
import { noteHolidayFinish } from '../../retention/holiday';
import {
  newStory, currentBeat, continueStory, choose, spendTraining, choosePath, playStoryGame, overall, chapterOf, ordinal,
  loadStory, saveStory, loadEndings, recordEnding, STYLES, HOMETOWNS, PATHS, TRAINABLE, TRAIN_STEP, SCRIPT,
  type StoryState, type StoryStyle, type StoryGame, type Path, type StoryEndings,
} from '../../story/story';
import {
  enterDraft, afterDraft, joinLeague, toNextMoment, currentMoment, nbaCtx, nbaCard, nbaGame, chooseNba, playNbaGame, playNbaSeries, continueNba, signNba,
  trainNba, nbaOffers, storyEnding, storyShareText, nbaCareerLine, nbaYear, nextStop, roundLabel, seasonHeadline, NBA_SEASONS, NBA_ENDINGS, STOP_LABEL, type NbaRun, type NbaCtx, type StorySim,
} from '../../story/storyNba';
import { prepareStoryLeague, runStoryStep, storyStepRunning, onStoryStatus, storyStatus, leaguePrepPct, storyWorldId, type StoryStatus } from '../../story/storyRunner';
import { loadStoryWorld, saveStoryWorld, dropStoryWorlds, type StoryWorld } from '../../story/storyStorage';
import { currentMatchup } from '../../simulation/playoffs';
import { formatSeasonYear } from '../../simulation/calendar';
import { OFFER_LABEL } from '../../career/career';
import { CATEGORY_BY_ID, categoryScore, categoryValues } from '../../career/categories';
import { PlayerAvatar } from '../PlayerAvatar';
import { PixelIcon } from '../PixelIcon';
import { ShareCardButton } from '../ShareCardButton';
import { track, trackOnce } from '../../analytics/track';
import { noteWeekRun } from '../../retention/weekLog';
import '../hunt/hunt.css';
import { relicRunOpts } from '../../relics/apply';
import { rewardRun, storySpins, storySecret, storyRewardKey } from '../../relics/rewards';
import { RelicReward } from '../relics/RelicReward';
import { StoryTabs, SeasonTrack, Journal, People, Trophies, type StoryTab } from './StoryBook';
import './story.css';

const SITE = 'https://courtvisiongame.com';
/** The chapters on the road to the NBA. */
const ACTS = SCRIPT.filter(b => b.kind === 'chapter').length;
const newSeed = () => Math.floor(Math.random() * 1_000_000_000);
const BOND_LABEL = (n: number) => (n >= 5 ? 'Family' : n >= 3 ? 'Close' : n >= 1 ? 'Friendly' : n >= -1 ? 'Distant' : 'Cold');
const RIVAL_LABEL = (n: number) => (n >= 2 ? 'Respect' : n >= 0 ? 'Rivals' : n >= -2 ? 'Bad blood' : 'Enemies');
const money = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;

/** Story Mode: Street to the League, then fifteen seasons in the real NBA. */
export function StoryMode({ onExit }: { onExit: () => void }) {
  const [story, setStoryState] = useState<StoryState | null>(loadStory);
  const [world, setWorld] = useState<StoryWorld | null>(null);
  const [worldMissing, setWorldMissing] = useState(false);
  const [endings, setEndings] = useState<StoryEndings>(loadEndings);
  const [lastGame, setLastGame] = useState<StoryGame | null>(null);
  const [status, setStatus] = useState<StoryStatus | null>(storyStatus);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<StoryTab>('story');
  const current = useRef(story);

  const setStory = (s: StoryState | null) => {
    const prev = current.current;
    current.current = s;
    setStoryState(s);
    saveStory(s);
    if (s && s.done && prev && !prev.done) {
      const e = storyEnding(s);
      setEndings(recordEnding(e.tier, e.id));
      rewardRun(storyRewardKey(s), storySpins(e.tier), { secret: storySecret(e.tier), why: 'Story Mode' });
      const score = s.nba ? Math.round(nbaCareerLine(s.nba).legacy * 10) : Math.round(overall(s) * 10 + s.games.filter(g => g.won).length * 50);
      noteWeekRun('story', { score, line: e.title }, `story-${s.seed}${s.nba ? '-nba' : ''}`);
      noteHolidayFinish(true, `story-${s.seed}`);
      trackOnce(`story-${s.seed}${s.nba ? '-nba' : ''}`, 'mode_finish', { mode: 'story', ending: e.tier, nba: !!s.nba });
    }
  };

  // A step that was running when the screen closed lands here when it is done.
  useEffect(() => {
    let live = true;
    storyStepRunning()?.then(r => { if (live) { current.current = r.s; setStoryState(r.s); setWorld(r.world); } }, () => {});
    const off = onStoryStatus(setStatus);
    return () => { live = false; off(); };
  }, []);

  // The league: built in the background on the road to the draft; loaded once you're in it.
  const seed = story?.seed, inLeague = !!story && !story.done && currentBeat(story).kind === 'nba', onRoad = !!story && !story.done && !inLeague;
  useEffect(() => {
    if (seed == null) return;
    let live = true;
    if (onRoad) prepareStoryLeague(seed).catch(() => {});
    if (inLeague) loadStoryWorld(storyWorldId(seed)).then(w => { if (!live) return; setWorld(w ?? null); setWorldMissing(!w); });
    return () => { live = false; };
  }, [seed, onRoad, inLeague]);

  const run = (label: string, step: (sim: StorySim) => Promise<NbaRun>, showGame = false) => {
    const before = current.current;
    setError(null);
    runStoryStep(label, step).then(r => {
      setWorld(r.world); setWorldMissing(false);
      setLastGame(showGame && before && r.s.games.length > before.games.length ? r.s.games.at(-1)! : null);
      setStory(r.s);
    }, e => setError(e instanceof Error ? e.message : String(e)));
  };
  /** A step of the NBA years that needs no simulation. */
  const now = (fn: (r: NbaRun) => NbaRun) => {
    if (!story || !world) return;
    const r = fn({ s: story, world });
    setLastGame(null);
    if (r.world !== world) { setWorld(r.world); void saveStoryWorld(r.world); }
    setStory(r.s);
  };
  const act = (fn: (s: StoryState) => StoryState, game = false) => {
    if (!story) return;
    const next = fn(story);
    setLastGame(game && next.games.length > story.games.length ? next.games.at(-1)! : null);
    setStory(next);
  };

  // Between moments the league plays on by itself.
  const waiting = !!story && !!world && !!story.nba && !story.done && !story.nba.queue.length && !status && !error;
  useEffect(() => {
    if (!waiting || !story?.nba) return;
    const label = `Playing on to ${STOP_LABEL[nextStop(story.nba)].toLowerCase()}`;
    const t = setTimeout(() => run(label, sim => toNextMoment({ s: current.current!, world: world! }, sim)), 50);
    return () => clearTimeout(t);
  });

  const draftNight = () => {
    if (!story) return;
    run('Draft night', async sim => {
      const w = await prepareStoryLeague(story.seed);
      const entered = enterDraft(story, w);
      const d = await sim.fromDraft(entered.world, story.seed + 7);
      return afterDraft({ s: entered.s, world: d.world }, d.picks);
    });
  };
  /** A story from before the NBA years (or whose league was lost) goes into a fresh real league. */
  const intoTheLeague = (s: StoryState) => run('Building the NBA', async sim => {
    let w = await prepareStoryLeague(s.seed);
    if (w.phase === 'atDraft') w = (await sim.fromDraft(w, s.seed + 7)).world;
    const r = joinLeague({ s: { ...s, done: false, classic: undefined, nba: undefined, beat: 'nba' }, world: w });
    // A lost league: the career so far stays on the record.
    return s.nba ? { ...r, s: { ...r.s, nba: { ...r.s.nba!, years: s.nba.years, seen: s.nba.seen } } } : r;
  });
  const startOver = () => { setStory(null); setWorld(null); setLastGame(null); setError(null); void dropStoryWorlds(); };

  const ctx = story?.nba && world ? nbaCtx(story, world) : null;
  const eyebrow = !story || story.done ? 'STREET TO THE LEAGUE'
    : story.nba ? `NBA SEASON ${nbaYear(story.nba)} OF ${NBA_SEASONS} · ${STOP_LABEL[story.nba.stop].toUpperCase()}`
    : inLeague ? 'THE NBA' : `ACT ${chapterOf(story)?.act ?? 1} OF ${ACTS} · ${(chapterOf(story)?.title ?? '').toUpperCase()}`;
  const header = <header className="hunt-top">
    <button className="hunt-exit" onClick={onExit}><PixelIcon name="exit" size={16} /> Main Menu</button>
    <div className="hunt-title"><span className="pixel-eyebrow">{eyebrow}</span><h1>Story Mode</h1></div>
    {story && !story.done && <button className="hunt-exit" onClick={() => { if (window.confirm('Start over? This story and its league will be lost.')) startOver(); }}>Start over</button>}
  </header>;
  return <div className="hunt story">
    {header}
    {!story ? <Create endings={endings} onStart={(name, style, town) => { track('mode_start', { mode: 'story', style }); void dropStoryWorlds(); setStory(newStory(newSeed(), name, style, town, relicRunOpts())); }} />
      : story.done ? <Ending s={story} endings={endings} onNew={startOver} onNba={() => intoTheLeague(story)} busy={status} onExit={onExit} />
      : <div className="story-layout">
          <HeroPanel s={story} ctx={ctx} />
          <main className="story-main">
            <StoryTabs tab={tab} onTab={setTab} pages={story.journal?.length ?? 0} />
            {tab === 'journal' ? <Journal s={story} />
              : tab === 'people' ? <People s={story} ctx={ctx} />
              : tab === 'trophies' ? <Trophies s={story} />
              : <>
                {story.nba && <SeasonTrack n={story.nba} />}
                {error && <div className="story-last lost" role="alert"><p>Something went wrong: {error}</p><button onClick={() => setError(null)}>Try again</button></div>}
                {story.last && !status && <div className={`story-last ${lastGame ? (lastGame.won ? 'won' : 'lost') : ''}`} role="status">
                  {lastGame && <GameLine g={lastGame} />}
                  <p>{story.last}</p>
                </div>}
                {status ? <Busy status={status} />
                  : inLeague ? <NbaView s={story} world={world} worldMissing={worldMissing} ctx={ctx} run={run} now={now} onJoin={() => intoTheLeague(story)} />
                  : <BeatView s={story} act={act} onDraft={draftNight} />}
              </>}
          </main>
        </div>}
  </div>;
}

function Busy({ status }: { status: StoryStatus }) {
  const [prep, setPrep] = useState(leaguePrepPct);
  useEffect(() => { const t = setInterval(() => setPrep(leaguePrepPct()), 500); return () => clearInterval(t); }, []);
  const pct = prep != null ? prep : status.pct;
  return <section className="story-busy" role="status" aria-live="polite">
    <span className="pixel-eyebrow">{prep != null ? 'THE SEASON BEFORE YOUR DRAFT' : 'THE LEAGUE PLAYS ON'}</span>
    <b>{prep != null ? 'Today\'s NBA is playing the season before your draft…' : `${status.label}…`}</b>
    <div className="hunt-cap-bar"><i style={{ width: `${pct ?? 8}%` }} /></div>
    <small>{pct != null ? `${pct}%` : 'Every game is played by the real engine.'}</small>
  </section>;
}

function Create({ endings, onStart }: { endings: StoryEndings; onStart: (name: string, style: StoryStyle, town: string) => void }) {
  const [name, setName] = useState('');
  const [style, setStyle] = useState<StoryStyle>('scorer');
  const [town, setTown] = useState(HOMETOWNS[0]);
  return <section className="hunt-stage story-create">
    <div className="story-pitch">
      <span className="pixel-eyebrow">THE ROAD UP · FIFTEEN NBA SEASONS · YOUR CHOICES</span>
      <h2>From the park to the Hall of Fame</h2>
      <p>You're sixteen, from {town}, and nobody knows your name. Win at the park, make varsity, run the summer circuit, choose your road (a blue blood, a mid-major, Europe, the G League or junior college) and hear your name on draft night. Then fifteen seasons in today's real NBA, every game played by the real engine: training camps, Christmas games, trade deadlines, All-Star Weekends, playoff runs, free agency. Your best friend Dre, Coach Ray, your little sister Maya and your rival Marcus "Ice" Vance are with you the whole way. Your choices, your games and the people you keep close decide which of nine endings you get.</p>
    </div>
    <div className="cv-panel">
      <label className="story-field"><span>Your name</span><input className="year-input" maxLength={24} value={name} placeholder="Jaylen Carter" onChange={e => setName(e.target.value)} /></label>
      <h3 className="hunt-subhead">Your game</h3>
      <div className="story-styles" role="radiogroup" aria-label="Your game">{(Object.keys(STYLES) as StoryStyle[]).map(k => <button key={k} role="radio" aria-checked={style === k} className={style === k ? 'active' : ''} onClick={() => setStyle(k)}>
        <ModeIcon mode={`story-${k}`} size={48} /><b>{STYLES[k].name}</b><small>{STYLES[k].pos} · {STYLES[k].blurb}</small></button>)}</div>
      <label className="story-field"><span>Hometown</span><select className="year-input" value={town} onChange={e => setTown(e.target.value)}>{HOMETOWNS.map(t => <option key={t}>{t}</option>)}</select></label>
      <div className="contest-actions"><button className="primary hunt-play" onClick={() => onStart(name || 'Jaylen Carter', style, town)}><PixelIcon name="play" size={16} /> Begin the story</button></div>
      {endings.finished > 0 && <p className="hint-text">Stories finished: {endings.finished} · NBA endings seen: {NBA_ENDINGS.filter(id => endings.ids?.[`nba-${id}`]).length} of {NBA_ENDINGS.length}</p>}
    </div>
  </section>;
}

function Meter({ label, value, max, hint }: { label: string; value: number; max: number; hint?: string }) {
  return <div className="story-meter"><span>{label}</span><div className="hunt-cap-bar"><i style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} /></div><b>{hint ?? value}</b></div>;
}

function HeroPanel({ s, ctx }: { s: StoryState; ctx: NbaCtx | null }) {
  const ch = chapterOf(s);
  const n = s.nba;
  return <aside className="story-hero" aria-label="Your player">
    <PlayerAvatar playerId={s.name} primaryColor="#f47b20" secondaryColor="#f4f0e6" jerseyNumber={s.hero.jerseyNumber} size={84} />
    <div className="story-hero-name"><b>{s.name}</b><small>{STYLES[s.style].pos} · {STYLES[s.style].name} · age {ctx?.age ?? s.hero.age} · {s.hometown}</small></div>
    <div className="story-ovr"><small>OVR</small><b className="hunt-rating">{overall(s)}</b></div>
    {ctx && <div className="story-team"><b>{ctx.teamName}</b><small>{ctx.gp ? `${ctx.w}-${ctx.l}${ctx.rank ? ` · ${ordinal(ctx.rank)} in the conference` : ''} · ${ctx.ppg} PPG, ${ctx.rpg} RPG, ${ctx.apg} APG` : n && (n.stop === 'awards' || n.stop === 'summer') ? 'The offseason' : `${ctx.season} season`}</small></div>}
    <Meter label="Hype" value={s.hype} max={30} />
    <Meter label="Grit" value={s.grit} max={15} />
    <ul className="story-bonds">
      <li><b>Dre</b> <small>best friend</small><span>{BOND_LABEL(s.bonds.dre)}</span></li>
      <li><b>Coach Ray</b> <small>mentor</small><span>{BOND_LABEL(s.bonds.ray)}</span></li>
      <li><b>Maya</b> <small>little sister</small><span>{BOND_LABEL(s.bonds.maya ?? 0)}</span></li>
      <li><b>Ice Vance</b> <small>rival{ctx?.ice ? ` · ${ctx.ice.teamName}` : ''}</small><span>{RIVAL_LABEL(s.bonds.ice)}</span></li>
    </ul>
    <ol className="story-acts" aria-label="Chapters">
      {SCRIPT.filter(b => b.kind === 'chapter').map(b => b.kind === 'chapter' && <li key={b.id} className={n || (ch && b.act < ch.act) ? 'done' : ch?.act === b.act ? 'now' : ''}>{b.act}. {b.title}</li>)}
      <li className={n ? 'now' : ''}>{ACTS + 1}. The NBA{n ? ` · season ${nbaYear(n)} of ${NBA_SEASONS}` : ''}</li>
    </ol>
    {n && n.years.length > 0 && <p className="hint-text">{n.years.length} season{n.years.length === 1 ? '' : 's'} · {nbaCareerLine(n).ppg} career PPG · Legacy {nbaCareerLine(n).legacy}</p>}
    {s.path && <p className="hint-text">{PATHS[s.path].name}{s.draft ? ` · ${s.draft.pick ? `#${s.draft.pick} pick, ${s.draft.team}` : 'Undrafted'}` : ''}</p>}
  </aside>;
}

function GameLine({ g }: { g: StoryGame }) {
  return <div className="story-gameline">
    <span className="pixel-eyebrow">{g.title.toUpperCase()} · FINAL</span>
    <b>{g.won ? 'W' : 'L'} {g.us}-{g.them} vs {g.opp}</b>
    <span>{g.line.pts} PTS · {g.line.reb} REB · {g.line.ast} AST · {g.line.stl} STL · {g.line.blk} BLK · {g.line.fgm}/{g.line.fga} FG · {g.line.min} MIN</span>
    <span className={`story-grade grade-${g.grade[0]}`}>Grade {g.grade}</span>
  </div>;
}

function TrainButtons({ s, onPick }: { s: StoryState; onPick: (cat: (typeof TRAINABLE)[number]) => void }) {
  return <div className="story-train">{TRAINABLE.map(cat => { const c = CATEGORY_BY_ID.get(cat)!; return <button key={cat} onClick={() => onPick(cat)}>
    <b>{c.name}</b><small>{categoryScore(categoryValues(s.hero, cat))}</small></button>; })}</div>;
}

function BeatView({ s, act, onDraft }: { s: StoryState; act: (fn: (s: StoryState) => StoryState, game?: boolean) => void; onDraft: () => void }) {
  const b = currentBeat(s);
  if (b.kind === 'chapter') return <section className="story-chapter">
    <span className="story-act">ACT {b.act}</span><h2>{b.title}</h2><p>{b.text(s)}</p>
    <button className="primary hunt-play" onClick={() => act(continueStory)}>Continue</button>
  </section>;
  if (b.kind === 'scene') return <section className="story-scene">
    <h2>{b.title}</h2><p>{b.text(s)}</p>
    <div className="story-choices">{b.choices(s).map(c => <button key={c.id} onClick={() => act(x => choose(x, c.id))}>{c.label}</button>)}</div>
  </section>;
  if (b.kind === 'train') return <section className="story-scene">
    <h2>{b.title}</h2><p>{b.text(s)}</p>
    <p className="story-points"><PixelIcon name="flame" size={14} /> {s.points} point{s.points === 1 ? '' : 's'} to spend · each one is +{TRAIN_STEP} to every rating in that area</p>
    <TrainButtons s={s} onPick={cat => act(x => spendTraining(x, cat))} />
  </section>;
  if (b.kind === 'path') return <section className="story-scene">
    <h2>{b.title}</h2><p>{b.text(s)}</p>
    <div className="story-paths">{(Object.keys(PATHS) as Path[]).map(p => <button key={p} onClick={() => act(x => choosePath(x, p))}>
      <b>{PATHS[p].name}</b><small>{PATHS[p].blurb}</small><i>About {PATHS[p].minutes} minutes a game</i></button>)}</div>
  </section>;
  if (b.kind === 'game') return <section className={`story-game ${b.key ? 'key' : ''}`}>
    <span className="pixel-eyebrow">{b.key ? 'KEY GAME · ' : ''}{b.title.toUpperCase()}</span>
    <h2>vs {b.opp(s)}</h2><p>{b.stakes(s)}</p>
    <p className="hint-text">You'll play about {b.minutes(s)} minutes. Your grit sharpens you in the clutch; the better you play, the louder your name gets.</p>
    <button className="primary hunt-play-big" onClick={() => act(playStoryGame, true)}><PixelIcon name="play" size={22} /> PLAY</button>
  </section>;
  if (b.kind === 'draft') return <section className="story-chapter story-draft">
    <span className="story-act">DRAFT NIGHT</span><h2>{b.title}</h2>
    <p>The commissioner walks to the podium. Your mom grabs your hand. Ice is two tables away, staring at the ceiling. Thirty real NBA teams, sixty picks.</p>
    <button className="primary hunt-play-big" onClick={onDraft}>Hear your name</button>
  </section>;
  return null;
}

// ---------------------------------------------------------------- the NBA years

interface NbaViewProps {
  s: StoryState; world: StoryWorld | null; worldMissing: boolean; ctx: NbaCtx | null;
  run: (label: string, step: (sim: StorySim) => Promise<NbaRun>, showGame?: boolean) => void;
  now: (fn: (r: NbaRun) => NbaRun) => void;
  onJoin: () => void;
}

function NbaView({ s, world, worldMissing, ctx, run, now, onJoin }: NbaViewProps) {
  if (!s.nba) return <section className="story-chapter">
    <span className="story-act">THE NBA</span><h2>Fifteen Seasons</h2>
    <p>{s.draft?.team ? `${s.draft.team} drafted you.` : 'You made it.'} Your story goes on in a real NBA league: today's teams and players, every game played by the real engine, fifteen seasons of it.</p>
    <button className="primary hunt-play-big" onClick={onJoin}>Into the league</button>
  </section>;
  if (worldMissing) return <section className="story-scene">
    <h2>Your league couldn't be found</h2>
    <p>This browser no longer has your NBA league (storage was cleared or full). Your career so far is safe: you can go on in a fresh league, keeping every season you've played.</p>
    <button className="primary" onClick={onJoin}>Go on in a fresh league</button>
  </section>;
  const m = currentMoment(s);
  if (!world || !ctx || !m) return <section className="story-busy"><b>Loading your league…</b></section>;
  const r = { s, world };
  const n = s.nba;

  if (m.kind === 'card') {
    const card = nbaCard(m.id);
    if (!card) return null;
    return <section className="story-scene">
      <span className="pixel-eyebrow">{STOP_LABEL[n.stop].toUpperCase()}</span>
      <h2>{card.title}</h2><p>{card.text(ctx)}</p>
      <div className="story-choices">{card.choices(ctx).map(c => <button key={c.id} onClick={() => now(x => chooseNba(x, c.id))}>{c.label}</button>)}</div>
    </section>;
  }
  if (m.kind === 'game') {
    const def = nbaGame(m.id);
    if (!def) return null;
    const opp = m.vs ? ctx.ice?.teamName : ctx.next?.name;
    return <section className="story-game key">
      <span className="pixel-eyebrow">KEY GAME · {def.title(ctx).toUpperCase()}</span>
      <h2>{ctx.teamName} vs {opp ?? 'TBD'}</h2><p>{def.stakes(ctx)}</p>
      <p className="hint-text">A real game on your team's schedule: it counts in the standings and in your stats.</p>
      <button className="primary hunt-play-big" onClick={() => run('Tip-off', sim => playNbaGame(r, sim), true)}><PixelIcon name="play" size={22} /> PLAY</button>
    </section>;
  }
  if (m.kind === 'series') {
    const b = world.league.playoffBracket;
    const id = b && ctx.teamId ? currentMatchup(b, ctx.teamId) : null;
    const pi = id ? b!.playIn?.find(x => x.id === id) : undefined;
    const sr = id ? b!.rounds.flat().find(x => x.id === id) : undefined;
    const oppId = pi ? (pi.teamAId === ctx.teamId ? pi.teamBId : pi.teamAId) : sr ? (sr.teamAId === ctx.teamId ? sr.teamBId : sr.teamAId) : null;
    const oppName = oppId ? world.league.teams.find(t => t.teamId === oppId)?.name ?? oppId : b?.playIn?.some(x => !x.winnerTeamId) ? 'the winner of the play-in' : 'to be decided';
    const label = b && id ? roundLabel(b, id) : 'The playoffs';
    const gameNo = sr ? sr.teamAWins + sr.teamBWins + 1 : 1;
    if (m.decider) return <section className="story-game key story-decider">
      <span className="pixel-eyebrow">{label.toUpperCase()} · GAME {gameNo}</span>
      <h2>Game {gameNo}: {ctx.teamName} vs {oppName}</h2>
      <p>{sr ? `${sr.teamAWins}-${sr.teamBWins}. ` : ''}The two most exciting words in sports. Win and you go on; lose and the season is over. {s.flags.includes('stateChamp') ? 'You have won the big one before.' : 'Tonight would be a good night to start winning the big ones.'}</p>
      <button className="primary hunt-play-big" onClick={() => run(`Game ${gameNo}`, sim => playNbaSeries(r, sim), true)}><PixelIcon name="play" size={22} /> PLAY GAME {gameNo}</button>
    </section>;
    return <section className="story-game key">
      <span className="pixel-eyebrow">{label.toUpperCase()}</span>
      <h2>{ctx.teamName} vs {oppName}</h2>
      <p>{pi ? 'One game. Win and you\'re in (or one step closer); lose and the season could be over.' : label === 'The NBA Finals' ? 'Four wins from a ring. Everything you\'ve done since Carver Park was for this.' : `Best of seven. ${n.run.length ? `You've won ${n.run.filter(x => x.won).length} round${n.run.filter(x => x.won).length === 1 ? '' : 's'} already.` : 'Playoff basketball: every possession matters.'}`}</p>
      <button className="primary hunt-play-big" onClick={() => run(label, sim => playNbaSeries(r, sim), true)}><PixelIcon name="play" size={22} /> {pi ? 'PLAY' : 'PLAY THE SERIES'}</button>
    </section>;
  }
  if (m.kind === 'allStar') {
    const wk = world.league.allStarWeekend;
    const me = n.playerId;
    const star = !!wk?.voting?.selected?.some(x => x.playerId === me) || !!wk?.gameResult && [...wk.gameResult.squadA.playerIds, ...wk.gameResult.squadB.playerIds].includes(me);
    const rising = !!wk?.risingStars && [...wk.risingStars.squadA.playerIds, ...wk.risingStars.squadB.playerIds].includes(me);
    return <section className="story-scene">
      <span className="pixel-eyebrow">ALL-STAR WEEKEND · {ctx.season}</span>
      <h2>{star ? 'You\'re an All-Star' : rising ? 'Rising Stars' : 'A Weekend Off'}</h2>
      <p>{star ? `Your name is called with the best players in the world. ${wk?.mvp?.playerId === me ? 'And you take the All-Star MVP home.' : ''}` : rising ? `You play in the Rising Stars game with the league's best young players.${wk?.risingStarsMvp?.playerId === me ? ' MVP!' : ''}` : 'Not this year. You watch from the couch and take notes.'}</p>
      <ul className="story-facts">
        {wk?.mvp && <li>All-Star MVP: <b>{wk.mvp.playerId}</b></li>}
        {wk?.threePointChampionId && <li>Three-point contest: <b>{wk.threePointChampionId}</b></li>}
        {wk?.dunkChampionId && <li>Dunk contest: <b>{wk.dunkChampionId}</b></li>}
      </ul>
      <button className="primary" onClick={() => now(continueNba)}>Back to the season</button>
    </section>;
  }
  if (m.kind === 'standings') {
    const seed = ctx.rank;
    const verdict = seed == null ? `${ctx.w}-${ctx.l}.` : seed <= 6 ? `The ${ordinal(seed)} seed. You're in the playoffs.` : seed <= 10 ? `${ordinal(seed)} in the conference: the play-in.` : `${ordinal(seed)} in the conference. The season ends with the last game.`;
    return <section className="story-scene">
      <span className="pixel-eyebrow">THE REGULAR SEASON IS OVER</span>
      <h2>{ctx.teamName}: {ctx.w}-{ctx.l}</h2>
      <p>{verdict} You played {ctx.gp} games: {ctx.ppg} points, {ctx.rpg} rebounds and {ctx.apg} assists a game.</p>
      <button className="primary" onClick={() => now(continueNba)}>{seed != null && seed <= 10 ? 'On to the playoffs' : 'The rest of the playoffs'}</button>
    </section>;
  }
  if (m.kind === 'season') {
    const y = n.years.at(-1);
    const hist = world.league.franchiseHistory?.at(-1);
    const per = (v: number) => (y && y.stats.gamesPlayed ? (v / y.stats.gamesPlayed).toFixed(1) : '0');
    return <section className="story-scene">
      <span className="pixel-eyebrow">SEASON {n.years.length} OF {NBA_SEASONS} · {y?.season ? formatSeasonYear(y.season) : ''}</span>
      {seasonHeadline(y) && <p className="story-headline"><PixelIcon name="trophy" size={16} /> {seasonHeadline(y)}</p>}
      <h2>{y ? `${y.teamName}${y.record ? `, ${y.record.w}-${y.record.l}` : ''}` : 'The season'}</h2>
      {y && <p>{y.stats.gamesPlayed} games: {per(y.stats.points)} points, {per(y.stats.oreb + y.stats.dreb)} rebounds, {per(y.stats.ast)} assists a game.{y.finish ? ` ${y.finish}.` : ''}</p>}
      {n.run.length > 0 && <ul className="story-facts">{n.run.map((x, i) => <li key={i}>{x.label}: {x.won ? 'beat' : 'lost to'} {x.opp}{x.games > 1 ? ` ${x.w}-${x.l}` : ''}</li>)}</ul>}
      {y && y.awards.length > 0 && <p className="story-awards"><PixelIcon name="trophy" size={14} /> {y.awards.map(a => a.label).join(' · ')}</p>}
      {hist && <p className="hint-text">Champion: {hist.championTeamName ?? '—'}{hist.mvpPlayerId ? ` · MVP: ${hist.mvpPlayerId}` : ''}</p>}
      <button className="primary" onClick={() => now(continueNba)}>On to the summer</button>
    </section>;
  }
  if (m.kind === 'offers') {
    const offers = nbaOffers(r);
    return <section className="story-scene">
      <span className="pixel-eyebrow">FREE AGENCY</span>
      <h2>Your phone won't stop ringing</h2>
      <p>{ctx.teamId ? 'Your contract is up.' : 'You are a free agent.'} Where do you play next?</p>
      <div className="story-offers">{offers.map((o, i) => <button key={o.teamId} onClick={() => now(x => signNba(x, i))}>
        <span className="pixel-eyebrow">{OFFER_LABEL[o.kind]}</span><b>{o.teamName}</b><small>{o.years} years · {money(o.salary)} a year · {o.wins} wins last season</small></button>)}</div>
      {!offers.length && <button className="primary" onClick={() => now(x => signNba(x, null))}>Take the best minimum deal</button>}
    </section>;
  }
  if (m.kind === 'train') return <section className="story-scene">
    <span className="pixel-eyebrow">THE SUMMER</span>
    <h2>Summer Workouts</h2>
    <p>{ctx.age >= 30 ? 'Age starts taking a little every summer. Training gives some of it back.' : 'The young ones grow every summer on their own. The great ones grow on purpose.'}</p>
    <p className="story-points"><PixelIcon name="flame" size={14} /> {m.points} point{m.points === 1 ? '' : 's'} to spend · each one is +{TRAIN_STEP} to every rating in that area</p>
    <TrainButtons s={s} onPick={cat => now(x => trainNba(x, cat))} />
  </section>;
  if (m.kind === 'lastGame') {
    const c = nbaCareerLine(n);
    return <section className="story-chapter">
      <span className="story-act">THE LAST GAME</span><h2>Fifteen Seasons</h2>
      <p>{c.games} games, {c.ppg} points a game{c.titles ? `, ${c.titles} championship${c.titles === 1 ? '' : 's'}` : ''}{c.allStars ? `, ${c.allStars} All-Star selection${c.allStars === 1 ? '' : 's'}` : ''}. The arena stands for the whole of the last timeout. Mom and Maya are in the front row. So are Dre and Coach Ray.</p>
      <button className="primary hunt-play-big" onClick={() => now(continueNba)}>Walk off the floor</button>
    </section>;
  }
  if (m.kind === 'farewell') return <section className="story-chapter">
    <span className="story-act">THE LAST PAGE</span><h2>Ten Years Later</h2>
    <p>The courts at Carver Park still have one working light. Most Saturdays, somebody is out there at 10 AM, lacing up, asking who has next.</p>
    <button className="primary hunt-play-big" onClick={() => now(continueNba)}>See how it ends</button>
  </section>;
  return null;
}

// ---------------------------------------------------------------- the end

function Ending({ s, endings, onNew, onNba, busy, onExit }: { s: StoryState; endings: StoryEndings; onNew: () => void; onNba: () => void; busy: StoryStatus | null; onExit: () => void }) {
  const e = storyEnding(s);
  const [copied, setCopied] = useState(false);
  const wins = s.games.filter(g => g.won).length;
  const text = storyShareText(s, SITE);
  const c = s.nba ? nbaCareerLine(s.nba) : null;
  const per = (k: 'pts' | 'reb' | 'ast') => (s.games.length ? (s.games.reduce((n, g) => n + g.line[k], 0) / s.games.length).toFixed(1) : '0');
  const good = e.tier === 'legend' || e.tier === 'star';
  return <section className={`hunt-stage hunt-over ${good ? 'won' : 'lost'}`}>
    <div className="hunt-over-banner">
      <span className="pixel-eyebrow">THE END · {s.name.toUpperCase()}</span>
      <h2>{e.title}</h2>
      <div className="story-ending-text">{e.text.split('\n').filter(Boolean).map((line, i) => <p key={i}>{line}</p>)}</div>
      {e.epilogue && <div className="story-epilogue"><span className="pixel-eyebrow">TEN YEARS LATER</span>{e.epilogue.map((line, i) => <p key={i}>{line}</p>)}</div>}
      {c ? <div className="hunt-over-stats">
        <div><small>SEASONS</small><b>{c.seasons}</b></div>
        <div><small>PPG</small><b>{c.ppg}</b></div>
        <div><small>TITLES</small><b>{c.titles}</b></div>
        <div><small>ALL-STAR</small><b>{c.allStars}</b></div>
        <div><small>LEGACY</small><b>{c.legacy}</b></div>
      </div> : <div className="hunt-over-stats">
        <div><small>OVR</small><b>{overall(s)}</b></div>
        <div><small>DRAFT</small><b>{s.draft?.pick ? ordinal(s.draft.pick) : '—'}</b></div>
        <div><small>BIG GAMES</small><b>{wins}-{s.games.length - wins}</b></div>
        <div><small>PER GAME</small><b>{per('pts')}/{per('reb')}/{per('ast')}</b></div>
        <div><small>HYPE</small><b>{s.hype}</b></div>
      </div>}
    </div>
    <RelicReward rewardKey={storyRewardKey(s)} />
    {c && s.nba && <ol className="hunt-log">{s.nba.years.map((y, i) => <li key={i} className={y.awards.some(a => a.key === 'champion') ? 'won' : ''}>Season {i + 1} · {y.teamName}{y.record ? ` (${y.record.w}-${y.record.l})` : ''} <small>· {(y.stats.points / Math.max(1, y.stats.gamesPlayed)).toFixed(1)} PPG{y.awards.length ? ` · ${y.awards.map(a => a.label).join(', ')}` : ''}</small></li>)}</ol>}
    {!c && <ol className="hunt-log">{s.games.map((g, i) => <li key={i} className={g.won ? 'won' : 'lost'}>{g.won ? 'W' : 'L'} {g.us}-{g.them} · {g.title} vs {g.opp} <small>· {g.line.pts} PTS, {g.line.reb} REB, {g.line.ast} AST · grade {g.grade}</small></li>)}</ol>}
    <p className="hint-text">{s.nba && !s.classic
      ? `Endings seen: ${NBA_ENDINGS.filter(id => endings.ids?.[`nba-${id}`]).length} of ${NBA_ENDINGS.length}.`
      : `Endings seen: ${Object.keys(endings.tiers).length} of 4.`} A different path, different choices or a different game style tell a different story.</p>
    {s.classic && <div className="story-y2"><span className="pixel-eyebrow">NEW: THE NBA YEARS</span><b>Take {s.name.split(' ')[0]} into the real NBA</b><p>Fifteen seasons in today's league, every game played: camps, Christmas games, deadlines, All-Star Weekends, playoffs and free agency. Your player, your bonds and your hype carry over.</p>
      <button className="primary" disabled={!!busy} onClick={onNba}>{busy ? `${busy.label}…` : 'Play the NBA years'}</button></div>}
    <div className="contest-actions">
      <button className={s.classic ? '' : 'primary'} onClick={onNew}>New story</button>
      <ShareCardButton tall fileName="story-mode.png" text={text} spec={{
        kicker: `Story Mode · ${s.hometown}`, title: e.title, subtitle: `${s.name} · ${s.draft?.pick ? `#${s.draft.pick} pick` : 'undrafted'} · ${PATHS[s.path ?? 'midmajor'].name}`,
        stats: c ? [{ label: 'Seasons', value: String(c.seasons) }, { label: 'PPG', value: String(c.ppg) }, { label: 'Legacy', value: String(c.legacy) }]
          : [{ label: 'OVR', value: String(overall(s)) }, { label: 'Big games', value: `${wins}-${s.games.length - wins}` }, { label: 'PPG', value: per('pts') }],
        lines: c && s.nba ? s.nba.years.slice(-6).map((y, i, a) => `Season ${s.nba!.years.length - a.length + i + 1}: ${(y.stats.points / Math.max(1, y.stats.gamesPlayed)).toFixed(1)} PPG${y.awards.some(x => x.key === 'champion') ? ' · champion' : ''}`)
          : s.games.slice(-6).map(g => `${g.won ? 'W' : 'L'} ${g.us}-${g.them} ${g.title}`),
        avatar: { playerId: s.name }, accent: e.tier === 'legend' ? 'gold' : 'orange',
      }} />
      <button onClick={() => navigator.clipboard?.writeText(text).then(() => setCopied(true), () => setCopied(false))}>{copied ? 'Copied!' : 'Copy as text'}</button>
      <button onClick={onExit}>Main Menu</button>
    </div>
  </section>;
}
