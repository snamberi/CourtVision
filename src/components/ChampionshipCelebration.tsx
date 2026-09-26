import { useEffect, useMemo, useRef } from 'react';
import type { League } from '../simulation/league';
import type { PlayerSeason } from '../simulation/types';
import { calculateOverall } from '../simulation/engine/overall';
import { formatSeasonYear } from '../simulation/calendar';
import { resolveTeamIdentity } from '../simulation/teamIdentity';
import { PlayerAvatar } from './PlayerAvatar';
import { PixelTrophy } from './PixelTrophy';
import { TeamLogo } from './TeamLogo';

/* The title celebration: the whole championship roster around the trophy, the Finals MVP in the
 * middle holding his trophy overhead, confetti in team colors and camera flashes. */

export interface CelebrationInfo {
  teamId: string;
  season: string;
  fmvpId: string | null;
  /** "31.2 PTS · 8.5 REB · 6.0 AST in 6 games" */
  fmvpLine?: string;
  /** "Won the Finals 4–2 over the Harbor City Gulls" */
  seriesLine?: string;
  /** Roster to show (defaults to the team's current roster). */
  playerIds?: string[];
}

export function ChampionshipCelebration({ league, info, onClose, onSelectPlayer }: {
  league: League; info: CelebrationInfo; onClose: () => void; onSelectPlayer?: (id: string) => void;
}) {
  const team = league.teams.find(t => t.teamId === info.teamId);
  const identity = team ? resolveTeamIdentity(team) : null;
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => { dialog.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Stars nearest the middle: the Finals MVP in the center, then the rest by overall, alternating sides.
  const { fmvp, front, back } = useMemo(() => {
    const byId = new Map<string, PlayerSeason>();
    for (const t of league.teams) for (const s of t.seasons) byId.set(s.playerId, s);
    for (const r of league.retiredPlayers ?? []) if (r.finalSeasonData && !byId.has(r.playerId)) byId.set(r.playerId, r.finalSeasonData);
    const ids = info.playerIds?.length ? info.playerIds : team?.seasons.map(s => s.playerId) ?? [];
    const others = ids.filter(id => id !== info.fmvpId)
      .sort((a, b) => (byId.get(b) ? calculateOverall(byId.get(b)!) : 0) - (byId.get(a) ? calculateOverall(byId.get(a)!) : 0))
      .slice(0, 14);
    const frontCount = Math.min(6, others.length);
    const frontIds = others.slice(0, frontCount);
    // Alternate left/right so the best players stand closest to the trophy.
    const left: string[] = [], right: string[] = [];
    frontIds.forEach((id, i) => (i % 2 === 0 ? left : right).push(id));
    return { fmvp: info.fmvpId, front: { left: left.reverse(), right }, back: others.slice(frontCount) };
  }, [league, info, team]);

  const confetti = useMemo(() => Array.from({ length: 56 }, (_, i) => ({
    left: (i * 53) % 100, delay: (i % 14) * 0.21, dur: 2.6 + (i % 5) * 0.35,
    color: [identity?.primary ?? '#f47b20', identity?.secondary ?? '#f4f0e6', '#ffd166', '#f4f0e6'][i % 4], size: 4 + (i % 3) * 2,
  })), [identity]);

  if (!team || !identity) return null;
  const jersey = (id: string) => league.teams.flatMap(t => t.seasons).find(s => s.playerId === id)?.jerseyNumber ?? null;
  const person = (id: string, size: number, i: number, raise: boolean) => (
    <button key={id} className="cc-player" style={{ animationDelay: `${(i % 7) * 0.13}s` }} onClick={() => onSelectPlayer?.(id)} title={id}>
      <PlayerAvatar playerId={id} teamId={team.teamId} jerseyNumber={jersey(id)} mode="full" size={size} pose={raise ? 'raise' : 'stand'} />
    </button>
  );

  return <div className="cc-backdrop" role="presentation">
    <div className="cc-dialog" role="dialog" aria-modal="true" aria-label={`${team.name} are the ${formatSeasonYear(info.season)} champions`} tabIndex={-1} ref={dialog}
      style={{ ['--cc-primary' as string]: identity.primary, ['--cc-secondary' as string]: identity.secondary, ['--cc-court' as string]: identity.courtPaint }}>
      <div className="cc-stage">
        <div className="cc-lights" aria-hidden="true"><i /><i /><i /></div>
        <div className="cc-flashes" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ left: `${8 + i * 12}%`, animationDelay: `${i * 0.37}s` }} />)}</div>
        <div className="cc-banner">
          <TeamLogo team={team} size={44} />
          <div><span className="pixel-eyebrow">{formatSeasonYear(info.season)} CHAMPIONS</span><h2>{team.name}</h2></div>
          <TeamLogo team={team} size={44} />
        </div>
        <div className="cc-group">
          {back.length > 0 && <div className="cc-row cc-back">{back.map((id, i) => person(id, 56, i, i % 2 === 1))}</div>}
          <div className="cc-row cc-front">
            <div className="cc-side">{front.left.map((id, i) => person(id, 70, i + 1, i % 2 === 0))}</div>
            {fmvp && <div className="cc-fmvp">
              <span className="cc-fmvp-trophy"><PixelTrophy award="fmvp" size={44} title="Finals MVP trophy" /></span>
              {person(fmvp, 90, 0, true)}
            </div>}
            <div className="cc-side">{front.right.map((id, i) => person(id, 70, i + 2, i % 2 === 1))}</div>
          </div>
          <div className="cc-trophy-stand"><PixelTrophy award="champion" size={64} title="Championship trophy" className="cc-cup" /><span className="cc-riser" /></div>
        </div>
        <div className="cc-floor" aria-hidden="true" />
        <div className="cc-confetti" aria-hidden="true">{confetti.map((c, i) => <i key={i} style={{ left: `${c.left}%`, width: c.size, height: c.size, background: c.color, animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s` }} />)}</div>
      </div>
      <div className="cc-caption">
        {info.seriesLine && <p>{info.seriesLine}</p>}
        {fmvp && <p className="cc-fmvp-line"><PixelTrophy award="fmvp" size={16} /> Finals MVP: <button className="link-button" onClick={() => onSelectPlayer?.(fmvp)}>{fmvp}</button>{info.fmvpLine ? ` · ${info.fmvpLine}` : ''}</p>}
        <button className="primary" onClick={onClose}>Continue</button>
      </div>
    </div>
  </div>;
}
