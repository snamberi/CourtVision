import { RELIC_BY_ID, slotCount, totalLuck, type RelicState } from '../relics/relics';
export const LOADOUT_KEY = 'cv-relic-loadouts';
export const LOADOUT_MODES = ['General', 'League Hunt', '82-0 Challenge', 'Career Mode', 'Survival', 'Franchise', 'Story Mode', 'Daily Grid', 'Categorize', 'Guess the Team'] as const;
export interface RelicLoadout { name: string; mode: string; equipped: string[] }
export function readLoadouts(): RelicLoadout[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(LOADOUT_KEY) ?? '[]');
    if (!Array.isArray(data)) return [];
    return data.filter((x): x is RelicLoadout => !!x && typeof x.name === 'string' && typeof x.mode === 'string' && Array.isArray(x.equipped) && x.equipped.every((id: unknown) => typeof id === 'string')).slice(0, 30);
  } catch { return []; }
}
export function loadoutState(state: RelicState, ids: string[]): RelicState {
  return { ...state, equipped: [...new Set(ids)].filter(id => RELIC_BY_ID.has(id) && (state.owned[id] ?? 0) > 0).slice(0, slotCount(state)) };
}
export function compareLuck(state: RelicState, ids: string[]) {
  return { current: totalLuck(state), proposed: totalLuck(loadoutState(state, ids)) };
}
