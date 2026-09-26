import { useMemo } from 'react';
import type { League } from '../simulation/league';
import type { PlayerSeason } from '../simulation/types';
import { formatSeasonYear } from '../simulation/calendar';
import { ratingSourceLabel, ratingSourceTag } from '../history/datasetInfo';
import { realDevelopmentStatus, seasonText } from '../history/realDevelopment';

/** Provenance of a real player's rating and attributes, plus his Real Player Development status. */
export function RealPlayerFacts({ player, league }: { player: PlayerSeason; league?: League }) {
  const real = player.real;
  if (!real) return null;
  const r = real.rating;
  const source = r.kind === 'interpolated' ? 'interpolated' : r.source;
  return (
    <div className="real-player-facts">
      <table className="db-table">
        <tbody>
          <tr>
            <td>Rating source</td>
            <td>
              {seasonText(r.startYear)} reference Overall {r.ovr}: {ratingSourceLabel(source)}
              <span className="origin-tag est">{ratingSourceTag(source)}</span>
            </td>
          </tr>
          <tr>
            <td>Attributes</td>
            <td>Estimated from his real statistics (shooting, playmaking, rebounding and defensive rates); height, weight and age are real. <span className="origin-tag est">Estimated</span></td>
          </tr>
          <tr><td>Real player id</td><td>{real.id} · {real.dataset}</td></tr>
        </tbody>
      </table>
      {league && <p className="hint-text">{realDevelopmentStatus(player, league)}</p>}
    </div>
  );
}

/** Awards split by origin: real NBA honours from before the league's start, and awards won in this simulation. */
export function AwardsByOrigin({ player, league, awardsHistory }: { player: PlayerSeason; league?: League; awardsHistory: { season: string; label: string }[] }) {
  const start = league?.historical?.startYear;
  const imported = useMemo(() => new Set((league?.franchiseHistory ?? []).filter(rec => rec.imported).map(rec => rec.season)), [league?.franchiseHistory]);
  const real = group((player.historicalAwards ?? []).map(a => ({ season: a.season, label: a.label, detail: a.detail })));
  const simulated = group(awardsHistory.filter(a => !imported.has(a.season)));
  return (
    <div className="awards-by-origin">
      <h5>Real NBA{start != null ? ` · before ${seasonText(start)}` : ''} <span className="origin-tag real">Imported</span></h5>
      {real.length ? (
        <div className="badge-grid">
          {real.map(g => <span key={g.label} className="badge-chip" tabIndex={0} title={g.items.map(i => `${formatSeasonYear(i.season)}${i.detail ? ` (${i.detail})` : ''}`).join(', ')}>{g.label}{g.items.length > 1 ? ` ×${g.items.length}` : ''}</span>)}
        </div>
      ) : <p className="hint-text">No real NBA honours before this league's start.</p>}
      <h5>In this league <span className="origin-tag sim">Simulated</span></h5>
      {simulated.length ? (
        <div className="badge-grid">
          {simulated.map(g => <span key={g.label} className="badge-chip" tabIndex={0} title={g.items.map(i => formatSeasonYear(i.season)).join(', ')}>{g.label}{g.items.length > 1 ? ` ×${g.items.length}` : ''}</span>)}
        </div>
      ) : <p className="hint-text">None yet. Awards won in this league are archived after each season's playoffs.</p>}
      {real.some(g => g.label === 'NBA Champion') && <p className="hint-text">Real titles are credited to players whose last regular-season team won the championship (player playoff rosters are not in the data).</p>}
    </div>
  );
}

function group(items: { season: string; label: string; detail?: string }[]) {
  const map = new Map<string, { season: string; detail?: string }[]>();
  for (const i of items) { const list = map.get(i.label) ?? []; list.push({ season: i.season, detail: i.detail }); map.set(i.label, list); }
  return [...map.entries()].map(([label, list]) => ({ label, items: list.sort((a, b) => a.season.localeCompare(b.season)) }));
}
