import { PrivacyLink } from './PrivacyPolicyPage';
import { IS_DESKTOP_BUILD } from '../appMode';
import { DISCORD_URL } from './DiscordLink';
import { CookieSettingsLink } from '../consent/ConsentBanner';
import { ConsentBanner } from '../consent/ConsentBanner';
import { useEffect, useState } from 'react';
import { localProgress, careerProgress, type InProgress } from '../menu/inProgress';
import { modeOfWeek, FEATURED_NAME, WEEKLY_BONUS_CAP } from '../retention/modeOfWeek';
import { PlayerAvatar } from './PlayerAvatar';
import { MyAvatar } from './UserAvatar';
import { PixelBall, PixelIcon } from './PixelIcon';
import type { TradeDifficulty } from '../simulation/gm';
import type { SaveSummary } from '../storage/saves';
import { formatSeasonYear } from '../simulation/calendar';
import { AdBanner } from './AdBanner';
import { weeklyRebuild, weeklyCareer, loadWeeklyRecords, weeklyStreak, weekEndsAt } from '../retention/weekly';
import { WhatsNew } from './WhatsNew';
import { ThemeWelcome, needsThemeChoice } from './ThemePicker';
import { WeeklyBoardDialog } from './WeeklyBoard';
import { cloudEnabled, useAccount } from '../cloud/account';
import { SaveSafetyNudge } from './cloud/SaveSafetyNudge';
import { RivalAlerts } from './cloud/RivalAlerts';
import { WeeklyRecap } from './WeeklyRecap';
import { WelcomeSignIn, needsSignInWelcome } from './cloud/WelcomeSignIn';
import { MenuMasthead } from './MenuMasthead';
import { MenuPhone } from './MenuPhone';
import { totalXp, levelFor, takeLevelUp, unlocksBetween } from '../profile/profile';
import { noteVisit } from '../retention/streak';
import { notePass } from '../retention/pass';
import { TrophyUnlock } from './locker/TrophyUnlock';
import { readArcade, guessStreak, isGuessDone, endlessOf, gridStreak } from '../arcade/storage';
import { weekKey } from '../retention/week';

export type GameMode = 'random' | 'real' | 'legends' | 'perfect' | 'category' | 'career' | 'rebuild' | 'draft' | 'survival' | 'story' | 'timeMachine';
export interface RealLeagueOptions { source: 'history' | 'csv'; realDevelopment: boolean; forceRosters?: boolean; allPlayers?: boolean }

interface Props {
  onStart: (mode: GameMode, difficulty: TradeDifficulty, year: string, leagueName: string, real?: RealLeagueOptions, scenarioId?: string) => void;
  /** Shown while a historical league is being assembled. */
  busy?: string | null;
  saves: SaveSummary[];
  onContinue: (saveId: string) => void;
  onDeleteSave: (saveId: string) => void;
  onRenameSave: (saveId: string, name: string) => void;
  /** Opens the Player Profile at its Trophy room (what the GM Locker was). */
  onLocker?: () => void;
  /** Starts the league a code describes; returns an error message, or null. */
  onCode?: (code: string) => string | null;
  /** Opens Community (online boards, ranked, PvP, friends), at a tab. */
  onCommunity?: (tab?: 'boards' | 'friends') => void;
  /** Opens your player profile. */
  onProfile?: () => void;
  /** The phone's Friends app: the Friends page. */
  onFriends?: () => void;
  /** Opens Settings (backups, graphics, privacy). */
  onSettings?: () => void;
  /** Opens a quick game. */
  onArcade?: (game: 'grid' | 'guess' | 'hilo' | 'bracket' | 'quiz') => void;
  /** Opens the New Franchise page (with a challenge picked, for the Rebuild and the All-Time Draft). */
  onCreate?: (challenge?: 'free' | 'rebuild' | 'draft') => void;
}

/** The cards on the menu. Franchise opens the New Franchise page (a real or random league, the Rebuild Challenge and
 *  the All-Time Draft); the others open their own setup screens. `badge` marks a highlight. */
export type MenuMode = 'franchise' | 'legends' | 'perfect' | 'career' | 'survival' | 'story';
const MODES: { id: MenuMode; title: string; blurb: string; kicker: string; icon: string; time: string; tags: string[]; badge?: 'popular' | 'fun' }[] = [
  {
    id: 'franchise', kicker: '01 / FRANCHISE', icon: 'court', time: 'Unlimited', tags: ['Real NBA', 'Random', 'Challenges'], badge: 'popular',
    title: 'Franchise',
    blurb: 'Run a team in real NBA history from any season since 1946, or in a brand-new random league. Also here: the Rebuild Challenge, the All-Time Draft, Time Machine and the World Games.',
  },
  {
    id: 'legends', kicker: '02 / REIMAGINE', icon: 'trophy', time: '15-30 min a run', tags: ['Roguelike', 'Spins', 'Ranked'], badge: 'popular',
    title: 'League Hunt',
    blurb: 'Spin a six-man squad and a coach from all of history, then win ten best-of-seven series against the great teams of every era. A semi-boss, a boss, three boosts.',
  },
  {
    id: 'perfect', kicker: '03 / PERFECT', icon: 'star', time: '5-10 min', tags: ['Spins', 'Categories', 'Quick'], badge: 'fun',
    title: '82-0 Challenge',
    blurb: 'Spin ten players and a coach, pick one from each franchise-and-era roll, or draft from a category (MVPs, 90s players, the Lakers...). Play all 82 against real teams and the 72-10 Bulls and 73-9 Warriors, then the playoffs. Go 82-0. Then 16-0.',
  },
  {
    id: 'career', kicker: '04 / BECOME', icon: 'star', time: '5-15 min', tags: ['Single player', 'Story', 'Spins'], badge: 'fun',
    title: 'Career Mode',
    blurb: 'Create one player (spin the wheel of NBA history or build him yourself) and live his whole career in today\'s league: draft night, training, free agency, awards, the Hall of Fame and the all-time Top 100.',
  },
  {
    id: 'survival', kicker: '05 / SURVIVE', icon: 'flame', time: '10-20 min', tags: ['New', 'Roguelike', 'Daily'],
    title: 'Survival',
    blurb: 'Start with ten all-time greats. Beat a real team from history and they take one of your best; sign one of theirs. Tougher teams every round, a champion every fifth. One loss and it\'s over. How long can you last?',
  },
  {
    id: 'story', kicker: '06 / STORY', icon: 'calendar', time: '20-40 min', tags: ['New', 'Story', 'Choices'],
    title: 'Story Mode',
    blurb: 'Street to the League: from a park with no nets to your NBA rookie season. Five chapters, real choices, key games on the real engine, a best friend, a mentor, a rival named Ice, and four endings.',
  },
];
/** The menu card a Mode of the Week falls under. */
const cardOf = (m: string): MenuMode => (m === 'rebuild' || m === 'draft' || m === 'real' || m === 'random' || m === 'timeMachine' ? 'franchise' : m === 'category' ? 'perfect' : m as MenuMode);
const BADGE_LABEL = { popular: 'Most popular', fun: 'Most fun' } as const;

function formatWhen(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function SavedLeaguesList({ saves, onContinue, onDeleteSave, onRenameSave }: Pick<Props, 'saves' | 'onContinue' | 'onDeleteSave' | 'onRenameSave'>) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (saves.length === 0) return null;

  return (
    <div className="saved-leagues">
      <h4>Your Leagues</h4>
      <div className="saved-leagues-list">
        {saves.map((s) => (
          <div key={s.id} className="saved-league-row">
            {renamingId === s.id ? (
              <input
                className="year-input" value={renameValue} autoFocus
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { onRenameSave(s.id, renameValue); setRenamingId(null); }
                  if (e.key === 'Escape') setRenamingId(null);
                }}
                onBlur={() => { onRenameSave(s.id, renameValue); setRenamingId(null); }}
              />
            ) : (
              <div className="saved-league-info" onClick={() => onContinue(s.id)}>
                <strong>{s.name}</strong>
                <span className="hint-text">
                  {s.season ? formatSeasonYear(s.season) : 'No season yet'} · {s.teamCount} teams{s.controlledTeamName ? ` · ${s.controlledTeamName}` : ''} · {formatWhen(s.updatedAt)}
                </span>
              </div>
            )}
            <div className="saved-league-actions">
              <button className="primary" onClick={() => onContinue(s.id)}>Continue</button>
              <button onClick={() => { setRenamingId(s.id); setRenameValue(s.name); }}>Rename</button>
              {confirmDeleteId === s.id ? (
                <>
                  <button className="danger" onClick={() => { onDeleteSave(s.id); setConfirmDeleteId(null); }}>Confirm Delete</button>
                  <button onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                </>
              ) : (
                <button onClick={() => setConfirmDeleteId(s.id)}>Delete</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MainMenu({ onStart, saves, onContinue, onDeleteSave, onRenameSave, busy = null, onLocker, onCode, onCommunity, onProfile, onFriends, onSettings, onArcade, onCreate }: Props) {
  // First visit: pick a look before anything else; What's New waits until it is picked.
  const [pickLook, setPickLook] = useState(needsThemeChoice);
  // Today's visit counts for the daily streak and the Season Pass.
  const [visit] = useState<Visit>(() => ({ v: noteVisit(), p: notePass(totalXp()) }));
  // Then (accounts on, signed out, first time): sign in, or carry on without an account.
  const account = useAccount();
  const [askSignIn, setAskSignIn] = useState(true);
  const showSignIn = askSignIn && needsSignInWelcome(account.status);
  // A first click picks a card (its Play button appears); Play (or a second click) opens the mode's setup.
  const [selectedMode, setSelectedMode] = useState<MenuMode | null>(null);
  // Runs in progress, for the Continue chips (careers live in their own database, read after the menu shows).
  const [progress, setProgress] = useState<InProgress>(() => localProgress());
  useEffect(() => {
    let live = true;
    import('../career/storage').then(m => m.listCareers()).then(list => { const c = careerProgress(list); if (live && c) setProgress(p => ({ ...p, career: c })); }, () => {});
    return () => { live = false; };
  }, []);
  const progressOf = (m: MenuMode) => (m === 'franchise' ? progress.rebuild ?? progress.draft ?? progress.real ?? progress.random : progress[m]);
  const [featured] = useState(() => modeOfWeek());
  const play = (m: MenuMode) => {
    if (busy) return;
    if (m === 'franchise') { if (onCreate) onCreate(); return; }
    onStart(m, 'normal', '', '');
  };
  // Escape lets go of the picked card.
  useEffect(() => {
    if (!selectedMode) return;
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedMode(null); };
    window.addEventListener('keydown', on); return () => window.removeEventListener('keydown', on);
  }, [selectedMode]);

  return (
    <div className="main-menu">
      <MenuMasthead onProfile={onProfile ?? onLocker} onCommunity={onCommunity && (() => onCommunity('boards'))} onSettings={onSettings} />
      <SaveSafetyNudge />
      <RivalAlerts />
      <WeeklyRecap />
      <div className="menu-hero">
        <div className="menu-hero-copy"><span className="pixel-eyebrow">BUILD A TEAM. WRITE ITS HISTORY.</span><h1>Your league.<br /><span>Your legacy.</span></h1><p>Scout the next great. Build your starting five.<br />Turn one season into a dynasty.</p></div>
        <div className="menu-player-scene" aria-hidden="true">
          <span className="menu-court-line" />
          <PlayerAvatar playerId="Court Vision Guard" primaryColor="#386bba" secondaryColor="#fff0cf" jerseyNumber={30} size={100} />
          <MyAvatar size={150} className="menu-you" title="Your character" />
          <PlayerAvatar playerId="Court Vision Center" primaryColor="#ec852b" secondaryColor="#fcdfad" jerseyNumber={23} size={100} />
          <PixelBall size={48} />
        </div>
      </div>

      <MenuPhone onBoards={onCommunity && (() => onCommunity('boards'))} onFriends={onFriends ?? (onCommunity && (() => onCommunity('friends')))} onProfile={onProfile ?? onLocker} streak={visit.v.streak} />

      <div className="menu-section-heading"><h2>Choose your game</h2><span>PICK ONE, THEN PRESS PLAY</span></div>

      <div className="mode-grid">
        {MODES.map((m) => {
          const picked = selectedMode === m.id, inProgress = progressOf(m.id), hot = cardOf(featured) === m.id;
          return <div key={m.id} className={`mode-card-wrap ${picked ? 'picked' : ''}`}>
            <button
              className={`mode-card ${picked ? 'selected' : ''}`}
              onClick={() => (picked ? play(m.id) : setSelectedMode(m.id))}
              aria-pressed={picked}
              aria-describedby={picked ? `mode-play-${m.id}` : undefined}
            >
              <span className="mode-card-kicker"><PixelIcon name={m.icon} size={24} /><span>{m.kicker}</span>{(m.badge || hot) && <span className="mode-flags">{hot && <span className="mode-xp" title={`Mode of the Week: double XP for ${FEATURED_NAME[featured]} runs finished this week`}>2× XP</span>}{m.badge && <span className={`mode-badge mode-badge-${m.badge}`}><PixelIcon name={m.badge === 'popular' ? 'flame' : 'star'} size={12} /> {BADGE_LABEL[m.badge]}</span>}</span>}<span className="mode-selection-dot" /></span>
              <h3>{m.title}</h3>
              <p>{m.blurb}</p>
              {inProgress && <span className="mode-continue"><PixelIcon name="play" size={12} /> In progress: {inProgress}</span>}
              <span className="mode-meta"><span className="mode-time" title="How long a sitting takes"><PixelIcon name="clock" size={12} /> {m.time}</span>{m.tags.map(t => <span key={t} className="mode-tag">{t}</span>)}</span>
            </button>
            {picked && <button id={`mode-play-${m.id}`} className="primary mode-play" disabled={!!busy} onClick={() => play(m.id)} autoFocus>
              <PixelIcon name="play" size={14} /> {busy ?? (inProgress && m.id !== 'franchise' ? 'Continue' : m.id === 'franchise' ? 'Play: set up a league' : 'Play')}
            </button>}
          </div>;
        })}
        {/* Room for the next modes. */}
        {[7].map(n => <div key={n} className="mode-card-wrap soon">
          <button className="mode-card mode-soon" disabled aria-label="Coming soon">
            <span className="mode-card-kicker"><PixelIcon name="lock" size={24} /><span>0{n} / SOON</span></span>
            <h3>Coming soon</h3>
            <p>A new way to play is on the way. Watch What's New and Discord for the reveal.</p>
            <span className="mode-meta"><span className="mode-tag">Coming soon</span></span>
          </button>
        </div>)}
      </div>

      {onArcade && <QuickGames onOpen={onArcade} />}

      <SavedLeaguesList saves={saves} onContinue={onContinue} onDeleteSave={onDeleteSave} onRenameSave={onRenameSave} />


      {onCode && <CodeEntry busy={busy} onCode={onCode} />}


      <ThisWeek onCommunity={onCommunity} busy={busy} onFeatured={() => { setSelectedMode(cardOf(featured)); document.querySelector('.mode-grid')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} onRebuild={() => onStart('rebuild', 'normal', '', '', undefined, 'weekly')} onCareer={() => onStart('career', 'normal', '', '')} onHunt={() => onStart('legends', 'normal', '', '')} />

      <AdBanner slot="menu" />
      <footer className="legal-footer">{!IS_DESKTOP_BUILD && <><a href="/how-to-play.html">How to Play</a> · <a href="/guides/">Guides</a> · <a href="/faq.html">FAQ</a> · <a href="/about.html">About</a> · <a href="/changelog.html">What's new</a> · </>}<PrivacyLink /> · <CookieSettingsLink /> · <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer">Discord</a>{onSettings && <> · <button className="link-button" onClick={onSettings}>Settings</button></>}</footer>
      <LevelUpNote onProfile={onProfile ?? onLocker} />
      <StreakNote visit={visit} onProfile={onProfile ?? onLocker} />
      <TrophyUnlock onProfile={onProfile ?? onLocker} />
      <ConsentBanner />
      {pickLook ? <ThemeWelcome onDone={() => setPickLook(false)} /> : showSignIn ? <WelcomeSignIn onDone={() => setAskSignIn(false)} /> : <WhatsNew />}
    </div>
  );
}

/** This week: the Rebuild and Career of the Week (same seed for everyone until Monday) and the Daily Legend. */
function ThisWeek({ busy, onRebuild, onCareer, onHunt, onCommunity, onFeatured }: { busy: string | null; onRebuild: () => void; onCareer: () => void; onHunt: () => void; onCommunity?: () => void; onFeatured: () => void }) {
  const featured = modeOfWeek();
  const [now] = useState(() => new Date());
  const [board, setBoard] = useState(false);
  const rb = weeklyRebuild(), cw = weeklyCareer();
  const rec = loadWeeklyRecords()[rb.week];
  const streak = weeklyStreak();
  const days = Math.max(1, Math.ceil((weekEndsAt(now) - now.getTime()) / 86_400_000));
  return <section className="this-week" aria-label="This week's challenges">
    <div className="this-week-head"><h2>This week</h2><span>{rb.week} · new challenges in {days} day{days === 1 ? '' : 's'}{streak > 1 ? ` · ${streak}-week streak` : ''}</span>{cloudEnabled && <button className="link-button" onClick={() => setBoard(true)}>Leaderboard</button>}</div>
    {board && <WeeklyBoardDialog onClose={() => setBoard(false)} onCommunity={onCommunity} />}
    <article className="mode-of-week"><span className="pixel-eyebrow">MODE OF THE WEEK · DOUBLE XP</span><b>{FEATURED_NAME[featured]}</b>
      <p>Every {FEATURED_NAME[featured]} run you finish this week earns its XP twice (up to {WEEKLY_BONUS_CAP.toLocaleString()} bonus XP). A new mode every Monday.</p>
      <button className="primary" onClick={onFeatured}>Play {FEATURED_NAME[featured]}</button></article>
    <div className="this-week-grid">
      <article><span className="pixel-eyebrow">REBUILD OF THE WEEK</span><b>{rb.scenario.title}</b>
        <p>{rb.scenario.startYear}-{String(rb.scenario.startYear + 1).slice(2)} {rb.scenario.team} · {rb.seasons} seasons · <em>{rb.twist.label}</em>. {rb.twist.id === 'standard' ? 'The same league for everyone.' : `${rb.twist.blurb} The same league for everyone.`}</p>
        <small>{rec?.rebuild ? `Your best: ${rec.rebuild.best.toLocaleString()} ${'★'.repeat(rec.rebuild.stars ?? 0)}` : 'Not played yet'}</small>
        <button className="primary" disabled={!!busy} onClick={onRebuild}>{busy ?? 'Take the job'}</button></article>
      <article><span className="pixel-eyebrow">CAREER OF THE WEEK</span><b>{cw.draftYear ? `The ${cw.draftYear} draft` : 'The 2026 draft'}</b>
        <p>Everyone spins the same wheel in the same league. Chase the best Legacy Score.</p>
        <small>{rec?.career ? `Your best: Legacy ${rec.career.best}` : 'Not played yet'}</small>
        <button onClick={onCareer}>Career Mode</button></article>
      <article><span className="pixel-eyebrow">DAILY LEGEND</span><b>One hunt, every day</b>
        <p>A League Hunt with a shared draft and road, new at midnight UTC.</p>
        <button onClick={onHunt}>League Hunt</button></article>
    </div>
  </section>;
}

type Visit = { v: ReturnType<typeof noteVisit>; p: ReturnType<typeof notePass> };
/** A note when today's visit reaches a streak reward or a Season Pass tier. */
function StreakNote({ visit, onProfile }: { visit: Visit; onProfile?: () => void }) {
  const [open, setOpen] = useState(true);
  const { v, p } = visit;
  const got = [...v.reached.map(r => r.title ? `the "${r.title}" title` : `${r.trophies.toLocaleString()} trophies`), ...(p.newTiers.length ? [`Season Pass tier ${p.tier}`] : [])];
  if (!open || !got.length) return null;
  return <div className="level-up level-up-corner streak-note" role="status"><b>{v.reached.length ? `${v.streak.best}-DAY STREAK` : 'SEASON PASS'}</b><span>You reached {got.join(' and ')}.</span>
    {onProfile && <button onClick={onProfile}>See your rewards</button>}<button className="link-button" onClick={() => setOpen(false)}>Close</button></div>;
}

/** Level up since the last visit to the menu: what it unlocked. */
function LevelUpNote({ onProfile }: { onProfile?: () => void }) {
  const [up] = useState(() => takeLevelUp(levelFor(totalXp()).level));
  const [open, setOpen] = useState(true);
  if (!up || !open) return null;
  const unlocks = unlocksBetween(up.from, up.to);
  return <div className="level-up level-up-corner" role="status"><b>LEVEL UP · LV {up.to}</b><span>{unlocks.length ? `Unlocked ${unlocks.slice(0, 3).join(', ')}${unlocks.length > 3 ? ` and ${unlocks.length - 3} more` : ''}.` : 'Keep going: new unlocks are on the way.'}</span>
    {onProfile && unlocks.length > 0 && <button onClick={onProfile}>Equip in your profile</button>}<button className="link-button" onClick={() => setOpen(false)}>Close</button></div>;
}

/** "Have a league code?": a friend's league, same rosters, draft classes and schedule. */
function CodeEntry({ busy, onCode }: { busy: string | null; onCode: (code: string) => string | null }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  return <form className="code-entry" onSubmit={e => { e.preventDefault(); if (code.trim()) setError(onCode(code)); }}>
    <label htmlFor="league-code"><b>Have a league code?</b> <span>Play the exact league a friend started: same rosters, draft classes and schedule.</span></label>
    <div><input id="league-code" className="year-input" value={code} onChange={e => { setCode(e.target.value); setError(null); }} placeholder="e.g. H2016-A-4K2J9Z-LAL-7" autoComplete="off" spellCheck={false} />
      <button className="primary" type="submit" disabled={!!busy || !code.trim()}>{busy ?? 'Start'}</button></div>
    {error && <p className="backup-msg err" role="alert">{error}</p>}
  </form>;
}

/** The quick games strip under the modes: today's puzzle, your streak, this week's bracket. */
function QuickGames({ onOpen }: { onOpen: (game: 'grid' | 'guess' | 'hilo' | 'bracket' | 'quiz') => void }) {
  const [r] = useState(readArcade);
  const today = new Date().toISOString().slice(0, 10), week = weekKey();
  const day = r.guess[today], streak = guessStreak(r, today).current, bracket = r.bracket[week], quiz = endlessOf(r).quiz;
  const grid = r.grid?.[today], gridDone = !!grid && (grid.used >= 9 || grid.cells.every(Boolean)), gridRun = gridStreak(r, today).current;
  const games = [
    { id: 'grid' as const, icon: 'list', title: 'Daily Grid', blurb: 'Three teams, three categories. Fill all nine squares.', status: gridDone ? `${grid!.cells.filter(Boolean).length}/9 today · endless open` : 'New grid today', extra: gridRun ? `${gridRun}-day streak` : null },
    { id: 'guess' as const, icon: 'search', title: 'Guess the Player', blurb: 'A daily player for everyone, then endless rounds.', status: isGuessDone(day) ? (day!.won ? `Solved in ${day!.guesses.length} · endless open` : 'Missed today · endless open') : 'New puzzle today', extra: streak ? `${streak}-day streak` : null },
    { id: 'hilo' as const, icon: 'up', title: 'Higher or Lower', blurb: 'Career numbers, head to head. How long can you go?', status: r.hilo.best ? `Best streak ${r.hilo.best}` : 'Set your first streak', extra: null },
    { id: 'bracket' as const, icon: 'trophy', title: 'Bracket Challenge', blurb: 'Sixteen all-time teams. Weekly, or random any time.', status: bracket?.played ? `${bracket.score} pts this week` : bracket?.locked ? 'Picks locked' : 'New bracket this week', extra: null },
    { id: 'quiz' as const, icon: 'star', title: 'NBA Quiz', blurb: 'Ten questions on titles, MVPs, picks and legends.', status: quiz.best ? `Best round ${quiz.best.toLocaleString()}` : 'A new round every time', extra: null },
  ];
  return <section className="quick-games" aria-labelledby="quick-games-title">
    <div className="menu-section-heading"><h2 id="quick-games-title">Quick games</h2><span>REAL NBA HISTORY · 2 MINUTES</span></div>
    <div className="quick-games-grid">{games.map(g => <button key={g.id} className="quick-game" onClick={() => onOpen(g.id)}>
      <PixelIcon name={g.icon} size={24} /><b>{g.title}</b><small>{g.blurb}</small><em>{g.status}{g.extra ? ` · ${g.extra}` : ''}</em>
    </button>)}</div>
  </section>;
}
