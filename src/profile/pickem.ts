import { localRead, type Read } from '../lib/kv';
import type { PlayoffBracket, PlayoffSeries } from '../simulation/playoffs';

/* Pick'em: call each playoff series in your league before it starts. A right call pays XP once (no coins, nothing to
 * buy). Picks live in the league; the XP ledger lives on this device like the other XP sources. */

export const PICKEM_KEY = 'cv-pickem';
export const PICKEM_XP = 20;

export interface Pickem { season: string; picks: Record<string, string> }

/** Series you can still call: both teams known and no game played. */
export const openSeries = (bracket: PlayoffBracket | null | undefined): PlayoffSeries[] =>
  (bracket?.rounds.flat() ?? []).filter(s => s.teamAId && s.teamBId && !s.winnerTeamId && s.teamAWins + s.teamBWins === 0);

export function scorePicks(bracket: PlayoffBracket | null | undefined, pickem: Pickem | undefined): { right: string[]; wrong: string[]; pending: string[] } {
  const out = { right: [] as string[], wrong: [] as string[], pending: [] as string[] };
  if (!bracket || !pickem) return out;
  for (const s of bracket.rounds.flat()) {
    const pick = pickem.picks[s.id];
    if (!pick) continue;
    if (!s.winnerTeamId) out.pending.push(s.id);
    else (s.winnerTeamId === pick ? out.right : out.wrong).push(s.id);
  }
  return out;
}

export function readPickemWins(read: Read = localRead): string[] {
  try { const v = JSON.parse(read(PICKEM_KEY) ?? '[]') as unknown; return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []; } catch { return []; }
}
/** Credits right calls once each (ids are save + season + series); returns the new ones. */
export function claimPickemWins(ids: string[]): string[] {
  const have = new Set(readPickemWins()), fresh = ids.filter(id => !have.has(id));
  if (fresh.length) { try { localStorage.setItem(PICKEM_KEY, JSON.stringify([...have, ...fresh].slice(-2000))); } catch { return []; } }
  return fresh;
}
export const pickemXp = (read: Read = localRead) => readPickemWins(read).length * PICKEM_XP;
