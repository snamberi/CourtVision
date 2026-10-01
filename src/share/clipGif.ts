import { GIFEncoder, quantize, applyPalette } from 'gifenc';

/*
 * Highlight clips: one possession of Watch Game as an animated GIF (plays inline on Discord, X, iMessage…). The court
 * is drawn frame by frame off screen; each frame's SVG is rasterised onto a canvas and added to the GIF. Nothing is
 * recorded in real time, so a 9-second play takes a few seconds to make whatever the device.
 */

export const CLIP_FPS = 12;  // keep in sync with WatchGame
export const CLIP_WIDTH = 640;

const serializer = typeof XMLSerializer !== 'undefined' ? new XMLSerializer() : null;
function drawSvg(g: CanvasRenderingContext2D, svg: SVGSVGElement | null, y: number, w: number, h: number): Promise<void> {
  return new Promise(resolve => {
    if (!svg || !serializer) return resolve();
    const markup = serializer.serializeToString(svg).replace('<svg', `<svg width="${w}" height="${h}"`);
    const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => { g.drawImage(img, 0, y, w, h); URL.revokeObjectURL(url); resolve(); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(); };
    img.src = url;
  });
}

export interface ClipWriter { add: (stage: HTMLElement, delayMs: number) => Promise<void>; finish: () => Blob }

/** A vertical clip (9:16, for TikTok, Reels and Shorts): a caption on top, the court in the middle, the score below. */
export interface VerticalClip { vertical: true; caption: string; sub?: string; site?: string }

function wrap(g: CanvasRenderingContext2D, text: string, max: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const w of text.split(/\s+/)) { const t = line ? `${line} ${w}` : w; if (g.measureText(t).width > max && line) { out.push(line); line = w; } else line = t; }
  if (line) out.push(line);
  return out.slice(0, 4);
}

/** A GIF being made: `add` captures the stage's court and score bug as the next frame. */
export function startClip(width = CLIP_WIDTH, vertical?: VerticalClip): ClipWriter {
  const W = vertical ? 540 : width;
  const courtH = Math.round(W * 0.6), bugH = Math.round(W * 0.05);
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = vertical ? 960 : courtH + bugH;
  const courtY = vertical ? 330 : 0;
  const g = canvas.getContext('2d', { willReadFrequently: true })!;
  const gif = GIFEncoder();
  // One palette for the whole clip (255 colours + a transparent slot): colours stay steady, and each frame after the
  // first stores only the pixels that changed, everything else transparent over the previous frame.
  const CLEAR = 255;
  let palette: number[][] | null = null, prev: Uint8Array | null = null;
  const chrome = () => {
    if (!vertical) return;
    // Flat bands (no gradients) keep the GIF palette for the court.
    g.fillStyle = '#121926'; g.fillRect(0, 0, W, courtY - 20);
    g.fillStyle = '#f47b20'; g.fillRect(0, courtY - 20, W, 6); g.fillRect(0, courtY + courtH + bugH + 14, W, 6);
    g.fillStyle = '#ffd166'; g.font = "bold 20px 'Press Start 2P', monospace"; g.textAlign = 'center';
    g.fillText('COURT VISION', W / 2, 70);
    g.fillStyle = '#f4f0e6'; g.font = "bold 38px 'Oswald', 'Arial Narrow', sans-serif";
    wrap(g, vertical.caption.toUpperCase(), W - 60).forEach((l, i) => g.fillText(l, W / 2, 140 + i * 46));
    if (vertical.sub) { g.fillStyle = '#94a0b2'; g.font = "20px 'Inter', system-ui, sans-serif"; g.fillText(vertical.sub, W / 2, courtY - 40); }
    g.fillStyle = '#f4f0e6'; g.font = "18px 'Press Start 2P', monospace"; g.fillText('PLAY FREE', W / 2, 870);
    g.fillStyle = '#ffd166'; g.font = "bold 26px 'Inter', system-ui, sans-serif"; g.fillText(vertical.site ?? 'courtvisiongame.com', W / 2, 910);
  };
  return {
    add: async (stage, delayMs) => {
      g.fillStyle = '#0b1018'; g.fillRect(0, 0, canvas.width, canvas.height);
      chrome();
      await drawSvg(g, stage.querySelector<SVGSVGElement>('svg.watch-court'), courtY, W, courtH);
      await drawSvg(g, stage.querySelector<SVGSVGElement>('svg.watch-bug'), courtY + courtH, W, bugH);
      const { data } = g.getImageData(0, 0, canvas.width, canvas.height);
      if (!palette) { palette = quantize(data, 255); while (palette.length < 255) palette.push([0, 0, 0]); palette.push([0, 0, 0]); }
      const index = applyPalette(data, palette.slice(0, 255));
      if (!prev) {
        gif.writeFrame(index, canvas.width, canvas.height, { palette, delay: delayMs, repeat: 0 });
      } else {
        const out = new Uint8Array(index.length);
        for (let i = 0; i < index.length; i++) out[i] = index[i] === prev[i] ? CLEAR : index[i];
        gif.writeFrame(out, canvas.width, canvas.height, { delay: delayMs, transparent: true, transparentIndex: CLEAR, dispose: 1 });
      }
      prev = index;
    },
    finish: () => { gif.finish(); return new Blob([gif.bytes() as BlobPart], { type: 'image/gif' }); },
  };
}

/** A GIF from a canvas you draw yourself (the season reel): `add` takes the canvas as it is now. */
export function startCanvasGif(): { add: (canvas: HTMLCanvasElement, delayMs: number) => void; finish: () => Blob } {
  const gif = GIFEncoder();
  const CLEAR = 255;
  let palette: number[][] | null = null, prev: Uint8Array | null = null;
  return {
    add: (canvas, delayMs) => {
      const g = canvas.getContext('2d', { willReadFrequently: true })!;
      const { data } = g.getImageData(0, 0, canvas.width, canvas.height);
      if (!palette) { palette = quantize(data, 255); while (palette.length < 255) palette.push([0, 0, 0]); palette.push([0, 0, 0]); }
      const index = applyPalette(data, palette.slice(0, 255));
      if (!prev) gif.writeFrame(index, canvas.width, canvas.height, { palette, delay: delayMs, repeat: 0 });
      else {
        const out = new Uint8Array(index.length);
        for (let i = 0; i < index.length; i++) out[i] = index[i] === prev[i] ? CLEAR : index[i];
        gif.writeFrame(out, canvas.width, canvas.height, { delay: delayMs, transparent: true, transparentIndex: CLEAR, dispose: 1 });
      }
      prev = index;
    },
    finish: () => { gif.finish(); return new Blob([gif.bytes() as BlobPart], { type: 'image/gif' }); },
  };
}
