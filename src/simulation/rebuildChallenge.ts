import type { League, PlayoffFinish } from './league';
import { isOfficialLeague } from './frontOffice';

/*
 * Rebuild Challenge: take over a real team at its lowest point in NBA history and win a championship before the
 * clock runs out. The league is NBA history from that season (real players on real careers, real draft classes);
 * you run the team with every tool of the main game. Each season scores wins and playoff runs; a title scores big,
 * and more the sooner it comes. Stars: 1 for making the playoffs, 2 for reaching the Finals, 3 for the title.
 * Only official leagues (no Sandbox, no God Mode) go on the board.
 */

export interface RebuildScenario { id: string; title: string; team: string; startYear: number; seasons: number; difficulty: 'Hard' | 'Very hard' | 'Brutal'; blurb: string }

export const SCENARIOS: RebuildScenario[] = [
  { id: 'bulls99', title: 'Life After Michael', team: 'CHI', startYear: 1998, seasons: 6, difficulty: 'Very hard', blurb: 'Jordan, Pippen and Phil are gone. Six rings on the wall, 13 wins on the way. Bring a seventh banner.' },
  { id: 'celtics97', title: 'Celtics in Ruins', team: 'BOS', startYear: 1996, seasons: 6, difficulty: 'Hard', blurb: 'The most decorated franchise in the league just went 15-67. Restore the pride.' },
  { id: 'clippers99', title: 'The Clipper Curse', team: 'LAC', startYear: 1998, seasons: 8, difficulty: 'Brutal', blurb: '9-41 in a lockout year, and nobody wants to play here. Win the first title in franchise history.' },
  { id: 'warriors01', title: 'Before the Dynasty', team: 'GSW', startYear: 2000, seasons: 8, difficulty: 'Brutal', blurb: '17-65, no plan and no stars. Build the Warriors a decade early.' },
  { id: 'wolves10', title: 'Wolves in the Wilderness', team: 'MIN', startYear: 2009, seasons: 7, difficulty: 'Brutal', blurb: 'Garnett is long gone and the lottery keeps coming. Make Minnesota a champion.' },
  { id: 'cavs11', title: 'The Decision, Undone', team: 'CLE', startYear: 2010, seasons: 5, difficulty: 'Very hard', blurb: 'LeBron took his talents to South Beach. From 61 wins to 19. Five years to win it without him.' },
  { id: 'bobcats13', title: 'After 7-59', team: 'CHA', startYear: 2012, seasons: 7, difficulty: 'Brutal', blurb: 'The worst winning percentage in NBA history, one season ago. Take Charlotte all the way.' },
  { id: 'sixers14', title: 'Trust the Process', team: 'PHI', startYear: 2013, seasons: 6, difficulty: 'Very hard', blurb: 'Tear it down, stack the picks, and see if the process ends with a parade.' },
  { id: 'knicks15', title: 'Garden of Despair', team: 'NYK', startYear: 2014, seasons: 6, difficulty: 'Very hard', blurb: '17-65 in the Mecca. Every free agent says no. Make them say yes.' },
  { id: 'lakers17', title: 'The Post-Kobe Lakers', team: 'LAL', startYear: 2016, seasons: 5, difficulty: 'Hard', blurb: 'Kobe said Mamba out. Five years to bring a ring back to Los Angeles.' },
  { id: 'kings17', title: 'The Longest Drought', team: 'SAC', startYear: 2016, seasons: 7, difficulty: 'Brutal', blurb: 'Ten straight years without the playoffs, and counting. Break it, then win it all.' },
  { id: 'pistons21', title: 'Motor City Reset', team: 'DET', startYear: 2020, seasons: 5, difficulty: 'Very hard', blurb: 'Twenty wins and a blank slate. Five seasons to bring back the Bad Boys.' },
];
export const scenarioById = (id: string) => SCENARIOS.find(s => s.id === id);

/** Stored on the league when a challenge starts; everything else is worked out from the league's history. */
export interface RebuildChallengeConfig { id: string; teamId: string; startSeason: string; seasons: number }
export interface ChallengeSeason { season: string; wins: number; losses: number; finish: PlayoffFinish }
export type ChallengeStatus = 'active' | 'won' | 'failed';
export interface ChallengeProgress {
  scenario: RebuildScenario; config: RebuildChallengeConfig; results: ChallengeSeason[]; status: ChallengeStatus;
  /** The season (1-based) he won it in. */
  titleIn: number | null; score: number; stars: 0 | 1 | 2 | 3; seasonNumber: number; official: boolean; fired: boolean;
}

const FINISH_POINTS: Partial<Record<PlayoffFinish, number>> = { 'Play-In': 5, 'First Round': 20, Playoffs: 20, 'Second Round': 40, 'Conference Finals': 70, Finals: 120, Champion: 200 };
const MADE_PLAYOFFS = new Set<PlayoffFinish>(['First Round', 'Playoffs', 'Second Round', 'Conference Finals', 'Finals', 'Champion']);

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
  const titleAt = results.findIndex(r => r.finish === 'Champion');
  const counted = titleAt >= 0 ? results.slice(0, titleAt + 1) : results;
  const fo = league.frontOffice;
  const fired = !!fo && fo.teamId !== config.teamId;
  const status: ChallengeStatus = titleAt >= 0 ? 'won' : counted.length >= config.seasons || fired ? 'failed' : 'active';
  const score = counted.reduce((n, r) => n + r.wins * 2 + (FINISH_POINTS[r.finish] ?? 0), 0) + (titleAt >= 0 ? 1000 + (config.seasons - (titleAt + 1)) * 250 : 0);
  const stars = titleAt >= 0 ? 3 : counted.some(r => r.finish === 'Finals') ? 2 : counted.some(r => MADE_PLAYOFFS.has(r.finish)) ? 1 : 0;
  return { scenario, config, results: counted, status, titleIn: titleAt >= 0 ? titleAt + 1 : null, score, stars, seasonNumber: Math.min(config.seasons, counted.length + (status === 'active' ? 1 : 0)), official: isOfficialLeague(league), fired };
}

// ---------------------------------------------------------------- the board (this browser)

export interface RebuildRecord { best: number; stars: number; titleIn: number | null; attempts: number; completedAt?: number }
const KEY = 'cv-rebuild-records';
export function loadRebuildRecords(): Record<string, RebuildRecord> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, RebuildRecord>; } catch { return {}; }
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
  return out;
}
