import { useEffect, useRef } from 'react';
import { IS_DESKTOP_BUILD } from '../appMode';

const SRC = 'https://gc.zgo.at/count.js';
const READY = 'courtvision:goatcounter-ready';
type Counter = { count?: (data: { path: string; title: string; referrer: string }) => void };
const blocked = () => IS_DESKTOP_BUILD || navigator.doNotTrack === '1' || !!(navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl;

/** Send sanitized route categories, never raw hashes, query strings or player names. */
export function useGoatCounter(path: string) {
  const last = useRef('');
  useEffect(() => {
    if (blocked() || document.querySelector(`script[src="${SRC}"]`)) return;
    const script = document.createElement('script');
    script.async = true; script.src = SRC;
    script.dataset.goatcounter = 'https://ninefoldvision.goatcounter.com/count';
    script.dataset.goatcounterSettings = JSON.stringify({ no_onload: true, no_events: true });
    script.addEventListener('load', () => window.dispatchEvent(new Event(READY)));
    document.head.appendChild(script);
  }, []);
  useEffect(() => {
    const send = () => {
      if (blocked() || last.current === path) return;
      const counter = (window as Window & { goatcounter?: Counter }).goatcounter;
      if (!counter?.count) return;
      counter.count({ path, title: 'CourtVision', referrer: '' });
      last.current = path;
    };
    send();
    window.addEventListener(READY, send);
    return () => window.removeEventListener(READY, send);
  }, [path]);
}
