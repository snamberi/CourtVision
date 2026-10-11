import { useEffect, useRef, useState } from 'react';
import './fx.css';

/*
 * Small shared effects: pixel sparks and confetti bursts on one overlay canvas, a screen shake, and a count-up number.
 * All of them do nothing (or jump straight to the end) for players who ask for reduced motion or run Lite graphics.
 */

const reduced = () => typeof window === 'undefined' || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('lite');

interface Bit { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; spin: number }
let canvas: HTMLCanvasElement | null = null, bits: Bit[] = [], frame = 0;

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
  return ctx;
}

function loop() {
  const ctx = ensureCanvas();
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  bits = bits.filter(b => b.life < b.max);
  for (const b of bits) {
    b.life++; b.x += b.vx; b.y += b.vy; b.vy += 0.18; b.vx *= 0.985;
    ctx.globalAlpha = Math.max(0, 1 - b.life / b.max);
    ctx.fillStyle = b.color;
    // Pixel bits: squares that flip between wide and tall as they "spin".
    const w = Math.max(1, Math.round(b.size * Math.abs(Math.cos(b.life * b.spin)))), hgt = Math.round(b.size);
    ctx.fillRect(Math.round(b.x - w / 2), Math.round(b.y - hgt / 2), w, hgt);
  }
  ctx.globalAlpha = 1;
  frame = bits.length ? requestAnimationFrame(loop) : 0;
  if (!bits.length) ctx.clearRect(0, 0, innerWidth, innerHeight);
}

export interface BurstOptions { colors?: string[]; count?: number; power?: number; kind?: 'sparks' | 'confetti' }
/** A burst of pixel bits from a point on screen (or from the middle of an element). */
export function burst(at: { x: number; y: number } | Element | null | undefined, opts: BurstOptions = {}): void {
  if (!at || reduced() || typeof document === 'undefined') return;
  const p = at instanceof Element ? (() => { const r = at.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })() : at;
  const { colors = ['#ffd166', '#f47b20', '#f4f0e6'], kind = 'sparks' } = opts;
  const count = Math.min(160, opts.count ?? (kind === 'confetti' ? 90 : 26)), power = opts.power ?? (kind === 'confetti' ? 9 : 5);
  for (let i = 0; i < count; i++) {
    const a = kind === 'confetti' ? -Math.PI / 2 + (Math.random() - 0.5) * 2.2 : Math.random() * Math.PI * 2;
    const v = power * (0.4 + Math.random() * 0.8);
    bits.push({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (kind === 'confetti' ? 2 : 1), life: 0, max: kind === 'confetti' ? 70 + Math.random() * 50 : 26 + Math.random() * 18,
      size: kind === 'confetti' ? 4 + Math.random() * 3 : 2 + Math.random() * 2, color: colors[i % colors.length], spin: 0.1 + Math.random() * 0.3 });
  }
  if (!frame) frame = requestAnimationFrame(loop);
}

/** Confetti across the top of the screen: a title, a perfect season, a tournament win. */
export function celebrate(colors?: string[]): void {
  if (typeof window === 'undefined') return;
  for (let i = 0; i < 3; i++) burst({ x: innerWidth * (0.2 + i * 0.3), y: innerHeight * 0.25 }, { kind: 'confetti', colors, count: 60 });
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
