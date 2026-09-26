import { PixelIcon } from './PixelIcon';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { SeasonPhase } from '../simulation/league';
import type { RosterComplianceIssue } from '../simulation/rosterRequirements';
import { describeRosterIssue } from '../simulation/rosterRequirements';
import type { AutoPlayProgress, SeasonSimProgress } from '../workers/useBackgroundJobs';
import type { ProgressStore } from '../workers/progressStore';
import type { PlayoffBracket } from '../simulation/playoffs';

const GAME_PRESETS = [
  { label: '1 Game', games: 1 },
  { label: '1 Week', games: 7 },
  { label: '1 Month', games: 30 },
];

export interface PlayButtonProps {
  seasonPhase: SeasonPhase;
  rosterIssues: RosterComplianceIssue[];

  // --- regular season: games remaining for the schedule as a whole ---
  leagueUnplayedCount: number;
  tradeDeadlinePassed: boolean;
  onWatchNext?: () => void;
  /** Watch the controlled team's next game with live coaching (timeouts, subs, pace, defense). */
  onCoachNext?: () => void;
  onPlayAllStar?: () => void;
  onOpenAllStar?: () => void;
  autoAllStar?: boolean;
  onToggleAutoAllStar?: (on: boolean) => void;
  onSimulateGames: (count: number) => void; // simulates up to `count` scheduled rounds
  onSimulateToDeadline: () => void;
  /** The Deadline Day clock ("11:00 AM") while the day is under way. */
  deadlineClockLabel?: string | null;
  onOpenDeadline?: () => void;
  seasonSimJob: { running: boolean; progress: ProgressStore<SeasonSimProgress>; start: () => void; cancel: () => void };
  autoPlayJob: { running: boolean; progress: AutoPlayProgress | null; start: (years: number) => void; cancel: () => void };

  // --- phase transitions: each is a single automated step, replacing the old "Continue to X" buttons ---
  seasonComplete: boolean;
  onBeginPlayoffs: () => void;
  playoffBracket: PlayoffBracket | null;
  onSimulateEntirePlayoffs: () => void;
  onViewSeasonRecap: () => void;
  onContinueToDraft: () => void;
  draftPicksRemaining: number;
  hasUpcomingDraftPick: boolean;
  onSimToMyNextPick: () => void;
  onSimEntireDraftAndContinue: () => void;
  onContinueToResignWaive: () => void;
  onContinueToFreeAgency: () => void;
  freeAgencyDaysRemaining: number;
  onSkipFreeAgencyAndContinue: () => void;
  onStartRegularSeason: () => void;
}

/**
 * The single, fixed-position control for advancing the season. Replaces the old scattered set of
 * "Sim Week" / "Sim Month" / "Continue to Draft" / "Start Free Agency" / etc. buttons — clicking Play
 * always shows exactly the menu of things you can do *right now*, sized to the current phase, and
 * every phase transition it offers happens automatically (no separate "open"/"start" step needed).
 */
export function PlayButton(props: PlayButtonProps) {
  const {
    seasonPhase, rosterIssues,
    leagueUnplayedCount, tradeDeadlinePassed, onSimulateGames, onSimulateToDeadline, seasonSimJob, autoPlayJob,
    seasonComplete, onBeginPlayoffs, playoffBracket, onSimulateEntirePlayoffs, onViewSeasonRecap,
    onContinueToDraft, draftPicksRemaining, hasUpcomingDraftPick, onSimToMyNextPick, onSimEntireDraftAndContinue,
    onContinueToResignWaive, onContinueToFreeAgency, freeAgencyDaysRemaining, onSkipFreeAgencyAndContinue, onStartRegularSeason,
  } = props;

  const [open, setOpen] = useState(false);
  const simProgress = useSyncExternalStore(seasonSimJob.progress.subscribe, seasonSimJob.progress.get);
  const [customGames, setCustomGames] = useState(10);
  const [autoPlaySeasons, setAutoPlaySeasons] = useState(5);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onOutside); document.removeEventListener('keydown', onEsc); };
  }, [open]);

  const anyJobRunning = seasonSimJob.running || autoPlayJob.running;
  const blocked = seasonPhase === 'regular_season' && !seasonComplete && rosterIssues.length > 0;

  const doAndClose = (fn: () => void) => { fn(); setOpen(false); };

  // What the button itself shows without opening the menu — a short label for the single most useful next step.
  let idleLabel = 'Play';
  if (blocked) idleLabel = 'Play';
  else if (seasonSimJob.running && simProgress) idleLabel = `Simulating… ${simProgress.pct}%`;
  else if (anyJobRunning) idleLabel = 'Simulating…';
  else if (seasonPhase === 'regular_season' && !seasonComplete) idleLabel = `Play (${leagueUnplayedCount} left)`;
  else if (seasonPhase === 'regular_season' && seasonComplete) idleLabel = 'Begin Playoffs';
  else if (seasonPhase === 'playoffs' && playoffBracket?.championTeamId) idleLabel = 'View Recap';
  else if (seasonPhase === 'playoffs') idleLabel = 'Play Playoffs';
  else if (seasonPhase === 'awards_recap') idleLabel = 'Continue to Draft';
  else if (seasonPhase === 'draft') idleLabel = 'Play Draft';
  else if (seasonPhase === 'resign_waive') idleLabel = 'Continue';
  else if (seasonPhase === 'free_agency') idleLabel = 'Play';
  else if (seasonPhase === 'preseason') idleLabel = 'Start Season';
  else if (seasonPhase === 'all_star') idleLabel = 'Play All-Star Weekend';

  return (
    <div className="play-button-root" ref={rootRef}>
      {open && (
        <div className="play-menu" role="menu">
          <div className="play-menu-header">
            <strong>Play</strong>
            <button className="play-menu-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
          </div>

          {blocked && (
            <div className="play-menu-blocked">
              <p>
                Regular-season games require 10–18 players per team. {rosterIssues.length} team{rosterIssues.length === 1 ? '' : 's'} out of compliance:
              </p>
              <ul>{rosterIssues.map((i) => <li key={i.teamId}>{describeRosterIssue(i)}</li>)}</ul>
              <p className="hint-text">Coaches sign or waive players automatically. If a roster remains short, check available free agents and hard-cap room. Drafting and offseason actions remain available.</p>
            </div>
          )}

          {anyJobRunning && (
            <div className="play-menu-section">
              {seasonSimJob.running && (
                <>
                  <p>Simulating the season in the background{simProgress ? ` — ${simProgress.played}/${simProgress.total} games (${simProgress.pct}%)` : '…'}</p>
                  <button onClick={seasonSimJob.cancel}>Cancel</button>
                </>
              )}
              {autoPlayJob.running && (
                <>
                  <p>Auto-playing multiple seasons{autoPlayJob.progress ? ` — season ${Math.min(autoPlayJob.progress.year + 1, autoPlayJob.progress.total)} of ${autoPlayJob.progress.total}` : '…'}</p>
                  <button onClick={autoPlayJob.cancel}>Cancel</button>
                </>
              )}
            </div>
          )}

          {!blocked && !anyJobRunning && seasonPhase === 'regular_season' && props.deadlineClockLabel && props.onOpenDeadline && (
            <div className="play-menu-section">
              <p>Trade Deadline Day · {props.deadlineClockLabel}. Playing on runs the clock to the 3 PM deadline.</p>
              <button className="primary" onClick={() => doAndClose(props.onOpenDeadline!)}>Open Deadline Day</button>
            </div>
          )}

          {!blocked && !anyJobRunning && seasonPhase === 'regular_season' && !seasonComplete && (
            <div className="play-menu-section">
              <p className="hint-text">Generate up to {leagueUnplayedCount} more games this season.</p>
              {props.onWatchNext && <button className="primary" disabled={leagueUnplayedCount === 0} onClick={() => doAndClose(props.onWatchNext!)}>Watch Next Game</button>}
              {props.onCoachNext && <button className="primary" disabled={leagueUnplayedCount === 0} onClick={() => doAndClose(props.onCoachNext!)}>Coach Next Game Live</button>}
              <div className="play-menu-presets">
                {GAME_PRESETS.map((p) => (
                  <button key={p.label} disabled={leagueUnplayedCount === 0} onClick={() => doAndClose(() => onSimulateGames(p.games))}>
                    {p.label}
                  </button>
                ))}
                {!tradeDeadlinePassed && (
                  <button disabled={leagueUnplayedCount === 0} onClick={() => doAndClose(onSimulateToDeadline)}>To Trade Deadline</button>
                )}
                <button disabled={leagueUnplayedCount === 0} onClick={() => doAndClose(() => seasonSimJob.start())}>Rest of Season</button>
              </div>
              <label className="play-menu-custom">
                Custom:
                <input
                  type="number" min={1} max={Math.max(1, leagueUnplayedCount)} value={customGames}
                  onChange={(e) => setCustomGames(Math.max(1, Math.min(leagueUnplayedCount, Number(e.target.value) || 1)))}
                />
                games
                <button disabled={leagueUnplayedCount === 0} onClick={() => doAndClose(() => onSimulateGames(customGames))}>Go</button>
              </label>
              <label className="play-menu-custom">
                Auto Play:
                <input type="number" min={1} max={50} value={autoPlaySeasons} onChange={(e) => setAutoPlaySeasons(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} />
                season{autoPlaySeasons === 1 ? '' : 's'}
                <button onClick={() => doAndClose(() => autoPlayJob.start(autoPlaySeasons))}>Go</button>
              </label>
            </div>
          )}

          {!anyJobRunning && seasonPhase === 'all_star' && (
            <div className="play-menu-section">
              <p>All-Star Weekend: the regular season resumes once it's played.</p>
              {props.onPlayAllStar && <button className="primary" onClick={() => doAndClose(props.onPlayAllStar!)}>Sim All-Star Weekend</button>}
              {props.onOpenAllStar && <button onClick={() => doAndClose(props.onOpenAllStar!)}>Open All-Star Central</button>}
            </div>
          )}

          {!anyJobRunning && (seasonPhase === 'regular_season' || seasonPhase === 'all_star') && props.onToggleAutoAllStar && (
            <label className="play-menu-custom play-menu-toggle"><input type="checkbox" checked={!!props.autoAllStar} onChange={e => props.onToggleAutoAllStar!(e.target.checked)} /> Auto-play All-Star Weekend when the break arrives</label>
          )}

          {!blocked && !anyJobRunning && seasonPhase === 'regular_season' && seasonComplete && (
            <div className="play-menu-section">
              <p>Regular season complete.</p>
              <button className="primary" onClick={() => doAndClose(onBeginPlayoffs)}>Begin Playoffs</button>
            </div>
          )}

          {!blocked && !anyJobRunning && seasonPhase === 'playoffs' && (
            <div className="play-menu-section">
              {playoffBracket?.championTeamId ? (
                <button className="primary" onClick={() => doAndClose(onViewSeasonRecap)}>View Season Recap</button>
              ) : (
                <>
                  <p className="hint-text">Full round-by-round control is on the Playoffs page — this is the fast path.</p>
                  <button className="primary" onClick={() => doAndClose(onSimulateEntirePlayoffs)}>Simulate Entire Playoffs</button>
                </>
              )}
            </div>
          )}

          {!blocked && seasonPhase === 'awards_recap' && (
            <div className="play-menu-section">
              <p>Season recap is ready on the Awards page.</p>
              <button className="primary" onClick={() => doAndClose(onContinueToDraft)}>Continue to Draft</button>
            </div>
          )}

          {!blocked && seasonPhase === 'draft' && (
            <div className="play-menu-section">
              {draftPicksRemaining > 0 ? (
                <>
                  {hasUpcomingDraftPick && <button onClick={() => doAndClose(onSimToMyNextPick)}>Sim to My Next Pick</button>}
                  <button className="primary" onClick={() => doAndClose(onSimEntireDraftAndContinue)}>Sim Entire Draft</button>
                </>
              ) : (
                <button className="primary" onClick={() => doAndClose(onContinueToResignWaive)}>Continue to Resign/Waive</button>
              )}
            </div>
          )}

          {!blocked && seasonPhase === 'resign_waive' && (
            <div className="play-menu-section">
              <p className="hint-text">Review your roster on the Resign/Waive page, then continue when ready.</p>
              <button className="primary" onClick={() => doAndClose(onContinueToFreeAgency)}>Continue to Free Agency</button>
            </div>
          )}

          {!blocked && seasonPhase === 'free_agency' && (
            <div className="play-menu-section">
              <p className="hint-text">
                {freeAgencyDaysRemaining > 0
                  ? `${freeAgencyDaysRemaining} day${freeAgencyDaysRemaining === 1 ? '' : 's'} left in free agency.`
                  : 'Free agency has run its course.'}
              </p>
              <button className="primary" onClick={() => doAndClose(onSkipFreeAgencyAndContinue)}>
                {freeAgencyDaysRemaining > 0 ? 'Skip Free Agency & Continue' : 'Continue to Preseason'}
              </button>
            </div>
          )}

          {!blocked && seasonPhase === 'preseason' && (
            <div className="play-menu-section">
              <button className="primary" onClick={() => doAndClose(onStartRegularSeason)}>Start Regular Season</button>
            </div>
          )}
        </div>
      )}

      <button
        className={`play-button-fixed ${blocked ? 'blocked' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title={blocked ? 'Roster requirements not met — click for details' : 'Advance the season'}
      >
        <PixelIcon name={blocked ? "warning" : "play"} /> {idleLabel}
      </button>
    </div>
  );
}
