import { ModeIcon } from './ModeIcon';
import { PrivacyLink } from './PrivacyLink';
import { activeHoliday, daysLeft as holidayDaysLeft, eventCoins, loadHoliday } from '../retention/holiday';
import type { CSSProperties } from 'react';
import { IS_DESKTOP_BUILD } from '../appMode';
import { DISCORD_URL } from './DiscordLink';
import { CookieSettingsLink } from '../consent/ConsentBanner';
import { ConsentBanner } from '../consent/ConsentBanner';
import { lazy, Suspense, useEffect, useState } from 'react';
import { localProgress, careerProgress, type InProgress } from '../menu/inProgress';
import { modeOfWeek, FEATURED_NAME, WEEKLY_BONUS_CAP } from '../retention/modeOfWeek';
import { PlayerAvatar } from './PlayerAvatar';
import { MyAvatar } from './UserAvatar';
import { PixelBall, PixelIcon } from './PixelIcon';
import { grantLuckySpins, loadRelics, saveRelics, collectDailyCoins, totalLuck, collectionProgress, RELICS_EVENT } from '../relics/relics';
import { claimAchievementSpins, paySeasonRewards } from '../relics/rewards';
import { claimStreakBonus, noteSeason, daysLeft, nextSeason, daysUntil, SEASON_TIERS } from '../retention/season';
import './roads/menuSeason.css';
import { UpdateBanner } from './UpdateBanner';
import { weeklyEvent } from '../retention/weeklyEvent';
// Loaded only when a tier unlocks something (it pulls in every cosmetic preview).
const SeasonTierUp = lazy(() => import('./roads/SeasonTierUp').then(m => ({ default: m.SeasonTierUp })));
import './relics/relics.css';
import type { TradeDifficulty } from '../simulation/gm';
import type { SaveSummary } from '../storage/saves';
import { formatSeasonYear } from '../simulation/calendar';
import { MODE_SHORT, modeRecords } from '../menu/modePresentation';
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
import { ModeArt, ModeCard } from './ModeCard';
import { burst } from '../fx/effects';
import { modeById, modesIn, subModesOf, type ModeEntry } from '../menu/modeCatalog';
import { totalXp, levelFor, takeLevelUp, unlocksBetween } from '../profile/profile';
import { noteVisit } from '../retention/streak';
import { notePass } from '../retention/pass';
import { TrophyUnlock } from './locker/TrophyUnlock';
import { readArcade, guessStreak, isGuessDone, endlessOf, gridStreak } from '../arcade/storage';
import { challengeFor, challengeStreak, claimChallenge, readChallenge, today as challengeToday, CHALLENGE_INFO, type ChallengeMode } from '../retention/dailyChallenge';
import { weekKey } from '../retention/week';

export type GameMode = 'random' | 'real' | 'legends' | 'perfect' | 'category' | 'career' | 'rebuild' | 'draft' | 'survival' | 'story' | 'timeMachine';
export interface RealLeagueOptions { source: 'history' | 'csv'; realDevelopment: boolean; forceRosters?: boolean; allPlayers?: boolean }

interface Props {
  onStart: (mode: GameMode, difficulty: TradeDifficulty, year: string, leagueName: string, real?: RealLeagueOptions, scenarioId?: string) => void;
  /** Shown while a historical league is being assembled. */
  busy?: string | null;
  saves: SaveSummary[];
  onOpenContinue: () => void;
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
  /** The phone's Friend list app (friends and free daily gifts). */
  onFriendList?: () => void;
  /** The phone's Closet app (your character and every cosmetic). */
  onCloset?: () => void;
  /** Opens Settings (backups, graphics, privacy). */
  onSettings?: () => void;
  /** Opens a quick game. */
  onArcade?: (game: 'grid' | 'guess' | 'hilo' | 'bracket' | 'quiz') => void;
  /** Opens any mode or sub-mode card (src/menu/modeCatalog.ts). */
  onOpenMode?: (entry: ModeEntry) => void;
  /** Opens the New Franchise page (with a challenge picked, for the Rebuild and the All-Time Draft). */
  onCreate?: (challenge?: 'free' | 'rebuild' | 'draft') => void;
  /** Opens the Relic Vault. */
  onRelics?: () => void;
  /** Opens the Relic Shop page (the phone's Shop app). */
  onShop?: () => void;
  /** Opens the Level Road, the Trophy Road or the Season Pass page (phone apps). */
  onRoad?: (road: 'level' | 'trophy' | 'season') => void;
  /** Opens your profile at a tab (the phone's Achievements app). */
  onProfileTab?: (tab: 'achievements') => void;
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

export function MainMenu({ onStart, saves, onOpenContinue, busy = null, onLocker, onCode, onCommunity, onProfile, onFriends, onFriendList, onCloset, onSettings, onArcade, onCreate, onRelics, onShop, onRoad, onProfileTab, onOpenMode }: Props) {
  // First visit: pick a look before anything else; What's New waits until it is picked.
  const [pickLook, setPickLook] = useState(needsThemeChoice);
  // Today's visit counts for the daily streak and the Season Pass.
  const [visit] = useState<Visit>(() => ({ v: noteVisit(), p: notePass(totalXp()) }));
  // The Season Pass pays a free Lucky Spin for each new tier (once each) as soon as you're back on the menu.
  // The daily streak tops up the pass first, so a streak bonus that crosses a tier pays straight away.
  const [seasonPay, setSeasonPay] = useState(() => { try { claimStreakBonus(visit.v.streak.current, totalXp()); return paySeasonRewards(totalXp()); } catch { return { spins: 0, cosmetics: [] }; } });
  // Then (accounts on, signed out, first time): sign in, or carry on without an account.
  const account = useAccount();
  const [askSignIn, setAskSignIn] = useState(true);
  const showSignIn = askSignIn && needsSignInWelcome(account.status);
  // Selecting a card reveals its actions and the available ways to play.
  const [selectedMode, setSelectedMode] = useState<MenuMode | null>(null);
  useEffect(() => {
    if (!selectedMode || !window.matchMedia('(max-width: 720px)').matches) return;
    const timer = window.setTimeout(() => {
      const actions = document.getElementById(`mode-options-${selectedMode}`)?.querySelector('.mode-card-actions');
      if (!actions) return;
      const rect = actions.getBoundingClientRect();
      const bar = document.querySelector('.menu-bar')?.getBoundingClientRect();
      const bottom = bar && bar.height ? bar.top - 16 : window.innerHeight - 24;
      const delta = rect.bottom > bottom ? rect.bottom - bottom : rect.top < 88 ? rect.top - 88 : 0;
      if (delta) window.scrollBy({ top: delta, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('lite') ? 'instant' : 'smooth' });
    }, 240);
    return () => window.clearTimeout(timer);
  }, [selectedMode]);
  // Runs in progress, for the Continue chips (careers live in their own database, read after the menu shows).
  const [progress, setProgress] = useState<InProgress>(() => localProgress());
  const [records, setRecords] = useState(modeRecords);
  useEffect(() => {
    let live = true;
    import('../career/storage').then(m => m.listCareers()).then(list => {
      if (!live) return;
      const active = careerProgress(list);
      if (active) setProgress(p => ({ ...p, career: active }));
      const latest = [...list].sort((a, b) => b.updatedAt - a.updatedAt)[0];
      if (latest) setRecords(r => ({ ...r, career: `${latest.identity.name} · ${latest.years.length} seasons${latest.status === 'retired' ? ' · retired' : ''}` }));
    }, () => {});
    return () => { live = false; };
  }, []);
  const latestSave = [...saves].sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const progressOf = (m: MenuMode) => (m === 'franchise' ? latestSave ? `${latestSave.name}${latestSave.season ? ` · ${formatSeasonYear(latestSave.season)}` : ''}` : undefined : progress[m]);
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
      {IS_DESKTOP_BUILD && <UpdateBanner />}
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
        <MenuPhone onFriendList={onFriendList} onCloset={onCloset} onBoards={onCommunity && (() => onCommunity('boards'))} onFriends={onFriends ?? (onCommunity && (() => onCommunity('friends')))} onProfile={onProfile ?? onLocker} onRelics={onRelics} onShop={onShop} onRoad={onRoad} onSettings={onSettings} onWhatsNew={() => { location.hash = '#/updates'; }}
          onAchievements={onProfileTab && (() => onProfileTab('achievements'))} streak={visit.v.streak} />
      </div>

      <MenuQuickLinks onContinue={onOpenContinue} onRoad={onRoad} onRelics={onRelics} onProfile={onProfile ?? onLocker} onFriends={onFriendList ?? onFriends} onCloset={onCloset} onSettings={onSettings} />

      <div className="menu-section-heading"><h2>Choose your game</h2><span>YOUR NEXT CHAPTER STARTS HERE</span></div>

      <div className="mode-grid" id="menu-modes">
        {MODES.map((m) => {
          const picked = selectedMode === m.id, inProgress = progressOf(m.id), hot = cardOf(featured) === m.id;
          return <div key={m.id} className={`mode-card-wrap ${picked ? 'picked' : ''}`} data-mode={m.id}>
            <button
              className={`mode-card ${picked ? 'selected' : ''}`}
              onClick={() => setSelectedMode(picked ? null : m.id)}
              aria-pressed={picked}
              aria-expanded={picked}
              aria-controls={`mode-options-${m.id}`}
              aria-label={`${m.title}: show ways to play`}
            >
              {modeById(m.id) && <ModeArt entry={modeById(m.id)!} />}
              <span className="mode-card-kicker"><ModeIcon mode={m.id} size={30} /><span>{m.kicker}</span>{(m.badge || hot) && <span className="mode-flags">{hot && <span className="mode-xp" title={`Mode of the Week: double XP for ${FEATURED_NAME[featured]} runs finished this week`}>2× XP</span>}{m.badge && <span className={`mode-badge mode-badge-${m.badge}`}><PixelIcon name={m.badge === 'popular' ? 'flame' : 'star'} size={12} /> {BADGE_LABEL[m.badge]}</span>}</span>}<span className="mode-selection-dot" /></span>
              <h3>{m.title}</h3>
              <span className={`mode-progress ${inProgress ? 'active' : ''}`}><PixelIcon name={inProgress ? 'play' : records[m.id] ? 'trophy' : 'star'} size={12} />{inProgress ? `Current: ${inProgress}` : records[m.id] ?? 'Your first chapter awaits'}</span>
              <p>{MODE_SHORT[m.id]}</p>
              <span className="mode-meta"><span className="mode-time" title="How long a sitting takes"><PixelIcon name="clock" size={12} /> {m.time}</span>{m.tags.map(t => <span key={t} className="mode-tag">{t}</span>)}</span>
            </button>
            <div id={`mode-options-${m.id}`} className={`mode-card-expansion ${picked ? 'open' : ''}`} aria-hidden={!picked} inert={!picked}>
              <div className="mode-card-expansion-inner">
            <div className="mode-card-actions">
              <button id={`mode-play-${m.id}`} className="primary mode-play" disabled={!!busy} onClick={() => play(m.id)}><PixelIcon name="play" size={14} />{busy ?? 'Play'}</button>
              {m.id === 'franchise' && <button className="mode-resume" disabled={!!busy} onClick={onOpenContinue}>Continue{ saves.length > 0 && <span>{saves.length}</span>}</button>}
            </div>
            {onOpenMode && subModesOf(m.id).length > 0 && <div className="mode-card-options" aria-label={`Ways to play ${m.title}`}>
              <span className="pixel-eyebrow">WAYS TO PLAY</span>
              {(m.id === 'perfect' ? [modeById('perfect')!, ...subModesOf('perfect')] : subModesOf(m.id)).map(e => <button key={e.id} className="mode-option-row" onClick={() => onOpenMode(e)} disabled={!!busy}>
                <ModeIcon mode={e.id} size={36} /><span><b>{e.title}</b><small>{e.desc}</small></span><PixelIcon name="play" size={12} />
              </button>)}
            </div>}
              </div>
            </div>
            <details className="mode-how"><summary>How to play</summary><p>{m.blurb}</p></details>
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

      {onRoad && <SeasonStrip onOpen={() => onRoad('season')} />}
      {onRelics && <RelicStrip onOpen={onRelics} />}
      {seasonPay.cosmetics.length > 0 && <Suspense fallback={null}><SeasonTierUp cosmetics={seasonPay.cosmetics} spins={seasonPay.spins} onClose={() => setSeasonPay({ spins: 0, cosmetics: [] })} onOpenPass={onRoad && (() => onRoad('season'))} /></Suspense>}

      <DailyChallengeCard onPlay={m => m === 'perfect' ? onStart('perfect', 'normal', '', '') : m === 'hunt' ? onStart('legends', 'normal', '', '') : onArcade?.(m)} />
      {onArcade && <QuickGames onOpen={onArcade} onOpenMode={onOpenMode} />}




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
    <HolidayCard now={now} />
    <article className="mode-of-week weekly-event"><span className="pixel-eyebrow">WEEKLY EVENT · ENDS IN {days} DAY{days === 1 ? '' : 'S'}</span><b>{weeklyEvent(now).name}</b><p>{weeklyEvent(now).blurb} A new event every Monday.</p></article>
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
  useEffect(() => { if (up) { const t = window.setTimeout(() => burst(document.querySelector('.level-up-corner'), { count: 40, power: 6 }), 300); return () => window.clearTimeout(t); } }, [up]);
  if (!up || !open) return null;
  const unlocks = unlocksBetween(up.from, up.to);
  return <div className="level-up level-up-corner fx-pop" role="status"><b>LEVEL UP · LV {up.to}</b><span>{unlocks.length ? `Unlocked ${unlocks.slice(0, 3).join(', ')}${unlocks.length > 3 ? ` and ${unlocks.length - 3} more` : ''}.` : 'Keep going: new unlocks are on the way.'}</span>
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
function QuickGames({ onOpen, onOpenMode }: { onOpen: (game: 'grid' | 'guess' | 'hilo' | 'bracket' | 'quiz') => void; onOpenMode?: (e: ModeEntry) => void }) {
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
    <div className="mode-tiles quick-games-tiles">
      {games.map(g => { const e = modeById(g.id)!; return <ModeCard key={g.id} entry={e} badge={`${g.status}${g.extra ? ` · ${g.extra}` : ''}`} onOpen={() => onOpen(g.id)} />; })}
      {onOpenMode && modesIn('quick', 'compete').filter(e => e.action.kind === 'arcade' && !games.some(g => g.id === e.id)).map(e => <ModeCard key={e.id} entry={e} onOpen={onOpenMode} />)}
    </div>
  </section>;
}

/** One row of the places people look for most: jumps down the menu (modes, today's challenge, saved leagues) and opens
 *  the pages that otherwise live only in the phone (Season Pass, Relic Vault, the roads, profile, friends, settings). */
function MenuQuickLinks({ onContinue, onRoad, onRelics, onProfile, onFriends, onCloset, onSettings }: { onContinue: () => void; onRoad?: (r: 'level' | 'trophy' | 'season') => void; onRelics?: () => void; onProfile?: () => void; onFriends?: () => void; onCloset?: () => void; onSettings?: () => void }) {
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const links: [string, string, (() => void) | undefined][] = [
    ['play', 'Modes', () => go('menu-modes')],
    ['calendar', 'Daily', () => go('menu-daily')],
    ['list', 'Continue franchise', onContinue],
    ['star', 'Season Pass', onRoad && (() => onRoad('season'))],
    ['crown', 'Relics', onRelics],
    ['chart', 'Level Road', onRoad && (() => onRoad('level'))],
    ['trophy', 'Trophy Road', onRoad && (() => onRoad('trophy'))],
    ['team', 'Profile', onProfile],
    ['star', 'Closet', onCloset],
    ['phone', 'Friends', onFriends],
    ['settings', 'Settings', onSettings],
  ];
  return <nav className="menu-quick" aria-label="Quick links">
    {links.filter(([, , on]) => on).map(([icon, label, on]) => <button key={label} onClick={on}><PixelIcon name={icon} size={14} /> {label}</button>)}
  </nav>;
}

/** The Season Pass on the menu: the season, your tier and how close the next one is. */
function SeasonStrip({ onOpen }: { onOpen: () => void }) {
  const [, setTick] = useState(0);
  useEffect(() => { const bump = () => setTick(t => t + 1); window.addEventListener('courtvision:progress', bump); return () => window.removeEventListener('courtvision:progress', bump); }, []);
  const p = noteSeason(totalXp()), left = daysLeft(p.season), up = nextSeason();
  const pct = p.tier >= SEASON_TIERS ? 100 : Math.round((p.into / p.need) * 100);
  return <section className={`menu-season season-${p.season.id}`} aria-label="Season Pass">
    <span className="menu-season-tier"><small>TIER</small><b>{p.tier}</b></span>
    <span className="menu-season-text"><b>Season {p.season.number}: {p.season.name}</b>
      <i className="menu-season-bar" aria-label={`${pct}% to tier ${p.tier + 1}`}><i style={{ width: `${pct}%` }} /></i>
      <small>{p.tier >= SEASON_TIERS ? 'Pass complete' : `${p.need - p.into} XP to tier ${p.tier + 1}`} · {left > 0 ? `${left} days left` : up ? `Season ${up.number}: ${up.name} in ${daysUntil(up)} days` : 'season over'}</small></span>
    <button onClick={onOpen}>Open the pass</button>
  </section>;
}

/** Today's Daily Challenge: the featured daily, its reward and your challenge streak. */
function DailyChallengeCard({ onPlay }: { onPlay: (m: ChallengeMode) => void }) {
  const day = challengeToday(), mode = challengeFor(day), info = CHALLENGE_INFO[mode];
  // Finishing it pays a free Lucky Spin, once (checked each time you're back on the menu).
  const [paid] = useState(() => { if (!claimChallenge(day)) return false; saveRelics(grantLuckySpins(loadRelics(), 1)); return true; });
  const s = readChallenge(), done = s.days.includes(day), streak = challengeStreak(s, day);
  return <section id="menu-daily" className={`daily-challenge ${done ? 'done' : ''}`} aria-label="Daily Challenge">
    <span className="pixel-eyebrow">DAILY CHALLENGE · THE SAME FOR EVERYONE</span>
    <b>{info.title}</b><small>{info.blurb}</small>
    <span className="daily-challenge-meta">{done ? (paid ? 'Done! +1 free Lucky Spin' : 'Done for today: back tomorrow') : 'Reward: 1 free Lucky Spin'}{streak > 1 ? ` · ${streak}-day challenge streak` : ''}</span>
    {!done && <button className="primary" onClick={() => onPlay(mode)}>Play today's challenge</button>}
  </section>;
}

/** The Relic Vault entry: spins waiting, luck and coins. */
function RelicStrip({ onOpen }: { onOpen: () => void }) {
  // The daily coins are paid on the first menu visit of the day.
  const [s, setS] = useState(() => { const r = loadRelics(), c = collectDailyCoins(r); if (c !== r) saveRelics(c); return c; });
  useEffect(() => {
    let live = true;
    claimAchievementSpins().then(n => { if (live && n) setS(loadRelics()); }, () => {});
    const on = () => setS(loadRelics());
    window.addEventListener(RELICS_EVENT, on);
    return () => { live = false; window.removeEventListener(RELICS_EVENT, on); };
  }, []);
  const p = collectionProgress(s);
  return <section className={`menu-relics ${s.spins ? 'ready' : ''}`} aria-label="Relic Vault">
    <PixelIcon name="crown" size={28} />
    <span><b>Relic Vault{s.spins ? ` · ${s.spins} spin${s.spins === 1 ? '' : 's'} waiting` : ''}</b><small>+{+totalLuck(s).toFixed(1)}% luck · {s.coins.toLocaleString()} coins · {p.owned}/{p.total} relics{p.secrets ? ` · ${p.secrets} secret${p.secrets === 1 ? '' : 's'}` : ''}</small></span>
    <button className={s.spins ? 'primary' : ''} onClick={onOpen}>{s.spins ? 'Spin now' : 'Open the vault'}</button>
  </section>;
}

/** The holiday event's card: only while Spooky Season or Winter Wonderland is on. */
function HolidayCard({ now }: { now: Date }) {
  const run = activeHoliday(now);
  if (!run) return null;
  const h = run.holiday, left = holidayDaysLeft(run, now), coins = eventCoins(loadHoliday(), run.key);
  const vars = { '--hol-bg': h.colors.bg, '--hol-panel': h.colors.panel, '--hol-accent': h.colors.accent, '--hol-text': h.colors.text, '--hol-glow': h.colors.glow } as CSSProperties;
  return <article className="mode-of-week holiday menu-holiday" style={vars}>
    <span className="pixel-eyebrow">HOLIDAY EVENT · {left} DAY{left === 1 ? '' : 'S'} LEFT</span><b>{h.name}</b>
    <p>{h.blurb} You have {coins.toLocaleString()} {coins === 1 ? h.coin : h.coins}.</p>
    <button className="primary" onClick={() => { location.hash = '#/event'; }}>Open the {h.id === 'halloween' ? 'Spooky' : 'Holiday'} Shop</button>
  </article>;
}
