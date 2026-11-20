import { localRead } from '../lib/kv';

const LEGENDS_KEY = 'cv-legends-1v1';
const TOUR_KEY = 'cv-gm-tour';
const STREET_KEY = 'cv-street-best';

export interface LegendsRun {
  week: string; legend: string; round: number; alive: boolean;
  results: { opp: string; score: [number, number]; won: boolean }[];
}
export interface TourRun { week: string; picks: string[]; revealed: number }

function readWeekly<T extends { week: string }>(key: string, week: string): T | null {
  try {
    const run = JSON.parse(localRead(key) ?? 'null') as T | null;
    return run?.week === week ? run : null;
  } catch { return null; }
}
function write(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* storage blocked */ }
}
export const readLegendsRun = (week: string) => readWeekly<LegendsRun>(LEGENDS_KEY, week);
export const writeLegendsRun = (r: LegendsRun) => write(LEGENDS_KEY, JSON.stringify(r));
export const readTour = (week: string) => readWeekly<TourRun>(TOUR_KEY, week);
export const writeTour = (r: TourRun) => write(TOUR_KEY, JSON.stringify(r));
export const readStreetBest = () => Number(localRead(STREET_KEY)) || 0;
export const writeStreetBest = (streak: number) => write(STREET_KEY, String(streak));
