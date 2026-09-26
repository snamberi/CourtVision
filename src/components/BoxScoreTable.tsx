import { formatPlayingTime } from '../simulation/boxscore';
import type { TeamBoxScore } from '../simulation/boxscore';
import { derivedStats } from '../simulation/boxscore';

export function BoxScoreTable({ box, title, onSelectPlayer }: { box: TeamBoxScore; title: string; onSelectPlayer?: (playerId: string) => void }) {
  const rows = Object.values(box.players);
  return (
    <div className="box-score">
      <h4>{title} — {box.points} pts</h4>
      <table>
        <thead>
          <tr>
            <th>Player</th><th>MIN</th><th>PTS</th><th>FG</th><th>3P</th><th>FT</th>
            <th>OREB</th><th>DREB</th><th>AST</th><th>STL</th><th>BLK</th><th>TOV</th><th>TS%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const d = derivedStats(r);
            return (
              <tr key={r.playerId} onClick={() => onSelectPlayer?.(r.playerId)} style={onSelectPlayer ? { cursor: 'pointer' } : undefined}>
                <td>{r.playerId}</td>
                <td>{formatPlayingTime(r.minutes)}</td>
                <td>{r.points}</td>
                <td>{r.fgm}-{r.fga}</td>
                <td>{r.tpm}-{r.tpa}</td>
                <td>{r.ftm}-{r.fta}</td>
                <td>{r.oreb}</td>
                <td>{r.dreb}</td>
                <td>{r.ast}</td>
                <td>{r.stl}</td>
                <td>{r.blk}</td>
                <td>{r.tov}</td>
                <td>{(d.tsPct * 100).toFixed(1)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
