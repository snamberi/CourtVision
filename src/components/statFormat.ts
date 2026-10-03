/* Number formatting that never prints "NaN": unrecorded values (imported historical seasons) read "—". */
export const NA = '—';
export const isNum = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);
export const fx = (v: number | null | undefined, digits = 1) => (isNum(v) ? v.toFixed(digits) : NA);
export const fpct = (v: number | null | undefined, digits = 1) => (isNum(v) ? (v * 100).toFixed(digits) : NA);
/** Sum of the finite values (unrecorded ones are skipped, not counted as zero). */
export const finiteSum = (values: (number | null | undefined)[]) => values.reduce<number>((n, v) => n + (isNum(v) ? v : 0), 0);

/*
 * Player stats are shown as whole numbers (23 points a game, 47% shooting, a 68 rating), not decimals. Only the
 * display rounds; every stat is kept and computed at full precision.
 */
/** A per-game number or a rating: 23.4 → "23". */
export const statWhole = (v: number) => String(Math.round(v));
/** A per-game number from a total and games: 410 points in 18 games → "23". */
export const perWhole = (total: number, games: number) => (games ? String(Math.round(total / games)) : '0');
/** A percentage from a 0-1 share: 0.473 → "47". */
export const pctWhole = (share: number) => String(Math.round(share * 100));
