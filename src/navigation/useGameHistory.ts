import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const PRIVACY = '#/privacy';
export const NAVIGATION_EVENT = 'courtvision:navigation';
/** The last page shown in this tab. Restores it on reload when the address lost its hash (embeds, some hosts). */
const LAST_ROUTE_KEY = 'courtvision:lastRoute';
function readLastRoute(): string | null {
  try { return sessionStorage.getItem(LAST_ROUTE_KEY); } catch { return null; }
}
function writeLastRoute(route: string) {
  try { sessionStorage.setItem(LAST_ROUTE_KEY, route); } catch { /* storage blocked: the hash alone still works */ }
}

/** Hash routes work with static hosting and the offline edition, without server rewrites. */
export function useGameHistory(
  currentRoute: string | null,
  restore: (hash: string, isCurrent: () => boolean) => Promise<void>,
  onError: () => void,
) {
  const [restoring, setRestoring] = useState(true);
  const [showPrivacy, setShowPrivacy] = useState(location.hash.startsWith(PRIVACY));
  const callbacks = useRef({ restore, onError });
  useLayoutEffect(() => { callbacks.current = { restore, onError }; }, [restore, onError]);
  const busy = useRef(true);
  const underlyingRoute = useRef('#/menu');
  const lastSeen = useRef('');
  const underlyingWritten = useRef('');

  useEffect(() => {
    let sequence = 0;
    let alive = true;
    const sync = async (initial = false) => {
      if (initial && !location.hash) {
        const last = readLastRoute();
        if (last && last !== '#/menu') history.replaceState({ cvRoute: last }, '', last);
      }
      const hash = location.hash || '#/menu';
      if (!initial && hash === lastSeen.current) return;
      lastSeen.current = hash;
      const privacy = hash.startsWith(PRIVACY);
      setShowPrivacy(privacy);
      window.dispatchEvent(new Event(NAVIGATION_EVENT));
      if (privacy && !initial) {
        history.replaceState({ ...history.state, cvRoute: underlyingRoute.current, fromGame: true }, '', location.href);
        return;
      }
      const target = privacy ? history.state?.cvRoute ?? '#/menu' : hash;
      underlyingRoute.current = target;
      const request = ++sequence;
      busy.current = true;
      setRestoring(true);
      try {
        await callbacks.current.restore(target, () => alive && request === sequence);
      } catch {
        if (alive && request === sequence) callbacks.current.onError();
      } finally {
        if (alive && request === sequence) {
          busy.current = false;
          setRestoring(false);
        }
      }
    };
    const onNavigation = () => { void sync(); };
    window.addEventListener('popstate', onNavigation);
    window.addEventListener('hashchange', onNavigation);
    void sync(true);
    return () => {
      alive = false;
      window.removeEventListener('popstate', onNavigation);
      window.removeEventListener('hashchange', onNavigation);
    };
  }, []);

  useEffect(() => {
    if (restoring || busy.current || !currentRoute) return;
    underlyingRoute.current = currentRoute;
    if (location.hash.startsWith(PRIVACY)) {
      history.replaceState({ ...history.state, cvRoute: currentRoute }, '', location.href);
      return;
    }
    // A restored/invalid route is canonicalized in place; only user navigation adds history.
    const hash = location.hash;
    writeLastRoute(currentRoute);
    if (hash !== currentRoute) {
      // Team selection is a one-time step: once the league opens, Back should not land on a stale picker (which falls to the menu).
      const leavingPicker = hash === '#/choose-team' && currentRoute.startsWith('#/league/');
      const replace = !hash || leavingPicker || lastSeen.current !== underlyingWritten.current;
      history[replace ? 'replaceState' : 'pushState']({ cvRoute: currentRoute }, '', currentRoute);
    }
    underlyingWritten.current = currentRoute;
    lastSeen.current = currentRoute;
    window.dispatchEvent(new Event(NAVIGATION_EVENT));
  }, [currentRoute, restoring, showPrivacy]);

  const closePrivacy = () => {
    if (history.state?.fromGame) history.back();
    else {
      history.replaceState({ cvRoute: underlyingRoute.current }, '', underlyingRoute.current);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };
  return { restoring, showPrivacy, closePrivacy };
}
