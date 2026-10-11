/** "Online now", "12 minutes ago", "3 days ago"... from the time a player's game last checked in (stats.lastSeen). */
export function lastSeenLabel(iso: unknown, now = Date.now()): string | null {
  const t = typeof iso === 'string' ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return null;
  const min = Math.max(0, Math.floor((now - t) / 60_000));
  // The game checks in every 15 minutes while it's open.
  if (min < 20) return 'Online now';
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'} ago`;
  if (min < 60) return plural(min, 'minute');
  const h = Math.floor(min / 60);
  if (h < 24) return plural(h, 'hour');
  const d = Math.floor(h / 24);
  if (d < 30) return plural(d, 'day');
  return `on ${new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}
