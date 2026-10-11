/* The spots on the lineup board (CourtLineup) and which player goes where. */

export const FIVE_SPOTS = ['PG', 'SG', 'SF', 'PF', 'C'] as const;
export const THREE_SPOTS = ['G', 'F', 'C'] as const;
const FIT: Record<string, string[]> = {
  PG: ['PG', 'SG', 'SF'], SG: ['SG', 'PG', 'SF'], SF: ['SF', 'SG', 'PF'], PF: ['PF', 'SF', 'C'], C: ['C', 'PF', 'SF'],
  G: ['PG', 'SG', 'SF'], F: ['SF', 'PF', 'SG'], 'G-F': ['SG', 'SF', 'PG'], 'F-G': ['SF', 'SG', 'PF'], 'F-C': ['PF', 'C', 'SF'], 'C-F': ['C', 'PF', 'SF'],
};
const SHORT: Record<string, string> = { PG: 'G', SG: 'G', SF: 'F', PF: 'F', C: 'C' };
/** Each player to a spot (in pick order): his best open fit, else the first open spot. */
export function assignToSpots<T extends { pos?: string }>(players: T[], spots: readonly string[]): (T | undefined)[] {
  const out: (T | undefined)[] = spots.map(() => undefined);
  for (const p of players.slice(0, spots.length)) {
    const pos = (p.pos ?? '').toUpperCase();
    // Three-spot courts (G, F, C) read the five positions as guard, wing and big.
    const prefs = [...(FIT[pos] ?? []), ...(FIT[pos] ?? [pos]).map(x => SHORT[x] ?? x)];
    const i = [...prefs.map(s => spots.indexOf(s)), ...spots.map((_, k) => k)].find(k => k >= 0 && !out[k]);
    if (i != null) out[i] = p;
  }
  return out;
}
