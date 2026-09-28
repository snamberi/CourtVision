import { useEffect, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { IS_DESKTOP_BUILD } from '../appMode';
import { analyticsPath } from '../navigation/routes';
import { NAVIGATION_EVENT } from '../navigation/useGameHistory';

const UMAMI_SRC = 'https://cloud.umami.is/script.js';
const UMAMI_WEBSITE_ID = '3077e6d4-48ee-41b3-99d5-5e415f1b1929';
type Umami = { track: (payload?: (props: Record<string, unknown>) => Record<string, unknown>) => void };

/**
 * Umami (cookie-free) on the web build only. Auto-tracking is off: every page view is sent by hand with the
 * sanitized page category (Vercel's analytics gets the same on Vercel) (e.g. /game/standings), never save IDs, players or games.
 */
function useUmami(path: string) {
  useEffect(() => {
    if (IS_DESKTOP_BUILD || document.querySelector(`script[src="${UMAMI_SRC}"]`)) return;
    const s = document.createElement('script');
    s.defer = true; s.src = UMAMI_SRC;
    s.dataset.websiteId = UMAMI_WEBSITE_ID;
    s.dataset.autoTrack = 'false';
    s.dataset.excludeSearch = 'true';
    s.dataset.excludeHash = 'true';
    s.addEventListener('load', () => window.dispatchEvent(new Event('courtvision:umami-ready')));
    document.head.appendChild(s);
  }, []);
  useEffect(() => {
    if (IS_DESKTOP_BUILD) return;
    const send = () => {
      const umami = (window as unknown as { umami?: Umami }).umami;
      umami?.track(props => ({ ...props, url: path, title: 'CourtVision' }));
    };
    send();
    window.addEventListener('courtvision:umami-ready', send);
    return () => window.removeEventListener('courtvision:umami-ready', send);
  }, [path]);
}

export function WebAnalytics() {
  const [path, setPath] = useState(() => analyticsPath(location.hash));
  useEffect(() => {
    const sync = () => setPath(analyticsPath(location.hash));
    window.addEventListener(NAVIGATION_EVENT, sync);
    window.addEventListener('hashchange', sync);
    return () => {
      window.removeEventListener(NAVIGATION_EVENT, sync);
      window.removeEventListener('hashchange', sync);
    };
  }, []);
  useUmami(path);
  // Vercel Web Analytics exists only on Vercel (its script is served by Vercel itself). Elsewhere, such as Cloudflare
  // Pages, the host's own analytics are switched on in its dashboard instead.
  if (IS_DESKTOP_BUILD || import.meta.env.VITE_HOST_PLATFORM !== 'vercel') return null;
  return <Analytics route={path} path={path} debug={false} beforeSend={(event) => ({
    ...event, url: new URL(path, location.origin).href,
  })} />;
}
