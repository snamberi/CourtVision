import { useMemo } from 'react';
import type { League } from '../simulation/league';
import { computeConferenceStandings } from '../simulation/league';
import type { PlayInGame, PlayoffBracket, PlayoffSeries } from '../simulation/playoffs';
import { resolveTeamIdentity } from '../simulation/teamIdentity';
import { TeamLogo } from './TeamLogo';
import { formatSeasonYear } from '../simulation/calendar';

/* An NBA-style playoff bracket drawn as one pixel-art SVG: West on the left, East on the right, the play-in on the
 * outer edges and the Finals in the middle. Geometry is fixed so connector lines are exact at any screen size. */
const W = 1320, CX = 660, CARD_W = 118, ROW = 26, CARD_H = ROW * 2;
const COLS = { playIn: 36, r1: 170, r2: 314, cf: 458 };
const R1_Y = [124, 252, 380, 508]; // top edge of each first-round card (slots 1v8, 4v5, 3v6, 2v7)
const mid = (a: number, b: number) => (a + b) / 2;
const R2_Y = [mid(R1_Y[0], R1_Y[1]), mid(R1_Y[2], R1_Y[3])];
const CF_Y = mid(R2_Y[0], R2_Y[1]);
const FINALS_Y = CF_Y;
const mirror = (x: number, w = CARD_W) => 2 * CX - x - w;

type Side = 'west' | 'east';
interface Slot { bSeed?: number; a: string | null; b: string | null; aWins?: number; bWins?: number; winner: string | null; id: string; x: number; y: number; series?: PlayoffSeries; playIn?: PlayInGame; label?: string }

export function PlayoffBracketView({ league, bracket, selectedId, onSelect, seeds: archivedSeeds, season }: { league: League; bracket: PlayoffBracket; selectedId?: string | null; onSelect: (id: string) => void; seeds?: Record<string, number> | null; season?: string }) {
  const seeds = useMemo(() => {
    if (archivedSeeds) return new Map(Object.entries(archivedSeeds));
    const { east, west } = computeConferenceStandings(league);
    return new Map([...east.map((r, i) => [r.teamId, i + 1] as const), ...west.map((r, i) => [r.teamId, i + 1] as const)]);
  }, [league, archivedSeeds]);
  const teams = useMemo(() => new Map(league.teams.map(t => [t.teamId, t])), [league.teams]);
  const [r0, r1, r2, r3] = bracket.rounds;
  const x = (side: Side, col: keyof typeof COLS) => side === 'west' ? COLS[col] : mirror(COLS[col]);
  // Existing bracket slots: East = round0 slots 0-3, West = 4-7; semis East 0-1, West 2-3; conf finals East 0, West 1.
  const slots: Slot[] = [];
  const fromSeries = (s: PlayoffSeries, px: number, py: number): Slot => ({ a: s.teamAId, b: s.teamBId, aWins: s.teamAWins, bWins: s.teamBWins, winner: s.winnerTeamId, id: s.id, x: px, y: py, series: s });
  for (const side of ['west', 'east'] as Side[]) {
    const base = side === 'east' ? 0 : 4, semi = side === 'east' ? 0 : 2, conf = side === 'east' ? 0 : 1;
    // With a play-in, the 1v8 and 2v7 slots are filled by the play-in winners: show the seed they earned there.
    r0.slice(base, base + 4).forEach((s, i) => slots.push({ ...fromSeries(s, x(side, 'r1'), R1_Y[i]), bSeed: bracket.playIn?.length && (i === 0 || i === 3) ? (i === 0 ? 8 : 7) : undefined }));
    r1.slice(semi, semi + 2).forEach((s, i) => slots.push(fromSeries(s, x(side, 'r2'), R2_Y[i])));
    slots.push(fromSeries(r2[conf], x(side, 'cf'), CF_Y));
    for (const g of bracket.playIn?.filter(p => p.conference === side) ?? []) {
      const y = g.kind === '9v10' ? R1_Y[0] - 58 : g.kind === 'final' ? R1_Y[0] + 26 : R1_Y[3];
      slots.push({ a: g.teamAId, b: g.teamBId, winner: g.winnerTeamId, id: g.id, x: x(side, 'playIn'), y, playIn: g, label: g.kind === '7v8' ? '7 v 8' : g.kind === '9v10' ? '9 v 10' : 'FOR 8TH' });
    }
  }
  const finals = r3[0];
  slots.push(fromSeries(finals, CX - CARD_W / 2 - 1, FINALS_Y));
  const byId = new Map(slots.map(s => [s.id, s]));

  // Connector lines: each finished-or-pending card feeds a row (top = team A, bottom = team B) of the next card.
  const lines: { d: string; lit: boolean }[] = [];
  const link = (from: Slot | undefined, to: Slot | undefined, toTop: boolean) => {
    if (!from || !to) return;
    if (from.x === to.x) { const lx = from.x + CARD_W - 14; lines.push({ d: `M${lx} ${from.y + CARD_H}V${to.y}`, lit: !!from.winner }); return; }
    const leftToRight = from.x < to.x;
    const x1 = leftToRight ? from.x + CARD_W : from.x, x2 = leftToRight ? to.x : to.x + CARD_W;
    const y1 = from.y + CARD_H / 2, y2 = to.y + (toTop ? ROW / 2 : ROW + ROW / 2);
    const xm = Math.round((x1 + x2) / 2);
    lines.push({ d: `M${x1} ${y1}H${xm}V${y2}H${x2}`, lit: !!from.winner });
  };
  for (const side of ['west', 'east'] as Side[]) {
    const base = side === 'east' ? 0 : 4, semi = side === 'east' ? 0 : 2, conf = side === 'east' ? 0 : 1;
    for (let i = 0; i < 4; i++) link(byId.get(r0[base + i].id), byId.get(r1[semi + Math.floor(i / 2)].id), i % 2 === 0);
    for (let i = 0; i < 2; i++) link(byId.get(r1[semi + i].id), byId.get(r2[conf].id), i === 0);
    link(byId.get(r2[conf].id), byId.get(finals.id), side === 'east');
    const c = side[0].toUpperCase();
    link(byId.get(`pi-${c}-78`), byId.get(r0[base + 3].id), false);
    link(byId.get(`pi-${c}-final`), byId.get(r0[base].id), false);
    link(byId.get(`pi-${c}-910`), byId.get(`pi-${c}-final`), false);
  }

  const row = (teamId: string | null, wins: number | undefined, top: boolean, s: Slot, seedOverride?: number) => {
    const y = top ? 0 : ROW, team = teamId ? teams.get(teamId) : undefined, won = !!s.winner && s.winner === teamId, lost = !!s.winner && !!teamId && s.winner !== teamId;
    const id = team ? resolveTeamIdentity(team) : null;
    return <g transform={`translate(0,${y})`} className={won ? 'br-won' : lost ? 'br-lost' : ''}>
      <rect width={CARD_W} height={ROW} fill={won ? '#2a2410' : '#121926'} />
      {won && <rect width="3" height={ROW} fill="#ffd166" />}
      {team ? <>
        <text x="8" y="17" className="br-seed">{seedOverride ?? seeds.get(team.teamId) ?? ''}</text>
        <g transform="translate(22,4)"><TeamLogo team={team} size={18} /></g>
        <text x="44" y="17" className="br-abbr">{id!.abbreviation}</text>
        {wins != null && <text x={CARD_W - 8} y="17" textAnchor="end" className="br-wins">{wins}</text>}
      </> : <text x="10" y="17" className="br-tbd">TBD</text>}
    </g>;
  };
  const card = (s: Slot) => {
    const selected = selectedId === s.id, playable = !!(s.series?.games.length || s.playIn?.result);
    return <g key={s.id} transform={`translate(${s.x},${s.y})`} className={`br-card${selected ? ' br-selected' : ''}${playable ? ' br-playable' : ''}`}
      role="button" tabIndex={0} aria-label={`${s.a ? teams.get(s.a)?.name : 'TBD'} vs ${s.b ? teams.get(s.b)?.name : 'TBD'}`}
      onClick={() => onSelect(s.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(s.id); } }}>
      {s.label && <text x={CARD_W / 2} y="-5" textAnchor="middle" className="br-label">{s.label}</text>}
      <rect x="-2" y="-2" width={CARD_W + 4} height={CARD_H + 4} fill="#050a12" />
      {row(s.a, s.aWins, true, s)}{row(s.b, s.bWins, false, s, s.bSeed)}
      <path d={`M0 ${ROW}H${CARD_W}`} stroke="#2a3546" />
      <rect x="-1" y="-1" width={CARD_W + 2} height={CARD_H + 2} fill="none" stroke={selected ? '#f47b20' : s.winner ? '#8a6a2a' : '#2a3546'} strokeWidth="2" />
    </g>;
  };
  const champ = bracket.championTeamId ? teams.get(bracket.championTeamId) : undefined;
  const H = 610;
  return <div className="playoff-bracket-scroll">
    <svg className="playoff-bracket" viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Playoff bracket" shapeRendering="crispEdges">
      <defs><radialGradient id="br-glow" cx="50%" cy="45%" r="60%"><stop offset="0" stopColor="#1d3a63" /><stop offset=".6" stopColor="#0e1d33" /><stop offset="1" stopColor="#0b1018" /></radialGradient></defs>
      <rect width={W} height={H} fill="url(#br-glow)" />
      {Array.from({ length: 24 }, (_, i) => <rect key={i} x={0} y={i * 26} width={W} height="1" fill="#ffffff" opacity=".025" />)}
      <text x={CX} y="44" textAnchor="middle" className="br-title">PLAYOFFS</text>
      <text x={CX} y="66" textAnchor="middle" className="br-sub">{formatSeasonYear(season ?? league.season ?? '')} POSTSEASON</text>
      {(['west', 'east'] as Side[]).map(side => <g key={side}>
        <text transform={`translate(${side === 'west' ? 20 : W - 20},${mid(R1_Y[0], R1_Y[3] + CARD_H)}) rotate(${side === 'west' ? -90 : 90})`} textAnchor="middle" className="br-conf">{side.toUpperCase()}</text>
        {bracket.playIn && <text x={x(side, 'playIn') + CARD_W / 2} y={R1_Y[0] - 76} textAnchor="middle" className="br-col">PLAY-IN</text>}
        <text x={x(side, 'r1') + CARD_W / 2} y="100" textAnchor="middle" className="br-col">FIRST ROUND</text>
        <text x={x(side, 'r2') + CARD_W / 2} y={R2_Y[0] - 14} textAnchor="middle" className="br-col">CONF. SEMIS</text>
        <text x={x(side, 'cf') + CARD_W / 2} y={CF_Y - 14} textAnchor="middle" className="br-col">CONF. FINALS</text>
      </g>)}
      {lines.map((l, i) => <path key={i} d={l.d} fill="none" stroke={l.lit ? '#f4ce96' : '#3a4b63'} strokeWidth="2" />)}
      <text x={CX} y={FINALS_Y - 14} textAnchor="middle" className="br-finals">FINALS</text>
      <g transform={`translate(${CX - 16},${FINALS_Y - 86})`} className="br-trophy">
        <path d="M6 0H26V4H32V14H26V20H20V26H24V32H8V26H12V20H6V14H0V4H6Z" fill={champ ? '#ffd166' : '#5d6b7d'} />
        <path d="M4 6V12H6V6ZM26 6V12H28V6Z" fill="#0b1018" /><rect x="10" y="4" width="4" height="10" fill="#fff4d9" opacity=".5" />
      </g>
      {slots.map(card)}
      {champ && <g transform={`translate(${CX},${FINALS_Y + CARD_H + 20})`}>
        <g transform="translate(-26,0)"><TeamLogo team={champ} size={52} /></g>
        <text y="80" textAnchor="middle" className="br-champ">{champ.name.toUpperCase()}</text>
        <text y="96" textAnchor="middle" className="br-sub">CHAMPIONS</text>
      </g>}
    </svg>
  </div>;
}
