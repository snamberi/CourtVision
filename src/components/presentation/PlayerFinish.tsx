import { useEffect, useRef } from 'react';
import type { Rarity } from '../../hunt/cards';
import { RARITY_LIGHT } from './cardFinish';
import { burst } from '../../fx/effects';
import './presentation.css';

/** Trigger only when a real card is revealed, never while its identity/rarity is hidden. */
export function RevealSparks({ rarity, active = true }: { rarity: Rarity | 'mythic'; active?: boolean }) {
  const anchor = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => {
      const el = anchor.current;
      if (!el || el.closest('.no-rarity')) return;
      burst(el.parentElement, { colors: [rarity === 'mythic' ? '#ff64d8' : RARITY_LIGHT[rarity], '#fff1d1'], count: rarity === 'mythic' ? 72 : rarity === 'legendary' ? 56 : rarity === 'epic' ? 30 : 16, power: rarity === 'mythic' || rarity === 'legendary' ? 7 : 4 });
    }, 100);
    return () => window.clearTimeout(timer);
  }, [rarity, active]);
  return <span ref={anchor} className="reveal-sparks" aria-hidden="true" />;
}
