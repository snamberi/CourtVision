import type { CSSProperties } from 'react';
import type { HuntCard, Rarity } from '../../hunt/cards';
import { teamColors } from '../../simulation/teamColors';

export const RARITY_LIGHT: Record<Rarity, string> = { common: '#a6b3c5', rare: '#69b8ff', epic: '#c799ff', legendary: '#ffd16b' };
export function playerFinish(team: string | null | undefined): CSSProperties {
  const colors = teamColors(team);
  return { '--player-team': colors.primary, '--player-trim': colors.secondary } as CSSProperties;
}
/** Box-score names carry the season suffix so different versions of the same star stay distinct. */
export function matchesRunName(card: Pick<HuntCard, 'name' | 'end'> | undefined, name: string): boolean {
  return !!card && (card.name === name || `${card.name} '${String(card.end).slice(2)}` === name);
}
