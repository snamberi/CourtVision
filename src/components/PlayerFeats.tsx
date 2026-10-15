import type { League } from '../simulation/league';
import type { PlayerSeason, SeasonMilestones, SeasonStatTotals } from '../simulation/types';
import { fiftyFortyNinety, zoneSplits } from '../simulation/gameFeats';
import { clubScaleOf } from '../simulation/records';
import { SHOT_BANDS } from '../simulation/shotDistance';

const pct = (v: number | null) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`);
const FEATS: [string, string, (m: SeasonMilestones) => number][] = [
  ['20+', '20-point games', m => m.games20 ?? 0], ['RUN', 'Longest run of 20-point games', m => m.best20Streak ?? 0],
  ['20-20', '20-20 games (20+ in two of PTS, REB, AST)', m => m.twentyTwenty ?? 0], ['20-20-20', '20-20-20 games', m => m.triple20 ?? 0],
  ['50+', '50-point games', m => m.fiftyPointGames ?? 0], ['BZR', 'Buzzer-beaters', m => m.buzzerBeaters ?? 0], ['GW', 'Game-winning shots (final 24 seconds)', m => m.gameWinners ?? 0],
];

/** Player page: game feats (20-point runs, 20-20-20s, buzzer-beaters, clutch points, 50-40-90) and shooting by distance. */
export function PlayerFeats({ season, career, careerTotals, league }: { season: PlayerSeason; career: SeasonMilestones; careerTotals: SeasonStatTotals; league?: League }) {
  const now = season.seasonMilestones;
  const scale = league ? clubScaleOf(league) : 1;
  const clubSeasons = [...(season.careerHistory ?? []).map(h => h.stats), ...(season.seasonStats ? [season.seasonStats] : [])].filter(s => fiftyFortyNinety(s, scale)).length;
  const inClubNow = !!season.seasonStats && fiftyFortyNinety(season.seasonStats, scale);
  const zonesNow = zoneSplits(now?.shotZones), zonesCareer = zoneSplits(career.shotZones);
  const hasZones = zonesCareer.some(z => z.attempts > 0);
  const zoneCells = (zs: typeof zonesNow) => zs.map((z, i) => <td key={i} title={`${z.makes} of ${z.attempts}`}>{pct(z.pct)}<small className="zone-count"> {z.makes}/{z.attempts}</small></td>);
  return <>
    <h5 className="stats-subheading">Feats</h5>
    <div className="stat-table-scroll"><table className="db-table stat-line-table">
      <thead><tr><th className="col-name">&nbsp;</th>{FEATS.map(([k, title]) => <th key={k} title={title}>{k}</th>)}<th title="Points in the last period's final 5 minutes, within 10">CLUTCH</th><th title="Seasons of 50% FG, 40% 3P and 90% FT with the minimums">50-40-90</th></tr></thead>
      <tbody>
        {now && <tr><td className="col-name">This Season</td>{FEATS.map(([k, , v]) => <td key={k}>{v(now)}</td>)}<td>{season.seasonStats?.clutchPoints ?? 0}</td><td>{inClubNow ? 'Yes' : '—'}</td></tr>}
        <tr><td className="col-name">Career</td>{FEATS.map(([k, , v]) => <td key={k}>{v(career)}</td>)}<td>{careerTotals.clutchPoints}</td><td>{clubSeasons}</td></tr>
      </tbody>
    </table></div>
    {(season.streak20 ?? 0) >= 3 && <p className="hint-text">On a run: {season.streak20} straight games with 20 or more points.</p>}
    {hasZones && <>
      <h5 className="stats-subheading">Shooting by distance</h5>
      <div className="stat-table-scroll"><table className="db-table stat-line-table zone-table">
        <thead><tr><th className="col-name">&nbsp;</th>{SHOT_BANDS.map(b => <th key={b.id} title={b.label}>{b.short}</th>)}</tr></thead>
        <tbody>
          {now?.shotZones && <tr><td className="col-name">This Season</td>{zoneCells(zonesNow)}</tr>}
          <tr><td className="col-name">Career</td>{zoneCells(zonesCareer)}</tr>
        </tbody>
      </table></div>
    </>}
  </>;
}
