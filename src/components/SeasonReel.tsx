import { useEffect, useRef, useState } from 'react';
import { drawReel, reelLength, REEL_W, REEL_H, type Reel } from '../recap/reel';
import { Modal } from './Modal';

const GIF_FPS = 8;
const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** The season reel on screen: plays by itself (paused when motion is reduced), and saves as a GIF. */
export function SeasonReel({ reel, onClose }: { reel: Reel; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(() => !reducedMotion());
  const [t, setT] = useState(0);
  const [gif, setGif] = useState<{ step: number; of: number } | { url: string; blob: Blob } | null>(null);
  const total = reelLength(reel);

  // Fonts first, so the first frame is not drawn in a fallback face.
  useEffect(() => { void document.fonts?.load('10px "Press Start 2P"').catch(() => {}); }, []);
  useEffect(() => { const g = canvas.current?.getContext('2d'); if (g) drawReel(g, reel, t); }, [reel, t]);
  useEffect(() => {
    if (!playing) return;
    let raf = 0; const start = performance.now() - t;
    const tick = (now: number) => { const e = Math.max(0, now - start); if (e >= total) { setT(total - 1); setPlaying(false); return; } setT(e); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps -- starts from the current time only when play is pressed

  const makeGif = async () => {
    const { startCanvasGif } = await import('../share/clipGif');
    const off = document.createElement('canvas'); off.width = REEL_W; off.height = REEL_H;
    const g = off.getContext('2d', { willReadFrequently: true })!;
    const w = startCanvasGif(), step = 1000 / GIF_FPS, of = Math.ceil(total / step);
    for (let k = 0; k < of; k++) {
      drawReel(g, reel, k * step); w.add(off, step);
      if (k % 8 === 0) { setGif({ step: k, of }); await new Promise(r => setTimeout(r, 0)); }
    }
    const blob = w.finish();
    setGif({ url: URL.createObjectURL(blob), blob });
  };
  const fileName = `${reel.teamName}-${reel.season}-season.gif`.replace(/[^\w.-]+/g, '-').toLowerCase();
  const save = async () => {
    if (!gif || !('blob' in gif)) return;
    const file = new File([gif.blob], fileName, { type: 'image/gif' });
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
    if (nav.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: `${reel.teamName} · ${reel.season}` }); return; } catch { /* fall back to a download */ } }
    const a = document.createElement('a'); a.href = gif.url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove();
  };
  useEffect(() => () => { if (gif && 'url' in gif) URL.revokeObjectURL(gif.url); }, [gif]);

  return <Modal label="Season reel" onClose={onClose}>
    <span className="pixel-eyebrow">SEASON REEL · {reel.season}</span>
    <canvas ref={canvas} className="season-reel" width={REEL_W} height={REEL_H} role="img" aria-label={`${reel.teamName} season reel: ${reel.scenes.map(s => `${s.kicker}: ${s.big}`).join('; ')}`} />
    <div className="reel-bar" aria-hidden="true"><i style={{ width: `${(t / total) * 100}%` }} /></div>
    <div className="contest-actions">
      <button className="primary" onClick={() => { if (t >= total - 1) setT(0); setPlaying(p => !p); }}>{playing ? 'Pause' : t >= total - 1 ? 'Replay' : 'Play'}</button>
      {!gif && <button onClick={() => void makeGif()}>Make a GIF</button>}
      {gif && 'step' in gif && <span className="hint-text" role="status">Making the GIF… {Math.round((gif.step / gif.of) * 100)}%</span>}
      {gif && 'url' in gif && <button onClick={() => void save()}>Save / share GIF</button>}
      <button className="link-button" onClick={onClose}>Close</button>
    </div>
  </Modal>;
}
