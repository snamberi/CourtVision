/**
 * Normalizes a player name for MATCHING purposes only (never for display).
 * Strips accents, suffixes (Jr./Sr./II/III/IV), punctuation, and casing so
 * "Jr, John" / "John Jr." / "JOHN JR" / "Jóhn Jr." all match as one identity.
 */
const SUFFIXES = ['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v'];

export function normalizeNameForMatching(rawName: string): string {
  const stripped = rawName
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .toLowerCase()
    .replace(/[.,']/g, '')
    .trim();

  const parts = stripped.split(/\s+/).filter(Boolean);
  const withoutSuffix = parts.filter((p) => !SUFFIXES.includes(p));
  return withoutSuffix.join(' ');
}

/** Two raw name strings are considered the same player identity for import-matching purposes. */
export function namesMatch(a: string, b: string): boolean {
  return normalizeNameForMatching(a) === normalizeNameForMatching(b);
}

/**
 * Finds an existing canonical player id for `rawName` among `existing` (map of
 * canonical id -> display name), or returns null if no match is found so the
 * caller can create a new canonical record.
 */
export function findExistingPlayerId(rawName: string, existing: Record<string, string>): string | null {
  const target = normalizeNameForMatching(rawName);
  for (const [id, name] of Object.entries(existing)) {
    if (normalizeNameForMatching(name) === target) return id;
  }
  return null;
}

export function slugifyName(rawName: string): string {
  return normalizeNameForMatching(rawName).replace(/\s+/g, '-');
}
