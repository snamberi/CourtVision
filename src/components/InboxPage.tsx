import { useEffect, useState } from 'react';
import type { League } from '../simulation/league';
import { teamGamesPlayed } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import { loadInbox, markAllRead, clearInbox, type InboxMessage } from '../inbox';
import { formatSeasonYear } from '../simulation/calendar';
import '../improvements.css';

/** Inbox: what needs you right now, then every message from this league (newest first). */
export function InboxPage({ league, extras, saveId, teamId, onNavigate, onSelectPlayer }: {
  league: League; extras: GMLeagueExtras; saveId: string | null; teamId: string | null; onNavigate: (tab: string) => void; onSelectPlayer: (id: string) => void;
}) {
  const [messages, setMessages] = useState<InboxMessage[]>(() => loadInbox(saveId));
  const [filter, setFilter] = useState<'all' | 'success' | 'error' | 'info'>('all');
  useEffect(() => {
    const refresh = () => setMessages(loadInbox(saveId));
    refresh();
    window.addEventListener('courtvision:inbox', refresh);
    // Opening the inbox reads everything in it.
    const t = window.setTimeout(() => markAllRead(saveId), 1500);
    return () => { window.removeEventListener('courtvision:inbox', refresh); window.clearTimeout(t); };
  }, [saveId]);

  const team = league.teams.find(t => t.teamId === teamId);
  const played = teamId ? teamGamesPlayed(league, teamId) : 0;
  const injured = team ? team.seasons.filter(p => (league.injuries?.[p.playerId]?.gamesRemaining ?? 0) > 0) : [];
  const holdouts = Object.entries(league.holdouts ?? {}).filter(([, h]) => h.teamId === teamId && h.season === league.season && played < h.games);
  const offers = extras.pendingTradeOffers.length;
  const expiring = team ? team.seasons.filter(p => extras.contracts[p.playerId]?.yearsRemaining === 1).length : 0;
  const needs: { text: string; tab?: string; player?: string }[] = [
    ...(offers ? [{ text: `${offers} trade offer${offers === 1 ? '' : 's'} waiting for an answer`, tab: 'tradeOffers' }] : []),
    ...injured.map(p => ({ text: `${p.playerId} is injured (${league.injuries![p.playerId].gamesRemaining} games)`, player: p.playerId })),
    ...holdouts.map(([id]) => ({ text: `${id} is holding out for a new contract`, player: id })),
    ...(expiring ? [{ text: `${expiring} of your players are on expiring deals`, tab: 'extensions' }] : []),
  ];
  const shown = [...messages].reverse().filter(m => filter === 'all' || m.tone === filter);

  return (
    <div className="inbox-page">
      <div className="season-feature-header"><div><span className="pixel-eyebrow">{formatSeasonYear(league.season).toUpperCase()}</span><h2>Inbox</h2></div></div>
      <section className="reset-preview" aria-label="Needs your attention">
        <h4>Needs you</h4>
        {needs.length ? <ul>{needs.map((n, i) => <li key={i}>{n.tab ? <button className="link-button" onClick={() => onNavigate(n.tab!)}>{n.text}</button>
          : n.player ? <button className="link-button" onClick={() => onSelectPlayer(n.player!)}>{n.text}</button> : n.text}</li>)}</ul>
          : <p className="hint-text">Nothing waiting on you. Nice.</p>}
      </section>
      <div className="fa-controls">
        <div className="stats-view-toggle">{(['all', 'success', 'info', 'error'] as const).map(f => <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
          {f === 'all' ? 'All' : f === 'success' ? 'Good news' : f === 'info' ? 'Updates' : 'Problems'}</button>)}</div>
        {messages.length > 0 && <button onClick={() => { clearInbox(saveId); setMessages([]); }}>Clear inbox</button>}
      </div>
      {shown.length === 0 ? <p className="empty-state">No messages yet. Everything the game tells you while you play this league lands here.</p> : (
        <ul className="inbox-list">{shown.map(m => <li key={m.id} className={`inbox-msg ${m.tone} ${m.read ? '' : 'unread'}`}>
          <span className="inbox-when">{m.date ?? new Date(m.at).toLocaleDateString()}{m.season ? ` · ${formatSeasonYear(m.season)}` : ''}</span>
          <span>{m.text}</span>
        </li>)}</ul>)}
    </div>
  );
}
