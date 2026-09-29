import { useMemo, useState } from 'react';
import type { League } from '../simulation/league';
import { homeCities, travelWalk, planTrip, TRIP_PLANS, timeZone, ZONE_NAME, type City, type RoadTrip } from '../simulation/travel';
import { useTeamIdentity } from '../visuals/TeamIdentityContext';
import { PixelIcon } from './PixelIcon';

/* A simplified outline of the lower 48 (lon, lat), sampled onto a grid for the pixel map. */
const US: [number, number][] = [[-124.7, 48.4], [-123.9, 46.2], [-124.2, 42], [-124.4, 40.4], [-122.4, 37.2], [-120.6, 34.6], [-117.1, 32.5], [-114.7, 32.7], [-111, 31.3], [-108.2, 31.3], [-106.5, 31.8],
  [-104.5, 29.6], [-103, 29], [-101.4, 29.8], [-99.5, 27.5], [-97.4, 25.9], [-97.2, 27.8], [-94.7, 29.4], [-90.5, 29], [-89.2, 30.3], [-85, 29.7], [-83.1, 29], [-82.6, 27.6], [-81.4, 25.2], [-80.1, 25.8],
  [-80.6, 28.4], [-81.3, 30.6], [-80.9, 32.1], [-78.6, 33.9], [-76, 35.5], [-75.5, 37.6], [-74.3, 39.9], [-74, 40.6], [-71.8, 41.3], [-70.1, 41.7], [-70.6, 43], [-69, 44.1], [-67, 44.8], [-67.8, 47.1],
  [-69.2, 47.4], [-71.5, 45], [-74.8, 45], [-76.3, 44.2], [-79.2, 43.4], [-83, 42], [-82.5, 45.8], [-84.5, 46.4], [-88, 48], [-95.2, 49], [-123.3, 49]];
const W = 640, H = 360, COLS = 64, ROWS = 36;
const px = (c: { lon: number }) => (c.lon + 125.5) / 59 * W, py = (c: { lat: number }) => (50 - c.lat) / 26.5 * H;
function inside(lon: number, lat: number) {
  let hit = false;
  for (let i = 0, j = US.length - 1; i < US.length; j = i++) {
    const [xi, yi] = US[i], [xj, yj] = US[j];
    if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}
const LAND = (() => { const out: [number, number][] = []; for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const lon = -125.5 + (c + .5) / COLS * 59, lat = 50 - (r + .5) / ROWS * 26.5; if (inside(lon, lat)) out.push([c, r]); } return out; })();

function TripMap({ cities, home, trip, primary, teamNames }: { cities: [string, City][]; home: City; trip?: RoadTrip; primary: string; teamNames: (id: string) => string }) {
  const path = trip ? [home, ...trip.legs.map(l => l.city), home] : [];
  return <svg className="trip-map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={trip ? `Road trip: ${trip.legs.map(l => l.city.name).join(', ')}` : 'League map'}>
    <rect width={W} height={H} fill="#0b1018" />
    <g shapeRendering="crispEdges">{LAND.map(([c, r]) => <rect key={`${c}-${r}`} x={c * W / COLS} y={r * H / ROWS} width={W / COLS - 1} height={H / ROWS - 1} fill={(c + r) % 7 === 0 ? '#243248' : '#1c2a3d'} />)}</g>
    {[-87.5, -101, -114.5].map(lon => <line key={lon} x1={px({ lon })} x2={px({ lon })} y1="0" y2={H} stroke="#2a3546" strokeDasharray="3 5" />)}
    {path.length > 1 && <polyline className="trip-route" points={path.map(c => `${px(c)},${py(c)}`).join(' ')} fill="none" stroke={primary} strokeWidth="3" strokeLinejoin="round" />}
    {cities.map(([id, c]) => <g key={id} transform={`translate(${px(c)},${py(c)})`}><rect x="-3" y="-3" width="6" height="6" fill={c === home ? primary : '#94a0b2'} stroke="#0b1018" /><title>{teamNames(id)} · {c.name}</title></g>)}
    {trip?.legs.map((l, i) => <g key={l.gameId} transform={`translate(${px(l.city)},${py(l.city)})`}><rect x="-8" y="-20" width="16" height="12" fill="#f47b20" stroke="#0b1018" /><text x="0" y="-11" textAnchor="middle" fontFamily="monospace" fontSize="10" fontWeight="bold" fill="#0b1018">{i + 1}</text></g>)}
    <g transform={`translate(${px(home)},${py(home)})`}><rect x="-6" y="-6" width="12" height="12" fill="none" stroke="#ffd166" strokeWidth="2" /></g>
  </svg>;
}

const Meter = ({ v }: { v: number }) => <span className="trip-fatigue" aria-label={`Fatigue ${v.toFixed(1)}`}>{Array.from({ length: 6 }, (_, i) => <i key={i} className={i < Math.round(v) ? v >= 4 ? 'hot' : 'on' : ''} />)}</span>;

/** Road trips: your team on the map, every trip of the season, the travel toll, and how you handle it. */
export function RoadTripsPage({ league, controlledTeamId, onChange }: { league: League; controlledTeamId: string | null; onChange: (l: League) => void }) {
  const team = league.teams.find(t => t.teamId === controlledTeamId);
  const identity = useTeamIdentity(team?.teamId ?? '');
  const cities = useMemo(() => homeCities(league.teams), [league.teams]);
  const walk = team ? travelWalk(league, team.teamId) : null;
  const upcoming = walk?.trips.find(t => t.legs.some(l => !l.played));
  const [sel, setSel] = useState<string | null>(null);
  if (!team || !walk) return <p className="empty-state">Road trips follow the team you run.</p>;
  const home = cities.get(team.teamId)!;
  const selected = walk.trips.find(t => t.id === sel) ?? upcoming ?? walk.trips[walk.trips.length - 1];
  const name = (id: string) => league.teams.find(t => t.teamId === id)?.name ?? id;
  const next = league.schedule.find(g => !g.played && (g.homeTeamId === team.teamId || g.awayTeamId === team.teamId));
  const now = next ? walk.fatigue.get(next.id) ?? 0 : 0;
  const totalMiles = walk.trips.reduce((n, t) => n + t.miles, 0);
  return <div className="road-trips">
    <div className="season-feature-header"><div><span className="pixel-eyebrow">TRAVEL</span><h2><PixelIcon name="calendar" size={22} /> Road Trips</h2>
      <p>{home.name} · {ZONE_NAME[timeZone(home)]} time · {walk.trips.length} road trips, {totalMiles.toLocaleString()} miles this season</p></div>
      <div className="trip-now"><small>Travel fatigue before the next game</small><Meter v={now} /><b>{now < 1 ? 'Fresh' : now < 2.5 ? 'A little tired' : now < 4 ? 'Road-weary' : 'Exhausted'}</b></div></div>
    <p className="hint-text">Every flight wears on a team: long distances, time zones crossed and games on short rest add up, and a homestand lets it drain away. Fatigue costs up to 3 points of decision-making and help defense on the night, for every team in the league. On your road trips you choose how to handle it.</p>
    <div className="trip-layout">
      <TripMap cities={[...cities.entries()]} home={home} trip={selected} primary={identity?.primary ?? '#f47b20'} teamNames={name} />
      <div className="trip-list">
        {walk.trips.length === 0 && <p className="empty-state">No road trips of two games or more on this schedule.</p>}
        {walk.trips.map(t => { const started = t.legs.some(l => l.played), done = t.legs.every(l => l.played), wins = t.legs.filter(l => l.won).length;
          return <article key={t.id} className={`trip-card${t === selected ? ' active' : ''}${t === upcoming ? ' next' : ''}`}>
            <button className="trip-head" onClick={() => setSel(t.id)} aria-pressed={t === selected}>
              <b>{t === upcoming ? 'Next trip' : done ? `Trip · ${wins}-${t.legs.length - wins}` : 'Road trip'}</b>
              <span>{t.legs.length} games · {t.miles.toLocaleString()} mi{t.zones ? ` · ${t.zones} time-zone jump${t.zones === 1 ? '' : 's'}` : ''}</span>
              <Meter v={t.peak} /></button>
            <ol>{t.legs.map((l, i) => <li key={l.gameId} className={l.played ? l.won ? 'won' : 'lost' : ''}><span>{i + 1}. @ {name(l.opponentId)}</span><small>{l.city.name} · {l.miles.toLocaleString()} mi{l.zones ? ` · ${l.zones}h` : ''}</small><Meter v={l.fatigue} /></li>)}</ol>
            <div className="trip-plans" role="radiogroup" aria-label="Trip plan">{TRIP_PLANS.map(p => <button key={p.id} role="radio" aria-checked={t.plan === p.id} className={t.plan === p.id ? 'active' : ''} disabled={started} title={p.note}
              onClick={() => onChange(planTrip(league, team.teamId, t.id, p.id))}>{p.label}</button>)}</div>
            {t.plan && <p className="hint-text">{TRIP_PLANS.find(p => p.id === t.plan)!.note}</p>}
          </article>; })}
      </div>
    </div>
  </div>;
}
