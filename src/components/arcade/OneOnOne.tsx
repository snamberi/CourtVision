import { useEffect, useMemo, useState } from 'react';
import type { NbaHistory } from '../../history/nbaHistoryData';
import { wheelPool, donor } from '../../career/wheel';
import { ballerOf, playStreet, ratingsBaller, myBaller, type Baller, type StreetGame } from '../../arcade/street';
import { loadOne, saveOne, noteOne, eventTag, ONE_EVENT, type OneRecord } from '../../arcade/oneOnOne';
import { cleanRatings } from '../../profile/myRatings';
import { feetInches } from '../../career/categories';
import { noteHolidayFinish } from '../../retention/holiday';
import { celebrate } from '../../fx/effects';
import { PlayerAvatar } from '../PlayerAvatar';
import { MyAvatar } from '../UserAvatar';
import { PixelIcon } from '../PixelIcon';
import { LiveScore } from './StreetGames';

type Opp = { b: Baller; kind: 'nba' | 'user'; id: string; label: string; sub: string };
const seasonOf = (end: number) => `${end - 1}-${String(end).slice(2)}`;
const cleanUser = (s: string) => s.trim().replace(/^@/, '').slice(0, 30);

/** Loads a GM's public player (their Closet ratings, as their profile publishes them). */
async function userBaller(username: string): Promise<{ b: Baller; level: number }> {
  const name = cleanUser(username);
  if (!/^[\w.-]{2,30}$/.test(name)) throw new Error('Type a username (letters, numbers, dots, dashes).');
  const { loadProfile } = await import('../../cloud/boards');
  const d = await loadProfile(name);
  if (!d) throw new Error(`No GM called @${name}.`);
  const raw = d.profile.stats?.myPlayer;
  if (!raw) throw new Error(`@${d.profile.username} hasn't synced a player yet. Their player shows up after they next play signed in.`);
  return { b: ratingsBaller(cleanRatings(raw, d.profile.level), `@${d.profile.username}`, `@${d.profile.username}`), level: d.profile.level };
}

/**
 * 1v1 to 11 with your own player (the Closet ratings): against any real NBA player at his best season, or against
 * another GM's player. Ones and twos, win by two. Every game counts for your record; none of it is ranked.
 */
export function OneOnOne({ h }: { h: NbaHistory }) {
  const pool = useMemo(() => [...wheelPool(h)].sort((a, b) => b.ovr - a.ovr), [h]);
  const [side, setSide] = useState<'nba' | 'user'>('nba');
  const [q, setQ] = useState('');
  const [user, setUser] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opp, setOpp] = useState<Opp | null>(null);
  const [game, setGame] = useState<StreetGame | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [rec, setRec] = useState<OneRecord>(() => loadOne());
  useEffect(() => { const sync = () => setRec(loadOne()); window.addEventListener(ONE_EVENT, sync); return () => window.removeEventListener(ONE_EVENT, sync); }, []);
  const mine = useMemo(() => myBaller(), []);

  const hits = useMemo(() => { const t = q.trim().toLowerCase(); return t.length < 2 ? [] : pool.filter(c => c.name.toLowerCase().includes(t)).slice(0, 10); }, [q, pool]);
  const pickNba = (c: typeof pool[number]) => {
    setOpp({ b: ballerOf(donor(h, c.id), c.name, c.ovr, c.team), kind: 'nba', id: c.playerId, label: c.name, sub: `${seasonOf(c.end)} ${c.team} · ${c.ovr} OVR` });
    setGame(null); setError(null);
  };
  const randomNba = () => pickNba(pool[Math.floor(Math.random() * Math.min(400, pool.length))]);
  const findUser = async () => {
    setBusy(true); setError(null); setGame(null);
    try {
      const { b, level } = await userBaller(user);
      setOpp({ b, kind: 'user', id: b.name.slice(1), label: b.name, sub: `Level ${level} · ${b.ovr} OVR · ${feetInches(b.height)}` });
    } catch (e) { setOpp(null); setError(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  };

  const play = () => {
    if (!opp) return;
    const g = playStreet([mine], [opp.b], 11, Math.floor(Math.random() * 1e9));
    const won = g.winner === 0;
    noteHolidayFinish(won, eventTag(rec));
    const next = noteOne(rec, { kind: opp.kind, id: opp.id }, won);
    saveOne(next); setRec(next);
    setGame(g); setRevealed(false);
  };
  useEffect(() => { if (revealed && game?.winner === 0 && opp && opp.b.ovr >= 90) celebrate(); }, [revealed]); // eslint-disable-line react-hooks/exhaustive-deps

  const vsRec = opp?.kind === 'user' ? rec.users[opp.id.toLowerCase()] : null;
  return <section className="street-game one-on-one">
    <p className="hunt-lede">Your own player, with the ratings you built in the Closet, against anyone: a real NBA player at his best, or another GM's player. First to 11, ones and twos, win by two.</p>
    <div className="one-record">
      <div><MyAvatar size={48} /><span><b>{mine.name}</b><small>{mine.ovr} OVR · {feetInches(mine.height)}</small></span></div>
      <div className="one-stats"><span><b>{rec.w}-{rec.l}</b><small>record</small></span><span><b>{rec.beaten.length}</b><small>NBA players beaten</small></span></div>
    </div>
    <div className="stats-view-toggle" role="tablist" aria-label="Who to play">
      <button role="tab" aria-selected={side === 'nba'} className={side === 'nba' ? 'active' : ''} onClick={() => { setSide('nba'); setError(null); }}>NBA player</button>
      <button role="tab" aria-selected={side === 'user'} className={side === 'user' ? 'active' : ''} onClick={() => { setSide('user'); setError(null); }}>Another GM</button>
    </div>
    {side === 'nba' ? <div className="one-find">
      <input className="year-input" value={q} onChange={e => setQ(e.target.value)} placeholder="Any player, any era" aria-label="Find an NBA player" />
      <button onClick={randomNba}><PixelIcon name="shuffle" size={14} /> Random</button>
      {hits.length > 0 && <ul className="street-pick">{hits.map(c => <li key={c.id}><button onClick={() => { pickNba(c); setQ(''); }}>
        <PlayerAvatar playerId={c.playerId} size={40} title={c.name} /><b>{c.name}</b><small>{seasonOf(c.end)} · {c.ovr}{rec.beaten.includes(c.playerId) ? ' · beaten' : ''}</small></button></li>)}</ul>}
      {q.trim().length >= 2 && !hits.length && <p className="hint-text">No player by that name.</p>}
    </div> : <form className="one-find" onSubmit={e => { e.preventDefault(); void findUser(); }}>
      <input className="year-input" value={user} onChange={e => setUser(e.target.value)} placeholder="@username" aria-label="A GM's username" />
      <button type="submit" disabled={busy || cleanUser(user).length < 2}>{busy ? 'Finding…' : 'Find their player'}</button>
    </form>}
    {error && <p className="backup-msg err" role="alert">{error}</p>}
    {opp && <>
      {game ? <LiveScore game={game} left={<><MyAvatar size={64} /><small>{mine.name}</small></>}
        right={<>{opp.kind === 'nba' ? <PlayerAvatar playerId={opp.id} size={64} title={opp.label} /> : <PixelIcon name="user" size={48} />}<small>{opp.label}</small></>} onDone={() => setRevealed(true)} />
        : <div className="hunt-versus"><div><small>YOU</small><b className="hunt-rating">{mine.ovr}</b></div><span>vs</span><div><small>{opp.label}</small><b className="hunt-rating">{opp.b.ovr}</b></div><span className="hint-text">{opp.sub}</span></div>}
      {revealed && game && <p className="hint-text">{game.winner === 0 ? `You beat ${opp.label} ${game.score[0]}-${game.score[1]}.` : `${opp.label} wins ${game.score[1]}-${game.score[0]}.`}{vsRec ? ` You're ${vsRec.w}-${vsRec.l} against ${opp.label}.` : ''}</p>}
      {(!game || revealed) && <button className="primary" onClick={play}>{game ? 'Run it back' : `Play ${opp.label} to 11`}</button>}
    </>}
    <p className="hint-text">Raise your ratings in the Closet (Ratings tab) with the points your level earns. 1v1 games are just for fun: nothing here is ranked.</p>
  </section>;
}
