import type { ReactNode } from 'react';
import { COUNTRY_BY_NAME, type Medal } from '../../worldGames/data';
import { groupTable, GROUP_NAMES, type WGGame, type WGLine, type Stage } from '../../worldGames/tournament';
import './worldGames.css';

/*
 * The World Games pieces shared by the league page and the World Games mode: a pixel flag, the podium, the group tables,
 * the knockout games and the tournament leaders.
 */

export function Flag({ country, size = 18 }: { country: string; size?: number }) {
  const c = COUNTRY_BY_NAME.get(country);
  const [a, b] = c?.colors ?? ['#555555', '#999999'];
  return <span className="wg-flag" style={{ width: size * 1.5, height: size, background: `linear-gradient(180deg, ${a} 0 50%, ${b} 50% 100%)` }} title={country} aria-hidden="true" />;
}
export const CountryName = ({ country, bold }: { country: string; bold?: boolean }) =>
  <span className="wg-country"><Flag country={country} />{bold ? <b>{country}</b> : country}</span>;

const MEDAL_TEXT: Record<Medal, string> = { gold: 'GOLD', silver: 'SILVER', bronze: 'BRONZE' };

export function Podium({ gold, silver, bronze, final }: { gold: string; silver: string; bronze: string; final?: WGGame }) {
  const step = (m: Medal, country: string) => <div className={`wg-step ${m}`}>
    <span className="wg-medal" aria-hidden="true"><i /></span>
    <Flag country={country} size={26} />
    <b>{country}</b>
    <small>{MEDAL_TEXT[m]}</small>
  </div>;
  return <div className="wg-podium" aria-label={`Gold ${gold}, silver ${silver}, bronze ${bronze}`}>
    {step('silver', silver)}{step('gold', gold)}{step('bronze', bronze)}
    {final && <p className="wg-final-line">Final: {final.a} {final.as}-{final.bs} {final.b}{final.ot ? ' (OT)' : ''}</p>}
  </div>;
}

export function GroupTables({ groups, games, highlight }: { groups: string[][]; games: WGGame[]; highlight?: string }) {
  return <div className="wg-groups">{groups.map((_, g) => {
    const rows = groupTable({ groups, games }, g);
    return <table key={g} className="db-table wg-group">
      <caption>Group {GROUP_NAMES[g]}</caption>
      <thead><tr><th>Country</th><th>W</th><th>L</th><th>+/-</th></tr></thead>
      <tbody>{rows.map((r, i) => <tr key={r.country} className={`${r.country === highlight ? 'wg-mine' : ''} ${i < 2 ? 'wg-through' : ''}`}>
        <td><CountryName country={r.country} /></td><td>{r.w}</td><td>{r.l}</td><td>{r.pf - r.pa > 0 ? '+' : ''}{r.pf - r.pa}</td>
      </tr>)}</tbody>
    </table>;
  })}</div>;
}

const STAGE_LABEL: Record<Stage, string> = { group: 'Group', qf: 'Quarterfinals', sf: 'Semifinals', bronze: 'Bronze game', final: 'Final' };

export function GameList({ games, highlight, title }: { games: WGGame[]; highlight?: string; title?: ReactNode }) {
  if (!games.length) return null;
  return <div className="wg-games">
    {title && <h4 className="hunt-subhead">{title}</h4>}
    <ul>{games.map((g, i) => {
      const won = (c: string) => g.winner === c;
      return <li key={i} className={`wg-game ${highlight && (g.a === highlight || g.b === highlight) ? 'wg-mine' : ''} ${g.stage === 'final' ? 'wg-final' : ''}`}>
        <small>{g.stage === 'group' ? `Group ${GROUP_NAMES[g.group ?? 0]}` : STAGE_LABEL[g.stage]}</small>
        <span className={won(g.a) ? 'won' : ''}><CountryName country={g.a} /> <b>{g.as}</b></span>
        <span className={won(g.b) ? 'won' : ''}><CountryName country={g.b} /> <b>{g.bs}</b></span>
        {g.top.id && <em>{g.top.id} {g.top.pts} pts{g.ot ? ' · OT' : ''}</em>}
      </li>;
    })}</ul>
  </div>;
}

export function Knockouts({ games, highlight }: { games: WGGame[]; highlight?: string }) {
  const ko = (['qf', 'sf', 'bronze', 'final'] as Stage[]).map(s => games.filter(g => g.stage === s));
  if (!ko[0].length) return null;
  return <div className="wg-knockouts">{ko.map((list, i) => list.length ? <GameList key={i} games={list} highlight={highlight} title={STAGE_LABEL[(['qf', 'sf', 'bronze', 'final'] as Stage[])[i]]} /> : null)}</div>;
}

const pg = (v: number, g: number) => String(Math.round(v / Math.max(1, g)));

export function Leaders({ lines, mvp, allTournament, onSelectPlayer }: { lines: WGLine[]; mvp: WGLine | null; allTournament: WGLine[]; onSelectPlayer?: (id: string) => void }) {
  const name = (id: string) => (onSelectPlayer ? <button className="link-button" onClick={() => onSelectPlayer(id)}>{id}</button> : id);
  return <div className="wg-leaders">
    {mvp && <div className="wg-mvp"><span className="pixel-eyebrow">TOURNAMENT MVP</span><b>{name(mvp.id)}</b><span><CountryName country={mvp.country} /> · {pg(mvp.pts, mvp.g)} PTS · {pg(mvp.reb, mvp.g)} REB · {pg(mvp.ast, mvp.g)} AST</span></div>}
    {allTournament.length > 0 && <div><h4 className="hunt-subhead">All-Tournament team</h4>
      <ul className="wg-five">{allTournament.map(l => <li key={l.id}><b>{name(l.id)}</b><small><CountryName country={l.country} /> · {pg(l.pts, l.g)} PTS</small></li>)}</ul></div>}
    <div className="feature-table-scroll"><table className="db-table wg-lines">
      <thead><tr><th>Player</th><th>Country</th><th>G</th><th>PTS</th><th>REB</th><th>AST</th></tr></thead>
      <tbody>{lines.slice(0, 15).map(l => <tr key={l.id}><td>{name(l.id)}</td><td><CountryName country={l.country} /></td><td>{l.g}</td><td>{pg(l.pts, l.g)}</td><td>{pg(l.reb, l.g)}</td><td>{pg(l.ast, l.g)}</td></tr>)}</tbody>
    </table></div>
  </div>;
}

/** All-time medal table across a league's Games. */
export function MedalTable({ records }: { records: { gold: string; silver: string; bronze: string }[] }) {
  const t = new Map<string, [number, number, number]>();
  for (const r of records) for (const [i, c] of [r.gold, r.silver, r.bronze].entries()) { const row = t.get(c) ?? [0, 0, 0]; row[i]++; t.set(c, row); }
  const rows = [...t].sort((a, b) => b[1][0] - a[1][0] || b[1][1] - a[1][1] || b[1][2] - a[1][2]);
  if (!rows.length) return null;
  return <table className="db-table wg-medal-table"><thead><tr><th>Country</th><th>🥇</th><th>🥈</th><th>🥉</th></tr></thead>
    <tbody>{rows.map(([c, [g, s, b]]) => <tr key={c}><td><CountryName country={c} /></td><td>{g}</td><td>{s}</td><td>{b}</td></tr>)}</tbody></table>;
}
