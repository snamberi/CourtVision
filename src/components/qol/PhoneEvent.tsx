import { HolidayArt } from '../holiday/HolidayArt';
import { useEffect, useState } from 'react';
import { activeHolidays, HOLIDAY_EVENT, eventCoins, loadHoliday } from '../../retention/holiday';
import { PixelIcon } from '../PixelIcon';
export function PhoneEvent() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const refresh = () => setNow(new Date()); const timer = setInterval(refresh, 60000); window.addEventListener(HOLIDAY_EVENT, refresh); return () => { clearInterval(timer); window.removeEventListener(HOLIDAY_EVENT, refresh); }; }, []);
  const runs = activeHolidays(now);
  return <div className="phone-events">{runs.length ? runs.map(({holiday:h,key}) => <button key={key} className="phone-event" style={{background:h.colors.panel,color:h.colors.text,borderColor:h.colors.accent}} onClick={() => {location.hash='#/event';}}>
    <span className="phone-event-art" aria-hidden="true"><HolidayArt id={h.id} size={40}/><i>✦</i><PixelIcon name="gift" size={26}/></span><span><b>{h.name}</b><small>{eventCoins(loadHoliday(),key)} {h.coins} · Open event</small></span>
  </button>) : <button className="phone-event" onClick={() => {location.hash='#/event';}}><PixelIcon name="calendar" size={32}/><span><b>Events</b><small>Calendar & seasonal rewards</small></span></button>}</div>;
}
