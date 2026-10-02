import { useEffect, useRef, useState } from 'react';
import type { PlayerSeason } from '../../simulation/types';
import { calculateOverall } from '../../simulation/engine/overall';
import { playStep, playAll, podium, tournamentAwards, STEP_NAMES, ROSTER_SIZE, type NationalTeam, type WGState } from '../../worldGames/tournament';
import { PixelIcon } from '../PixelIcon';
import { CountryName, Flag, GameList, GroupTables, Knockouts, Leaders, Podium } from './WorldGamesViews';

/** Pick your country's twelve from its players (empty spots go to home-league players). */
export function PickTwelve({ country, pool, initial, onStart, note }: { country: string; pool: PlayerSeason[]; initial: string[]; onStart: (chosen: string[]) => void; note?: string }) {
  const sorted = [...pool].sort((a, b) => calculateOverall(b) - calculateOverall(a));
  const [chosen, setChosen] = useState<string[]>(initial);
  const toggle = (id: string) => setChosen(c => (c.includes(id) ? c.filter(x => x !== id) : c.length >= ROSTER_SIZE ? c : [...c, id]));
  return <section className="wg-card wg-pick">
    <div className="wg-head"><h2><Flag country={country} size={20} /> Pick {country}'s twelve</h2><span className="hint-text">{chosen.length} of {ROSTER_SIZE} picked</span></div>
    <p className="hint-text">{note ?? `Everyone eligible from ${country}, best first.`} {pool.length < ROSTER_SIZE ? `Only ${pool.length} available: the other spots go to home-league players.` : 'Empty spots go to home-league players.'}</p>
    <div className="wg-pick-list">{sorted.map(p => {
      const on = chosen.includes(p.playerId);
      return <button key={p.playerId} className={`wg-pick-row ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => toggle(p.playerId)}>
        <i className="wg-check" aria-hidden="true" />
        <span><b>{p.playerId}</b><small>{p.age} yrs{p.teamId ? ` · ${p.teamId}` : ' · free agent'}</small></span>
        <b className="ovr">{calculateOverall(p)}</b>
      </button>;
    })}</div>
    <div className="wg-actions">
      <button className="primary" onClick={() => onStart(chosen)}><PixelIcon name="play" size={14} /> Start the World Games</button>
      <button onClick={() => setChosen(sorted.slice(0, ROSTER_SIZE).map(p => p.playerId))}>Pick the best twelve</button>
      <button disabled={!chosen.length} onClick={() => setChosen([])}>Clear</button>
    </div>
  </section>;
}

/** The tournament, step by step (a group round, the quarterfinals, the semifinals, the medal games). */
export function TournamentRun({ initial, teams, mine, onDone, onSelectPlayer, sourceLabel = 'from your league' }: {
  initial: WGState; teams: Map<string, NationalTeam>; mine?: string; onDone: (s: WGState) => void; onSelectPlayer?: (id: string) => void;
  /** How to describe the players who aren't home-league fill-ins. */
  sourceLabel?: string;
}) {
  const [s, setS] = useState(initial);
  const reported = useRef(false);
  useEffect(() => { if (s.done && !reported.current) { reported.current = true; onDone(s); } }, [s, onDone]);
  const p = podium(s);
  const lastStep = s.games.slice(-nextPairsCount(s));
  const myTeam = mine ? teams.get(mine) : undefined;
  return <div className="wg-page">
    <section className="wg-card">
      <div className="wg-head">
        <h2>{s.year} World Games · {s.city}</h2>
        {!s.done ? <div className="wg-actions">
          <button className="primary" onClick={() => setS(x => playStep(x, teams))}><PixelIcon name="play" size={14} /> Play: {STEP_NAMES[s.step]}</button>
          <button onClick={() => setS(x => playAll(x, teams))}>Play to the end</button>
        </div> : <span className="pixel-eyebrow">FINISHED</span>}
      </div>
      {myTeam && <p className="hint-text"><CountryName country={myTeam.country} bold /> · strength {myTeam.strength} · {myTeam.players.length - myTeam.homeLeague} {sourceLabel}{myTeam.homeLeague ? `, ${myTeam.homeLeague} home-league` : ''}</p>}
      {p && <Podium gold={p.gold} silver={p.silver} bronze={p.bronze} final={s.games.find(g => g.stage === 'final')} />}
    </section>
    {p && (() => { const a = tournamentAwards(s); return <section className="wg-card"><Leaders lines={Object.values(s.lines).sort((x, y) => y.pts - x.pts)} mvp={a.mvp} allTournament={a.allTournament} onSelectPlayer={onSelectPlayer} /></section>; })()}
    {s.step > 0 && !s.done && <section className="wg-card"><GameList games={lastStep} highlight={mine} title={`Results: ${STEP_NAMES[s.step - 1]}`} /></section>}
    <section className="wg-card"><h3 className="hunt-subhead">Groups</h3><GroupTables groups={s.groups} games={s.games} highlight={mine} /></section>
    <section className="wg-card"><Knockouts games={s.games} highlight={mine} />{s.step <= 3 && <p className="hint-text">The top two in each group and the two best third-placed teams go through to the quarterfinals.</p>}</section>
  </div>;
}

/** How many games the step just played had (6 per group round, then 4, 2 and 2). */
function nextPairsCount(s: WGState): number {
  if (s.step === 0) return 0;
  const prev = s.step - 1;
  return prev < 3 ? 6 : prev === 3 ? 4 : 2;
}
