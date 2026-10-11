import { localRead, type Read } from '../lib/kv';

/** The Relic Shop cosmetics you own (their keys), read straight from the relic save so the cosmetic lists need no import of the vault. */
export function shopOwned(read: Read = localRead): string[] {
  try {
    const s = JSON.parse(read('cv-relics') ?? 'null') as { cosmetics?: unknown } | null;
    return Array.isArray(s?.cosmetics) ? s!.cosmetics.filter((k): k is string => typeof k === 'string') : [];
  } catch { return []; }
}
