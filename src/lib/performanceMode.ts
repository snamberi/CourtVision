/*
 * Lite mode for low-end phones: stops looping decorative animations and background blur, and runs the season
 * simulation on at most two extra workers (each engine worker holds its own copy of the league). "Auto" turns it on
 * for devices that report little memory or few cores, or ask to save data. The choice is kept in this browser.
 */
export type PerformanceSetting = 'auto' | 'lite' | 'full';
const KEY = 'cv-performance';
export const LITE_ENGINE_WORKERS = 2;

type Nav = { deviceMemory?: number; hardwareConcurrency?: number; connection?: { saveData?: boolean } };

export function isLowEndDevice(nav: Nav | undefined = typeof navigator !== 'undefined' ? navigator as Nav : undefined): boolean {
  if (!nav) return false;
  return (nav.deviceMemory != null && nav.deviceMemory <= 3) || (nav.hardwareConcurrency != null && nav.hardwareConcurrency <= 2) || !!nav.connection?.saveData;
}

export function performanceSetting(): PerformanceSetting {
  try { const v = localStorage.getItem(KEY); return v === 'lite' || v === 'full' ? v : 'auto'; } catch { return 'auto'; }
}

export function liteMode(setting = performanceSetting(), nav?: Nav): boolean {
  return setting === 'lite' || (setting === 'auto' && isLowEndDevice(nav));
}

export function applyPerformanceMode(): void {
  if (typeof document !== 'undefined') document.documentElement.classList.toggle('lite', liteMode());
}

export function setPerformanceSetting(v: PerformanceSetting): void {
  try { if (v === 'auto') localStorage.removeItem(KEY); else localStorage.setItem(KEY, v); } catch { /* storage blocked */ }
  applyPerformanceMode();
}
