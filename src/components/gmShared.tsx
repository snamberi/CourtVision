import { TeamText } from './TeamLink';
import type { PlayerSeason } from '../simulation/types';
import { computeTradeValue } from '../simulation/gm';
import { calculateOverall } from '../simulation/engine/overall';
import { primaryPosition } from '../simulation/teamStatus';
import { perGameAverages } from '../simulation/careerStats';
import { PlayerNameTag } from './PlayerAvatar';
import { statWhole } from './statFormat';

export function hashRating(id: string, salt: number): number {
  let h = salt >>> 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return 30 + (h % 70); // deterministic flavor rating, 30-99, stable per team
}

export function tradeVerdict(valueGiven: number, valueReceived: number): { label: string; className: string } {
  if (valueGiven === 0 && valueReceived === 0) return { label: 'Select players to compare', className: 'verdict-neutral' };
  const delta = valueReceived - valueGiven;
  const ratio = valueGiven > 0 ? delta / valueGiven : (valueReceived > 0 ? 1 : 0);
  if (ratio > 0.35) return { label: 'Great Offer', className: 'verdict-great' };
  if (ratio > 0.1) return { label: 'Good Offer', className: 'verdict-good' };
  if (ratio > -0.1) return { label: 'Fair Offer', className: 'verdict-fair' };
  if (ratio > -0.35) return { label: 'Bad Offer', className: 'verdict-bad' };
  return { label: 'Lopsided - Avoid', className: 'verdict-terrible' };
}

export function TradePlayerCompareTable({ title, players, showValues = false }: { title: string; players: PlayerSeason[]; showValues?: boolean }) {
  return (
    <div className="trade-compare-block">
      <h5><TeamText text={title} /></h5>
      {players.length === 0 ? <p className="hint-text">Nobody selected.</p> : (
        <table className="db-table">
          <thead><tr><th>Player</th><th>Pos</th><th>Age</th><th>OVR</th><th>POT</th><th>PPG</th><th>RPG</th><th>APG</th>{showValues && <th>Value</th>}</tr></thead>
          <tbody>
            {players.map((s) => {
              const avg = perGameAverages(s.seasonStats);
              return (
                <tr key={s.playerId}>
                  <td><PlayerNameTag playerId={s.playerId} teamId={s.teamId} jerseyNumber={s.jerseyNumber} /></td>
                  <td>{primaryPosition(s)}</td>
                  <td>{s.age}</td>
                  <td>{calculateOverall(s)}</td>
                  <td>{s.development.potential.toFixed(0)}</td>
                  <td>{avg.gamesPlayed > 0 ? statWhole(avg.ppg) : '—'}</td>
                  <td>{avg.gamesPlayed > 0 ? statWhole(avg.rpg) : '—'}</td>
                  <td>{avg.gamesPlayed > 0 ? statWhole(avg.apg) : '—'}</td>
                  {showValues && <td>{computeTradeValue(s).toFixed(0)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function ImprovementMeter({ label, before, after }: { label: string; before: number; after: number }) {
  const delta = after - before;
  const maxSwing = 10; // an average-overall swing of 10+ pts fills the meter
  const magnitude = Math.min(100, (Math.abs(delta) / maxSwing) * 100);
  const direction = delta > 0.05 ? 'improve' : delta < -0.05 ? 'decline' : 'flat';
  return (
    <div className="improvement-meter">
      <div className="improvement-meter-label">
        <TeamText text={label} />: {before.toFixed(1)} → {after.toFixed(1)}{' '}
        <span className={`improvement-meter-delta improvement-meter-${direction}`}>
          ({delta > 0 ? '+' : ''}{delta.toFixed(1)})
        </span>
      </div>
      <div className="improvement-meter-track">
        <div className={`improvement-meter-fill improvement-meter-fill-${direction}`} style={{ width: `${magnitude}%` }} />
      </div>
    </div>
  );
}
