import { SYNC_KEYS, mergeStorage, mergeCareers, type ProgressBlob } from './merge';
import { supa, accessToken, getAccount, setAccount, refreshProfile, SIGNED_IN_EVENT } from './account';
import { listCareers, restoreCareers } from '../career/storage';
import { noteCareers } from '../profile/profile';
import type { CareerMeta } from '../career/career';
import { LEGACY_EVENT } from '../storage/gmLegacy';
import { PROFILE_EVENT, equipped } from '../profile/profile';
import { updateProfile } from './account';
import { DAILY_EVENT } from '../profile/dailyGoals';

/*
 * Cloud sync: pull the account's progress, merge it with this device's (merge.ts keeps the best of both), write the
 * result here, and push it to /api/sync, which rebuilds the public boards from it. Runs after signing in, on start,
 * when the menu opens, when the tab is hidden, and a little after progress changes. Only one sync runs at a time,
 * and nothing is pushed when nothing changed.
 */

export const PROGRESS_EVENT = 'courtvision:progress';
let running: Promise<void> | null = null;
let lastPushed = '';
let timer: ReturnType<typeof setTimeout> | null = null;

function readLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of SYNC_KEYS) { try { const v = localStorage.getItem(k); if (v != null) out[k] = v; } catch { /* storage blocked */ } }
  return out;
}

function writeLocal(storage: Record<string, string>) {
  let changed = false;
  for (const [k, v] of Object.entries(storage)) {
    try { if (localStorage.getItem(k) !== v) { localStorage.setItem(k, v); changed = true; } } catch { /* storage blocked */ }
  }
  if (changed) for (const e of [LEGACY_EVENT, PROFILE_EVENT, DAILY_EVENT, PROGRESS_EVENT]) window.dispatchEvent(new Event(e));
}

/** Retired careers travel with the account (careers still being played stay on their device with their league). */
async function localCareers(): Promise<CareerMeta[]> {
  try { return (await listCareers()).filter(c => c.status === 'retired'); } catch { return []; }
}

/**
 * The account this device's progress belongs to. On a shared computer, when someone else signs in, the progress
 * here is the previous player's: it is replaced by the new account's instead of being merged into it.
 */
const OWNER_KEY = 'cv-cloud-owner';
const readOwner = () => { try { return localStorage.getItem(OWNER_KEY); } catch { return null; } };
const writeOwner = (id: string) => { try { localStorage.setItem(OWNER_KEY, id); } catch { /* storage blocked */ } };

export function syncNow(): Promise<void> {
  if (running) return running;
  running = (async () => {
    const token = accessToken(), userId = getAccount().userId;
    if (!token || !userId) return;
    setAccount({ sync: { ...getAccount().sync, state: 'syncing' } });
    try {
      const client = await supa();
      const { data, error } = await client.from('progress').select('data').eq('user_id', userId).maybeSingle();
      if (error) throw new Error(error.message);
      const cloud = (data?.data ?? null) as ProgressBlob | null;
      const owner = readOwner(), foreign = !!owner && owner !== userId;
      const storage = mergeStorage(foreign ? {} : readLocal(), cloud?.storage ?? {});
      if (foreign) for (const k of SYNC_KEYS) if (!(k in storage)) { try { localStorage.removeItem(k); } catch { /* storage blocked */ } }
      writeLocal(storage);
      // Careers: yours, plus careers made on this device before any account claimed it.
      const mine = (await localCareers()).filter(c => c.cloudOwner === userId || (!c.cloudOwner && !foreign));
      const careers = mergeCareers(mine, (cloud?.careers ?? []) as CareerMeta[]).map(c => (c.cloudOwner === userId ? c : { ...c, cloudOwner: userId }));
      const fresh = careers.filter(c => !mine.some(m => m.id === c.id && m.updatedAt >= c.updatedAt));
      const tag = mine.filter(m => m.cloudOwner !== userId).map(m => ({ ...m, cloudOwner: userId }));
      if (fresh.length || tag.length) { await restoreCareers({ metas: [...tag.filter(t => !fresh.some(f => f.id === t.id)), ...fresh], worlds: [] }); noteCareers(await listCareers()); window.dispatchEvent(new Event(PROGRESS_EVENT)); }
      const blob: ProgressBlob = { version: 1, updatedAt: Date.now(), storage, careers };
      const body = JSON.stringify(blob);
      const fingerprint = JSON.stringify({ userId, storage, careers: careers.map(c => [c.id, c.updatedAt]) });
      if (fingerprint !== lastPushed) {
        const res = await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken() ?? token}` }, body });
        const out = await res.json().catch(() => null) as { error?: string } | null;
        // Another sync (this device or another) just landed: try again shortly with the merged result.
        if (res.status === 429) { setAccount({ sync: { ...getAccount().sync, state: 'ok' } }); syncSoon(5_000); return; }
        if (!res.ok) throw new Error(out?.error ?? `Sync failed (${res.status}).`);
        lastPushed = fingerprint;
        await refreshProfile(client);
      }
      // The title and frame shown on the boards follow what is equipped here.
      const e = equipped(), prof = getAccount().profile;
      if (prof && (prof.title !== e.title || prof.frame !== e.frame || (prof.icon ?? 'ball') !== e.icon || (prof.color ?? 'cream') !== e.color)) await updateProfile({ title: e.title, frame: e.frame, icon: e.icon, color: e.color });
      writeOwner(userId);
      setAccount({ sync: { state: 'ok', at: Date.now(), message: null } });
    } catch (e) {
      setAccount({ sync: { state: 'error', at: getAccount().sync.at, message: e instanceof Error ? e.message : String(e) } });
    }
  })().finally(() => { running = null; });
  return running;
}

/** Syncs a little after progress changes (many changes in a row make one sync). */
export function syncSoon(delayMs = 15_000): void {
  if (getAccount().status !== 'signedIn') return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; void syncNow(); }, delayMs);
}

let started = false;
/** Wires the triggers once: signing in, progress events, and the tab being hidden. */
export function startSync(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener(SIGNED_IN_EVENT, () => { lastPushed = ''; void syncNow(); });
  for (const e of [LEGACY_EVENT, DAILY_EVENT, PROFILE_EVENT, PROGRESS_EVENT]) window.addEventListener(e, () => syncSoon());
  // The title and frame you equip show on your public profile too.
  window.addEventListener(PROFILE_EVENT, () => {
    const p = getAccount().profile;
    if (getAccount().status !== 'signedIn' || !p) return;
    const e = equipped();
    if (e.title !== p.title || e.frame !== p.frame || (p.icon ?? 'ball') !== e.icon || (p.color ?? 'cream') !== e.color) void updateProfile({ title: e.title, frame: e.frame, icon: e.icon, color: e.color });
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && getAccount().status === 'signedIn') void syncNow(); });
}
