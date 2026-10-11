/*
 * Accessibility options, kept in this browser: bigger text (the whole game scales up) and colour-blind-safe rarity
 * colours (Okabe-Ito colours that stay apart for red-green and blue-yellow colour blindness). Both are classes on <html>.
 */
export type TextSize = 'normal' | 'large' | 'larger';
const TEXT_KEY = 'cv-text-size';
const SAFE_KEY = 'cv-colour-safe';

export function textSize(): TextSize {
  try { const v = localStorage.getItem(TEXT_KEY); return v === 'large' || v === 'larger' ? v : 'normal'; } catch { return 'normal'; }
}

export function colourSafe(): boolean {
  try { return localStorage.getItem(SAFE_KEY) === '1'; } catch { return false; }
}

export function applyAccessibility(): void {
  if (typeof document === 'undefined') return;
  const html = document.documentElement, size = textSize();
  html.classList.toggle('text-large', size === 'large');
  html.classList.toggle('text-larger', size === 'larger');
  html.classList.toggle('cb-safe', colourSafe());
}

export function setTextSize(v: TextSize): void {
  try { if (v === 'normal') localStorage.removeItem(TEXT_KEY); else localStorage.setItem(TEXT_KEY, v); } catch { /* storage blocked */ }
  applyAccessibility();
}

export function setColourSafe(on: boolean): void {
  try { if (on) localStorage.setItem(SAFE_KEY, '1'); else localStorage.removeItem(SAFE_KEY); } catch { /* storage blocked */ }
  applyAccessibility();
}
