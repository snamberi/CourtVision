import { localRead, type Read } from '../lib/kv';
import { isClean } from '../lib/names';
import { REAL_FRANCHISES } from './favorites';

/*
 * What you choose to show on your public profile: one featured trophy (an achievement or a title), a short bio and
 * a banner behind your name (your clan's flag or a team's colours). Kept on this device, synced with the account;
 * /api/sync checks each piece (server/derive.ts) before it goes on the profile.
 */

export const PUBLIC_PROFILE_KEY = 'cv-profile-public';
export const PUBLIC_PROFILE_EVENT = 'courtvision:public-profile';
export const BIO_MAX = 80;

export type Banner = 'none' | 'clan' | `team:${string}`;
export interface PublicProfile {
  /** 'title:<name>', 'ach:<GM achievement id>' or 'mode:<mode achievement id>'. */
  featured?: string;
  bio?: string;
  banner?: Banner;
}

/** Why a bio can't be shown, or null when it can (an empty bio is fine). */
export function bioProblem(raw: string): string | null {
  const bio = raw.replace(/\s+/g, ' ').trim();
  if (!bio) return null;
  if (bio.length > BIO_MAX) return `Keep it to ${BIO_MAX} characters.`;
  if (/[\p{Cc}\p{Cf}<>]/u.test(bio)) return 'Use letters, numbers and everyday punctuation.';
  if (/https?:|www\.|\.(com|net|org|gg|io|ru|xyz)\b/i.test(bio)) return 'No links in your bio.';
  if (!isClean(bio)) return 'Pick different words.';
  return null;
}
/** The bio as it goes on the profile, or null for none. */
export function cleanBio(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const bio = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
  return bio && !bioProblem(bio) ? bio : null;
}

export const isTeamBanner = (b: string): b is `team:${string}` => b.startsWith('team:') && REAL_FRANCHISES.some(t => t.id === b.slice(5));
export const cleanBanner = (raw: unknown): Banner => (raw === 'clan' ? 'clan' : typeof raw === 'string' && isTeamBanner(raw) ? raw : 'none');
const cleanFeatured = (raw: unknown) => (typeof raw === 'string' && /^(title|ach|mode):.{1,60}$/.test(raw) ? raw : undefined);

export function readPublicProfile(read: Read = localRead): PublicProfile {
  try {
    const r = JSON.parse(read(PUBLIC_PROFILE_KEY) ?? '{}') as Record<string, unknown>;
    const out: PublicProfile = {};
    const featured = cleanFeatured(r.featured), bio = cleanBio(r.bio), banner = cleanBanner(r.banner);
    if (featured) out.featured = featured;
    if (bio) out.bio = bio;
    if (banner !== 'none') out.banner = banner;
    return out;
  } catch { return {}; }
}

export function setPublicProfile(patch: Partial<Record<keyof PublicProfile, string | undefined>>): void {
  const next: Record<string, unknown> = { ...readPublicProfile(), ...patch };
  for (const k of Object.keys(next)) if (next[k] == null || next[k] === '' || next[k] === 'none') delete next[k];
  try { localStorage.setItem(PUBLIC_PROFILE_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PUBLIC_PROFILE_EVENT));
}
