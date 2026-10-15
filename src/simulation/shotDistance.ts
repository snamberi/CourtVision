import type { RNG } from './engine/rng';

/*
 * Shot distance. The engine picks a shot type (dunk, hook, corner three…); this turns it into feet from the basket for
 * the shooting-by-distance splits (3 ft, 12 ft, 15 ft, 25 ft, 35 ft…). It is drawn from its own random stream, so it
 * never changes how a game plays out.
 */

/** Distance bands for the splits: [label, short label, from feet (inclusive)]. Threes start at the three-point line. */
export const SHOT_BANDS = [
  { id: 'rim', label: 'At the rim (0-3 ft)', short: '0-3 ft' },
  { id: 'short', label: 'Short (3-10 ft)', short: '3-10 ft' },
  { id: 'mid', label: 'Mid-range (10-16 ft)', short: '10-16 ft' },
  { id: 'long2', label: 'Long two (16 ft to the line)', short: '16 ft-3PT' },
  { id: 'three', label: 'Three (the line to 27 ft)', short: '3PT-27 ft' },
  { id: 'deep', label: 'Deep (28 ft and beyond)', short: '28+ ft' },
] as const;
export const BAND_COUNT = SHOT_BANDS.length;
export const DEEP_FROM = 28;

/** Which band a shot falls in. A three is always at least the "three" band, a two never more than "long two". */
export function bandOf(feet: number, isThree: boolean): number {
  if (isThree) return feet >= DEEP_FROM ? 5 : 4;
  return feet < 3 ? 0 : feet < 10 ? 1 : feet < 16 ? 2 : 3;
}

const THREES = new Set(['corner3', 'aboveBreak3', 'pullUp3', 'catchAndShoot3', 'stepback']);
export const isThreeType = (type: string) => THREES.has(type);

/** Feet from the basket for a shot of this type. `line` is the era's three-point distance (0 = no line: today's is used
 *  for placing long shots); `deep` is a four-point try; `buzzer` a last-second heave at the end of a period. */
export function shotFeet(type: string, rng: RNG, opts: { line?: number; deep?: boolean; buzzer?: boolean } = {}): number {
  const line = opts.line && opts.line > 0 ? opts.line : 23.75;
  const r = (lo: number, hi: number) => Math.round((lo + rng.next() * (hi - lo)) * 10) / 10;
  if (THREES.has(type)) {
    if (opts.deep) return r(line + 4.5, line + 10);
    if (opts.buzzer) return r(line + 1, line + 14);
    if (type === 'corner3') return r(22, 23.5);
    const long = rng.next() < (type === 'pullUp3' ? 0.16 : type === 'stepback' ? 0.12 : 0.08);
    return long ? r(line + 3, line + 8) : r(line, line + (type === 'pullUp3' ? 3.5 : 2.5));
  }
  switch (type) {
    case 'dunk': return r(0, 2);
    case 'layup': case 'rim': return r(0.5, 3);
    case 'close': return r(3, 8);
    case 'hook': return r(4, 10);
    case 'postShot': return r(5, 12);
    case 'midrange': return r(10, 16);
    case 'fadeaway': return r(10, 18);
    case 'longMidrange': return r(16, Math.max(17, Math.min(line, 23.5) - 0.5));
    default: return r(8, 16);
  }
}
