import { localRead, type Read } from '../lib/kv';
import { loadRecords } from '../hunt/storage';
import { loadPerfectRecords } from '../perfect/storage';
import { readArcade, GUESS_TRIES } from '../arcade/storage';

/*
 * The Daily Challenge: one of the existing dailies is today's featured challenge, the same for everyone (a different
 * mode every day, in a fixed rotation). Finishing it, win or lose, pays a free Lucky Spin once, and doing it on
 * back-to-back days builds a challenge streak.
 */

export type ChallengeMode = 'hunt' | 'perfect' | 'grid' | 'guess';
export const CHALLENGE_KEY = 'cv-daily-challenge';
export const CHALLENGE_ROTATION: ChallengeMode[] = ['perfect', 'grid', 'hunt', 'guess'];
export const CHALLENGE_INFO: Record<ChallengeMode, { title: string; blurb: string }> = {
  perfect: { title: 'The 82-0 Daily', blurb: 'Everyone gets the same spins today. Can you go 82-0?' },
  grid: { title: 'The Daily Grid', blurb: 'Fill the 3x3 grid with the rarest players you can think of.' },
  hunt: { title: 'The League Hunt Daily', blurb: 'One shared squad, ten series. How far can you take it?' },
  guess: { title: 'Guess the Player', blurb: "Today's mystery player, in as few clues as you can." },
};

export const today = (now = new Date()) => now.toISOString().slice(0, 10);
const dayNumber = (day: string) => Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
/** Today's challenge mode (the same for everyone). */
export const challengeFor = (day: string): ChallengeMode => CHALLENGE_ROTATION[((dayNumber(day) % CHALLENGE_ROTATION.length) + CHALLENGE_ROTATION.length) % CHALLENGE_ROTATION.length];

/** Whether the day's challenge daily has been played to the end. */
export function challengeDone(day: string, read: Read = localRead): boolean {
  const mode = challengeFor(day);
  if (mode === 'hunt') return !!loadRecords(read).daily?.[day];
  if (mode === 'perfect') return !!loadPerfectRecords(read).daily?.[day];
  const a = readArcade(read);
  if (mode === 'grid') return (a.grid?.[day]?.used ?? 0) >= 9 || (a.grid?.[day]?.cells?.filter(Boolean).length ?? 0) >= 9;
  const g = a.guess?.[day];
  return !!g && (g.won || g.guesses.length >= GUESS_TRIES);
}

export interface ChallengeState { days: string[] }
export function readChallenge(read: Read = localRead): ChallengeState {
  try { const v = JSON.parse(read(CHALLENGE_KEY) ?? 'null') as ChallengeState | null; return { days: (v?.days ?? []).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().slice(-400) }; } catch { return { days: [] }; }
}
export const mergeChallenge = (a: ChallengeState, b: ChallengeState): ChallengeState => ({ days: [...new Set([...a.days, ...b.days])].sort().slice(-400) });
/** Days in a row (ending today or yesterday) with the challenge done. */
export function challengeStreak(s: ChallengeState, day: string): number {
  const set = new Set(s.days);
  let n = 0, d = dayNumber(day);
  if (!set.has(day)) d -= 1;
  while (set.has(new Date(d * 86_400_000).toISOString().slice(0, 10))) { n++; d--; }
  return n;
}
/** Records today's challenge as done (once). Returns true the first time, when the reward should be paid. */
export function claimChallenge(day: string, read: Read = localRead): boolean {
  if (!challengeDone(day, read)) return false;
  const s = readChallenge(read);
  if (s.days.includes(day)) return false;
  try { localStorage.setItem(CHALLENGE_KEY, JSON.stringify({ days: [...s.days, day].sort().slice(-400) })); } catch { return false; }
  return true;
}
