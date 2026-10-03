import { useCallback, useEffect, useMemo, useState } from 'react';
import { ordinal } from '../../lib/humanize';
import type { NbaHistory } from '../../history/nbaHistoryData';
import { PixelIcon } from '../PixelIcon';
import { track } from '../../analytics/track';
import { startTournament, placings, type NationalTeam, type WGState } from '../../worldGames/tournament';
import { hostFor, modeTeams, myPool, modeScore, saveModeResult, MODE_GAMES, type GamesId, type ModeRecords } from '../../worldGames/mode';
import { MEDAL_ICON } from '../../worldGames/league';
import { CountryName } from './WorldGamesViews';
import { PickTwelve, TournamentRun } from './TournamentRun';
import '../hunt/hunt.css';
import '../locker/locker.css';
import '../arcade/arcade.css';

/** The World Games mode: your country at a real Games or the Fantasy Games. */
export function WorldGamesMode({ games, country, onExit, onNew }: { games: GamesId; country: string; onExit: () => void; onNew: () => void }) {
  const [h, setH] = useState<NbaHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    import('../../history/nbaHistoryData').then(m => m.loadNbaHistory()).then(d => { if (live) setH(d); }, e => { if (live) setError(e instanceof Error ? e.message : String(e)); });
    return () => { live = false; };
  }, []);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [run, setRun] = useState<{ state: WGState; teams: Map<string, NationalTeam> } | null>(null);
  /** Your last twelve: Play again starts from them. */
  const [lastChosen, setLastChosen] = useState<string[] | null>(null);
  const [result, setResult] = useState<{ place: number; score: number; records: ModeRecords; state: WGState } | null>(null);
  const pool = useMemo(() => (h ? myPool(h, games, country) : []), [h, games, country]);
  const host = hostFor(games, country);
  const label = MODE_GAMES.find(g => g.id === games)?.label ?? String(games);
  const year = games === 'fantasy' ? 2028 : games;
  const done = useCallback((s: WGState) => {
    const place = placings(s).indexOf(country);
    const score = modeScore(s, country, place);
    setResult({ place, score, records: saveModeResult(games, country, place, score), state: s });
    track('mode_finish', { mode: 'worldgames', games: String(games), country, place: place + 1, score });
  }, [games, country]);

  return <div className="hunt locker wg-mode">
    <header className="hunt-top">
      <button className="hunt-exit" onClick={onExit}><PixelIcon name="exit" size={16} /> Main Menu</button>
      <div className="hunt-title"><span className="pixel-eyebrow">WORLD GAMES · {label.toUpperCase()}</span><h1><CountryName country={country} /></h1></div>
    </header>
    {error ? <p className="empty-state">Could not load the NBA history data: {error}</p>
      : !h ? <p className="empty-state">Loading every national team…</p>
      : result && run ? <>
        <section className="wg-card">
          <div className="wg-head"><h2>{result.place <= 2 ? `${MEDAL_ICON[(['gold', 'silver', 'bronze'] as const)[result.place]]} ${['Gold', 'Silver', 'Bronze'][result.place]} for ${country}!` : `${country} finished ${ordinal(result.place + 1)}`}</h2>
            <div className="wg-actions">
              <button className="primary" onClick={() => { setRun(null); setResult(null); setSeed(Math.floor(Math.random() * 1e9)); }}><PixelIcon name="play" size={14} /> Play again</button>
              <button onClick={onNew}>Other Games or country</button>
            </div></div>
          <div className="arcade-stats"><span><b>{result.score.toLocaleString()}</b><small>Score</small></span><span><b>{result.records.best.toLocaleString()}</b><small>Best score</small></span><span><b>{result.records.gold}</b><small>Golds won</small></span><span><b>{result.records.played}</b><small>Games played</small></span></div>
          <p className="hint-text">Score: 1,000 for gold, 600 silver, 350 bronze, 200 fourth, 100 for a quarterfinal; plus 15 a win and the points difference (up to 150).</p>
        </section>
        <TournamentRun key={`${seed}-done`} initial={result.state} teams={run.teams} mine={country} onDone={() => {}} sourceLabel="real players" />
      </>
      : run ? <TournamentRun key={seed} initial={run.state} teams={run.teams} mine={country} onDone={done} sourceLabel="real players" />
      : <PickTwelve country={country} pool={pool} initial={lastChosen ?? pool.slice(0, 12).map(p => p.playerId)}
        note={games === 'fantasy' ? `Every ${country} player in history at his best season.` : `${country}'s players as they were in ${games - 1}-${String(games).slice(2)}. ${host.city} hosts.`}
        onStart={chosen => {
          setLastChosen(chosen);
          const teams = modeTeams(h, games, country, chosen, seed);
          setRun({ state: startTournament([...teams.values()], year, host.city, host.country, seed), teams });
          track('mode_start', { mode: 'worldgames', games: String(games), country });
        }} />}
  </div>;
}
