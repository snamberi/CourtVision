import type { NbaHistory } from '../history/nbaHistoryData';
import { categories, type CategoryInfo, type CategoryGroup } from '../perfect/categories';
import { cardPool } from '../hunt/cards';
import { RNG } from '../simulation/engine/rng';

/*
 * Categorize: sixteen real players hiding four categories ("MVPs", "Duke", "No. 1 picks", "Lakers"...). Pick four you
 * think belong together; four mistakes and it's over. Every player fits exactly one of the four categories on the
 * board, so each puzzle has one answer.
 */

export type CategorizeLevel = 'easy' | 'normal' | 'hard';
export interface CategorizeGroup { id: string; name: string; blurb: string; group: CategoryGroup; players: string[] }
export interface CategorizeTile { playerId: string; name: string }
export interface CategorizePuzzle { seed: number; level: CategorizeLevel; groups: CategorizeGroup[]; tiles: CategorizeTile[] }

export const CATEGORIZE_MISTAKES = 4;
const LEVEL: Record<CategorizeLevel, { groups: CategoryGroup[]; fame: number }> = {
  easy: { groups: ['Awards', 'Titles', 'Teams', 'Eras'], fame: 78 },
  normal: { groups: ['Awards', 'Titles', 'Teams', 'Eras', 'Draft', 'College', 'Stats', 'Careers', 'Body'], fame: 70 },
  hard: { groups: ['Awards', 'Titles', 'Teams', 'Eras', 'Draft', 'College', 'Stats', 'Careers', 'Body', 'World', 'Jerseys', 'Teammates', 'Names'], fame: 60 },
};

/** Each player's best season Overall (how well known he is). */
const fameCache = new WeakMap<NbaHistory, Map<string, { ovr: number; name: string }>>();
function fame(h: NbaHistory) {
  const hit = fameCache.get(h);
  if (hit) return hit;
  const m = new Map<string, { ovr: number; name: string }>();
  for (const c of cardPool(h).cards) { const cur = m.get(c.playerId); if (!cur || c.ovr > cur.ovr) m.set(c.playerId, { ovr: c.ovr, name: c.name }); }
  fameCache.set(h, m);
  return m;
}

/** A puzzle from a seed (the daily one uses the date). Tries category sets until all four have four unique members. */
export function categorizePuzzle(h: NbaHistory, seed: number, level: CategorizeLevel = 'normal'): CategorizePuzzle {
  const rng = new RNG(seed);
  const known = fame(h), cfg = LEVEL[level];
  const usable = categories(h).filter(c => cfg.groups.includes(c.group) && !c.id.includes('+'));
  const members = (c: CategoryInfo) => new Set(c.pool.map(p => p.playerId));
  for (let attempt = 0; attempt < 200; attempt++) {
    const picked: CategoryInfo[] = [];
    const shuffled = [...usable].sort(() => rng.next() - 0.5);
    for (const c of shuffled) {
      if (picked.length === 4) break;
      if (picked.filter(p => p.group === c.group).length >= 2) continue; // variety: at most two of a kind
      picked.push(c);
    }
    if (picked.length < 4) continue;
    const sets = picked.map(members);
    const groups: CategorizeGroup[] = [];
    for (const [i, c] of picked.entries()) {
      // Only players in this category and none of the other three, famous enough for the level.
      const only = [...sets[i]].filter(id => sets.every((s, j) => j === i || !s.has(id)) && (known.get(id)?.ovr ?? 0) >= cfg.fame);
      if (only.length < 4) break;
      const chosen = [...only].sort(() => rng.next() - 0.5).slice(0, 4);
      groups.push({ id: c.id, name: c.name, blurb: c.blurb, group: c.group, players: chosen });
    }
    if (groups.length < 4) continue;
    const tiles = groups.flatMap(g => g.players.map(id => ({ playerId: id, name: known.get(id)?.name ?? id }))).sort(() => rng.next() - 0.5);
    return { seed, level, groups, tiles };
  }
  throw new Error('Could not build a Categorize puzzle');
}

const dayHash = (s: string) => { let x = 2166136261; for (const ch of s) { x ^= ch.charCodeAt(0); x = Math.imul(x, 16777619); } return x >>> 0; };
/** Everyone's puzzle for a UTC day. */
export const dailyCategorize = (h: NbaHistory, day: string) => categorizePuzzle(h, dayHash(`cv-categorize|${day}`), 'normal');

export type CategorizeResult = { kind: 'solved'; group: CategorizeGroup } | { kind: 'miss'; oneAway: boolean } | { kind: 'invalid' };
/** Checks four picked players against the groups not yet solved. */
export function checkPick(p: CategorizePuzzle, picked: string[], solved: string[]): CategorizeResult {
  if (picked.length !== 4 || new Set(picked).size !== 4) return { kind: 'invalid' };
  const open = p.groups.filter(g => !solved.includes(g.id));
  const hit = open.find(g => picked.every(id => g.players.includes(id)));
  if (hit) return { kind: 'solved', group: hit };
  return { kind: 'miss', oneAway: open.some(g => picked.filter(id => g.players.includes(id)).length === 3) };
}
