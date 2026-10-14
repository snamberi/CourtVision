import type { NbaHistory } from '../history/nbaHistoryData';
import { cardPool } from './cards';
import { huntTeams } from './teams';
import type { HuntRun } from './run';

/** The same opponent roster that playSeries uses, including its duplicate-player exclusions. */
export function bossRoster(h: NbaHistory, run: HuntRun) {
  const pool = cardPool(h), series = run.series[run.seriesIndex];
  const team = huntTeams(h).find(t => t.id === series?.teamId);
  const ours = new Set(run.squad.map(id => pool.byId.get(id)?.playerId));
  return { team, cards: (team?.roster ?? []).flatMap(id => { const c = pool.byId.get(id); return c && !ours.has(c.playerId) ? [c] : []; }).slice(0, 6) };
}
