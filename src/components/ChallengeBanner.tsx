import type { League } from '../simulation/league';
import { challengeProgress, loadRebuildRecords } from '../simulation/rebuildChallenge';
import { formatSeasonYear } from '../simulation/calendar';
import { PixelIcon } from './PixelIcon';
import { ShareCardButton } from './ShareCardButton';

const Stars = ({ n }: { n: number }) => <span className="rb-stars" aria-label={`${n} of 3 stars`}>{[1, 2, 3].map(i => <span key={i} className={i <= n ? 'on' : ''}>★</span>)}</span>;

/** The Rebuild Challenge on the dashboard: the clock, the goal, the score so far, and the verdict when it ends. */
export function ChallengeBanner({ league, onMenu }: { league: League; onMenu: () => void }) {
  const p = challengeProgress(league);
  if (!p) return null;
  const best = loadRebuildRecords()[p.scenario.id];
  const left = p.config.seasons - p.results.length;
  const over = p.status !== 'active';
  return <section className={`rb-banner ${p.status}`} aria-live="polite">
    <div className="rb-head">
      <span className="pixel-eyebrow"><PixelIcon name="trophy" size={14} /> REBUILD CHALLENGE · {p.scenario.difficulty.toUpperCase()}</span>
      <h2>{p.scenario.title}</h2>
      {!over && <p>Season <b>{p.seasonNumber}</b> of {p.config.seasons} · win a championship before the clock runs out{left === 1 ? ': this is the last season' : ''}.</p>}
      {p.status === 'won' && <p className="rb-verdict">Champions in season {p.titleIn}! The rebuild is complete.</p>}
      {p.status === 'failed' && <p className="rb-verdict">{p.fired ? 'You were fired: the challenge is over.' : `Time is up: no title in ${p.config.seasons} seasons.`}</p>}
    </div>
    <div className="rb-score"><small>SCORE</small><b>{p.score.toLocaleString()}</b><Stars n={p.stars} />{best && <small>Best {best.best.toLocaleString()}</small>}</div>
    {p.results.length > 0 && <ol className="rb-seasons">{p.results.map((r, i) => <li key={r.season} className={r.finish === 'Champion' ? 'won' : ''}><small>Y{i + 1} · {formatSeasonYear(r.season)}</small><b>{r.wins}-{r.losses}</b><span>{r.finish}</span></li>)}</ol>}
    {!p.official && <p className="hint-text">Sandbox was used in this league: the score does not go on the board.</p>}
    {over && <div className="contest-actions"><button className="primary" onClick={onMenu}>Back to the menu</button>
      <ShareCardButton fileName={`rebuild-${p.scenario.id}.png`} text={`Rebuild Challenge: ${p.scenario.title} · ${'★'.repeat(p.stars)}${'☆'.repeat(3 - p.stars)} · ${p.score.toLocaleString()} points`} spec={{
        kicker: `Rebuild Challenge · ${p.scenario.difficulty}`, title: p.scenario.title, stars: p.stars,
        subtitle: p.status === 'won' ? `Champions in season ${p.titleIn} of ${p.config.seasons}` : p.fired ? 'Fired before the job was done' : `No title in ${p.config.seasons} seasons`,
        stats: [{ label: 'Score', value: p.score.toLocaleString() }, { label: 'Seasons', value: String(p.results.length) }, { label: 'Best record', value: (() => { const b = [...p.results].sort((x, y) => y.wins - x.wins)[0]; return b ? `${b.wins}-${b.losses}` : '—'; })() }],
        lines: p.results.map((r, i) => `Year ${i + 1}: ${r.wins}-${r.losses} · ${r.finish}`), accent: p.status === 'won' ? 'gold' : 'red',
      }} /><span className="hint-text">Or keep playing: the league goes on, the score is final.</span></div>}
  </section>;
}
