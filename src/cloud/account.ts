import { useSyncExternalStore } from 'react';
import type { SupabaseClient, Session } from '@supabase/supabase-js';
import { noteFeat } from '../profile/feats';
import { noteHonors } from '../profile/cosmetics';
import { TIERS } from './ranked';
import { IS_DESKTOP_BUILD } from '../appMode';
import { loadEntitlements, writeEntitlements } from '../billing/billing';

/*
 * Accounts (web only): sign in with Discord, Google or an email link through Supabase Auth. Signing in is optional;
 * everything works signed out, as before. The Supabase library is loaded only when it is needed (a stored session,
 * a sign-in link coming back, or the player opening sign-in), so it costs nothing for everyone else.
 *
 * The site address and public key are baked in at build time from the Vercel ↔ Supabase integration's variables.
 */

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY_ = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const cloudEnabled = !IS_DESKTOP_BUILD && !!URL_ && !!KEY_;
/** What this build was given (yes/no, plus the public project address), for the Online status check. */
export const cloudBuild = { url: URL_ || null, hasKey: !!KEY_, desktop: IS_DESKTOP_BUILD };
/** Where the session is kept (outside the "cv-" and "courtvision:" keys, so backups never carry it). */
export const AUTH_STORAGE_KEY = 'courtvision-auth';

export interface CloudProfile { id: string; username: string | null; title: string; frame: string; icon?: string; color?: string; level: number; xp: number; stats: Record<string, unknown> }
export interface AccountState {
  status: 'off' | 'idle' | 'loading' | 'signedOut' | 'signedIn';
  userId: string | null; email: string | null; provider: string | null;
  profile: CloudProfile | null;
  sync: { state: 'idle' | 'syncing' | 'ok' | 'error'; at: number | null; message: string | null };
}

let state: AccountState = { status: cloudEnabled ? 'idle' : 'off', userId: null, email: null, provider: null, profile: null, sync: { state: 'idle', at: null, message: null } };
const listeners = new Set<() => void>();
export function setAccount(patch: Partial<AccountState>) { state = { ...state, ...patch }; listeners.forEach(l => l()); }
export const getAccount = () => state;
export const useAccount = () => useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, getAccount, getAccount);

let clientPromise: Promise<SupabaseClient> | null = null;
let session: Session | null = null;
export const accessToken = () => session?.access_token ?? null;

/** The Supabase client (loads the library the first time). */
export function supa(): Promise<SupabaseClient> {
  if (!cloudEnabled) return Promise.reject(new Error('Accounts are not available here.'));
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) => {
    const client = createClient(URL_!, KEY_!, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: AUTH_STORAGE_KEY } });
    client.auth.onAuthStateChange((_event, s) => { void applySession(client, s); });
    return client;
  });
  return clientPromise;
}

async function applySession(client: SupabaseClient, s: Session | null) {
  const before = session?.user.id;
  session = s;
  // Passes belong to the account: signed out, this browser forgets them (they come back on sign-in).
  if (!s) { setAccount({ status: 'signedOut', userId: null, email: null, provider: null, profile: null }); if (before) writeEntitlements(null); return; }
  setAccount({ status: 'signedIn', userId: s.user.id, email: s.user.email ?? null, provider: (s.user.app_metadata?.provider as string | undefined) ?? null });
  if (before !== s.user.id || !state.profile) await refreshProfile(client);
  if (before !== s.user.id) window.dispatchEvent(new Event(SIGNED_IN_EVENT));
}

export const SIGNED_IN_EVENT = 'courtvision:signed-in';

export async function refreshProfile(client?: SupabaseClient): Promise<CloudProfile | null> {
  const c = client ?? await supa();
  if (!session) return null;
  // Accounts made before icons and name colours read without them (older databases may not have the columns yet).
  let { data, error } = await c.from('profiles').select('id, username, title, frame, icon, color, level, xp, stats').eq('id', session.user.id).maybeSingle();
  if (error) ({ data } = await c.from('profiles').select('id, username, title, frame, level, xp, stats').eq('id', session.user.id).maybeSingle());
  const profile = (data as CloudProfile | null) ?? null;
  // Leaderboard honors are granted by the server at sync; they unlock titles, the medal icon and the prism colour.
  noteHonors(profile?.stats?.honors);
  const best = profile?.stats?.rankedBest;
  if (typeof best === 'string') {
    try { localStorage.setItem('cv-ranked-best', best); } catch { /* storage blocked */ }
    noteFeat('rankedTier', TIERS.findIndex(t => t.id === best), 'max');
  }
  setAccount({ profile });
  await loadEntitlements(c, session.user.id).catch(() => null);
  return profile;
}

/** On start: restore a stored session, or finish a sign-in link that just came back. Loads nothing otherwise. */
export async function startAccounts(): Promise<void> {
  if (!cloudEnabled) return;
  let stored = false;
  try { stored = !!localStorage.getItem(AUTH_STORAGE_KEY); } catch { /* storage blocked */ }
  const returning = /[?&](code|error_description)=/.test(location.search);
  if (!stored && !returning) { setAccount({ status: 'signedOut' }); return; }
  setAccount({ status: 'loading' });
  const client = await supa();
  const { data } = await client.auth.getSession();
  await applySession(client, data.session);
  if (returning) history.replaceState(null, '', location.pathname + location.hash); // drop ?code=… from the address
}

export type Provider = 'discord' | 'google';
const redirectTo = () => `${location.origin}/`;

export async function signInWith(provider: Provider): Promise<void> {
  const client = await supa();
  const { error } = await client.auth.signInWithOAuth({ provider, options: { redirectTo: redirectTo() } });
  if (error) throw error;
}

export async function signInWithEmail(email: string): Promise<void> {
  const client = await supa();
  const { error } = await client.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectTo(), shouldCreateUser: true } });
  if (error) throw error;
}

/** Signs out, after one last sync so nothing done on this device is left behind. */
export async function signOut(opts: { sync?: boolean } = {}): Promise<void> {
  const client = await supa();
  if (opts.sync !== false) try { const { syncNow } = await import('./sync'); await syncNow(); } catch { /* sign out anyway */ }
  await client.auth.signOut();
}

/** Username, title, frame, icon and name colour: the only profile fields a player writes directly (the database allows no others). */
export async function updateProfile(patch: Partial<Pick<CloudProfile, 'username' | 'title' | 'frame' | 'icon' | 'color'>>): Promise<string | null> {
  const client = await supa();
  if (!session) return 'Sign in first.';
  let { error } = await client.from('profiles').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', session.user.id);
  // A database not yet updated for icons and colours (schema.sql run before them): save the rest.
  if (error && /icon|color/.test(error.message) && ('icon' in patch || 'color' in patch)) {
    const { icon: _i, color: _c, ...rest } = patch;
    ({ error } = await client.from('profiles').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', session.user.id));
  }
  if (error) return error.code === '23505' ? 'That name is taken.' : error.code === '23514' ? 'Use 3-18 letters, numbers or underscores.' : error.message;
  await refreshProfile(client);
  return null;
}

/** Deletes the account and everything stored with it (progress on this device stays). */
export async function deleteAccount(): Promise<string | null> {
  const token = accessToken();
  if (!token) return 'Sign in first.';
  const res = await fetch('/api/sync', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return ((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Could not delete the account.';
  await signOut({ sync: false }).catch(() => {});
  return null;
}
