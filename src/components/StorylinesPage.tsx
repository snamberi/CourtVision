import { useMemo, useState } from 'react';
import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import { storylines, type StorylineKind } from '../simulation/storylines';
import { rivalryTable } from '../simulation/rivalry';
import { TeamLink } from './TeamLink';

interface Props { league: League; extras: GMLeagueExtras; controlledTeamId: string | null; onSelectPlayer: (id: string) => void }

const KIND_LABEL: Record<StorylineKind, string> = { chase: 'CHASE', revenge: 'REVENGE GAME', rivalry: 'RIVALRY', streak: 'STREAK', race: 'RACE' };

/** What the league is talking about: chases, revenge games, rivalry nights, streaks and races, plus the rivalry table. */
export function StorylinesPage({ league, extras, controlledTeamId, onSelectPlayer }: Props) {
  const [kind, setKind] = useState<StorylineKind | 'all'>('all');
  const list = useMemo(() => storylines(league, extras, controlledTeamId), [league, extras, controlledTeamId]);
  const rivals = useMemo(() => rivalryTable(league).filter(r => r.level).slice(0, 12), [league]);
  const name = (id: string) => league.teams.find(t => t.teamId === id)?.name ?? id;
  const shown = list.filter(s => kind === 'all' || s.kind === kind).slice(0, 40);
  return <div className="storylines-page">
    <header><span className="pixel-eyebrow">AROUND THE LEAGUE</span><h2>Storylines</h2></header>
    <div className="stats-view-toggle" role="tablist" aria-label="Storyline kinds">
      {(['all', 'chase', 'revenge', 'rivalry', 'streak', 'race'] as const).map(k => <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? 'active' : ''} onClick={() => setKind(k)}>{k === 'all' ? `All (${list.length})` : `${KIND_LABEL[k][0]}${KIND_LABEL[k].slice(1).toLowerCase()} (${list.filter(s => s.kind === k).length})`}</button>)}
    </div>
    {shown.length === 0 ? <p className="empty-state">{(league.seasonPhase ?? 'regular_season') === 'regular_season' || league.seasonPhase === 'playoffs' ? 'Nothing brewing yet. Stories build as the season is played.' : 'Storylines return when the season tips off.'}</p>
      : <ol className="storyline-list">{shown.map(s => <li key={s.id} className={`storyline storyline-${s.kind}${controlledTeamId && s.teamIds.includes(controlledTeamId) ? ' mine' : ''}`}>
        <small>{KIND_LABEL[s.kind]}</small>
        <b>{s.playerId ? <button className="link-button" onClick={() => onSelectPlayer(s.playerId!)}>{s.headline}</button> : s.headline}</b>
        <span className="hint-text">{s.detail}</span>
      </li>)}</ol>}
    <section>
      <h3>Rivalries</h3>
      {rivals.length === 0 ? <p className="hint-text">No rivalries yet. They build from playoff series, close games and trades between the same teams.</p>
        : <div className="finances-table-wrap"><table className="db-table"><thead><tr><th className="col-name">Rivalry</th><th>Level</th><th>Games</th><th>Series</th><th>Game 7s</th><th>Last playoff meeting</th></tr></thead>
          <tbody>{rivals.map(r => { const last = r.eliminations[r.eliminations.length - 1]; return <tr key={`${r.a}|${r.b}`}>
            <td className="col-name"><TeamLink name={name(r.a)} /> vs <TeamLink name={name(r.b)} /></td><td>{r.level}</td><td>{r.winsA}–{r.winsB}</td><td>{r.seriesWinsA}–{r.seriesWinsB}</td><td>{r.gameSevens}</td>
            <td>{last ? `${last.season}: ${name(last.winner)}` : '—'}</td></tr>; })}</tbody></table></div>}
    </section>
  </div>;
}
