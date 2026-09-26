import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const PRIVACY = '#/privacy';
export const NAVIGATION_EVENT = 'courtvision:navigation';

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
    if (hash !== currentRoute) {
      const replace = !hash || lastSeen.current !== underlyingWritten.current;
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
