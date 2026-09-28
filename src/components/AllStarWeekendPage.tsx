import { PixelIcon } from './PixelIcon';
import { TeamLink } from './TeamLink';
import { useMemo, useState } from 'react';
import type { League, AllStarWeekendRecord } from '../simulation/league';
import { allStarBreakRound, isAllStarBreakPending } from '../simulation/league';
import { awardOptions, computeSeasonAwards } from '../simulation/awards';
import type { AwardSettings } from './LeagueSettingsPage';
import { allStarVoteStandings, castAllStarBallot, currentAllStarWeekend, lockAllStarVoting } from '../simulation/allStarVoting';
import { simulateAllStarGame, simulateRisingStars, risingStarsRosters, withoutLog, computeAllStarGameMVP, pickContestEntrants } from '../simulation/allStarGame';
import { startCaptainsDraft } from '../simulation/allStarEvents';
import { CaptainsDraftPanel, ThreePointPanel, DunkPanel } from './AllStarEventsPanels';
import type { AllStarGameResult } from '../simulation/allStarGame';
import { WatchGame } from './WatchGame';
import { PlayerNameTag } from './PlayerAvatar';
import { BoxScoreTable } from './BoxScoreTable';

interface Props {
  league: League;
  awardSettings: AwardSettings;
  seed: number;
  onSelectPlayer: (playerId: string) => void;
  onChange: (league: League) => void;
  onComplete: (league: League) => void;
  controlledTeamId?: string | null;
}

export function AllStarWeekendPage({ league, awardSettings, seed, onSelectPlayer, onChange, onComplete, controlledTeamId = null }: Props) {
  const [query, setQuery] = useState('');
  const [live, setLive] = useState<AllStarGameResult | null>(null);
  const [onlyBallot, setOnlyBallot] = useState(false);
  const record = currentAllStarWeekend(league);
  const standings = allStarVoteStandings(league);
  const ballot = record.voting?.ballot ?? [];
  const atBreak = isAllStarBreakPending(league) || league.seasonPhase === 'all_star';
  const locked = !!record.voting?.locked || record.completed;
  const disabled = league.rulesSettings?.allStarEnabled === false;
  const canVote = !locked && !atBreak && !disabled;
  const update = (patch: Partial<AllStarWeekendRecord>) => onChange({ ...league, allStarWeekend: { ...record, ...patch } });
  const game = record.gameResult;
  const selected = record.voting?.selected ?? [];
  const weights = [league.rulesSettings?.allStarFanWeight ?? 50, league.rulesSettings?.allStarPlayerWeight ?? 25, league.rulesSettings?.allStarCoachWeight ?? 25];
  const weightTotal = weights.reduce((a, b) => a + b, 0);
  const percentages = (weightTotal ? weights : [50, 25, 25]).map(w => Math.round(w / (weightTotal || 100) * 100));
  const finish = () => onComplete({ ...league, seasonPhase: 'regular_season', allStarWeekend: { ...record, completed: true } });
  // Played games keep only their box score in the save; the replay is watched right away.
  const playGame = (watch = false) => {
    const result = simulateAllStarGame(league, computeSeasonAwards(league, awardOptions(awardSettings)), seed + 90001);
    update({ gameResult: withoutLog(result) ?? undefined, gameSkipped: !result, mvp: result ? computeAllStarGameMVP(result) ?? undefined : undefined });
    if (watch && result) setLive(result);
  };
  const rising = record.risingStars;
  const risingPossible = useMemo(() => { const r = risingStarsRosters(league); return r.rookies.length >= 5 && r.sophomores.length >= 5; }, [league]);
  const playRisingStars = (watch = false) => {
    const result = simulateRisingStars(league, seed + 90004);
    update({ risingStars: withoutLog(result) ?? undefined, risingStarsMvp: result ? computeAllStarGameMVP(result) ?? undefined : undefined });
    if (watch && result) setLive(result);
  };
  const byConference = selected.length > 0 && selected.every(s => s.conference);
  const shooters = useMemo(() => pickContestEntrants(league, 8, x => x.attributes.offense.threePoint), [league]);
  const dunkers = useMemo(() => pickContestEntrants(league, 4, x => x.attributes.physical.vertical * 0.4 + x.attributes.physical.agility * 0.3 + x.attributes.offense.finishing * 0.3), [league]);
  const captains = record.format === 'captains';
  const draftReady = !captains || !!record.draft?.done;
  const filtered = standings.filter(s => (!onlyBallot || ballot.includes(s.playerId)) && `${s.playerId} ${s.teamName}`.toLowerCase().includes(query.toLowerCase()));
  if (live) return <div className="all-star-weekend-page"><WatchGame game={live.result} home={{ teamId: 'ALLSTAR_A', name: live.squadA.name }} away={{ teamId: 'ALLSTAR_B', name: live.squadB.name }}
    homeRoster={live.squadA.playerIds.flatMap(id => league.teams.flatMap(t => t.seasons.filter(p => p.playerId === id)))} awayRoster={live.squadB.playerIds.flatMap(id => league.teams.flatMap(t => t.seasons.filter(p => p.playerId === id)))}
    onBoxScore={() => setLive(null)} occasion={null} /></div>;
  return (
    <div className="all-star-weekend-page">
      <div className="season-feature-header"><div><span className="pixel-eyebrow">THE LEAGUE'S BIGGEST STAGE</span><h2>All-Star Central</h2><p>{league.season} · {record.completed ? 'Weekend complete' : locked ? 'Rosters announced' : atBreak ? 'Voting closed · announce the teams' : 'Voting open'}</p></div><span className="feature-badge"><PixelIcon name="star" /> ALL STAR</span></div>
      {disabled && <p className="feature-notice">All-Star Weekend is disabled in League Rules. Existing results are kept.</p>}
      <div className="feature-stat-grid">
        <div><small>FAN / PLAYER / COACH</small><strong>{percentages.join(' / ')}%</strong></div>
        <div><small>YOUR BALLOT</small><strong>{ballot.length} / 10</strong></div>
        <div><small>ROSTER SPOTS</small><strong>{Math.floor(awardSettings.allStarCount / 2) * 2}</strong></div>
        <div><small>BREAK ROUND</small><strong>{allStarBreakRound(league) == null ? '—' : allStarBreakRound(league)! + 1}</strong></div>
      </div>
      <p className="hint-text">League votes are simulated from production, reputation, team success and games played. Your editable ballot adds one fan vote per pick. The weighted vote picks the starters — in a league with conferences, two backcourt and three frontcourt players from each — and coaches select the reserves. Voting closes at the break.</p>
      {atBreak && !locked && !disabled && <button className="primary" onClick={() => onChange(lockAllStarVoting(league, awardSettings.allStarCount))}>Announce All-Star Rosters</button>}
      {selected.length > 0 && <section><h3>The All-Stars</h3>
        {(byConference ? (['east', 'west'] as const) : [null]).map(conf => <div key={conf ?? 'all'} className="all-star-conference">
          {conf && <h4 className="all-star-conference-title">{conf === 'east' ? 'Eastern' : 'Western'} Conference</h4>}
          <div className="all-star-roster">{selected.filter(s => !conf || s.conference === conf).map(s => { const starter = s.starter ?? selected.indexOf(s) < 10; return <button className="all-star-pick" key={s.playerId} onClick={() => onSelectPlayer(s.playerId)}><PlayerNameTag playerId={s.playerId} teamId={s.teamId ?? undefined} size={36} /><small>{starter ? 'STARTER' : 'RESERVE'} · {s.teamName}</small></button>; })}</div>
        </div>)}
      </section>}
      <section>
        <div className="feature-toolbar"><h3>{locked ? 'Final vote' : 'Voting leaderboard'}</h3><label>Find player or team<input type="search" placeholder="Search the ballot…" value={query} onChange={e => setQuery(e.target.value)} /></label><label className="feature-check"><input type="checkbox" checked={onlyBallot} onChange={e => setOnlyBallot(e.target.checked)} />My picks</label></div>
        {!standings.length ? <p className="empty-state">Play some regular-season games to open the leaderboard. Players must appear in at least one game to qualify.</p> : <div className="feature-table-scroll"><table className="db-table vote-table"><thead><tr><th>Rank</th><th>Player</th><th>GP</th><th>PTS / REB / AST</th><th>Fans</th><th>Players</th><th>Coaches</th><th>Vote score</th><th>Your ballot</th></tr></thead><tbody>{filtered.slice(0, 80).map(s => <tr key={s.playerId}><td>{standings.indexOf(s) + 1}</td><td><button className="link-button" onClick={() => onSelectPlayer(s.playerId)}><PlayerNameTag playerId={s.playerId} teamId={s.teamId ?? undefined} size={28} /></button><small className="vote-team"><TeamLink name={s.teamName} /></small></td><td>{s.games}</td><td>{s.ppg.toFixed(1)} / {s.rpg.toFixed(1)} / {s.apg.toFixed(1)}</td><td>{s.fanVotes.toLocaleString()}</td><td>{s.playerVotes.toLocaleString()}</td><td>{s.coachVotes.toLocaleString()}</td><td>{s.score.toFixed(1)}</td><td><button aria-label={`${ballot.includes(s.playerId) ? 'Remove vote for' : 'Vote for'} ${s.playerId}`} aria-pressed={ballot.includes(s.playerId)} disabled={!canVote || (!ballot.includes(s.playerId) && ballot.length >= 10)} onClick={() => onChange(castAllStarBallot(league, ballot.includes(s.playerId) ? ballot.filter(id => id !== s.playerId) : [...ballot, s.playerId]))}><PixelIcon name="star" /> {ballot.includes(s.playerId) ? 'Voted' : 'Vote'}</button></td></tr>)}</tbody></table>{!filtered.length && <p className="empty-state">No players match this filter.</p>}</div>}
        {filtered.length > 80 && <p className="hint-text">Showing the top 80 matches. Search to find any eligible player.</p>}
      </section>
      {locked && !record.gameResult && !record.gameSkipped && selected.length >= 10 && <section className="all-star-format"><h3>Game format</h3>
        <div className="difficulty-options" role="radiogroup" aria-label="All-Star Game format">
          <button role="radio" aria-checked={!captains} className={`difficulty-chip ${!captains ? 'selected' : ''}`} disabled={!!record.draft} onClick={() => update({ format: 'conference' })}>{byConference ? 'East vs West' : 'Balanced squads'}</button>
          <button role="radio" aria-checked={captains} className={`difficulty-chip ${captains ? 'selected' : ''}`} onClick={() => onChange(startCaptainsDraft(league, controlledTeamId))}>Captains draft</button>
        </div>
        <p className="hint-text">Captains draft: the leading vote-getters captain the two teams and pick the rest of the All-Stars, starters first. You make the picks for one captain.</p>
      </section>}
      {locked && captains && <CaptainsDraftPanel league={league} record={record} onChange={onChange} onSelectPlayer={onSelectPlayer} />}
      {locked && <section><h3>Weekend events</h3><div className="weekend-events">
        <div className="weekend-event"><span className="pixel-eyebrow">00 / NEXT GENERATION</span><h4>Rising Stars Game</h4>{rising ? <><p>{rising.squadA.name} vs {rising.squadB.name}</p><strong className="all-star-score">{rising.result.homeScore} — {rising.result.awayScore}</strong><p>MVP: {record.risingStarsMvp ? <button className="link-button" onClick={() => onSelectPlayer(record.risingStarsMvp!.playerId)}>{record.risingStarsMvp.playerId}</button> : '—'}</p></> : risingPossible ? <div className="contest-actions"><button className="primary" disabled={record.completed} onClick={() => playRisingStars(true)}>Watch Rising Stars</button><button disabled={record.completed} onClick={() => playRisingStars()}>Sim it</button></div> : <p className="hint-text">Not enough first- and second-year players have played this season.</p>}</div>
        <div className="weekend-event"><span className="pixel-eyebrow">01 / SHOOTING</span><h4>Three-Point Contest</h4><ThreePointPanel league={league} record={record} onSelectPlayer={onSelectPlayer} entrants={shooters} seed={seed + 90002} userTeamId={controlledTeamId} update={update} /></div>
        <div className="weekend-event"><span className="pixel-eyebrow">02 / ABOVE THE RIM</span><h4>Slam Dunk Contest</h4><DunkPanel league={league} record={record} onSelectPlayer={onSelectPlayer} entrants={dunkers} seed={seed + 90003} userTeamId={controlledTeamId} update={update} /></div>
        <div className="weekend-event"><span className="pixel-eyebrow">03 / THE MAIN EVENT</span><h4>All-Star Game</h4>{game ? <><p>{game.squadA.name} vs {game.squadB.name}</p><strong className="all-star-score">{game.result.homeScore} — {game.result.awayScore}</strong><p>MVP: {record.mvp?.playerId ?? '—'}</p></> : record.gameSkipped ? <p>Exhibition skipped: fewer than 10 eligible players.</p> : selected.length < 10 ? <button className="primary" disabled={record.completed} onClick={() => playGame()}>Skip Unavailable Exhibition</button> : !draftReady ? <p className="hint-text">Finish the captains draft first.</p> : <div className="contest-actions"><button className="primary" disabled={record.completed} onClick={() => playGame(true)}>Watch the All-Star Game</button><button disabled={record.completed} onClick={() => playGame()}>Sim it</button></div>}</div></div>
        {rising && <details><summary>Rising Stars box score</summary><div className="feature-table-scroll"><BoxScoreTable box={rising.result.homeBox} title={rising.squadA.name} onSelectPlayer={onSelectPlayer} /><BoxScoreTable box={rising.result.awayBox} title={rising.squadB.name} onSelectPlayer={onSelectPlayer} /></div></details>}
        {game && <details><summary>Full All-Star box score</summary><div className="feature-table-scroll"><BoxScoreTable box={game.result.homeBox} title={game.squadA.name} onSelectPlayer={onSelectPlayer} /><BoxScoreTable box={game.result.awayBox} title={game.squadB.name} onSelectPlayer={onSelectPlayer} /></div></details>}
        {!record.completed && <button className="primary" disabled={!(record.threePoint && record.dunk && (game || record.gameSkipped) && (rising || !risingPossible))} onClick={finish}>Continue Regular Season →</button>}
      </section>}
    </div>
  );
}
