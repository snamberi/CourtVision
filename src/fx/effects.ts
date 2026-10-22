import { useEffect, useRef, useState } from 'react';
import './fx.css';

/*
 * Small shared effects on one overlay canvas: pixel sparks with a shockwave ring, fluttering confetti and streamers,
 * rising text, plus a screen shake and a count-up number.
 * All of them do nothing (or jump straight to the end) for players who ask for reduced motion or run Lite graphics.
 */

const reduced = () => typeof window === 'undefined' || !!(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('reduce-motion')) || document.documentElement.classList.contains('lite');

interface Bit { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; spin: number; kind: 'spark' | 'confetti' | 'streamer'; sway: number; delay: number }
/** A shockwave: a stepped pixel ring that grows and fades around a burst. */
interface Ring { x: number; y: number; life: number; max: number; reach: number; color: string; delay: number }
/** Rising text ("+50 XP", "+3"): drawn in the pixel font face, nearest-pixel positions. */
interface Float { x: number; y: number; life: number; max: number; text: string; color: string }
let canvas: HTMLCanvasElement | null = null, bits: Bit[] = [], rings: Ring[] = [], floats: Float[] = [], frame = 0;

function ensureCanvas(): CanvasRenderingContext2D | null {
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'fx-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
  }
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== innerWidth * dpr || canvas.height !== innerHeight * dpr) { canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr; }
  const ctx = canvas.getContext('2d');
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (ctx) ctx.imageSmoothingEnabled = false;
  return ctx;
}

/** Darkens a #rrggbb colour: the back face of a confetti piece as it flips. */
function shadeOf(hex: string): string {
  const m = /^#?([\da-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16), k = 0.62;
  return `rgb(${Math.round((n >> 16) * k)},${Math.round(((n >> 8) & 255) * k)},${Math.round((n & 255) * k)})`;
}

function loop() {
  const ctx = ensureCanvas();
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  bits = bits.filter(b => b.life < b.max);
  rings = rings.filter(r => r.life < r.max);
  floats = floats.filter(f => f.life < f.max);
  for (const r of rings) {
    if (r.delay > 0) { r.delay--; continue; }
    r.life++;
    const k = r.life / r.max, rad = Math.round(r.reach * (1 - (1 - k) ** 3)), step = 3;
    ctx.globalAlpha = Math.max(0, 1 - k) * 0.9;
    ctx.fillStyle = r.color;
    // Stepped ring: square pixels around the circle, thinner as it fades.
    const px = Math.max(1, Math.round(4 * (1 - k)));
    for (let a = 0; a < Math.PI * 2; a += step / Math.max(8, rad)) ctx.fillRect(Math.round(r.x + Math.cos(a) * rad), Math.round(r.y + Math.sin(a) * rad), px, px);
  }
  for (const b of bits) {
    if (b.delay > 0) { b.delay--; continue; }
    b.life++;
    if (b.kind === 'spark') { b.vy += 0.16; b.vx *= 0.94; b.vy *= 0.94; }
    else {
      // Paper flutters: strong air drag, a slow terminal velocity and a side-to-side sway.
      b.vy = Math.min(b.vy + 0.12, b.kind === 'streamer' ? 2.6 : 1.9); b.vx *= 0.97;
      b.x += Math.sin(b.life * 0.09 + b.sway) * 0.9;
    }
    b.x += b.vx; b.y += b.vy;
    const fade = b.kind === 'spark' ? 1 - b.life / b.max : Math.min(1, (b.max - b.life) / 24);
    ctx.globalAlpha = Math.max(0, fade);
    const flip = Math.cos(b.life * b.spin);
    ctx.fillStyle = b.kind === 'spark' || flip > 0 ? b.color : shadeOf(b.color);
    const w = b.kind === 'streamer' ? 2 : Math.max(1, Math.round(b.size * Math.abs(flip)));
    const hgt = b.kind === 'streamer' ? Math.round(b.size * 2.4 * (0.4 + Math.abs(Math.sin(b.life * b.spin)) * 0.6)) : Math.round(b.size);
    ctx.fillRect(Math.round(b.x - w / 2), Math.round(b.y - hgt / 2), w, hgt);
    // Sparks keep a bright core for their first frames.
    if (b.kind === 'spark' && b.life < 6) { ctx.fillStyle = '#fff8e6'; ctx.fillRect(Math.round(b.x - 1), Math.round(b.y - 1), 2, 2); }
  }
  for (const f of floats) {
    f.life++;
    const k = f.life / f.max, rise = Math.round(28 * (1 - (1 - k) ** 2));
    ctx.globalAlpha = k < 0.7 ? 1 : Math.max(0, 1 - (k - 0.7) / 0.3);
    ctx.font = "16px 'Press Start 2P', monospace";
    ctx.textAlign = 'center';
    ctx.fillStyle = '#050a12';
    ctx.fillText(f.text, Math.round(f.x) + 2, Math.round(f.y - rise) + 2);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, Math.round(f.x), Math.round(f.y - rise));
  }
  ctx.globalAlpha = 1;
  const busy = bits.length || rings.length || floats.length;
  frame = busy ? requestAnimationFrame(loop) : 0;
  if (!busy) ctx.clearRect(0, 0, innerWidth, innerHeight);
}

const pointOf = (at: { x: number; y: number } | Element) => at instanceof Element ? (() => { const r = at.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })() : at;

export interface BurstOptions { colors?: string[]; count?: number; power?: number; kind?: 'sparks' | 'confetti'; /** Spread angle in radians around `direction` (confetti cannons). */ spread?: number; direction?: number; /** Frames to wait before it fires. */ delay?: number; /** A shockwave ring with the sparks (default on). */ ring?: boolean }
/** A burst of pixel bits from a point on screen (or from the middle of an element). */
export function burst(at: { x: number; y: number } | Element | null | undefined, opts: BurstOptions = {}): void {
  if (!at || reduced() || typeof document === 'undefined') return;
  const p = pointOf(at);
  const { colors = ['#ffd166', '#f47b20', '#f4f0e6'], kind = 'sparks', delay = 0 } = opts;
  const count = Math.min(160, opts.count ?? (kind === 'confetti' ? 90 : 26)), power = opts.power ?? (kind === 'confetti' ? 9 : 5);
  const dir = opts.direction ?? -Math.PI / 2, spread = opts.spread ?? 2.2;
  for (let i = 0; i < count; i++) {
    const a = kind === 'confetti' ? dir + (Math.random() - 0.5) * spread : Math.random() * Math.PI * 2;
    const v = power * (0.45 + Math.random() * 0.75);
    const piece = kind === 'sparks' ? 'spark' : i % 5 === 0 ? 'streamer' : 'confetti';
    bits.push({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (kind === 'confetti' ? 2 : 1), life: 0,
      max: kind === 'confetti' ? 110 + Math.random() * 70 : 24 + Math.random() * 18,
      size: kind === 'confetti' ? 4 + Math.random() * 3 : 2 + Math.random() * 2, color: colors[i % colors.length], spin: 0.08 + Math.random() * 0.25,
      kind: piece, sway: Math.random() * Math.PI * 2, delay: delay + (kind === 'confetti' ? Math.floor(Math.random() * 4) : 0) });
  }
  if (kind === 'sparks' && opts.ring !== false) rings.push({ x: p.x, y: p.y, life: 0, max: 22, reach: 18 + power * 6, color: colors[0], delay });
  if (!frame) frame = requestAnimationFrame(loop);
}

/** Confetti for a title, a perfect season or a tournament win: cannons from both lower corners, then a shower from the top. */
export function celebrate(colors?: string[]): void {
  if (typeof window === 'undefined') return;
  const c = colors ?? ['#ffd166', '#f47b20', '#f4f0e6', '#4da3ff', '#55c878'];
  burst({ x: 0, y: innerHeight * 0.92 }, { kind: 'confetti', colors: c, count: 70, power: 17, direction: -Math.PI / 3.2, spread: 0.7 });
  burst({ x: innerWidth, y: innerHeight * 0.92 }, { kind: 'confetti', colors: c, count: 70, power: 17, direction: -Math.PI + Math.PI / 3.2, spread: 0.7, delay: 8 });
  for (let i = 0; i < 4; i++) burst({ x: innerWidth * (0.15 + i * 0.233), y: -10 }, { kind: 'confetti', colors: c, count: 28, power: 3, direction: Math.PI / 2, spread: 1.4, delay: 26 + i * 6 });
}

/** Text that rises and fades from a point or an element: "+50 XP", "+3", "LEVEL UP". */
export function floatText(at: { x: number; y: number } | Element | null | undefined, text: string, color = '#ffd166'): void {
  if (!at || reduced() || typeof document === 'undefined') return;
  const p = pointOf(at);
  floats.push({ x: p.x, y: p.y, life: 0, max: 54, text, color });
  if (!frame) frame = requestAnimationFrame(loop);
}

/** A short shake of an element (a big hit, a buzzer-beater, a Star landing). */
export function shake(el: Element | null | undefined, strength: 'small' | 'big' = 'small'): void {
  if (!el || reduced()) return;
  el.classList.remove('fx-shake', 'fx-shake-big');
  void (el as HTMLElement).offsetWidth;
  el.classList.add(strength === 'big' ? 'fx-shake-big' : 'fx-shake');
  window.setTimeout(() => el.classList.remove('fx-shake', 'fx-shake-big'), 500);
}

/** A number that counts up to its value (scores and coins), in about `ms`. */
export function useCountUp(value: number, ms = 900): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (reduced() || start === value) { from.current = value; setShown(value); return; }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms), eased = 1 - (1 - k) ** 3;
      setShown(Math.round(start + (value - start) * eased));
      if (k < 1) raf = requestAnimationFrame(step); else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); from.current = value; };
  }, [value, ms]);
  return shown;
}
