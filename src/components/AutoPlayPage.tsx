import { TeamLink } from './TeamLink';
import { useState } from 'react';
import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import type { AwardSettings } from './LeagueSettingsPage';
import type { AutoPlayLogRow, AutoPlayProgress, AutoPlayStartArgs } from '../workers/useBackgroundJobs';
import { formatSeasonYear } from '../simulation/calendar';

interface Props {
  league: League;
  extras: GMLeagueExtras;
  controlledTeamId: string | null;
  awardSettings: AwardSettings;
  seed: number;
  /**
   * The Auto Play run itself lives in App (via useBackgroundJobs), not in this page, so it keeps
   * going — and its per-year log survives — when you switch tabs.
   */
  job: {
    running: boolean;
    progress: AutoPlayProgress | null;
    log: AutoPlayLogRow[];
    start: (args: AutoPlayStartArgs) => void;
    cancel: () => void;
  };
  /** True while ANY background job (including Simulate Remaining Season) is running — only one may run at a time. */
  otherJobRunning: boolean;
  onOpenFranchiseHistory: () => void;
  onOpenHallOfFame: () => void;
}

export function AutoPlayPage({
  league, extras, controlledTeamId, awardSettings, seed, job, otherJobRunning, onOpenFranchiseHistory, onOpenHallOfFame,
}: Props) {
  const [years, setYears] = useState(10);
  const { running, progress, log } = job;

  const start = () => job.start({ league, extras, controlledTeamId, awardSettings, years, seedBase: seed + 555_000 });
  const cancel = job.cancel;

  return (
    <section>
      <h4>Auto Play Multiple Seasons</h4>
      <p className="hint-text">
        Plays through full seasons one at a time — regular season, All-Star Weekend, playoffs, draft, and free
        agency — auto-drafting and auto-signing/waiving for your team along the way, exactly like the AI does for
        everyone else. It's not instant: each season is simulated in full before moving to the next, so you'll see
        the standings, roster, and awards update year by year.
      </p>
      <label className="rating-row">
        <span className="rating-label">Years to play</span>
        <input
          type="number" min={1} max={50} className="rating-number" value={years} disabled={running}
          onChange={(e) => setYears(Math.max(1, Math.min(50, Number(e.target.value))))}
        />
      </label>
      <div className="code-mode-actions">
        {!running
          ? <button className="primary" onClick={start} disabled={otherJobRunning}>Auto Play {years} Season{years === 1 ? '' : 's'}</button>
          : <button onClick={cancel}>Cancel</button>}
      </div>
      {!running && otherJobRunning && (
        <p className="hint-text">Another background simulation is running — wait for it to finish (or cancel it) before starting Auto Play.</p>
      )}
      {running && (
        <p className="hint-text">
          Auto Play keeps running if you switch tabs — progress shows in the banner at the top. Avoid making roster or
          league changes until it finishes, since each simulated season is written over the live league.
        </p>
      )}
      {progress && (
        <p className="hint-text">
          {running ? 'Playing' : 'Stopped after'} year {progress.year} of {progress.total}
          {running && '…'}
        </p>
      )}
      {log.length > 0 && (
        <div className="finances-table-wrap">
          <p className="hint-text">
            This log stays here while the app is open, even if you switch tabs. For the permanent record, see{' '}
            <button className="link-button" onClick={onOpenFranchiseHistory}>Franchise History</button> and the{' '}
            <button className="link-button" onClick={onOpenHallOfFame}>Hall of Fame</button>.
          </p>
          <table className="db-table">
            <thead><tr><th>Season</th><th>Champion</th><th>MVP</th><th>ASG MVP</th><th>3PT Champ</th><th>Dunk Champ</th><th>Your Draft Picks</th><th>Your Signings</th></tr></thead>
            <tbody>
              {log.map((row, i) => (
                <tr key={i}>
                  <td>{formatSeasonYear(row.season)}</td>
                  <td><TeamLink name={row.summary.championTeamName ?? '—'} /></td>
                  <td>{row.summary.mvpPlayerId ?? '—'}</td>
                  <td>{row.summary.allStarGameMVPPlayerId ?? '—'}</td>
                  <td>{row.summary.threePointChampionId ?? '—'}</td>
                  <td>{row.summary.dunkChampionId ?? '—'}</td>
                  <td>{row.summary.controlledTeamDraftPicks.join(', ') || '—'}</td>
                  <td>{row.summary.controlledTeamSignings.join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
