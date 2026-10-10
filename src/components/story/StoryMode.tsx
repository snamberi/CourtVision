import { useRef, useState } from 'react';
import {
  newStory, currentBeat, continueStory, choose, spendTraining, choosePath, runDraft, playStoryGame, ending, overall, storyShareText, chapterOf, ordinal,
  loadStory, saveStory, loadEndings, recordEnding, STYLES, HOMETOWNS, PATHS, TRAINABLE, TRAIN_STEP, SCRIPT,
  type StoryState, type StoryStyle, type StoryGame, type Path, type StoryEndings,
} from '../../story/story';
import { CATEGORY_BY_ID, categoryScore, categoryValues } from '../../career/categories';
import { PlayerAvatar } from '../PlayerAvatar';
import { PixelIcon } from '../PixelIcon';
import { ShareCardButton } from '../ShareCardButton';
import { track, trackOnce } from '../../analytics/track';
import { noteWeekRun } from '../../retention/weekLog';
import '../hunt/hunt.css';
import './story.css';

const SITE = 'https://courtvisiongame.com';
const ACTS = SCRIPT.filter(b => b.kind === 'chapter').length;
const newSeed = () => Math.floor(Math.random() * 1_000_000_000);
const BOND_LABEL = (n: number) => (n >= 5 ? 'Family' : n >= 3 ? 'Close' : n >= 1 ? 'Friendly' : n >= -1 ? 'Distant' : 'Cold');
const RIVAL_LABEL = (n: number) => (n >= 2 ? 'Respect' : n >= 0 ? 'Rivals' : n >= -2 ? 'Bad blood' : 'Enemies');

/** Story Mode: Street to the League. */
export function StoryMode({ onExit }: { onExit: () => void }) {
  const [story, setStoryState] = useState<StoryState | null>(loadStory);
  const [endings, setEndings] = useState<StoryEndings>(loadEndings);
  const [lastGame, setLastGame] = useState<StoryGame | null>(null);
  const current = useRef(story);
  const setStory = (s: StoryState | null) => {
    const prev = current.current;
    current.current = s;
    setStoryState(s);
    saveStory(s);
    if (s && s.done && prev && !prev.done) {
      setEndings(recordEnding(s));
      noteWeekRun('story', { score: Math.round(overall(s) * 10 + s.games.filter(g => g.won).length * 50), line: ending(s).title }, `story-${s.seed}`);
      trackOnce(`story-${s.seed}`, 'mode_finish', { mode: 'story', ending: ending(s).tier });
    }
  };
  const act = (fn: (s: StoryState) => StoryState, game = false) => {
    if (!story) return;
    const next = fn(story);
    setLastGame(game && next.games.length > story.games.length ? next.games.at(-1)! : null);
    setStory(next);
  };
  const header = <header className="hunt-top">
    <button className="hunt-exit" onClick={onExit}><PixelIcon name="exit" size={16} /> Main Menu</button>
    <div className="hunt-title"><span className="pixel-eyebrow">{story && !story.done ? `ACT ${chapterOf(story)?.act ?? 1} OF ${ACTS} · ${(chapterOf(story)?.title ?? '').toUpperCase()}` : 'STREET TO THE LEAGUE'}</span><h1>Story Mode</h1></div>
    {story && !story.done && <button className="hunt-exit" onClick={() => { if (window.confirm('Start over? This story will be lost.')) { setStory(null); setLastGame(null); } }}>Start over</button>}
  </header>;
  return <div className="hunt story">
    {header}
    {!story ? <Create endings={endings} onStart={(name, style, town) => { track('mode_start', { mode: 'story', style }); setStory(newStory(newSeed(), name, style, town)); }} />
      : story.done ? <Ending s={story} endings={endings} onNew={() => { setStory(null); setLastGame(null); }} onExit={onExit} />
      : <div className="story-layout">
          <HeroPanel s={story} />
          <main className="story-main">
            {story.last && <div className={`story-last ${lastGame ? (lastGame.won ? 'won' : 'lost') : ''}`} role="status">
              {lastGame && <GameLine g={lastGame} />}
              <p>{story.last}</p>
            </div>}
            <BeatView s={story} act={act} />
          </main>
        </div>}
  </div>;
}

function Create({ endings, onStart }: { endings: StoryEndings; onStart: (name: string, style: StoryStyle, town: string) => void }) {
  const [name, setName] = useState('');
  const [style, setStyle] = useState<StoryStyle>('scorer');
  const [town, setTown] = useState(HOMETOWNS[0]);
  return <section className="hunt-stage story-create">
    <div className="story-pitch">
      <span className="pixel-eyebrow">FIVE CHAPTERS · ONE PLAYER · YOUR CHOICES</span>
      <h2>From the park to the NBA</h2>
      <p>You're sixteen, from {town}, and nobody knows your name. Win at the park, make varsity, choose a college (or Europe), survive draft night and your rookie year. Your best friend Dre, Coach Ray and your rival Marcus "Ice" Vance are with you the whole way. Key games are played by the real game engine with you on the floor. Your choices, your games and the people you keep close decide how it ends.</p>
    </div>
    <div className="cv-panel">
      <label className="story-field"><span>Your name</span><input className="year-input" maxLength={24} value={name} placeholder="Jaylen Carter" onChange={e => setName(e.target.value)} /></label>
      <h3 className="hunt-subhead">Your game</h3>
      <div className="story-styles" role="radiogroup" aria-label="Your game">{(Object.keys(STYLES) as StoryStyle[]).map(k => <button key={k} role="radio" aria-checked={style === k} className={style === k ? 'active' : ''} onClick={() => setStyle(k)}>
        <b>{STYLES[k].name}</b><small>{STYLES[k].pos} · {STYLES[k].blurb}</small></button>)}</div>
      <label className="story-field"><span>Hometown</span><select className="year-input" value={town} onChange={e => setTown(e.target.value)}>{HOMETOWNS.map(t => <option key={t}>{t}</option>)}</select></label>
      <div className="contest-actions"><button className="primary hunt-play" onClick={() => onStart(name || 'Jaylen Carter', style, town)}><PixelIcon name="play" size={16} /> Begin the story</button></div>
      {endings.finished > 0 && <p className="hint-text">Stories finished: {endings.finished} · endings seen: {Object.keys(endings.tiers).length} of 4</p>}
    </div>
  </section>;
}

function Meter({ label, value, max, hint }: { label: string; value: number; max: number; hint?: string }) {
  return <div className="story-meter"><span>{label}</span><div className="hunt-cap-bar"><i style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} /></div><b>{hint ?? value}</b></div>;
}

function HeroPanel({ s }: { s: StoryState }) {
  const ch = chapterOf(s);
  return <aside className="story-hero" aria-label="Your player">
    <PlayerAvatar playerId={s.name} primaryColor="#f47b20" secondaryColor="#f4f0e6" jerseyNumber={s.hero.jerseyNumber} size={84} />
    <div className="story-hero-name"><b>{s.name}</b><small>{STYLES[s.style].pos} · {STYLES[s.style].name} · age {s.hero.age} · {s.hometown}</small></div>
    <div className="story-ovr"><small>OVR</small><b className="hunt-rating">{overall(s)}</b></div>
    <Meter label="Hype" value={s.hype} max={30} />
    <Meter label="Grit" value={s.grit} max={15} />
    <ul className="story-bonds">
      <li><b>Dre</b> <small>best friend</small><span>{BOND_LABEL(s.bonds.dre)}</span></li>
      <li><b>Coach Ray</b> <small>mentor</small><span>{BOND_LABEL(s.bonds.ray)}</span></li>
      <li><b>Ice Vance</b> <small>rival</small><span>{RIVAL_LABEL(s.bonds.ice)}</span></li>
    </ul>
    <ol className="story-acts" aria-label="Chapters">{SCRIPT.filter(b => b.kind === 'chapter').map(b => b.kind === 'chapter' && <li key={b.id} className={ch && b.act < ch.act ? 'done' : ch?.act === b.act ? 'now' : ''}>{b.act}. {b.title}</li>)}</ol>
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

function BeatView({ s, act }: { s: StoryState; act: (fn: (s: StoryState) => StoryState, game?: boolean) => void }) {
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
    <div className="story-train">{TRAINABLE.map(cat => { const c = CATEGORY_BY_ID.get(cat)!; return <button key={cat} onClick={() => act(x => spendTraining(x, cat))}>
      <b>{c.name}</b><small>{categoryScore(categoryValues(s.hero, cat))}</small></button>; })}</div>
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
    <p>The commissioner walks to the podium. Your mom grabs your hand. Ice is two tables away, staring at the ceiling.</p>
    <button className="primary hunt-play-big" onClick={() => act(runDraft)}>Hear your name</button>
  </section>;
  return null;
}

function Ending({ s, endings, onNew, onExit }: { s: StoryState; endings: StoryEndings; onNew: () => void; onExit: () => void }) {
  const e = ending(s);
  const [copied, setCopied] = useState(false);
  const wins = s.games.filter(g => g.won).length;
  const text = storyShareText(s, SITE);
  const per = (k: 'pts' | 'reb' | 'ast') => (s.games.length ? (s.games.reduce((n, g) => n + g.line[k], 0) / s.games.length).toFixed(1) : '0');
  return <section className={`hunt-stage hunt-over ${e.tier === 'legend' || e.tier === 'star' ? 'won' : 'lost'}`}>
    <div className="hunt-over-banner">
      <span className="pixel-eyebrow">THE END · {s.name.toUpperCase()}</span>
      <h2>{e.title}</h2>
      <div className="story-ending-text">{e.text.split('\n').filter(Boolean).map((line, i) => <p key={i}>{line}</p>)}</div>
      <div className="hunt-over-stats">
        <div><small>OVR</small><b>{overall(s)}</b></div>
        <div><small>DRAFT</small><b>{s.draft?.pick ? ordinal(s.draft.pick) : '—'}</b></div>
        <div><small>BIG GAMES</small><b>{wins}-{s.games.length - wins}</b></div>
        <div><small>PER GAME</small><b>{per('pts')}/{per('reb')}/{per('ast')}</b></div>
        <div><small>HYPE</small><b>{s.hype}</b></div>
      </div>
    </div>
    <ol className="hunt-log">{s.games.map((g, i) => <li key={i} className={g.won ? 'won' : 'lost'}>{g.won ? 'W' : 'L'} {g.us}-{g.them} · {g.title} vs {g.opp} <small>· {g.line.pts} PTS, {g.line.reb} REB, {g.line.ast} AST · grade {g.grade}</small></li>)}</ol>
    <p className="hint-text">Endings seen: {Object.keys(endings.tiers).length} of 4 (The Legend Begins, A Star Is Born, A Pro, The Long Way Up). Different choices, a different path or a different game style tell a different story.</p>
    <div className="contest-actions">
      <button className="primary" onClick={onNew}>New story</button>
      <ShareCardButton tall fileName="story-mode.png" text={text} spec={{
        kicker: `Story Mode · ${s.hometown}`, title: e.title, subtitle: `${s.name} · ${s.draft?.pick ? `#${s.draft.pick} pick` : 'undrafted'} · ${PATHS[s.path ?? 'midmajor'].name}`,
        stats: [{ label: 'OVR', value: String(overall(s)) }, { label: 'Big games', value: `${wins}-${s.games.length - wins}` }, { label: 'PPG', value: per('pts') }],
        lines: s.games.slice(-6).map(g => `${g.won ? 'W' : 'L'} ${g.us}-${g.them} ${g.title}`), avatar: { playerId: s.name }, accent: e.tier === 'legend' ? 'gold' : 'orange',
      }} />
      <button onClick={() => navigator.clipboard?.writeText(text).then(() => setCopied(true), () => setCopied(false))}>{copied ? 'Copied!' : 'Copy as text'}</button>
      <button onClick={onExit}>Main Menu</button>
    </div>
  </section>;
}
