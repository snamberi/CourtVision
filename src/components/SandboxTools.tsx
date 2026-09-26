import { useMemo, useState } from 'react';
import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import type { NbaHistory, HistPlayer } from '../history/nbaHistoryData';
import { calculateOverall } from '../simulation/engine/overall';
import { setStick, isStuck, type StickRule } from '../simulation/sticky';
import { PixelIcon } from './PixelIcon';

interface Props {
  league: League;
  extras: GMLeagueExtras;
  onChange: (league: League, extras: GMLeagueExtras) => void;
  onToast?: (text: string, tone?: 'success' | 'error' | 'info') => void;
}

type HistoryTools = { h: NbaHistory; mod: typeof import('../history/importPlayer') };
let historyPromise: Promise<HistoryTools> | null = null;
const loadHistory = () => (historyPromise ??= Promise.all([import('../history/nbaHistoryData'), import('../history/importPlayer')])
  .then(([data, mod]) => data.loadNbaHistory().then(h => ({ h, mod }))).catch(e => { historyPromise = null; throw e; }));

/** Sandbox: bring in any real player from any season. */
export function ImportHistoryPanel({ league, extras, onChange, onToast }: Props) {
  const [tools, setTools] = useState<HistoryTools | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<HistPlayer | null>(null);
  const [end, setEnd] = useState<number | null>(null);
  const [teamId, setTeamId] = useState<string>(league.teams[0]?.teamId ?? '');
  const open = () => { setError(null); loadHistory().then(setTools).catch((e: unknown) => setError(e instanceof Error ? e.message : String(e))); };
  const results = useMemo(() => tools && !picked ? tools.mod.searchHistoryPlayers(tools.h, query) : [], [tools, query, picked]);
  const seasons = useMemo(() => tools && picked ? tools.mod.importableSeasons(tools.h, picked) : [], [tools, picked]);
  // Opens on his best season by rating.
  const pick = (p: HistPlayer) => {
    const list = tools ? tools.mod.importableSeasons(tools.h, p) : [];
    setPicked(p); setEnd(list.length ? list.reduce((best, x) => (x.ovr ?? 0) > (best.ovr ?? 0) ? x : best, list[0]).end : null);
  };

  const doImport = () => {
    if (!tools || !picked || end == null) return;
    try {
      const r = tools.mod.importHistoricalPlayer(tools.h, picked.id, end, league, extras, teamId || null);
      onChange(r.league, r.extras);
      onToast?.(`${r.playerId} (${end - 1}-${String(end).slice(2)}) joined ${teamId ? league.teams.find(t => t.teamId === teamId)?.name : 'free agency'}.`, 'success');
      setPicked(null); setQuery('');
    } catch (e) { onToast?.(e instanceof Error ? e.message : String(e), 'error'); }
  };

  return <section className="sandbox-tool">
    <h3><PixelIcon name="search" /> Import a player from any era</h3>
    <p className="hint-text">Bring any real NBA player into this league as he was in any season he played: his ratings from that season, his real number. From then on he develops, ages and moves in your league like anyone else.</p>
    {!tools ? <><button onClick={open}>Load NBA history</button>{error && <p className="hint-text" role="alert">{error}</p>}</>
      : !picked ? <>
        <input className="year-input" placeholder="Search a player (e.g. Michael Jordan)" value={query} onChange={e => setQuery(e.target.value)} aria-label="Search NBA history" autoFocus />
        <ul className="sandbox-results">{results.map(p => <li key={p.id}><button className="link-button" onClick={() => pick(p)}>{p.displayName}</button> <small>{p.firstSeason != null ? `${p.firstSeason}–${p.lastSeason}` : ''}{p.hallOfFame ? ' · Hall of Fame' : ''}{p.pos ? ` · ${p.pos}` : ''}</small></li>)}</ul>
        {query.trim().length >= 2 && !results.length && <p className="hint-text">No player found.</p>}
      </> : <div className="sandbox-import-form">
        <p><b>{picked.displayName}</b> <button className="link-button" onClick={() => setPicked(null)}>change</button></p>
        <label>Season <select value={end ?? ''} onChange={e => setEnd(Number(e.target.value))}>
          {seasons.map(s => <option key={s.end} value={s.end}>{s.end} · {s.team} · age {s.age ?? '?'}{s.ovr != null ? ` · ${s.ovr} OVR` : ''}{s.ppg != null ? ` · ${s.ppg} ppg` : ''}</option>)}
        </select></label>
        <label>Add to <select value={teamId} onChange={e => setTeamId(e.target.value)}>
          {league.teams.map(t => <option key={t.teamId} value={t.teamId}>{t.name}</option>)}
          <option value="">Free agency</option>
        </select></label>
        <button className="primary" onClick={doImport}>Import</button>
      </div>}
  </section>;
}

/** Sandbox: stick a player to a team, or to another player he'll follow everywhere. */
export function StickyPanel({ league, extras, onChange, onToast }: Props) {
  const everyone = useMemo(() => [...league.teams.flatMap(t => t.seasons.map(p => ({ p, team: t.name }))), ...extras.freeAgents.map(p => ({ p, team: 'Free agent' }))]
    .sort((a, b) => calculateOverall(b.p) - calculateOverall(a.p)), [league.teams, extras.freeAgents]);
  const [who, setWho] = useState('');
  const [mode, setMode] = useState<'team' | 'player'>('team');
  const [target, setTarget] = useState('');
  const stuck = everyone.filter(e => isStuck(e.p));
  const known = (id: string) => everyone.some(e => e.p.playerId === id);
  const apply = (playerId: string, rule: StickRule | null) => {
    const r = setStick(league, extras, playerId, rule);
    onChange(r.league, r.extras);
    onToast?.(rule ? `${playerId} is stuck ${rule.teamId ? `to ${league.teams.find(t => t.teamId === rule.teamId)?.name}` : `with ${rule.withPlayerId}`}.` : `${playerId} is unstuck.`, 'success');
  };
  const current = everyone.find(e => e.p.playerId === who)?.p;
  const valid = known(who) && (mode === 'team' ? league.teams.some(t => t.teamId === target) : known(target) && target !== who);

  return <section className="sandbox-tool">
    <h3><PixelIcon name="lock" /> Stick players</h3>
    <p className="hint-text">A player <b>stuck to a team</b> never leaves it (no trades, waivers or free agency) and won't retire. A player <b>stuck with another player</b> goes wherever that player goes, trades, signings and Historical rosters included, and won't retire either. Unstick to return to normal rules.</p>
    <datalist id="sandbox-players">{everyone.map(e => <option key={e.p.playerId} value={e.p.playerId}>{e.team} · {calculateOverall(e.p)} OVR</option>)}</datalist>
    <div className="sandbox-stick-form">
      <label>Player <input className="year-input" list="sandbox-players" value={who} onChange={e => setWho(e.target.value)} placeholder="Type a name" /></label>
      <label>Stick <select value={mode} onChange={e => { setMode(e.target.value as 'team' | 'player'); setTarget(''); }}><option value="team">to a team</option><option value="player">with a player</option></select></label>
      {mode === 'team'
        ? <label>Team <select value={target} onChange={e => setTarget(e.target.value)}><option value="">Choose…</option>{league.teams.map(t => <option key={t.teamId} value={t.teamId}>{t.name}</option>)}</select></label>
        : <label>Follows <input className="year-input" list="sandbox-players" value={target} onChange={e => setTarget(e.target.value)} placeholder="Type a name" /></label>}
      <button className="primary" disabled={!valid} onClick={() => apply(who, mode === 'team' ? { teamId: target } : { withPlayerId: target })}>Stick</button>
      {current && isStuck(current) && <button onClick={() => apply(who, null)}>Unstick</button>}
    </div>
    {stuck.length > 0 && <table className="db-table"><thead><tr><th className="col-name">Player</th><th>Now with</th><th>Stuck</th><th /></tr></thead><tbody>
      {stuck.map(({ p, team }) => <tr key={p.playerId}><td className="col-name">📌 {p.playerId}</td><td>{team}</td>
        <td>{p.stick?.teamId ? `to ${league.teams.find(t => t.teamId === p.stick!.teamId)?.name ?? p.stick.teamId}` : `with ${p.stick?.withPlayerId}`}</td>
        <td><button className="link-button" onClick={() => apply(p.playerId, null)}>Unstick</button></td></tr>)}
    </tbody></table>}
  </section>;
}
