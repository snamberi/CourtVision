import { AVATAR_CATEGORIES, DEFAULT_AVATAR, cleanAvatar, type AvatarCategory, type AvatarLook } from './avatar';
import { AVATAR_FRAMES, type AvatarFrameId } from './avatarFrames';
import { REAL_FRANCHISES } from './favorites';

/*
 * A character as a short code, for the database and for links: "1." then one base-36 number per category (each
 * piece's place in its list), the jersey team and number, and the profile-picture frame. About 25 characters.
 *
 *   1.3.k.0.2.1m.0.0.0.0.0.0.0.0
 *   v skin hair hairColour beard outfit hat eyes neck shoes aura kitTeam kitNumber frame
 *
 * Every list (the pieces, REAL_FRANCHISES, AVATAR_FRAMES) is append-only: a piece's place is its code, so reordering
 * or removing one would change everyone's saved character. src/tests/avatarCode.test.ts guards this.
 */

export const AVATAR_CODE_VERSION = '1';
const ORDER: AvatarCategory[] = ['skin', 'hair', 'hairColor', 'beard', 'outfit', 'hat', 'eyes', 'neck', 'shoes', 'aura'];
export const AVATAR_CODE_MAX = 64;

export function encodeAvatar(look: AvatarLook, frame: string = 'none'): string {
  const parts = ORDER.map(cat => Math.max(0, AVATAR_CATEGORIES.find(c => c.id === cat)!.items.findIndex(i => i.id === look[cat])).toString(36));
  const team = look.kitTeam ? REAL_FRANCHISES.findIndex(t => t.id === look.kitTeam) + 1 : 0;
  const number = look.kitNumber != null ? look.kitNumber + 1 : 0;
  const f = Math.max(0, AVATAR_FRAMES.findIndex(x => x.id === frame));
  return [AVATAR_CODE_VERSION, ...parts, team.toString(36), number.toString(36), f.toString(36)].join('.');
}

/** A code back to a character and frame; null when it isn't one. Unknown pieces fall back to the defaults. */
export function decodeAvatar(code: string | null | undefined): { look: AvatarLook; frame: AvatarFrameId } | null {
  if (typeof code !== 'string' || code.length > AVATAR_CODE_MAX || !/^[0-9a-z.]+$/.test(code)) return null;
  const [v, ...rest] = code.split('.');
  if (v !== AVATAR_CODE_VERSION || rest.length < ORDER.length) return null;
  const n = (s: string | undefined) => (s && /^[0-9a-z]+$/.test(s) ? parseInt(s, 36) : 0);
  const raw: Partial<AvatarLook> = {};
  ORDER.forEach((cat, i) => { raw[cat] = AVATAR_CATEGORIES.find(c => c.id === cat)!.items[n(rest[i])]?.id ?? DEFAULT_AVATAR[cat]; });
  const team = n(rest[ORDER.length]), number = n(rest[ORDER.length + 1]);
  if (team > 0 && REAL_FRANCHISES[team - 1]) raw.kitTeam = REAL_FRANCHISES[team - 1].id;
  if (number > 0) raw.kitNumber = number - 1;
  const frame = AVATAR_FRAMES[n(rest[ORDER.length + 2])]?.id ?? 'none';
  return { look: cleanAvatar(raw), frame };
}
