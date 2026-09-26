import { PrivacyLink } from './PrivacyPolicyPage';
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
import { DataCredits } from './DataCredits';

export type GameMode = 'random' | 'real' | 'legends';
export interface RealLeagueOptions { source: 'history' | 'csv'; realDevelopment: boolean }
/** Start years the bundled NBA history supports (history through the season before; data ends 2025-26). */
const HISTORY_START_YEARS: number[] = Array.from({ length: 2025 - 1946 + 1 }, (_, i) => 2025 - i);

interface Props {
  recovery?: ReactNode;
  onStart: (mode: GameMode, difficulty: TradeDifficulty, year: string, leagueName: string, real?: RealLeagueOptions) => void;
  /** Shown while a historical league is being assembled. */
  busy?: string | null;
  saves: SaveSummary[];
  onContinue: (saveId: string) => void;
  onDeleteSave: (saveId: string) => void;
  onRenameSave: (saveId: string, name: string) => void;
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
    title: 'Legends',
    blurb: 'Era-styled matchups under historical rulesets - 1990s vs 2010s pace and rules, etc. Generated teams, not official ratings.',
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

export function MainMenu({ onStart, saves, onContinue, onDeleteSave, onRenameSave, recovery, busy = null }: Props) {
  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null);
  const [difficulty, setDifficulty] = useState<TradeDifficulty>('normal');
  const yearOptions = nbaHistoryYearRange();
  const [year, setYear] = useState(String(yearOptions[0]));
  const [leagueName, setLeagueName] = useState('My League');
  const [realSource, setRealSource] = useState<'history' | 'csv'>('history');
  const [realDevelopment, setRealDevelopment] = useState(true);
  const [historyYear, setHistoryYear] = useState('2016');
  const historical = selectedMode === 'real' && realSource === 'history';

  return (
    <div className="main-menu">
      <div className="menu-masthead"><img src={logoIcon} alt="" /><span>COURT VISION<small>BASKETBALL MANAGEMENT</small></span><span className="menu-edition">THE PIXEL COURT</span><DiscordLink className="menu-discord" /></div>
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

      <div className="menu-section-heading"><h2>Choose your game</h2><span>THREE WAYS TO MAKE HISTORY</span></div>

      <SavedLeaguesList saves={saves} onContinue={onContinue} onDeleteSave={onDeleteSave} onRenameSave={onRenameSave} />

      <div className="mode-grid">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`mode-card ${selectedMode === m.id ? 'selected' : ''}`}
            onClick={() => setSelectedMode(m.id)}
            aria-pressed={selectedMode === m.id}
          >
            <span className="mode-card-kicker"><PixelIcon name={m.id === 'random' ? 'team' : m.id === 'real' ? 'court' : 'trophy'} size={24} /><span>{m.id === 'random' ? '01 / CREATE' : m.id === 'real' ? '02 / IMPORT' : '03 / REIMAGINE'}</span><span className="mode-selection-dot" /></span>
            <h3>{m.title}</h3>
            <p>{m.blurb}</p>
          </button>
        ))}
      </div>

      {selectedMode && selectedMode !== 'legends' && (
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
              {HISTORY_START_YEARS.map((y) => <option key={y} value={y}>{y}–{String(y + 1).slice(2)}</option>)}
            </select>
            <p className="hint-text">Starting {historyYear}–{String(Number(historyYear) + 1).slice(2)} loads every completed season from 1946–47 through {Number(historyYear) - 1}–{String(Number(historyYear)).slice(2)}. The new season starts unplayed; from then on your league writes its own history.</p>
          </div> : <div className="difficulty-picker">
            <h4>Starting Season</h4>
            <select className="year-input" value={year} onChange={(e) => setYear(e.target.value)}>
              {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <p className="hint-text">Pick any season from the NBA's founding ({yearOptions[yearOptions.length - 1]}) through today.</p>
          </div>}
          {historical && <div className="difficulty-picker">
            <h4>Real Player Development</h4>
            <label className="real-dev-toggle"><input type="checkbox" checked={realDevelopment} onChange={e => setRealDevelopment(e.target.checked)} /> Follow each real player's historical development</label>
            <p className="hint-text">{realDevelopment
              ? 'On: real players rise and decline along their real rating trajectory at each new season; training can\'t change their base ratings. Results, awards and transactions are still decided by your league. Generated players develop normally.'
              : 'Off: real players develop through Court Vision\'s team, coaching, training, minutes and aging systems, like everyone else.'} You can change this later in League Settings.</p>
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
        <button className="primary menu-start" disabled={!!busy} onClick={() => onStart(selectedMode, difficulty, historical ? historyYear : year, leagueName, selectedMode === 'real' ? { source: realSource, realDevelopment } : undefined)}>
          {busy ?? `Start ${historical ? `${historyYear}–${String(Number(historyYear) + 1).slice(2)} NBA` : MODES.find((m) => m.id === selectedMode)?.title}`}
        </button>
      )}

      {recovery}
      <AdBanner slot="menu" />
      <footer className="legal-footer"><PrivacyLink /> · <CookieSettingsLink /> · <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer">Discord</a></footer>
      <ConsentBanner />
    </div>
  );
}

function MenuLegacy() {
  const legacy = useLegacy();
  return <LegacyPanel legacy={legacy} compact />;
}
