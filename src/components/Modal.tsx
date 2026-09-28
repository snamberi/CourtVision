import { useEffect, useRef, type ReactNode } from 'react';

/** A simple dialog: focuses its first control, closes on Escape or a click outside, and hands focus back on close. */
export function Modal({ label, onClose, children, className = '' }: { label: string; onClose?: () => void; children: ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>('input, button')?.focus();
    return () => before?.focus?.();
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return <div className={`share-modal cloud-modal ${className}`} role="dialog" aria-modal="true" aria-label={label} onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}>
    <div className="share-box" ref={box}>{children}</div>
  </div>;
}
