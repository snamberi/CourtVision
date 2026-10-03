import { useMemo } from 'react';
import type { League } from '../simulation/league';
import { historyBook } from '../simulation/dynasty';
import { formatSeasonYear } from '../simulation/calendar';
import { PixelIcon } from './PixelIcon';

/** The History Book: the league's story, one chapter per decade, written from the archive as the seasons go by. */
export function HistoryBookPage({ league, onSelectPlayer }: { league: League; onSelectPlayer: (id: string) => void }) {
  const chapters = useMemo(() => historyBook(league), [league]);
  const d = league.dynasty;
  const owners = d ? Object.entries(d.owners).map(([teamId, o]) => ({ team: league.teams.find(t => t.teamId === teamId)?.name ?? teamId, ...o })).sort((a, b) => a.since.localeCompare(b.since)) : [];
  return <article className="history-book">
    <header className="history-book-head">
      <span className="pixel-eyebrow"><PixelIcon name="list" size={12} /> {d ? `DYNASTY SINCE ${formatSeasonYear(d.startSeason)}` : 'THE LEAGUE STORY'}</span>
      <h2>History Book</h2>
      <p className="hint-text">Every decade gets a chapter: champions, dynasties, MVPs, the best team, moves and new owners, and the sons of former players who came into the league. It writes itself as you play.</p>
    </header>
    {!chapters.length && <p className="empty-state">The first chapter is written when your first season ends.</p>}
    {[...chapters].reverse().map(ch => <section key={ch.title} className="history-chapter">
      <h3>{ch.title} <small>{formatSeasonYear(ch.from)} to {formatSeasonYear(ch.to)}</small></h3>
      {ch.story.length > 0 && <div className="history-story">{ch.story.map((s, i) => <p key={i}>{s}</p>)}</div>}
      <div className="history-grid">
        <div><h4><PixelIcon name="trophy" size={12} /> Champions</h4><ol>{ch.champions.map(c => <li key={c.season}><small>{formatSeasonYear(c.season)}</small> {c.team}</li>)}</ol></div>
        {ch.mvps.length > 0 && <div><h4><PixelIcon name="star" size={12} /> MVPs</h4><ol>{ch.mvps.map(m => <li key={m.player}><button className="link-button" onClick={() => onSelectPlayer(m.player)}>{m.player}</button>{m.times > 1 ? ` ×${m.times}` : ''}</li>)}</ol></div>}
        {ch.moves.length > 0 && <div><h4><PixelIcon name="team" size={12} /> Off the court</h4><ul>{ch.moves.map((m, i) => <li key={i}>{m}</li>)}</ul></div>}
        {ch.sons.length > 0 && <div><h4><PixelIcon name="up" size={12} /> Next generation</h4><ul>{ch.sons.map(s => <li key={s}>{s}</li>)}</ul></div>}
      </div>
    </section>)}
    {owners.length > 0 && <section className="history-chapter">
      <h3>The owners</h3>
      <ul className="history-owners">{owners.map(o => <li key={o.team}><b>{o.team}</b><span>{o.name}</span><small>since {formatSeasonYear(o.since)}</small></li>)}</ul>
    </section>}
  </article>;
}
