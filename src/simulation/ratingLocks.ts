import type { PlayerSeason } from './types';

/*
 * Locked ratings (Edit Player, Career Create Anything): single ratings that never change on their own. A lock is a
 * rating path, "group.field" (e.g. "offense.threePoint"); development, real development, summer camp and practice
 * leave it exactly where it was. The whole-player switch (`lockRatings`) still holds everything.
 */

type Group = keyof PlayerSeason['attributes'];
export const ratingAt = (p: Pick<PlayerSeason, 'attributes'>, path: string): number => {
  const [g, k] = path.split('.') as [Group, string];
  return (p.attributes[g] as unknown as Record<string, number> | undefined)?.[k] ?? 0;
};

export const isRatingLocked = (p: Pick<PlayerSeason, 'lockedRatings'>, path: string) => !!p.lockedRatings?.includes(path);

/** Turns locks on or off for `paths`; no locks left removes the field. */
export function setRatingLocks(p: PlayerSeason, paths: string[], locked: boolean): PlayerSeason {
  const set = new Set(p.lockedRatings ?? []);
  for (const path of paths) { if (locked) set.add(path); else set.delete(path); }
  const lockedRatings = [...set].sort();
  if (lockedRatings.length) return { ...p, lockedRatings };
  const { lockedRatings: _gone, ...rest } = p;
  return rest;
}

/** `after` with every rating `before` had locked put back to its value in `before` (the lock list carries over). */
export function keepLockedRatings(before: PlayerSeason, after: PlayerSeason): PlayerSeason {
  const locks = before.lockedRatings;
  if (!locks?.length) return after;
  const attributes = { physical: { ...after.attributes.physical }, offense: { ...after.attributes.offense }, defense: { ...after.attributes.defense }, mental: { ...after.attributes.mental } };
  for (const path of locks) {
    const [g, k] = path.split('.') as [Group, string];
    const from = (before.attributes[g] as unknown as Record<string, number> | undefined)?.[k];
    if (typeof from === 'number' && g in attributes) (attributes[g] as unknown as Record<string, number>)[k] = from;
  }
  return { ...after, attributes, lockedRatings: locks };
}
