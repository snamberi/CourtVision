import { useMemo } from 'react';
import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import { collectLeagueTransactions, TRANSACTION_TYPE_LABELS } from '../simulation/transactions';
import { daysToDeadline } from '../simulation/deadlineDay';

const MOVES = new Set(['traded', 'signed', 'waived', 'trade_request']);

/** The league wire on the dashboard: this season's latest trades, signings and requests, and the deadline countdown. */
export function LeagueTicker({ league, extras }: { league: League; extras: GMLeagueExtras }) {
  const items = useMemo(() => collectLeagueTransactions(league, extras).filter(e => e.season === league.season && MOVES.has(e.type)).slice(-14).reverse(), [league, extras]);
  const days = daysToDeadline(league);
  if (!items.length && days == null) return null;
  return <section className="league-ticker" aria-label="League wire">
    <span className="league-ticker-tag">{days != null && days > 0 ? `DEADLINE IN ${days} DAY${days === 1 ? '' : 'S'}` : 'LEAGUE WIRE'}</span>
    <div className="league-ticker-track"><ul style={{ animationDuration: `${Math.max(20, items.length * 6)}s` }}>
      {(items.length ? [...items, ...items] : []).map((e, i) => <li key={i} className={`ticker-${e.type}`}><b>{TRANSACTION_TYPE_LABELS[e.type]}</b> {e.playerId}{e.teamName ? ` · ${e.teamName}` : ''}<small> {e.description}</small></li>)}
      {!items.length && <li>No moves yet this season. Front offices are quiet… for now.</li>}
    </ul></div>
  </section>;
}
