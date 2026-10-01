import { useEffect, useState } from 'react';
import type { ShareCardSpec } from '../share/shareCard';
import { PixelIcon } from './PixelIcon';
import { track } from '../analytics/track';

/** "Share card": opens a preview of the result as an image, with Download, Copy and (on phones) Share. */
export function ShareCardButton({ spec, fileName, text, label = 'Share card', tall = false }: { spec: ShareCardSpec; fileName: string; text: string; label?: string; /** Offer the 9:16 version (TikTok, Reels, Stories). */ tall?: boolean }) {
  const [open, setOpen] = useState(false);
  const [vertical, setVertical] = useState(false);
  const [img, setImg] = useState<{ url: string; blob: Blob } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    let live = true, url = '';
    import('../share/shareCard').then(async m => {
      const { equipped } = await import('../profile/profile');
      const blob = await m.cardBlob(await m.renderShareCard({ ...spec, vertical, frame: spec.frame ?? equipped().frame }));
      url = URL.createObjectURL(blob);
      if (live) setImg({ url, blob }); else URL.revokeObjectURL(url);
    }).catch(() => { if (live) setStatus('Could not draw the card in this browser.'); });
    return () => { live = false; if (url) URL.revokeObjectURL(url); setImg(null); };
  // The card is drawn when the preview opens; the spec is fixed for a finished result.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, vertical]);
  const act = async (how: 'share' | 'copy' | 'download') => {
    if (!img) return;
    const m = await import('../share/shareCard');
    try {
      const r = await m.shareImage(img.blob, vertical ? fileName.replace(/\.png$/, '-9x16.png') : fileName, text, how);
      track('share_card', { kind: fileName.split(/[-.]/)[0], how: r });
      setStatus(r === 'shared' ? 'Shared!' : r === 'copied' ? 'Image copied: paste it into Discord or anywhere.' : 'Image saved.');
    } catch { setStatus('Sharing was cancelled.'); }
  };
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  return <>
    <button onClick={() => { setOpen(true); setStatus(null); }}><PixelIcon name="star" size={14} /> {label}</button>
    {open && <div className="share-modal" role="dialog" aria-label="Share card" onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="share-box">
        {tall && <div className="share-format" role="radiogroup" aria-label="Card shape"><button role="radio" aria-checked={!vertical} className={!vertical ? 'on' : ''} onClick={() => setVertical(false)}>Landscape</button><button role="radio" aria-checked={vertical} className={vertical ? 'on' : ''} onClick={() => setVertical(true)}>9:16 TikTok</button></div>}
        {img ? <img className={vertical ? 'share-tall' : ''} src={img.url} alt={`${spec.title}: share card`} width={vertical ? 270 : 600} height={vertical ? 480 : 315} /> : <div className="share-loading">Drawing the card…</div>}
        <div className="contest-actions">
          {canShare && <button className="primary" disabled={!img} onClick={() => act('share')}>Share</button>}
          <button className={canShare ? '' : 'primary'} disabled={!img} onClick={() => act('copy')}>Copy image</button>
          <button disabled={!img} onClick={() => act('download')}>Download</button>
          <button className="link-button" onClick={() => setOpen(false)}>Close</button>
        </div>
        {status && <p className="hint-text" role="status">{status}</p>}
      </div>
    </div>}
  </>;
}
