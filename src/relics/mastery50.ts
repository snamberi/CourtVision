import type { Relic, RelicState } from './relics';
export interface RelicFeat50 { runs: string[]; rareDraws: number }
export const masteryNeed50 = (rarity: Relic['rarity']) => ({ common: 3, rare: 4, epic: 5, legendary: 6, mythic: 8 })[rarity];
export const masteryTitle50 = (name: string) => `${name} Master`;
export function mastered50(s: RelicState, relic: Relic): boolean {
  const p = s.feats50?.[relic.id];
  return !!p && (p.runs?.length ?? 0) >= masteryNeed50(relic.rarity) && new Set(p.runs.map(k => k.split(':')[0])).size >= 2 && p.rareDraws >= 1;
}
/** Runs are keyed by the actual reward receipt; merging or replaying a receipt cannot add progress twice. */
export function noteRelicFeat50(s: RelicState, relics: Relic[], equipped: string[], event: { run: string } | { rareDraw: true }): RelicState {
  const feats50 = { ...s.feats50 }, cosmetics = new Set(s.cosmetics ?? []);
  for (const id of equipped) {
    const r = relics.find(r => r.id === id); if (!r || !s.owned[id]) continue;
    const old = feats50[id] ?? { runs: [], rareDraws: 0 };
    // Keep enough receipts from each mode for the goal, without unbounded per-relic history.
    const runs = [...new Set([...old.runs, ...('run' in event && event.run ? [event.run] : [])])];
    const perMode = new Map<string, number>();
    feats50[id] = { runs: runs.filter(k => { const mode=k.split(':')[0], n=perMode.get(mode) ?? 0; perMode.set(mode,n+1); return n<8; }), rareDraws: Math.min(1, old.rareDraws + Number('rareDraw' in event)) };
    if (mastered50({ ...s, feats50 }, r)) cosmetics.add(`mastery-title:${masteryTitle50(r.name)}`);
  }
  return { ...s, feats50, cosmetics: [...cosmetics] };
}
export function mergeFeats50(a: RelicState['feats50'], b: RelicState['feats50']): NonNullable<RelicState['feats50']> {
  return Object.fromEntries([...new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])].map(id => [id, { runs: [...new Set([...(a?.[id]?.runs ?? []), ...(b?.[id]?.runs ?? [])])], rareDraws: Math.max(a?.[id]?.rareDraws ?? 0, b?.[id]?.rareDraws ?? 0) }]));
}
