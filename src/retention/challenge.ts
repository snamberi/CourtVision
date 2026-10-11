/*
 * Challenge settings shared by the run modes: a difficulty (Rookie, Pro, Legend) and two view options for the spins,
 * showing the ratings and showing the rarity colours. The defaults are the standard game (Pro, ratings hidden,
 * colours on); the Daily and weekly runs always use them, so the boards stay fair.
 */

export type Level = 'rookie' | 'pro' | 'legend';
export const LEVELS: Level[] = ['rookie', 'pro', 'legend'];
export const LEVEL_NAME: Record<Level, string> = { rookie: 'Rookie', pro: 'Pro', legend: 'Legend' };
export interface RunView { numbers: boolean; colors: boolean }
export const STANDARD_VIEW: RunView = { numbers: false, colors: true };
export const isLevel = (x: unknown): x is Level => x === 'rookie' || x === 'pro' || x === 'legend';

/** Score multiplier for a self-imposed challenge (82-0): harder levels, hidden colours and hidden ratings pay more. */
export function challengeMultiplier(level: Level = 'pro', view: RunView = STANDARD_VIEW): number {
  const l = level === 'rookie' ? 0.8 : level === 'legend' ? 1.25 : 1;
  const v = (view.numbers ? 0.9 : 1) * (view.colors ? 1 : 1.1);
  return Math.round(l * v * 100) / 100;
}

const KEY = 'cv-challenge-prefs';
type Prefs = Partial<Record<string, { level?: Level; view?: RunView }>>;
const read = (): Prefs => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Prefs; } catch { return {}; } };
/** The last settings chosen in a mode (remembered on this device). */
export function challengePrefs(mode: string): { level: Level; view: RunView } {
  const all = read(), p = all[mode], d = all.default?.level;
  return { level: isLevel(p?.level) ? p!.level! : isLevel(d) ? d : 'pro', view: { ...STANDARD_VIEW, ...(p?.view ?? {}) } };
}
export function saveChallengePrefs(mode: string, prefs: { level?: Level; view?: RunView }): void {
  const all = read();
  try { localStorage.setItem(KEY, JSON.stringify({ ...all, [mode]: { ...all[mode], ...prefs } })); } catch { /* storage blocked */ }
}

/** Settings > Default difficulty: what every mode starts on. Setting it also resets each mode's remembered level. */
export const defaultLevel = (): Level => { const d = read().default?.level; return isLevel(d) ? d : 'pro'; };
export function setDefaultLevel(level: Level): void {
  const all = read();
  const next: Prefs = Object.fromEntries(Object.entries(all).map(([k, v]) => [k, { ...v, level }]));
  next.default = { ...all.default, level };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
}
