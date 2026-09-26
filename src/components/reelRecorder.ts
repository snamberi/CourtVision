/** Records the on-screen court (and score bug) into a WebM video by redrawing the live SVG onto a canvas. */
export function canRecordReel(): boolean {
  return typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement !== 'undefined'
    && 'captureStream' in HTMLCanvasElement.prototype && typeof XMLSerializer !== 'undefined';
}
function pickMime(): string {
  for (const m of ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']) if (MediaRecorder.isTypeSupported?.(m)) return m;
  return 'video/webm';
}
export interface ReelRecording { stop: () => Promise<Blob> }
export function startReelRecording(root: HTMLElement, audio?: MediaStream | null, width = 1280): ReelRecording {
  const courtHeight = Math.round(width * 0.6), bugHeight = Math.round(width * 0.05);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = courtHeight + bugHeight;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#0b1018'; g.fillRect(0, 0, canvas.width, canvas.height);
  const stream = canvas.captureStream(30);
  for (const track of audio?.getAudioTracks() ?? []) stream.addTrack(track);
  const recorder = new MediaRecorder(stream, { mimeType: pickMime(), videoBitsPerSecond: 3_500_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  const serializer = new XMLSerializer();
  let running = true, busy = false, raf = 0;
  const draw = (svg: SVGSVGElement | null, y: number, h: number) => new Promise<void>(resolve => {
    if (!svg) return resolve();
    const markup = serializer.serializeToString(svg).replace('<svg', `<svg width="${width}" height="${h}"`);
    const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => { g.drawImage(img, 0, y, width, h); URL.revokeObjectURL(url); resolve(); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(); };
    img.src = url;
  });
  const tick = () => {
    if (!running) return;
    if (!busy) {
      busy = true;
      Promise.all([draw(root.querySelector<SVGSVGElement>('svg.watch-court'), 0, courtHeight), draw(root.querySelector<SVGSVGElement>('svg.watch-bug'), courtHeight, bugHeight)])
        .finally(() => { busy = false; });
    }
    raf = requestAnimationFrame(tick);
  };
  recorder.start(500);
  raf = requestAnimationFrame(tick);
  return {
    stop: () => new Promise<Blob>(resolve => {
      running = false; cancelAnimationFrame(raf);
      recorder.onstop = () => { stream.getVideoTracks().forEach(t => t.stop()); resolve(new Blob(chunks, { type: 'video/webm' })); };
      recorder.stop();
    }),
  };
}
