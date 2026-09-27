import type { Rarity } from './cards';

/*
 * League Hunt coaches: one per squad, drawn on the coach spin. A coach lifts (or sinks) every player by -2 to +5 and
 * brings a style to every game. Coaching players from a franchise he won with adds a point of chemistry for them.
 * The ratings are the game's, not a verdict on anyone's career; the ones below zero are made up.
 */

export type CoachStyle = 'triangle' | 'defense' | 'pace' | 'threes' | 'balanced';
export interface HuntCoach { id: string; name: string; bonus: number; style: CoachStyle; franchises: string[]; blurb: string }

export const COACH_STYLE: Record<CoachStyle, string> = {
  triangle: 'Ball movement: his team shares the ball',
  defense: 'Defense first: +4 to defensive ratings',
  pace: 'Run and gun: fast pace, early threes',
  threes: 'Five-out: lets it fly from three (where there is a line)',
  balanced: 'Steady: no quirks',
};

const c = (id: string, name: string, bonus: number, style: CoachStyle, franchises: string[], blurb: string): HuntCoach => ({ id, name, bonus, style, franchises, blurb });

export const COACHES: HuntCoach[] = [
  c('jackson', 'Phil Jackson', 5, 'triangle', ['CHI', 'LAL'], 'Eleven rings and the triangle.'),
  c('auerbach', 'Red Auerbach', 5, 'pace', ['BOS'], 'Nine titles and a victory cigar.'),
  c('popovich', 'Gregg Popovich', 5, 'defense', ['SAS'], 'Five titles, two decades of winning.'),
  c('riley', 'Pat Riley', 4, 'defense', ['LAL', 'NYK', 'MIA'], 'Showtime, then elbows in New York.'),
  c('kerr', 'Steve Kerr', 4, 'threes', ['GSW'], 'Motion, splash and four titles.'),
  c('daly', 'Chuck Daly', 4, 'defense', ['DET'], 'The Bad Boys and the Dream Team.'),
  c('spoelstra', 'Erik Spoelstra', 4, 'balanced', ['MIA'], 'Any roster, any system.'),
  c('holzman', 'Red Holzman', 3, 'triangle', ['NYK'], 'Hit the open man.'),
  c('sloan', 'Jerry Sloan', 3, 'balanced', ['UTA', 'CHI'], 'Pick-and-roll, every night, for 23 years.'),
  c('lbrown', 'Larry Brown', 3, 'defense', ['DET', 'PHI', 'IND', 'DEN', 'SAS'], 'Play the right way.'),
  c('kcjones', 'K.C. Jones', 3, 'balanced', ['BOS'], 'Let the 80s Celtics be the 80s Celtics.'),
  c('rudyt', 'Rudy Tomjanovich', 3, 'threes', ['HOU'], 'Never underestimate the heart of a champion.'),
  c('heinsohn', 'Tom Heinsohn', 3, 'pace', ['BOS'], 'Run, press, run.'),
  c('rivers', 'Doc Rivers', 3, 'defense', ['BOS', 'LAC', 'ORL', 'PHI'], 'Ubuntu.'),
  c('carlisle', 'Rick Carlisle', 2, 'balanced', ['DAL', 'IND', 'DET'], 'Beat the Heatles in 2011.'),
  c('wilkens', 'Lenny Wilkens', 2, 'balanced', ['SEA', 'ATL', 'CLE'], 'More wins than almost anyone.'),
  c('nelson', 'Don Nelson', 2, 'pace', ['MIL', 'GSW', 'DAL'], 'Nellie Ball: small, fast, weird.'),
  c('dantoni', "Mike D'Antoni", 2, 'pace', ['PHO', 'HOU'], 'Seven seconds or less.'),
  c('nurse', 'Nick Nurse', 2, 'defense', ['TOR'], 'Box-and-one in the Finals.'),
  c('budenholzer', 'Mike Budenholzer', 2, 'threes', ['MIL', 'ATL'], 'Spread it out around a giant.'),
  c('thibodeau', 'Tom Thibodeau', 2, 'defense', ['CHI', 'NYK', 'MIN'], 'Load up the strong side.'),
  c('karl', 'George Karl', 2, 'pace', ['SEA', 'DEN', 'MIL'], 'Push it, press it.'),
  c('fitch', 'Bill Fitch', 2, 'balanced', ['BOS', 'HOU', 'CLE'], 'Turned the Celtics around in one year.'),
  c('lue', 'Tyronn Lue', 2, 'balanced', ['CLE', 'LAC'], 'Came back from 3-1.'),
  c('hannum', 'Alex Hannum', 2, 'defense', ['PHI', 'STL', 'SFW'], 'The coach who beat Russell.'),
  c('cunningham', 'Billy Cunningham', 2, 'pace', ['PHI'], 'Fo, fi, fo.'),
  c('malone', 'Michael Malone', 2, 'balanced', ['DEN'], 'Built around a passing center.'),
  c('hbrown', 'Hubie Brown', 1, 'balanced', ['ATL', 'NYK', 'MEM'], 'Explains the game better than anyone.'),
  c('jvg', 'Jeff Van Gundy', 1, 'defense', ['NYK', 'HOU'], 'Grind it out.'),
  c('svg', 'Stan Van Gundy', 1, 'threes', ['ORL', 'MIA', 'DET'], 'One big and four shooters.'),
  c('collins', 'Doug Collins', 1, 'balanced', ['CHI', 'DET', 'WAS', 'PHI'], 'Young teams, fast turnarounds.'),
  c('motta', 'Dick Motta', 1, 'balanced', ['WSB', 'CHI', 'DAL'], 'The opera ain\'t over till the fat lady sings.'),
  c('ramsay', 'Jack Ramsay', 1, 'pace', ['POR', 'PHI', 'IND'], 'Blazermania.'),
  c('fitzsimmons', 'Cotton Fitzsimmons', 1, 'balanced', ['PHO', 'KCK', 'ATL'], 'Always got the most out of a roster.'),
  c('westhead', 'Paul Westhead', 1, 'pace', ['LAL', 'DEN'], 'Fastest offense ever run.'),
  c('vogel', 'Frank Vogel', 1, 'defense', ['IND', 'LAL', 'ORL'], 'Size and defense.'),
  c('mazzulla', 'Joe Mazzulla', 1, 'threes', ['BOS'], 'Math: threes are worth more.'),
  c('playercoach', 'Player-Coach Gary', 0, 'balanced', [], 'Plays 10 minutes, coaches the other 38.'),
  c('legend', 'The Local High School Legend', 0, 'pace', [], 'Won state in 1987 and never stopped talking about it.'),
  c('interim', 'The Interim Coach', -1, 'balanced', [], 'Nobody told him how long "interim" is.'),
  c('promoted', 'The Assistant Promoted Tuesday', -1, 'balanced', [], 'Still learning where the timeout button is.'),
  c('nephew', "The Owner's Nephew", -2, 'threes', [], 'Read a blog post about analytics.'),
];

export const COACH_BY_ID = new Map(COACHES.map(x => [x.id, x]));

/** A coach's rarity by his bonus (for the spin odds and the card frame). */
export const coachRarity = (x: HuntCoach): Rarity => (x.bonus >= 5 ? 'legendary' : x.bonus >= 4 ? 'epic' : x.bonus >= 2 ? 'rare' : 'common');
