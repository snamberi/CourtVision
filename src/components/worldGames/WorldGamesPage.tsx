import { useCallback, useMemo, useState } from 'react';
import { ordinal } from '../../lib/humanize';
import type { League } from '../../simulation/league';
import type { PlayerSeason } from '../../simulation/types';
import { COUNTRIES, hostOf } from '../../worldGames/data';
import { calculateOverall } from '../../simulation/engine/overall';
import { startTournament, countryOf, type WGState, type NationalTeam } from '../../worldGames/tournament';
import { buildTeams, eligiblePlayers, poolsOf, recordOf, applyResults, summerYear, medalLine, type WorldGamesRecord } from '../../worldGames/league';
import { PixelIcon } from '../PixelIcon';
import { CountryName, GameList, GroupTables, Knockouts, Leaders, MedalTable, Podium } from './WorldGamesViews';
import { PickTwelve, TournamentRun } from './TournamentRun';

/*
 * The league's World Games page: this summer's Games (to coach, when you coach a country), the latest results, the
 * all-time medal table, your players' medals, and the settings (on/off, AI or coach a country).
 */

interface Props {
  league: League;
  freeAgents: PlayerSeason[];
  controlledTeamId: string | null;
  seed: number;
  onChange: (league: League, freeAgents: PlayerSeason[]) => void;
  /** After the Games in the offseason: on to Re-sign / Waive. */
  onContinue?: () => void;
  onSelectPlayer?: (id: string) => void;
}

export function WorldGamesPage({ league, freeAgents, controlledTeamId, seed, onChange, onContinue, onSelectPlayer }: Props) {
  const wg = league.worldGames ?? { history: [] };
  const pending = wg.pending;
  const latest: WorldGamesRecord | undefined = wg.history.at(-1);
  const [run, setRun] = useState<{ state: WGState; teams: Map<string, NationalTeam> } | null>(null);
  const year = summerYear(league) ?? new Date().getUTCFullYear();
  const nextYear = pending?.year ?? (Math.ceil((year + (wg.history.some(r => r.year === year) ? 1 : 0)) / 4) * 4);
  const nextHost = hostOf(nextYear);
  const setWg = (patch: Partial<typeof wg>) => onChange({ ...league, worldGames: { ...wg, ...patch } }, freeAgents);

  const myCountry = pending ? wg.coach ?? 'USA' : undefined;
  const pool = useMemo(() => (myCountry ? poolsOf(eligiblePlayers(league, freeAgents)).get(myCountry) ?? [] : []), [league, freeAgents, myCountry]);
  const finish = useCallback((s: WGState) => {
    const record = recordOf(s, myCountry);
    const out = applyResults(league, freeAgents, s, record, seed);
    onChange(out.league, out.freeAgents);
  }, [league, freeAgents, seed, myCountry, onChange]);

  // Your players (your team) with World Games medals, newest first.
  const mine = controlledTeamId ? (league.teams.find(t => t.teamId === controlledTeamId)?.seasons ?? []).filter(p => p.worldGames?.length) : [];

  if (pending && myCountry && run) {
    return <TournamentRun initial={run.state} teams={run.teams} mine={myCountry} onDone={finish} onSelectPlayer={onSelectPlayer} />;
  }
  return <div className="wg-page">
    {pending && myCountry && <PickTwelve country={myCountry} pool={pool}
      initial={[...pool].sort((a, b) => calculateOverall(b) - calculateOverall(a)).slice(0, 12).map(p => p.playerId)}
      note={`The ${pending.year} World Games in ${pending.city} start now. You coach ${myCountry}.`}
      onStart={chosen => {
        const { teams, host, city } = buildTeams(league, freeAgents, pending.year, seed, { country: myCountry, chosen });
        setRun({ state: startTournament([...teams.values()], pending.year, city, host, seed), teams });
      }} />}

    {!pending && latest && <section className="wg-card">
      <div className="wg-head"><h2>{latest.year} World Games · {latest.city}</h2>{onContinue && <button className="primary" onClick={onContinue}><PixelIcon name="play" size={14} /> Continue to Re-sign / Waive</button>}</div>
      <Podium gold={latest.gold} silver={latest.silver} bronze={latest.bronze} final={latest.games.find(g => g.stage === 'final')} />
      {latest.coached && <p className="hint-text">You coached <CountryName country={latest.coached} bold />: {placeText(latest, latest.coached)}.</p>}
    </section>}
    {!pending && latest && <section className="wg-card"><Leaders lines={latest.lines} mvp={latest.mvp} allTournament={latest.allTournament} onSelectPlayer={onSelectPlayer} /></section>}
    {!pending && latest && <section className="wg-card"><h3 className="hunt-subhead">Groups</h3><GroupTables groups={latest.groups} games={latest.games} highlight={latest.coached} /><Knockouts games={latest.games} highlight={latest.coached} /></section>}
    {!pending && latest && <details className="wg-card"><summary>Every group game</summary><GameList games={latest.games.filter(g => g.stage === 'group')} highlight={latest.coached} /></details>}

    {!pending && !latest && <section className="wg-card">
      <div className="wg-head"><h2>World Games</h2></div>
      <p>Every four summers the best players in your league go home to play for their countries: twelve national teams, three groups, then the quarterfinals, semifinals and the medal games, under FIBA rules (40-minute games). Medals stay on the players for good.</p>
    </section>}

    <section className="wg-card">
      <div className="wg-head"><h3>Next World Games</h3><span className="hint-text">{wg.off ? 'Switched off' : `Summer ${nextYear} · ${nextHost.city}`}</span></div>
      <div className="wg-settings">
        <label className="create-check"><input type="checkbox" checked={!wg.off} onChange={e => setWg({ off: !e.target.checked })} /> Hold the World Games every four years</label>
        <label>Who plays it: <select className="year-input" value={wg.coach ?? ''} onChange={e => setWg({ coach: e.target.value || undefined })}>
          <option value="">The AI plays every country</option>
          {COUNTRIES.map(c => <option key={c.name} value={c.name}>I coach {c.name}</option>)}
        </select></label>
      </div>
      <p className="hint-text">The AI picks each country's best twelve and plays it out right after the draft. Coach a country to pick its twelve and play it round by round yourself.</p>
    </section>

    {mine.length > 0 && <section className="wg-card"><h3 className="hunt-subhead">Your players' medals</h3>
      <ul className="wg-my-medals">{mine.map(p => <li key={p.playerId}><b>{p.playerId}</b> <CountryName country={countryOf(p)} /> {medalLine(p.worldGames)}</li>)}</ul></section>}

    {wg.history.length > 0 && <section className="wg-card"><h3 className="hunt-subhead">Medal table</h3>
      <MedalTable records={wg.history} />
      <ul className="wg-my-medals">{[...wg.history].reverse().map(r => <li key={r.year}>{r.year} {r.city}: 🥇 {r.gold} · 🥈 {r.silver} · 🥉 {r.bronze}</li>)}</ul>
    </section>}
  </div>;
}

function placeText(r: WorldGamesRecord, c: string): string {
  const i = r.placings.indexOf(c);
  return i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : i >= 0 ? `finished ${ordinal(i + 1)}` : 'did not qualify';
}
