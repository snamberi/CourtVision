import { PrivacyLink } from './PrivacyPolicyPage';
import { IS_DESKTOP_BUILD } from '../appMode';
import { LegacyPanel, useLegacy } from './FrontOfficePanels';
import { DiscordLink, DISCORD_URL } from './DiscordLink';
import { CookieSettingsLink } from '../consent/ConsentBanner';
import { ConsentBanner } from '../consent/ConsentBanner';
import { useState, type ReactNode } from 'react';
import logoIcon from '../assets/brand/logo-icon.png';
import { PlayerAvatar } from './PlayerAvatar';
import { PixelBall, PixelIcon } from './PixelIcon';
import type { TradeDifficulty } from '../simulation/gm';
import type { SaveSummary } from '../storage/saves';
import { formatSeasonYear, nbaHistoryYearRange } from '../simulation/calendar';
import { AdBanner } from './AdBanner';
import { SCENARIOS, loadRebuildRecords } from '../simulation/rebuildChallenge';
import { DataCredits } from './DataCredits';
import { weeklyRebuild, weeklyCareer, loadWeeklyRecords, weeklyStreak, weekEndsAt } from '../retention/weekly';
import { InstallAppButton } from './InstallAppButton';
import { WhatsNew } from './WhatsNew';
import { WeeklyBoardDialog } from './WeeklyBoard';
import { cloudEnabled } from '../cloud/account';
import { AccountButton, MenuAccountCard } from './cloud/AccountButton';
import { ProfileChip } from './ProfilePanel';
import { totalXp, levelFor, takeLevelUp, unlocksBetween } from '../profile/profile';
import { liteMode, performanceSetting, setPerformanceSetting, type PerformanceSetting } from '../lib/performanceMode';

export type GameMode = 'random' | 'real' | 'legends' | 'career' | 'rebuild' | 'draft';
export interface RealLeagueOptions { source: 'history' | 'csv'; realDevelopment: boolean; forceRosters?: boolean; allPlayers?: boolean }
/** Start years the bundled NBA history supports (history through the season before; data ends 2025-26). */
const HISTORY_START_YEARS: number[] = Array.from({ length: 2025 - 1946 + 1 }, (_, i) => 2025 - i);

interface Props {
  recovery?: ReactNode;
  onStart: (mode: GameMode, difficulty: TradeDifficulty, year: string, leagueName: string, real?: RealLeagueOptions, scenarioId?: string) => void;
  /** Shown while a historical league is being assembled. */
  busy?: string | null;
  saves: SaveSummary[];
  onContinue: (saveId: string) => void;
  onDeleteSave: (saveId: string) => void;
  onRenameSave: (saveId: string, name: string) => void;
  /** Opens the GM Locker (every trophy, across modes). */
  onLocker?: () => void;
  /** Starts the league a code describes; returns an error message, or null. */
  onCode?: (code: string) => string | null;
  /** Opens Community (online boards, ranked, PvP, profiles). */
  onCommunity?: () => void;
  /** Opens your player profile. */
  onProfile?: () => void;
}

const MODES: { id: GameMode; title: string; blurb: string }[] = [
  {
    id: 'random',
    title: 'Random Players',
    blurb: 'A freshly generated 30-team league, 18 players a roster, full 82-game schedule. Every player, every team - nothing real.',
  },
  {
    id: 'real',
    title: 'Real League',
    blurb: 'Start from real NBA history — real players, careers, awards and champions up to any season from 1946 — or build a league from your own CSV data.',
  },
  {
    id: 'legends',
    title: 'League Hunt',
    blurb: 'Spin a six-man squad and a coach from all of history, then win ten best-of-seven series against the great teams of every era. A semi-boss, a boss, three boosts.',
  },
  {
    id: 'rebuild',
    title: 'Rebuild Challenge',
    blurb: 'Take over a real team at its lowest point in NBA history (the Bulls after Jordan, the 7-59 Bobcats) and win a title before the clock runs out. Scored, starred and ranked.',
  },
  {
    id: 'career',
    title: 'Career Mode',
    blurb: 'Create one player (spin the wheel of NBA history or build him yourself) and live his whole career in today\'s league: draft night, training, free agency, awards, the Hall of Fame and the all-time Top 100.',
  },
  {
    id: 'draft',
    title: 'All-Time Draft',
    blurb: 'Thirty teams, thirteen rounds, every player in history at his best. Draft against AI GMs who build for need, then play the season under any era\'s rules with the full GM game.',
  },
];

const DIFFICULTIES: { id: TradeDifficulty; label: string; blurb: string }[] = [
  { id: 'easy', label: 'Easy', blurb: 'Trades go through with a wide value tolerance.' },
  { id: 'normal', label: 'Normal', blurb: 'Trades need roughly matched value.' },
  { id: 'hard', label: 'Hard', blurb: 'Trades need tightly matched value - young high-potential players carry a real premium.' },
];

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

export function MainMenu({ onStart, saves, onContinue, onDeleteSave, onRenameSave, recovery, busy = null, onLocker, onCode, onCommunity, onProfile }: Props) {
  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null);
  const [scenario, setScenario] = useState(SCENARIOS[0].id);
  const [rebuildRecords] = useState(() => loadRebuildRecords());
  const [difficulty, setDifficulty] = useState<TradeDifficulty>('normal');
  const yearOptions = nbaHistoryYearRange();
  const [year, setYear] = useState(String(yearOptions[0]));
  const [leagueName, setLeagueName] = useState('My League');
  const [realSource, setRealSource] = useState<'history' | 'csv'>('history');
  const [realDevelopment, setRealDevelopment] = useState(true);
  const [forceRosters, setForceRosters] = useState(false);
  const [allPlayers, setAllPlayers] = useState(true);
  const [historyYear, setHistoryYear] = useState('2016');
  const historical = selectedMode === 'real' && realSource === 'history';

  return (
    <div className="main-menu">
      <div className="menu-masthead"><img src={logoIcon} alt="" /><span>COURT VISION<small>BASKETBALL MANAGEMENT</small></span><span className="menu-edition">THE PIXEL COURT</span>{onLocker && <ProfileChip onOpen={onProfile ?? onLocker} />}{onLocker && <button className="menu-locker" onClick={onLocker}><PixelIcon name="trophy" size={16} /> GM Locker</button>}{onCommunity && <AccountButton onCommunity={onCommunity} />}<InstallAppButton /><DiscordLink className="menu-discord" /></div>
      <div className="menu-hero">
        <div className="menu-hero-copy"><span className="pixel-eyebrow">BUILD A TEAM. WRITE ITS HISTORY.</span><h1>Your league.<br /><span>Your legacy.</span></h1><p>Scout the next great. Build your starting five.<br />Turn one season into a dynasty.</p></div>
        <div className="menu-player-scene" aria-hidden="true">
          <span className="menu-court-line" />
          <PlayerAvatar playerId="Court Vision Guard" primaryColor="#386bba" secondaryColor="#fff0cf" jerseyNumber={30} size={100} />
          <PlayerAvatar playerId="Court Vision Wing" primaryColor="#6e3994" secondaryColor="#c6aeff" jerseyNumber={1} size={140} />
          <PlayerAvatar playerId="Court Vision Center" primaryColor="#ec852b" secondaryColor="#fcdfad" jerseyNumber={23} size={100} />
          <PixelBall size={48} />
        </div>
      </div>

      <MenuLegacy />
      <LevelUpNote onLocker={onLocker} />
      {onCommunity && <MenuAccountCard onCommunity={onCommunity} />}

      <ThisWeek onCommunity={onCommunity} busy={busy} onRebuild={() => onStart('rebuild', 'normal', '', '', undefined, 'weekly')} onCareer={() => onStart('career', 'normal', '', '')} onHunt={() => onStart('legends', 'normal', '', '')} />

      <div className="menu-section-heading"><h2>Choose your game</h2><span>SIX WAYS TO MAKE HISTORY</span></div>

      {onCode && <CodeEntry busy={busy} onCode={onCode} />}

      <SavedLeaguesList saves={saves} onContinue={onContinue} onDeleteSave={onDeleteSave} onRenameSave={onRenameSave} />

      <div className="mode-grid">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`mode-card ${selectedMode === m.id ? 'selected' : ''}`}
            onClick={() => setSelectedMode(m.id)}
            aria-pressed={selectedMode === m.id}
          >
            <span className="mode-card-kicker"><PixelIcon name={m.id === 'random' ? 'team' : m.id === 'real' ? 'court' : m.id === 'career' ? 'star' : m.id === 'rebuild' ? 'chart' : m.id === 'draft' ? 'team' : 'trophy'} size={24} /><span>{m.id === 'random' ? '01 / CREATE' : m.id === 'real' ? '02 / IMPORT' : m.id === 'legends' ? '03 / REIMAGINE' : m.id === 'rebuild' ? '04 / REBUILD' : m.id === 'draft' ? '06 / DRAFT' : '05 / BECOME'}</span><span className="mode-selection-dot" /></span>
            <h3>{m.title}</h3>
            <p>{m.blurb}</p>
          </button>
        ))}
      </div>

      {selectedMode === 'rebuild' && <div className="menu-setup rb-setup"><div className="difficulty-picker rb-picker"><h4>Choose your rebuild</h4>
        <div className="rb-scenarios" role="radiogroup" aria-label="Rebuild scenarios">{SCENARIOS.map(sc => { const rec = rebuildRecords[sc.id]; return <button key={sc.id} role="radio" aria-checked={scenario === sc.id} className={`rb-scenario ${scenario === sc.id ? 'selected' : ''}`} onClick={() => setScenario(sc.id)}>
          <small>{sc.startYear}-{String(sc.startYear + 1).slice(2)} · {sc.team} · {sc.seasons} seasons · {sc.difficulty}</small><b>{sc.title}</b><span>{sc.blurb}</span>
          <small>{rec ? `${'★'.repeat(rec.stars)}${'☆'.repeat(3 - rec.stars)} · best ${rec.best.toLocaleString()}${rec.titleIn ? ` · title in year ${rec.titleIn}` : ''}` : 'Not played yet'}</small></button>; })}</div>
        <p className="hint-text">Real NBA history from that season: real rosters, real players on their real careers, real draft classes. You run the team with every tool of the game. A title scores 1,000 plus 250 for every season left; wins and playoff runs add up along the way. Sandbox leagues don't count.</p></div></div>}

      {selectedMode && selectedMode !== 'legends' && selectedMode !== 'career' && selectedMode !== 'rebuild' && selectedMode !== 'draft' && (
        <div className="menu-setup">
          <div className="difficulty-picker">
            <h4>League Name</h4>
            <input
              className="year-input" type="text" value={leagueName}
              onChange={(e) => setLeagueName(e.target.value)}
              placeholder="e.g. My Dynasty"
            />
          </div>
          {selectedMode === 'real' && <div className="difficulty-picker real-source-picker">
            <h4>Data Source</h4>
            <div className="difficulty-options" role="radiogroup" aria-label="Real league data source">
              <button role="radio" aria-checked={realSource === 'history'} className={`difficulty-chip ${realSource === 'history' ? 'selected' : ''}`} onClick={() => setRealSource('history')}>Built-in NBA history</button>
              <button role="radio" aria-checked={realSource === 'csv'} className={`difficulty-chip ${realSource === 'csv' ? 'selected' : ''}`} onClick={() => setRealSource('csv')}>Custom CSV import</button>
            </div>
            <p className="hint-text">{realSource === 'history'
              ? 'Real players with their year-by-year statistics, awards and champions from NBA history. Teams use city names, and every rating is Court Vision\'s own, computed from the statistics.'
              : 'Import your own legally obtained data on the Import Data page after the league opens.'}</p>
            {realSource === 'history' && <DataCredits compact />}
          </div>}
          {historical ? <div className="difficulty-picker">
            <h4>Starting Season</h4>
            <select className="year-input" value={historyYear} onChange={(e) => setHistoryYear(e.target.value)} aria-label="Starting season">
              {HISTORY_START_YEARS.map((y) => <option key={y} value={y}>{y + 1} ({y}–{String(y + 1).slice(2)})</option>)}
            </select>
            <p className="hint-text">Starting {historyYear}–{String(Number(historyYear) + 1).slice(2)} loads every completed season from 1946–47 through {Number(historyYear) - 1}–{String(Number(historyYear)).slice(2)}. The new season starts unplayed; from then on your league writes its own history.</p>
          </div> : <div className="difficulty-picker">
            <h4>Starting Season</h4>
            <select className="year-input" value={year} onChange={(e) => setYear(e.target.value)}>
              {yearOptions.map((y) => <option key={y} value={y}>{y + 1}</option>)}
            </select>
            <p className="hint-text">Seasons are named for the year they end. Pick any season from the NBA's founding ({yearOptions[yearOptions.length - 1] + 1}) through today.</p>
          </div>}
          {historical && <div className="difficulty-picker">
            <h4>Real Player Development</h4>
            <label className="real-dev-toggle"><input type="checkbox" checked={realDevelopment} onChange={e => setRealDevelopment(e.target.checked)} /> Follow each real player's historical development</label>
            <p className="hint-text">{realDevelopment
              ? 'On: real players rise and decline along their real rating trajectory at each new season; training can\'t change their base ratings. Results, awards and transactions are still decided by your league. Generated players develop normally.'
              : 'Off: real players develop through Court Vision\'s team, coaching, training, minutes and aging systems, like everyone else.'} You can change this later in League Settings.</p>
          </div>}
          {historical && <div className="difficulty-picker">
            <h4>Historical Rosters</h4>
            <label className="real-dev-toggle"><input type="checkbox" checked={forceRosters} onChange={e => setForceRosters(e.target.checked)} /> Keep every team's real roster, season after season</label>
            <p className="hint-text">{forceRosters
              ? 'On: at the start of each season the data covers, every AI team takes the floor with its real roster (players move to the team they really played for). AI teams make no trades and only sign free agents to fill a short roster. Your own team is still yours to run.'
              : 'Off: rosters start real and then change through your league\'s own trades, signings and drafts.'}</p>
          </div>}
          {historical && <div className="difficulty-picker">
            <h4>Every Real Player</h4>
            <label className="real-dev-toggle"><input type="checkbox" checked={allPlayers} onChange={e => setAllPlayers(e.target.checked)} /> Load players who retired before {historyYear} too</label>
            <p className="hint-text">{allPlayers
              ? 'On: every NBA and BAA player whose career ended before the start is in the league as a retired player, with his real career statistics, awards and profile. They count in all-time records and the Hall of Fame.'
              : 'Off: only players active at the start (and those still to come) are in the league. Retired players stay in the NBA History archive, and you can load them later from there.'}</p>
          </div>}
          <div className="difficulty-picker">
            <h4>Trade Difficulty</h4>
            <div className="difficulty-options">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.id}
                  className={`difficulty-chip ${difficulty === d.id ? 'selected' : ''}`}
                  onClick={() => setDifficulty(d.id)}
                  title={d.blurb}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <p className="hint-text">{DIFFICULTIES.find((d) => d.id === difficulty)?.blurb}</p>
          </div>
        </div>
      )}

      {selectedMode && (
        <button className="primary menu-start" disabled={!!busy} onClick={() => onStart(selectedMode, difficulty, historical ? historyYear : year, leagueName, selectedMode === 'real' ? { source: realSource, realDevelopment, forceRosters, allPlayers } : undefined, selectedMode === 'rebuild' ? scenario : undefined)}>
          {busy ?? `Start ${historical ? `${historyYear}–${String(Number(historyYear) + 1).slice(2)} NBA` : MODES.find((m) => m.id === selectedMode)?.title}`}
        </button>
      )}

      {recovery}
      <AdBanner slot="menu" />
      <footer className="legal-footer">{!IS_DESKTOP_BUILD && <><a href="/how-to-play.html">How to Play</a> · <a href="/guides/">Guides</a> · <a href="/faq.html">FAQ</a> · <a href="/about.html">About</a> · <a href="/changelog.html">What's new</a> · </>}<PrivacyLink /> · <CookieSettingsLink /> · <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer">Discord</a> · <PerformanceToggle /></footer>
      <ConsentBanner />
      <WhatsNew />
    </div>
  );
}

function MenuLegacy() {
  const legacy = useLegacy();
  return <LegacyPanel legacy={legacy} compact />;
}

/** This week: the Rebuild and Career of the Week (same seed for everyone until Monday) and the Daily Legend. */
function ThisWeek({ busy, onRebuild, onCareer, onHunt, onCommunity }: { busy: string | null; onRebuild: () => void; onCareer: () => void; onHunt: () => void; onCommunity?: () => void }) {
  const [now] = useState(() => new Date());
  const [board, setBoard] = useState(false);
  const rb = weeklyRebuild(), cw = weeklyCareer();
  const rec = loadWeeklyRecords()[rb.week];
  const streak = weeklyStreak();
  const days = Math.max(1, Math.ceil((weekEndsAt(now) - now.getTime()) / 86_400_000));
  return <section className="this-week" aria-label="This week's challenges">
    <div className="this-week-head"><h2>This week</h2><span>{rb.week} · new challenges in {days} day{days === 1 ? '' : 's'}{streak > 1 ? ` · ${streak}-week streak` : ''}</span>{cloudEnabled && <button className="link-button" onClick={() => setBoard(true)}>Leaderboard</button>}</div>
    {board && <WeeklyBoardDialog onClose={() => setBoard(false)} onCommunity={onCommunity} />}
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

/** Graphics: Auto (lite on low-end devices), Lite or Full. */
function PerformanceToggle() {
  const [setting, setSetting] = useState<PerformanceSetting>(() => performanceSetting());
  const next: Record<PerformanceSetting, PerformanceSetting> = { auto: 'lite', lite: 'full', full: 'auto' };
  const label = setting === 'auto' ? `Auto (${liteMode('auto') ? 'lite' : 'full'})` : setting === 'lite' ? 'Lite' : 'Full';
  return <button className="link-button" title="Lite mode stops looping animations and blur, and uses fewer simulation workers. Auto turns it on for low-memory devices."
    onClick={() => { const v = next[setting]; setPerformanceSetting(v); setSetting(v); }}>Graphics: {label}</button>;
}

/** Level up since the last visit to the menu: what it unlocked. */
function LevelUpNote({ onLocker }: { onLocker?: () => void }) {
  const [up] = useState(() => takeLevelUp(levelFor(totalXp()).level));
  const [open, setOpen] = useState(true);
  if (!up || !open) return null;
  const unlocks = unlocksBetween(up.from, up.to);
  return <div className="level-up" role="status"><b>LEVEL UP · LV {up.to}</b><span>{unlocks.length ? `Unlocked ${unlocks.join(', ')}.` : 'Keep going: new unlocks are on the way.'}</span>
    {onLocker && unlocks.length > 0 && <button onClick={onLocker}>Equip in the Locker</button>}<button className="link-button" onClick={() => setOpen(false)}>Close</button></div>;
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
