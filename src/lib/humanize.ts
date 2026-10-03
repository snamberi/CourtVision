export function humanize(key: string): string {
  const spaced = key.replace(/([A-Z])/g, ' $1');
  const withAcronyms = spaced.replace(/\b3 Pt\b/i, '3PT').replace(/\bIq\b/gi, 'IQ');
  return withAcronyms.charAt(0).toUpperCase() + withAcronyms.slice(1);
}

/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 21st, 22nd. */
export function ordinal(n: number): string {
  const v = n % 100;
  return `${n}${v >= 11 && v <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

/** "1 season", "3 seasons". */
export const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

/** $20.84M, $950k. */
export function shortMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  return `$${Math.round(n / 1000)}k`;
}
