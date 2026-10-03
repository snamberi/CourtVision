import { useState } from 'react';
import type { TradeDifficulty } from '../simulation/gm';
import { nbaHistoryYearRange } from '../simulation/calendar';
import { SCENARIOS, loadRebuildRecords } from '../simulation/rebuildChallenge';
import { DataCredits } from './DataCredits';
import { PixelIcon } from './PixelIcon';
import { Modal } from './Modal';
import { COUNTRIES } from '../worldGames/data';
import { MODE_GAMES, type GamesId } from '../worldGames/mode';
import { DEFAULT_CREATE, FEELS, ERA_CHOICES, GAME_COUNTS, QUARTER_LENGTHS, changedCount, summary, type CreateSettings } from '../menu/createSettings';
import './create.css';

/*
 * New Franchise: one page to set up any GM-mode league. Pick a game (a free franchise, a Rebuild Challenge or the
 * All-Time Draft), then the league (real NBA history or a random league), its name, starting season and difficulty,
 * and, if you like, its settings before the first game.
 */

export type Challenge = 'free' | 'rebuild' | 'draft' | 'worldgames';
export type LeagueSource = 'history' | 'random' | 'csv';
export type CreateChoice =
  | { kind: 'league'; source: LeagueSource; name: string; year: string; difficulty: TradeDifficulty; real: { realDevelopment: boolean; forceRosters: boolean; allPlayers: boolean }; settings: CreateSettings }
  | { kind: 'rebuild'; scenario: string }
  | { kind: 'draft' }
  | { kind: 'worldgames'; games: GamesId; country: string };

const HISTORY_START_YEARS: number[] = Array.from({ length: 2025 - 1946 + 1 }, (_, i) => 2025 - i);
const DIFFICULTIES: { id: TradeDifficulty; label: string; blurb: string }[] = [
  { id: 'easy', label: 'Easy', blurb: 'AI GMs accept trades with a wide value gap. Good for your first league.' },
  { id: 'normal', label: 'Normal', blurb: 'Trades need roughly matched value.' },
  { id: 'hard', label: 'Hard', blurb: 'Tightly matched value; young high-potential players cost a premium.' },
];
const CHALLENGES: { id: Challenge; icon: string; title: string; blurb: string; time: string }[] = [
  { id: 'free', icon: 'team', title: 'Franchise', blurb: 'Run a team for as many seasons as you like: trades, drafts, free agency, owners and your own history.', time: 'Unlimited' },
  { id: 'rebuild', icon: 'chart', title: 'Rebuild Challenge', blurb: 'Take a real team at its lowest point and win a title before the clock runs out. Scored and starred.', time: '10-20 min' },
  { id: 'draft', icon: 'trophy', title: 'All-Time Draft', blurb: 'Thirty teams, thirteen rounds, every player in history at his best. Then play the season.', time: '10-20 min' },
  { id: 'worldgames', icon: 'star', title: 'World Games', blurb: 'Coach a national team at a real Games (1992-2024) or the Fantasy Games. Pick twelve, win medals.', time: '10-15 min' },
];
const NAMES = ['My Dynasty', 'The Pixel League', 'Banner Season', 'Hardwood Kings', 'Dynasty Mode', 'Court Vision League', 'The Long Rebuild', 'Ring Chasers', 'Next Era', 'Title Town'];

const seasonName = (y: number) => `${y}–${String(y + 1).slice(2)}`;

export function FranchiseCreate({ onBack, onStart, busy = null, initial = 'free' }: { onBack: () => void; onStart: (c: CreateChoice) => void; busy?: string | null; initial?: Challenge }) {
  const [challenge, setChallenge] = useState<Challenge>(initial);
  const [source, setSource] = useState<LeagueSource>('history');
  const [name, setName] = useState('My League');
  const randomYears = nbaHistoryYearRange();
  const [randomYear, setRandomYear] = useState(String(randomYears[0]));
  const [historyYear, setHistoryYear] = useState('2016');
  const [difficulty, setDifficulty] = useState<TradeDifficulty>('normal');
  const [realDevelopment, setRealDevelopment] = useState(true);
  const [forceRosters, setForceRosters] = useState(false);
  const [allPlayers, setAllPlayers] = useState(true);
  const [settings, setSettings] = useState<CreateSettings>(DEFAULT_CREATE);
  const [editing, setEditing] = useState(false);
  const [scenario, setScenario] = useState(SCENARIOS[0].id);
  const [records] = useState(() => loadRebuildRecords());
  const [wgGames, setWgGames] = useState<GamesId>(2024);
  const [wgCountry, setWgCountry] = useState('USA');
  const historical = source === 'history';
  const year = historical ? historyYear : randomYear;
  const changed = changedCount(settings);

  const start = () => {
    if (challenge === 'rebuild') onStart({ kind: 'rebuild', scenario });
    else if (challenge === 'draft') onStart({ kind: 'draft' });
    else if (challenge === 'worldgames') onStart({ kind: 'worldgames', games: wgGames, country: wgCountry });
    else onStart({ kind: 'league', source, name: name.trim() || 'My League', year, difficulty, real: { realDevelopment, forceRosters, allPlayers }, settings });
  };
  const sc = SCENARIOS.find(s => s.id === scenario)!;
  const startLabel = busy ?? (challenge === 'rebuild' ? `Start: ${sc.title}` : challenge === 'draft' ? 'Go to the draft room' : challenge === 'worldgames' ? `Coach ${wgCountry}` : historical ? `Start the ${seasonName(Number(historyYear))} NBA` : source === 'random' ? 'Create the random league' : 'Create the league');

  return <div className="create-page">
    <header className="create-top">
      <button className="hunt-exit" onClick={onBack}><PixelIcon name="exit" size={16} /> Main Menu</button>
      <div><span className="pixel-eyebrow">GM MODE</span><h1>New franchise</h1></div>
    </header>

    <section className="create-step" aria-labelledby="create-step-game">
      <h2 id="create-step-game"><span className="create-num">1</span> Choose your game</h2>
      <div className="create-choices create-choices-4" role="radiogroup" aria-label="Game">
        {CHALLENGES.map(c => <button key={c.id} role="radio" aria-checked={challenge === c.id} className={`create-choice ${challenge === c.id ? 'selected' : ''}`} onClick={() => setChallenge(c.id)}>
          <span className="create-choice-head"><PixelIcon name={c.icon} size={22} /><b>{c.title}</b><small><PixelIcon name="clock" size={11} /> {c.time}</small></span>
          <span className="create-choice-blurb">{c.blurb}</span>
          {c.id !== 'free' && <span className="create-tag">Challenge</span>}
        </button>)}
      </div>
    </section>

    {challenge === 'free' && <>
      <section className="create-step" aria-labelledby="create-step-league">
        <h2 id="create-step-league"><span className="create-num">2</span> Pick a league</h2>
        <div className="create-choices create-choices-2" role="radiogroup" aria-label="League type">
          <button role="radio" aria-checked={source !== 'random'} className={`create-choice ${source !== 'random' ? 'selected' : ''}`} onClick={() => setSource('history')}>
            <span className="create-choice-head"><PixelIcon name="court" size={22} /><b>Real NBA league</b><span className="create-tag hot">Most popular</span></span>
            <span className="create-choice-blurb">Real players, real careers, awards and champions from any season since 1946. From the first game on, your league writes its own history.</span>
          </button>
          <button role="radio" aria-checked={source === 'random'} className={`create-choice ${source === 'random' ? 'selected' : ''}`} onClick={() => setSource('random')}>
            <span className="create-choice-head"><PixelIcon name="team" size={22} /><b>Random league</b></span>
            <span className="create-choice-blurb">A freshly generated 30-team league: every player, team and storyline new. Nobody knows who the stars are yet.</span>
          </button>
        </div>
        {source !== 'random' && <div className="create-sub">
          <label className="create-check"><input type="checkbox" checked={source === 'csv'} onChange={e => setSource(e.target.checked ? 'csv' : 'history')} /> Use my own data instead (import a CSV after the league opens)</label>
          {historical && <DataCredits compact />}
        </div>}
      </section>

      <section className="create-step" aria-labelledby="create-step-basics">
        <h2 id="create-step-basics"><span className="create-num">3</span> The basics</h2>
        <div className="create-fields">
          <label className="create-field"><span>League name</span>
            <span className="create-inline"><input className="year-input" value={name} maxLength={40} onChange={e => setName(e.target.value)} placeholder="e.g. My Dynasty" />
              <button type="button" title="A random name" aria-label="Pick a random name" onClick={() => setName(NAMES[Math.floor(Math.random() * NAMES.length)])}>🎲</button></span>
          </label>
          {source !== 'csv' && <label className="create-field"><span>Starting season</span>
            {historical
              ? <select className="year-input" value={historyYear} onChange={e => setHistoryYear(e.target.value)}>{HISTORY_START_YEARS.map(y => <option key={y} value={y}>{seasonName(y)}</option>)}</select>
              : <select className="year-input" value={randomYear} onChange={e => setRandomYear(e.target.value)}>{randomYears.map(y => <option key={y} value={y}>{seasonName(y)}</option>)}</select>}
            <small>{historical ? `Every season from 1946–47 to ${seasonName(Number(historyYear) - 1)} is loaded as history; ${seasonName(Number(historyYear))} starts unplayed.` : 'Only sets the calendar: every player is new.'}</small>
          </label>}
          <div className="create-field"><span>Difficulty</span>
            <div className="create-segment" role="radiogroup" aria-label="Difficulty">{DIFFICULTIES.map(d => <button key={d.id} role="radio" aria-checked={difficulty === d.id} className={difficulty === d.id ? 'selected' : ''} onClick={() => setDifficulty(d.id)}>{d.label}</button>)}</div>
            <small>{DIFFICULTIES.find(d => d.id === difficulty)!.blurb}</small>
          </div>
        </div>
      </section>

      {historical && <section className="create-step" aria-labelledby="create-step-real">
        <h2 id="create-step-real"><span className="create-num">4</span> Real league options</h2>
        <div className="create-toggles">
          <Toggle on={realDevelopment} set={setRealDevelopment} title="Real player development" blurb={realDevelopment ? 'Real players rise and decline along their real careers.' : "Real players develop through Court Vision's own systems."} />
          <Toggle on={forceRosters} set={setForceRosters} title="Historical rosters" blurb={forceRosters ? 'Every AI team keeps its real roster each season; they make no trades.' : 'Rosters start real, then change through your league.'} />
          <Toggle on={allPlayers} set={setAllPlayers} title="Every real player" blurb={allPlayers ? `Players who retired before ${historyYear} are in, with their careers and honours.` : 'Only players active at the start (and those to come).'} />
        </div>
      </section>}

      <section className="create-step" aria-labelledby="create-step-settings">
        <h2 id="create-step-settings"><span className="create-num">{historical ? 5 : 4}</span> League settings</h2>
        <div className="create-settings-row">
          <ul className="create-chips">{summary(settings, source === 'random').map(t => <li key={t}>{t}</li>)}</ul>
          <button onClick={() => setEditing(true)}><PixelIcon name="settings" size={14} /> League settings{changed ? ` (${changed} changed)` : ''}</button>
        </div>
        <p className="hint-text">Optional: change the game's rules before the first tip-off. Everything can be changed later in the league's Settings.</p>
      </section>
    </>}

    {challenge === 'rebuild' && <section className="create-step" aria-labelledby="create-step-rebuild">
      <h2 id="create-step-rebuild"><span className="create-num">2</span> Choose your rebuild</h2>
      <div className="rb-scenarios" role="radiogroup" aria-label="Rebuild scenarios">{SCENARIOS.map(s => { const rec = records[s.id]; return <button key={s.id} role="radio" aria-checked={scenario === s.id} className={`rb-scenario ${scenario === s.id ? 'selected' : ''}`} onClick={() => setScenario(s.id)}>
        <small>{s.startYear}-{String(s.startYear + 1).slice(2)} · {s.team} · {s.seasons} seasons · {s.difficulty}</small><b>{s.title}</b><span>{s.blurb}</span>
        <small>{rec ? `${'★'.repeat(rec.stars)}${'☆'.repeat(3 - rec.stars)} · best ${rec.best.toLocaleString()}${rec.titleIn ? ` · title in year ${rec.titleIn}` : ''}` : 'Not played yet'}</small></button>; })}</div>
      <p className="hint-text">Real NBA history from that season: real rosters, real players on their real careers, real draft classes. A title scores 1,000 plus 250 for every season left; wins and playoff runs add up along the way. Settings are fixed so every score is fair.</p>
    </section>}

    {challenge === 'worldgames' && <section className="create-step" aria-labelledby="create-step-wg">
      <h2 id="create-step-wg"><span className="create-num">2</span> Pick the Games and your country</h2>
      <label className="create-field"><span>Your country</span>
        <select className="year-input" value={wgCountry} onChange={e => setWgCountry(e.target.value)}>{COUNTRIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}</select>
        <small>Pick from your country's real players {wgGames === 'fantasy' ? 'of all time' : 'of that season'}; empty spots go to home-league players. No contracts, trades or free agency here: pick twelve and play.</small>
      </label>
      <div className="create-choices create-choices-3" role="radiogroup" aria-label="Which Games">
        {MODE_GAMES.map(g => <button key={String(g.id)} role="radio" aria-checked={wgGames === g.id} className={`create-choice ${wgGames === g.id ? 'selected' : ''}`} onClick={() => setWgGames(g.id)}>
          <span className="create-choice-head"><b>{g.label}</b></span><span className="create-choice-blurb">{g.blurb}</span>
        </button>)}
      </div>
    </section>}

    {challenge === 'draft' && <section className="create-step" aria-labelledby="create-step-draft">
      <h2 id="create-step-draft"><span className="create-num">2</span> How it works</h2>
      <ol className="create-steps-list">
        <li><b>Pick your team and the rules' era</b> in the draft room.</li>
        <li><b>Draft thirteen rounds</b> against AI GMs who build for need, from every player in history at his best.</li>
        <li><b>Play the season</b> with the full GM game: trades, the playoffs and beyond.</li>
      </ol>
    </section>}

    <div className="create-go">
      <div className="create-go-text"><b>{challenge === 'free' ? `${name.trim() || 'My League'}` : challenge === 'rebuild' ? sc.title : challenge === 'worldgames' ? `World Games: ${wgCountry}` : 'All-Time Draft'}</b>
        <small>{challenge === 'free' ? `${source === 'random' ? 'Random league' : source === 'csv' ? 'Your own data' : 'Real NBA'}${source !== 'csv' ? ` · ${seasonName(Number(year))}` : ''} · ${DIFFICULTIES.find(d => d.id === difficulty)!.label}${changed ? ` · ${changed} custom setting${changed > 1 ? 's' : ''}` : ''}` : challenge === 'rebuild' ? `${sc.team} · ${sc.seasons} seasons to win a title` : challenge === 'worldgames' ? MODE_GAMES.find(g => g.id === wgGames)?.label : 'Thirty teams, thirteen rounds'}</small></div>
      <button className="primary create-start" disabled={!!busy} onClick={start}><PixelIcon name="play" size={16} /> {startLabel}</button>
    </div>

    {editing && <SettingsDialog value={settings} random={source === 'random'} onDone={s => { setSettings(s); setEditing(false); }} onCancel={() => setEditing(false)} />}
  </div>;
}

function Toggle({ on, set, title, blurb }: { on: boolean; set: (v: boolean) => void; title: string; blurb: string }) {
  return <button role="switch" aria-checked={on} className={`create-toggle ${on ? 'on' : ''}`} onClick={() => set(!on)}>
    <span className="create-switch" aria-hidden="true"><i /></span><span><b>{title}</b><small>{blurb}</small></span>
  </button>;
}

/** League settings before the league exists. */
function SettingsDialog({ value, random, onDone, onCancel }: { value: CreateSettings; random: boolean; onDone: (s: CreateSettings) => void; onCancel: () => void }) {
  const [s, setS] = useState(value);
  const set = <K extends keyof CreateSettings>(k: K, v: CreateSettings[K]) => setS(x => ({ ...x, [k]: v }));
  return <Modal label="League settings" onClose={onCancel} className="create-settings-modal">
    <h2>League settings</h2>
    <p className="hint-text">These apply from the first game. You can change them all later in the league's Settings.</p>
    <div className="create-settings-grid">
      <div className="create-setting wide"><b>Game style</b>
        <div className="create-segment wrap" role="radiogroup" aria-label="Game style">{FEELS.map(f => <button key={f.id} role="radio" aria-checked={s.feel === f.id} className={s.feel === f.id ? 'selected' : ''} onClick={() => set('feel', f.id)}>{f.id}</button>)}</div>
        <small>{FEELS.find(f => f.id === s.feel)!.blurb}</small></div>
      <label className="create-setting"><b>Games a season</b>
        <select className="year-input" value={s.games} onChange={e => set('games', Number(e.target.value))}>{GAME_COUNTS.map(g => <option key={g} value={g}>{g} games</option>)}</select>
        <small>Shorter seasons play faster.</small></label>
      <label className="create-setting"><b>Quarter length</b>
        <select className="year-input" value={s.quarterMinutes} onChange={e => set('quarterMinutes', Number(e.target.value))}>{QUARTER_LENGTHS.map(q => <option key={q} value={q}>{q} minutes{q === 12 ? ' (NBA)' : q === 10 ? ' (FIBA)' : ''}</option>)}</select>
        <small>Stats scale with the minutes played.</small></label>
      <label className="create-setting"><b>Rules era</b>
        <select className="year-input" value={s.era} onChange={e => set('era', e.target.value as CreateSettings['era'])}>{ERA_CHOICES.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}</select>
        <small>The 3-point line, hand-checking, zone defence and defensive 3 seconds.</small></label>
      <label className="create-setting"><b>Trade deadline</b>
        <input type="range" min={0.3} max={0.9} step={0.05} value={s.tradeDeadline} onChange={e => set('tradeDeadline', Number(e.target.value))} />
        <small>After {Math.round(s.tradeDeadline * 100)}% of the season.</small></label>
      <label className="create-setting"><b>Home-court edge</b>
        <input type="range" min={0} max={0.1} step={0.01} value={s.homeCourt} onChange={e => set('homeCourt', Number(e.target.value))} />
        <small>{s.homeCourt === 0 ? 'None' : `${Math.round(s.homeCourt * 100)}% (NBA-like is 3%)`}</small></label>
      <div className="create-setting"><b>Injuries</b>
        <div className="create-segment" role="radiogroup" aria-label="Injuries">{[['Off', 0], ['Fewer', 0.5], ['Normal', 1], ['More', 2]].map(([l, r]) => { const on = r === 0 ? !s.injuries : s.injuries && s.injuryRate === r; return <button key={l} role="radio" aria-checked={on} className={on ? 'selected' : ''} onClick={() => setS(x => ({ ...x, injuries: r !== 0, injuryRate: r === 0 ? 1 : Number(r) }))}>{l}</button>; })}</div>
        <small>Players miss games and need the Medical Room.</small></div>
      <div className="create-setting"><b>Systems</b>
        <label className="create-check"><input type="checkbox" checked={s.fatigue} onChange={e => set('fatigue', e.target.checked)} /> Fatigue</label>
        <label className="create-check"><input type="checkbox" checked={s.chemistry} onChange={e => set('chemistry', e.target.checked)} /> Team chemistry</label></div>
      {random && <label className="create-setting"><b>Salary cap</b>
        <input type="range" min={100_000_000} max={200_000_000} step={5_000_000} value={s.salaryCap} onChange={e => set('salaryCap', Number(e.target.value))} />
        <small>${Math.round(s.salaryCap / 1e6)}M; the luxury tax line moves with it.</small>
        <span className="create-check"><input type="checkbox" checked={s.hardCap} onChange={e => set('hardCap', e.target.checked)} id="create-hardcap" /> <label htmlFor="create-hardcap">Hard cap (no going over)</label></span></label>}
      <div className="create-setting wide"><b>World Games</b>
        <label className="create-check"><input type="checkbox" checked={s.worldGames} onChange={e => set('worldGames', e.target.checked)} /> Every four summers, the league's best players play for their countries</label>
        {s.worldGames && <select className="year-input" value={s.worldGamesCoach} onChange={e => set('worldGamesCoach', e.target.value)} aria-label="Who plays the World Games">
          <option value="">The AI plays every country</option>
          {COUNTRIES.map(c => <option key={c.name} value={c.name}>I coach {c.name}</option>)}
        </select>}
        <small>Medals stay on the players for good and count for the Hall of Fame. Coach a country to pick its twelve and play it yourself.</small></div>
      <div className="create-setting wide"><b>Sandbox mode</b>
        <label className="create-check"><input type="checkbox" checked={s.sandbox} onChange={e => set('sandbox', e.target.checked)} /> Ratings over 100 and edit anything</label>
        <small>Sandbox leagues don't count for achievements, the GM career or the leaderboards.</small></div>
    </div>
    <div className="contest-actions">
      <button className="primary" onClick={() => onDone(s)}>Done</button>
      <button onClick={() => setS(DEFAULT_CREATE)}>Reset to defaults</button>
      <button className="link-button" onClick={onCancel}>Cancel</button>
    </div>
  </Modal>;
}
