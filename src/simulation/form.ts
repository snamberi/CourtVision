import type { ScheduledGame } from './league';

/*
 * Heat check: a player's points in his team's last few games against his season average. Hot when he is scoring well
 * above it, cold when well below; the last five games also make the little sparkline in the roster table.
 */

export const FORM_GAMES = 5;
export type Heat = 'hot' | 'cold' | null;
export interface Form { pts: (number | null)[]; recent: number; heat: Heat }

/** A heat label from recent and season scoring (needs a real sample: 3+ recent games, 8+ PPG to go cold). */
export function heatOf(recent: number, season: number, played: number): Heat {
  if (played < 3) return null;
  if (recent >= Math.max(10, season * 1.3)) return 'hot';
  if (season >= 8 && recent <= season * 0.65) return 'cold';
  return null;
}

/** Each player's points in the team's last `n` played games (null when he did not play), oldest first. */
export function recentForm(schedule: ScheduledGame[], teamId: string, seasonPpg: (playerId: string) => number, n = FORM_GAMES): Map<string, Form> {
  const games = schedule.filter(g => g.played && g.result && (g.homeTeamId === teamId || g.awayTeamId === teamId)).slice(-n);
  const lines = games.map(g => (g.homeTeamId === teamId ? g.result!.homeBox : g.result!.awayBox).players);
  const ids = new Set(lines.flatMap(l => Object.keys(l)));
  const out = new Map<string, Form>();
  for (const id of ids) {
    const pts = lines.map(l => (l[id] && l[id].minutes > 0 ? l[id].points : null));
    const played = pts.filter((p): p is number => p != null);
    const recent = played.length ? played.reduce((a, b) => a + b, 0) / played.length : 0;
    out.set(id, { pts, recent, heat: heatOf(recent, seasonPpg(id), played.length) });
  }
  return out;
}
