import { HOLIDAYS, holidayRun } from '../retention/holiday';
export function upcomingEvents(now = new Date()) {
  const year = now.getUTCFullYear();
  return HOLIDAYS.map(h => [year - 1, year, year + 1].map(y => holidayRun(h.id, y)).find(r => r.end > now)!).sort((a,b) => a.start.getTime() - b.start.getTime());
}
export const timeRemaining = (end: Date, now: Date) => { const minutes = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 60000)); return `${Math.floor(minutes / 1440)}d ${Math.floor(minutes % 1440 / 60)}h ${minutes % 60}m`; };
