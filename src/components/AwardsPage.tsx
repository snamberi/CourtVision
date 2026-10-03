import { TeamLink } from './TeamLink';
import { useState, useMemo, type ReactNode } from 'react';
import type { League } from '../simulation/league';
import type { PlayoffBracket, PlayoffSeries } from '../simulation/playoffs';
import { awardOptions, awardRaceStandings, computeSeasonAwards, finalsMVPLine, RACE_LABELS, type AwardWinner, type RaceKey, type TeamAwardWinner } from '../simulation/awards';
import { ladderTrend, type PeriodHonor } from '../simulation/awardRace';
import { isOffseason, isUnanimous } from '../simulation/almanac';
import { formatSeasonYear } from '../simulation/calendar';
import { simulateAllStarGame, type AllStarGameResult } from '../simulation/allStarGame';
import { perGameAverages } from '../simulation/careerStats';
import { formatDisplayDate } from '../simulation/calendar';
import { TROPHIES, type TrophyKey } from '../simulation/trophies';
import type { AwardSettings } from './LeagueSettingsPage';
import { PlayerNameTag } from './PlayerAvatar';
import { PixelTrophy } from './PixelTrophy';
import { AwardsNight } from './AwardsNight';
import { UnanimousTag } from './UnanimousTag';
import { stat1 } from './statFormat';

interface Props {
  league: League;
  onSelectPlayer: (playerId: string) => void;
  awardSettings: AwardSettings;
  finalsBracket?: PlayoffBracket | null;
  /** Replays the championship celebration. */
  onCelebrate?: () => void;
}

function WinnerCard({ trophy, winner, note, onSelectPlayer, co, unanimous }: { trophy: TrophyKey; winner: AwardWinner | null; note?: ReactNode; onSelectPlayer: (id: string) => void; co?: AwardWinner[]; unanimous?: boolean }) {
  return (
    <div className={`award-card award-card--trophy${winner ? '' : ' award-card--empty'}${unanimous ? ' award-card--unanimous' : ''}`}>
      <PixelTrophy award={trophy} size={34} dim={!winner} />
      <div>
        <h4>{TROPHIES[trophy].label}{unanimous && <UnanimousTag compact />}</h4>
        {winner ? <>
          <p className="award-winner" onClick={() => onSelectPlayer(winner.playerId)}><PlayerNameTag playerId={winner.playerId} teamId={winner.teamId} size={26} /></p>
          {co?.map(c => <p key={c.playerId} className="award-winner award-co" onClick={() => onSelectPlayer(c.playerId)}>and <PlayerNameTag playerId={c.playerId} teamId={c.teamId} size={20} /></p>)}
          <p className="hint-text"><TeamLink name={winner.teamName} />{note ? <> · {note}</> : null}</p>
        </> : <p className="hint-text">No qualifying candidate yet.</p>}
      </div>
    </div>
  );
}

function TeamWinnerCard({ trophy, winner, who, unanimous }: { trophy: TrophyKey; winner: TeamAwardWinner | null | undefined; who: string | null; unanimous?: boolean }) {
  return (
    <div className={`award-card award-card--trophy${winner ? '' : ' award-card--empty'}${unanimous ? ' award-card--unanimous' : ''}`}>
      <PixelTrophy award={trophy} size={34} dim={!winner} />
      <div>
        <h4>{TROPHIES[trophy].label}{unanimous && <UnanimousTag compact />}</h4>
        {winner ? <>
          <p className="award-winner">{who}</p>
          <p className="hint-text"><TeamLink teamId={winner.teamId} name={winner.teamName} />{winner.detail ? ` · ${winner.detail.wins}–${winner.detail.losses}` : ''}{winner.voteShare != null ? ` · ${(winner.voteShare * 100).toFixed(0)}% share` : ''}</p>
        </> : <p className="hint-text">No qualifying team yet.</p>}
      </div>
    </div>
  );
}

function TeamSelectionBlock({ title, teams, trophies, onSelectPlayer }: { title: string; teams: AwardWinner[][]; trophies: TrophyKey[]; onSelectPlayer: (id: string) => void }) {
  return (
    <div className="award-team-block">
      <h4>{title}</h4>
      {teams.map((team, i) => (
        <div key={i} className="award-team-row">
          <span className="award-team-label"><PixelTrophy award={trophies[i] ?? trophies.at(-1)!} size={18} />{i === 0 ? '1st Team' : i === 1 ? '2nd Team' : '3rd Team'}</span>
          {team.length === 0 ? <span className="hint-text"> (none yet)</span> : team.map((w) => (
            <span key={w.playerId} className="award-team-player" onClick={() => onSelectPlayer(w.playerId)}>
              {w.position && <span className="pos-chip">{w.position}</span>}<PlayerNameTag playerId={w.playerId} teamId={w.teamId} size={22} />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function Trend({ value }: { value: number | null | undefined }) {
  if (value === undefined) return <span className="race-trend">—</span>;
  if (value === null) return <span className="race-trend race-trend--new" title="New to the top ten">NEW</span>;
  if (value === 0) return <span className="race-trend" title="Same place as last week">=</span>;
  return value > 0
    ? <span className="race-trend race-trend--up" title={`Up ${value} since last week`}>▲{value}</span>
    : <span className="race-trend race-trend--down" title={`Down ${-value} since last week`}>▼{-value}</span>;
}

function HonorLine({ h, onSelectPlayer }: { h: PeriodHonor; onSelectPlayer: (id: string) => void }) {
  return <li className="honor-line">
    <PixelTrophy award={h.kind === 'month' ? 'pom' : 'pow'} size={18} />
    <span className="honor-when">{h.label}{h.conference ? ` · ${h.conference === 'east' ? 'East' : 'West'}` : ''}</span>
    <button className="link-button" onClick={() => onSelectPlayer(h.playerId)}>{h.playerId}</button>
    <small>{h.pts.toFixed(1)} / {h.reb.toFixed(1)} / {h.ast.toFixed(1)} · {h.w}–{h.l}</small>
  </li>;
}

const RACES: RaceKey[] = ['mvp', 'dpoy', 'roy', 'smoy', 'mip'];

export function AwardsPage({ league, onSelectPlayer, awardSettings, finalsBracket, onCelebrate }: Props) {
  const options = useMemo(() => awardOptions(awardSettings), [awardSettings]);
  // In the offseason the stats have rolled over: show the season that just finished, as it was archived.
  const offseason = isOffseason(league);
  const lastRecord = league.franchiseHistory?.at(-1);
  const archived = offseason && lastRecord?.fullAwards ? lastRecord : null;
  const live = useMemo(() => archived ? null : computeSeasonAwards(league, options), [league, options, archived]);
  const awards = (archived?.fullAwards ?? live)!;
  const awardsSeason = archived?.season ?? league.season ?? '';
  const race = useMemo(() => awardRaceStandings(league, options), [league, options]);

  const [raceKey, setRaceKey] = useState<RaceKey>('mvp');
  const [allStarGame, setAllStarGame] = useState<AllStarGameResult | null>(null);
  const [night, setNight] = useState(false);
  const [allStarMessage, setAllStarMessage] = useState<string | null>(null);
  const players = useMemo(() => new Map(league.teams.flatMap(t => t.seasons.map(s => [s.playerId, s] as const))), [league]);
  const raceState = !offseason && league.awardRace?.season === league.season ? league.awardRace : undefined;

  const playAllStarGame = () => {
    const game = simulateAllStarGame(league, awards as Parameters<typeof simulateAllStarGame>[1], Date.now());
    if (!game) {
      setAllStarMessage('Not enough All-Stars selected yet to fill two squads — try raising the All-Star count in League Settings.');
      return;
    }
    setAllStarMessage(null);
    setAllStarGame(game);
  };

  let finals: PlayoffSeries | undefined;
  if (finalsBracket) finals = finalsBracket.rounds[finalsBracket.rounds.length - 1]?.[0];
  const fmvp = finals ? finalsMVPLine(finals, league) : null;
  const archivedFmvp = archived?.fmvpPlayerId ?? null;
  const fmvpInfo = useMemo(() => fmvp ? { playerId: fmvp.winner.playerId, teamId: fmvp.winner.teamId, teamName: fmvp.winner.teamName,
    line: `Finals: ${stat1(fmvp.ppg)} points, ${stat1(fmvp.rpg)} rebounds and ${stat1(fmvp.apg)} assists a game over ${fmvp.games} games` }
    : archivedFmvp ? { playerId: archivedFmvp, teamId: archived?.championTeamId ?? null, teamName: archived?.championTeamName ?? '' } : null,
  [fmvp?.winner.playerId, fmvp?.games, archivedFmvp]); // eslint-disable-line react-hooks/exhaustive-deps

  const recap = !!archived || league.seasonPhase === 'awards_recap' || !!finalsBracket?.championTeamId;
  const seasonOver = league.schedule.length > 0 && league.schedule.every(g => g.played);
  const honors = raceState?.honors ?? archived?.fullAwards?.honors ?? [];
  const weeks = honors.filter(h => h.kind === 'week');
  const latestWeek = weeks.filter(h => h.label === weeks.at(-1)?.label);
  const months = honors.filter(h => h.kind === 'month');
  const board = race[raceKey];
  const note = (w: AwardWinner | null) => w?.voteShare != null ? `${(w.voteShare * 100).toFixed(0)}% share · ${w.firstVotes ?? 0} first-place` : w ? `score ${w.score}` : undefined;
  // Only a finished vote can be unanimous; the in-season preview is a projection.
  const unanimous = (key: 'mvp' | 'dpoy' | 'roy' | 'mip' | 'smoy' | 'cpoy' | 'coy' | 'eoy', w: AwardWinner | TeamAwardWinner | null | undefined) =>
    !!w && recap && isUnanimous(awards, key, awardsSeason, 'playerId' in w ? w.playerId : undefined);
  const confs = awards.allStars.length > 0 && awards.allStars.every(w => w.conference);
  const isStarter = (w: AwardWinner) => w.starter ?? awards.allStars.indexOf(w) < 10;

  return (
    <div className="awards-page">
      {awards?.mvp && <div className={`awards-night-cta${recap ? ' awards-night-cta-live' : ''}`}>
        <PixelTrophy award="mvp" size={40} />
        <div><span className="pixel-eyebrow">{archived ? `${formatSeasonYear(awardsSeason)} AWARDS` : recap ? 'THE SEASON IS OVER' : 'AWARDS NIGHT'}</span>
          <p>{archived ? 'The new season starts at opening night. Relive last season\'s ceremony, or find every past season in the Almanac.' : recap ? 'The votes are in. Take the stage for every trophy, the vote tallies and the All-League teams.' : 'Preview the ceremony with the current races and how the panel would vote today.'}</p></div>
        <button className="primary" onClick={() => setNight(true)}>{archived ? 'Replay Awards Night' : recap ? 'Start Awards Night' : 'Preview Awards Night'}</button>
      </div>}
      {night && awards && <AwardsNight league={league} awards={awards} season={awardsSeason} fmvp={fmvpInfo} onSelectPlayer={id => { setNight(false); onSelectPlayer(id); }} onClose={() => setNight(false)} />}
      {!archived && <p className="hint-text">
        {awards.minGamesRequired} games to qualify for the major awards ({Math.round(awardSettings.minGamesShare * 100)}% of {seasonOver ? 'the season' : 'the games played so far'}), {awards.statMinGames} for stat titles and the specialist awards,
        {' '}{awards.rookieMinGames} for rookie awards. Rookies are players with no previous seasons played, whatever their age.
        A 100-member media panel votes on the major awards; the formulas behind the scores are in League Settings.
      </p>}

      {finalsBracket?.championTeamId && (
        <div className="award-card champion-card">
          <PixelTrophy award="champion" size={48} />
          <div>
            <h4>Champion</h4>
            <p className="award-winner"><TeamLink name={league.teams.find((t) => t.teamId === finalsBracket.championTeamId)?.name} /></p>
            {fmvp && (
              <p className="hint-text">
                <PixelTrophy award="fmvp" size={14} /> Finals MVP: <span className="award-winner-inline" onClick={() => onSelectPlayer(fmvp.winner.playerId)}><PlayerNameTag playerId={fmvp.winner.playerId} teamId={fmvp.winner.teamId} size={22} /></span>
                {' '}· {stat1(fmvp.ppg)} PTS · {stat1(fmvp.rpg)} REB · {stat1(fmvp.apg)} AST
              </p>
            )}
          </div>
          {onCelebrate && <button onClick={onCelebrate}>Watch the celebration</button>}
        </div>
      )}

      {!recap && <section className="award-race">
        <div className="award-race-head">
          <h4 className="stats-subheading">The Race{raceState?.ladder.length ? <small className="hint-text"> · arrows compare with the Week {raceState.ladder.length} ladder</small> : null}</h4>
          <div className="stats-view-toggle">{RACES.map(k => <button key={k} className={raceKey === k ? 'active' : ''} onClick={() => setRaceKey(k)}>{RACE_LABELS[k]}</button>)}</div>
        </div>
        {board.length === 0 ? <p className="hint-text">No qualifying players yet — the ladder fills in as games are played.</p> : <div className="stat-table-scroll"><table className="db-table race-table">
          <thead><tr><th>#</th><th>Trend</th><th className="col-name">Player</th><th>GP</th><th>PTS</th><th>REB</th><th>AST</th>{raceKey === 'dpoy' && <><th>STL</th><th>BLK</th></>}<th>Score</th></tr></thead>
          <tbody>{board.map((w, i) => { const a = perGameAverages(players.get(w.playerId)?.seasonStats); return <tr key={w.playerId} className={i === 0 ? 'race-leader' : undefined}>
            <td>{i + 1}</td><td><Trend value={ladderTrend(raceState, raceKey, w.playerId, i)} /></td>
            <td className="col-name"><button className="link-button" onClick={() => onSelectPlayer(w.playerId)}><PlayerNameTag playerId={w.playerId} teamId={w.teamId} size={22} /></button><small className="vote-team"><TeamLink name={w.teamName} /></small></td>
            <td>{a.gamesPlayed}</td><td>{stat1(a.ppg)}</td><td>{stat1(a.rpg)}</td><td>{stat1(a.apg)}</td>
            {raceKey === 'dpoy' && <><td>{stat1(a.spg)}</td><td>{stat1(a.bpg)}</td></>}
            <td>{w.score.toFixed(1)}</td>
          </tr>; })}</tbody></table></div>}
        <p className="hint-text">Ranked by the award formulas and updated every game day; the weekly ladder is saved each week for the trend arrows. At season's end the panel also weighs team success and storylines.</p>
      </section>}

      <section className="award-honors">
        <h4 className="stats-subheading">Players of the Week &amp; Month</h4>
        {honors.length === 0 ? <p className="hint-text">The first Player of the Week is named after the season's first week of games.</p> : <div className="honor-columns">
          <div><h5>{weeks.at(-1)?.label ?? 'This week'}{latestWeek[0] ? ` · ${formatDisplayDate(latestWeek[0].start)} – ${formatDisplayDate(latestWeek[0].end)}` : ''}</h5>
            <ul className="honor-list">{latestWeek.map(h => <HonorLine key={`${h.label}${h.conference}`} h={h} onSelectPlayer={onSelectPlayer} />)}</ul></div>
          <div><h5>Players of the Month</h5>
            {months.length === 0 ? <p className="hint-text">Named when each month ends.</p> : <ul className="honor-list">{months.map(h => <HonorLine key={`${h.label}${h.conference}`} h={h} onSelectPlayer={onSelectPlayer} />)}</ul>}</div>
        </div>}
        {weeks.length > 2 && <details><summary>Every Player of the Week ({weeks.length})</summary>
          <ul className="honor-list honor-list--all">{weeks.slice().reverse().map(h => <HonorLine key={`${h.label}${h.conference}`} h={h} onSelectPlayer={onSelectPlayer} />)}</ul></details>}
      </section>

      {awards && (
        <>
          <h4 className="stats-subheading">{archived ? `The ${formatSeasonYear(awardsSeason)} Winners` : recap ? 'The Winners' : 'If the Vote Were Today'}</h4>
          <div className="awards-grid">
            <WinnerCard trophy="mvp" winner={awards.mvp} note={note(awards.mvp)} co={awards.coWinners?.mvp} unanimous={unanimous('mvp', awards.mvp)} onSelectPlayer={onSelectPlayer} />
            <WinnerCard trophy="dpoy" winner={awards.dpoy} note={note(awards.dpoy)} co={awards.coWinners?.dpoy} unanimous={unanimous('dpoy', awards.dpoy)} onSelectPlayer={onSelectPlayer} />
            <WinnerCard trophy="roy" winner={awards.roy} note={note(awards.roy)} co={awards.coWinners?.roy} unanimous={unanimous('roy', awards.roy)} onSelectPlayer={onSelectPlayer} />
            <WinnerCard trophy="mip" winner={awards.mip} note={note(awards.mip)} co={awards.coWinners?.mip} unanimous={unanimous('mip', awards.mip)} onSelectPlayer={onSelectPlayer} />
            <WinnerCard trophy="smoy" winner={awards.smoy} note={note(awards.smoy)} co={awards.coWinners?.smoy} unanimous={unanimous('smoy', awards.smoy)} onSelectPlayer={onSelectPlayer} />
            <WinnerCard trophy="cpoy" winner={awards.cpoy} note={note(awards.cpoy)} co={awards.coWinners?.cpoy} unanimous={unanimous('cpoy', awards.cpoy)} onSelectPlayer={onSelectPlayer} />
            <TeamWinnerCard trophy="coy" winner={awards.coy} who={awards.coy ? awards.coy.coachName ?? awards.coy.teamName : null} unanimous={unanimous('coy', awards.coy)} />
            <TeamWinnerCard trophy="eoy" winner={awards.eoy} who={awards.eoy ? (awards.eoy.userTeam ? 'You — your front office' : `${awards.eoy.teamName} front office`) : null} unanimous={unanimous('eoy', awards.eoy)} />
            <WinnerCard trophy="pom" winner={awards.playerOfTheMonth} note={months.length ? `${awards.playerOfTheMonth?.score ?? 0}× Player of the Month` : 'best producer so far'} onSelectPlayer={onSelectPlayer} />
          </div>

          <h4 className="stats-subheading">Statistical Champions</h4>
          <div className="awards-grid">
            {([['scoringChamp', 'PPG'], ['reboundingChamp', 'RPG'], ['assistsChamp', 'APG'], ['stealsChamp', 'SPG'], ['blocksChamp', 'BPG']] as const).map(([k, unit]) =>
              <WinnerCard key={k} trophy={k} winner={awards[k]} note={awards[k] ? `${awards[k]!.score.toFixed(1)} ${unit}` : undefined} co={awards.coWinners?.[k]} onSelectPlayer={onSelectPlayer} />)}
          </div>

          <h4 className="stats-subheading">The Specialists</h4>
          <div className="awards-grid awards-grid--compact">
            {(['hustle', 'teammate', 'sharpshooter', 'floorGeneral', 'paintScorer', 'ironMan', 'rookieDefender'] as const).map(k =>
              <WinnerCard key={k} trophy={k} winner={awards[k] ?? null} co={awards.coWinners?.[k]} onSelectPlayer={onSelectPlayer} />)}
          </div>

          <TeamSelectionBlock title="All-League Teams" teams={awards.allNBA} trophies={['allLeague1', 'allLeague2', 'allLeague3']} onSelectPlayer={onSelectPlayer} />
          <TeamSelectionBlock title="All-Defensive Teams" teams={awards.allDefense} trophies={['allDefense1', 'allDefense2']} onSelectPlayer={onSelectPlayer} />
          <TeamSelectionBlock title="All-Rookie Teams" teams={awards.allRookie} trophies={['allRookie1', 'allRookie2']} onSelectPlayer={onSelectPlayer} />

          <div className="award-team-block">
            <h4>All-Stars{confs ? ' by conference' : ''}</h4>
            {(confs ? (['east', 'west'] as const) : [null]).map(conf => { const pool = awards.allStars.filter(w => !conf || w.conference === conf); return <div key={conf ?? 'all'}>
              {conf && <h5 className="all-star-conference-title">{conf === 'east' ? 'East' : 'West'}</h5>}
              {([true, false] as const).map(starter => { const list = pool.filter(w => isStarter(w) === starter); return list.length ? <div key={String(starter)} className="award-team-row">
                <span className="award-team-label"><PixelTrophy award="allStar" size={18} />{starter ? 'Starters' : 'Reserves'}</span>
                {list.map((w) => <span key={w.playerId} className="award-team-player" onClick={() => onSelectPlayer(w.playerId)}><PlayerNameTag playerId={w.playerId} teamId={w.teamId} size={22} /></span>)}
              </div> : null; })}
            </div>; })}
            {!archived && <button className="play-button secondary" onClick={playAllStarGame} style={{ marginTop: 10 }}>
              Simulate All-Star Game
            </button>}
            {allStarMessage && <p className="hint-text">{allStarMessage}</p>}
            {allStarGame && (
              <div className="allstar-result">
                <div className="allstar-score-line">
                  <span>{allStarGame.squadA.name}: {allStarGame.result.homeScore}</span>
                  <span>{allStarGame.squadB.name}: {allStarGame.result.awayScore}</span>
                </div>
                {[allStarGame.squadA, allStarGame.squadB].map(sq => <div key={sq.name} className="award-team-row">
                  <span className="hint-text">{sq.name}:</span>
                  {sq.playerIds.map((id) => <span key={id} className="award-team-player" onClick={() => onSelectPlayer(id)}>{id}</span>)}
                </div>)}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
