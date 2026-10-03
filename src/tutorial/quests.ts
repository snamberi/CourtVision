import { localRead, type Read } from '../lib/kv';
import { LESSONS } from './lessons';

/*
 * Tutorial quests: each first-season lesson (pick a team, the coach's tour, your first game, the rotation, development,
 * a trade, the regular season, your first draft) pays XP once, the first time you finish it in any league. The XP
 * counts toward your level and the Season Pass like any other.
 */

export const QUESTS_KEY = 'cv-quests';
export const QUEST_XP: Record<string, number> = { team: 25, tour: 50, firstGame: 25, rotation: 40, development: 40, trade: 60, finishSeason: 100, draft: 80 };
export const questXp = (id: string) => QUEST_XP[id] ?? 30;

export function readQuests(read: Read = localRead): string[] {
  try { const v = JSON.parse(read(QUESTS_KEY) ?? '[]') as unknown; return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && LESSONS.some(l => l.id === x)) : []; } catch { return []; }
}
/** Marks these lessons done; returns the ones that are new (and pay XP). */
export function claimQuests(ids: string[]): string[] {
  const have = readQuests(), fresh = ids.filter(id => !have.includes(id) && LESSONS.some(l => l.id === id));
  if (fresh.length) { try { localStorage.setItem(QUESTS_KEY, JSON.stringify([...have, ...fresh])); } catch { return []; } }
  return fresh;
}
export const questsXp = (ids: string[]) => ids.reduce((n, id) => n + questXp(id), 0);
export const mergeQuests = (a: string[], b: string[]) => [...new Set([...a, ...b])];
