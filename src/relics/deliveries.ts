import { changeGems, type RelicState } from './relics';
export interface Delivery { id: string; coins: number; spins: number; lucky: number; gems: number; items: string[]; cosmetics: string[]; label: string }
export function cleanDeliveries(value: unknown): Record<string, Delivery> {
  const out: Record<string, Delivery> = {};
  if (!value || typeof value !== 'object') return out;
  for (const [id, raw] of Object.entries(value)) {
    if (!/^[a-zA-Z0-9:_-]{1,160}$/.test(id) || !raw || typeof raw !== 'object') continue;
    const r = raw as Partial<Delivery>;
    const n = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= 10_000_000 ? v : 0;
    const list = (v: unknown) => Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 20) : [];
    out[id] = { id, coins: n(r.coins), spins: n(r.spins), lucky: n(r.lucky), gems: n(r.gems), items: list(r.items), cosmetics: list(r.cosmetics), label: typeof r.label === 'string' ? r.label.slice(0, 300) : 'Reward' };
  }
  return out;
}
/** The receipt and all its rewards are saved in the same vault write. Retrying cannot pay twice. */
export function applyDeliveries(state: RelicState, deliveries: Delivery[]): RelicState {
  let next = state;
  for (const d of Object.values(cleanDeliveries(Object.fromEntries(deliveries.map(d => [d.id, d]))))) {
    if (Object.hasOwn(next.deliveries ?? {}, d.id)) continue;
    const owned = { ...next.owned };
    for (const id of d.items) owned[id] = (owned[id] ?? 0) + 1;
    next = { ...changeGems(next, d.gems, `delivery:${d.id}`), coins: next.coins + d.coins, spins: next.spins + d.spins,
      luckySpins: (next.luckySpins ?? 0) + d.lucky, owned, cosmetics: [...new Set([...(next.cosmetics ?? []), ...d.cosmetics])],
      deliveries: { ...next.deliveries, [d.id]: d } };
  }
  return next;
}
