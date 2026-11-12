import { rest, type SupaEnv, type Fetch } from './supabase';
import { applyDeliveries, type Delivery } from '../src/relics/deliveries';
import { loadRelics } from '../src/relics/relics';
export async function addServerDeliveries(storage: Record<string, string>, userId: string, env: SupaEnv, f: Fetch): Promise<Record<string, string>> {
  let vault = loadRelics(key => storage[key] ?? null);
  for (let offset = 0; ; offset += 1000) {
    const rows = await rest(env, 'GET', `reward_receipts?user_id=eq.${userId}&select=id,coins,spins,lucky,gems,items,cosmetics,label&order=id&limit=1000&offset=${offset}`, undefined, undefined, f) as Delivery[];
    vault = applyDeliveries(vault, rows);
    if (rows.length < 1000) break;
  }
  return { ...storage, 'cv-relics': JSON.stringify(vault) };
}
