import type { PlayerSeason } from '../simulation/types';
import { DEFAULT_GAME_SETTINGS } from '../simulation/types';
import { RNG } from '../simulation/engine/rng';
import { simulateGame } from '../simulation/engine/game';
import { calculateOverall } from '../simulation/engine/overall';
import { defaultCoachTendencies } from '../simulation/league';
import { DEFAULT_LEAGUE_RULES } from '../simulation/leagueRules';
import { generatePlayer } from '../simulation/leagueGenerator';
import { CATEGORY_BY_ID, type CategoryId } from '../career/categories';

/*
 * Story Mode: Street to the League. One player's road from a park in his hometown to his rookie season in the NBA,
 * told in five chapters. Scenes ask you to choose (who you trust, how you train, what you say); key games are played
 * by the main game engine with you on the floor, and how you play changes the story. Three people walk the road with
 * you: your best friend Dre, Coach Ray from the rec center, and your rival Marcus "Ice" Vance. The ending depends on
 * your games, your hype, your grit and the people you kept close.
 *
 * Everything is seeded: the same seed and the same choices tell the same story.
 */

export type StoryStyle = 'scorer' | 'playmaker' | 'wing' | 'big';
export const STYLES: Record<StoryStyle, { name: string; pos: string; archetype: string; blurb: string }> = {
  scorer: { name: 'Bucket getter', pos: 'SG', archetype: 'threeLevelScorer', blurb: 'Three levels, no conscience. You were born to score.' },
  playmaker: { name: 'Floor general', pos: 'PG', archetype: 'floorGeneral', blurb: 'You see the play before it happens. Everybody eats.' },
  wing: { name: 'Two-way wing', pos: 'SF', archetype: 'threeAndD', blurb: 'Lock up their best, knock down the open three.' },
  big: { name: 'Paint beast', pos: 'C', archetype: 'rimProtector', blurb: 'Rebounds, blocks, dunks. Nothing easy at the rim.' },
};
export const HOMETOWNS = ['Baltimore', 'Oakland', 'the Bronx', 'Chicago\'s South Side', 'Houston', 'Atlanta', 'Detroit', 'Compton', 'Philadelphia', 'New Orleans'];

export type Path = 'blueblood' | 'midmajor' | 'overseas';
export const PATHS: Record<Path, { name: string; team: string; blurb: string; minutes: number; hype: number }> = {
  blueblood: { name: 'State University', team: 'State', blurb: 'The blue blood. National TV every week, five other McDonald\'s All-Americans fighting for your minutes.', minutes: 24, hype: 2 },
  midmajor: { name: 'Coastal Tech', team: 'Coastal', blurb: 'A mid-major that will hand you the keys from day one. Fewer cameras, all the shots.', minutes: 34, hype: 1 },
  overseas: { name: 'Partizan Belgrade', team: 'Belgrade', blurb: 'Skip college and turn pro in Europe. Grown men, tough coaching, real money.', minutes: 26, hype: 1 },
};

export type Person = 'dre' | 'ray' | 'ice';
export interface Effects { hype?: number; grit?: number; bond?: Partial<Record<Person, number>>; train?: Partial<Record<CategoryId, number>>; flag?: string }
export interface Choice { id: string; label: string; result: string; effects: Effects }

export type GameLevel = 'street' | 'hs' | 'hsRival' | 'state' | 'college' | 'collegeFinal' | 'nba' | 'nbaRival' | 'nbaPlayoff';
/** Team calibers by level: [your teammates, the opponent]. Your own rating grows with training and age. */
const LEVEL: Record<GameLevel, [number, number]> = {
  street: [41, 42], hs: [46, 46], hsRival: [47, 49], state: [49, 51], college: [55, 56], collegeFinal: [57, 59], nba: [66, 67], nbaRival: [67, 68], nbaPlayoff: [69, 70],
};

export interface StoryGame { beat: string; title: string; opp: string; us: number; them: number; won: boolean; line: { pts: number; reb: number; ast: number; stl: number; blk: number; fgm: number; fga: number; min: number }; grade: string }

export interface StoryState {
  v: 1;
  seed: number;
  name: string;
  style: StoryStyle;
  hometown: string;
  hero: PlayerSeason;
  hype: number;
  grit: number;
  bonds: Record<Person, number>;
  flags: string[];
  path?: Path;
  /** The beat you're on (index into the script). */
  at: number;
  /** Text of the choice you just made, shown above the next beat. */
  last?: string;
  games: StoryGame[];
  /** Draft night, once it has happened. */
  draft?: { pick: number | null; team: string; icePick: number | null; iceTeam: string };
  /** Training points waiting to be spent. */
  points: number;
  done: boolean;
}

export type Beat =
  | { kind: 'chapter'; id: string; act: number; title: string; text: (s: StoryState) => string; age: number }
  | { kind: 'scene'; id: string; title: string; text: (s: StoryState) => string; choices: (s: StoryState) => Choice[]; when?: (s: StoryState) => boolean }
  | { kind: 'train'; id: string; title: string; text: (s: StoryState) => string; points: number }
  | { kind: 'path'; id: string; title: string; text: (s: StoryState) => string }
  | { kind: 'game'; id: string; title: string; level: GameLevel; opp: (s: StoryState) => string; stakes: (s: StoryState) => string; minutes: (s: StoryState) => number; key?: boolean; win: (s: StoryState, g: StoryGame) => string; loss: (s: StoryState, g: StoryGame) => string; reward?: { win?: Effects; loss?: Effects } }
  | { kind: 'draft'; id: string; title: string }
  | { kind: 'ending'; id: string };

const first = (s: StoryState) => s.name.split(' ')[0];
const stars = (s: StoryState) => Math.max(1, Math.min(5, Math.round((overall(s) - 38) / 4 + s.hype / 3)));
export const overall = (s: StoryState) => calculateOverall(s.hero);
const keyWins = (s: StoryState) => s.games.filter(g => g.won).length;
const bestLine = (s: StoryState) => [...s.games].sort((a, b) => gameScore(b.line) - gameScore(a.line))[0];

export const SCRIPT: Beat[] = [
  // ---------------------------------------------------------------- Act 1: The Blacktop
  { kind: 'chapter', id: 'c1', act: 1, age: 16, title: 'The Blacktop', text: s => `Summer in ${s.hometown}. The courts at Carver Park have no nets, one working light and the best run in the city. You're sixteen, you're ${STYLES[s.style].name.toLowerCase()}, and nobody outside these fences knows your name.` },
  { kind: 'scene', id: 'park', title: 'Next', text: s => `Saturday, 10 AM. Dre bounces a ball between his legs while you lace up. "That's Ice," he says, nodding at the tall kid holding court. Marcus "Ice" Vance, the city's #1 sophomore, already has offers. He looks over at you. "You got next, ${first(s)}? Don't waste my time." Coach Ray watches from the rec-center steps.`,
    choices: () => [
      { id: 'call', label: '"We got next. Run it."', result: 'Ice laughs. The whole park turns to watch. No pressure.', effects: { hype: 1, grit: 1, bond: { ice: -1 } } },
      { id: 'watch', label: 'Sit one out. Learn his game first.', result: 'You watch every possession. Ice goes left every time he needs a bucket.', effects: { train: { iq: 2 }, bond: { ray: 1 } } },
      { id: 'ray', label: 'Ask Coach Ray to work you out.', result: 'Ray runs you through 300 makes before lunch. "Talent is cheap," he says. "Work isn\'t."', effects: { train: { finishing: 1, midRange: 1 }, bond: { ray: 2 } } },
    ] },
  { kind: 'game', id: 'g-park', title: 'The Run at Carver Park', level: 'street', minutes: () => 32, opp: () => "Ice's crew", stakes: s => `First to win gets respect, and the court. Lose and you're waiting an hour. ${s.bonds.ray > 0 ? 'Ray is watching.' : 'Dre is talking enough trash for both of you.'}`,
    win: (_, g) => `${g.us}-${g.them}. The park goes quiet, then loud. Ice shakes your hand without looking at you. "Lucky." Dre posts the clip; it gets 40,000 views by Monday.`,
    loss: (_, g) => `${g.them}-${g.us}. Ice hits the game-winner and stares you down the whole way back. "Come back when you're ready." You go home and shoot until the streetlights go off.`,
    reward: { win: { hype: 2 }, loss: { grit: 2 } } },
  { kind: 'scene', id: 'party', title: 'Friday Night', text: s => `Dre's cousin is throwing the party of the summer. Coach Ray texts: "Gym's open at 7. Bring your shoes." ${s.games.at(-1)?.won ? 'Half the city wants to meet the kid who beat Ice.' : 'Nobody at that party has heard of you yet.'}`,
    choices: () => [
      { id: 'party', label: 'Go to the party with Dre.', result: 'You dance badly, laugh a lot, and Dre says it\'s the best night of his summer. Your legs feel it in the morning.', effects: { hype: 1, bond: { dre: 2 } } },
      { id: 'gym', label: 'Gym with Coach Ray.', result: 'Ray tapes your ankles, turns off his phone and makes you dribble with your left until it stops being your weak hand.', effects: { train: { playmaking: 2 }, bond: { ray: 1, dre: -1 }, grit: 1 } },
      { id: 'film', label: 'Stay home and watch film.', result: 'Old playoff games until 2 AM. You start seeing the game in slow motion.', effects: { train: { iq: 2 } } },
    ] },
  { kind: 'train', id: 't1', title: 'Summer Workouts', points: 3, text: () => 'Three months until school. Pick where the work goes. Every point is a sweaty morning at Carver Park.' },

  // ---------------------------------------------------------------- Act 2: Varsity
  { kind: 'chapter', id: 'c2', act: 2, age: 17, title: 'Varsity', text: s => `Douglass High. Coach Hart has won three state titles and doesn't play juniors. Ice transferred to Westside, across town. Dre made the team as the twelfth man; you're fighting for a starting spot.` + (s.bonds.ray >= 3 ? ' Ray called Hart and told him to watch you.' : '') },
  { kind: 'scene', id: 'tryout', title: 'Tryouts', text: () => 'Day three of tryouts. Hart puts you against Tre Wallace, the senior all-state guard, in a shell drill. Everyone stops to watch.',
    choices: () => [
      { id: 'lock', label: 'Pick him up full court. Every possession.', result: 'Tre doesn\'t score once. Hart writes something on his clipboard without looking up.', effects: { train: { perimeterD: 2 }, grit: 1 } },
      { id: 'show', label: 'Cross him over and let everyone hear about it.', result: 'The gym explodes. Tre does not find it funny. Neither does Hart.', effects: { hype: 2, grit: -1 } },
      { id: 'dirty', label: 'Do the dirty work: boards, charges, loose balls.', result: '"That," Hart says to the whole gym, "is how you make my team."', effects: { train: { interiorD: 1, body: 1 }, grit: 2 } },
    ] },
  { kind: 'game', id: 'g-opener', title: 'Season Opener', level: 'hs', minutes: s => (s.grit >= 2 ? 28 : 22), opp: () => 'Lincoln Prep', stakes: s => `${s.grit >= 2 ? 'You\'re starting.' : 'You\'re the sixth man.'} Lincoln Prep has three D-I commits. The local paper sent a photographer.`,
    win: (_, g) => `Douglass wins ${g.us}-${g.them}. Hart pulls you aside: "Again. Every night."`,
    loss: (_, g) => `${g.them}-${g.us} Lincoln. Hart doesn't yell. That's worse. "We'll see what you're made of."`,
    reward: { win: { hype: 1 }, loss: { grit: 1 } } },
  { kind: 'scene', id: 'dre-grades', title: 'Dre', text: () => 'Dre shows you his progress report: two F\'s. One more and he\'s ineligible. "It\'s cool," he says. It is not cool. Your own workouts run every night this week.',
    choices: () => [
      { id: 'help', label: 'Skip your workouts. Tutor him every night.', result: 'Dre passes his chemistry test with a C+. He frames it. "Brothers," he says.', effects: { bond: { dre: 3 } } },
      { id: 'tutor', label: 'Pay for a tutor with your summer job money.', result: 'It costs you everything you saved, but Dre stays eligible and you don\'t miss a rep.', effects: { bond: { dre: 2 }, train: { iq: 1 } } },
      { id: 'self', label: 'Stay focused. He\'ll figure it out.', result: 'You hit 500 shots a night. Dre stops sitting next to you on the bus.', effects: { train: { threePoint: 2 }, bond: { dre: -2 } } },
    ] },
  { kind: 'game', id: 'g-westside', title: 'Westside: Ice Comes Home', level: 'hsRival', minutes: () => 30, opp: () => "Westside (Ice Vance)", stakes: s => `The biggest regular-season game in the city. Ice is averaging 27. ${s.bonds.ice <= -1 ? 'He circled this date the day you beat him at the park.' : 'He sends you a text: "Good luck. You\'ll need it."'}`,
    win: (_, g) => `${g.us}-${g.them}. You outplayed the #1 recruit in the state on his home floor. ${g.line.pts >= 20 ? `${g.line.pts} points. Recruiting sites update your ranking that night.` : 'Nobody saw your box score coming.'}`,
    loss: (_, g) => `Westside ${g.them}-${g.us}. Ice drops 30 and waves at your bench. It will stay with you for a long time.`,
    reward: { win: { hype: 2, bond: { ice: -1 } }, loss: { grit: 2 } } },
  { kind: 'scene', id: 'stars', title: 'The Rankings', text: s => `The recruiting services have you as a ${stars(s)}-star recruit. Letters arrive every day. ${stars(s) >= 4 ? 'State University\'s head coach is coming to your house.' : 'Mid-majors are calling. The big schools are watching.'} A man in a nice suit introduces himself after a game: "I can make you famous, kid."`,
    choices: () => [
      { id: 'agent', label: 'Take his card. Get your name out there.', result: 'Highlight mixtapes, a sneaker deal for your summer team, 100,000 new followers. Ray shakes his head.', effects: { hype: 3, bond: { ray: -2 } } },
      { id: 'ray', label: 'Let Coach Ray handle it.', result: 'Ray turns the man away at the door. "Your game will get you famous. Not him."', effects: { bond: { ray: 2 }, grit: 1 } },
      { id: 'quiet', label: 'No distractions. Win state first.', result: 'You turn your phone off for a month. Hart notices.', effects: { grit: 1, train: { iq: 1 } } },
    ] },
  { kind: 'game', id: 'g-state', title: 'State Championship', level: 'state', key: true, minutes: () => 32, opp: () => 'Westside (Ice Vance)', stakes: () => 'Of course it\'s Westside. Of course it\'s Ice. 12,000 people at the arena, every college coach in the state in the first three rows.',
    win: (_, g) => `STATE CHAMPIONS, ${g.us}-${g.them}. Hart cries. Dre is on your shoulders even though you\'re the one who should be on his. Ice walks off without the handshake.`,
    loss: (_, g) => `Westside wins it, ${g.them}-${g.us}. Ice cuts down the nets. You watch every second of it, on purpose.`,
    reward: { win: { hype: 2, flag: 'stateChamp' }, loss: { grit: 2 } } },
  { kind: 'train', id: 't2', title: 'Senior Summer', points: 3, text: () => 'One last summer before the big decision. Elite camps, AAU, and the empty gym at Douglass at 6 AM.' },

  // ---------------------------------------------------------------- Act 3: The Choice
  { kind: 'chapter', id: 'c3', act: 3, age: 19, title: 'The Choice', text: s => `Signing day. Three hats on the table at the Douglass gym. Your mom in the front row, Dre with his phone up, Ray in the back. ${s.flags.includes('stateChamp') ? 'You\'re a state champion.' : 'Ice has the ring. You have something to prove.'}` },
  { kind: 'path', id: 'path', title: 'Signing Day', text: () => 'Where do you play next year?' },
  { kind: 'scene', id: 'campus', title: 'Year One', when: s => s.path !== 'overseas', text: s => `${PATHS[s.path ?? 'midmajor'].name}. ${s.path === 'blueblood' ? 'Practices are harder than any game you\'ve played. There are four future pros on your team.' : 'You\'re the best player in the building. The coach runs every play through you, and every opponent knows it.'} Midseason, you hit a wall.`,
    choices: () => [
      { id: 'grind', label: 'Live in the gym. Extra sessions at 5 AM.', result: 'Your body hates you for a month, then thanks you.', effects: { train: { athleticism: 2, body: 1 }, grit: 1 } },
      { id: 'mentor', label: 'Call Coach Ray.', result: 'Ray drives five hours to watch one practice. "You\'re thinking too much. Play."', effects: { bond: { ray: 2 }, train: { iq: 1 } } },
      { id: 'social', label: 'Lean into the spotlight. Interviews, NIL deals.', result: 'Your face is on a billboard. Your coach is less impressed.', effects: { hype: 3, grit: -1 } },
    ] },
  { kind: 'scene', id: 'belgrade', title: 'Belgrade', when: s => s.path === 'overseas', text: () => 'The coach in Belgrade screams in two languages. The veterans take your shots and your lunch. In November you\'re fourth on the depth chart and very far from home.',
    choices: () => [
      { id: 'earn', label: 'Earn it in practice. Every day.', result: 'By January the veterans stop taking your lunch. By February they pass you the ball.', effects: { grit: 2, train: { perimeterD: 1, iq: 1 } } },
      { id: 'home', label: 'Call home every night.', result: 'Dre keeps you sane with bad jokes and worse highlights of himself in the rec league.', effects: { bond: { dre: 2 } } },
      { id: 'learn', label: 'Learn the language and the game they play.', result: 'Pick-and-roll reads, the extra pass, the backdoor cut. European basketball rewires your brain.', effects: { train: { playmaking: 2, iq: 1 } } },
    ] },
  { kind: 'train', id: 't3', title: 'The Grind', points: 2, text: () => 'Between the games and the classes (or the flights), find the time.' },
  { kind: 'game', id: 'g-college', title: 'The Big Stage', level: 'college', minutes: s => PATHS[s.path ?? 'midmajor'].minutes, opp: s => (s.path === 'overseas' ? 'Real Madrid' : s.path === 'blueblood' ? 'Duke' : 'Gonzaga'), stakes: s => (s.path === 'overseas' ? 'EuroLeague on a Thursday night in Madrid. NBA scouts flew in for this.' : 'National TV. A top-10 opponent. Every NBA team has a scout in the building.'),
    win: (_, g) => `${g.us}-${g.them}. Mock drafts update overnight; your name moves up.`,
    loss: (_, g) => `${g.them}-${g.us}. A tough night with the whole world watching. The scouts write something down either way.`,
    reward: { win: { hype: 2 }, loss: { grit: 1 } } },
  { kind: 'game', id: 'g-final', title: 'The Tournament', level: 'collegeFinal', key: true, minutes: s => PATHS[s.path ?? 'midmajor'].minutes + 2, opp: s => (s.path === 'overseas' ? 'Olympiacos (EuroLeague Final Four)' : 'Kentucky (Elite Eight)'), stakes: s => (s.path === 'overseas' ? 'The Final Four. Win and you\'re a lottery pick. Lose and you\'re a question mark.' : 'Win and it\'s the Final Four. Ice\'s team went out in the first round.'),
    win: (s, g) => `${g.us}-${g.them}! ${g.line.pts >= 20 ? `${g.line.pts} points on the biggest stage.` : 'You do a bit of everything when it matters most.'} ${s.bonds.dre >= 3 ? 'Dre flew in on a credit card he can\'t afford. Worth it.' : ''}`,
    loss: (_, g) => `${g.them}-${g.us}. Your season ends in a locker room that smells like tape and tears. You declare for the draft anyway.`,
    reward: { win: { hype: 3, flag: 'finalFour' }, loss: { grit: 2 } } },

  // ---------------------------------------------------------------- Act 4: Draft Night
  { kind: 'chapter', id: 'c4', act: 4, age: 20, title: 'Draft Night', text: s => `The combine in Chicago, then interviews with every team that might pick you, then a green room in Brooklyn. Ice is in the same green room. ${s.bonds.ice <= -2 ? 'You don\'t say a word to each other.' : 'He nods at you. It almost looks like respect.'}` },
  { kind: 'scene', id: 'interview', title: 'The Interview', text: () => 'A team with a top-five pick asks the question every team asks: "Why should we take you over Marcus Vance?"',
    choices: () => [
      { id: 'cocky', label: '"Because I already beat him. Twice."', result: 'Two executives smile. The coach doesn\'t. It\'s on TV by morning.', effects: { hype: 2, bond: { ice: -2 } } },
      { id: 'honest', label: '"Because I\'ll outwork everyone in your building."', result: 'The GM puts his pen down. "We\'ve heard that before. We believe it this time."', effects: { grit: 1, flag: 'goodInterview' } },
      { id: 'team', label: '"Take us both. He\'s good. I\'m better."', result: 'They laugh. Then they write it down.', effects: { hype: 1, bond: { ice: 1 } } },
    ] },
  { kind: 'draft', id: 'draft', title: 'The Green Room' },

  // ---------------------------------------------------------------- Act 5: Rookie
  { kind: 'chapter', id: 'c5', act: 5, age: 21, title: 'Rookie', text: s => `${s.draft?.team ?? 'Your new team'}. Your name on the back of a jersey in a real NBA locker room. The veterans make you carry the donuts. Ice is in the same conference.` },
  { kind: 'scene', id: 'vet', title: 'The Veteran', text: () => 'Darius Cole, a 13-year veteran with two rings, watches you get torched in practice. Afterward he sits next to you. "You want the short version or the long version?"',
    choices: () => [
      { id: 'long', label: '"The long version."', result: 'Two hours on footwork, film and how to sleep on a plane. You take notes on your phone.', effects: { train: { iq: 2 }, grit: 1 } },
      { id: 'short', label: '"I got it, OG. I\'m good."', result: '"Okay," he says, and never offers again.', effects: { hype: 1 } },
      { id: 'body', label: '"Teach me how you lasted 13 years."', result: 'His trainer, his diet, his ice baths. Your body feels five years older and five years better.', effects: { train: { body: 2, athleticism: 1 } } },
    ] },
  { kind: 'game', id: 'g-debut', title: 'NBA Debut', level: 'nba', minutes: s => minutesForRookie(s, 16), opp: () => 'the Boston Celtics', stakes: s => `Opening night. ${s.draft?.pick && s.draft.pick <= 5 ? 'The arena chants your name when you check in.' : 'You check in late in the first quarter. Your mom is crying in section 112.'}`,
    win: (_, g) => `A win in your first NBA game. ${g.line.pts} points; you keep the ball from your first bucket.`,
    loss: (_, g) => `A loss, ${g.them}-${g.us}. ${g.line.pts ? `Your first NBA points come on a ${g.line.pts >= 10 ? 'night you\'ll remember' : 'quiet night'}.` : 'You don\'t score. Welcome to the league.'}`,
    reward: { win: { hype: 1 }, loss: { grit: 1 } } },
  { kind: 'scene', id: 'dre-call', title: 'A Call From Home', text: s => `Dre calls at 2 AM. ${s.bonds.dre >= 3 ? '"I need a favor, brother. I lost my job."' : '"Hey. I know we haven\'t talked. I lost my job."'} He sounds like he hasn\'t slept.`,
    choices: s => [
      { id: 'hire', label: 'Hire him to run your camps back home.', result: 'Dre runs the best youth camp in the city. Two hundred kids from Carver Park learn your name and his.', effects: { bond: { dre: 3 }, hype: 1 } },
      { id: 'money', label: 'Send money. Lots of it.', result: 'It helps. It isn\'t the same as being there.', effects: { bond: { dre: 1 } } },
      ...(s.bonds.dre < 1 ? [{ id: 'ignore', label: 'Let it go to voicemail.', result: 'You tell yourself you\'re focused. Ray hears about it.', effects: { bond: { dre: -2, ray: -1 }, train: { threePoint: 1 } } }] : []),
    ] },
  { kind: 'train', id: 't4', title: 'Midseason', points: 2, text: () => 'The schedule is brutal. The best rookies get better in January. Find the work.' },
  { kind: 'game', id: 'g-ice', title: 'Ice', level: 'nbaRival', key: true, minutes: s => minutesForRookie(s, 22), opp: s => `${s.draft?.iceTeam ?? 'Ice\'s team'} (Ice Vance)`, stakes: s => `The first time you and Ice share an NBA floor. TNT is calling it the rookie game of the year. ${s.bonds.ice >= 1 ? 'He texts you before tip-off: "Let\'s give them a show."' : 'He hasn\'t said a word to you since the green room.'}`,
    win: (s, g) => `${g.us}-${g.them}. ${g.line.pts >= 15 ? `${g.line.pts} for you. ` : ''}Ice finds you after the buzzer. ${s.bonds.ice >= 0 ? '"Carver Park," he says, and laughs. "You were always annoying."' : 'He walks past you, then stops, and taps your chest twice. Respect.'}`,
    loss: (_, g) => `${g.them}-${g.us}. Ice wins round one in the NBA. "There's 15 more years of this," he says. "Get comfortable."`,
    reward: { win: { hype: 2, bond: { ice: 1 }, flag: 'beatIce' }, loss: { grit: 2 } } },
  { kind: 'game', id: 'g-playoff', title: 'Game 7', level: 'nbaPlayoff', key: true, minutes: s => minutesForRookie(s, 24), opp: () => 'the Denver Nuggets', stakes: s => `Somehow, you're here. First round, Game 7, on the road. ${s.flags.includes('stateChamp') ? 'You\'ve won a title game before.' : 'You\'ve never won the big one. Tonight would be a good night to start.'}`,
    win: (_, g) => `GAME 7, ${g.us}-${g.them}. The road crowd goes silent. Your teammates mob you at center court. You\'re a rookie who won a Game 7.`,
    loss: (_, g) => `Your season ends ${g.them}-${g.us}, one game short. On the plane home Darius Cole says: "Now you know what it feels like. Remember it."`,
    reward: { win: { hype: 3, flag: 'game7' }, loss: { grit: 1 } } },
  { kind: 'ending', id: 'end' },

  // ---------------------------------------------------------------- Chapter 6 (bonus, after any ending): Year Two
  { kind: 'chapter', id: 'c6', act: 6, age: 22, title: 'Year Two', text: s => `Summer again. ${s.hype >= 8 ? 'Your face is on a billboard on the highway home.' : 'Nobody stops you at the airport yet.'} Year two is when the league stops being surprised by you and starts scouting you. Ice put up 30 in the last game of his rookie year. He made sure you saw it.` },
  { kind: 'scene', id: 'y2-deal', title: 'The Offer', text: () => 'Your agent slides two papers across the table. A sneaker company wants you as the face of a new line. A smaller deal would let you spend the summer in the gym instead of on a press tour.',
    choices: () => [
      { id: 'shoe', label: 'Sign the shoe deal.', result: 'Your logo, your colorway, your name on a box. You spend June on planes, not on the court.', effects: { hype: 3, grit: -1 } },
      { id: 'gym', label: 'Take the small deal. Gym all summer.', result: 'Six a.m. every day at Carver Park. The kids start showing up at 5:45 to watch.', effects: { grit: 2, train: { athleticism: 1, body: 1 } } },
      { id: 'dre', label: 'Make Dre your business manager first.', result: 'Dre negotiates like he plays defense: annoying and effective. The deal gets better.', effects: { bond: { dre: 2 }, hype: 1 } },
    ] },
  { kind: 'train', id: 't6', title: 'The Second Summer', points: 3, text: () => 'Every scout in the league has a file on you now. Add something they haven\'t seen.' },
  { kind: 'game', id: 'y2-open', title: 'Year Two Opener', level: 'nba', minutes: s => minutesForRookie(s, 24), opp: () => 'the Milwaukee Bucks', stakes: s => `Opening night, year two. ${s.flags.includes('game7') ? 'The banner from last spring hangs over the floor.' : 'Last season ended early. This one starts tonight.'}`,
    win: (_, g) => `${g.us}-${g.them}. ${g.line.pts >= 20 ? `${g.line.pts} points: the league notices.` : 'A win to start the year. That\'s the job.'}`,
    loss: (_, g) => `${g.them}-${g.us}. The sophomore slump headlines are ready. You read every one.`,
    reward: { win: { hype: 1 }, loss: { grit: 1 } } },
  { kind: 'scene', id: 'y2-ray', title: 'Coach Ray', text: s => `Ray is in the hospital. Nothing serious, the doctors say, but he's seventy-one. ${s.bonds.ray >= 2 ? 'He asks the nurses to put your game on.' : 'He doesn\'t call you. Dre does.'}`,
    choices: s => [
      { id: 'visit', label: 'Fly home between games.', result: 'Two flights, no sleep, an hour at his bedside. He talks about your footwork the whole time.', effects: { bond: { ray: 2 }, grit: 1 } },
      { id: 'game', label: 'Dedicate the next game to him.', result: 'You write his name on your shoes. The cameras find it.', effects: { hype: 1, flag: 'forRay' } },
      ...(s.bonds.ray < 1 ? [{ id: 'later', label: 'Tell yourself you\'ll call after the road trip.', result: 'The road trip is twelve days long.', effects: { bond: { ray: -1 }, train: { iq: 1 } } }] : []),
    ] },
  { kind: 'game', id: 'y2-ice', title: 'Rising Stars', level: 'nbaRival', key: true, minutes: s => minutesForRookie(s, 26), opp: s => `Team Ice (${s.draft?.iceTeam ?? 'Ice Vance'})`, stakes: s => `All-Star Weekend. The league made you and Ice captains of the Rising Stars game. ${s.flags.includes('beatIce') ? 'He wants the rematch.' : 'You want the rematch.'}${s.flags.includes('forRay') ? ' Ray\'s name is still on your shoes.' : ''}`,
    win: (s, g) => `${g.us}-${g.them}. Your team wins the Rising Stars game${g.line.pts >= 18 ? ` and you take MVP with ${g.line.pts}` : ''}. ${s.bonds.ice >= 1 ? 'Ice laughs the whole handshake line.' : 'Ice doesn\'t stay for the trophy.'}`,
    loss: (_, g) => `${g.them}-${g.us}. Ice lifts the trophy and points it at you. Fine. The real season is still going.`,
    reward: { win: { hype: 2, flag: 'risingMvp' }, loss: { grit: 2 } } },
  { kind: 'train', id: 't7', title: 'The Stretch Run', points: 2, text: () => 'Twenty games left and a playoff seed on the line. Sharpen one thing.' },
  { kind: 'game', id: 'y2-final', title: 'Conference Finals', level: 'nbaPlayoff', key: true, minutes: s => minutesForRookie(s, 30), opp: s => s.draft?.iceTeam ?? 'Ice\'s team', stakes: s => `Conference Finals, Game 6, and of course it's Ice. Win and you're in the Finals in year two. ${s.bonds.dre >= 3 ? 'Dre flew in. He\'s wearing your shoe.' : 'The whole of Carver Park is watching at the rec center.'}`,
    win: (_, g) => `${g.us}-${g.them}. You're going to the NBA Finals in your second season. Ice waits at half court and hugs you. "Go get it," he says.`,
    loss: (_, g) => `${g.them}-${g.us}. Ice goes to the Finals. You sit in the locker room in your jersey for an hour. Year three starts tomorrow.`,
    reward: { win: { hype: 3, flag: 'finals' }, loss: { grit: 2 } } },
  { kind: 'ending', id: 'end2' },
];

export const minutesForRookie = (s: StoryState, base: number) => Math.min(36, Math.max(10, Math.round(base + (overall(s) - 64) * 0.9 + (s.draft?.pick && s.draft.pick <= 5 ? 4 : 0))));

// ---------------------------------------------------------------- the hero

/** Your player at sixteen: a real engine player of your style, raw but talented. */
export function createHero(seed: number, name: string, style: StoryStyle): PlayerSeason {
  const rng = new RNG(seed * 13 + 1);
  const p = generatePlayer(name, '2026-27', 'YOU', 16, seed % 1000, rng, { caliber: 44, archetype: STYLES[style].archetype });
  return { ...p, playerId: name, seasonStats: undefined, careerHistory: [], jerseyNumber: p.jerseyNumber };
}

const clamp99 = (v: number) => Math.max(1, Math.min(99, Math.round(v)));

/** Adds points to every rating in a Career category (training). */
export function trainHero(hero: PlayerSeason, cat: CategoryId, amount: number): PlayerSeason {
  const c = CATEGORY_BY_ID.get(cat);
  if (!c || !amount) return hero;
  const attributes = { physical: { ...hero.attributes.physical }, offense: { ...hero.attributes.offense }, defense: { ...hero.attributes.defense }, mental: { ...hero.attributes.mental } };
  for (const [g, k] of c.fields) {
    if (k === 'heightInches' || k === 'wingspanInches' || k === 'standingReachInches' || k === 'weightLbs') continue;
    const group = attributes[g] as unknown as Record<string, number>;
    group[k] = clamp99(group[k] + amount);
  }
  return { ...hero, attributes };
}

/** A year older and stronger: every rating grows a little (more when young), then the chapter's age. */
function growUp(hero: PlayerSeason, years: number): PlayerSeason {
  let next = hero;
  for (const cat of ['finishing', 'midRange', 'threePoint', 'playmaking', 'perimeterD', 'interiorD', 'iq', 'athleticism', 'body'] as CategoryId[]) next = trainHero(next, cat, 2.5 * years);
  if (next.attributes.physical.heightInches < 84 && years > 0) next = { ...next, attributes: { ...next.attributes, physical: { ...next.attributes.physical, heightInches: next.attributes.physical.heightInches + (next.age < 18 ? 1 : 0) } } };
  return { ...next, age: next.age + years };
}

export const TRAIN_STEP = 3;
export const TRAINABLE: CategoryId[] = ['finishing', 'midRange', 'threePoint', 'playmaking', 'perimeterD', 'interiorD', 'iq', 'athleticism', 'body'];

// ---------------------------------------------------------------- flow

export function newStory(seed: number, name: string, style: StoryStyle, hometown: string, relics?: { clutchGene?: boolean }): StoryState {
  const clean = name.trim().replace(/\s+/g, ' ').slice(0, 24) || 'Jaylen Carter';
  // The Clutch Gene (a secret relic): two grit before the first page.
  return { v: 1, seed, name: clean, style, hometown, hero: createHero(seed, clean, style), hype: 0, grit: relics?.clutchGene ? 2 : 0, bonds: { dre: 1, ray: 0, ice: 0 }, flags: [], at: 0, games: [], points: 0, done: false };
}

/** The beat you're on (skipping scenes whose condition doesn't hold). */
export function currentBeat(s: StoryState): Beat {
  return SCRIPT[Math.min(s.at, SCRIPT.length - 1)];
}

function applyEffects(s: StoryState, e: Effects | undefined): StoryState {
  if (!e) return s;
  let hero = s.hero;
  for (const [cat, n] of Object.entries(e.train ?? {})) hero = trainHero(hero, cat as CategoryId, (n ?? 0) * TRAIN_STEP);
  const bonds = { ...s.bonds };
  for (const [p, n] of Object.entries(e.bond ?? {})) bonds[p as Person] = Math.max(-5, Math.min(6, bonds[p as Person] + (n ?? 0)));
  return { ...s, hero, hype: Math.max(0, s.hype + (e.hype ?? 0)), grit: Math.max(0, s.grit + (e.grit ?? 0)), bonds, flags: e.flag && !s.flags.includes(e.flag) ? [...s.flags, e.flag] : s.flags };
}

/** Moves to the next beat, entering chapters (aging up) and skipping scenes that don't apply. */
function advance(s: StoryState): StoryState {
  let next = { ...s, at: s.at + 1 };
  for (;;) {
    const b = SCRIPT[next.at];
    if (!b) return { ...next, done: true };
    if (b.kind === 'scene' && b.when && !b.when(next)) { next = { ...next, at: next.at + 1 }; continue; }
    if (b.kind === 'chapter') next = { ...next, hero: growUp(next.hero, Math.max(0, b.age - next.hero.age)) };
    if (b.kind === 'train') next = { ...next, points: b.points };
    if (b.kind === 'ending') next = { ...next, done: true };
    return next;
  }
}

export function continueStory(s: StoryState): StoryState {
  const b = currentBeat(s);
  if (b.kind !== 'chapter') return s;
  return { ...advance(s), last: undefined };
}

export function choose(s: StoryState, choiceId: string): StoryState {
  const b = currentBeat(s);
  if (b.kind !== 'scene') return s;
  const c = b.choices(s).find(x => x.id === choiceId);
  if (!c) return s;
  return { ...advance(applyEffects(s, c.effects)), last: c.result };
}

export function spendTraining(s: StoryState, cat: CategoryId): StoryState {
  const b = currentBeat(s);
  if (b.kind !== 'train' || s.points <= 0 || !TRAINABLE.includes(cat)) return s;
  const next = { ...s, hero: trainHero(s.hero, cat, TRAIN_STEP), points: s.points - 1 };
  return next.points > 0 ? next : { ...advance(next), last: 'The work is done. You can feel it.' };
}

export function choosePath(s: StoryState, path: Path): StoryState {
  const b = currentBeat(s);
  if (b.kind !== 'path') return s;
  const blurb = path === 'blueblood' ? 'You pull on the State hat. The gym goes crazy.' : path === 'midmajor' ? 'You pick Coastal Tech. "They gave me the keys," you tell the cameras.' : 'Belgrade. Your mom cries for a different reason.';
  return { ...advance({ ...s, path, hype: s.hype + PATHS[path].hype }), last: blurb };
}

/** Pick on draft night, from how good you are and how loud your name is (and Ice's, who is always good). */
export function draftPick(s: StoryState): number | null {
  const score = (overall(s) - 58) * 2 + s.hype * 0.7 + keyWins(s) * 1.2 + (s.flags.includes('goodInterview') ? 2 : 0) + (s.flags.includes('finalFour') ? 3 : 0);
  if (score < -6) return null;
  return Math.max(1, Math.min(60, Math.round(31 - score)));
}

const NBA_TEAMS = ['Detroit Pistons', 'San Antonio Spurs', 'Charlotte Hornets', 'Portland Trail Blazers', 'Washington Wizards', 'Utah Jazz', 'Toronto Raptors', 'Memphis Grizzlies', 'Sacramento Kings', 'Chicago Bulls', 'Orlando Magic', 'Brooklyn Nets', 'Atlanta Hawks', 'Houston Rockets', 'Indiana Pacers', 'Miami Heat'];

export function runDraft(s: StoryState): StoryState {
  const b = currentBeat(s);
  if (b.kind !== 'draft') return s;
  const rng = new RNG(s.seed * 17 + 3);
  const pick = draftPick(s);
  const icePick = pick === 1 ? 2 : pick && pick <= 3 ? 1 : 1 + rng.nextInt(3);
  const team = NBA_TEAMS[(pick ?? 30) % NBA_TEAMS.length];
  let iceTeam = NBA_TEAMS[(icePick * 7 + 3) % NBA_TEAMS.length];
  if (iceTeam === team) iceTeam = NBA_TEAMS[(icePick * 7 + 4) % NBA_TEAMS.length];
  const draft = { pick, team: pick ? team : 'Undrafted (summer league invite)', icePick, iceTeam };
  const line = pick ? `With the ${ordinal(pick)} pick, the ${team} select... ${s.name}.` : 'Sixty names are called. Yours isn\'t. At midnight your phone rings: a summer league invite. You take it.';
  return { ...advance({ ...s, draft, hype: s.hype + (pick && pick <= 10 ? 2 : 0) }), last: line };
}

export const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

// ---------------------------------------------------------------- games

export const gameScore = (l: StoryGame['line']) => l.pts + l.reb * 1.1 + l.ast * 1.4 + l.stl * 2 + l.blk * 2 - (l.fga - l.fgm) * 0.5;
export function gradeOf(l: StoryGame['line']): string {
  const gs = gameScore(l) * (30 / Math.max(12, l.min));
  return gs >= 34 ? 'A+' : gs >= 27 ? 'A' : gs >= 21 ? 'B' : gs >= 15 ? 'C' : gs >= 9 ? 'D' : 'F';
}

function squad(level: GameLevel, side: 0 | 1, seed: number, count: number, s: StoryState): PlayerSeason[] {
  const [mine, theirs] = LEVEL[level];
  // Your teammates play a little better for a gritty leader; the people you kept close show up for you.
  const base = side === 0 ? mine + Math.min(2, s.grit * 0.25) : theirs;
  const rng = new RNG(seed);
  return Array.from({ length: count }, (_, i) => {
    const p = generatePlayer(`${side ? 'Opp' : 'Mate'} ${i + 1}`, '2026-27', side ? 'OPP' : 'YOU', 22, seed + i * 97, rng, { caliber: Math.round(base + (i < 4 ? 2 : -3) + rng.nextInt(5) - 2) });
    return p;
  });
}

/** Your effective self in a game: grit sharpens the mental side, hype is pressure (and confidence). */
function heroForGame(s: StoryState): PlayerSeason {
  const m = s.hero.attributes.mental;
  const lift = Math.min(8, s.grit);
  const mental = { ...m, clutch: clamp99(m.clutch + lift), composure: clamp99(m.composure + lift), confidence: clamp99(m.confidence + Math.min(6, s.hype)) };
  return { ...s.hero, attributes: { ...s.hero.attributes, mental } };
}

export function playStoryGame(s: StoryState): StoryState {
  const b = currentBeat(s);
  if (b.kind !== 'game') return s;
  const idx = SCRIPT.indexOf(b);
  const seed = s.seed * 31 + idx * 7919;
  const minutes = b.minutes(s);
  const hero = { ...heroForGame(s), rotationRole: (minutes >= 24 ? 'starter' : 'bench') as 'starter' | 'bench', minutes: { mode: 'TARGET' as const, target: minutes } };
  const mates = squad(b.level, 0, seed + 1, 9, s);
  const opps = squad(b.level, 1, seed + 2, 10, s);
  const mins = [32, 31, 30, 29, 27, 21, 18, 15, 12, 10];
  const rotation = (ps: PlayerSeason[]) => ps.map((p, i) => ({ ...p, rotationRole: (i < 5 ? 'starter' : 'bench') as 'starter' | 'bench', minutes: { mode: 'TARGET' as const, target: mins[i] ?? 8 } }));
  const us = [hero, ...rotation(mates).slice(0, 9)];
  const coach = { ...defaultCoachTendencies(), rotationDepth: 10 };
  const r = simulateGame({ home: { teamId: 'YOU', seasons: us, coach, chemistry: 70 + Math.max(0, s.bonds.dre) * 2 }, away: { teamId: 'OPP', seasons: rotation(opps), coach, chemistry: 70 },
    rules: DEFAULT_LEAGUE_RULES, settings: { ...DEFAULT_GAME_SETTINGS, seed, injuriesEnabled: false, teamChemistryEnabled: true } });
  const l = r.homeBox.players[s.hero.playerId];
  const line = l ? { pts: l.points, reb: l.oreb + l.dreb, ast: l.ast, stl: l.stl, blk: l.blk, fgm: l.fgm, fga: l.fga, min: Math.round(l.minutes) } : { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, fgm: 0, fga: 0, min: 0 };
  const won = r.homeScore > r.awayScore;
  const game: StoryGame = { beat: b.id, title: b.title, opp: b.opp(s), us: r.homeScore, them: r.awayScore, won, line, grade: gradeOf(line) };
  // A great game turns heads either way.
  const shine = game.grade.startsWith('A') ? { hype: 1 } : undefined;
  let next = applyEffects({ ...s, games: [...s.games, game] }, won ? b.reward?.win : b.reward?.loss);
  next = applyEffects(next, shine);
  return { ...advance(next), last: won ? b.win(next, game) : b.loss(next, game) };
}

// ---------------------------------------------------------------- the ending

export interface Ending { id: string; title: string; text: string; tier: 'legend' | 'star' | 'pro' | 'grinder' }

export function ending(s: StoryState): Ending {
  if (inYearTwo(s)) return yearTwoEnding(s);
  const key = s.games.filter(g => g.won && SCRIPT.some(b => b.id === g.beat && b.kind === 'game' && b.key)).length;
  const ovr = overall(s);
  const avg = s.games.length ? s.games.reduce((n, g) => n + gameScore(g.line), 0) / s.games.length : 0;
  const pts = (ovr - 60) * 1.5 + key * 4 + s.hype * 0.8 + avg * 0.3 + (s.draft?.pick && s.draft.pick <= 5 ? 4 : 0);
  const tier: Ending['tier'] = pts >= 36 ? 'legend' : pts >= 24 ? 'star' : pts >= 12 ? 'pro' : 'grinder';
  const name = first(s);
  const base = {
    legend: { title: 'The Legend Begins', text: `${s.name} wins Rookie of the Year by a landslide. ${s.flags.includes('game7') ? 'The Game 7 on the road becomes the first chapter of a story people will tell for twenty years.' : 'The league already belongs to the kid from Carver Park; it just doesn\'t know it yet.'}` },
    star: { title: 'A Star Is Born', text: `First-team All-Rookie and a starter by March. Scouts who passed on ${name} spend the summer explaining why.` },
    pro: { title: 'A Pro', text: `${name} made it. A rotation spot, a real contract, and a long way still to go. Most kids from Carver Park never get this far.` },
    grinder: { title: 'The Long Way Up', text: `A rough rookie year, a trip to the G League, and a phone full of doubters. ${name} has been here before. The work starts again tomorrow.` },
  }[tier];
  const dre = s.bonds.dre >= 4 ? 'Dre runs the camp at Carver Park; the new court has both your names on it.' : s.bonds.dre >= 1 ? 'Dre still texts after every game, mostly to say you should have passed.' : 'You and Dre don\'t talk much anymore. Some nights you miss him more than you\'ll admit.';
  const ray = s.bonds.ray >= 4 ? 'Coach Ray sits courtside at every home game, in the seat you bought for him.' : s.bonds.ray >= 1 ? 'Ray watches every game from the rec-center office, on a TV with bad reception.' : 'Coach Ray tells the kids at the rec center about you. He leaves out the parts where you stopped calling.';
  const ice = s.flags.includes('beatIce') ? (s.bonds.ice >= 0 ? 'Ice calls it the best rivalry in the league. So do you.' : 'Ice has your next game circled. So do you.') : 'Ice got the first win in the NBA. You have a long memory.';
  return { id: tier, title: base.title, text: `${base.text}\n\n${dre}\n${ray}\n${ice}`, tier };
}

/** Chapter 6 (Year Two): open once you've reached any ending. */
export const inYearTwo = (s: Pick<StoryState, 'flags'>) => s.flags.includes('yearTwo');
const YEAR_TWO_AT = SCRIPT.findIndex(b => b.id === 'c6');
export const canStartYearTwo = (s: StoryState) => s.done && !inYearTwo(s) && YEAR_TWO_AT > 0;
export function startYearTwo(s: StoryState): StoryState {
  if (!canStartYearTwo(s)) return s;
  const b = SCRIPT[YEAR_TWO_AT] as Extract<Beat, { kind: 'chapter' }>;
  return { ...s, done: false, at: YEAR_TWO_AT, last: undefined, flags: [...s.flags, 'yearTwo', `rookie:${ending({ ...s, flags: s.flags }).tier}`], hero: growUp(s.hero, Math.max(0, b.age - s.hero.age)) };
}
function yearTwoEnding(s: StoryState): Ending {
  const y2 = s.games.filter(g => g.beat.startsWith('y2-'));
  const key = y2.filter(g => g.won && (g.beat === 'y2-ice' || g.beat === 'y2-final')).length;
  const avg = y2.length ? y2.reduce((n, g) => n + gameScore(g.line), 0) / y2.length : 0;
  const pts = (overall(s) - 64) * 1.5 + key * 6 + s.hype * 0.6 + avg * 0.3;
  const tier: Ending['tier'] = pts >= 36 ? 'legend' : pts >= 24 ? 'star' : pts >= 12 ? 'pro' : 'grinder';
  const name = first(s);
  const base = {
    legend: { title: 'The MVP Conversation', text: `${s.flags.includes('finals') ? `The Finals in year two. ` : ''}By April, the national shows argue about whether ${name} is already the best player in the conference. Nobody laughs at the question.` },
    star: { title: 'All-Star', text: `${name} is an All-Star in year two. The billboard on the highway home gets bigger.` },
    pro: { title: 'Starter', text: `${name} starts 70 games and the team is better when ${name} plays. That's the league's quiet way of saying: you belong.` },
    grinder: { title: 'Still Climbing', text: `A sophomore slump the papers loved. ${name} spent the last month of the season in the gym at midnight. Year three will be different.` },
  }[tier];
  const ray = s.bonds.ray >= 3 ? 'Ray is out of the hospital and back in his courtside seat.' : 'Ray watches from home now. He still calls after every game.';
  const ice = s.flags.includes('finals') ? 'Ice sends a text the night you reach the Finals: one word, "Finally."' : 'Ice is still ahead in the rivalry. For now.';
  return { id: `y2-${tier}`, title: base.title, text: `${base.text}\n\n${ray}\n${ice}`, tier };
}

export function storyShareText(s: StoryState, site: string): string {
  const e = ending(s);
  const best = bestLine(s);
  return `Court Vision Story Mode: ${s.name}, from ${s.hometown} to the NBA\n${e.title}${s.draft ? ` · ${s.draft.pick ? `#${s.draft.pick} pick` : 'undrafted'}` : ''}\n${s.games.map(g => (g.won ? '🟩' : '🟥')).join('')}${best ? `\nBest game: ${best.line.pts} PTS, ${best.line.reb} REB, ${best.line.ast} AST vs ${best.opp}` : ''}\n${site}/#/story`;
}

// ---------------------------------------------------------------- saving

export const STORY_KEY = 'cv-story';
export const STORY_ENDINGS_KEY = 'cv-story-endings';
export function loadStory(): StoryState | null {
  try { const s = JSON.parse(localStorage.getItem(STORY_KEY) ?? 'null') as StoryState | null; return s && s.v === 1 && s.hero && Array.isArray(s.games) ? s : null; } catch { return null; }
}
export function saveStory(s: StoryState | null): void {
  try { if (s) localStorage.setItem(STORY_KEY, JSON.stringify(s)); else localStorage.removeItem(STORY_KEY); } catch { /* storage blocked */ }
}
export interface StoryEndings { finished: number; tiers: Partial<Record<Ending['tier'], number>> }
export function loadEndings(): StoryEndings {
  try { const r = JSON.parse(localStorage.getItem(STORY_ENDINGS_KEY) ?? 'null') as StoryEndings | null; if (r && Number.isFinite(r.finished)) return { finished: r.finished, tiers: r.tiers ?? {} }; } catch { /* fall through */ }
  return { finished: 0, tiers: {} };
}
export function recordEnding(s: StoryState): StoryEndings {
  const r = loadEndings(), t = ending(s).tier;
  const next = { finished: r.finished + 1, tiers: { ...r.tiers, [t]: (r.tiers[t] ?? 0) + 1 } };
  try { localStorage.setItem(STORY_ENDINGS_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
  return next;
}
export const chapterOf = (s: StoryState) => [...SCRIPT.slice(0, s.at + 1)].reverse().find((b): b is Extract<Beat, { kind: 'chapter' }> => b.kind === 'chapter');
