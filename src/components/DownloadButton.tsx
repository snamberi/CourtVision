import { DownloadIcon } from './Icons';
import { IS_DESKTOP_BUILD, WINDOWS_DOWNLOAD_FILE, WINDOWS_DOWNLOAD_URL } from '../appMode';

/** Small icon-only button pinned to the top-right corner of every screen. Downloads the Windows package. */
export function DownloadButton() {
  if (IS_DESKTOP_BUILD) return null; // the Windows build is already the thing this would download
  return (
    <a
      className="download-fab"
      href={WINDOWS_DOWNLOAD_URL}
      download={WINDOWS_DOWNLOAD_FILE}
      aria-label="Download CourtVision for Windows"
      title="Download for Windows"
    >
      <DownloadIcon />
    </a>
  );
}
