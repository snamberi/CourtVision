import { useMemo } from 'react';
import type { League, LeagueTeam } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import type { PlayerSeason } from '../simulation/types';
import { lockerRoom, moraleLabel, personalityOf, playerMorale, PERSONALITY_BLURB } from '../simulation/personality';

/** Compact mood cell for roster tables: stored morale snapshot, personality type and any trade request. */
export function MoraleCell({ p, fallback, fallbackTitle }: { p: PlayerSeason; fallback: string; fallbackTitle: string }) {
  const per = personalityOf(p);
  const m = p.morale;
  if (!m || m.teamId !== p.teamId) return <td className="roster-mood" title={`${per.type} · ${fallbackTitle}`}>{fallback}</td>;
  return <td className={`roster-mood mood-${moraleLabel(m.score).toLowerCase()}`} title={`${per.type} · morale ${m.score}/100 · ${fallbackTitle}`}>
    {moraleLabel(m.score)}{m.tradeRequest && <span className="mood-request" title="Has requested a trade"> ⚑</span>}
  </td>;
}

/** Who meshes and who clashes on a roster, and where team chemistry stands. */
export function LockerRoomPanel({ team }: { team: LeagueTeam }) {
  const { links, chemistryDelta } = useMemo(() => lockerRoom(team), [team]);
  const requests = team.seasons.filter(p => p.morale?.tradeRequest && p.morale.teamId === team.teamId);
  const scores = team.seasons.map(p => p.morale?.teamId === team.teamId ? p.morale.score : null).filter((v): v is number => v != null);
  const avg = scores.length ? Math.round(scores.reduce((n, v) => n + v, 0) / scores.length) : null;
  return <section className="locker-room" aria-label="Locker room">
    <div className="locker-room-head">
      <span className="section-label">LOCKER ROOM</span>
      <span>Chemistry <b>{Math.round(team.chemistry ?? 70)}</b></span>
      {avg != null && <span>Avg morale <b>{avg}</b> ({moraleLabel(avg)})</span>}
      <span>Fit <b className={chemistryDelta >= 0 ? 'delta-up' : 'delta-down'}>{chemistryDelta > 0 ? '+' : ''}{chemistryDelta.toFixed(1)}</b></span>
    </div>
    {requests.length > 0 && <p className="locker-requests">⚑ Trade request{requests.length > 1 ? 's' : ''}: {requests.map(p => p.playerId).join(', ')}. Unhappy players drag chemistry down until they're moved or won back.</p>}
    {links.length ? <ul className="locker-links">{links.slice(0, 8).map((l, i) => <li key={i} className={`locker-${l.kind}`}>
      <span aria-hidden="true">{l.kind === 'clash' ? '✕' : '♥'}</span> <b>{l.a}</b> {l.kind === 'clash' ? 'vs' : '&'} <b>{l.b}</b> <small>{l.reason}</small></li>)}</ul>
      : <p className="hint-text">No strong personalities pulling in either direction.</p>}
  </section>;
}

/** Personality and morale detail for one player (player profile). */
export function PersonalityPanel({ p, league, extras }: { p: PlayerSeason; league: League; extras: GMLeagueExtras }) {
  const team = league.teams.find(t => t.teamId === p.teamId);
  const view = useMemo(() => team ? playerMorale(p, team, league, extras) : null, [p, team, league, extras]);
  const per = view?.personality ?? personalityOf(p);
  const traits: [string, number][] = [['Ego', per.ego], ['Loyalty', per.loyalty], ['Winning', per.winning], ['Money', per.greed], ['Leadership', per.leadership], ['Temper', per.temper]];
  return <section className="personality-panel" aria-label="Personality and morale">
    <div className="personality-type"><span className="section-label">PERSONALITY</span><b>{per.type}</b><small>{PERSONALITY_BLURB[per.type]}</small></div>
    <div className="personality-traits">{traits.map(([k, v]) => <div key={k}><small>{k}</small><span className="trait-bar"><span style={{ width: `${Math.round(v)}%` }} /></span></div>)}</div>
    {view && <div className="personality-morale">
      <span className="section-label">MORALE</span>
      <b className={`mood-${view.label.toLowerCase()}`}>{view.score} · {view.label}</b>{p.morale?.tradeRequest && <span className="mood-request"> ⚑ Wants a trade</span>}
      <ul>{view.factors.slice(0, 5).map(f => <li key={f.label} className={f.delta >= 0 ? 'delta-up' : 'delta-down'}>{f.delta > 0 ? '+' : ''}{f.delta} {f.label}</li>)}</ul>
    </div>}
    {!!p.morale?.grudges?.length && <p className="hint-text">Holds a grudge against: {p.morale.grudges.map(id => league.teams.find(t => t.teamId === id)?.name ?? id).join(', ')}.</p>}
  </section>;
}
