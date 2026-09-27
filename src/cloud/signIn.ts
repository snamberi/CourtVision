import { useSyncExternalStore } from 'react';
import { IS_DESKTOP_BUILD } from '../appMode';

/* Whether the sign-in dialog is open (any screen can ask for it; CloudRoot shows it). */
let open = false;
const subs = new Set<() => void>();
/** Opens sign-in (on the web; before accounts are switched on it explains that instead). */
export function openSignIn() { if (IS_DESKTOP_BUILD) return; open = true; subs.forEach(s => s()); }
export function closeSignIn() { open = false; subs.forEach(s => s()); }
export const useSignInOpen = () => useSyncExternalStore(cb => { subs.add(cb); return () => subs.delete(cb); }, () => open, () => false);
