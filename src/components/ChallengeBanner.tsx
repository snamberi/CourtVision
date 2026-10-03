import type { League } from '../simulation/league';
import { plural } from '../lib/humanize';
import { computeStandings } from '../simulation/league';
import type { Contract } from '../simulation/gm';
import { rebuildSnapshot, type RebuildSnapshot } from '../simulation/rebuildSnapshot';
import { PlayerAvatar } from './PlayerAvatar';
import { challengeProgress, loadRebuildRecords } from '../simulation/rebuildChallenge';
import { formatSeasonYear } from '../simulation/calendar';
import { PixelIcon } from './PixelIcon';
import { ShareCardButton } from './ShareCardButton';
import { TWISTS } from '../retention/weekly';
import { PostScore } from './WeeklyBoard';
import { ClaimRankCard } from './cloud/ClaimRankCard';

const Stars = ({ n }: { n: number }) => <span className="rb-stars" aria-label={`${n} of 3 stars`}>{[1, 2, 3].map(i => <span key={i} className={i <= n ? 'on' : ''}><PixelIcon name="star" size={18} /></span>)}</span>;

const money = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;
const recordText = (r?: RebuildSnapshot['record']) => (r ? `${r.wins}-${r.losses}` : '—');
const signed = (n: number, unit = '') => `${n > 0 ? '+' : ''}${n}${unit}`;

/** One side of the split: the record, the payroll and the best three, with arrows against the other side when given. */
function Side({ label, when, snap, vs }: { label: string; when: string; snap: RebuildSnapshot; vs?: RebuildSnapshot }) {
  const winPct = (r?: RebuildSnapshot['record']) => (r && r.wins + r.losses ? r.wins / (r.wins + r.losses) : null);
  const now = winPct(snap.record), then = winPct(vs?.record);
  const pctDelta = now != null && then != null ? Math.round((now - then) * 1000) / 10 : null;
  const top = snap.stars[0]?.ovr, topThen = vs?.stars[0]?.ovr;
  return <div className={`rb-side ${vs ? 'now' : 'then'}`}>
    <small className="rb-side-label">{label} <em>{when}</em></small>
    <dl>
      <div><dt>Record</dt><dd>{recordText(snap.record)}{pctDelta != null && pctDelta !== 0 && <i className={pctDelta > 0 ? 'up' : 'down'}><PixelIcon name={pctDelta > 0 ? 'up' : 'down'} size={12} /> {signed(pctDelta, '%')}</i>}</dd></div>
      <div><dt>Payroll</dt><dd>{money(snap.payroll)}{vs && vs.payroll !== snap.payroll && <i className="flat">{signed(Math.round((snap.payroll - vs.payroll) / 100_000) / 10, 'M')}</i>}</dd></div>
      <div><dt>Best player</dt><dd>{top ?? '—'}{top != null && topThen != null && top !== topThen && <i className={top > topThen ? 'up' : 'down'}><PixelIcon name={top > topThen ? 'up' : 'down'} size={12} /> {signed(top - topThen)}</i>}</dd></div>
    </dl>
    <ul className="rb-stars-row" aria-label="Best three players">{snap.stars.map(p => <li key={p.id} title={`${p.id}: ${p.ovr} overall`}>
      <PlayerAvatar playerId={p.id} mode="portrait" size={26} primaryColor="#f47b20" secondaryColor="#f4f0e6" /><span>{p.id.split(' ').slice(-1)[0]}</span><b>{p.ovr}</b></li>)}</ul>
  </div>;
}

/** The before-and-after: the team as it was handed over against the team now, and the seasons left on the clock. */
function BeforeAfter({ league, contracts, p }: { league: League; contracts: Record<string, Contract>; p: NonNullable<ReturnType<typeof challengeProgress>> }) {
  const team = league.teams.find(t => t.teamId === p.config.teamId);
  const start = p.config.start;
  if (!team) return null;
  const row = computeStandings(league).find(r => r.teamId === team.teamId);
  const last = p.results.at(-1);
  const record = row && row.wins + row.losses > 0 ? { wins: row.wins, losses: row.losses, season: league.season ?? '' } : last ? { wins: last.wins, losses: last.losses, season: last.season } : undefined;
  const now = rebuildSnapshot(team, contracts, record);
  const first = Number(p.config.startSeason);
  const deadline = formatSeasonYear(String(first + p.config.seasons - 1));
  const left = p.config.seasons - p.results.length;
  return <div className="rb-split">
    {start && <Side label="HANDED OVER" when={start.record ? formatSeasonYear(start.record.season) : formatSeasonYear(p.config.startSeason)} snap={start} />}
    {start && <span className="rb-arrow" aria-hidden="true">➜</span>}
    <Side label={p.status === 'active' ? 'NOW' : 'FINAL'} when={record ? formatSeasonYear(record.season) : ''} snap={now} vs={start} />
    <div className="rb-clock" aria-label={`${left} season${left === 1 ? '' : 's'} left, deadline ${deadline}`}>
      <small>TITLE DEADLINE · {deadline}</small>
      <b>{p.status === 'won' ? 'DONE' : Math.max(0, left)}</b><span>{p.status === 'won' ? 'banner raised' : `season${left === 1 ? '' : 's'} left`}</span>
      <ol>{Array.from({ length: p.config.seasons }, (_, i) => { const r = p.results[i];
        return <li key={i} className={r ? (r.finish === 'Champion' ? 'won' : 'done') : i === p.results.length && p.status === 'active' ? 'here' : ''} title={r ? `Y${i + 1}: ${r.wins}-${r.losses} · ${r.finish}` : `Y${i + 1}: ${formatSeasonYear(String(first + i))}`} />; })}</ol>
    </div>
  </div>;
}

/** The Rebuild Challenge on the dashboard: the clock, the goal, the score so far, and the verdict when it ends. */
export function ChallengeBanner({ league, contracts, onMenu }: { league: League; contracts?: Record<string, Contract>; onMenu: () => void }) {
  const p = challengeProgress(league);
  if (!p) return null;
  const best = loadRebuildRecords()[p.scenario.id];
  const left = p.config.seasons - p.results.length;
  const over = p.status !== 'active';
  const twist = p.config.weekly ? TWISTS.find(t => t.id === p.config.weekly!.twist) : undefined;
  return <section className={`rb-banner ${p.status}`} aria-live="polite">
    <div className="rb-head">
      <span className="pixel-eyebrow"><PixelIcon name="trophy" size={14} /> {p.config.weekly ? `REBUILD OF THE WEEK ${p.config.weekly.week}` : 'REBUILD CHALLENGE'} · {p.scenario.difficulty.toUpperCase()}{twist && twist.id !== 'standard' ? ` · ${twist.label.toUpperCase()}` : ''}</span>
      <h2>{p.scenario.title}</h2>
      {!over && <p>Season <b>{p.seasonNumber}</b> of {p.config.seasons} · win a championship before the clock runs out{left === 1 ? ': this is the last season' : ''}.</p>}
      {p.status === 'won' && <p className="rb-verdict">Champions in season {p.titleIn}! The rebuild is complete.</p>}
      {p.status === 'failed' && <p className="rb-verdict">{p.fired ? 'You were fired: the challenge is over.' : `Time is up: no title in ${plural(p.config.seasons, 'season')}.`}</p>}
    </div>
    <div className="rb-score"><small>SCORE</small><b>{p.score.toLocaleString()}</b><Stars n={p.stars} />{best && <small>Best {best.best.toLocaleString()}</small>}</div>
    {contracts && <BeforeAfter league={league} contracts={contracts} p={p} />}
    {p.results.length > 0 && <ol className="rb-seasons">{p.results.map((r, i) => <li key={r.season} className={r.finish === 'Champion' ? 'won' : ''}><small>Y{i + 1} · {formatSeasonYear(r.season)}</small><b>{r.wins}-{r.losses}</b><span>{r.finish}</span></li>)}</ol>}
    {!p.official && <p className="hint-text">Sandbox was used in this league: the score does not go on the board.</p>}
    {over && <div className="contest-actions"><button className="primary" onClick={onMenu}>Back to the menu</button>
      <ShareCardButton fileName={`rebuild-${p.scenario.id}.png`} text={`Rebuild Challenge: ${p.scenario.title} · ${'★'.repeat(p.stars)}${'☆'.repeat(3 - p.stars)} · ${p.score.toLocaleString()} points`} spec={{
        kicker: `${p.config.weekly ? `Rebuild of the Week ${p.config.weekly.week}` : 'Rebuild Challenge'} · ${p.scenario.difficulty}`, title: p.scenario.title, stars: p.stars,
        subtitle: p.status === 'won' ? `Champions in season ${p.titleIn} of ${p.config.seasons}` : p.fired ? 'Fired before the job was done' : `No title in ${plural(p.config.seasons, 'season')}`,
        stats: [{ label: 'Score', value: p.score.toLocaleString() }, { label: 'Seasons', value: String(p.results.length) }, { label: 'Best record', value: (() => { const b = [...p.results].sort((x, y) => y.wins - x.wins)[0]; return b ? `${b.wins}-${b.losses}` : '—'; })() }],
        lines: p.results.map((r, i) => `Year ${i + 1}: ${r.wins}-${r.losses} · ${r.finish}`), accent: p.status === 'won' ? 'gold' : 'red',
      }} /><span className="hint-text">Or keep playing: the league goes on, the score is final.</span></div>}
    {over && p.config.weekly && p.official && !p.fired && <ClaimRankCard id={`rebuild:${p.config.weekly.week}:${p.scenario.id}`} board={{ kind: 'weekly', board: 'rebuild', week: p.config.weekly.week }} score={p.score} scored={`Your rebuild scored ${p.score.toLocaleString()}`} where="on this week's Rebuild board" />}
    {over && p.config.weekly && p.official && !p.fired && <PostScore board="rebuild" week={p.config.weekly.week} guestPitch={false} />}
  </section>;
}
