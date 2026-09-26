export function humanize(key: string): string {
  const spaced = key.replace(/([A-Z])/g, ' $1');
  const withAcronyms = spaced.replace(/\b3 Pt\b/i, '3PT').replace(/\bIq\b/gi, 'IQ');
  return withAcronyms.charAt(0).toUpperCase() + withAcronyms.slice(1);
}
