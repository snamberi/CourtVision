import type { GameMode } from '../components/MainMenu';

/*
 * What's in progress in each mode, for the "Continue" chips on the menu's mode cards. Read straight from storage
 * (without loading the modes themselves), so the menu stays light.
 */

export type InProgress = Partial<Record<GameMode, string>>;

const json = <T>(key: string): T | null => { try { return JSON.parse(localStorage.getItem(key) ?? 'null') as T | null; } catch { return null; } };

interface HuntRunLite { version?: number; stage?: string; seriesIndex?: number; squad?: unknown[] }
interface PerfectRunLite { v?: number; stage?: string; squad?: unknown[]; games?: { won: boolean }[]; playoffs?: { games: { won: boolean }[] }[] }

export function huntProgress(r: HuntRunLite | null): string | null {
  if (!r || r.version !== 3 || !r.stage || r.stage === 'won' || r.stage === 'lost') return null;
  return r.stage === 'draft' ? 'Drafting your squad' : `Series ${(r.seriesIndex ?? 0) + 1} of 10`;
}

export function perfectProgress(r: PerfectRunLite | null): string | null {
  if (!r || r.v !== 1 || !r.stage || r.stage === 'done') return null;
  if (r.stage === 'draft' || r.stage === 'coach') return `Drafting ${r.squad?.length ?? 0}/10`;
  const w = r.games?.filter(g => g.won).length ?? 0, l = (r.games?.length ?? 0) - w;
  if (r.stage === 'season') return `${w}-${l}${l === 0 && w > 0 ? ', still perfect' : ''}`;
  const p = (r.playoffs ?? []).flatMap(s => s.games), pw = p.filter(g => g.won).length;
  return `${w}-${l} · playoffs ${pw}-${p.length - pw}`;
}

/** The modes kept in this browser's storage (careers are added by `careerProgress`, which reads their database). */
export const localProgress = (): InProgress => {
  const out: InProgress = {};
  const hunt = huntProgress(json<HuntRunLite>('cv-hunt-run'));
  if (hunt) out.legends = hunt;
  const p820 = perfectProgress(json<PerfectRunLite>('cv-perfect-run'));
  if (p820) out.perfect = p820;
  return out;
};

export function careerProgress(metas: { status: string; updatedAt: number; identity: { name: string }; years: { age: number }[] }[]): string | null {
  const active = metas.filter(m => m.status === 'active').sort((a, b) => b.updatedAt - a.updatedAt);
  if (!active.length) return null;
  const m = active[0], age = m.years.at(-1)?.age;
  return `${m.identity.name}${age ? `, age ${age}` : ''}${active.length > 1 ? ` (+${active.length - 1} more)` : ''}`;
}
