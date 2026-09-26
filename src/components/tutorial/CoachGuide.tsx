import { useEffect, useRef, useState } from 'react';
import type { GuideStep } from '../../tutorial/guide';

interface Props {
  step: GuideStep;
  /** Position in a multi-step tour, shown as "2 / 8". */
  index?: number;
  total?: number;
  onBack?: () => void;
  onNext: () => void;
  nextLabel: string;
  onSkip?: () => void;
  skipLabel?: string;
}

interface Box { top: number; left: number; width: number; height: number }

const PAD = 6;

function visibleTarget(selectors: string[]): Element | null {
  for (const selector of selectors) {
    for (const el of Array.from(document.querySelectorAll(selector))) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return el;
    }
  }
  return null;
}

function boxOf(el: Element): Box {
  const r = el.getBoundingClientRect();
  // A target taller than the screen (a long table) is framed where it is visible.
  const top = Math.max(r.top, 0);
  const bottom = Math.min(r.bottom, window.innerHeight);
  return { top: top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: Math.max(0, bottom - top) + PAD * 2 };
}

const sameBox = (a: Box | null, b: Box) => !!a && Math.abs(a.top - b.top) < 1 && Math.abs(a.left - b.left) < 1 && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1;

/** The assistant coach in pixels (16×20 grid). */
function CoachSprite() {
  return (
    <svg className="coach-sprite" width="96" height="120" viewBox="0 0 16 20" shapeRendering="crispEdges" aria-hidden="true">
      <rect x="4" y="0" width="8" height="3" fill="var(--amber)" />
      <rect x="3" y="3" width="11" height="1" fill="#c8651e" />
      <rect x="5" y="4" width="6" height="5" fill="#d9a273" />
      <rect x="6" y="6" width="1" height="1" fill="#0b1220" />
      <rect x="9" y="6" width="1" height="1" fill="#0b1220" />
      <rect x="7" y="8" width="2" height="1" fill="#8a4b2a" />
      <rect x="3" y="9" width="10" height="7" fill="#1d3a63" />
      <rect x="7" y="9" width="2" height="3" fill="#f8efd9" />
      <rect x="7" y="12" width="2" height="1" fill="#c9ccd1" />
      <rect x="11" y="11" width="4" height="5" fill="#7a4e2d" />
      <rect x="12" y="12" width="2" height="3" fill="#f8efd9" />
      <rect x="5" y="16" width="2" height="3" fill="#405b79" />
      <rect x="9" y="16" width="2" height="3" fill="#405b79" />
      <rect x="4" y="19" width="3" height="1" fill="#050a12" />
      <rect x="9" y="19" width="3" height="1" fill="#050a12" />
    </svg>
  );
}

/**
 * The assistant coach's speech card, with a spotlight on the part of the screen it is talking about.
 * Mount with `key={step.id}` so each step finds its own target. The page stays usable underneath.
 */
export function CoachGuide({ step, index, total, onBack, onNext, nextLabel, onSkip, skipLabel = 'Skip tutorial' }: Props) {
  const [box, setBox] = useState<Box | null>(null);
  const [cardHeight, setCardHeight] = useState(230);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  const targetKey = step.targets.join('\n');
  useEffect(() => {
    const selectors = targetKey.split('\n').filter(Boolean);
    if (selectors.length === 0) return;
    let target: Element | null = null;
    let tries = 0;
    let frame = 0;
    let timer = 0;
    const measure = () => {
      frame = 0;
      if (!target || !target.isConnected) { target = visibleTarget(selectors); if (!target) return; }
      const next = boxOf(target);
      setBox((prev) => (sameBox(prev, next) ? prev : next));
      const h = cardRef.current?.offsetHeight;
      if (h) setCardHeight((prev) => (Math.abs(prev - h) < 1 ? prev : h));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    // Pages load on demand, so the target can appear a moment after the step does.
    const locate = () => {
      target = visibleTarget(selectors);
      if (target) {
        target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        schedule();
      } else if (tries++ < 20) {
        timer = window.setTimeout(locate, 150);
      }
    };
    timer = window.setTimeout(locate, 0);
    const poll = window.setInterval(schedule, 400); // layout shifts (images, lazy panels) move the target
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(poll);
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
    };
  }, [targetKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') (onSkip ?? onNext)(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onSkip, onNext]);

  // The card sits next to the spotlight without covering it: just below it when there is room, otherwise just above,
  // otherwise on whichever side has more space.
  let cardTop: number | null = null;
  if (box) {
    const gap = 14;
    const viewH = window.innerHeight;
    const below = box.top + box.height + gap;
    const above = box.top - gap - cardHeight;
    if (below + cardHeight <= viewH - 12) cardTop = below;
    else if (above >= 12) cardTop = above;
    else cardTop = viewH - (box.top + box.height) > box.top ? viewH - cardHeight - 12 : 12;
  }
  const counter = index != null && total != null ? `${index + 1} / ${total}` : null;

  return (
    <div className="coach-guide-layer">
      {box
        ? <div className="coach-spotlight" style={{ top: box.top, left: box.left, width: box.width, height: box.height }} aria-hidden="true" />
        : <div className="coach-dim" aria-hidden="true" />}
      <div ref={cardRef} className={`coach-guide ${cardTop == null ? 'at-bottom' : 'beside-target'}`} style={cardTop == null ? undefined : { top: cardTop }} role="dialog" aria-modal="false" aria-labelledby="coach-guide-title" aria-describedby="coach-guide-body">
        <CoachSprite />
        <div className="guide-card">
          <div className="guide-card-head">
            <h2 id="coach-guide-title" ref={titleRef} tabIndex={-1}>{step.title}</h2>
            {counter && <span className="guide-card-count" aria-label={`Step ${counter.replace(' / ', ' of ')}`}>{counter}</span>}
          </div>
          <p id="coach-guide-body">{step.body}</p>
          <div className="guide-card-actions">
            {onBack && <button type="button" onClick={onBack} disabled={index === 0}>Back</button>}
            <button type="button" className="coach-next" onClick={onNext}>{nextLabel}</button>
            <span className="guide-card-spacer" />
            {onSkip && <button type="button" className="coach-skip" onClick={onSkip}>{skipLabel}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
