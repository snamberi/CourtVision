/* Number formatting that never prints "NaN": unrecorded values (imported historical seasons) read "—". */
export const NA = '—';
export const isNum = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);
export const fx = (v: number | null | undefined, digits = 1) => (isNum(v) ? v.toFixed(digits) : NA);
export const fpct = (v: number | null | undefined, digits = 1) => (isNum(v) ? (v * 100).toFixed(digits) : NA);
/** Sum of the finite values (unrecorded ones are skipped, not counted as zero). */
export const finiteSum = (values: (number | null | undefined)[]) => values.reduce<number>((n, v) => n + (isNum(v) ? v : 0), 0);

/*
 * Player stats are shown with one decimal (23.4 points a game, 47.3% shooting), never more. Ratings and attributes
 * are whole numbers. Only the display rounds; every stat is kept and computed at full precision.
 */
/** A per-game number: 23.44 → "23.4". */
export const stat1 = (v: number) => v.toFixed(1);
/** A per-game number from a total and games: 410 points in 18 games → "22.8". */
export const per1 = (total: number, games: number) => (games ? (total / games).toFixed(1) : '0.0');
/** A percentage from a 0-1 share: 0.4733 → "47.3". */
export const pct1 = (share: number) => (share * 100).toFixed(1);
