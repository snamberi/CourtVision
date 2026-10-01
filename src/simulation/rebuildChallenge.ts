import { noteFeaturedXp } from '../retention/modeOfWeek';
import type { League, PlayoffFinish } from './league';
import { isOfficialLeague } from './frontOffice';
import { localRead, type Read } from '../lib/kv';
import { SCENARIOS, scenarioById, scoreResults, type RebuildScenario } from './rebuildScenarios';

export { SCENARIOS, scenarioById, type RebuildScenario };

/*
 * Rebuild Challenge: take over a real team at its lowest point in NBA history and win a championship before the
 * clock runs out. The league is NBA history from that season (real players on real careers, real draft classes);
 * you run the team with every tool of the main game. Each season scores wins and playoff runs; a title scores big,
 * and more the sooner it comes. Stars: 1 for making the playoffs, 2 for reaching the Finals, 3 for the title.
 * Only official leagues (no Sandbox, no God Mode) go on the board.
 */


/** Stored on the league when a challenge starts; everything else is worked out from the league's history. */
export interface RebuildChallengeConfig { id: string; teamId: string; startSeason: string; seasons: number;
  /** Set for the Rebuild of the Week: the week (e.g. "2026-W39") and its twist. */
  weekly?: { week: string; twist: string };
  /** The team as it was handed over (record the season before, payroll, best three), for the before-and-after view. Missing on older saves. */
  start?: import('./rebuildSnapshot').RebuildSnapshot }
export interface ChallengeSeason { season: string; wins: number; losses: number; finish: PlayoffFinish }
export type ChallengeStatus = 'active' | 'won' | 'failed';
export interface ChallengeProgress {
  scenario: RebuildScenario; config: RebuildChallengeConfig; results: ChallengeSeason[]; status: ChallengeStatus;
  /** The season (1-based) he won it in. */
  titleIn: number | null; score: number; stars: 0 | 1 | 2 | 3; seasonNumber: number; official: boolean; fired: boolean;
}


export function challengeProgress(league: League): ChallengeProgress | null {
  const config = league.rebuildChallenge;
  const scenario = config && scenarioById(config.id);
  if (!config || !scenario) return null;
  const results: ChallengeSeason[] = [];
  for (const r of league.franchiseHistory ?? []) {
    if (r.imported || Number(r.season) < Number(config.startSeason)) continue;
    const ts = r.teamSeasons?.find(t => t.teamId === config.teamId);
    if (ts) results.push({ season: r.season, wins: ts.wins, losses: ts.losses, finish: ts.playoffFinish });
    if (results.length >= config.seasons) break;
  }
  const { counted, titleAt, score, stars } = scoreResults(results, config.seasons);
  const fo = league.frontOffice;
  const fired = !!fo && fo.teamId !== config.teamId;
  const status: ChallengeStatus = titleAt >= 0 ? 'won' : counted.length >= config.seasons || fired ? 'failed' : 'active';
  return { scenario, config, results: counted, status, titleIn: titleAt >= 0 ? titleAt + 1 : null, score, stars, seasonNumber: Math.min(config.seasons, counted.length + (status === 'active' ? 1 : 0)), official: isOfficialLeague(league), fired };
}

// ---------------------------------------------------------------- the board (this browser)

export interface RebuildRecord { best: number; stars: number; titleIn: number | null; attempts: number; completedAt?: number }
const KEY = 'cv-rebuild-records';
export function loadRebuildRecords(read: Read = localRead): Record<string, RebuildRecord> {
  try { return JSON.parse(read(KEY) ?? '{}') as Record<string, RebuildRecord>; } catch { return {}; }
}
/** Records a finished, official challenge once per save (keyed by save id so reopening it doesn't count twice). */
export function recordRebuild(p: ChallengeProgress, saveId: string): Record<string, RebuildRecord> {
  const all = loadRebuildRecords();
  if (p.status === 'active' || !p.official) return all;
  const doneKey = `${KEY}-done`;
  let done: string[] = [];
  try { done = JSON.parse(localStorage.getItem(doneKey) ?? '[]') as string[]; } catch { /* none */ }
  if (done.includes(saveId)) return all;
  const prev = all[p.scenario.id];
  const next: RebuildRecord = { best: Math.max(prev?.best ?? 0, p.score), stars: Math.max(prev?.stars ?? 0, p.stars), attempts: (prev?.attempts ?? 0) + 1, completedAt: Date.now(),
    titleIn: p.titleIn != null && (prev?.titleIn == null || p.titleIn < prev.titleIn) ? p.titleIn : prev?.titleIn ?? null };
  const out = { ...all, [p.scenario.id]: next };
  try { localStorage.setItem(KEY, JSON.stringify(out)); localStorage.setItem(doneKey, JSON.stringify([...done, saveId])); } catch { /* storage blocked */ }
  // Mode of the Week: a finished rebuild in its week counts double (attempt, stars and a title, as profile XP counts them).
  noteFeaturedXp('rebuild', `rb-${saveId}`, 100 + p.stars * 75 + (p.titleIn != null ? 250 : 0));
  return out;
}
