import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { PixelIcon } from './PixelIcon';
export function ConfirmationDialog({ title, children, confirmLabel, onConfirm, onCancel }: {
  title: string; children: ReactNode; confirmLabel: string; onConfirm: () => void | Promise<void>; onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null), cancel = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { const el = dialog.current!; el.showModal(); cancel.current?.focus(); return () => el.close(); }, []);
  return <dialog ref={dialog} className="pixel-confirm" aria-labelledby={titleId} onCancel={e => { e.preventDefault(); if (!busy) onCancel(); }}>
    <div className="pixel-confirm-heading"><PixelIcon name="warning" size={30} /><h2 id={titleId}>{title}</h2></div>
    <div className="pixel-confirm-body">{children}</div>
    {error && <p role="alert">{error}</p>}
    <div className="pixel-confirm-actions"><button ref={cancel} disabled={busy} onClick={onCancel}>Cancel</button><button className="primary" disabled={busy} onClick={async () => {
      setBusy(true); setError(''); try { await onConfirm(); } catch { setError('Could not finish this action. Please try again.'); setBusy(false); }
    }}>{busy ? 'Please wait…' : confirmLabel}</button></div>
  </dialog>;
}
