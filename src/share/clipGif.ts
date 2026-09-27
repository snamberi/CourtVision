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

/** A GIF being made: `add` captures the stage's court and score bug as the next frame. */
export function startClip(width = CLIP_WIDTH): ClipWriter {
  const courtH = Math.round(width * 0.6), bugH = Math.round(width * 0.05);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = courtH + bugH;
  const g = canvas.getContext('2d', { willReadFrequently: true })!;
  const gif = GIFEncoder();
  // One palette for the whole clip (255 colours + a transparent slot): colours stay steady, and each frame after the
  // first stores only the pixels that changed, everything else transparent over the previous frame.
  const CLEAR = 255;
  let palette: number[][] | null = null, prev: Uint8Array | null = null;
  return {
    add: async (stage, delayMs) => {
      g.fillStyle = '#0b1018'; g.fillRect(0, 0, canvas.width, canvas.height);
      await drawSvg(g, stage.querySelector<SVGSVGElement>('svg.watch-court'), 0, width, courtH);
      await drawSvg(g, stage.querySelector<SVGSVGElement>('svg.watch-bug'), courtH, width, bugH);
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
