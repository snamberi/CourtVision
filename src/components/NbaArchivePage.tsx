import { Fragment, useEffect, useMemo, useState } from 'react';
import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import type { NbaHistory, HistPlayer, HistSeasonRow } from '../history/nbaHistoryData';
import { seasonText } from '../history/realDevelopment';
import { fx, NA } from './statFormat';
import { DataCredits } from './DataCredits';
import { preStartCount } from '../history/retirees';

/* NBA History archive: the real league's history up to this league's start, searchable with year filters.
 * Nothing at or after the start season is shown — from then on the simulation owns history. */

type View = 'players' | 'teams' | 'champions' | 'awards' | 'coverage';
const PAGE = 50;
const NBA = new Set(['BAA', 'NBA']);
const AWARDS: { key: string; label: string }[] = [
  { key: 'mvp', label: 'MVP' }, { key: 'fmvp', label: 'Finals MVP' }, { key: 'dpoy', label: 'Defensive Player of the Year' }, { key: 'roy', label: 'Rookie of the Year' },
  { key: 'mip', label: 'Most Improved Player' }, { key: 'smoy', label: 'Sixth Man of the Year' }, { key: 'clutch', label: 'Clutch Player of the Year' },
  { key: 'allLeague', label: 'All-NBA Teams' }, { key: 'allDefense', label: 'All-Defensive Teams' }, { key: 'allRookie', label: 'All-Rookie Teams' },
  { key: 'allStar', label: 'All-Star selections' }, { key: 'asgMvp', label: 'All-Star Game MVP' }, { key: 'coy', label: 'Coach of the Year' },
  { key: 'aba-mvp', label: 'ABA MVP' }, { key: 'aba-roy', label: 'ABA Rookie of the Year' },
];
const label = (end: number) => seasonText(end - 1);
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').toLowerCase();

interface CareerLine { p: HistPlayer; first: number; last: number; seasons: number; g: number; pts: number; trb: number | null; ast: number | null; teams: string[] }

export function NbaArchivePage({ league, extras, onSelectPlayer, initialQuery = '', onLoadRetirees }: { league: League; extras: GMLeagueExtras; onSelectPlayer: (id: string) => void; initialQuery?: string; onLoadRetirees?: () => Promise<void> }) {
  const meta = league.historical;
  const [h, setH] = useState<NbaHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('players');
  const [loading, setLoading] = useState(false);
  const loaded = preStartCount(league);
  useEffect(() => {
    let live = true;
    import('../history/nbaHistoryData').then(m => m.loadNbaHistory()).then(d => { if (live) setH(d); }, e => { if (live) setError(e instanceof Error ? e.message : String(e)); });
    return () => { live = false; };
  }, []);
  if (!meta) return <p className="empty-state">The NBA History archive is available in leagues started from real NBA history.</p>;
  const cutoff = meta.startYear + 1; // END-year of the start season: only seasons before it are shown
  const firstEnd = 1947, lastEnd = cutoff - 1;
  return (
    <div className="nba-archive">
      <div className="season-feature-header"><div><span className="pixel-eyebrow">REAL NBA · {lastEnd >= firstEnd ? `${label(firstEnd)} TO ${label(lastEnd)}` : 'NO SEASONS BEFORE THE START'}</span><h2>NBA History</h2></div></div>
      <p className="hint-text">Real NBA/BAA history up to this league's start ({seasonText(meta.startYear)}). From then on this league's own results are its history — see Almanac and History. Teams are listed by city.</p>
      <DataCredits />
      {onLoadRetirees && <div className="archive-load-all">
        {loaded > 0
          ? <p className="hint-text">{loaded.toLocaleString()} players who retired before the start are loaded in this league, with their profiles and careers.</p>
          : <><p className="hint-text">Players who retired before this league began are only in the archive. Load them to give every one of them a profile, and a place in all-time records and the Hall of Fame.</p>
            <button disabled={loading} onClick={() => { setLoading(true); void onLoadRetirees().finally(() => setLoading(false)); }}>{loading ? 'Loading…' : 'Load every retired player'}</button></>}
      </div>}
      <div className="code-mode-actions" role="group" aria-label="Archive sections">
        {(['players', 'teams', 'champions', 'awards', 'coverage'] as View[]).map(v => <button key={v} className={view === v ? 'active' : ''} aria-pressed={view === v} onClick={() => setView(v)}>{v[0].toUpperCase() + v.slice(1)}</button>)}
      </div>
      {error ? <p className="empty-state">Could not load the NBA history data: {error}</p>
        : !h ? <p className="empty-state">Loading NBA history…</p>
        : lastEnd < firstEnd && view !== 'coverage' ? <p className="empty-state">This league starts with the first BAA season, so there is no earlier history.</p>
        : view === 'players' ? <PlayersView h={h} cutoff={cutoff} league={league} extras={extras} onSelectPlayer={onSelectPlayer} initialQuery={initialQuery} />
        : view === 'teams' ? <TeamsView h={h} cutoff={cutoff} />
        : view === 'champions' ? <ChampionsView h={h} cutoff={cutoff} />
        : view === 'awards' ? <AwardsView h={h} cutoff={cutoff} />
        : <CoverageView h={h} />}
    </div>
  );
}

function YearRange({ from, to, min, max, onChange }: { from: number; to: number; min: number; max: number; onChange: (from: number, to: number) => void }) {
  const years = useMemo(() => Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => max - i), [min, max]);
  return <span className="archive-years">
    <label>From <select value={from} onChange={e => onChange(Number(e.target.value), Math.max(Number(e.target.value), to))}>{years.map(y => <option key={y} value={y}>{label(y)}</option>)}</select></label>
    <label>To <select value={to} onChange={e => onChange(Math.min(from, Number(e.target.value)), Number(e.target.value))}>{years.map(y => <option key={y} value={y}>{label(y)}</option>)}</select></label>
  </span>;
}

function PlayersView({ h, cutoff, league, extras, onSelectPlayer, initialQuery }: { h: NbaHistory; cutoff: number; league: League; extras: GMLeagueExtras; onSelectPlayer: (id: string) => void; initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [from, setFrom] = useState(1947), [to, setTo] = useState(cutoff - 1);
  const [status, setStatus] = useState<'all' | 'league' | 'retired'>('all');
  const [sort, setSort] = useState<'pts' | 'g' | 'last' | 'name'>('pts');
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const inLeague = useMemo(() => {
    const m = new Map<string, string>();
    const add = (p?: { real?: { id: string }; playerId: string }) => { if (p?.real) m.set(p.real.id, p.playerId); };
    league.teams.forEach(t => t.seasons.forEach(add)); extras.freeAgents.forEach(add); (league.retiredPlayers ?? []).forEach(r => { if (r.realId) m.set(r.realId, r.playerId); else add(r.finalSeasonData); });
    return m;
  }, [league.teams, league.retiredPlayers, extras.freeAgents]);
  const careers = useMemo(() => {
    const out: CareerLine[] = [];
    for (const p of h.players) {
      const rows = (h.seasonsByPlayer.get(p.idx) ?? []).filter(r => NBA.has(r.league) && r.season < cutoff && (r.isAggregate || !(h.seasonsByPlayer.get(p.idx) ?? []).some(a => a.isAggregate && a.season === r.season && NBA.has(a.league))));
      if (!rows.length) continue;
      let g = 0, pts = 0, trb: number | null = null, ast: number | null = null;
      for (const r of rows) { g += r.stats.g ?? 0; pts += r.stats.pts ?? 0; if (r.stats.trb != null) trb = (trb ?? 0) + r.stats.trb; if (r.stats.ast != null) ast = (ast ?? 0) + r.stats.ast; }
      const seasons = [...new Set(rows.map(r => r.season))];
      const teams = [...new Set((h.seasonsByPlayer.get(p.idx) ?? []).filter(r => NBA.has(r.league) && r.season < cutoff && !r.isAggregate).map(r => r.team))];
      out.push({ p, first: Math.min(...seasons), last: Math.max(...seasons), seasons: seasons.length, g, pts, trb, ast, teams });
    }
    return out;
  }, [h, cutoff]);
  const filtered = useMemo(() => {
    const q = fold(query.trim());
    const list = careers.filter(c => c.last >= from && c.first <= to
      && (!q || fold(c.p.displayName).includes(q) || c.p.aliases.some(a => fold(a).includes(q)))
      && (status === 'all' || (status === 'league' ? inLeague.has(c.p.id) : !inLeague.has(c.p.id))));
    const cmp: Record<typeof sort, (a: CareerLine, b: CareerLine) => number> = {
      pts: (a, b) => b.pts - a.pts, g: (a, b) => b.g - a.g, last: (a, b) => b.last - a.last || b.pts - a.pts, name: (a, b) => a.p.displayName.localeCompare(b.p.displayName),
    };
    return list.sort(cmp[sort]);
  }, [careers, query, from, to, status, sort, inLeague]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const shown = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const reset = () => setPage(0);
  return <section>
    <div className="archive-controls">
      <input className="db-search" type="search" placeholder="Search players (any spelling)…" aria-label="Search players" value={query} onChange={e => { setQuery(e.target.value); reset(); }} />
      <YearRange from={from} to={to} min={1947} max={cutoff - 1} onChange={(f, t) => { setFrom(f); setTo(t); reset(); }} />
      <label>Show <select value={status} onChange={e => { setStatus(e.target.value as typeof status); reset(); }}><option value="all">All players</option><option value="league">In this league</option><option value="retired">Not in this league</option></select></label>
      <label>Sort <select value={sort} onChange={e => { setSort(e.target.value as typeof sort); reset(); }}><option value="pts">Career points</option><option value="g">Games</option><option value="last">Most recent</option><option value="name">Name</option></select></label>
    </div>
    <p className="hint-text">{filtered.length.toLocaleString()} players · NBA/BAA regular seasons before {label(cutoff)}. Totals count each season once (traded players' team stints are listed inside their profile).</p>
    <div className="stat-table-scroll"><table className="db-table stat-line-table">
      <thead><tr><th className="col-name">Player</th><th>Years</th><th>Seasons</th><th>G</th><th>PTS</th><th>TRB</th><th>AST</th><th>PPG</th><th /></tr></thead>
      <tbody>{shown.map(c => <Fragment key={c.p.id}>
        <tr>
          <td className="col-name"><button className="link-button" onClick={() => setOpenId(openId === c.p.id ? null : c.p.id)} aria-expanded={openId === c.p.id}>{c.p.displayName}</button>{inLeague.has(c.p.id) && <span className="origin-tag sim">In league</span>}</td>
          <td>{label(c.first)}{c.last !== c.first ? ` – ${label(c.last)}` : ''}</td><td>{c.seasons}</td><td>{c.g}</td><td>{c.pts.toLocaleString()}</td>
          <td title={c.trb == null ? 'Rebounds were not recorded in his seasons' : undefined}>{c.trb == null ? NA : c.trb.toLocaleString()}</td><td>{c.ast == null ? NA : c.ast.toLocaleString()}</td><td>{fx(c.g ? c.pts / c.g : Number.NaN)}</td>
          <td>{inLeague.has(c.p.id) && <button onClick={() => onSelectPlayer(inLeague.get(c.p.id)!)}>Profile</button>}</td>
        </tr>
        {openId === c.p.id && <tr className="history-roster-row"><td colSpan={9}><ArchivePlayer h={h} p={c.p} cutoff={cutoff} /></td></tr>}
      </Fragment>)}</tbody>
    </table></div>
    <div className="archive-pager"><button disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page + 1} of {pages}</span><button disabled={page + 1 >= pages} onClick={() => setPage(p => p + 1)}>Next</button></div>
  </section>;
}

function ArchivePlayer({ h, p, cutoff }: { h: NbaHistory; p: HistPlayer; cutoff: number }) {
  const rows = (h.seasonsByPlayer.get(p.idx) ?? []).filter(r => r.season < cutoff);
  const aggregateSeasons = new Set(rows.filter(r => r.isAggregate).map(r => `${r.league}:${r.season}`));
  const awards = [
    ...h.awards.filter(a => a.player === p.idx && a.winner && a.season < cutoff).map(a => ({ season: a.season, text: (AWARDS.find(x => x.key === a.award)?.label ?? a.award) + (a.share != null ? ` (${(a.share * 100).toFixed(1)}% share)` : '') })),
    ...h.teamAwards.filter(a => a.player === p.idx && a.season < cutoff).map(a => ({ season: a.season, text: `${a.award === 'allLeague' ? 'All-NBA' : a.award === 'allDefense' ? 'All-Defensive' : a.award === 'allRookie' ? 'All-Rookie' : 'All-ABA'}${a.rank ? ` ${['1st', '2nd', '3rd'][a.rank - 1]} Team` : ''}` })),
    ...h.allStars.filter(a => a.player === p.idx && a.season < cutoff).map(a => ({ season: a.season, text: `${a.league === 'ABA' ? 'ABA ' : ''}All-Star` })),
    ...h.allStarMvp.filter(a => a.player === p.idx && a.season < cutoff).map(a => ({ season: a.season, text: 'All-Star Game MVP' })),
    ...h.champions.filter(c => c.season < cutoff && c.finalsMvp === p.idx).map(c => ({ season: c.season, text: 'Finals MVP' })),
    ...h.champions.filter(c => c.season < cutoff && c.rosterCredit.includes(p.idx)).map(c => ({ season: c.season, text: `NBA Champion (${c.champion})` })),
  ].sort((a, b) => a.season - b.season);
  const v = (x: number | null) => (x == null ? NA : x);
  const pct = (m: number | null, a: number | null) => (m == null || !a ? NA : String(Math.round(m / a * 100)));
  const line = (r: HistSeasonRow, split: boolean) => <tr key={`${r.league}${r.season}${r.team}${r.stintIndex}`} className={split ? 'split-row' : undefined}>
    <td>{split ? '↳' : label(r.season)}</td><td>{r.isAggregate ? 'TOT' : r.team}{r.league !== 'NBA' && !split ? <small> {r.league}</small> : null}</td><td>{split ? '' : v(r.age)}</td>
    <td>{v(r.stats.g)}</td><td>{v(r.stats.mp)}</td><td>{v(r.stats.pts)}</td><td>{v(r.stats.trb)}</td><td>{v(r.stats.ast)}</td><td>{v(r.stats.stl)}</td><td>{v(r.stats.blk)}</td><td>{v(r.stats.tov)}</td>
    <td>{pct(r.stats.fg, r.stats.fga)}</td><td>{pct(r.stats.x3p, r.stats.x3pa)}</td><td>{pct(r.stats.ft, r.stats.fta)}</td><td>{fx(r.adv?.per)}</td><td>{fx(r.adv?.ws)}</td>
  </tr>;
  return <div className="archive-player">
    <p><b>{p.displayName}</b> · {p.pos ?? '—'} · {p.heightIn ? `${Math.floor(p.heightIn / 12)}'${p.heightIn % 12}"` : '—'} · {p.weightLb ? `${p.weightLb} lbs` : '—'}{p.birthDate ? ` · born ${p.birthDate}` : ''}{p.college ? ` · ${p.college}` : ''}
      {' · '}{p.draft ? `${p.draft.year} draft, ${p.draft.round ? `round ${p.draft.round}, ` : ''}${p.draft.pick ? `pick ${p.draft.pick}` : ''} (${p.draft.team})` : 'Undrafted'}</p>
    <div className="stat-table-scroll"><table className="db-table stat-line-table">
      <thead><tr><th>Season</th><th>Team</th><th>Age</th><th>G</th><th>MIN</th><th>PTS</th><th>TRB</th><th>AST</th><th>STL</th><th>BLK</th><th>TOV</th><th>FG%</th><th>3P%</th><th>FT%</th><th>PER</th><th>WS</th></tr></thead>
      <tbody>{rows.filter(r => r.isAggregate || !aggregateSeasons.has(`${r.league}:${r.season}`)).map(r => <Fragment key={`${r.league}${r.season}${r.team}${r.stintIndex}`}>
        {line(r, false)}
        {r.isAggregate && rows.filter(s => !s.isAggregate && s.season === r.season && s.league === r.league).map(s => line(s, true))}
      </Fragment>)}</tbody>
    </table></div>
    {awards.length > 0 && <p className="hint-text">Honours: {awards.map(a => `${label(a.season)} ${a.text}`).join(' · ')}</p>}
    <p className="hint-text">— = not recorded in that era. Regular season only; playoff statistics are not in the data.</p>
  </div>;
}

function TeamsView({ h, cutoff }: { h: NbaHistory; cutoff: number }) {
  const [end, setEnd] = useState(cutoff - 1);
  const years = useMemo(() => Array.from({ length: Math.max(0, cutoff - 1947) }, (_, i) => cutoff - 1 - i), [cutoff]);
  const rows = h.teams.filter(t => t.season === end && NBA.has(t.league)).sort((a, b) => ((b.w ?? 0) / Math.max(1, (b.w ?? 0) + (b.l ?? 0))) - ((a.w ?? 0) / Math.max(1, (a.w ?? 0) + (a.l ?? 0))));
  const champ = h.champions.find(c => c.season === end);
  return <section>
    <div className="archive-controls"><label>Season <select value={end} onChange={e => setEnd(Number(e.target.value))}>{years.map(y => <option key={y} value={y}>{label(y)}</option>)}</select></label>
      <button disabled={end <= 1947} onClick={() => setEnd(e => e - 1)}>◀</button><button disabled={end >= cutoff - 1} onClick={() => setEnd(e => e + 1)}>▶</button></div>
    {champ && <p className="hint-text">Champion: <b>{champ.champion}</b> over {champ.runnerUp} ({champ.result}){champ.finalsMvp != null ? ` · Finals MVP ${h.players[champ.finalsMvp].displayName}` : ''}</p>}
    <div className="stat-table-scroll"><table className="db-table stat-line-table">
      <thead><tr><th className="col-name">Team</th><th>W</th><th>L</th><th>Win%</th><th>ORtg</th><th>DRtg</th><th>Pace</th><th>SRS</th><th>Playoffs</th></tr></thead>
      <tbody>{rows.map(t => <tr key={t.abbr} className={champ?.champion === t.abbr ? 'finish-champion' : undefined}>
        <td className="col-name">{t.name} <small>{t.abbr}</small></td><td>{t.w ?? NA}</td><td>{t.l ?? NA}</td><td>{t.w != null && t.l != null ? (t.w / Math.max(1, t.w + t.l)).toFixed(3).replace(/^0/, '') : NA}</td>
        <td>{fx(t.ortg)}</td><td>{fx(t.drtg)}</td><td>{fx(t.pace)}</td><td>{fx(t.srs, 2)}</td>
        <td>{champ?.champion === t.abbr ? '🏆 Champion' : champ?.runnerUp === t.abbr ? 'Finals' : t.playoffs ? 'Playoffs' : '—'}</td></tr>)}</tbody>
    </table></div>
  </section>;
}

function ChampionsView({ h, cutoff }: { h: NbaHistory; cutoff: number }) {
  const [from, setFrom] = useState(1947), [to, setTo] = useState(cutoff - 1);
  const [query, setQuery] = useState('');
  const q = fold(query.trim());
  const rows = h.champions.filter(c => c.season < cutoff && c.season >= from && c.season <= to && (!q || fold(c.champion + ' ' + c.runnerUp).includes(q) || fold(teamNameAt(h, c.champion, c.season)).includes(q))).sort((a, b) => b.season - a.season);
  return <section>
    <div className="archive-controls"><YearRange from={from} to={to} min={1947} max={cutoff - 1} onChange={(f, t) => { setFrom(f); setTo(t); }} />
      <input className="db-search" type="search" placeholder="Filter by team…" aria-label="Filter champions by team" value={query} onChange={e => setQuery(e.target.value)} /></div>
    <div className="stat-table-scroll"><table className="db-table stat-line-table">
      <thead><tr><th>Season</th><th className="col-name">Champion</th><th className="col-name">Runner-up</th><th>Result</th><th className="col-name">Finals MVP</th></tr></thead>
      <tbody>{rows.map(c => <tr key={c.season}><td>{label(c.season)}</td><td className="col-name">{teamNameAt(h, c.champion, c.season)}</td><td className="col-name">{teamNameAt(h, c.runnerUp, c.season)}</td><td>{c.result}</td><td className="col-name">{c.finalsMvp != null ? h.players[c.finalsMvp].displayName : c.season < 1969 ? 'Not awarded' : NA}</td></tr>)}</tbody>
    </table></div>
  </section>;
}
const teamNameAt = (h: NbaHistory, abbr: string, end: number) => h.teams.find(t => t.abbr === abbr && t.season === end)?.name ?? abbr;

function AwardsView({ h, cutoff }: { h: NbaHistory; cutoff: number }) {
  const [award, setAward] = useState('mvp');
  const [from, setFrom] = useState(1947), [to, setTo] = useState(cutoff - 1);
  const [query, setQuery] = useState('');
  const q = fold(query.trim());
  const name = (idx: number) => h.players[idx].displayName;
  const inRange = (s: number) => s < cutoff && s >= from && s <= to;
  const match = (n: string) => !q || fold(n).includes(q);
  const teamOf = (idx: number, end: number) => { const rs = (h.seasonsByPlayer.get(idx) ?? []).filter(r => r.season === end && !r.isAggregate); return rs[rs.length - 1]?.team ?? ''; };
  let body: { season: number; cells: (string | number)[] }[] = [];
  let head: string[] = [];
  if (['mvp', 'dpoy', 'roy', 'mip', 'smoy', 'clutch', 'aba-mvp', 'aba-roy'].includes(award)) {
    head = ['Winner', 'Team', 'Vote share', '1st-place votes'];
    body = h.awards.filter(a => a.award === award && a.winner && inRange(a.season) && match(name(a.player))).map(a => ({ season: a.season, cells: [name(a.player), teamOf(a.player, a.season), a.share != null ? `${(a.share * 100).toFixed(1)}%` : NA, a.firstVotes ?? NA] }));
  } else if (award === 'fmvp') {
    head = ['Finals MVP', 'Champion'];
    body = h.champions.filter(c => c.finalsMvp != null && inRange(c.season) && match(name(c.finalsMvp))).map(c => ({ season: c.season, cells: [name(c.finalsMvp!), c.champion] }));
  } else if (award === 'asgMvp') {
    head = ['All-Star Game MVP'];
    body = h.allStarMvp.filter(a => inRange(a.season) && match(name(a.player))).map(a => ({ season: a.season, cells: [name(a.player)] }));
  } else if (award === 'coy') {
    head = ['Coach', 'Team'];
    body = h.coachOfYear.filter(c => inRange(c.season) && match(c.coach)).map(c => ({ season: c.season, cells: [c.coach, c.team] }));
  } else if (award === 'allStar') {
    head = ['All-Star', 'Team', 'League'];
    body = h.allStars.filter(a => inRange(a.season) && match(name(a.player))).map(a => ({ season: a.season, cells: [name(a.player) + (a.replaced ? ' (replacement)' : ''), a.team, a.league] }));
  } else {
    head = ['Team', 'Player', 'Pos', 'League'];
    body = h.teamAwards.filter(a => a.award === award && inRange(a.season) && match(name(a.player))).sort((a, b) => b.season - a.season || (a.rank ?? 9) - (b.rank ?? 9))
      .map(a => ({ season: a.season, cells: [a.rank ? ['1st', '2nd', '3rd'][a.rank - 1] : NA, name(a.player), a.pos, a.league] }));
  }
  body.sort((a, b) => b.season - a.season);
  return <section>
    <div className="archive-controls">
      <label>Award <select value={award} onChange={e => setAward(e.target.value)}>{AWARDS.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}</select></label>
      <YearRange from={from} to={to} min={1947} max={cutoff - 1} onChange={(f, t) => { setFrom(f); setTo(t); }} />
      <input className="db-search" type="search" placeholder="Filter by name…" aria-label="Filter awards by name" value={query} onChange={e => setQuery(e.target.value)} />
    </div>
    {body.length === 0 ? <p className="empty-state">No recipients in this range{award === 'clutch' ? ' (Clutch Player of the Year starts in 2022–23)' : award === 'fmvp' ? ' (Finals MVP starts in 1968–69)' : ''}.</p>
      : <div className="stat-table-scroll"><table className="db-table stat-line-table"><thead><tr><th>Season</th>{head.map(x => <th key={x} className={x === 'Winner' || x === 'Player' || x === 'Coach' ? 'col-name' : undefined}>{x}</th>)}</tr></thead>
        <tbody>{body.map((r, i) => <tr key={i}><td>{label(r.season)}</td>{r.cells.map((c, j) => <td key={j} className={head[j] === 'Winner' || head[j] === 'Player' || head[j] === 'Coach' ? 'col-name' : undefined}>{c}</td>)}</tr>)}</tbody></table></div>}
    <p className="hint-text">Co-winners are listed separately. Coach of the Year belongs to coach history and is never credited to a player.</p>
  </section>;
}

function CoverageView({ h }: { h: NbaHistory }) {
  const m = h.manifest;
  return <section>
    <h4>Sources</h4>
    <div className="stat-table-scroll"><table className="db-table"><thead><tr><th className="col-name">Source</th><th>Licence / terms</th><th>Retrieved</th></tr></thead>
      <tbody>{m.sources.map(s => <tr key={s.name}><td className="col-name"><a href={s.url} target="_blank" rel="noreferrer">{s.name}</a>{s.commit ? <small> @{s.commit.slice(0, 7)}</small> : null}</td><td>{s.license}</td><td>{s.retrieved}</td></tr>)}</tbody></table></div>
    <h4>Coverage</h4>
    <ul className="hint-text">{m.report.map((r, i) => <li key={i}>{r}</li>)}</ul>
    <h4>Not in the data</h4>
    <ul className="hint-text">{(m.limitations ?? []).map((g, i) => <li key={i}>{g}</li>)}</ul>
    <h4>Build warnings</h4>
    <ul className="hint-text">{m.gaps.length ? m.gaps.map((g, i) => <li key={i}>{g}</li>) : <li>None.</li>}</ul>
    <h4>How ratings are made</h4>
    <ul className="hint-text">
      <li>{m.ratingMethod.description}</li>
      <li>Check against real honours: MVPs rank #{m.ratingMethod.validation.mvpMedianRankNextSeason} (median) in the next season's ratings, {Math.round(m.ratingMethod.validation.mvpTop5Share * 100)}% of them in the top five; All-NBA First Team players rank #{m.ratingMethod.validation.allNbaFirstTeamMedianRankNextSeason}.</li>
      <li>They measure box-score production, so defence-first players and seasons before 1973–74 are less certain. No video-game or publisher ratings are used.</li>
    </ul>
    <p className="hint-text">Dataset {m.dataset} (schema {m.schema}), built {m.builtAt}.</p>
  </section>;
}
