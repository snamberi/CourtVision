/** A curated set of good-looking primary/secondary jersey color pairs, cycled deterministically by team ID hash. Not tied to real team names/branding — this app has none — just gives every team a stable, distinct kit. */
const TEAM_PALETTE: [primary: string, secondary: string][] = [
  ['#c8102e', '#1d1160'], // red / purple
  ['#1d428a', '#c8102e'], // blue / red
  ['#007a33', '#000000'], // green / black
  ['#f58426', '#002d62'], // orange / navy
  ['#552583', '#fdb927'], // purple / gold
  ['#ce1141', '#000000'], // crimson / black
  ['#006bb6', '#ed174c'], // blue / pink-red
  ['#0c2340', '#c4ced4'], // navy / silver
  ['#00471b', '#eee1c6'], // dark green / cream
  ['#e56020', '#1d1160'], // burnt orange / purple
  ['#860038', '#fdb927'], // maroon / gold
  ['#5a2d81', '#63727a'], // violet / gray
  ['#0e2240', '#a6192e'], // navy / red
  ['#1a5b3f', '#f9a01b'], // forest / amber
  ['#8a1538', '#0d1b2a'], // wine / near-black
  ['#217a4b', '#d0b48c'], // pine / tan
  ['#c4122e', '#7a7a7a'], // scarlet / gray
  ['#003da5', '#f2a900'], // royal blue / gold
];

function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface TeamColors {
  primary: string;
  secondary: string;
}

/** Deterministic — the same teamId always yields the same kit colors, with no state to store or generate ahead of time. */
export function teamColors(teamId: string | null | undefined): TeamColors {
  if (!teamId) return { primary: '#4a5160', secondary: '#c9ccd1' }; // free agents / unassigned: neutral gray kit
  const idx = hashString(teamId) % TEAM_PALETTE.length;
  const [primary, secondary] = TEAM_PALETTE[idx];
  return { primary, secondary };
}
