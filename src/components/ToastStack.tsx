import { useCallback, useEffect, useRef, useState } from 'react';

export interface ToastData {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'error';
}

/**
 * How long a toast stays up: a base beat plus time proportional to its length (roughly a comfortable
 * reading pace), clamped so a one-word toast still lingers long enough to notice and a very long
 * summary doesn't stick around forever. Errors get a little extra since they usually need a response.
 */
export function toastDurationMs(message: string, tone: ToastData['tone'] = 'info'): number {
  const base = 2500 + message.length * 65;
  const withTone = tone === 'error' ? base + 2000 : base;
  return Math.max(5000, Math.min(20000, withTone));
}

function ToastItem({ toast, onDismiss }: { toast: ToastData; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  const remainingRef = useRef(toastDurationMs(toast.message, toast.tone));
  const startedAtRef = useRef(0);

  useEffect(() => {
    if (paused) return;
    startedAtRef.current = Date.now();
    const timer = setTimeout(() => onDismiss(toast.id), remainingRef.current);
    return () => {
      clearTimeout(timer);
      // Bank whatever time was left so hovering away and back resumes rather than restarting the clock.
      remainingRef.current = Math.max(1500, remainingRef.current - (Date.now() - startedAtRef.current));
    };
  }, [paused, toast.id, onDismiss]);

  return (
    <div
      className={`toast-item toast-${toast.tone}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      // A tap on the toast itself closes it too (easier than the small × on a phone).
      onClick={() => onDismiss(toast.id)}
    >
      <span>{toast.message}</span>
      <button onClick={e => { e.stopPropagation(); onDismiss(toast.id); }} aria-label="Dismiss notification">×</button>
    </div>
  );
}

/** Bottom-right stack of notifications. Each one's lifetime scales with its message length, and hovering (or focusing) a toast pauses its countdown so you can finish reading it. */
export function ToastStack({ toasts, onDismiss }: { toasts: ToastData[]; onDismiss: (id: number) => void }) {
  const stableDismiss = useCallback((id: number) => onDismiss(id), [onDismiss]);
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((t) => <ToastItem key={t.id} toast={t} onDismiss={stableDismiss} />)}
    </div>
  );
}
