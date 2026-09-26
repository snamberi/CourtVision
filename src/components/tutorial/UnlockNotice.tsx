import type { Feature } from '../../tutorial/unlocks';

interface Props {
  feature: Feature;
  onShow: () => void;
  onLater: () => void;
}

/** Announces a tool that just opened in the Simple menu. */
export function UnlockNotice({ feature, onShow, onLater }: Props) {
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
