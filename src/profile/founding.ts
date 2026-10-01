import { localRead, type Read } from '../lib/kv';

/*
 * The Founding GM reward: a title and a profile frame for everyone who makes a free account. The browser remembers
 * that it has signed in, so the reward stays after signing out. (No payment anywhere: an account is free.)
 */
export const FOUNDING_KEY = 'cv-founding';
export const FOUNDING_TITLE = 'Founding GM';
export const hasFoundingAccount = (read: Read = localRead) => read(FOUNDING_KEY) === '1';
export function noteFoundingAccount(): boolean {
  try {
    if (localStorage.getItem(FOUNDING_KEY) === '1') return false;
    localStorage.setItem(FOUNDING_KEY, '1');
    window.dispatchEvent(new Event('courtvision:progress'));
    return true;
  } catch { return false; }
}
