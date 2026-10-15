import type { EraRules } from './types';

/*
 * How long a game is: any number of periods (1-8) of any whole number of minutes (1-30). The engine plays whatever the
 * league's era says (numberOfQuarters x quarterLengthMinutes); this is the one place that names and limits it.
 */

export const MIN_PERIODS = 1, MAX_PERIODS = 8, MIN_PERIOD_MINUTES = 1, MAX_PERIOD_MINUTES = 30;
/** A regulation NBA game, the length every per-game threshold in the game was written for. */
export const NBA_GAME_MINUTES = 48;

export interface GameLength { periods: number; minutes: number }
export const GAME_LENGTH_PRESETS: (GameLength & { label: string })[] = [
  { periods: 4, minutes: 12, label: 'NBA' }, { periods: 4, minutes: 10, label: 'FIBA' }, { periods: 2, minutes: 20, label: 'College' },
  { periods: 4, minutes: 8, label: 'High school' }, { periods: 4, minutes: 4, label: '16-minute game' }, { periods: 3, minutes: 16, label: 'Three periods' },
];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? Math.round(v) : lo));
export const cleanGameLength = (periods: number, minutes: number): GameLength =>
  ({ periods: clamp(periods, MIN_PERIODS, MAX_PERIODS), minutes: clamp(minutes, MIN_PERIOD_MINUTES, MAX_PERIOD_MINUTES) });

/** "quarter" for 4, "half" for 2, "period" for anything else. */
export const periodWord = (periods: number) => (periods === 4 ? 'quarter' : periods === 2 ? 'half' : 'period');
/** The clock's short label for a regulation period: Q3, H2, P5. */
export const periodLabel = (period: number, regulation: number) =>
  period > regulation ? `OT${period - regulation}` : `${regulation === 4 ? 'Q' : regulation === 2 ? 'H' : 'P'}${period}`;

/** "4 × 12-minute quarters (48 minutes)" or "One 30-minute period". */
export function gameLengthText(periods: number, minutes: number): string {
  const word = periodWord(periods);
  if (periods === 1) return `One ${minutes}-minute period`;
  return `${periods} × ${minutes}-minute ${word === 'half' ? 'halves' : `${word}s`} (${periods * minutes} minutes)`;
}

/** Era rules with a new game length. Overtime is five minutes, or one period when periods are shorter. */
export function withGameLength(era: EraRules, periods: number, minutes: number): EraRules {
  const g = cleanGameLength(periods, minutes);
  return { ...era, numberOfQuarters: g.periods, quarterLengthMinutes: g.minutes, overtimeLengthMinutes: Math.min(5, g.minutes) };
}

export const gameMinutes = (era: Pick<EraRules, 'numberOfQuarters' | 'quarterLengthMinutes'>) => era.numberOfQuarters * era.quarterLengthMinutes;
