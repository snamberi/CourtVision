import { useState } from 'react';
import { CourtLineup, type LineupPlayer } from '../CourtLineup';
import { assignToSpots, FIVE_SPOTS } from '../lineupSpots';
import { PlayerAvatar } from '../PlayerAvatar';
import { PixelIcon } from '../PixelIcon';
import type { LeagueTeam, InjuryRecord } from '../../simulation/league';
import { getRotationOrder, primaryPosition } from '../../simulation/teamStatus';
import { calculateOverall } from '../../simulation/engine/overall';
import { strongDuos } from '../../simulation/chemistryWeb';
import { resolveTeamIdentity } from '../../simulation/teamIdentity';
import './nextLevel.css';

export interface LineupBond { label: string; cards: string[]; bonus?: number }

/** Visualizes existing rotation and chemistry data; never changes either. */
export function LineupBoard({ players, bench = [], bonds = [], title = 'Your starting five', paint, onOpenPlayer, fixed = false }: {
  players: LineupPlayer[]; bench?: LineupPlayer[]; bonds?: LineupBond[]; title?: string; paint?: string; onOpenPlayer?: (id: string) => void; fixed?: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const all = [...players, ...bench];
  const current = all.find(p => p.id === selected);
  const visibleBonds = bonds.filter(b => b.cards.filter(id => all.some(p => p.id === id)).length > 1);
  const active = current ? visibleBonds.filter(b => b.cards.includes(current.id)) : visibleBonds;
  const linked = current ? new Set([current.id, ...active.flatMap(b => b.cards)]) : undefined;
  const pick = (id: string) => setSelected(old => old === id ? null : id);
  return <section className="lineup-board" aria-label={title}>
    <header className="lineup-board-head"><div><span className="pixel-eyebrow">ON THE HARDWOOD</span><h3>{title}</h3></div><span>{players.length}/5 starters · {bench.length} bench</span></header>
    <div className="lineup-board-grid">
      <CourtLineup players={fixed ? FIVE_SPOTS.map((_, i) => players[i]) : assignToSpots(players, FIVE_SPOTS)} paint={paint} bonds={active} highlighted={linked} selected={current?.id} onSelect={pick} />
      <aside className="lineup-bench" aria-label="Bench"><h4><PixelIcon name="team" size={16} /> THE BENCH</h4>
        {bench.length ? bench.map((p, i) => <button key={p.id} className={`lineup-reserve ${current?.id === p.id ? 'selected' : ''} ${linked?.has(p.id) ? 'linked' : ''}`} aria-pressed={current?.id === p.id} onClick={() => pick(p.id)}>
          <PlayerAvatar playerId={p.name} teamId={p.teamId} primaryColor={p.colors?.[0]} secondaryColor={p.colors?.[1]} size={44} />
          <span><small>{i === 0 ? '6TH MAN' : `RESERVE ${i + 1}`} · {p.pos}</small><b>{p.name}</b><em>{p.sub}</em></span>
        </button>) : <p className="hint-text">Your reserves will appear here.</p>}
      </aside>
    </div>
    <div className="lineup-chemistry" aria-live="polite"><strong><PixelIcon name="team" size={14} /> {current ? `${current.name} · connections` : 'Team chemistry'}</strong>
      {active.length ? <ul>{active.map((b, i) => <li key={`${b.label}-${i}`} className={(b.bonus ?? 0) < 0 ? 'negative' : ''}>{b.bonus != null && <b>{b.bonus > 0 ? '+' : ''}{b.bonus}</b>} {b.label}{b.cards.some(id => bench.some(p => p.id === id)) && <small> · bench connection</small>}</li>)}</ul> : <p>{current ? 'No active chemistry links for this player yet.' : 'No active chemistry links yet. Select a player to inspect connections.'}</p>}
      {current && <div className="lineup-inspect-actions"><button onClick={() => setSelected(null)}>Show all links</button>{onOpenPlayer && <button onClick={() => onOpenPlayer(current.id)}>View player</button>}</div>}
    </div>
  </section>;
}

export function FranchiseLineup({ team, injuries, onOpenPlayer }: { team: LeagueTeam; injuries?: Record<string, InjuryRecord>; onOpenPlayer?: (id: string) => void }) {
  const kit = resolveTeamIdentity(team);
  const roster = new Map(team.seasons.map(p => [p.playerId, p]));
  const ordered = getRotationOrder(team).flatMap(id => {
    const p = roster.get(id); if (!p) return [];
    const out = (injuries?.[id]?.gamesRemaining ?? 0) > 0;
    return [{ id, name: id, teamId: team.teamId, pos: primaryPosition(p), colors: [kit.primary, kit.secondary] as [string, string], sub: `${calculateOverall(p)} OVR${out ? ' · OUT' : ''}` }];
  });
  const bonds = strongDuos(team).map(d => ({ label: `${d.a} + ${d.b} · ${Math.round(d.bond)}/100 bond`, cards: [d.a, d.b] }));
  return <LineupBoard title={`${team.name} · depth chart`} players={ordered.slice(0, 5)} bench={ordered.slice(5)} bonds={bonds} paint={kit.courtPaint} onOpenPlayer={onOpenPlayer} />;
}
