import { useMemo } from 'react';
import type { League } from '../simulation/league';
import type { GMLeagueExtras } from '../simulation/gm';
import { historicalRosterPreview } from '../history/realRollover';
import { formatSeasonYear } from '../simulation/calendar';
import '../improvements.css';

/** Offseason card: what "Your team too" will do to your roster when the preseason starts, with a way out. */
export function RosterResetPreview({ league, extras, teamId, onKeepRoster, onSelectPlayer }: {
  league: League; extras: GMLeagueExtras; teamId: string | null; onKeepRoster: () => void; onSelectPlayer: (id: string) => void;
}) {
  const offseason = ['draft', 'resign_waive', 'free_agency'].includes(league.seasonPhase ?? '');
  const preview = useMemo(() => (offseason ? historicalRosterPreview(league, extras, teamId) : null), [offseason, league, extras, teamId]);
  if (!preview || (!preview.leaving.length && !preview.arriving.length)) return null;
  const list = (ids: string[], cls: string) => ids.length
    ? <ul className={cls}>{ids.map(id => <li key={id}><button className="link-button" onClick={() => onSelectPlayer(id)}>{id}</button></li>)}</ul>
    : <p className="hint-text">Nobody.</p>;
  return (
    <section className="reset-preview" aria-label="Historical roster preview">
      <h4>When the {formatSeasonYear(league.season)} preseason starts</h4>
      <p className="hint-text">Historical rosters is on for your team too, so it will take its real {formatSeasonYear(league.season)} roster. Signings and picks made before then may still be released.</p>
      <div className="reset-cols">
        <div><b className="out">Leaving ({preview.leaving.length})</b>{list(preview.leaving, 'out')}</div>
        <div><b className="in">Arriving ({preview.arriving.length})</b>{list(preview.arriving, 'in')}</div>
      </div>
      <button onClick={onKeepRoster}>Keep my roster (turn off Historical rosters for my team)</button>
    </section>
  );
}
