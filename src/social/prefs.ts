/* CourtChat preferences in this browser: who you follow and who you muted, and what you've already seen. */
const read = (k: string): string[] => { try { const v = JSON.parse(localStorage.getItem(k) ?? '[]'); return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []; } catch { return []; } };
const write = (k: string, v: string[]) => { try { localStorage.setItem(k, JSON.stringify(v.slice(-500))); } catch { /* storage blocked */ } };
export const FOLLOW_KEY = 'cv-cc-follow';
export const MUTE_KEY = 'cv-cc-mute';
export const readFollows = () => read(FOLLOW_KEY);
export const readMutes = () => read(MUTE_KEY);
export function toggleIn(key: string, id: string): string[] { const cur = read(key); const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]; write(key, next); return next; }
export const clearMutes = () => write(MUTE_KEY, []);
/** Your team's games played when you last opened CourtChat in this league (for the menu badge). */
export function readChatSeen(saveId: string): number | null { try { const v = localStorage.getItem(`cv-cc-seen:${saveId}`); return v == null ? null : Number(v) || 0; } catch { return null; } }
export function markChatSeen(saveId: string, games: number): void { try { localStorage.setItem(`cv-cc-seen:${saveId}`, String(games)); } catch { /* storage blocked */ } }
