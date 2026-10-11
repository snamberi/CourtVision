import { useEffect, useState } from 'react';
import { PixelIcon } from './PixelIcon';
import { checkForUpdate, dismissUpdate } from '../lib/updateCheck';

/** Windows edition only: a slim banner when the live site has a newer version to download. Offline, it never shows. */
export function UpdateBanner() {
  const [newer, setNewer] = useState<string | null>(null);
  useEffect(() => { let live = true; checkForUpdate().then(id => { if (live) setNewer(id); }); return () => { live = false; }; }, []);
  if (!newer) return null;
  return <div className="update-banner" role="status">
    <PixelIcon name="star" size={14} /> <span>A new version of Court Vision is out. Download it from courtvisiongame.com; your saves stay.</span>
    <a className="primary" href="https://courtvisiongame.com/" target="_blank" rel="noopener noreferrer">Get it</a>
    <button aria-label="Hide until the next version" onClick={() => { dismissUpdate(newer); setNewer(null); }}>×</button>
  </div>;
}
