import { useEffect } from 'react';
import { getAccount, useAccount } from '../cloud/account';
import { tickEventPlaytime } from './eventPlaytime';
/** Only the visible focused tab earns time; Web Locks serialize ticks across tabs. No offline catch-up. */
export function useEventPlaytime(playing: boolean, boosted: boolean) {
  const account = useAccount();
  useEffect(() => {
    let last = Date.now();
    const timer = setInterval(() => {
      const now = Date.now(), elapsed = Math.min(15000, Math.max(0, now - last)); last = now;
      if (!playing || document.visibilityState !== 'visible' || !document.hasFocus()) return;
      const owner = getAccount().userId ?? 'guest';
      const award = () => {
        if ((getAccount().userId ?? 'guest') !== owner) return;
        const key = `cv-event-tick:${owner}`;
        try { const previous = Number(localStorage.getItem(key) ?? 0); if (now - previous < 12000) return; localStorage.setItem(key, String(now)); } catch { return; }
        tickEventPlaytime(elapsed, boosted, new Date(now));
      };
      if (navigator.locks) void navigator.locks.request('cv-event-playtime', award); else award();
    }, 15000);
    return () => clearInterval(timer);
  }, [playing, boosted, account.userId]);
}
