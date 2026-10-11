import { lazy, Suspense, useState } from 'react';
import { hasUnseenRelease } from '../content/whatsNewLatest';

const WhatsNewDialog = lazy(() => import('./WhatsNewDialog').then(m => ({ default: m.WhatsNewDialog })));

/** "What's new": loads the release notes only when there is something to show (or the phone's app asks for them). */
export function WhatsNew({ force = false, onClose }: { force?: boolean; onClose?: () => void } = {}) {
  const [show] = useState(() => force || hasUnseenRelease());
  if (!show) return null;
  return <Suspense fallback={null}><WhatsNewDialog force={force} onClose={onClose} /></Suspense>;
}
