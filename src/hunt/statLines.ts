import type { PlayerStatLine } from '../simulation/boxscore';

/*
 * Player stats for the run modes (League Hunt and the 82-0 Challenge): season totals per player, and the best single
 * games. Old saves only have games, points, rebounds and assists; the rest start counting from the next game.
 */

export interface RunLine { g: number; pts: number; reb: number; ast: number; min?: number; stl?: number; blk?: number; fgm?: number; fga?: number; tpm?: number; tpa?: number }
/** The record book's categories: the best single game in each. */
export const HIGH_CATS = ['pts', 'reb', 'ast', 'stl', 'blk', 'tpm'] as const;
export type HighCat = typeof HIGH_CATS[number];
export const HIGH_LABEL: Record<HighCat, string> = { pts: 'Points', reb: 'Rebounds', ast: 'Assists', stl: 'Steals', blk: 'Blocks', tpm: 'Threes' };
export interface GameHigh { v: number; name: string; vs: string }
export type GameHighs = Partial<Record<HighCat, GameHigh>>;

const add = (a: number | undefined, b: number) => (a ?? 0) + b;

/** Adds one game's box score to the totals (players who played). */
export function addBox(lines: Record<string, RunLine>, box: Record<string, PlayerStatLine>): Record<string, RunLine> {
  const out = { ...lines };
  for (const [name, l] of Object.entries(box)) {
    if (!l.minutes) continue;
    const c = out[name] ?? { g: 0, pts: 0, reb: 0, ast: 0 };
    out[name] = {
      g: c.g + 1, pts: c.pts + l.points, reb: c.reb + l.oreb + l.dreb, ast: c.ast + l.ast,
      min: add(c.min, l.minutes), stl: add(c.stl, l.stl), blk: add(c.blk, l.blk), fgm: add(c.fgm, l.fgm), fga: add(c.fga, l.fga), tpm: add(c.tpm, l.tpm), tpa: add(c.tpa, l.tpa),
    };
  }
  return out;
}

const single = (l: PlayerStatLine, k: HighCat) => (k === 'reb' ? l.oreb + l.dreb : k === 'pts' ? l.points : l[k]);

/** Keeps the best single game in each category (the earlier one wins a tie). */
export function addHighs(highs: GameHighs, box: Record<string, PlayerStatLine>, vs: string): GameHighs {
  const out = { ...highs };
  for (const [name, l] of Object.entries(box)) {
    if (!l.minutes) continue;
    for (const k of HIGH_CATS) { const v = single(l, k); if (v > 0 && v > (out[k]?.v ?? 0)) out[k] = { v, name, vs }; }
  }
  return out;
}

/** The run's MVP: the usual points-rebounds-assists blend, a small edge for playing more. */
export const lineValue = (l: RunLine) => l.pts + l.reb * 1.2 + l.ast * 1.5 + (l.stl ?? 0) * 2 + (l.blk ?? 0) * 2;
export function runMvp(lines: Record<string, RunLine> | undefined, minGames = 1): (RunLine & { name: string }) | null {
  const list = Object.entries(lines ?? {}).filter(([, l]) => l.g >= minGames).map(([name, l]) => ({ name, ...l }));
  return list.sort((a, b) => lineValue(b) / b.g * Math.min(1, b.g / 10) - lineValue(a) / a.g * Math.min(1, a.g / 10))[0] ?? null;
}

/** Shown as whole numbers (23 PPG, 47%), like every player stat in the game. */
export const perGame = (v: number | undefined, g: number) => (g && v != null ? String(Math.round(v / g)) : '—');
export const pct = (m: number | undefined, a: number | undefined) => (a ? `${Math.round(100 * (m ?? 0) / a)}` : '—');
