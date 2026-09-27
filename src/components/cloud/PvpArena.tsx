import { useEffect, useState } from 'react';
import type { NbaHistory } from '../../history/nbaHistoryData';
import { useAccount, supa } from '../../cloud/account';
import { findMatch, postResult, publishGhost, localGhost, type PvpMatch } from '../../cloud/pvp';
import { playPvp, validGhost, pvpEra, type Ghost } from '../../hunt/pvp';
import { cardPool } from '../../hunt/cards';
import { COACH_BY_ID } from '../../hunt/coaches';
import type { SeriesGame } from '../../hunt/run';
import { BoardTable } from './BoardTable';
import { openSignIn } from '../../cloud/signIn';
import { PixelIcon } from '../PixelIcon';
import { track } from '../../analytics/track';

function Squad({ h, g, title }: { h: NbaHistory; g: Ghost; title: string }) {
  const pool = cardPool(h);
  const coach = g.coach ? COACH_BY_ID.get(g.coach) : undefined;
  return <div className="pvp-squad"><h4>{title}</h4>
    <ol>{g.squad.map((id, i) => { const c = pool.byId.get(id); return <li key={id}><small>{['PG', 'SG', 'SF', 'PF', 'C', '6TH'][i]}</small><b>{c ? c.name : id}</b><span>{c ? `'${String(c.end).slice(2)} · ${c.ovr}` : ''}</span></li>; })}</ol>
    <small>{coach ? `Coach ${coach.name}` : 'No coach'} · {g.boosts.length} boost{g.boosts.length === 1 ? '' : 's'} · {g.items.length} item{g.items.length === 1 ? '' : 's'} · reached series {Math.min(10, g.reached + 1)}{g.reached >= 10 ? ' (won the hunt)' : ''}</small></div>;
}

/** League Hunt PvP: your finished hunt squad against other GMs' ghosts, best of seven, Elo-rated. */
export function PvpArena({ onUser }: { onUser: (u: string) => void }) {
  const acct = useAccount();
  const [h, setH] = useState<NbaHistory | null>(null);
  const [mine, setMine] = useState<{ squad: Ghost; rating: number; wins: number; losses: number } | null | undefined>(undefined);
  const [match, setMatch] = useState<PvpMatch | null>(null);
  const [series, setSeries] = useState<{ games: SeriesGame[]; won: boolean; delta: number | null } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [local] = useState(() => localGhost());
  useEffect(() => {
    let live = true;
    import('../../history/nbaHistoryData').then(m => m.loadNbaHistory()).then(d => { if (live) setH(d); }, e => { if (live) setError(String(e?.message ?? e)); });
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (acct.status !== 'signedIn' || !acct.userId) return;
    let live = true;
    supa().then(c => c.from('hunt_ghosts').select('squad, rating, wins, losses').eq('user_id', acct.userId!).maybeSingle())
      .then(({ data }) => { if (live) setMine((data as typeof mine) ?? null); }, () => { if (live) setMine(null); });
    return () => { live = false; };
  }, [acct.status, acct.userId, busy]);

  const publish = async () => {
    if (!local) return;
    setBusy('Publishing…'); setError(null);
    try { await publishGhost(local); setMine(m => ({ squad: local, rating: m?.rating ?? 1000, wins: m?.wins ?? 0, losses: m?.losses ?? 0 })); track('pvp', { action: 'publish' }); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setBusy(null);
  };
  const find = async () => {
    setBusy('Finding an opponent…'); setError(null); setSeries(null);
    try { setMatch(await findMatch()); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setBusy(null);
  };
  const play = async () => {
    if (!h || !match) return;
    setBusy('Playing the series…'); setError(null);
    await new Promise(r => setTimeout(r, 30));
    try {
      if (!validGhost(h, match.you.squad) || !validGhost(h, match.opponent.squad)) throw new Error('One of the squads could not be read. Find another match.');
      const r = playPvp(h, match.you.squad, match.opponent.squad, match.match.seed, match.match.era);
      setSeries({ ...r, delta: null });
      const out = await postResult(match.match.id, r.won, r.games);
      setSeries({ ...r, delta: out.delta });
      track('pvp', { action: 'result', won: r.won });
      setMatch(null);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setBusy(null);
  };

  if (acct.status !== 'signedIn') return <section className="locker-bay"><h2><PixelIcon name="trophy" size={18} /> League Hunt PvP</h2><p className="hint-text">Your finished League Hunt squad becomes your ghost team. Challenge other GMs' ghosts in a best-of-seven, climb the Elo ladder, and defend your rating while you are away.</p><button className="primary" onClick={openSignIn}>Sign in to play</button><h3 className="hunt-subhead">Ladder</h3><BoardTable spec={{ kind: 'pvp' }} scoreLabel="Rating" onUser={onUser} /></section>;
  const newer = local && (!mine || JSON.stringify(mine.squad.squad) !== JSON.stringify(local.squad));
  return <section className="locker-bay pvp">
    <h2><PixelIcon name="trophy" size={18} /> League Hunt PvP</h2>
    <p className="hint-text">Your last finished hunt squad is your team, with everything it built: coach, training, boosts and items. Each match is a best-of-seven under one era's rules; the result moves both ratings (Elo). Once a match is found it counts as a loss until you play it.</p>
    {!h ? <p className="hint-text" role="status">Loading the card pool…</p> : <>
      {mine === undefined ? <p className="hint-text">Loading your team…</p> : mine ? <div className="pvp-me"><div className="ranked-tier"><small>RATING</small><b>{mine.rating}</b></div><span>{mine.wins}-{mine.losses} in PvP</span></div> : <p className="empty-state">No PvP team yet. {local ? 'Publish your last hunt squad below.' : 'Finish a League Hunt (reach at least series 3): your squad becomes your PvP team.'}</p>}
      {newer && <div className="signin-strip"><span>Your last hunt squad is {mine ? 'newer than your PvP team' : 'ready'}.</span><button className="primary" disabled={!!busy} onClick={() => void publish()}>{mine ? 'Use it as your PvP team' : 'Publish it'}</button></div>}
      {mine && <div className="pvp-grid">
        <Squad h={h} g={mine.squad} title="Your team" />
        {match && <Squad h={h} g={match.opponent.squad} title={`@${match.opponent.username} · ${match.opponent.rating}`} />}
      </div>}
      {match && <p className="hint-text">Era: <b>{pvpEra(match.match.era).label}</b> · {pvpEra(match.match.era).blurb}</p>}
      <div className="contest-actions">
        {mine && !match && <button className="primary" disabled={!!busy} onClick={() => void find()}>{series ? 'Find another match' : 'Find a match'}</button>}
        {match && <button className="primary" disabled={!!busy} onClick={() => void play()}>Play the series</button>}
        {match && <button className="link-button" onClick={() => onUser(match.opponent.username)}>@{match.opponent.username}'s profile</button>}
      </div>
      {busy && <p className="hint-text" role="status">{busy}</p>}
      {error && <p className="backup-msg err" role="alert">{error}</p>}
      {series && <div className={`hunt-result ${series.won ? 'won' : 'lost'}`}><span className="pixel-eyebrow">{series.won ? 'SERIES WON' : 'SERIES LOST'}</span>
        <h2>{series.games.filter(g => g.won).length}-{series.games.filter(g => !g.won).length}{series.delta != null ? ` · ${series.delta >= 0 ? '+' : ''}${series.delta} rating` : ''}</h2>
        <ol className="pvp-games">{series.games.map((g, i) => <li key={i} className={g.won ? 'won' : ''}>G{i + 1} {g.us}-{g.them} · {g.top}</li>)}</ol></div>}
    </>}
    <h3 className="hunt-subhead">Ladder</h3>
    <BoardTable spec={{ kind: 'pvp' }} scoreLabel="Rating" onUser={onUser} empty="No PvP teams yet. Finish a hunt and be the first." />
  </section>;
}
