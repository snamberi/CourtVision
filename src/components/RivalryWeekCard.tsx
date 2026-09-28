import type { League } from '../simulation/league';
import { planRivalryWeek, rivalryHype, hypeLabel, type RivalryWeekGame } from '../simulation/rivalryWeek';
import { rivalryBetween } from '../simulation/rivalry';
import { PixelIcon } from './PixelIcon';
import { TeamLogo } from './TeamLogo';

/** The hype meter: a pixel bar that runs from cool blue to boiling red. */
export function HypeMeter({ hype }: { hype: number }) {
  return <span className="hype-meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={hype} aria-label={`Hype ${hype} of 100, ${hypeLabel(hype)}`}>
    {Array.from({ length: 10 }, (_, i) => <i key={i} className={i < Math.round(hype / 10) ? `on hype-${Math.min(3, Math.floor(i / 3))}` : ''} />)}
  </span>;
}

/** Dashboard card: your next Rivalry Week game (the build-up) or the last one (the fallout). */
export function RivalryWeekCard({ league, controlledTeamId, onPress }: { league: League; controlledTeamId: string | null; onPress: () => void }) {
  if (!controlledTeamId) return null;
  const plan = league.rivalryWeek?.season === league.season ? league.rivalryWeek : planRivalryWeek(league, controlledTeamId);
  if (!plan || plan.teamId !== controlledTeamId) return null;
  const next = plan.games.find(g => !g.result), last = [...plan.games].reverse().find(g => g.result);
  const game: RivalryWeekGame | undefined = next ?? last;
  if (!game) return null;
  const opp = league.teams.find(t => t.teamId === game.opponentId);
  const hype = rivalryHype(league, controlledTeamId, game);
  const mine = league.schedule.filter(g => g.homeTeamId === controlledTeamId || g.awayTeamId === controlledTeamId);
  const gamesAway = next ? mine.filter(g => !g.played).findIndex(g => g.id === next.gameId) : -1;
  const sched = league.schedule.find(g => g.id === game.gameId);
  const home = sched?.homeTeamId === controlledTeamId;
  const r = rivalryBetween(league, controlledTeamId, game.opponentId);
  const series = r ? (r.a === controlledTeamId ? `${r.winsA}-${r.winsB}` : `${r.winsB}-${r.winsA}`) : null;
  const pressWaiting = league.press?.pending.some(p => p.id === `${league.season}:rw:${game.gameId}`);
  return <section className={`dashboard-panel rivalry-week-card${next && gamesAway <= 3 ? ' live' : ''}`} aria-label="Rivalry Week">
    <h5><PixelIcon name="flame" size={16} /> Rivalry Week {game.half === 1 ? 'I' : 'II'}</h5>
    <div className="rivalry-week-matchup">
      {opp && <TeamLogo team={opp} size={40} />}
      <div><b>{home ? 'vs' : '@'} {opp?.name ?? game.opponentId}</b>
        <small>{next ? (gamesAway === 0 ? 'Next game' : `In ${gamesAway + 1} games`) : game.result!.won ? `Won ${game.result!.us}-${game.result!.them}` : `Lost ${game.result!.us}-${game.result!.them}`}{series ? ` · all-time ${series}` : ''}</small></div>
    </div>
    <div className="rivalry-week-hype"><small>Hype</small><HypeMeter hype={hype} /><b>{hypeLabel(hype)}</b></div>
    {next ? <>
      {game.talk ? <p className="hint-text">At the podium you went with <b>{game.talk.tone.toLowerCase()}</b>.{game.talk.trash ? ' Lose this one and the fans won\'t forget it.' : ''}</p>
        : <p className="hint-text">Special court, a crowd on its feet. Win: bragging rights and a morale boost. Lose: the fans let you know.</p>}
      {pressWaiting && <button className="primary" onClick={onPress}>Trash-talk press conference</button>}
    </> : <p className="hint-text">{game.result!.won ? `Bragging rights are yours. Morale +${game.result!.mood}, fans +${game.result!.fans}.` : `The boos were loud. Fan mood ${game.result!.fans}.`}</p>}
  </section>;
}
