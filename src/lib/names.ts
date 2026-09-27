/* Names shown to other players: usernames (checked by the database too) and created players' names. */

const BLOCKED = ['fuck', 'shit', 'cunt', 'nigg', 'fag', 'bitch', 'whore', 'rape', 'nazi', 'hitler', 'slut', 'retard', 'penis', 'vagina', 'porn'];
export const isClean = (s: string) => { const flat = s.toLowerCase().replace(/[^a-z]/g, ''); return !BLOCKED.some(w => flat.includes(w)); };

/** Usernames: 3-18 letters, digits or underscores (the database enforces the same pattern). */
export function usernameProblem(raw: string): string | null {
  const u = raw.trim();
  if (!/^[A-Za-z0-9_]{3,18}$/.test(u)) return 'Use 3-18 letters, numbers or underscores.';
  if (!isClean(u)) return 'Pick a different name.';
  return null;
}

/** A created player's name for the public boards: letters, digits, spaces and . \' - (2-24), or null. */
export function cleanName(raw: unknown, max = 24): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._'-]*$/u.test(name) || name.length < 2 || name.length > max) return null;
  return isClean(name) ? name : null;
}
