import { cardFrameFinish } from './cardFrameFinish';
import type { FrameId } from '../profile/profile';

/*
 * Share-card frames as whole-card designs: each frame paints its own background (wood, neon grid, fire, deep space,
 * blue fire...), sets the panel and box colours the text sits on, and draws a detailed border. Text stays cream on
 * dark, translucent panels in every theme so the card always reads. Used by shareCard.ts for both card shapes.
 */

type Ctx = CanvasRenderingContext2D;
export interface CardTheme {
  /** The border, kicker and badge colour. */
  accent: string;
  /** A second colour for the details. */
  accent2: string;
  /** Translucent panel over the background, and the stat boxes. */
  panel: string; box: string; line: string;
  text: string; muted: string;
  footer: string;
  background: (ctx: Ctx, W: number, H: number) => void;
  border: (ctx: Ctx, x0: number, y0: number, w: number, h: number) => void;
  /** Something worn over the player on the card (the owner's crown). */
  overAvatar?: (ctx: Ctx, cx: number, top: number, scale: number) => void;
}

// ---------------------------------------------------------------- helpers

/** A seeded number in [0, 1) so every card of a frame looks the same. */
const rnd = (i: number) => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
function vgrad(ctx: Ctx, W: number, H: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function radial(ctx: Ctx, x: number, y: number, r: number, inner: string, outer = 'rgba(0,0,0,0)') {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, inner); g.addColorStop(1, outer);
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function stars(ctx: Ctx, W: number, H: number, n: number, colors: string[], seed = 1) {
  for (let i = 0; i < n; i++) {
    const x = rnd(seed + i) * W, y = rnd(seed + i * 7.1) * H, s = rnd(seed + i * 3.3) > 0.9 ? 3 : rnd(seed + i * 5.7) > 0.6 ? 2 : 1;
    ctx.fillStyle = colors[i % colors.length]; ctx.globalAlpha = 0.4 + rnd(seed + i * 9.2) * 0.6;
    ctx.fillRect(Math.round(x), Math.round(y), s * 2, s * 2);
    if (s === 3) { ctx.fillRect(Math.round(x) - 4, Math.round(y) + 2, 14, 2); ctx.fillRect(Math.round(x) + 2, Math.round(y) - 4, 2, 14); }
  }
  ctx.globalAlpha = 1;
}
/** Pixel flames rising from the bottom edge (and down from the top when `top`). */
function flames(ctx: Ctx, W: number, H: number, cols: string[], height: number, top = false, seed = 3) {
  for (let x = 0; x < W; x += 10) {
    const t = (Math.sin(x * 0.031 + seed) + Math.sin(x * 0.083 + seed * 2) + Math.sin(x * 0.0137) + 3) / 6;
    const h = Math.round((height * 0.35 + t * height * 0.65) / 6) * 6;
    cols.forEach((c, i) => {
      const hh = h - i * (height / (cols.length + 1));
      if (hh <= 0) return;
      ctx.fillStyle = c;
      ctx.fillRect(x + i, top ? 0 : H - hh, 10 - i * 2, hh);
    });
  }
}
function crown(ctx: Ctx, cx: number, y: number, s: number, fill: string, dark: string, gems: string[]) {
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(cx - 13 * s, y + 12 * s); ctx.lineTo(cx - 15 * s, y - 2 * s); ctx.lineTo(cx - 7 * s, y + 4 * s); ctx.lineTo(cx, y - 8 * s);
  ctx.lineTo(cx + 7 * s, y + 4 * s); ctx.lineTo(cx + 15 * s, y - 2 * s); ctx.lineTo(cx + 13 * s, y + 12 * s); ctx.closePath(); ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(cx - 11 * s, y + 10 * s); ctx.lineTo(cx - 13 * s, y + 1 * s); ctx.lineTo(cx - 6 * s, y + 6 * s); ctx.lineTo(cx, y - 5 * s);
  ctx.lineTo(cx + 6 * s, y + 6 * s); ctx.lineTo(cx + 13 * s, y + 1 * s); ctx.lineTo(cx + 11 * s, y + 10 * s); ctx.closePath(); ctx.fill();
  ctx.fillRect(cx - 12 * s, y + 10 * s, 24 * s, 4 * s);
  gems.forEach((g, i) => { ctx.fillStyle = g; const gx = cx + (i - (gems.length - 1) / 2) * 7 * s; ctx.fillRect(gx - 1.5 * s, y + 10.5 * s, 3 * s, 3 * s); });
  ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - 1 * s, y - 4 * s, 2 * s, 2 * s);
}
const box = (ctx: Ctx, x0: number, y0: number, w: number, h: number, c: string, lw: number, inset = 0) => { ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.strokeRect(x0 + inset, y0 + inset, w - inset * 2, h - inset * 2); };
const corners = (ctx: Ctx, x0: number, y0: number, w: number, h: number, c: string, size: number) => { ctx.fillStyle = c; for (const [x, y] of [[x0 - 4, y0 - 4], [x0 + w - size + 4, y0 - 4], [x0 - 4, y0 + h - size + 4], [x0 + w - size + 4, y0 + h - size + 4]]) ctx.fillRect(x, y, size, size); };
function glowBox(ctx: Ctx, x0: number, y0: number, w: number, h: number, c: string, blur: number, lw: number, inset = 0) {
  ctx.save(); ctx.shadowColor = c; ctx.shadowBlur = blur; box(ctx, x0, y0, w, h, c, lw, inset); ctx.restore();
}

const base = { panel: 'rgba(10,15,24,.58)', box: 'rgba(7,11,18,.8)', line: '#2a3546', text: '#f4f0e6', muted: '#a7b1c2', footer: 'rgba(25,35,51,.94)' };

// ---------------------------------------------------------------- the frames

export const CARD_THEMES: Record<FrameId, CardTheme> = {
  classic: { ...base, accent: '#f47b20', accent2: '#ffd166',
    background: (ctx, W, H) => {
      vgrad(ctx, W, H, [[0, '#0e1522'], [1, '#080c14']]);
      ctx.strokeStyle = 'rgba(244,123,32,.09)'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(W * 0.79, H / 2, Math.min(W, H) * 0.27, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeRect(W * 0.57, 40, W * 0.4, H - 80);
    },
    border: (ctx, x0, y0, w, h) => { box(ctx, x0, y0, w, h, '#f47b20', 4); },
  },
  gold: { ...base, panel: 'rgba(26,20,8,.58)', box: 'rgba(14,10,3,.8)', line: '#5a4416', accent: '#ffd166', accent2: '#fff3c4',
    background: (ctx, W, H) => {
      vgrad(ctx, W, H, [[0, '#2a1f08'], [0.5, '#1a1305'], [1, '#0d0a03']]);
      ctx.save(); ctx.globalAlpha = 0.12; ctx.fillStyle = '#ffd166';
      for (let i = -H; i < W; i += 90) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 30, 0); ctx.lineTo(i + 30 + H, H); ctx.lineTo(i + H, H); ctx.fill(); }
      ctx.restore(); radial(ctx, W * 0.8, H * 0.2, W * 0.5, 'rgba(255,209,102,.16)');
    },
    border: (ctx, x0, y0, w, h) => { box(ctx, x0, y0, w, h, '#ffd166', 5); box(ctx, x0, y0, w, h, '#c9971f', 2, 11); corners(ctx, x0, y0, w, h, '#ffd166', 16); },
  },
  hardwood: { ...base, panel: 'rgba(30,18,9,.58)', box: 'rgba(18,10,4,.8)', line: '#6b4630', accent: '#e3b479', accent2: '#ffd166',
    background: (ctx, W, H) => {
      for (let y = 0; y < H; y += 26) for (let x = -((y / 26) % 3) * 70; x < W; x += 210) {
        ctx.fillStyle = (Math.floor(y / 26) + Math.floor(x / 210)) % 2 ? '#c98e57' : '#d49c63'; ctx.fillRect(x, y, 210, 26);
        ctx.fillStyle = '#8a5530'; ctx.fillRect(x, y, 2, 26); ctx.fillRect(x, y + 25, 210, 1);
        ctx.fillStyle = 'rgba(255,240,202,.25)'; ctx.fillRect(x + 30, y + 8, 80, 1);
      }
      ctx.fillStyle = 'rgba(20,10,4,.35)'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(W * 0.8, H / 2, Math.min(W, H) * 0.25, 0, Math.PI * 2); ctx.stroke();
    },
    border: (ctx, x0, y0, w, h) => { box(ctx, x0, y0, w, h, '#e3b479', 6); box(ctx, x0, y0, w, h, '#8a5530', 2, 10); },
  },
  neon: { ...base, panel: 'rgba(14,6,30,.58)', box: 'rgba(8,3,20,.82)', line: '#3a2a6a', accent: '#3ef2ff', accent2: '#ff4fd8',
    background: (ctx, W, H) => {
      vgrad(ctx, W, H, [[0, '#120626'], [0.6, '#1c0838'], [1, '#2a0a3a']]);
      ctx.save(); ctx.strokeStyle = 'rgba(62,242,255,.22)'; ctx.lineWidth = 2;
      const hz = H * 0.62;
      for (let x = -W; x < W * 2; x += 60) { ctx.beginPath(); ctx.moveTo(W / 2 + (x - W / 2) * 0.15, hz); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = hz, s = 8; y < H; y += s, s *= 1.35) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      ctx.restore();
      radial(ctx, W * 0.8, hz - 40, W * 0.28, 'rgba(255,79,216,.35)');
    },
    border: (ctx, x0, y0, w, h) => { glowBox(ctx, x0, y0, w, h, '#3ef2ff', 18, 4); glowBox(ctx, x0, y0, w, h, '#ff4fd8', 12, 2, 10); },
  },
  banner: { ...base, panel: 'rgba(20,10,14,.58)', line: '#5a2430', accent: '#ffd166', accent2: '#7a1f2b',
    background: (ctx, W, H) => {
      vgrad(ctx, W, H, [[0, '#1a0c12'], [1, '#0b0609']]);
      ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 3;
      for (let x = 0; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 40, 60); ctx.stroke(); }
      const n = Math.max(4, Math.floor(W / 140));
      for (let i = 0; i < n; i++) {
        const bx = 60 + i * (W - 120) / n, bw = Math.min(70, W / n - 20);
        ctx.fillStyle = i % 2 ? '#7a1f2b' : '#1f3a7a';
        ctx.beginPath(); ctx.moveTo(bx, 34); ctx.lineTo(bx + bw, 34); ctx.lineTo(bx + bw, 150); ctx.lineTo(bx + bw / 2, 128); ctx.lineTo(bx, 150); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = 'rgba(255,209,102,.8)'; ctx.fillRect(bx + bw / 2 - 8, 70, 16, 16);
      }
      ctx.fillStyle = 'rgba(11,6,9,.55)'; ctx.fillRect(0, 0, W, H);
    },
    border: (ctx, x0, y0, w, h) => { box(ctx, x0, y0, w, h, '#ffd166', 4); box(ctx, x0, y0, w, h, '#7a1f2b', 4, 8); },
  },
  fire: { ...base, panel: 'rgba(28,8,4,.58)', box: 'rgba(16,4,2,.82)', line: '#6a2410', accent: '#ff9d3d', accent2: '#ffd166',
    background: (ctx, W, H) => {
      vgrad(ctx, W, H, [[0, '#1a0604'], [0.6, '#3a0c04'], [1, '#6a1404']]);
      flames(ctx, W, H, ['#7a1200', '#e8322e', '#ff9d3d', '#ffd166'], H * 0.32);
      stars(ctx, W, H * 0.7, 40, ['#ffd166', '#ff9d3d'], 11);
    },
    border: (ctx, x0, y0, w, h) => { box(ctx, x0, y0, w, h, '#e8322e', 5); box(ctx, x0, y0, w, h, '#ffd166', 2, 9); },
  },
  diamond: { ...base, panel: 'rgba(8,20,34,.58)', box: 'rgba(4,12,22,.82)', line: '#2a5470', accent: '#9fe7ff', accent2: '#ffffff',
    background: (ctx, W, H) => {
      vgrad(ctx, W, H, [[0, '#0b2238'], [1, '#06101c']]);
      for (let i = 0; i < 40; i++) {
        const x = rnd(i) * W, y = rnd(i * 3.1) * H, s = 30 + rnd(i * 7) * 70;
        ctx.fillStyle = `rgba(159,231,255,${0.04 + rnd(i * 2) * 0.08})`;
        ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.7, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s * 0.7, y); ctx.closePath(); ctx.fill();
      }
      stars(ctx, W, H, 50, ['#ffffff', '#9fe7ff'], 21);
    },
    border: (ctx, x0, y0, w, h) => { box(ctx, x0, y0, w, h, '#9fe7ff', 4); box(ctx, x0, y0, w, h, '#ffffff', 2, 10); corners(ctx, x0, y0, w, h, '#6db8ff', 16); },
  },
  jade: { ...base, panel: 'rgba(6,26,16,.58)', box: 'rgba(3,16,9,.82)', line: '#1f5a3a', accent: '#6fdc93', accent2: '#ffd166',
    background: (ctx, W, H) => {
      vgrad(ctx, W, H, [[0, '#0b2a1a'], [1, '#04140c']]);
      ctx.strokeStyle = 'rgba(111,220,147,.12)'; ctx.lineWidth = 3;
      for (let y = 40; y < H; y += 80) for (let x = 40; x < W; x += 120) { ctx.beginPath(); ctx.arc(x, y, 24, Math.PI, 0); ctx.arc(x + 30, y, 14, Math.PI, 0); ctx.stroke(); }
      radial(ctx, W * 0.82, H * 0.45, W * 0.3, 'rgba(255,209,102,.1)');
    },
    border: (ctx, x0, y0, w, h) => { box(ctx, x0, y0, w, h, '#2fa86a', 5); box(ctx, x0, y0, w, h, '#ffd166', 2, 10); corners(ctx, x0, y0, w, h, '#1f7a4a', 20); },
  },
  pixel: { ...base, accent: '#ffd166', accent2: '#4da3ff',
    background: (ctx, W, H) => {
      const cols = ['#162036', '#1a2742', '#121a2c'];
      for (let y = 0; y < H; y += 24) for (let x = 0; x < W; x += 24) { ctx.fillStyle = cols[(x / 24 + y / 24 * 2) % 3]; ctx.fillRect(x, y, 24, 24); }
      for (let i = 0; i < 30; i++) { ctx.fillStyle = ['#f47b20', '#4da3ff', '#ffd166', '#55c878'][i % 4]; ctx.globalAlpha = 0.35; ctx.fillRect(Math.floor(rnd(i) * W / 24) * 24, Math.floor(rnd(i * 4) * H / 24) * 24, 24, 24); }
      ctx.globalAlpha = 1;
    },
    border: (ctx, x0, y0, w, h) => {
      for (let x = x0; x < x0 + w; x += 16) { ctx.fillStyle = (x / 16) % 2 ? '#f47b20' : '#4da3ff'; ctx.fillRect(x, y0, 12, 12); ctx.fillRect(x, y0 + h - 12, 12, 12); }
      for (let y = y0; y < y0 + h; y += 16) { ctx.fillStyle = (y / 16) % 2 ? '#ffd166' : '#55c878'; ctx.fillRect(x0, y, 12, 12); ctx.fillRect(x0 + w - 12, y, 12, 12); }
    },
  },
  ice: { ...base, panel: 'rgba(10,26,40,.58)', box: 'rgba(6,16,26,.82)', line: '#3a6a8a', accent: '#bfe6ff', accent2: '#ffffff',
    background: (ctx, W, H) => {
      vgrad(ctx, W, H, [[0, '#123048'], [1, '#081826']]);
      for (let x = 0; x < W; x += 26) { const len = 30 + rnd(x) * 90; ctx.fillStyle = 'rgba(232,247,255,.55)'; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 14, 0); ctx.lineTo(x + 7, len); ctx.closePath(); ctx.fill(); }
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2;
      for (let i = 0; i < 24; i++) { const x = rnd(i * 2) * W, y = 140 + rnd(i * 5) * (H - 160), r = 6 + rnd(i) * 10; for (let a = 0; a < 3; a++) { ctx.beginPath(); ctx.moveTo(x - r * Math.cos(a * Math.PI / 3), y - r * Math.sin(a * Math.PI / 3)); ctx.lineTo(x + r * Math.cos(a * Math.PI / 3), y + r * Math.sin(a * Math.PI / 3)); ctx.stroke(); } }
    },
    border: (ctx, x0, y0, w, h) => { box(ctx, x0, y0, w, h, '#bfe6ff', 4); box(ctx, x0, y0, w, h, '#ffffff', 1, 8); },
  },
  lightning: { ...base, panel: 'rgba(12,14,30,.58)', line: '#3a3f6a', accent: '#ffd166', accent2: '#fff3a0',
    background: (ctx, W, H) => {
      vgrad(ctx, W, H, [[0, '#0b0e24'], [1, '#05060f']]);
      ctx.fillStyle = 'rgba(80,90,140,.25)';
      for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(rnd(i) * W, rnd(i * 3) * H * 0.3, 60 + rnd(i * 5) * 80, 0, Math.PI * 2); ctx.fill(); }
      ctx.save(); ctx.shadowColor = '#fff3a0'; ctx.shadowBlur = 20; ctx.strokeStyle = '#fff3a0'; ctx.lineWidth = 5;
      for (const sx of [W * 0.72, W * 0.9]) { ctx.beginPath(); let x = sx, y = 0; ctx.moveTo(x, y); while (y < H) { x += (rnd(x + y) - 0.5) * 80; y += 40 + rnd(y) * 40; ctx.lineTo(x, y); } ctx.stroke(); }
      ctx.restore();
    },
    border: (ctx, x0, y0, w, h) => {
      box(ctx, x0, y0, w, h, '#ffd166', 3);
      ctx.strokeStyle = '#fff3a0'; ctx.lineWidth = 4;
      for (const y of [y0 + 14, y0 + h - 14]) { ctx.beginPath(); for (let x = x0; x <= x0 + w; x += 24) ctx.lineTo(x, y + (((x - x0) / 24) % 2 ? -7 : 7)); ctx.stroke(); }
    },
  },
  ember: { ...base, panel: 'rgba(24,10,6,.58)', line: '#5a2414', accent: '#ff6b2d', accent2: '#ffd166',
    background: (ctx, W, H) => {
      vgrad(ctx, W, H, [[0, '#120806'], [1, '#2a0e06']]);
      radial(ctx, W / 2, H + 60, W * 0.7, 'rgba(255,77,46,.45)');
      for (let i = 0; i < 90; i++) { const x = rnd(i) * W, y = rnd(i * 2.3) * H, s = 2 + Math.floor(rnd(i * 4) * 3) * 2; ctx.fillStyle = ['#ff4d2e', '#ff9d3d', '#ffd166'][i % 3]; ctx.globalAlpha = 0.3 + (y / H) * 0.7; ctx.fillRect(x, y, s, s); }
      ctx.globalAlpha = 1;
    },
    border: (ctx, x0, y0, w, h) => { box(ctx, x0, y0, w, h, '#7a1200', 6); for (let x = x0; x < x0 + w; x += 10) { ctx.fillStyle = ['#ff4d2e', '#ff9d3d', '#ffd166'][(x / 10) % 3 | 0]; ctx.fillRect(x, y0 + h - 8, 8, 6); ctx.fillRect(x, y0 + 2, 8, 6); } },
  },
  royal: { ...base, panel: 'rgba(24,10,40,.58)', box: 'rgba(14,5,26,.82)', line: '#4a2a7a', accent: '#ffd166', accent2: '#b983ff',
    background: (ctx, W, H) => {
      vgrad(ctx, W, H, [[0, '#2a1250'], [1, '#12062a']]);
      ctx.strokeStyle = 'rgba(255,209,102,.1)'; ctx.lineWidth = 2;
      for (let x = -H; x < W + H; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + H, H); ctx.moveTo(x + H, 0); ctx.lineTo(x, H); ctx.stroke(); }
      crown(ctx, W * 0.82, H * 0.14, 3, 'rgba(255,209,102,.5)', 'rgba(90,45,145,.6)', ['#e8322e', '#4da3ff', '#6fdc93']);
    },
    border: (ctx, x0, y0, w, h) => { box(ctx, x0, y0, w, h, '#5a2d91', 8); box(ctx, x0, y0, w, h, '#ffd166', 2, 12); corners(ctx, x0, y0, w, h, '#ffd166', 20); },
  },
  galaxy: { ...base, panel: 'rgba(14,8,34,.58)', box: 'rgba(8,4,22,.82)', line: '#3b2a6a', accent: '#b983ff', accent2: '#6fd3ff',
    background: (ctx, W, H) => {
      vgrad(ctx, W, H, [[0, '#0d0626'], [1, '#05020f']]);
      radial(ctx, W * 0.75, H * 0.35, W * 0.45, 'rgba(185,131,255,.28)');
      radial(ctx, W * 0.25, H * 0.75, W * 0.35, 'rgba(255,122,217,.18)');
      radial(ctx, W * 0.9, H * 0.85, W * 0.25, 'rgba(111,211,255,.18)');
      stars(ctx, W, H, 220, ['#ffffff', '#ff7ad9', '#6fd3ff', '#ffd166'], 31);
    },
    border: (ctx, x0, y0, w, h) => { box(ctx, x0, y0, w, h, '#3b1d82', 6); box(ctx, x0, y0, w, h, '#b983ff', 2, 10); },
  },
  rainbow: { ...base, accent: '#ffd166', accent2: '#ff7ad9',
    background: (ctx, W, H) => {
      vgrad(ctx, W, H, [[0, '#101624'], [1, '#080c14']]);
      const cols = ['#ff4d4d', '#ff9d3d', '#ffd166', '#6fdc93', '#6db8ff', '#b983ff'];
      ctx.save(); ctx.globalAlpha = 0.22;
      cols.forEach((c, i) => { ctx.strokeStyle = c; ctx.lineWidth = 22; ctx.beginPath(); ctx.arc(W * 0.8, H * 1.05, H * 0.55 + i * 22, Math.PI, 0); ctx.stroke(); });
      ctx.restore(); stars(ctx, W, H, 40, ['#ffffff'], 41);
    },
    border: (ctx, x0, y0, w, h) => { ['#ff4d4d', '#ff9d3d', '#ffd166', '#6fdc93', '#6db8ff', '#b983ff'].forEach((c, i) => box(ctx, x0, y0, w, h, c, 3, i * 3)); },
  },
  legend: { ...base, panel: 'rgba(24,18,6,.58)', box: 'rgba(14,10,3,.82)', line: '#6a5418', accent: '#ffd166', accent2: '#ffffff',
    background: (ctx, W, H) => {
      vgrad(ctx, W, H, [[0, '#241a06'], [1, '#0d0902']]);
      ctx.save(); ctx.translate(W * 0.8, H * 0.4);
      for (let i = 0; i < 24; i++) { ctx.rotate(Math.PI / 12); ctx.fillStyle = i % 2 ? 'rgba(255,209,102,.1)' : 'rgba(255,255,255,.05)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, -60); ctx.lineTo(W, 60); ctx.closePath(); ctx.fill(); }
      ctx.restore();
      radial(ctx, W * 0.8, H * 0.4, W * 0.3, 'rgba(255,243,196,.3)');
      stars(ctx, W, H, 60, ['#ffd166', '#ffffff'], 51);
    },
    border: (ctx, x0, y0, w, h) => { box(ctx, x0, y0, w, h, '#ffd166', 6); box(ctx, x0, y0, w, h, '#ffffff', 2, 12); corners(ctx, x0, y0, w, h, '#ffd166', 22); },
  },
  // Game owner only: celestial blue fire under a king's crown.
  sovereign: { ...base, panel: 'rgba(6,12,38,.58)', box: 'rgba(3,7,26,.82)', line: '#2a4aa0', text: '#f4f8ff', muted: '#a9c4ff', footer: 'rgba(8,16,52,.94)', accent: '#6fd3ff', accent2: '#ffd166',
    background: (ctx, W, H) => {
      vgrad(ctx, W, H, [[0, '#04061a'], [0.55, '#081a4a'], [1, '#0a2a8a']]);
      radial(ctx, W * 0.78, H * 0.38, Math.max(W, H) * 0.42, 'rgba(111,211,255,.32)');
      radial(ctx, W * 0.2, H * 0.2, Math.max(W, H) * 0.3, 'rgba(120,90,255,.22)');
      stars(ctx, W, H * 0.8, 260, ['#ffffff', '#9fe7ff', '#b8a8ff', '#ffd166'], 61);
      flames(ctx, W, H, ['#0a1f7a', '#1f4fd9', '#4da3ff', '#9fe7ff', '#ffffff'], H * 0.3, false, 7);
      ctx.save(); ctx.globalAlpha = 0.5; flames(ctx, W, H, ['#0a1f7a', '#1f4fd9', '#6fd3ff'], H * 0.12, true, 9); ctx.restore();
    },
    overAvatar: (ctx, cx, top, scale) => {
      ctx.save(); ctx.shadowColor = '#6fd3ff'; ctx.shadowBlur = 30;
      crown(ctx, cx, top - scale * 4, scale * 0.55, '#ffd166', '#1f4fd9', ['#6fd3ff', '#ffffff', '#6fd3ff']);
      ctx.restore();
    },
    border: (ctx, x0, y0, w, h) => {
      glowBox(ctx, x0, y0, w, h, '#6fd3ff', 26, 5);
      glowBox(ctx, x0, y0, w, h, '#ffd166', 10, 2, 11);
      corners(ctx, x0, y0, w, h, '#ffd166', 18);
      ctx.fillStyle = '#9fe7ff'; for (const [x, y] of [[x0 + 2, y0 + 2], [x0 + w - 8, y0 + 2], [x0 + 2, y0 + h - 8], [x0 + w - 8, y0 + h - 8]]) ctx.fillRect(x, y, 6, 6);
    },
  },
};

const FINISHED_THEMES = Object.fromEntries(Object.entries(CARD_THEMES).map(([id, theme]) => [id, {
  ...theme,
  border: (ctx: Ctx, x: number, y: number, w: number, h: number) => {
    ctx.save();
    theme.border(ctx, x, y, w, h);
    cardFrameFinish(ctx, id as FrameId, x, y, w, h, theme.accent, theme.accent2);
    ctx.restore();
  },
}])) as Record<FrameId, CardTheme>;

export const cardTheme = (frame: FrameId | undefined): CardTheme => FINISHED_THEMES[frame ?? 'classic'] ?? FINISHED_THEMES.classic;
