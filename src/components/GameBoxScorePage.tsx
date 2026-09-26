import type { Occasion } from '../simulation/bigGames';
import { OccasionBanner } from './OccasionBanner';
import { PixelIcon } from './PixelIcon';
import { TeamLink } from './TeamLink';
import { WatchGame } from './WatchGame';
import { formatPlayingTime } from '../simulation/boxscore';
import { useMemo, useState } from 'react';
import type { GameResult, PlayerStatLine, TeamBoxScore } from '../simulation/boxscore';

import type { PlayerSeason } from '../simulation/types';
import { primaryPosition } from '../simulation/teamStatus';
import { PossessionLogView } from './PossessionLogView';
import type { CoachingProps } from './WatchPanels';
import { withGameLog } from '../simulation/logPacking';

interface TeamMeta {
  teamId: string;
  name: string;
  record?: string;
}

interface Props {
  initialWatch?: boolean;
  /** Possession to start the replay at (news highlights). */
  watchStart?: number;
  coaching?: CoachingProps;
  game: GameResult;
  home: TeamMeta;
  away: TeamMeta;
  homeRoster?: PlayerSeason[];
  awayRoster?: PlayerSeason[];
  onSelectPlayer?: (playerId: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
  canPrev?: boolean;
  canNext?: boolean;
  onSimNext?: () => void;
  canSimNext?: boolean;
  gamesLabel?: string;
  rivalry?: { level: string; seriesText?: string } | null;
  /** Playoff or Cup stakes, shown as a broadcast banner and passed to the watch view. */
  occasion?: Occasion | null;
}

/** Simple deterministic accent color per team so two badges always read as different teams. */
function teamColor(teamId: string): string {
  let hash = 0;
  for (let i = 0; i < teamId.length; i++) hash = (hash * 31 + teamId.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return `hsl(${hue}, 62%, 46%)`;
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return parts.map((p) => p[0]).join('').slice(0, 3).toUpperCase();
}

/** Standard Hollinger Game Score. */
function gameScore(l: PlayerStatLine): number {
  return (
    l.points + 0.4 * l.fgm - 0.7 * l.fga - 0.4 * (l.fta - l.ftm) +
    0.7 * l.oreb + 0.3 * l.dreb + l.stl + 0.7 * l.ast + 0.7 * l.blk - 0.4 * l.pf - l.tov
  );
}

/** Derives per-quarter (and OT) scores for both teams from the possession log's running totals. */
function quarterScores(game: GameResult): { labels: string[]; home: number[]; away: number[] } {
  const byQuarter = new Map<number, { home: number; away: number }>();
  for (const p of game.possessionLog) {
    byQuarter.set(p.quarter, { home: p.homeScoreAfter, away: p.awayScoreAfter });
  }
  const quarters = [...byQuarter.keys()].sort((a, b) => a - b);
  const labels: string[] = [];
  const home: number[] = [];
  const away: number[] = [];
  let prevHome = 0;
  let prevAway = 0;
  for (const q of quarters) {
    const snap = byQuarter.get(q)!;
    home.push(snap.home - prevHome);
    away.push(snap.away - prevAway);
    labels.push(q <= (game.regulationPeriods ?? 4) ? String(q) : `OT${q - (game.regulationPeriods ?? 4)}`);
    prevHome = snap.home;
    prevAway = snap.away;
  }
  return { labels, home, away };
}

/** Derives per-player plus/minus purely from the possession log's on-court arrays and running score. */
function plusMinusByPlayer(game: GameResult): Record<string, number> {
  const pm: Record<string, number> = {};
  let prevHome = 0;
  let prevAway = 0;
  for (const p of game.possessionLog) {
    const swingForHome = (p.homeScoreAfter - prevHome) - (p.awayScoreAfter - prevAway);
    for (const id of p.onCourtHome) pm[id] = (pm[id] ?? 0) + swingForHome;
    for (const id of p.onCourtAway) pm[id] = (pm[id] ?? 0) - swingForHome;
    prevHome = p.homeScoreAfter;
    prevAway = p.awayScoreAfter;
  }
  return pm;
}

function teamShootingSummary(box: TeamBoxScore) {
  const rows = Object.values(box.players);
  let fgm = 0, fga = 0, tpm = 0, ftm = 0, fta = 0, oreb = 0, tov = 0;
  for (const r of rows) { fgm += r.fgm; fga += r.fga; tpm += r.tpm; ftm += r.ftm; fta += r.fta; oreb += r.oreb; tov += r.tov; }
  const efg = fga > 0 ? (fgm + 0.5 * tpm) / fga : 0;
  const possessionsEstimate = fga + 0.44 * fta + tov;
  const tovPct = possessionsEstimate > 0 ? tov / possessionsEstimate : 0;
  return { efg, tovPct, oreb, fga, fta, ftFga: fga > 0 ? fta / fga : 0 };
}

function TeamBadge({ teamId, name }: { teamId: string; name: string }) {
  return (
    <span className="team-badge" style={{ background: teamColor(teamId) }} title={name}>
      {initials(name)}
    </span>
  );
}

function PlayerRows({
  box, roster, onSelectPlayer, pm,
}: {
  box: TeamBoxScore; roster?: PlayerSeason[]; onSelectPlayer?: (id: string) => void; pm: Record<string, number>;
}) {
  const rosterById = new Map((roster ?? []).map((s) => [s.playerId, s]));
  const rows = Object.values(box.players).sort((a, b) => b.minutes - a.minutes);
  const played = rows.filter((r) => r.minutes > 0);
  const dnp = rows.filter((r) => r.minutes === 0);

  const teamTotals = rows.reduce((acc, r) => {
    acc.fgm += r.fgm; acc.fga += r.fga; acc.tpm += r.tpm; acc.tpa += r.tpa; acc.ftm += r.ftm; acc.fta += r.fta;
    acc.oreb += r.oreb; acc.dreb += r.dreb; acc.ast += r.ast; acc.tov += r.tov; acc.stl += r.stl; acc.blk += r.blk;
    acc.ba += r.ba; acc.pf += r.pf; acc.points += r.points;
    return acc;
  }, { fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, oreb: 0, dreb: 0, ast: 0, tov: 0, stl: 0, blk: 0, ba: 0, pf: 0, points: 0 });

  const fmtPct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : '0.0%');

  return (
    <table className="boxscore-table">
      <thead>
        <tr>
          <th className="col-name">Name</th><th>Pos</th><th>MP</th><th>FG</th><th>3P</th><th>FT</th>
          <th>ORB</th><th>TRB</th><th>AST</th><th>TOV</th><th>STL</th><th>BLK</th><th>BA</th><th>PF</th>
          <th>PTS</th><th>+/-</th><th>GmSc</th>
        </tr>
      </thead>
      <tbody>
        {played.map((r) => {
          const season = rosterById.get(r.playerId);
          return (
            <tr
              key={r.playerId}
              className={onSelectPlayer ? 'clickable' : undefined}
              onClick={() => onSelectPlayer?.(r.playerId)}
            >
              <td className="col-name">{r.playerId}</td>
              <td>{season ? primaryPosition(season) : '—'}</td>
              <td>{formatPlayingTime(r.minutes)}</td>
              <td>{r.fgm}-{r.fga}</td>
              <td>{r.tpm}-{r.tpa}</td>
              <td>{r.ftm}-{r.fta}</td>
              <td>{r.oreb}</td>
              <td>{r.oreb + r.dreb}</td>
              <td>{r.ast}</td>
              <td>{r.tov}</td>
              <td>{r.stl}</td>
              <td>{r.blk}</td>
              <td>{r.ba}</td>
              <td>{r.pf}</td>
              <td>{r.points}</td>
              <td className={(pm[r.playerId] ?? 0) >= 0 ? 'plus' : 'minus'}>
                {(pm[r.playerId] ?? 0) >= 0 ? '+' : ''}{Math.round(pm[r.playerId] ?? 0)}
              </td>
              <td>{gameScore(r).toFixed(1)}</td>
            </tr>
          );
        })}
        {dnp.map((r) => (
          <tr key={r.playerId} className="dnp-row">
            <td className="col-name">{r.playerId}</td>
            <td>{rosterById.get(r.playerId) ? primaryPosition(rosterById.get(r.playerId)!) : '—'}</td>
            <td colSpan={15}>DNP — Coach's decision</td>
          </tr>
        ))}
        <tr className="totals-row">
          <td className="col-name">Total</td><td /><td />
          <td>{teamTotals.fgm}-{teamTotals.fga}</td>
          <td>{teamTotals.tpm}-{teamTotals.tpa}</td>
          <td>{teamTotals.ftm}-{teamTotals.fta}</td>
          <td>{teamTotals.oreb}</td>
          <td>{teamTotals.oreb + teamTotals.dreb}</td>
          <td>{teamTotals.ast}</td>
          <td>{teamTotals.tov}</td>
          <td>{teamTotals.stl}</td>
          <td>{teamTotals.blk}</td>
          <td>{teamTotals.ba}</td>
          <td>{teamTotals.pf}</td>
          <td>{teamTotals.points}</td>
          <td /><td />
        </tr>
        <tr className="pct-row">
          <td className="col-name">Percentages</td><td /><td />
          <td>{fmtPct(teamTotals.fgm, teamTotals.fga)}</td>
          <td>{fmtPct(teamTotals.tpm, teamTotals.tpa)}</td>
          <td>{fmtPct(teamTotals.ftm, teamTotals.fta)}</td>
          <td colSpan={10} />
        </tr>
      </tbody>
    </table>
  );
}

function teamLeaders(box: TeamBoxScore) {
  const rows = Object.values(box.players);
  const top = (f: (r: PlayerStatLine) => number) => rows.reduce((best, r) => (f(r) > f(best) ? r : best), rows[0]);
  if (rows.length === 0) return null;
  return { pts: top((r) => r.points), reb: top((r) => r.oreb + r.dreb), ast: top((r) => r.ast) };
}

export function GameBoxScorePage({
  game: storedGame, home, away, homeRoster, awayRoster, onSelectPlayer, initialWatch = false, watchStart, coaching,
  onPrev, onNext, canPrev, canNext, onSimNext, canSimNext, gamesLabel, rivalry, occasion,
}: Props) {
  // Older games keep their replay log compressed; expand it only when this game is opened.
  const game = useMemo(() => withGameLog(storedGame), [storedGame]);
  const [showPbp, setShowPbp] = useState(false);
  const [watching, setWatching] = useState(initialWatch);
  const q = useMemo(() => quarterScores(game), [game]);
  const pm = useMemo(() => plusMinusByPlayer(game), [game]);
  const homeSummary = teamShootingSummary(game.homeBox);
  const awaySummary = teamShootingSummary(game.awayBox);
  const homeLeaders = teamLeaders(game.homeBox);
  const awayLeaders = teamLeaders(game.awayBox);
  const homeWon = game.homeScore > game.awayScore;

  if (watching) return <WatchGame key={`${game.homeTeamId}-${game.awayTeamId}-${game.seed}`} game={game} home={home} away={away} homeRoster={homeRoster} awayRoster={awayRoster} onBoxScore={() => setWatching(false)} startAt={watchStart} coaching={coaching} rivalry={rivalry} occasion={occasion} />;
  return (
    <div className="game-box-score">
      {occasion && <OccasionBanner occasion={occasion} />}
      <div className="gbs-watch-action"><button className="primary" onClick={() => setWatching(true)} disabled={!game.possessionLog.length}><PixelIcon name="play" /> Watch Game</button><span className="hint-text">Replay the action on the pixel court.</span></div>
      <div className="gbs-scoreboard">
        <div className={`gbs-team ${homeWon ? 'winner' : ''}`}>
          <TeamBadge teamId={home.teamId} name={home.name} />
          <div className="gbs-team-info">
            <span className="gbs-team-name"><TeamLink name={home.name} /></span>
            {home.record && <span className="gbs-team-record">{home.record}</span>}
          </div>
          <span className="gbs-score">{game.homeScore}</span>
        </div>

        <div className="gbs-linescore">
          <table>
            <thead>
              <tr><th />{q.labels.map((l) => <th key={l}>{l}</th>)}<th>eFG%</th><th>TOV%</th><th>ORB%</th><th>FT/FGA</th></tr>
            </thead>
            <tbody>
              <tr>
                <td className="ls-abbr"><TeamLink teamId={away.teamId} name={initials(away.name)} /></td>
                {q.away.map((v, i) => <td key={i}>{v}</td>)}
                <td>{(awaySummary.efg * 100).toFixed(1)}</td>
                <td>{(awaySummary.tovPct * 100).toFixed(1)}</td>
                <td>{awaySummary.oreb}</td>
                <td>{awaySummary.ftFga.toFixed(3)}</td>
              </tr>
              <tr>
                <td className="ls-abbr"><TeamLink teamId={home.teamId} name={initials(home.name)} /></td>
                {q.home.map((v, i) => <td key={i}>{v}</td>)}
                <td>{(homeSummary.efg * 100).toFixed(1)}</td>
                <td>{(homeSummary.tovPct * 100).toFixed(1)}</td>
                <td>{homeSummary.oreb}</td>
                <td>{homeSummary.ftFga.toFixed(3)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="gbs-controls">
          {gamesLabel && <span className="gbs-games-label">{gamesLabel}</span>}
          <div className="gbs-nav">
            <button disabled={!canPrev} onClick={onPrev}>Prev</button>
            {onSimNext && <button className="primary" disabled={!canSimNext} onClick={onSimNext}>Sim Next</button>}
            <button disabled={!canNext} onClick={onNext}>Next</button>
          </div>
        </div>

        <div className={`gbs-team ${!homeWon ? 'winner' : ''}`}>
          <span className="gbs-score">{game.awayScore}</span>
          <div className="gbs-team-info">
            <span className="gbs-team-name"><TeamLink name={away.name} /></span>
            {away.record && <span className="gbs-team-record">{away.record}</span>}
          </div>
          <TeamBadge teamId={away.teamId} name={away.name} />
        </div>
      </div>

      {(homeLeaders || awayLeaders) && (
        <div className="gbs-leaders">
          {awayLeaders && (
            <span>
              <TeamLink name={away.name} /> leaders: {awayLeaders.pts.playerId} {awayLeaders.pts.points} PTS ·{' '}
              {awayLeaders.reb.playerId} {awayLeaders.reb.oreb + awayLeaders.reb.dreb} REB ·{' '}
              {awayLeaders.ast.playerId} {awayLeaders.ast.ast} AST
            </span>
          )}
          {homeLeaders && (
            <span>
              <TeamLink name={home.name} /> leaders: {homeLeaders.pts.playerId} {homeLeaders.pts.points} PTS ·{' '}
              {homeLeaders.reb.playerId} {homeLeaders.reb.oreb + homeLeaders.reb.dreb} REB ·{' '}
              {homeLeaders.ast.playerId} {homeLeaders.ast.ast} AST
            </span>
          )}
        </div>
      )}

      {game.injuries.length > 0 && (
        <p className="hint-text gbs-injuries">
          Injuries: {game.injuries.map((i) => `${i.playerId} (${i.severity}, Q${i.quarter})`).join(', ')}
        </p>
      )}

      <h4><TeamLink name={away.name} /></h4>
      <PlayerRows box={game.awayBox} roster={awayRoster} onSelectPlayer={onSelectPlayer} pm={pm} />

      <h4><TeamLink name={home.name} /></h4>
      <PlayerRows box={game.homeBox} roster={homeRoster} onSelectPlayer={onSelectPlayer} pm={pm} />

      <div className="gbs-pbp-toggle">
        <button onClick={() => setShowPbp((v) => !v)}>{showPbp ? 'Hide' : 'Show'} Play-by-Play</button>
      </div>
      {showPbp && <PossessionLogView log={game.possessionLog} />}
    </div>
  );
}
