import type { League } from './league';
import type { GMLeagueExtras } from './gm';
import type { PlayerHistoryEvent, PlayerHistoryEventType } from './types';

export interface TransactionEntry extends PlayerHistoryEvent {
  playerId: string;
  teamName: string | null;
}

/** Collects every player's history log, league-wide, into one flat feed. Ordering is best-effort: newest
 * season first, and within a season, roughly in the order events were appended (there's no global
 * timestamp, only the season label each event was logged under). */
export function collectLeagueTransactions(league: League, extras: GMLeagueExtras): TransactionEntry[] {
  const teamNameById = new Map(league.teams.map((t) => [t.teamId, t.name]));
  const entries: TransactionEntry[] = [];

  const pushAll = (playerId: string, history: PlayerHistoryEvent[] | undefined) => {
    for (const e of history ?? []) {
      entries.push({ ...e, playerId, teamName: e.teamId ? teamNameById.get(e.teamId) ?? e.teamId : null });
    }
  };

  for (const t of league.teams) for (const s of t.seasons) pushAll(s.playerId, s.history);
  for (const s of extras.freeAgents) pushAll(s.playerId, s.history);

  // Newest season first; season strings sort correctly as plain strings ("2027-28" > "2026-27").
  return entries.sort((a, b) => b.season.localeCompare(a.season));
}

export const TRANSACTION_TYPE_LABELS: Record<PlayerHistoryEventType, string> = {
  drafted: 'Drafted',
  signed: 'Signed',
  traded: 'Traded',
  waived: 'Waived',
  resigned: 'Contract',
  injury: 'Injury',
  created: 'Created',
  renamed: 'Renamed',
  moved: 'Moved',
  trade_request: 'Trade request',
};
