import { useCallback, useEffect, useState } from 'react';
import { useAccount } from '../../cloud/account';
import { loadOnlineLeague, onlineMembers, canAdvance, setReady, saveOnlineState, downloadOnlineState, onlineTrades, answerOnlineTrade, StaleError, withHumans, type OnlineLeague, type OnlineMember, type OnlineTrade } from '../../cloud/onlineLeague';
import type { League } from '../../simulation/league';
import type { GMLeagueExtras } from '../../simulation/gm';
import { executeTrade, validateTradeAssets } from '../../simulation/gm';
import type { UniverseSnapshot } from '../../storage/universeIO';
import { PixelIcon } from '../PixelIcon';

export interface OnlineSession { meta: OnlineLeague; members: OnlineMember[]; base: { played: number; phase: string; season: string } }
export const progressMark = (l: League) => ({ played: l.schedule.filter(g => g.played).length, phase: l.seasonPhase ?? 'regular_season', season: l.season ?? '' });
/** The league moved forward since it was loaded (games played, a new phase or season). */
export const advancedSince = (l: League, base: OnlineSession['base']) => { const m = progressMark(l); return m.played !== base.played || m.phase !== base.phase || m.season !== base.season; };

/**
 * The bar on top of an online league: who is ready, your Ready switch, saving your moves to the league, loading a
 * friend's newer version, and trade offers between friends.
 */
export function OnlineBar({ session, league, extras, teamId, onSession, onReload, onApply }: {
  session: OnlineSession; league: League; extras: GMLeagueExtras; teamId: string | null;
  onSession: (s: OnlineSession) => void;
  /** Replace what's on screen with the league's latest version. */
  onReload: (snap: UniverseSnapshot, s: OnlineSession) => void;
  /** Apply an accepted friend trade to the league on screen. */
  onApply: (league: League, extras: GMLeagueExtras) => void;
}) {
  const acct = useAccount();
  const me = acct.userId;
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [trades, setTrades] = useState<OnlineTrade[]>([]);
  const [newer, setNewer] = useState(false);
  const { meta, members } = session;
  const mine = members.find(m => m.userId === me);
  const adv = canAdvance(meta, members);
  const moved = advancedSince(league, session.base);
  const nameOf = (userId: string) => members.find(m => m.userId === userId)?.username ?? 'a friend';

  // Every half minute: who is ready, new trade offers, and whether a friend saved a newer version.
  const poll = useCallback(async () => {
    try {
      const [fresh, mem, tr] = await Promise.all([loadOnlineLeague(meta.id), onlineMembers(meta.id), onlineTrades(meta.id)]);
      setTrades(tr);
      setNewer(fresh.version !== meta.version);
      if (fresh.version === meta.version) onSession({ ...session, meta: fresh, members: mem });
      else onSession({ ...session, members: mem });
    } catch { /* offline for a moment */ }
  }, [meta.id, meta.version, session, onSession]);
  useEffect(() => { void poll(); const t = window.setInterval(() => void poll(), 30_000); return () => window.clearInterval(t); }, [meta.id, meta.version]); // eslint-disable-line react-hooks/exhaustive-deps

  const reload = async () => {
    setBusy(true); setMsg(null);
    try {
      const fresh = await loadOnlineLeague(meta.id), mem = await onlineMembers(meta.id);
      const snap = await downloadOnlineState(fresh);
      const s: OnlineSession = { meta: fresh, members: mem, base: progressMark(snap.league) };
      onReload({ ...snap, league: withHumans(snap.league, fresh, mem) }, s);
      setNewer(false); setMsg('Loaded the latest version.');
    } catch (e) { setMsg((e as Error).message); }
    setBusy(false);
  };
  const save = async (thenReady?: boolean) => {
    setBusy(true); setMsg(null);
    try {
      const advanced = moved;
      const version = await saveOnlineState(meta, withHumans(league, meta, members), extras, advanced);
      const fresh = await loadOnlineLeague(meta.id);
      if (thenReady && !advanced) await setReady(meta.id, true);
      const mem = await onlineMembers(meta.id);
      onSession({ meta: { ...fresh, version }, members: mem, base: progressMark(league) });
      setMsg(advanced ? 'Saved. The league moved forward, so everyone is un-readied for the next stretch.' : thenReady ? 'Saved, and you are ready.' : 'Your moves are saved to the league.');
    } catch (e) {
      if (e instanceof StaleError) setNewer(true);
      setMsg((e as Error).message);
    }
    setBusy(false);
  };
  const toggleReady = async () => {
    if (!mine) return;
    if (!mine.ready) { await save(true); return; }
    try { await setReady(meta.id, false); await poll(); } catch (e) { setMsg((e as Error).message); }
  };
  const accept = async (t: OnlineTrade) => {
    const check = validateTradeAssets(league, extras, t.proposal);
    if (!check.valid) { setMsg(`That trade no longer works: ${check.reasons.join(' ')}`); await answerOnlineTrade(t.id, 'declined').catch(() => undefined); void poll(); return; }
    const r = executeTrade(league, extras, t.proposal);
    onApply(r.league, r.extras);
    try { await answerOnlineTrade(t.id, 'accepted'); } catch { /* recorded on the next save anyway */ }
    setMsg('Trade done. Save to the league so your friend sees it.');
    void poll();
  };
  const incoming = trades.filter(t => t.toUser === me), outgoing = trades.filter(t => t.fromUser === me);
  const teamName = (id: string) => league.teams.find(t => t.teamId === id)?.name ?? id;
  const describe = (t: OnlineTrade) => `${teamName(t.proposal.teamAId)} send ${[...t.proposal.playersFromA, ...(t.proposal.picksFromA ?? []).map(() => 'a pick')].join(', ') || 'nothing'} for ${[...t.proposal.playersFromB, ...(t.proposal.picksFromB ?? []).map(() => 'a pick')].join(', ') || 'nothing'}`;

  return <section className="online-bar" aria-label="Online league">
    <div className="online-bar-head">
      <span className="pixel-eyebrow"><PixelIcon name="team" size={12} /> ONLINE · {meta.name} · CODE {meta.code}</span>
      <ul className="online-ready">{members.map(m => <li key={m.userId} className={m.ready ? 'ready' : ''} title={`${teamName(m.teamId)}${m.ready ? ' · ready' : ' · not ready'}`}>
        {m.ready ? <PixelIcon name="check" size={10} /> : <i aria-hidden="true">·</i>} @{m.username}</li>)}</ul>
    </div>
    <div className="online-bar-actions">
      {mine && <button className={mine.ready ? '' : 'primary'} disabled={busy} onClick={() => void toggleReady()}>{mine.ready ? 'Not ready' : 'Save and ready up'}</button>}
      <button disabled={busy} className={moved ? 'primary' : ''} onClick={() => void save()}>{moved ? 'Save the new games to the league' : 'Save my moves'}</button>
      <button disabled={busy} className={newer ? 'primary' : ''} onClick={() => void reload()}>{newer ? 'A friend saved: load the latest' : 'Load the latest'}</button>
      <span className="hint-text">{adv.ok ? `${adv.why} Anyone can play the next games, then save.` : adv.why}</span>
    </div>
    {incoming.length > 0 && <ul className="online-trades">{incoming.map(t => <li key={t.id}><span><b>@{nameOf(t.fromUser)}</b> offers: {describe(t)}.</span>
      <button className="primary" onClick={() => void accept(t)}>Accept</button><button onClick={() => void answerOnlineTrade(t.id, 'declined').then(poll)}>Decline</button></li>)}</ul>}
    {outgoing.length > 0 && <ul className="online-trades">{outgoing.map(t => <li key={t.id}><span>Waiting on <b>@{nameOf(t.toUser)}</b>: {describe(t)}.</span><button onClick={() => void answerOnlineTrade(t.id, 'cancelled').then(poll)}>Cancel</button></li>)}</ul>}
    {msg && <p className="hint-text" role="status">{msg}</p>}
    {teamId && !mine && <p className="hint-text">You are watching this league.</p>}
  </section>;
}
