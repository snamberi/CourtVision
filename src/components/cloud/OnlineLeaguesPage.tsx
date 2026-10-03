import { useEffect, useState } from 'react';
import { cloudEnabled, useAccount } from '../../cloud/account';
import { openSignIn } from '../../cloud/signIn';
import { myOnlineLeagues, peekOnlineLeague, joinOnlineLeague, createOnlineLeague, leaveOnlineLeague, MAX_MEMBERS, type OnlineLeague, type Peek } from '../../cloud/onlineLeague';
import { listSaves, getSave, type SaveSummary } from '../../storage/saves';
import { formatSeasonYear } from '../../simulation/calendar';
import { PixelIcon } from '../PixelIcon';
import '../hunt/hunt.css';
import '../locker/locker.css';

/*
 * Online GM leagues (#/online): your leagues with friends, starting one from a league you already have, and joining one
 * with a six-letter code. Opening a league loads it into the normal GM screens, with the online bar on top.
 */

export function OnlineLeaguesPage({ onExit, onOpen }: { onExit: () => void; onOpen: (l: OnlineLeague) => Promise<void> }) {
  const acct = useAccount();
  const signedIn = acct.status === 'signedIn';
  const [leagues, setLeagues] = useState<OnlineLeague[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!cloudEnabled || !signedIn) { setLeagues([]); return; }
    let live = true;
    myOnlineLeagues().then(l => { if (live) { setLeagues(l); setError(null); } }, (e: Error) => { if (live) { setLeagues([]); setError(e.message); } });
    return () => { live = false; };
  }, [signedIn, tick]);
  const open = async (l: OnlineLeague) => {
    setBusy(`Loading ${l.name}…`);
    try { await onOpen(l); } catch (e) { setError((e as Error).message); setBusy(null); }
  };
  return <div className="hunt locker online-page">
    <header className="hunt-top">
      <button className="hunt-exit" onClick={onExit}><PixelIcon name="exit" size={16} /> Main Menu</button>
      <div className="hunt-title"><span className="pixel-eyebrow">GM MODE · WITH FRIENDS</span><h1>Online Leagues</h1></div>
    </header>
    {!cloudEnabled ? <p className="empty-state">Accounts and online leagues are not switched on for this site yet.</p> : !signedIn ? <section className="locker-bay">
      <h2><PixelIcon name="team" size={18} /> Run a league with your friends</h2>
      <p>Two to eight friends share one league, each running a team. Make your moves, press Ready, and the league moves forward when everyone is ready (or the deadline passes). Trades between friends need both of you to agree.</p>
      <button className="primary" onClick={openSignIn}>Sign in</button>
    </section> : <div className="online-grid">
      {error && <p className="empty-state" role="alert">{error}</p>}
      {busy && <p className="hint-text" role="status">{busy}</p>}
      <section className="locker-bay">
        <h2><PixelIcon name="team" size={18} /> Your online leagues</h2>
        {leagues == null ? <p className="hint-text">Loading…</p> : !leagues.length ? <p className="hint-text">You're not in an online league yet. Start one below or join a friend's with their code.</p>
          : <ul className="online-list">{leagues.map(l => <li key={l.id}>
            <div><b>{l.name}</b><small>Code <code>{l.code}</code>{l.season ? ` · ${formatSeasonYear(l.season)}` : ''}{l.statusLine ? ` · ${l.statusLine}` : ''}</small></div>
            <button className="primary" disabled={!!busy || !l.statePath} onClick={() => void open(l)}>Open</button>
            <button disabled={!!busy} onClick={() => { if (window.confirm(`Leave ${l.name}? Your team goes back to the AI.`)) void leaveOnlineLeague(l.id).then(() => setTick(t => t + 1), (e: Error) => setError(e.message)); }}>Leave</button>
          </li>)}</ul>}
      </section>
      <JoinLeague onJoined={() => setTick(t => t + 1)} />
      <CreateLeague onCreated={l => { setTick(t => t + 1); void open(l); }} />
      <section className="locker-bay online-how">
        <h2><PixelIcon name="check" size={18} /> How it works</h2>
        <ul>
          <li><b>Your team, your moves.</b> Set your lineup, sign free agents, trade with AI teams, then press <i>Save to the league</i>. The AI never touches a friend's team.</li>
          <li><b>Ready up.</b> When everyone is ready (or the deadline passes), anyone can play the next stretch of games; then everyone's Ready resets.</li>
          <li><b>Trades between friends.</b> Pick a friend's team on the Trade page and send the offer: it waits for them to accept.</li>
          <li><b>No overwriting.</b> If a friend saved while you were playing, you load their version and redo your moves.</li>
          <li><b>Draft picks.</b> When a friend isn't online for the draft, the AI picks the best player left for them.</li>
        </ul>
      </section>
    </div>}
  </div>;
}

function JoinLeague({ onJoined }: { onJoined: () => void }) {
  const [code, setCode] = useState('');
  const [peek, setPeek] = useState<Peek | null>(null);
  const [team, setTeam] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const look = async () => {
    setMsg(null); setPeek(null);
    try { const p = await peekOnlineLeague(code); if (!p) setMsg('No league has that code.'); else { setPeek(p); setTeam(p.teams.find(t => !p.taken.includes(t.id))?.id ?? ''); } } catch (e) { setMsg((e as Error).message); }
  };
  const join = async () => {
    try { await joinOnlineLeague(code, team); setPeek(null); setCode(''); setMsg('You are in. Open the league from your list.'); onJoined(); } catch (e) { setMsg((e as Error).message); }
  };
  return <section className="locker-bay">
    <h2><PixelIcon name="search" size={18} /> Join with a code</h2>
    <form className="signin-email" onSubmit={e => { e.preventDefault(); void look(); }}>
      <label htmlFor="online-code">League code</label>
      <div><input id="online-code" className="year-input" value={code} maxLength={6} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="ABC123" autoComplete="off" /><button type="submit" disabled={code.length !== 6}>Find</button></div>
    </form>
    {peek && <div className="online-peek">
      <p><b>{peek.name}</b> · {peek.members}/{MAX_MEMBERS} GMs{peek.season ? ` · ${formatSeasonYear(peek.season)}` : ''}</p>
      {peek.members >= MAX_MEMBERS ? <p className="empty-state">This league is full.</p> : <>
        <label>Your team<select className="year-input" value={team} onChange={e => setTeam(e.target.value)}>{peek.teams.map(t => <option key={t.id} value={t.id} disabled={peek.taken.includes(t.id)}>{t.name}{peek.taken.includes(t.id) ? ' (taken)' : ''}</option>)}</select></label>
        <button className="primary" disabled={!team} onClick={() => void join()}>Join as {peek.teams.find(t => t.id === team)?.name ?? '…'}</button>
      </>}
    </div>}
    {msg && <p className="hint-text" role="status">{msg}</p>}
  </section>;
}

function CreateLeague({ onCreated }: { onCreated: (l: OnlineLeague) => void }) {
  const [saves, setSaves] = useState<SaveSummary[] | null>(null);
  const [saveId, setSaveId] = useState('');
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [team, setTeam] = useState('');
  const [name, setName] = useState('');
  const [hours, setHours] = useState(24);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void listSaves().then(s => { setSaves(s); if (s[0]) setSaveId(s[0].id); }, () => setSaves([])); }, []);
  useEffect(() => {
    if (!saveId) return;
    let live = true;
    void getSave(saveId).then(s => {
      if (!live || !s) return;
      const list = s.league.teams.map(t => ({ id: t.teamId, name: t.name }));
      setTeams(list); setTeam(s.controlledTeamId && list.some(t => t.id === s.controlledTeamId) ? s.controlledTeamId : list[0]?.id ?? '');
      setName(n => n || (saves?.find(x => x.id === saveId)?.name ?? 'Online League'));
    });
    return () => { live = false; };
  }, [saveId, saves]);
  const create = async () => {
    setBusy(true); setMsg(null);
    try {
      const s = await getSave(saveId);
      if (!s) throw new Error('That save could not be read.');
      onCreated(await createOnlineLeague(name, s.league, s.extras, team, hours));
    } catch (e) { setMsg((e as Error).message); }
    setBusy(false);
  };
  return <section className="locker-bay">
    <h2><PixelIcon name="crown" size={18} /> Start an online league</h2>
    <p className="hint-text">Pick one of your leagues on this device: a copy goes online, and you are its commissioner. Friends join with the code it gets.</p>
    {saves == null ? <p className="hint-text">Loading your leagues…</p> : !saves.length ? <p className="empty-state">Start a GM league first (New Franchise), then bring it online here.</p> : <div className="online-create">
      <label>League<select className="year-input" value={saveId} onChange={e => { setSaveId(e.target.value); setName(''); }}>{saves.map(s => <option key={s.id} value={s.id}>{s.name}{s.season ? ` · ${formatSeasonYear(s.season)}` : ''}</option>)}</select></label>
      <label>Your team<select className="year-input" value={team} onChange={e => setTeam(e.target.value)}>{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <label>Name online<input className="year-input" value={name} maxLength={40} onChange={e => setName(e.target.value)} /></label>
      <label>Deadline<select className="year-input" value={hours} onChange={e => setHours(Number(e.target.value))}>{[6, 12, 24, 48, 72].map(h => <option key={h} value={h}>{h} hours</option>)}</select></label>
      <button className="primary" disabled={busy || !team || !saveId} onClick={() => void create()}>{busy ? 'Uploading the league…' : 'Create the online league'}</button>
    </div>}
    {msg && <p className="empty-state" role="alert">{msg}</p>}
  </section>;
}
