import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * An always-visible scrollbar drawn by the game for a scroll area. Browser scrollbars can't be relied on here:
 * macOS, phones and Firefox hide them until you scroll, and Chrome draws styled ones very thin. The thumb can be
 * dragged, and a click on the track jumps a page. The mouse wheel and touch keep scrolling the area itself.
 */
export function ScrollRail({ target }: { target: RefObject<HTMLElement | null> }) {
  const [box, setBox] = useState({ top: 0, height: 0, visible: false });
  const drag = useRef<{ startY: number; startScroll: number } | null>(null);

  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const measure = () => {
      const { scrollHeight, clientHeight, scrollTop } = el;
      const visible = scrollHeight > clientHeight + 1;
      const height = visible ? Math.max(32, (clientHeight / scrollHeight) * clientHeight) : 0;
      const top = visible ? (scrollTop / (scrollHeight - clientHeight)) * (clientHeight - height) : 0;
      setBox(b => (b.top === top && b.height === height && b.visible === visible ? b : { top, height, visible }));
    };
    const frame = requestAnimationFrame(measure);
    el.addEventListener('scroll', measure, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    // The menu's contents change size too (groups open and close).
    const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(measure) : null;
    mo?.observe(el, { childList: true, subtree: true });
    window.addEventListener('resize', measure);
    return () => { cancelAnimationFrame(frame); el.removeEventListener('scroll', measure); ro?.disconnect(); mo?.disconnect(); window.removeEventListener('resize', measure); };
  }, [target]);

  const onThumbDown = (e: React.PointerEvent) => {
    const el = target.current;
    if (!el) return;
    e.preventDefault(); e.stopPropagation();
    drag.current = { startY: e.clientY, startScroll: el.scrollTop };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onThumbMove = (e: React.PointerEvent) => {
    const el = target.current, d = drag.current;
    if (!el || !d) return;
    const ratio = (el.scrollHeight - el.clientHeight) / Math.max(1, el.clientHeight - box.height);
    el.scrollTo({ top: d.startScroll + (e.clientY - d.startY) * ratio });
  };
  const onThumbUp = () => { drag.current = null; };
  const onTrackDown = (e: React.PointerEvent) => {
    const el = target.current;
    if (!el) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    el.scrollBy({ top: y < box.top ? -el.clientHeight * 0.9 : el.clientHeight * 0.9, behavior: 'smooth' });
  };

  if (!box.visible) return null;
  return <div className="scroll-rail" aria-hidden="true" onPointerDown={onTrackDown}>
    <div className="scroll-rail-thumb" style={{ transform: `translateY(${box.top}px)`, height: box.height }}
      onPointerDown={onThumbDown} onPointerMove={onThumbMove} onPointerUp={onThumbUp} onPointerCancel={onThumbUp} />
  </div>;
}
