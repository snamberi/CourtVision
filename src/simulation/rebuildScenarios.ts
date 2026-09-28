import type { PlayoffFinish } from './league';

/*
 * The Rebuild Challenge scenarios and scoring, with no other dependencies: the game and the online leaderboard
 * (api/leaderboard.js, built from server/leaderboard.ts) score a challenge with the same code.
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
  { id: 'mavs94', title: 'Eleven and Seventy-One', team: 'DAL', startYear: 1993, seasons: 7, difficulty: 'Brutal', blurb: 'The worst team in basketball, two years running. Jim Jackson and Jamal Mashburn are a start. Finish it.' },
  { id: 'nuggets99', title: 'Mile-High Misery', team: 'DEN', startYear: 1998, seasons: 6, difficulty: 'Brutal', blurb: '11-71 and a 23-game losing streak. McDyess, Van Exel and a young Billups. Make Denver matter.' },
  { id: 'heat09', title: 'Wade Alone', team: 'MIA', startYear: 2008, seasons: 5, difficulty: 'Hard', blurb: 'Two years after the title, 15-67. Wade is healthy again and the second pick is in. Get him help, fast.' },
  { id: 'hawks06', title: 'Up From 13-69', team: 'ATL', startYear: 2005, seasons: 6, difficulty: 'Very hard', blurb: 'Joe Johnson just arrived, Josh Smith can fly, and the arena is empty. Fill it with a banner.' },
  { id: 'orlando05', title: 'Orlando After T-Mac', team: 'ORL', startYear: 2004, seasons: 6, difficulty: 'Very hard', blurb: '21-61, McGrady traded, and an 18-year-old Dwight Howard in the middle. Build around him.' },
  { id: 'nets11', title: 'Twelve and Seventy', team: 'NJN', startYear: 2010, seasons: 6, difficulty: 'Brutal', blurb: 'A 0-18 start, a 12-70 finish, and a move to Brooklyn coming. Arrive with a contender.' },
  { id: 'bucks15', title: 'The Greek Freak Project', team: 'MIL', startYear: 2014, seasons: 6, difficulty: 'Hard', blurb: '15-67 last year, but a skinny 19-year-old named Giannis is on the roster. Speed up history.' },
  { id: 'pistons21', title: 'Motor City Reset', team: 'DET', startYear: 2020, seasons: 5, difficulty: 'Very hard', blurb: 'Twenty wins and a blank slate. Five seasons to bring back the Bad Boys.' },
];
export const scenarioById = (id: string) => SCENARIOS.find(s => s.id === id);

export const FINISH_POINTS: Partial<Record<PlayoffFinish, number>> = { 'Play-In': 5, 'First Round': 20, Playoffs: 20, 'Second Round': 40, 'Conference Finals': 70, Finals: 120, Champion: 200 };
export const MADE_PLAYOFFS = new Set<PlayoffFinish>(['First Round', 'Playoffs', 'Second Round', 'Conference Finals', 'Finals', 'Champion']);

export interface ScoredSeason { wins: number; losses: number; finish: PlayoffFinish }
/** Scores a challenge's seasons: seasons after a title don't count; a title scores 1,000 plus 250 per season to spare. */
export function scoreResults<T extends ScoredSeason>(results: T[], seasons: number): { counted: T[]; titleAt: number; score: number; stars: 0 | 1 | 2 | 3 } {
  const titleAt = results.findIndex(r => r.finish === 'Champion');
  const counted = titleAt >= 0 ? results.slice(0, titleAt + 1) : results;
  const score = counted.reduce((n, r) => n + r.wins * 2 + (FINISH_POINTS[r.finish] ?? 0), 0) + (titleAt >= 0 ? 1000 + (seasons - (titleAt + 1)) * 250 : 0);
  const stars = titleAt >= 0 ? 3 : counted.some(r => r.finish === 'Finals') ? 2 : counted.some(r => MADE_PLAYOFFS.has(r.finish)) ? 1 : 0;
  return { counted, titleAt, score, stars };
}
