import { localRead, type Read } from '../lib/kv';
import type { ReleaseSecretId } from './releaseSecrets';
/** Lightweight lookup for simulation modules, without the cosmetics dependency graph. */
export function ownsReleaseSecret(id: ReleaseSecretId, read: Read = localRead): boolean {
  try { const value = JSON.parse(read('cv-relics') ?? 'null'); return value?.v === 1 && Array.isArray(value.secrets) && value.secrets.includes(id); }
  catch { return false; }
}
