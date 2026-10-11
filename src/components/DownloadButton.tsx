import { DownloadIcon } from './Icons';
import { useInstallState, startInstall, downloadsWindows } from '../pwa/pwa';

/** Pinned to the top-right corner of every screen: installs Court Vision as an app (or shows how). Hidden once installed. */
export function DownloadButton() {
  const state = useInstallState();
  if (state === 'installed') return null;
  const download = downloadsWindows(state);
  return (
    <button type="button" className="download-fab" onClick={() => void startInstall('corner')} aria-label={download ? 'Download Court Vision for Windows' : 'Install Court Vision as an app'} title={download ? 'Download for Windows' : 'Install the app'}>
      <DownloadIcon /><span className="download-fab-label">{download ? 'Download' : 'Install app'}</span>
    </button>
  );
}
