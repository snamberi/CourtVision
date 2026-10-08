import type { NbaHistory } from '../history/nbaHistoryData';
import { RNG } from '../simulation/engine/rng';
import { categories, type CategoryInfo } from '../perfect/categories';
import { cardPool } from '../hunt/cards';

/*
 * The Daily Grid: three teams down the side, three categories across the top. Fill each square with a player who
 * played for that team and fits that category (at any point in his career: a Laker who was an MVP anywhere counts).
 * Nine guesses, each player once. A deeper cut scores more rarity points.
 */

export const GRID_SIZE = 3;
export const GRID_GUESSES = 9;
/** Every square needs at least this many right answers, so no square is a trivia trap. */
export const MIN_ANSWERS = 4;
export const FIRST_GRID_DAY = '2026-10-08';

export interface Grid { key: string; rows: CategoryInfo[]; cols: CategoryInfo[] }
/** A grid in play: who went in each square (player id, '' while empty) and the guesses used. */
export interface GridPlay { cells: string[]; used: number }

export const emptyPlay = (): GridPlay => ({ cells: Array(GRID_SIZE * GRID_SIZE).fill(''), used: 0 });
export const isGridDone = (p: GridPlay | undefined) => !!p && (p.used >= GRID_GUESSES || p.cells.every(Boolean));
export const gridNumber = (day: string) => Math.floor((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${FIRST_GRID_DAY}T00:00:00Z`)) / 86_400_000) + 1;

/** Categories that make good columns: about the player, not a team, and not trivially tied to one. */
const COL_GROUPS = new Set(['Awards', 'Titles', 'Eras', 'Draft', 'College', 'Stats', 'World', 'Careers', 'Body']);

const playersCache = new WeakMap<CategoryInfo, Set<string>>();
/** Everyone in a category, by player id (any season that fits). */
export function playersOf(c: CategoryInfo): Set<string> {
  const hit = playersCache.get(c);
  if (hit) return hit;
  const s = new Set(c.pool.map(p => p.playerId));
  playersCache.set(c, s);
  return s;
}

/** The right answers for one square. */
export function answers(row: CategoryInfo, col: CategoryInfo): string[] {
  const b = playersOf(col);
  return [...playersOf(row)].filter(id => b.has(id));
}

function hash(s: string): number { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

/** A grid from a seed: three teams, three columns from different groups, every square with enough answers. */
export function makeGrid(h: NbaHistory, seedKey: string): Grid {
  const all = categories(h);
  const teams = all.filter(c => c.group === 'Teams');
  const cols = all.filter(c => COL_GROUPS.has(c.group) && c.size >= 40);
  const rng = new RNG(hash(`cv-grid|${seedKey}`));
  const pick = <T,>(list: T[]) => list[rng.nextInt(list.length)];
  for (let attempt = 0; attempt < 400; attempt++) {
    const rows: CategoryInfo[] = [];
    while (rows.length < GRID_SIZE) { const t = pick(teams); if (!rows.includes(t)) rows.push(t); }
    const chosen: CategoryInfo[] = [];
    for (let tries = 0; chosen.length < GRID_SIZE && tries < 60; tries++) {
      const c = pick(cols);
      if (chosen.some(x => x.id === c.id || x.group === c.group)) continue;
      if (rows.every(r => answers(r, c).length >= MIN_ANSWERS)) chosen.push(c);
    }
    if (chosen.length === GRID_SIZE) return { key: seedKey, rows, cols: chosen };
  }
  // Practically unreachable: fall back to the three biggest columns.
  const rows = teams.slice(0, GRID_SIZE);
  return { key: seedKey, rows, cols: [...cols].sort((a, b) => b.size - a.size).filter((c, i, l) => l.findIndex(x => x.group === c.group) === i).slice(0, GRID_SIZE) };
}

export const dailyGrid = (h: NbaHistory, day: string) => makeGrid(h, `day|${day}`);

/** How well-known a player is: his best card and his All-Star seasons (from the cards). */
function fameMap(h: NbaHistory): Map<string, number> {
  const hit = fameCache.get(h);
  if (hit) return hit;
  const m = new Map<string, number>();
  for (const c of cardPool(h).cards) {
    const v = c.ovr + (c.rarity === 'legendary' ? 8 : c.rarity === 'epic' ? 4 : 0);
    m.set(c.playerId, Math.max(m.get(c.playerId) ?? 0, v) + 0.01);
  }
  fameCache.set(h, m);
  return m;
}
const fameCache = new WeakMap<NbaHistory, Map<string, number>>();

/** Rarity of an answer in its square, 0-100: 0 is the most obvious name, 100 the deepest cut. */
export function rarity(h: NbaHistory, row: CategoryInfo, col: CategoryInfo, playerId: string): number {
  const list = answers(row, col);
  if (list.length <= 1) return 50;
  const fame = fameMap(h);
  const sorted = [...list].sort((a, b) => (fame.get(b) ?? 0) - (fame.get(a) ?? 0) || a.localeCompare(b));
  const at = sorted.indexOf(playerId);
  return at < 0 ? 0 : Math.round((at / (sorted.length - 1)) * 100);
}

/** A guess for square `i`: right (and not used elsewhere) fills the square; either way it costs a guess. */
export function guessCell(grid: Grid, play: GridPlay, i: number, playerId: string): { play: GridPlay; right: boolean } {
  if (isGridDone(play) || play.cells[i]) return { play, right: false };
  const row = grid.rows[Math.floor(i / GRID_SIZE)], col = grid.cols[i % GRID_SIZE];
  const right = !play.cells.includes(playerId) && playersOf(row).has(playerId) && playersOf(col).has(playerId);
  return { play: { cells: right ? play.cells.map((x, j) => (j === i ? playerId : x)) : play.cells, used: play.used + 1 }, right };
}

/** The score: 100 for every filled square plus its rarity (a perfect, deep grid is near 1,800). */
export function gridScore(h: NbaHistory, grid: Grid, play: GridPlay): { filled: number; rarity: number; score: number } {
  let filled = 0, rare = 0;
  play.cells.forEach((id, i) => { if (!id) return; filled++; rare += rarity(h, grid.rows[Math.floor(i / GRID_SIZE)], grid.cols[i % GRID_SIZE], id); });
  return { filled, rarity: rare, score: filled * 100 + rare };
}

/** The spoiler-free share: a 3×3 of squares, filled ones by rarity. */
export function gridShareText(day: string | null, h: NbaHistory, grid: Grid, play: GridPlay, site: string): string {
  const s = gridScore(h, grid, play);
  const lines: string[] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    lines.push(play.cells.slice(r * GRID_SIZE, r * GRID_SIZE + GRID_SIZE).map((id, c) => {
      if (!id) return '⬛';
      const v = rarity(h, grid.rows[r], grid.cols[c], id);
      return v >= 75 ? '🟪' : v >= 40 ? '🟦' : '🟩';
    }).join(''));
  }
  return `Court Vision Grid${day ? ` #${gridNumber(day)}` : ''}: ${s.filled}/9 · ${s.score} points\n${lines.join('\n')}\n${site}/#/grid`;
}

/** Players worth suggesting: everyone with a card, best known first when names tie. */
export function gridCandidates(h: NbaHistory): { id: string; name: string; years: string }[] {
  const hit = candCache.get(h);
  if (hit) return hit;
  const fame = fameMap(h);
  const out = h.players.filter(p => fame.has(p.id)).map(p => ({ id: p.id, name: p.displayName, years: `${p.firstSeason ?? '?'}-${String(p.lastSeason ?? p.firstSeason ?? '').slice(2)}`, f: fame.get(p.id)! }))
    .sort((a, b) => b.f - a.f).map(({ id, name, years }) => ({ id, name, years }));
  candCache.set(h, out);
  return out;
}
const candCache = new WeakMap<NbaHistory, { id: string; name: string; years: string }[]>();

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export function searchCandidates(list: { id: string; name: string; years: string }[], text: string, skip: Set<string>, limit = 8) {
  const q = norm(text.trim());
  if (q.length < 2) return [];
  const out: typeof list = [];
  for (const p of list) {
    if (skip.has(p.id)) continue;
    const n = norm(p.name), at = n.indexOf(q);
    if (at === 0 || (at > 0 && n[at - 1] === ' ')) out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}
