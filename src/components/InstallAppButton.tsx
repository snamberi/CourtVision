import { useInstallState, startInstall } from '../pwa/pwa';
import { PixelIcon } from './PixelIcon';

/** "Install app": the browser's install dialog when it has one, otherwise the step-by-step guide. Hidden once installed. */
export function InstallAppButton({ where = 'settings' }: { where?: string }) {
  const state = useInstallState();
  if (state === 'installed') return null;
  return <button className="primary" onClick={() => void startInstall(where)}><PixelIcon name="star" size={14} /> Install app</button>;
}
