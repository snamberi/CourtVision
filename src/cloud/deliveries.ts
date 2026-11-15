import { getAccount, supa } from './account';
import { applyDeliveries, type Delivery } from '../relics/deliveries';
import { loadRelics, RELICS_KEY, RELICS_EVENT } from '../relics/relics';
/** Throw on disk failure: SQL retains the receipt, so the next attempt can recover it. */
export function persistDeliveries(deliveries: Delivery[], userId: string): Delivery[] {
  if (getAccount().userId !== userId) throw new Error('Account changed. Sign in again to collect your rewards.');
  const current = loadRelics();
  const added = deliveries.filter(d => !Object.hasOwn(current.deliveries ?? {}, d.id));
  const next = applyDeliveries(current, deliveries);
  localStorage.setItem(RELICS_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(RELICS_EVENT));
  return added;
}
export async function claimRewardRpc(name: 'claim_gifts_v2' | 'claim_clan_rewards'): Promise<Delivery[]> {
  const userId = getAccount().userId;
  if (!userId) throw new Error('Sign in first.');
  const client = await supa();
  const { data, error } = await client.rpc(name);
  if (error) throw new Error(error.message);
  return persistDeliveries((data ?? []) as Delivery[], userId);
}
