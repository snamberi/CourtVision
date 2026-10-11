import { useEffect } from 'react';
import type { League } from '../simulation/league';
import { decadeView, noteDecadeBest, readDecadeBest, DECADE_STARS } from '../simulation/decadeChallenge';
import { ShareCardButton } from './ShareCardButton';

/** The 10-Season Dynasty scoreboard on the dashboard: seasons played, score, stars, and the final card at the end. */
export function DecadeCard({ league, teamId }: { league: League; teamId: string | null }) {
  const v = decadeView(league, teamId);
  useEffect(() => { if (v?.done) noteDecadeBest(v); }, [v?.done, v?.score]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!v) return null;
  const best = readDecadeBest(), next = DECADE_STARS.find(s => v.score < s);
  return <section className={`decade-card ${v.done ? 'done' : ''}`} aria-label="10-Season Dynasty">
    <span className="pixel-eyebrow">10-SEASON DYNASTY · {v.done ? 'FINAL' : `SEASON ${Math.min(v.seasons, v.played + 1)} OF ${v.seasons}`}</span>
    <div className="decade-row">
      <b className="decade-score">{v.score.toLocaleString()}</b>
      <span className="decade-stars" aria-label={`${v.stars} of 3 stars`}>{'★'.repeat(v.stars)}{'☆'.repeat(3 - v.stars)}</span>
      <small>{v.titles} title{v.titles === 1 ? '' : 's'} · {next ? `${(next - v.score).toLocaleString()} to the next star` : 'all three stars'}{best ? ` · best ${best.score.toLocaleString()}` : ''}</small>
    </div>
    <i className="decade-bar" aria-hidden="true"><i style={{ width: `${(v.played / v.seasons) * 100}%` }} /></i>
    {v.rows.length > 0 && <ol className="decade-seasons">{v.rows.map(r => <li key={r.season} className={r.finish === 'Champion' ? 'title' : ''} title={`${r.wins}-${r.losses} · ${r.finish}`}><small>{r.season}</small><b>{r.points}</b></li>)}</ol>}
    <p className="hint-text">Wins score 10 each; a title 1,000, the Finals 500, the conference finals 300. Stars at {DECADE_STARS.map(s => s.toLocaleString()).join(', ')}.</p>
    {v.done && <ShareCardButton fileName="ten-season-dynasty.png" text={`My 10-Season Dynasty in Court Vision: ${v.score.toLocaleString()} points, ${v.titles} title${v.titles === 1 ? '' : 's'}!`} spec={{
      kicker: '10-SEASON DYNASTY', title: `${v.score.toLocaleString()} points`, subtitle: `${v.titles} championship${v.titles === 1 ? '' : 's'} in ten seasons`, stars: v.stars, accent: 'gold',
      stats: [{ label: 'Titles', value: `${v.titles}` }, { label: 'Wins', value: `${v.rows.reduce((n, r) => n + r.wins, 0)}` }, { label: 'Playoffs', value: `${v.rows.filter(r => r.finish !== 'Missed Playoffs').length}/10` }],
      lines: v.rows.map(r => `${r.season}: ${r.wins}-${r.losses} · ${r.finish}`).slice(0, 6),
    }} />}
  </section>;
}
