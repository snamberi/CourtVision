import { useEffect } from 'react';
import type { Feature } from '../../tutorial/unlocks';

interface Props {
  feature: Feature;
  onShow: () => void;
  onLater: () => void;
}

/** Announces a tool that just opened in the Simple menu. Escape means "Later". */
export function UnlockNotice({ feature, onShow, onLater }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onLater(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onLater]);
  return (
    <div className="unlock-notice" role="status" aria-live="polite">
      <div className="unlock-notice-title">Unlocked: {feature.label}</div>
      <p>{feature.notice}</p>
      <div className="unlock-notice-actions">
        <button type="button" className="primary" onClick={onShow}>Show me</button>
        <button type="button" onClick={onLater}>Later</button>
      </div>
    </div>
  );
}
