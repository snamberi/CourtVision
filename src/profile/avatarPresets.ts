import { cleanAvatar, type AvatarLook } from './avatar';

export interface AvatarPreset { name: string; look: AvatarLook }
export const AVATAR_PRESETS_KEY = 'cv-avatar-presets-v1';
export function readAvatarPresets(): (AvatarPreset | null)[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(AVATAR_PRESETS_KEY) ?? '[]');
    return Array.from({ length: 3 }, (_, i) => {
      const value = Array.isArray(raw) ? raw[i] : null;
      return value && typeof value.name === 'string' && value.look && typeof value.look === 'object'
        ? { name: value.name.slice(0, 28), look: cleanAvatar(value.look) } : null;
    });
  } catch { return [null, null, null]; }
}
export function writeAvatarPresets(slots: (AvatarPreset | null)[]): boolean {
  try { localStorage.setItem(AVATAR_PRESETS_KEY, JSON.stringify(slots.slice(0, 3))); return true; }
  catch { return false; }
}
