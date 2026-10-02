import { TeamLink } from './TeamLink';
import { useMemo, useState } from 'react';
import type { League, LeagueTeam } from '../simulation/league';
import type { PlayerSeason, SeasonStatTotals } from '../simulation/types';
import { emptySeasonMilestones, emptySeasonStatTotals } from '../simulation/types';
import { currentSeasonAdvanced, type PlayerAdvanced } from '../simulation/advancedStats';

interface Props {
  teams: LeagueTeam[];
  /** Needed for PER, win shares and the other team-context stats. */
  league?: League;
  onSelect: (playerId: string) => void;
}

type ViewMode = 'perGame' | 'totals' | 'shooting' | 'advanced' | 'winShares' | 'playoffs' | 'milestones';
interface Row { season: PlayerSeason; teamName: string; s: SeasonStatTotals; p: SeasonStatTotals; adv?: PlayerAdvanced }
interface Col { key: string; label: string; title?: string; value: (r: Row) => number; fmt: (v: number) => string; lowerIsBetter?: boolean }

const gp = (s: SeasonStatTotals) => Math.max(1, s.gamesPlayed);
// Per-game numbers and percentages show as whole numbers; ratios that need decimals (PTS/FGA, WS/48) keep them.
const f1 = (v: number) => Math.round(v).toString(), f2 = (v: number) => v.toFixed(2), f3 = (v: number) => v.toFixed(3).replace(/^0/, ''), i0 = (v: number) => Math.round(v).toString();
const pct = (v: number) => Math.round(v * 100).toString();
const safe = (n: number, d: number) => d > 0 ? n / d : 0;
const perGameCols = (pick: (r: Row) => SeasonStatTotals): Col[] => [
  { key: 'mpg', label: 'MIN', value: r => pick(r).minutes / gp(pick(r)), fmt: f1 },
  { key: 'ppg', label: 'PTS', value: r => pick(r).points / gp(pick(r)), fmt: f1 },
  { key: 'rpg', label: 'REB', value: r => (pick(r).oreb + pick(r).dreb) / gp(pick(r)), fmt: f1 },
  { key: 'orpg', label: 'ORB', value: r => pick(r).oreb / gp(pick(r)), fmt: f1 },
  { key: 'drpg', label: 'DRB', value: r => pick(r).dreb / gp(pick(r)), fmt: f1 },
  { key: 'apg', label: 'AST', value: r => pick(r).ast / gp(pick(r)), fmt: f1 },
  { key: 'spg', label: 'STL', value: r => pick(r).stl / gp(pick(r)), fmt: f1 },
  { key: 'bpg', label: 'BLK', value: r => pick(r).blk / gp(pick(r)), fmt: f1 },
  { key: 'tov', label: 'TOV', value: r => pick(r).tov / gp(pick(r)), fmt: f1, lowerIsBetter: true },
  { key: 'pf', label: 'PF', value: r => pick(r).pf / gp(pick(r)), fmt: f1, lowerIsBetter: true },
  { key: 'fg', label: 'FG%', value: r => safe(pick(r).fgm, pick(r).fga), fmt: pct },
  { key: 'tp', label: '3P%', value: r => safe(pick(r).tpm, pick(r).tpa), fmt: pct },
  { key: 'ft', label: 'FT%', value: r => safe(pick(r).ftm, pick(r).fta), fmt: pct },
];
const COLS: Record<ViewMode, Col[]> = {
  perGame: perGameCols(r => r.s),
  totals: [
    { key: 'min', label: 'MIN', value: r => r.s.minutes, fmt: i0 }, { key: 'pts', label: 'PTS', value: r => r.s.points, fmt: i0 },
    { key: 'fgm', label: 'FGM', value: r => r.s.fgm, fmt: i0 }, { key: 'fga', label: 'FGA', value: r => r.s.fga, fmt: i0 },
    { key: 'tpm', label: '3PM', value: r => r.s.tpm, fmt: i0 }, { key: 'tpa', label: '3PA', value: r => r.s.tpa, fmt: i0 },
    { key: 'ftm', label: 'FTM', value: r => r.s.ftm, fmt: i0 }, { key: 'fta', label: 'FTA', value: r => r.s.fta, fmt: i0 },
    { key: 'orb', label: 'ORB', value: r => r.s.oreb, fmt: i0 }, { key: 'drb', label: 'DRB', value: r => r.s.dreb, fmt: i0 },
    { key: 'trb', label: 'TRB', value: r => r.s.oreb + r.s.dreb, fmt: i0 }, { key: 'ast', label: 'AST', value: r => r.s.ast, fmt: i0 },
    { key: 'stl', label: 'STL', value: r => r.s.stl, fmt: i0 }, { key: 'blk', label: 'BLK', value: r => r.s.blk, fmt: i0 },
    { key: 'tovt', label: 'TOV', value: r => r.s.tov, fmt: i0, lowerIsBetter: true }, { key: 'pft', label: 'PF', value: r => r.s.pf, fmt: i0, lowerIsBetter: true },
    { key: 'clutch', label: 'CLUTCH', title: 'Clutch points', value: r => r.s.clutchPoints, fmt: i0 },
  ],
  shooting: [
    { key: 'fgpg', label: 'FGM', value: r => r.s.fgm / gp(r.s), fmt: f1 }, { key: 'fg', label: 'FG%', value: r => safe(r.s.fgm, r.s.fga), fmt: pct },
    { key: 'tp', label: '3P%', value: r => safe(r.s.tpm, r.s.tpa), fmt: pct }, { key: 'tpmpg', label: '3PM', value: r => r.s.tpm / gp(r.s), fmt: f1 },
    { key: 'ft', label: 'FT%', value: r => safe(r.s.ftm, r.s.fta), fmt: pct }, { key: 'ts', label: 'TS%', value: r => safe(r.s.points, 2 * (r.s.fga + 0.44 * r.s.fta)), fmt: pct },
    { key: 'efg', label: 'eFG%', value: r => safe(r.s.fgm + 0.5 * r.s.tpm, r.s.fga), fmt: pct }, { key: 'tpar', label: '3PAr', title: 'Share of shots from three', value: r => safe(r.s.tpa, r.s.fga), fmt: pct },
    { key: 'ftr', label: 'FTr', title: 'Free-throw attempts per field-goal attempt', value: r => safe(r.s.fta, r.s.fga), fmt: pct },
    { key: 'pps', label: 'PTS/FGA', value: r => safe(r.s.points, r.s.fga), fmt: f2 }, { key: 'blkd', label: 'BLKD', title: 'Own shots blocked', value: r => r.s.ba, fmt: i0, lowerIsBetter: true },
  ],
  advanced: [
    { key: 'per', label: 'PER', title: 'Player Efficiency Rating (league average = 15)', value: r => r.adv?.per ?? 0, fmt: f1 },
    { key: 'ts', label: 'TS%', value: r => r.adv?.tsPct ?? 0, fmt: pct }, { key: 'usg', label: 'USG%', title: 'Usage rate', value: r => r.adv?.usgPct ?? 0, fmt: f1 },
    { key: 'orbp', label: 'ORB%', value: r => r.adv?.orbPct ?? 0, fmt: f1 }, { key: 'drbp', label: 'DRB%', value: r => r.adv?.drbPct ?? 0, fmt: f1 },
    { key: 'trbp', label: 'TRB%', value: r => r.adv?.trbPct ?? 0, fmt: f1 }, { key: 'astp', label: 'AST%', value: r => r.adv?.astPct ?? 0, fmt: f1 },
    { key: 'stlp', label: 'STL%', value: r => r.adv?.stlPct ?? 0, fmt: f1 }, { key: 'blkp', label: 'BLK%', value: r => r.adv?.blkPct ?? 0, fmt: f1 },
    { key: 'tovp', label: 'TOV%', value: r => r.adv?.tovPct ?? 0, fmt: f1, lowerIsBetter: true },
    { key: 'ortg', label: 'ORtg', title: 'Points produced per 100 possessions used', value: r => r.adv?.ortg ?? 0, fmt: f1 },
    { key: 'drtg', label: 'DRtg', title: 'Points allowed per 100 possessions (lower is better)', value: r => r.adv?.drtg ?? 0, fmt: f1, lowerIsBetter: true },
    { key: 'asttov', label: 'AST/TO', value: r => safe(r.s.ast, Math.max(1, r.s.tov)), fmt: f2 },
  ],
  winShares: [
    { key: 'ows', label: 'OWS', title: 'Offensive Win Shares', value: r => r.adv?.ows ?? 0, fmt: f1 },
    { key: 'dws', label: 'DWS', title: 'Defensive Win Shares', value: r => r.adv?.dws ?? 0, fmt: f1 },
    { key: 'ws', label: 'WS', title: 'Win Shares', value: r => r.adv?.ws ?? 0, fmt: f1 },
    { key: 'ws48', label: 'WS/48', value: r => r.adv?.ws48 ?? 0, fmt: f3 },
    { key: 'per', label: 'PER', value: r => r.adv?.per ?? 0, fmt: f1 },
    { key: 'ortg', label: 'ORtg', value: r => r.adv?.ortg ?? 0, fmt: f1 },
    { key: 'drtg', label: 'DRtg', value: r => r.adv?.drtg ?? 0, fmt: f1, lowerIsBetter: true },
  ],
  playoffs: [{ key: 'pgp', label: 'GP', value: r => r.p.gamesPlayed, fmt: i0 }, ...perGameCols(r => r.p).map(c => ({ ...c, key: `p-${c.key}` }))],
  milestones: [
    { key: 'dd', label: 'DD', title: 'Double-doubles', value: r => (r.season.seasonMilestones ?? emptySeasonMilestones()).doubleDoubles, fmt: i0 },
    { key: 'td', label: 'TD', title: 'Triple-doubles', value: r => (r.season.seasonMilestones ?? emptySeasonMilestones()).tripleDoubles, fmt: i0 },
    { key: 'qd', label: '4-D', value: r => (r.season.seasonMilestones ?? emptySeasonMilestones()).quadrupleDoubles, fmt: i0 },
    { key: '5d', label: '5-D', value: r => (r.season.seasonMilestones ?? emptySeasonMilestones()).quintupleDoubles, fmt: i0 },
    { key: 'hp', label: 'High PTS', value: r => (r.season.seasonMilestones ?? emptySeasonMilestones()).gameHighPoints, fmt: i0 },
    { key: 'hr', label: 'High REB', value: r => (r.season.seasonMilestones ?? emptySeasonMilestones()).gameHighRebounds, fmt: i0 },
    { key: 'ha', label: 'High AST', value: r => (r.season.seasonMilestones ?? emptySeasonMilestones()).gameHighAssists, fmt: i0 },
    { key: 'hs', label: 'High STL', value: r => (r.season.seasonMilestones ?? emptySeasonMilestones()).gameHighSteals, fmt: i0 },
    { key: 'hb', label: 'High BLK', value: r => (r.season.seasonMilestones ?? emptySeasonMilestones()).gameHighBlocks, fmt: i0 },
  ],
};
const VIEWS: { id: ViewMode; label: string; sort: string }[] = [
  { id: 'perGame', label: 'Per Game', sort: 'ppg' }, { id: 'totals', label: 'Totals', sort: 'pts' }, { id: 'shooting', label: 'Shooting', sort: 'ts' },
  { id: 'advanced', label: 'Advanced', sort: 'per' }, { id: 'winShares', label: 'Win Shares', sort: 'ws' }, { id: 'playoffs', label: 'Playoffs', sort: 'p-ppg' },
  { id: 'milestones', label: 'Milestones', sort: 'dd' },
];

export function PlayerStatsPage({ teams, league, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [teamFilter, setTeamFilter] = useState('ALL');
  const [view, setView] = useState<ViewMode>('perGame');
  const [sortKey, setSortKey] = useState('ppg');
  const [minGames, setMinGames] = useState(1);
  const advanced = useMemo(() => league ? currentSeasonAdvanced(league) : new Map<string, PlayerAdvanced>(), [league]);
  const cols = COLS[view];
  const sortCol = cols.find(c => c.key === sortKey) ?? cols[0];

  const rows = useMemo(() => {
    const all: Row[] = [];
    for (const t of teams) {
      if (teamFilter !== 'ALL' && t.teamId !== teamFilter) continue;
      for (const s of t.seasons) all.push({ season: s, teamName: t.name, s: s.seasonStats ?? emptySeasonStatTotals(), p: s.playoffStats ?? emptySeasonStatTotals(), adv: advanced.get(s.playerId) });
    }
    const games = (r: Row) => view === 'playoffs' ? r.p.gamesPlayed : r.s.gamesPlayed;
    return all
      .filter(r => games(r) >= minGames)
      .filter(r => !query || r.season.playerId.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => sortCol.lowerIsBetter ? sortCol.value(a) - sortCol.value(b) : sortCol.value(b) - sortCol.value(a));
  }, [teams, teamFilter, query, sortCol, minGames, advanced, view]);

  return (
    <div className="player-database">
      <div className="db-controls">
        <input className="db-search" type="text" placeholder="Search players…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} aria-label="Team">
          <option value="ALL">All Teams</option>
          {teams.map((t) => <option key={t.teamId} value={t.teamId}>{t.name}</option>)}
        </select>
        <select value={minGames} onChange={(e) => setMinGames(Number(e.target.value))} aria-label="Minimum games">
          <option value={1}>Any GP</option><option value={5}>5+ GP</option><option value={10}>10+ GP</option><option value={20}>20+ GP</option><option value={40}>40+ GP</option>
        </select>
      </div>
      <div className="stats-view-toggle player-stats-view-toggle">
        {VIEWS.map(v => <button key={v.id} className={view === v.id ? 'active' : ''} onClick={() => { setView(v.id); setSortKey(v.sort); }}>{v.label}</button>)}
      </div>
      {(view === 'advanced' || view === 'winShares') && <p className="hint-text">Regular season only. PER is scaled so the league average is 15; win shares estimate how many team wins a player produced on offense (OWS) and defense (DWS).</p>}
      {rows.length === 0 ? (
        <p className="empty-state">{view === 'playoffs' ? 'No playoff games played yet this season.' : 'No players match — try lowering the minimum games played.'}</p>
      ) : (
        <div className="stat-table-scroll"><table className="db-table stat-line-table">
          <thead><tr><th className="col-name">Name</th><th>Team</th>{view !== 'playoffs' && <th>GP</th>}
            {cols.map(c => <th key={c.key} title={c.title} aria-sort={c.key === sortCol.key ? (c.lowerIsBetter ? 'ascending' : 'descending') : undefined}>
              <button className={`th-sort${c.key === sortCol.key ? ' active' : ''}`} onClick={() => setSortKey(c.key)}>{c.label}{c.key === sortCol.key ? (c.lowerIsBetter ? ' ▲' : ' ▼') : ''}</button></th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.season.playerId} onClick={() => onSelect(r.season.playerId)}>
                <td className="col-name">{r.season.playerId}</td>
                <td><TeamLink name={r.teamName} /></td>
                {view !== 'playoffs' && <td>{r.s.gamesPlayed}</td>}
                {cols.map(c => <td key={c.key}>{c.fmt(c.value(r))}</td>)}
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </div>
  );
}
