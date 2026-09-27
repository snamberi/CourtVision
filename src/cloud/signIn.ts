import { useSyncExternalStore } from 'react';
import { cloudEnabled } from './account';

/* Whether the sign-in dialog is open (any screen can ask for it; CloudRoot shows it). */
let open = false;
const subs = new Set<() => void>();
export function openSignIn() { if (!cloudEnabled) return; open = true; subs.forEach(s => s()); }
export function closeSignIn() { open = false; subs.forEach(s => s()); }
export const useSignInOpen = () => useSyncExternalStore(cb => { subs.add(cb); return () => subs.delete(cb); }, () => open, () => false);
