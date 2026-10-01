/*
 * Game-owner access: an account whose `profiles.role` is 'owner' (set only from the Supabase SQL editor; players cannot
 * write that column) has every cosmetic open. The account tells this browser at sign-in; signing out forgets it.
 * Kept outside the "cv-" keys, so backups never carry it to another browser.
 */

export const OWNER_ACCESS_KEY = 'courtvision-owner';
export const OWNER_TITLE = 'Game Owner';
export const SOVEREIGN_TITLE = 'The Sovereign';

export function hasOwnerAccess(read: (key: string) => string | null = k => localStorage.getItem(k)): boolean {
  try { return read(OWNER_ACCESS_KEY) === '1'; } catch { return false; }
}

export function noteOwnerAccess(on: boolean): void {
  try {
    if (on === hasOwnerAccess()) return;
    if (on) localStorage.setItem(OWNER_ACCESS_KEY, '1'); else localStorage.removeItem(OWNER_ACCESS_KEY);
    window.dispatchEvent(new Event('courtvision:profile'));
  } catch { /* storage blocked */ }
}
