import type { CategoryId } from './categories';
import type { CareerYear } from './career';
import { MAX_PROGRESS, type Progress } from './create';

/*
 * Big moments in Career Mode: after a season, the biggest thing that happened (a title, an MVP, a 50-point night, a
 * Game 7 loss, the rookie wall, Father Time...) asks you to make a call. Every answer is worth something: Legacy
 * Score now (the "story" part of his legacy), or a summer of extra work in a skill. One moment a season at most.
 */

export interface MomentChoice { label: string; result: string; legacy?: number; train?: { cat: CategoryId; amount: number } }
export interface BigMoment { id: string; season: string; title: string; text: string; choices: MomentChoice[] }
export interface MomentPick { id: string; season: string; title: string; choice: string; result: string; legacy: number }

const has = (y: CareerYear, key: string) => y.awards.some(a => a.key === key);
const lostInPlayoffs = (y: CareerYear) => !!y.playoffs?.gamesPlayed && !has(y, 'champion');
const tr = (cat: CategoryId, amount = 0.08) => ({ cat, amount });

/** The biggest moment of the season just played, or null when nothing stood out (or he is on autopilot). */
export function seasonMoment(year: CareerYear, seasonsPlayed: number, picked: MomentPick[]): BigMoment | null {
  const seen = (id: string) => picked.some(p => p.id === id);
  const first = (id: string) => !seen(id);
  const m = (id: string, title: string, text: string, choices: MomentChoice[]): BigMoment => ({ id, season: year.season, title, text, choices });
  const ppg = year.stats.gamesPlayed ? year.stats.points / year.stats.gamesPlayed : 0;
  if (has(year, 'champion')) return m('title', 'Champions!', `Confetti, a parade, and a ring with your name on it (${year.teamName}). How do you spend the summer?`, [
    { label: 'Celebrate with the city', result: 'The whole city loves you. A legend moment.', legacy: 2 },
    { label: 'Back in the gym on Monday', result: 'No days off: your body gets even better.', legacy: 1, train: tr('body', 0.12) },
  ]);
  if (has(year, 'mvp')) return m('mvp', 'Most Valuable Player', 'The trophy is yours. The microphone is on. What do you say?', [
    { label: 'Thank your teammates', result: 'Humble and loved: the league respects you.', legacy: 1.5 },
    { label: '"I\'m the best player in the world"', result: 'Bold. Now you have to back it up. Your confidence soars.', legacy: 1, train: tr('iq', 0.12) },
  ]);
  if ((year.highs?.gameHighPoints ?? 0) >= 50) return m('fifty', `${year.highs!.gameHighPoints}-point night`, 'The arena chanted your name. The game ball is in your locker.', [
    { label: 'Send it to the Hall of Fame', result: 'The ball goes on display. History remembers.', legacy: 1.5 },
    { label: 'Give it to a kid in the front row', result: 'The clip goes viral. Everyone wants to play like you.', legacy: 1 , train: tr('finishing', 0.06) },
  ]);
  if (has(year, 'allStar') && first('allStar')) return m('allStar', 'First All-Star selection', 'All-Star Weekend is calling. Do you enter the Dunk Contest?', [
    { label: 'Enter the Dunk Contest', result: 'You win the crowd with a 360 windmill.', legacy: 1 },
    { label: 'Rest and work on your shot', result: 'A quiet weekend in the gym pays off.', train: tr('threePoint', 0.12) },
  ]);
  if (lostInPlayoffs(year) && ppg >= 18 && first(`playoffLoss-${year.season}`)) return m(`playoffLoss-${year.season}`, 'Playoff heartbreak', `The ${year.teamName} season ends in the playoffs. Reporters are waiting at your locker.`, [
    { label: 'Take the blame', result: 'Leaders own it. Teammates notice.', legacy: 1 },
    { label: 'Add a new move this summer', result: 'You come back with a deadly step-back.', train: tr('midRange', 0.12) },
  ]);
  if (seasonsPlayed === 1) return m('rookie', 'The rookie wall', 'Eighty-two games is a lot more than college. Your legs felt it. What now?', [
    { label: 'Hire a personal trainer', result: 'Stronger, fitter, ready for year two.', train: tr('body', 0.12) },
    { label: 'Study film with a veteran', result: 'You see the game slow down.', train: tr('iq', 0.12) },
  ]);
  if (year.age >= 33 && first('fatherTime')) return m('fatherTime', 'Father Time is undefeated', 'A step slower than last year. How do you age?', [
    { label: 'Mentor the young guys', result: 'A leader in the locker room: your legacy grows.', legacy: 1.5 },
    { label: 'Train like a rookie', result: 'You fight the clock and buy another good year.', train: tr('athleticism', 0.12) },
  ]);
  if (!year.playoffs?.gamesPlayed && ppg >= 22 && first(`missed-${year.season}`)) return m(`missed-${year.season}`, 'Watching the playoffs from home', `Big numbers, but the ${year.teamName} missed the playoffs. The rumors start.`, [
    { label: 'Stay loyal', result: 'Fans will never forget it.', legacy: 1 },
    { label: 'Get better so they have no excuse', result: 'You spend the summer on your defense.', train: tr('perimeterD', 0.12) },
  ]);
  return null;
}

/** Applies a choice: the story legacy goes on record; training moves his progress (up to the usual cap). */
export function applyMomentChoice(moment: BigMoment, index: number, progress: Progress): { pick: MomentPick; progress: Progress } {
  const c = moment.choices[index] ?? moment.choices[0];
  const next = { ...progress };
  if (c.train) next[c.train.cat] = Math.min(MAX_PROGRESS, (next[c.train.cat] ?? 0) + c.train.amount);
  return { pick: { id: moment.id, season: moment.season, title: moment.title, choice: c.label, result: c.result, legacy: c.legacy ?? 0 }, progress: next };
}

export const storyLegacy = (picks: MomentPick[] | undefined) => (picks ?? []).reduce((n, p) => n + (p.legacy ?? 0), 0);
