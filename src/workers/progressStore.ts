/**
 * A value outside React state, read with useSyncExternalStore. Simulation progress arrives dozens of times a run;
 * keeping it here means only the Play button re-renders for it, not the whole game screen.
 */
export interface ProgressStore<T> {
  get: () => T | null;
  set: (value: T | null) => void;
  subscribe: (listener: () => void) => () => void;
}
export function createProgressStore<T>(): ProgressStore<T> {
  let value: T | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next) => { value = next; for (const listener of listeners) listener(); },
    subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}
