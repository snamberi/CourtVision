import { useEffect, useState } from 'react';

/**
 * The optional pick clock: while `active`, counts down from `seconds` once a second and calls `onExpire` at zero.
 * It starts over whenever `resetKey` changes (a new pick on the board) or it is switched on again.
 */
export function usePickClock(active: boolean, seconds: number, onExpire: () => void, resetKey: number): number {
  const key = `${resetKey}:${active}`;
  const [clock, setClock] = useState({ key, left: seconds });
  // A new pick or a toggle starts the clock over (adjusted during render, not in an effect).
  if (clock.key !== key) setClock({ key, left: seconds });
  const left = clock.key === key ? clock.left : seconds;
  useEffect(() => {
    if (!active) return;
    if (left <= 0) { onExpire(); return; }
    const t = setTimeout(() => setClock(c => (c.key === key ? { key, left: c.left - 1 } : c)), 1000);
    return () => clearTimeout(t);
  }, [active, left, key]); // eslint-disable-line react-hooks/exhaustive-deps
  return left;
}
