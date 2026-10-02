import { useEffect, useRef } from 'react';
import { addPlayTime, type PlayArea } from './playTime';
import { noteWeekTime } from './weekLog';

const TICK = 15;
const IDLE_MS = 5 * 60 * 1000;
export const PLAY_TIME_EVENT = 'courtvision:playtime';

/** Counts time in the current area while the tab is visible and someone has touched it in the last five minutes. */
export function usePlayClock(area: PlayArea): void {
  const areaRef = useRef(area);
  useEffect(() => { areaRef.current = area; }, [area]);
  useEffect(() => {
    let last = Date.now();
    const touch = () => { last = Date.now(); };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    for (const e of events) window.addEventListener(e, touch, { passive: true });
    const t = window.setInterval(() => {
      if (document.visibilityState !== 'visible' || Date.now() - last > IDLE_MS) return;
      addPlayTime(areaRef.current, TICK);
      noteWeekTime(TICK);
      window.dispatchEvent(new Event(PLAY_TIME_EVENT));
    }, TICK * 1000);
    return () => { window.clearInterval(t); for (const e of events) window.removeEventListener(e, touch); };
  }, []);
}
