import { useEffect, useState } from 'react';
import { FloorPatterns } from './WatchCourt';
import type { FloorId, FrameId } from '../profile/profile';

/** A court floor on a little court, with lines and paint (the Profile's floor picker). */
export function CourtFloorPreview({ floor, width = 300 }: { floor: FloorId; width?: number }) {
  const id = `pv-${floor}`, style = floor === 'team' ? 'planks' : floor;
  const lines = '#f6ecd2', paint = '#c8571f';
  return <svg className="floor-preview" viewBox="0 0 300 170" width={width} height={Math.round(width * 170 / 300)} role="img" aria-label={`${floor} court floor`}>
    <defs><FloorPatterns id={id} /></defs>
    <rect width="300" height="170" fill="#1f2a3c" />
    <rect x="10" y="10" width="280" height="150" fill={`url(#${id}-${style})`} />
    <g fill="none" stroke={lines} strokeWidth="2">
      <rect x="10" y="10" width="280" height="150" />
      <path d="M150 10V160" /><circle cx="150" cy="85" r="18" />
      <path d="M10 33H34A52 52 0 0 1 34 137H10M290 33H266A52 52 0 0 0 266 137H290" />
    </g>
    <rect x="10" y="62" width="52" height="46" fill={paint} opacity=".85" stroke={lines} strokeWidth="2" />
    <rect x="238" y="62" width="52" height="46" fill={paint} opacity=".85" stroke={lines} strokeWidth="2" />
    <circle cx="150" cy="85" r="7" fill={paint} />
  </svg>;
}

/** The share card as it will look with this frame (drawn on a canvas, shown as an image). */
export function ShareFramePreview({ frame, width = 360 }: { frame: FrameId; width?: number }) {
  const [url, setUrl] = useState<{ frame: FrameId; src: string } | null>(null);
  useEffect(() => {
    let live = true;
    void import('../share/shareCard').then(async m => {
      const canvas = await m.renderShareCard({ kicker: 'League Hunt · Pro', title: 'Hunt won!', subtitle: '10 series, 40-12 in games', stats: [{ label: 'Series', value: '10/10' }, { label: 'Games', value: '40-12' }, { label: 'Best', value: '97' }], badge: 'BOSS BEATEN', avatar: { playerId: 'preview-player', jersey: 23 }, stars: 3, accent: 'gold', frame });
      if (live) setUrl({ frame, src: canvas.toDataURL('image/png') });
    }).catch(() => {});
    return () => { live = false; };
  }, [frame]);
  return url?.frame === frame ? <img className="share-preview" src={url.src} width={width} height={Math.round(width * 630 / 1200)} alt={`Share card with the ${frame} frame`} />
    : <span className="share-preview share-preview-loading" style={{ width, height: Math.round(width * 630 / 1200) }} aria-hidden="true" />;
}
