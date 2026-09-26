/* Number formatting that never prints "NaN": unrecorded values (imported historical seasons) read "—". */
export const NA = '—';
export const isNum = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);
export const fx = (v: number | null | undefined, digits = 1) => (isNum(v) ? v.toFixed(digits) : NA);
export const fpct = (v: number | null | undefined, digits = 1) => (isNum(v) ? (v * 100).toFixed(digits) : NA);
/** Sum of the finite values (unrecorded ones are skipped, not counted as zero). */
export const finiteSum = (values: (number | null | undefined)[]) => values.reduce<number>((n, v) => n + (isNum(v) ? v : 0), 0);
