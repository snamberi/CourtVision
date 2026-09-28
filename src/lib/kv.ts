/** Reads one stored value. The game reads this browser's storage; the server reads a synced progress blob. */
export type Read = (key: string) => string | null;
export const localRead: Read = key => { try { return localStorage.getItem(key); } catch { return null; } };
export const objectRead = (data: Record<string, string>): Read => key => (Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null);
