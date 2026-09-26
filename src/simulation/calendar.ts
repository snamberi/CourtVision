/** Days a single schedule "round" advances the calendar by (roughly matches an NBA team's ~2-day game cadence). */
export const DAYS_PER_ROUND = 2;

export function formatDateISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return formatDateISO(d);
}

export function daysBetween(fromStr: string, toStr: string): number {
  const from = new Date(fromStr + 'T00:00:00Z').getTime();
  const to = new Date(toStr + 'T00:00:00Z').getTime();
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

/** Turns a "YYYY-YY" (or plain "YYYY") season label into a realistic season-opening date: Oct 21 of the label's first year, matching the real NBA calendar. */
export function seasonStartDate(seasonLabel: string | undefined): string {
  const match = (seasonLabel ?? '').match(/^(\d{4})/);
  const year = match ? parseInt(match[1], 10) : 2025;
  return `${year}-10-21`;
}

/**
 * Normalizes any season label to the single-year display format the app uses everywhere: the year the season
 * ends ("2027" for the season stored as "2026" or "2026-27"). Accepts both the current plain-year labels and the older
 * "YYYY-YY" range labels (from earlier saves or imports) so old data still displays cleanly.
 */
export function formatSeasonYear(seasonLabel: string | undefined): string {
  // A season is named for the year it ends, like the NBA: the season that tips off in October 2015 is "2016".
  // Stored labels keep the starting year ("2015" or "2015-16"); only the display changes.
  const match = (seasonLabel ?? '').match(/^(\d{4})/);
  return match ? String(parseInt(match[1], 10) + 1) : (seasonLabel ?? '—');
}

/** The real NBA's first season (as the Basketball Association of America) through the current calendar year — the full valid range for a "Starting Season" picker. */
export function nbaHistoryYearRange(): number[] {
  const NBA_ORIGIN_YEAR = 1946;
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = currentYear; y >= NBA_ORIGIN_YEAR; y--) years.push(y);
  return years;
}

export function formatDisplayDate(dateStr: string | undefined): string {
  if (!dateStr) return 'Unknown date';
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}
