import { useEffect, useState } from 'react';
import { upcomingEvents, timeRemaining } from '../../qol/calendar';
const stamp = (d: Date) => d.toISOString().replace('T',' ').slice(0,16) + ' UTC';
export function EventCalendar() {
 const [now,setNow] = useState(() => new Date());
 useEffect(() => {const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer);}, []);
 return <section className="qol-panel"><h2>Event calendar</h2><p>Game event windows, in UTC. End times are exclusive. Overlapping events award their own currencies.</p><ul>{upcomingEvents(now).map(run => <li key={run.key}><b>{run.holiday.name}</b> · {run.holiday.coins}<br /><time>{stamp(run.start)}</time> – <time>{stamp(run.end)}</time><br /><small>{now >= run.start ? 'Ends in' : 'Starts in'} {timeRemaining(now >= run.start ? run.end : run.start, now)}</small></li>)}</ul></section>;
}
