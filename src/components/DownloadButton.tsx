import { DownloadIcon } from './Icons';
import { useInstallState, startInstall } from '../pwa/pwa';

/** Pinned to the top-right corner of every screen: installs Court Vision as an app (or shows how). Hidden once installed. */
export function DownloadButton() {
  const state = useInstallState();
  if (state === 'installed') return null;
  return (
    <button type="button" className="download-fab" onClick={() => void startInstall('corner')} aria-label="Install Court Vision as an app" title="Install the app">
      <DownloadIcon /><span className="download-fab-label">Install app</span>
    </button>
  );
}
