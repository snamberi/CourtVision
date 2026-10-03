import { challengePrefs, saveChallengePrefs, type Level } from '../../retention/challenge';
import { LevelPicker } from '../ChallengeOptions';
import type { TradeDifficulty } from '../../simulation/gm';
import { useEffect, useMemo, useState } from 'react';
import { defaultTeam } from '../../profile/favorites';
import type { NbaHistory } from '../../history/nbaHistoryData';
import type { League } from '../../simulation/league';
import type { GMLeagueExtras } from '../../simulation/gm';
import type { HuntCard } from '../../hunt/cards';
import { ERAS } from '../../hunt/eras';
import { noteFeat } from '../../profile/feats';
import { draftPool, legendRank, newDraft, runAi, autoPick, makePick, onClock, isDone, rosterOf, groupOf, buildDraftLeague, teamStrength, available, eraById, saveDraft, loadDraft, ROUNDS, type DraftState, type DraftTeam } from '../../draft/allTimeDraft';
import { weekKey, weeklySeed } from '../../retention/week';
import { PixelIcon } from '../PixelIcon';
import { PlayerAvatar } from '../PlayerAvatar';
import { DraftWall } from './DraftWall';
import { usePickClock } from './usePickClock';
import { readPickClock, writePickClock, PICK_CLOCK_SECONDS } from '../../draft/wall';
import { track } from '../../analytics/track';
import '../hunt/hunt.css';
import './draft.css';
import { statWhole } from '../statFormat';

type Base = { league: League; extras: GMLeagueExtras };
const season = (end: number) => `${end - 1}-${String(end).slice(2)}`;
const POS: ('ALL' | 'G' | 'F' | 'C')[] = ['ALL', 'G', 'F', 'C'];
/** The franchises the draft fills (fixed, so a saved draft resumes into the same league). */
const BASE_SEED = 1;

/** 06 / DRAFT: the All-Time Draft. Setup, the draft board, and the league it leaves. */
export function AllTimeDraft({ onExit, onStart }: { onExit: () => void; onStart: (league: League, extras: GMLeagueExtras, teamId: string, name: string) => void }) {
  const [h, setH] = useState<NbaHistory | null>(null);
  const [base, setBase] = useState<Base | null>(null);
  const [state, setState] = useState<DraftState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>('Loading every player in history…');
  const [saved] = useState(() => loadDraft());

  useEffect(() => {
    let live = true;
    (async () => {
      const d = await import('../../history/nbaHistoryData').then(m => m.loadNbaHistory());
      if (!live) return;
      setH(d); setBusy('Setting up the thirty franchises…');
      await new Promise(r => setTimeout(r, 20));
      const { buildHistoricalLeague } = await import('../../history/historicalLeague');
      const { initializeCoaching } = await import('../../simulation/staffManagement');
      const built = buildHistoricalLeague(d, d.manifest.coverage.seasons[1] - 1, { realDevelopment: false, difficulty: 'normal', seed: BASE_SEED });
      if (!live) return;
      setBase({ league: initializeCoaching(built.league, null), extras: built.extras });
      setBusy(null);
    })().catch(e => { if (live) setError(e instanceof Error ? e.message : String(e)); });
    return () => { live = false; };
  }, []);

  const begin = async (make: (teams: DraftTeam[]) => DraftState) => {
    if (!h || !base) return;
    try {
      const s = runAi(h, make(base.league.teams.map(t => ({ id: t.teamId, name: t.name }))));
      setState(s); saveDraft(s);
      track('mode_start', { mode: 'draft', variant: s.config.weekly ? 'weekly' : 'custom', era: s.config.eraId });
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  const pick = (cardId: string) => {
    if (!h || !state) return;
    const next = runAi(h, makePick(state, cardId));
    setState(next); saveDraft(next);
  };
  const autoRest = () => {
    if (!h || !state) return;
    let s = state;
    while (!isDone(s)) { s = runAi(h, s); if (!isDone(s)) s = makePick(s, autoPick(h, s, s.config.userTeam).id); }
    setState(s); saveDraft(s);
  };
  const finish = async () => {
    if (!h || !state || !base) return;
    setBusy('Building your league…');
    await new Promise(r => setTimeout(r, 20));
    try {
      const built = buildDraftLeague(h, state, base);
      saveDraft(null);
      const strengths = state.config.teams.map(t => ({ id: t.id, s: teamStrength(rosterOf(h, state, t.id)) })).sort((a, b) => b.s - a.s);
      noteFeat('drafts', 1);
      if (strengths[0]?.id === state.config.userTeam) noteFeat('draftTop', 1);
      const era = eraById(state.config.eraId);
      onStart(built.league, built.extras, state.config.userTeam, state.config.weekly ? `All-Time Draft of the Week ${state.config.weekly}` : `All-Time Draft (${era.label})`);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setBusy(null); }
  };

  const header = <header className="hunt-top">
    <button className="hunt-exit" onClick={onExit}><PixelIcon name="exit" size={16} /> Main Menu</button>
    <div className="hunt-title"><span className="pixel-eyebrow">06 / DRAFT</span><h1>All-Time Draft</h1></div>
  </header>;
  if (error) return <div className="hunt draft">{header}<p className="empty-state">{error}</p></div>;
  if (!h || !base || busy) return <div className="hunt draft">{header}<p className="hint-text" role="status">{busy}</p></div>;
  if (!state) return <div className="hunt draft">{header}<Setup h={h} teams={base.league.teams.map(t => ({ id: t.teamId, name: t.name })).sort((a, b) => a.name.localeCompare(b.name))} saved={saved} onResume={s => { setState(s); }} onStart={begin} /></div>;
  return <div className="hunt draft">{header}{isDone(state) ? <Results h={h} s={state} onStart={() => void finish()} onRedo={() => { saveDraft(null); setState(null); }} /> : <Board h={h} s={state} onPick={pick} onAutoRest={autoRest} />}</div>;
}

// ---------------------------------------------------------------- setup

const LEVEL_TO_TRADE: Record<Level, TradeDifficulty> = { rookie: 'easy', pro: 'normal', legend: 'hard' };
const DRAFT_LEVEL_BLURB: Record<Level, string> = {
  rookie: 'The AI GMs reach and miss: more steals fall to you, and trades after the draft are easier.',
  pro: 'The standard draft (the weekly board is always Pro).',
  legend: 'The AI GMs draft sharp and drive hard bargains in trades. Good luck.',
};

function Setup({ h, teams, saved, onResume, onStart }: { h: NbaHistory; teams: DraftTeam[]; saved: DraftState | null; onResume: (s: DraftState) => void; onStart: (make: (teams: DraftTeam[]) => DraftState) => Promise<void> }) {
  const [era, setEra] = useState('20s');
  const [slot, setSlot] = useState<number | 'random'>('random');
  const [team, setTeam] = useState<string>(() => defaultTeam(teams.map(t => t.id)));
  const [week] = useState(() => weekKey());
  const [level, setLevel] = useState(() => challengePrefs('draft').level);
  const top = draftPool(h).slice(0, 5);
  const wSeed = weeklySeed('draft', week);
  const wEra = ERAS[wSeed % ERAS.length], wSlot = Math.floor(wSeed / 7) % 30;
  const start = (weekly: boolean) => {
    const seed = weekly ? wSeed : Math.floor(Math.random() * 1_000_000_000);
    const userSlot = weekly ? wSlot : slot === 'random' ? Math.floor(Math.random() * 30) : slot;
    void onStart(ts => newDraft({ seed, eraId: weekly ? wEra.id : era, userTeam: team, userSlot, teams: ts, difficulty: weekly ? 'normal' : LEVEL_TO_TRADE[level], ...(weekly ? { weekly: week } : {}) }));
  };
  return <section className="hunt-stage">
    <p className="hunt-lede">Thirty teams take turns picking from every player in NBA history, each at his best season. Snake order, thirteen rounds. AI GMs take the best player left for what their roster needs. Then your team plays a full season under the era's rules, with every GM tool: trades, free agency, the draft, and on and on if you like.</p>
    {saved && !isDone(saved) && <div className="signin-strip"><span>Your draft is waiting: round {onClock(saved)?.round} of {ROUNDS}, {eraById(saved.config.eraId).label} rules.</span><button className="primary" onClick={() => onResume(saved)}>Resume the draft</button></div>}
    <div className="draft-setup">
      <label>Your franchise<select className="year-input" value={team} onChange={e => setTeam(e.target.value)}>{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <label>Draft slot<select className="year-input" value={slot} onChange={e => setSlot(e.target.value === 'random' ? 'random' : Number(e.target.value))}><option value="random">Random</option>{Array.from({ length: 30 }, (_, i) => <option key={i} value={i}>Pick {i + 1}{i === 0 ? ' (first)' : i === 29 ? ' (last, then first in round 2)' : ''}</option>)}</select></label>
      <label>Era rules<select className="year-input" value={era} onChange={e => setEra(e.target.value)}>{ERAS.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
    </div>
    <p className="hint-text">{eraById(era).blurb}</p>
    <div className="draft-level"><b>Difficulty</b><LevelPicker value={level} onChange={l => { setLevel(l); saveChallengePrefs('draft', { level: l }); }} blurbs={DRAFT_LEVEL_BLURB} /></div>
    <div className="contest-actions"><button className="primary" onClick={() => start(false)}>Start the draft</button></div>
    <div className="weekly-card">
      <div><span className="pixel-eyebrow">ALL-TIME DRAFT OF THE WEEK · {week}</span><b>{wEra.label} rules · you pick {wSlot + 1}{wSlot === 0 ? 'st' : wSlot === 1 ? 'nd' : wSlot === 2 ? 'rd' : 'th'}</b>
        <p>The same draft order, the same AI GMs and the same era for everyone this week. Out-draft them all.</p></div>
      <button onClick={() => start(true)}>Draft this week's board</button>
    </div>
    <h3 className="hunt-subhead">The top of the board</h3>
    <ol className="draft-top">{top.map(c => <li key={c.id}><PlayerAvatar playerId={c.name} primaryColor="#f47b20" secondaryColor="#f4f0e6" size={36} /><b>{c.name}</b><small>{season(c.end)} · {c.pos} · {c.ovr}</small></li>)}</ol>
  </section>;
}

// ---------------------------------------------------------------- the board

function Board({ h, s, onPick, onAutoRest }: { h: NbaHistory; s: DraftState; onPick: (cardId: string) => void; onAutoRest: () => void }) {
  const [pos, setPos] = useState<'ALL' | 'G' | 'F' | 'C'>('ALL');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(60);
  const [view, setView] = useState<'players' | 'wall'>('players');
  const [timed, setTimed] = useState(readPickClock);
  const clock = onClock(s)!;
  const me = s.config.userTeam;
  const teamName = (id: string) => s.config.teams.find(t => t.id === id)?.name ?? id;
  const mine = rosterOf(h, s, me);
  const avail = useMemo(() => available(h, s), [h, s]);
  const shown = avail.filter(c => (pos === 'ALL' || groupOf(c.pos) === pos) && (!q || c.name.toLowerCase().includes(q.toLowerCase()))).slice(0, limit);
  const suggestion = clock.teamId === me ? autoPick(h, s, me) : null;
  const recent = s.picks.slice(-8).reverse();
  const byId = (id: string): HuntCard | undefined => draftPool(h).find(c => c.id === id);
  const counts = (['G', 'F', 'C'] as const).map(g => `${g} ${mine.filter(c => groupOf(c.pos) === g).length}`).join(' · ');
  // The optional pick clock: it runs only while you are on the clock, and drafts the best fit when it hits zero.
  const left = usePickClock(timed && !!suggestion, PICK_CLOCK_SECONDS, () => { if (suggestion) onPick(suggestion.id); }, s.picks.length);
  return <section className="hunt-stage draft-board">
    <div className="draft-clock">
      <div><span className="pixel-eyebrow">ROUND {clock.round} OF {ROUNDS} · PICK {clock.pick} · #{clock.overall} OVERALL</span><h2>{clock.teamId === me ? 'You are on the clock' : `${teamName(clock.teamId)} is picking…`}</h2>
        <small>{eraById(s.config.eraId).label} rules · you draft for {teamName(me)}{s.config.weekly ? ` · Draft of the Week ${s.config.weekly}` : ''}</small></div>
      <div className="draft-clock-side">
        {suggestion && timed && <div className={`draft-timer ${left <= 10 ? 'low' : ''}`} role="timer" aria-label={`${left} seconds to pick`}>0:{String(left).padStart(2, '0')}</div>}
        {suggestion && <div className="draft-suggest"><small>BEST FIT</small><button className="primary" onClick={() => onPick(suggestion.id)}>Draft {suggestion.name}</button></div>}
        <label className="draft-timer-toggle"><input type="checkbox" checked={timed} onChange={e => { setTimed(e.target.checked); writePickClock(e.target.checked); }} /> Pick clock ({PICK_CLOCK_SECONDS}s, then best fit)</label>
      </div>
    </div>
    <div className="board-picker draft-views" role="tablist" aria-label="Draft view">
      <button role="tab" aria-selected={view === 'players'} className={`difficulty-chip ${view === 'players' ? 'selected' : ''}`} onClick={() => setView('players')}>Players</button>
      <button role="tab" aria-selected={view === 'wall'} className={`difficulty-chip ${view === 'wall' ? 'selected' : ''}`} onClick={() => setView('wall')}>Draft wall</button>
    </div>
    {view === 'wall' ? <DraftWall h={h} s={s} /> : <>
    <div className="draft-grid">
      <div>
        <div className="board-options">
          <div className="board-picker" role="radiogroup" aria-label="Position">{POS.map(p => <button key={p} role="radio" aria-checked={pos === p} className={`difficulty-chip ${pos === p ? 'selected' : ''}`} onClick={() => setPos(p)}>{p === 'ALL' ? 'All' : p === 'G' ? 'Guards' : p === 'F' ? 'Forwards' : 'Bigs'}</button>)}</div>
          <input className="year-input" placeholder="Search a player" value={q} onChange={e => setQ(e.target.value)} aria-label="Search players" />
        </div>
        <div className="feature-table-scroll"><table className="db-table draft-table">
          <thead><tr><th className="col-name">Player</th><th>All-time</th><th>Pos</th><th className="col-name">Best season</th><th>OVR</th><th>PPG</th><th>RPG</th><th>APG</th><th /></tr></thead>
          <tbody>{shown.map(c => <tr key={c.id}>
            <td className="col-name">{c.name}</td><td>{legendRank(h, c.playerId) ? `#${legendRank(h, c.playerId)}` : ''}</td><td>{c.pos}</td><td className="col-name">{season(c.end)} {c.teamName}</td><td><b>{c.ovr}</b></td>
            <td>{statWhole(c.ppg)}</td><td>{statWhole(c.rpg)}</td><td>{statWhole(c.apg)}</td>
            <td>{clock.teamId === me && <button className="primary" onClick={() => onPick(c.id)}>Draft</button>}</td>
          </tr>)}</tbody>
        </table></div>
        {shown.length >= limit && <button className="link-button" onClick={() => setLimit(l => l + 60)}>Show more players</button>}
      </div>
      <aside className="draft-side">
        <h3 className="hunt-subhead">Your team · {mine.length}/{ROUNDS}</h3>
        <small className="hint-text">{counts} · strength {teamStrength(mine) || '—'}</small>
        <ol className="draft-mine">{Array.from({ length: ROUNDS }, (_, i) => { const c = mine[i]; return <li key={i} className={c ? '' : 'empty'}>{c ? <><b>{c.name}</b><small>{c.pos} · {season(c.end)} · {c.ovr}</small></> : <small>Round {i + 1}</small>}</li>; })}</ol>
        <button onClick={onAutoRest}>Auto-draft the rest for me</button>
        <h3 className="hunt-subhead">Latest picks</h3>
        <ol className="draft-log">{recent.map(p => { const c = byId(p.cardId); return <li key={p.overall} className={p.teamId === me ? 'mine' : ''}><small>#{p.overall}</small><span>{teamName(p.teamId)}</span><b>{c?.name}</b></li>; })}</ol>
      </aside>
    </div></>}
  </section>;
}

// ---------------------------------------------------------------- after the draft

function Results({ h, s, onStart, onRedo }: { h: NbaHistory; s: DraftState; onStart: () => void; onRedo: () => void }) {
  const me = s.config.userTeam;
  const ranked = s.config.teams.map(t => ({ ...t, roster: rosterOf(h, s, t.id) })).map(t => ({ ...t, strength: teamStrength(t.roster) })).sort((a, b) => b.strength - a.strength);
  const myRank = ranked.findIndex(t => t.id === me) + 1;
  const mine = ranked.find(t => t.id === me)!;
  return <section className="hunt-stage">
    <div className={`hunt-result ${myRank <= 5 ? 'won' : ''}`}><span className="pixel-eyebrow">THE DRAFT IS DONE</span>
      <h2>{mine.name}: #{myRank} of {ranked.length} on paper</h2>
      <p>Team strength {mine.strength} (best eight players). {myRank === 1 ? 'The favourites. Now win it.' : myRank <= 5 ? 'A contender from day one.' : myRank <= 15 ? 'In the mix. Trades and the rotation will decide it.' : 'Underdogs. Time to out-coach and out-trade everyone.'}</p></div>
    <div className="contest-actions"><button className="primary" onClick={onStart}>Start the season</button><button className="link-button" onClick={onRedo}>Draft again</button></div>
    <div className="draft-grid">
      <div><h3 className="hunt-subhead">Your roster</h3>
        <ol className="draft-mine">{mine.roster.map(c => <li key={c.id}><b>{c.name}</b><small>{c.pos} · {season(c.end)} {c.teamName} · {c.ovr}</small></li>)}</ol></div>
      <div><h3 className="hunt-subhead">Power rankings after the draft</h3>
        <ol className="draft-log">{ranked.map((t, i) => <li key={t.id} className={t.id === me ? 'mine' : ''}><small>{i + 1}</small><span>{t.name}</span><b>{t.strength}</b><small>{t.roster[0]?.name}</small></li>)}</ol></div>
    </div>
    <h3 className="hunt-subhead">The draft wall</h3>
    <DraftWall h={h} s={s} />
  </section>;
}
