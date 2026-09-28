import { earnedModeAchievements, MODE_ACHIEVEMENT_BY_ID, type ModeAchievement } from './modeAchievements';

/** The mode achievements this device has already announced (so each unlock is announced once). */
const SEEN_KEY = 'cv-mode-ach-seen';

/**
 * Newly earned mode achievements since the last check. `first` is true the first time this device checks: whatever was
 * earned before (progress from before achievements existed, or synced from another device) is announced as one note.
 */
export function takeModeUnlocks(): { fresh: ModeAchievement[]; first: boolean } {
  let seen: string[] | null = null;
  try { seen = JSON.parse(localStorage.getItem(SEEN_KEY) ?? 'null') as string[] | null; } catch { seen = null; }
  const earned = earnedModeAchievements();
  const fresh = earned.filter(id => !seen?.includes(id));
  if (seen && !fresh.length) return { fresh: [], first: false };
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set([...(seen ?? []), ...earned])])); } catch { return { fresh: [], first: false }; }
  return { fresh: fresh.map(id => MODE_ACHIEVEMENT_BY_ID.get(id)!).filter(Boolean), first: !seen };
}
