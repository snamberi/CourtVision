import { rivalryBadge } from '../simulation/rivalry';
import { TeamLink } from './TeamLink';
import { GameBoxScorePage } from './GameBoxScorePage';
import type { GameResult } from '../simulation/boxscore';
import { useEffect, useState } from 'react';
import type { League } from '../simulation/league';
import { autoGeneratePlayoffBracket, simulateNextPlayoffGame, simulateFullPlayoffs, simulateCurrentPlayoffRound, playInPending, type PlayoffBracket, type PlayoffSeries } from '../simulation/playoffs';
import { PlayoffBracketView } from './PlayoffBracketView';
import { StarIcon } from './Icons';

interface Props {
  league: League;
  onChange: (league: League) => void;
  bracket: PlayoffBracket | null;
  onBracketChange: (bracket: PlayoffBracket | null) => void;
  /** Replays the championship celebration. */
  onCelebrate?: () => void;
}

export function PlayoffsPage({ league, onChange, bracket, onBracketChange, onCelebrate }: Props) {
  const [watched, setWatched] = useState<GameResult | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  // The postseason always seeds itself from the real standings the moment you land here — no manual
  // bracket-size picker, no "generate" button. This only fires as a fallback (e.g. opening the tab
  // directly in a fresh sandbox league before the guided season flow has kicked one off).
  useEffect(() => {
    if (!bracket && league.teams.length >= 4) onBracketChange(autoGeneratePlayoffBracket(league));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bracket, league.teams.length]);

  const teamName = (id: string | null) => (id ? league.teams.find((t) => t.teamId === id)?.name ?? id : 'TBD');

  const simOne = (watch = false) => {
    if (!bracket) return;
    const step = simulateNextPlayoffGame(bracket, league, 1000);
    onBracketChange(step.bracket);
    onChange({ ...step.league, playoffBracket: step.bracket });
    if (watch) {
      const changed = step.bracket.rounds.flat().find(s => s.games.length > (bracket.rounds.flat().find(old => old.id === s.id)?.games.length ?? 0));
      const playIn = step.bracket.playIn?.find(g => g.result && !bracket.playIn?.find(old => old.id === g.id)?.result);
      if (changed) setWatched(changed.games[changed.games.length - 1]);
      else if (playIn?.result) setWatched(playIn.result);
    }
  };
  const simRound = () => {
    if (!bracket) return;
    const step = simulateCurrentPlayoffRound(bracket, league, 1000);
    onBracketChange(step.bracket);
    onChange({ ...step.league, playoffBracket: step.bracket });
  };
  const simAll = () => {
    if (!bracket) return;
    const step = simulateFullPlayoffs(bracket, league, 1000);
    onBracketChange(step.bracket);
    onChange({ ...step.league, playoffBracket: step.bracket });
  };

  const isConferenceStructured = bracket?.rounds.length === 4 && bracket.rounds[0].length === 8;
  const selectedMatchup = (() => {
    if (!bracket || !selected) return null;
    const series = bracket.rounds.flat().find(s => s.id === selected);
    if (series) return { a: series.teamAId, b: series.teamBId, games: series.games };
    const game = bracket.playIn?.find(g => g.id === selected);
    return game ? { a: game.teamAId, b: game.teamBId, games: game.result ? [game.result] : [] } : null;
  })();
  const pendingPlayIn = !!bracket && playInPending(bracket);

  const seriesCard = (series: PlayoffSeries) => (
    <div key={series.id} className={`bracket-series-card ${series.winnerTeamId ? 'decided' : ''}`}>
      <div className={`bracket-team-row ${series.winnerTeamId === series.teamAId ? 'winner' : ''}`}>
        <span className="bracket-team-name">
          {series.winnerTeamId === series.teamAId && <StarIcon className="bracket-winner-star" />}
          <TeamLink name={teamName(series.teamAId)} />
        </span>
        <span className="bracket-score-pill">{series.teamAWins}</span>
      </div>
      <div className={`bracket-team-row ${series.winnerTeamId === series.teamBId ? 'winner' : ''}`}>
        <span className="bracket-team-name">
          {series.winnerTeamId === series.teamBId && <StarIcon className="bracket-winner-star" />}
          <TeamLink name={teamName(series.teamBId)} />
        </span>
        <span className="bracket-score-pill">{series.teamBWins}</span>
      </div>
      {series.games.length > 0 && <details className="series-replays"><summary>Watch games ({series.games.length})</summary>{series.games.map((g,i) => <button key={i} onClick={() => setWatched(g)}>Watch Game {i+1}</button>)}</details>}
    </div>
  );
  const roundLabel = (ri: number, total: number) => {
    if (isConferenceStructured) {
      if (ri === 0) return 'Conf. Quarterfinals';
      if (ri === 1) return 'Conf. Semifinals';
      if (ri === 2) return 'Conference Finals';
      return 'NBA Finals';
    }
    return ri === total - 1 ? 'Finals' : ri === total - 2 ? 'Semifinals' : `Round ${ri + 1}`;
  };

  if (watched) return <div className="playoffs-page"><button onClick={() => setWatched(null)}>Back to Playoffs</button><GameBoxScorePage key={`${watched.homeTeamId}-${watched.awayTeamId}-${watched.seed}`} initialWatch game={watched} home={{teamId:watched.homeTeamId,name:teamName(watched.homeTeamId)}} away={{teamId:watched.awayTeamId,name:teamName(watched.awayTeamId)}} homeRoster={league.teams.find(t=>t.teamId===watched.homeTeamId)?.seasons} awayRoster={league.teams.find(t=>t.teamId===watched.awayTeamId)?.seasons} rivalry={rivalryBadge(league,watched.homeTeamId,watched.awayTeamId)}/></div>;
  return (
    <div className="playoffs-page">
      {bracket && !bracket.championTeamId && (
        <div className="league-controls">
          <button className="primary" onClick={() => simOne(true)}>Watch Next Game</button>
          <button onClick={() => simOne()}>Simulate Next Game</button>
          <button onClick={simRound}>{pendingPlayIn ? 'Simulate Play-In' : 'Simulate Current Round'}</button>
          <button className="primary" onClick={simAll}>Simulate Entire Playoffs</button>
        </div>
      )}

      {bracket?.championTeamId && (
        <div className="champion-banner">
          <StarIcon className="champion-star" />
          CHAMPION: <TeamLink name={teamName(bracket.championTeamId)} />
          <StarIcon className="champion-star" />
          {onCelebrate && <button className="champion-replay" onClick={onCelebrate}>Watch the celebration</button>}
        </div>
      )}

      {!bracket && (
        <p className="empty-state">Need at least 4 teams to seed a playoff bracket.</p>
      )}

      {bracket && isConferenceStructured && <>
        <PlayoffBracketView league={league} bracket={bracket} selectedId={selected} onSelect={id => setSelected(cur => cur === id ? null : id)} />
        {selectedMatchup && <div className="bracket-detail">
          <h5>{teamName(selectedMatchup.a)} vs {teamName(selectedMatchup.b)}</h5>
          {selectedMatchup.games.length === 0 ? <p className="hint-text">Not played yet.</p> : <div className="bracket-detail-games">{selectedMatchup.games.map((g, i) => <button key={i} onClick={() => setWatched(g)}>
            {selectedMatchup.games.length > 1 ? `Game ${i + 1}: ` : ''}{teamName(g.homeTeamId)} {g.homeScore}–{g.awayScore} {teamName(g.awayTeamId)} ▶</button>)}</div>}
        </div>}
      </>}

      {bracket && !isConferenceStructured && (
        <div className="bracket-tree">
          {bracket.rounds.map((round, ri) => (
            <div key={ri} className="bracket-column">
              <h5 className="bracket-round-title">{roundLabel(ri, bracket.rounds.length)}</h5>
              <div className="bracket-column-series">
                {round.map((series) => seriesCard(series))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
