import type { PlayerSeason } from '../simulation/types';
import { DEFAULT_GAME_SETTINGS } from '../simulation/types';
import { RNG } from '../simulation/engine/rng';
import { simulateGame } from '../simulation/engine/game';
import { calculateOverall } from '../simulation/engine/overall';
import { defaultCoachTendencies } from '../simulation/league';
import { DEFAULT_LEAGUE_RULES } from '../simulation/leagueRules';
import { generatePlayer } from '../simulation/leagueGenerator';
import { CATEGORY_BY_ID, type CategoryId } from '../career/categories';
import type { StoryNba } from './storyNba';

/*
 * Story Mode: Street to the League. One player's road from a park in his hometown to the NBA: five chapters on the
 * way up (here), then fifteen seasons in the real league (storyNba.ts). Scenes ask you to choose (who you trust, how
 * you train, what you say); key games are played by the main game engine with you on the floor, and how you play
 * changes the story. Four people walk the road with you: your best friend Dre, Coach Ray from the rec center, your
 * little sister Maya and your rival Marcus "Ice" Vance. The ending depends on your career, your hype, your grit and the people you kept close.
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

export type Path = 'blueblood' | 'midmajor' | 'overseas' | 'gleague' | 'juco';
export const PATHS: Record<Path, { name: string; team: string; blurb: string; minutes: number; hype: number }> = {
  blueblood: { name: 'State University', team: 'State', blurb: 'The blue blood. National TV every week, five other McDonald\'s All-Americans fighting for your minutes.', minutes: 24, hype: 2 },
  midmajor: { name: 'Coastal Tech', team: 'Coastal', blurb: 'A mid-major that will hand you the keys from day one. Fewer cameras, all the shots.', minutes: 34, hype: 1 },
  overseas: { name: 'Partizan Belgrade', team: 'Belgrade', blurb: 'Skip college and turn pro in Europe. Grown men, tough coaching, real money.', minutes: 26, hype: 1 },
  gleague: { name: 'The G League', team: 'Prospects', blurb: 'Get paid at nineteen in the NBA\'s own minor league. Every scout watches; every teammate wants your spot.', minutes: 30, hype: 1 },
  juco: { name: 'Harbor Community College', team: 'Harbor', blurb: 'The long way: junior college, all the minutes you want, and a chip on your shoulder the size of a backboard.', minutes: 36, hype: 0 },
};
const isCampus = (s: Pick<StoryState, 'path'>) => s.path === 'blueblood' || s.path === 'midmajor' || !s.path;

/** The people on the road with you: best friend Dre, Coach Ray, rival Ice, and your little sister Maya. */
export type Person = 'dre' | 'ray' | 'ice' | 'maya';
export interface Effects { hype?: number; grit?: number; bond?: Partial<Record<Person, number>>; train?: Partial<Record<CategoryId, number>>; flag?: string }
export interface Choice { id: string; label: string; result: string; effects: Effects }

export type GameLevel = 'street' | 'hs' | 'hsRival' | 'state' | 'showcase' | 'allAmerican' | 'college' | 'collegeFinal';
/** Team calibers by level: [your teammates, the opponent]. Your own rating grows with training and age. */
const LEVEL: Record<GameLevel, [number, number]> = {
  street: [41, 42], hs: [46, 46], hsRival: [47, 49], state: [49, 51], showcase: [49, 50], allAmerican: [52, 52], college: [55, 56], collegeFinal: [57, 59],
};

/** One page of the journal: a choice you made, a big game, a season. */
export interface JournalEntry { when: string; title: string; text: string; kind: 'choice' | 'game' | 'season'; pick?: string }
/** The journal keeps the latest pages (a whole career fits). */
export const JOURNAL_MAX = 400;
export const addJournal = (s: StoryState, e: JournalEntry): StoryState => ({ ...s, journal: [...(s.journal ?? []), e].slice(-JOURNAL_MAX) });
export const gameSummary = (g: Pick<StoryGame, 'won' | 'us' | 'them' | 'opp' | 'line'>) => `${g.won ? 'W' : 'L'} ${g.us}-${g.them} vs ${g.opp} · ${g.line.pts} PTS, ${g.line.reb} REB, ${g.line.ast} AST`;

export interface StoryGame { beat: string; title: string; opp: string; us: number; them: number; won: boolean; line: { pts: number; reb: number; ast: number; stl: number; blk: number; fgm: number; fga: number; min: number }; grade: string }

export interface StoryState {
  v: 2;
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
  /** The beat you're on (its id in the script); 'nba' once you're in the league. */
  beat: string;
  /** Text of the choice you just made, shown above the next beat. */
  last?: string;
  games: StoryGame[];
  /** Draft night, once it has happened. */
  draft?: { pick: number | null; team: string; icePick: number | null; iceTeam: string };
  /** Training points waiting to be spent. */
  points: number;
  done: boolean;
  /** The NBA years, from draft night on (storyNba.ts). */
  nba?: StoryNba;
  /** A story finished before the NBA years existed: it ended after the rookie season (or Year Two). */
  classic?: boolean;
  /** What happened, page by page (stories from before the journal start it where they are). */
  journal?: JournalEntry[];
}

export type Beat =
  | { kind: 'chapter'; id: string; act: number; title: string; text: (s: StoryState) => string; age: number }
  | { kind: 'scene'; id: string; title: string; text: (s: StoryState) => string; choices: (s: StoryState) => Choice[]; when?: (s: StoryState) => boolean }
  | { kind: 'train'; id: string; title: string; text: (s: StoryState) => string; points: number }
  | { kind: 'path'; id: string; title: string; text: (s: StoryState) => string }
  | { kind: 'game'; id: string; title: string; level: GameLevel; when?: (s: StoryState) => boolean; opp: (s: StoryState) => string; stakes: (s: StoryState) => string; minutes: (s: StoryState) => number; key?: boolean; win: (s: StoryState, g: StoryGame) => string; loss: (s: StoryState, g: StoryGame) => string; reward?: { win?: Effects; loss?: Effects } }
  | { kind: 'draft'; id: string; title: string }
  /** The NBA years (storyNba.ts) take over from here. */
  | { kind: 'nba'; id: string };

const first = (s: StoryState) => s.name.split(' ')[0];
const stars = (s: StoryState) => Math.max(1, Math.min(5, Math.round((overall(s) - 38) / 4 + s.hype / 3)));
export const overall = (s: StoryState) => calculateOverall(s.hero);
const keyWins = (s: StoryState) => s.games.filter(g => g.won).length;

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
  { kind: 'scene', id: 'maya', title: 'Maya', text: s => `Your little sister Maya is twelve and has watched every game this summer through the fence at Carver Park. ${s.games.at(-1)?.won ? 'Since the win she won\'t stop doing your celebration.' : 'After the loss she sat next to you on the curb and said nothing, which was the nicest thing anyone did all day.'} Now she holds up a ball. "Teach me the step-back."`,
    choices: () => [
      { id: 'teach', label: 'Teach her. Every day this summer.', result: 'By August her step-back is better than Dre\'s. Teaching it makes yours cleaner too.', effects: { bond: { maya: 2 }, train: { midRange: 1 } } },
      { id: 'run', label: 'Bring her into the Saturday run.', result: 'The older guys go easy on her for exactly one possession. She scores on Dre. The park never lets him forget it.', effects: { bond: { maya: 1, dre: 1 }, hype: 1 } },
      { id: 'ray', label: 'Sign her up for Coach Ray\'s youth clinic.', result: 'Ray says she has your work ethic and Mom\'s jump shot. You both take it as a compliment.', effects: { bond: { maya: 1, ray: 1 } } },
      { id: 'later', label: '"Not now, Maya. I\'m working."', result: 'She shrugs and walks home. You get your shots up. It feels quieter than it should.', effects: { bond: { maya: -2 }, train: { threePoint: 1 }, grit: 1 } },
    ] },
  { kind: 'scene', id: 'party', title: 'Friday Night', text: s => `Dre's cousin is throwing the party of the summer. Coach Ray texts: "Gym's open at 7. Bring your shoes." ${s.games.at(-1)?.won ? 'Half the city wants to meet the kid who beat Ice.' : 'Nobody at that party has heard of you yet.'}`,
    choices: () => [
      { id: 'party', label: 'Go to the party with Dre.', result: 'You dance badly, laugh a lot, and Dre says it\'s the best night of his summer. Your legs feel it in the morning.', effects: { hype: 1, bond: { dre: 2 } } },
      { id: 'gym', label: 'Gym with Coach Ray.', result: 'Ray tapes your ankles, turns off his phone and makes you dribble with your left until it stops being your weak hand.', effects: { train: { playmaking: 2 }, bond: { ray: 1, dre: -1 }, grit: 1 } },
      { id: 'film', label: 'Stay home and watch film.', result: 'Old playoff games until 2 AM. You start seeing the game in slow motion.', effects: { train: { iq: 2 } } },
      { id: 'maya', label: 'Take Maya to the movies like you promised.', result: 'She picks the loudest movie in the building and explains the whole plot on the bus home. Worth it.', effects: { bond: { maya: 2 }, grit: 1 } },
    ] },
  { kind: 'train', id: 't1', title: 'Summer Workouts', points: 3, text: () => 'Three months until school. Pick where the work goes. Every point is a sweaty morning at Carver Park.' },

  // ---------------------------------------------------------------- Act 2: Varsity
  { kind: 'chapter', id: 'c2', act: 2, age: 17, title: 'Varsity', text: s => `Douglass High. Coach Hart has won three state titles and doesn't play juniors. Ice transferred to Westside, across town. Dre made the team as the twelfth man; you're fighting for a starting spot.` + (s.bonds.ray >= 3 ? ' Ray called Hart and told him to watch you.' : '') },
  { kind: 'scene', id: 'tryout', title: 'Tryouts', text: () => 'Day three of tryouts. Hart puts you against Tre Wallace, the senior all-state guard, in a shell drill. Everyone stops to watch.',
    choices: () => [
      { id: 'lock', label: 'Pick him up full court. Every possession.', result: 'Tre doesn\'t score once. Hart writes something on his clipboard without looking up.', effects: { train: { perimeterD: 2 }, grit: 1 } },
      { id: 'show', label: 'Cross him over and let everyone hear about it.', result: 'The gym explodes. Tre does not find it funny. Neither does Hart.', effects: { hype: 2, grit: -1 } },
      { id: 'dirty', label: 'Do the dirty work: boards, charges, loose balls.', result: '"That," Hart says to the whole gym, "is how you make my team."', effects: { train: { interiorD: 1, body: 1 }, grit: 2 } },
      { id: 'run', label: 'Run the offense. Make Tre look good.', result: 'You find Tre for three straight layups. He starts calling for you in every drill.', effects: { train: { playmaking: 1, iq: 1 } } },
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
  { kind: 'scene', id: 'mom', title: 'Mom', text: () => 'Mom works the early shift at the hospital and the late one at the grocery store. One night you find her asleep at the kitchen table with her shoes still on and a stack of bills under her elbow.',
    choices: () => [
      { id: 'job', label: 'Get a weekend job at the rec center.', result: 'Ray pays you to mop the gym floor. You shoot on it when you\'re done.', effects: { grit: 2, bond: { ray: 1 } } },
      { id: 'home', label: 'Take over dinner and Maya\'s homework.', result: 'You learn to cook four things. Maya learns fractions. Mom gets an extra hour of sleep.', effects: { bond: { maya: 2 }, grit: 1 } },
      { id: 'promise', label: 'Promise her a house one day.', result: 'She laughs and tells you to go to bed. You mean it, though. You write it on a sticky note on your mirror.', effects: { hype: 1, flag: 'momPromise' } },
    ] },
  { kind: 'game', id: 'g-westside', title: 'Westside: Ice Comes Home', level: 'hsRival', minutes: () => 30, opp: () => "Westside (Ice Vance)", stakes: s => `The biggest regular-season game in the city. Ice is averaging 27. ${s.bonds.ice <= -1 ? 'He circled this date the day you beat him at the park.' : 'He sends you a text: "Good luck. You\'ll need it."'}`,
    win: (_, g) => `${g.us}-${g.them}. You outplayed the #1 recruit in the state on his home floor. ${g.line.pts >= 20 ? `${g.line.pts} points. Recruiting sites update your ranking that night.` : 'Nobody saw your box score coming.'}`,
    loss: (_, g) => `Westside ${g.them}-${g.us}. Ice drops 30 and waves at your bench. It will stay with you for a long time.`,
    reward: { win: { hype: 2, bond: { ice: -1 } }, loss: { grit: 2 } } },
  { kind: 'game', id: 'g-state', title: 'State Championship', level: 'state', key: true, minutes: () => 32, opp: () => 'Westside (Ice Vance)', stakes: () => 'Of course it\'s Westside. Of course it\'s Ice. 12,000 people at the arena, every college coach in the state in the first three rows.',
    win: (_, g) => `STATE CHAMPIONS, ${g.us}-${g.them}. Hart cries. Dre is on your shoulders even though you're the one who should be on his. Ice walks off without the handshake.`,
    loss: (_, g) => `Westside wins it, ${g.them}-${g.us}. Ice cuts down the nets. You watch every second of it, on purpose.`,
    reward: { win: { hype: 2, flag: 'stateChamp' }, loss: { grit: 2 } } },
  { kind: 'train', id: 't2', title: 'Senior Summer', points: 3, text: () => 'One last summer before the big decision. Elite camps, AAU, and the empty gym at Douglass at 6 AM.' },

  // ---------------------------------------------------------------- Act 3: The Circuit
  { kind: 'chapter', id: 'c-circuit', act: 3, age: 18, title: 'The Circuit', text: s => `Senior year starts in the summer: AAU tournaments in gyms with forty courts, college coaches in matching polos lined up along the baseline, and a phone that never stops buzzing. ${s.flags.includes('stateChamp') ? 'Everybody wants the state champion.' : 'Ice has the ring. You have a chip on your shoulder.'}` },
  { kind: 'scene', id: 'aau', title: 'Pick a Team', text: () => 'Three summer teams want you. The Elite, sponsored by a shoe company, fly to every big tournament in matching gear. Coach Ray\'s rec-center team plays in the same tournaments in mismatched socks. And Ice\'s team wants you too. "Imagine the two of you together," his coach says.',
    choices: () => [
      { id: 'elite', label: 'The Elite. Free shoes, every camera.', result: 'Your highlight from the first weekend gets a million views. Your new shoes cost more than Mom\'s car payment.', effects: { hype: 3, bond: { ray: -1 }, flag: 'aauElite' } },
      { id: 'ray', label: 'Ray\'s team. Loyalty.', result: 'Ray doesn\'t say thank you. He doesn\'t have to. You play every minute of every game.', effects: { bond: { ray: 2 }, grit: 1, train: { iq: 1 } } },
      { id: 'ice', label: 'Ice\'s team. Two stars, one ball.', result: 'Three practices in, you and Ice find out you actually like playing together. Neither of you will ever admit it.', effects: { bond: { ice: 3 }, hype: 1, flag: 'aauIce' } },
      { id: 'dre', label: 'Whichever team takes Dre too.', result: 'Only Ray\'s team does. Dre plays seven minutes a game and cheers like he\'s getting paid for it.', effects: { bond: { dre: 2, ray: 1 } } },
    ] },
  { kind: 'game', id: 'g-showcase', title: 'The Summer Showcase', level: 'showcase', minutes: () => 28, opp: s => (s.flags.includes('aauIce') ? 'The Elite' : 'Ice\'s AAU team'), stakes: s => `Las Vegas in July: 112 degrees outside, 200 college coaches inside. ${s.flags.includes('aauIce') ? 'You and Ice on the same side for once, and the Elite want to prove a point.' : 'Ice is on the other side, of course.'}`,
    win: (_, g) => `${g.us}-${g.them}. That night your phone shows 31 missed calls from area codes you don't know.`,
    loss: (_, g) => `${g.them}-${g.us}. A rough day in the desert. One coach still stops you on the way out: "I like how you competed."`,
    reward: { win: { hype: 1 }, loss: { grit: 1 } } },
  { kind: 'scene', id: 'stars', title: 'The Rankings', text: s => `The recruiting services have you as a ${stars(s)}-star recruit. Letters arrive every day. ${stars(s) >= 4 ? 'State University\'s head coach is coming to your house.' : 'Mid-majors are calling. The big schools are watching.'} A man in a nice suit introduces himself after a game: "I can make you famous, kid."`,
    choices: () => [
      { id: 'agent', label: 'Take his card. Get your name out there.', result: 'Highlight mixtapes, a sneaker deal for your summer team, 100,000 new followers. Ray shakes his head.', effects: { hype: 3, bond: { ray: -2 } } },
      { id: 'ray', label: 'Let Coach Ray handle it.', result: 'Ray turns the man away at the door. "Your game will get you famous. Not him."', effects: { bond: { ray: 2 }, grit: 1 } },
      { id: 'quiet', label: 'No distractions. Just basketball.', result: 'You turn your phone off for a month. Hart notices.', effects: { grit: 1, train: { iq: 1 } } },
      { id: 'maya', label: 'Ask Maya what she thinks.', result: '"He has a ponytail and sunglasses indoors," she says. That settles it.', effects: { bond: { maya: 1 }, grit: 1 } },
    ] },
  { kind: 'scene', id: 'visit', title: 'The Official Visit', text: s => `${stars(s) >= 4 ? 'State University flies you in for the big weekend: a packed arena, your name on the scoreboard and a jersey with your number already on it.' : 'Coastal Tech invites you for the weekend. The gym is small, the coach is honest and the beach is ten minutes away.'} The players are hosting you on Saturday night.`,
    choices: () => [
      { id: 'practice', label: 'Ask to sit in on Sunday\'s practice.', result: 'The coach lets you join the last drill. You hold your own against a future pro.', effects: { train: { iq: 1, perimeterD: 1 } } },
      { id: 'players', label: 'Hang out with the players.', result: 'You learn more about the program in one night of video games than in a month of brochures.', effects: { hype: 1, grit: 1 } },
      { id: 'mom', label: 'Bring Mom. Let her ask the hard questions.', result: 'She asks about class attendance, the team doctor and the graduation rate. The coach starts sweating. You love her.', effects: { grit: 1, bond: { maya: 1 } } },
      { id: 'skip', label: 'Skip it. Your mind is made up.', result: 'You spend the weekend in the gym instead. Everyone is a little confused.', effects: { train: { finishing: 1 } } },
    ] },
  { kind: 'game', id: 'g-allamerican', title: 'The All-American Game', level: 'allAmerican', when: s => stars(s) >= 4, minutes: () => 24, opp: () => 'Team West', stakes: s => `The best twenty-four seniors in the country, on national TV. ${s.bonds.ice >= 2 ? 'You and Ice are on the same team, and you both want MVP.' : 'Ice is on Team West, playing for the cameras.'}`,
    win: (_, g) => `${g.us}-${g.them}. ${g.line.pts >= 15 ? 'MVP talk all night.' : 'You did the little things and the scouts noticed.'}`,
    loss: (_, g) => `${g.them}-${g.us}. An all-star game with no defense and too many dunks. Nobody remembers who won. They remember who played hard.`,
    reward: { win: { hype: 2 }, loss: { grit: 1 } } },
  { kind: 'game', id: 'g-senior', title: 'Senior Night', level: 'hs', when: s => stars(s) < 4, minutes: () => 32, opp: () => 'Eastern Tech', stakes: () => 'Your last home game at Douglass. Mom has your number painted on her face, and Coach Hart asked you to give the speech after the game.',
    win: (_, g) => `${g.us}-${g.them}. In the speech you thank Hart, Ray, Mom, Maya and Dre, in that order, and nobody cries except everybody.`,
    loss: (_, g) => `${g.them}-${g.us}. Not the ending you wanted, but the gym stays full for your speech anyway.`,
    reward: { win: { hype: 1, grit: 1 }, loss: { grit: 2 } } },

  // ---------------------------------------------------------------- Act 4: The Choice
  { kind: 'chapter', id: 'c3', act: 4, age: 19, title: 'The Choice', text: s => `Signing day. Three hats and two pro contracts on the table at the Douglass gym. Your mom in the front row, Maya next to her, Dre with his phone up, Ray in the back. ${s.flags.includes('stateChamp') ? 'You\'re a state champion.' : 'Ice has the ring. You have something to prove.'}` },
  { kind: 'path', id: 'path', title: 'Signing Day', text: () => 'Where do you play next year?' },
  { kind: 'scene', id: 'campus', title: 'Year One', when: isCampus, text: s => `${PATHS[s.path ?? 'midmajor'].name}. ${s.path === 'blueblood' ? 'Practices are harder than any game you\'ve played. There are four future pros on your team.' : 'You\'re the best player in the building. The coach runs every play through you, and every opponent knows it.'} Midseason, you hit a wall.`,
    choices: () => [
      { id: 'grind', label: 'Live in the gym. Extra sessions at 5 AM.', result: 'Your body hates you for a month, then thanks you.', effects: { train: { athleticism: 2, body: 1 }, grit: 1 } },
      { id: 'mentor', label: 'Call Coach Ray.', result: 'Ray drives five hours to watch one practice. "You\'re thinking too much. Play."', effects: { bond: { ray: 2 }, train: { iq: 1 } } },
      { id: 'social', label: 'Lean into the spotlight. Interviews, NIL deals.', result: 'Your face is on a billboard. Your coach is less impressed.', effects: { hype: 3, grit: -1 } },
      { id: 'class', label: 'Put basketball second for a month. Go to class.', result: 'You find a history professor who makes you think. Your head clears and your game follows.', effects: { train: { iq: 1 }, grit: 1, bond: { ray: 1 } } },
    ] },
  { kind: 'scene', id: 'belgrade', title: 'Belgrade', when: s => s.path === 'overseas', text: () => 'The coach in Belgrade screams in two languages. The veterans take your shots and your lunch. In November you\'re fourth on the depth chart and very far from home.',
    choices: () => [
      { id: 'earn', label: 'Earn it in practice. Every day.', result: 'By January the veterans stop taking your lunch. By February they pass you the ball.', effects: { grit: 2, train: { perimeterD: 1, iq: 1 } } },
      { id: 'home', label: 'Call home every night.', result: 'Dre keeps you sane with bad jokes and worse highlights of himself in the rec league.', effects: { bond: { dre: 2 } } },
      { id: 'learn', label: 'Learn the language and the game they play.', result: 'Pick-and-roll reads, the extra pass, the backdoor cut. European basketball rewires your brain.', effects: { train: { playmaking: 2, iq: 1 } } },
      { id: 'maya', label: 'Fly Maya out for her spring break.', result: 'She eats everything, learns three swear words in Serbian (you make her promise never to use them) and cheers louder than the ultras.', effects: { bond: { maya: 2 }, grit: 1 } },
    ] },
  { kind: 'scene', id: 'gleague', title: 'Grown Men', when: s => s.path === 'gleague', text: () => 'Your first paycheck has more zeros than you have ever seen. Your teammates are 26 and 29, with kids, car payments and one last shot at the NBA. Some of them don\'t love the nineteen-year-old who got paid first.',
    choices: () => [
      { id: 'respect', label: 'Carry bags, rebound for the vets, earn it.', result: 'By December the vets call you "rook" like they mean it kindly. The point guard starts feeding you.', effects: { grit: 2, train: { body: 1 } } },
      { id: 'buy', label: 'Buy dinner for the whole team every road trip.', result: 'It works faster than it should. Your accountant sends a worried email.', effects: { hype: 1, bond: { dre: 1 } } },
      { id: 'learn', label: 'Ask the 29-year-old to teach you the pro game.', result: 'He teaches you how to get to your spot, how to draw fouls and how to survive a back-to-back.', effects: { train: { iq: 1, finishing: 1 } } },
      { id: 'home', label: 'Send half of every check home.', result: 'Mom quits the late shift. She calls to say thank you and cries the whole call.', effects: { grit: 1, bond: { maya: 1 }, flag: 'momPromise' } },
    ] },
  { kind: 'scene', id: 'juco', title: 'The Long Way', when: s => s.path === 'juco', text: () => 'Harbor Community College plays in a gym that doubles as the school cafeteria. Twelve players, eleven of them with a story about a school that didn\'t want them. You play every minute you want.',
    choices: () => [
      { id: 'chip', label: 'Write every school that passed on you on your shoes.', result: 'You score 40 in the opener and post a picture of the shoes. Several coaches unfollow you.', effects: { hype: 2, grit: 1 } },
      { id: 'grades', label: 'Get straight A\'s. Leave every door open.', result: 'Your professor says you\'re the best student in the class. Ray frames the report card.', effects: { train: { iq: 2 }, bond: { ray: 1 } } },
      { id: 'lead', label: 'Lead the team. Every one of them.', result: 'You organise 6 AM workouts for the whole roster. Harbor wins eleven straight.', effects: { grit: 2, train: { playmaking: 1 } } },
      { id: 'dre', label: 'Talk Dre into enrolling with you.', result: 'Dre makes the team as a walk-on and the dean\'s list in the same semester. Nobody is more surprised than Dre.', effects: { bond: { dre: 3 } } },
    ] },
  { kind: 'scene', id: 'ankle', title: 'The Ankle', text: () => 'February. You land on a defender\'s foot and your ankle rolls. The trainer says two weeks. The biggest game of the year is in nine days.',
    choices: () => [
      { id: 'rest', label: 'Rest the full two weeks.', result: 'You watch the big game in a suit. Your ankle comes back stronger than before.', effects: { train: { body: 1 }, grit: 1 } },
      { id: 'rush', label: 'Rush back for the big game.', result: 'You play on one leg and score 18. It hurts for a month. The highlight lasts longer.', effects: { hype: 2, train: { athleticism: -1 } } },
      { id: 'rehab', label: 'Rehab twice a day and learn to play below the rim.', result: 'Footwork, floaters and pump fakes. You come back with a new way to score.', effects: { train: { finishing: 1, midRange: 1 } } },
      { id: 'film', label: 'Spend the two weeks in the film room.', result: 'Your coach starts asking what you see. Then he starts using your answers.', effects: { train: { iq: 2 } } },
    ] },
  { kind: 'train', id: 't3', title: 'The Grind', points: 2, text: () => 'Between the games and the classes (or the flights), find the time.' },
  { kind: 'game', id: 'g-college', title: 'The Big Stage', level: 'college', minutes: s => PATHS[s.path ?? 'midmajor'].minutes, opp: s => BIG_STAGE[s.path ?? 'midmajor'][0], stakes: s => BIG_STAGE[s.path ?? 'midmajor'][1],
    win: (_, g) => `${g.us}-${g.them}. Mock drafts update overnight; your name moves up.`,
    loss: (_, g) => `${g.them}-${g.us}. A tough night with the whole world watching. The scouts write something down either way.`,
    reward: { win: { hype: 2 }, loss: { grit: 1 } } },
  { kind: 'game', id: 'g-final', title: 'The Tournament', level: 'collegeFinal', key: true, minutes: s => PATHS[s.path ?? 'midmajor'].minutes + 2, opp: s => FINAL_STAGE[s.path ?? 'midmajor'][0], stakes: s => FINAL_STAGE[s.path ?? 'midmajor'][1],
    win: (s, g) => `${g.us}-${g.them}! ${g.line.pts >= 20 ? `${g.line.pts} points on the biggest stage.` : 'You do a bit of everything when it matters most.'} ${s.bonds.dre >= 3 ? 'Dre flew in on a credit card he can\'t afford. Worth it.' : ''}`,
    loss: (_, g) => `${g.them}-${g.us}. Your season ends in a locker room that smells like tape and tears. You declare for the draft anyway.`,
    reward: { win: { hype: 3, flag: 'finalFour' }, loss: { grit: 2 } } },
  { kind: 'scene', id: 'declare', title: 'Declaring', text: s => `You declare for the draft. ${s.flags.includes('aauElite') ? 'The shoe company\'s agent is already sitting in your mom\'s living room.' : 'Within an hour, eleven agents have called your mom.'} You need someone in your corner for the next part.`,
    choices: s => [
      { id: 'agency', label: 'Sign with the biggest agency in sports.', result: 'They have offices in four cities and a private jet. Your face is on a billboard by June.', effects: { hype: 3 } },
      { id: 'lena', label: 'Hire Lena Brooks, the young agent who did her homework.', result: 'She shows up with a binder on every team that might draft you. Ray likes her immediately.', effects: { grit: 1, bond: { ray: 1 }, flag: 'agentLena' } },
      ...(s.bonds.dre >= 2 ? [{ id: 'dre', label: 'Make Dre your manager. Family first.', result: 'Dre buys a suit for the first time in his life. He reads every contract twice.', effects: { bond: { dre: 3 }, flag: 'dreManager' } }] : []),
      { id: 'ray', label: 'Ask Coach Ray to sit in on every meeting.', result: 'Ray says almost nothing in the meetings. Afterwards he tells you exactly who was lying.', effects: { bond: { ray: 2 }, grit: 1 } },
    ] },

  // ---------------------------------------------------------------- Act 5: Draft Night
  { kind: 'chapter', id: 'c4', act: 5, age: 20, title: 'Draft Night', text: s => `The combine in Chicago, then interviews with every team that might pick you, then a green room in Brooklyn. Ice is in the same green room. ${s.bonds.ice <= -2 ? 'You don\'t say a word to each other.' : 'He nods at you. It almost looks like respect.'}` },
  { kind: 'scene', id: 'combine', title: 'The Combine', text: () => 'Chicago. Every NBA team in one gym, every drill measured to the decimal. You have one afternoon to change your draft range.',
    choices: () => [
      { id: 'vert', label: 'Go all out in the athletic testing.', result: 'Your max vertical is the second best in the class. A general manager\'s eyebrows go up.', effects: { hype: 2, train: { athleticism: 1 } } },
      { id: 'shoot', label: 'Shoot. Nothing else matters.', result: 'You hit 21 of 25 from the corners. Shooting translates, and everybody knows it.', effects: { hype: 1, train: { threePoint: 1 } } },
      { id: 'scrim', label: 'Play in the five-on-five, against your agent\'s advice.', result: 'Most top prospects sit out. You don\'t. You play like the floor is Carver Park.', effects: { grit: 2, hype: 1 } },
      { id: 'skip', label: 'Skip the drills. Let the tape speak.', result: 'Some teams respect it. Some teams don\'t. Your agent says that\'s the point.', effects: { grit: 1 } },
    ] },
  { kind: 'scene', id: 'workout', title: 'Private Workouts', text: () => 'Twelve teams want to work you out in the next two weeks. Your body can handle six.',
    choices: () => [
      { id: 'top', label: 'Only the teams picking in the top ten.', result: 'You fly to a lot of bad weather. Two teams promise nothing, which means something.', effects: { hype: 1 } },
      { id: 'all', label: 'All twelve. Sleep on the plane.', result: 'By the last one you can barely lift your arms. Every general manager in the league calls you a worker.', effects: { grit: 2 } },
      { id: 'fit', label: 'The teams where you would actually play.', result: 'Six teams with an open spot at your position. "Smart," says your agent. "Smart," says Ray.', effects: { train: { iq: 1 }, grit: 1 } },
    ] },
  { kind: 'scene', id: 'interview', title: 'The Interview', text: () => 'A team with a top-five pick asks the question every team asks: "Why should we take you over Marcus Vance?"',
    choices: () => [
      { id: 'cocky', label: '"Because I already beat him. Twice."', result: 'Two executives smile. The coach doesn\'t. It\'s on TV by morning.', effects: { hype: 2, bond: { ice: -2 } } },
      { id: 'honest', label: '"Because I\'ll outwork everyone in your building."', result: 'The GM puts his pen down. "We\'ve heard that before. We believe it this time."', effects: { grit: 1, flag: 'goodInterview' } },
      { id: 'team', label: '"Take us both. He\'s good. I\'m better."', result: 'They laugh. Then they write it down.', effects: { hype: 1, bond: { ice: 1 } } },
      { id: 'home', label: 'Tell them about Carver Park, Mom and Maya.', result: 'Nobody writes anything for ten minutes. The coach shakes your hand twice on the way out.', effects: { grit: 1, bond: { maya: 1 }, flag: 'goodInterview' } },
    ] },
  { kind: 'draft', id: 'draft', title: 'The Green Room' },

  { kind: 'nba', id: 'nba' },
];

/** The big regular-season game and the tournament game, by path: [opponent, stakes]. */
const BIG_STAGE: Record<Path, [string, string]> = {
  blueblood: ['Duke', 'National TV. A top-10 opponent. Every NBA team has a scout in the building.'],
  midmajor: ['Gonzaga', 'National TV. A top-10 opponent. Every NBA team has a scout in the building.'],
  overseas: ['Real Madrid', 'EuroLeague on a Thursday night in Madrid. NBA scouts flew in for this.'],
  gleague: ['G League Showcase', 'The G League Showcase in Las Vegas: every NBA general manager in one building, and you on the floor against men who want your spot.'],
  juco: ['State University (exhibition)', 'An exhibition at State University, the school that stopped calling. Their fans chant "JU-CO" at you. Their coach watches from the bench.'],
};
const FINAL_STAGE: Record<Path, [string, string]> = {
  blueblood: ['Kentucky (Elite Eight)', 'Win and it\'s the Final Four. Ice\'s team went out in the first round.'],
  midmajor: ['Kentucky (Elite Eight)', 'Win and it\'s the Final Four. Ice\'s team went out in the first round.'],
  overseas: ['Olympiacos (EuroLeague Final Four)', 'The Final Four. Win and you\'re a lottery pick. Lose and you\'re a question mark.'],
  gleague: ['G League Finals, Game 3', 'Game 3 of the G League Finals. Win it and you\'re the youngest champion the league has ever had.'],
  juco: ['National juco championship', 'The national junior college championship in a gym in Kansas with 7,000 people and twenty NBA scouts. Win it and nobody can call you a long shot again.'],
};

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
  let grow = 0;
  for (let y = 0; y < years; y++) grow += hero.age + y < 18 ? 3 : 2;
  for (const cat of ['finishing', 'midRange', 'threePoint', 'playmaking', 'perimeterD', 'interiorD', 'iq', 'athleticism', 'body'] as CategoryId[]) next = trainHero(next, cat, grow);
  if (next.attributes.physical.heightInches < 84 && years > 0) next = { ...next, attributes: { ...next.attributes, physical: { ...next.attributes.physical, heightInches: next.attributes.physical.heightInches + (next.age < 18 ? 1 : 0) } } };
  return { ...next, age: next.age + years };
}

export const TRAIN_STEP = 3;
export const TRAINABLE: CategoryId[] = ['finishing', 'midRange', 'threePoint', 'playmaking', 'perimeterD', 'interiorD', 'iq', 'athleticism', 'body'];

// ---------------------------------------------------------------- flow

export function newStory(seed: number, name: string, style: StoryStyle, hometown: string, relics?: { clutchGene?: boolean; pet?: string | null }): StoryState {
  const clean = name.trim().replace(/\s+/g, ' ').slice(0, 24) || 'Jaylen Carter';
  // The Clutch Gene (a secret relic): two grit before the first page.
  return { v: 2, seed, name: clean, style, hometown, hero: createHero(seed, clean, style), hype: 0, grit: (relics?.clutchGene ? 2 : 0) + (relics?.pet === 'turtle' ? 2 : 0), bonds: { dre: 1, ray: 0, ice: 0, maya: 2 }, flags: [], beat: SCRIPT[0].id, games: [], points: 0, done: false };
}

const NBA_BEAT = SCRIPT.find(b => b.kind === 'nba')!;
const beatIndex = (s: Pick<StoryState, 'beat'>) => SCRIPT.findIndex(b => b.id === s.beat);
/** The beat you're on (the NBA years once you're past the draft). */
export function currentBeat(s: StoryState): Beat {
  return SCRIPT[beatIndex(s)] ?? NBA_BEAT;
}

export function applyEffects(s: StoryState, e: Effects | undefined): StoryState {
  if (!e) return s;
  let hero = s.hero;
  for (const [cat, n] of Object.entries(e.train ?? {})) hero = trainHero(hero, cat as CategoryId, (n ?? 0) * TRAIN_STEP);
  const bonds = { ...s.bonds };
  for (const [p, n] of Object.entries(e.bond ?? {})) bonds[p as Person] = Math.max(-5, Math.min(6, (bonds[p as Person] ?? 0) + (n ?? 0)));
  return { ...s, hero, hype: Math.max(0, s.hype + (e.hype ?? 0)), grit: Math.max(0, s.grit + (e.grit ?? 0)), bonds, flags: e.flag && !s.flags.includes(e.flag) ? [...s.flags, e.flag] : s.flags };
}

/** Moves to the next beat, entering chapters (aging up) and skipping scenes that don't apply. */
function advance(s: StoryState): StoryState {
  let i = beatIndex(s) + 1;
  let next = s;
  for (;;) {
    const b = SCRIPT[i] ?? NBA_BEAT;
    next = { ...next, beat: b.id };
    if ((b.kind === 'scene' || b.kind === 'game') && b.when && !b.when(next)) { i++; continue; }
    if (b.kind === 'chapter') next = { ...next, hero: growUp(next.hero, Math.max(0, b.age - next.hero.age)) };
    if (b.kind === 'train') next = { ...next, points: b.points };
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
  const page: JournalEntry = { when: actLabel(s), title: b.title, pick: c.label, text: c.result, kind: 'choice' };
  return { ...advance(addJournal(applyEffects(s, c.effects), page)), last: c.result };
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
  const blurb = {
    blueblood: 'You pull on the State hat. The gym goes crazy.',
    midmajor: 'You pick Coastal Tech. "They gave me the keys," you tell the cameras.',
    overseas: 'Belgrade. Your mom cries for a different reason.',
    gleague: 'You sign your first pro contract at nineteen. Maya asks if you\'re rich now. "Kind of," you say.',
    juco: 'Harbor Community College. The gym goes quiet, then Ray starts clapping, and everybody follows.',
  }[path];
  const page: JournalEntry = { when: actLabel(s), title: b.title, pick: PATHS[path].name, text: blurb, kind: 'choice' };
  return { ...advance(addJournal({ ...s, path, hype: s.hype + PATHS[path].hype }, page)), last: blurb };
}

/** Pick on draft night, from how good you are and how loud your name is (and Ice's, who is always good). */
export function draftPick(s: StoryState): number | null {
  const score = (overall(s) - 58) * 2 + s.hype * 0.5 + (keyWins(s) / Math.max(6, s.games.length)) * 7.2 + (s.flags.includes('goodInterview') ? 2 : 0) + (s.flags.includes('finalFour') ? 3 : 0);
  if (score < -6) return null;
  return Math.max(1, Math.min(60, Math.round(31 - score)));
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
export function heroForGame(s: StoryState): PlayerSeason {
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
  const text = won ? b.win(next, game) : b.loss(next, game);
  next = addJournal(next, { when: actLabel(s), title: b.title, text: `${gameSummary(game)}. ${text}`, kind: 'game' });
  return { ...advance(next), last: text };
}

// ---------------------------------------------------------------- the ending of a classic story

export interface Ending {
  id: string; title: string; text: string; tier: 'legend' | 'star' | 'pro' | 'grinder';
  /** Ten years later: what became of you and the people on the road with you (the NBA years' endings). */
  epilogue?: string[];
}

/** The key games of the old scripted rookie year and Year Two (stories finished before the NBA years keep their endings). */
const CLASSIC_KEY = new Set(['g-state', 'g-final', 'g-ice', 'g-playoff', 'y2-ice', 'y2-final']);
const inYearTwo = (s: Pick<StoryState, 'flags'>) => s.flags.includes('yearTwo');

/** How a classic story (one that ended after the scripted rookie year) ended. */
export function classicEnding(s: StoryState): Ending {
  if (inYearTwo(s)) return yearTwoEnding(s);
  const key = s.games.filter(g => g.won && CLASSIC_KEY.has(g.beat)).length;
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

// ---------------------------------------------------------------- saving

export const STORY_KEY = 'cv-story';
export const STORY_ENDINGS_KEY = 'cv-story-endings';
export function loadStory(): StoryState | null {
  try { return migrateStory(JSON.parse(localStorage.getItem(STORY_KEY) ?? 'null')); } catch { return null; }
}

/** The beats of the first Story Mode (saves kept the beat's position, not its name). */
const V1_BEATS = ['c1', 'park', 'g-park', 'party', 't1', 'c2', 'tryout', 'g-opener', 'dre-grades', 'g-westside', 'stars', 'g-state', 't2', 'c3', 'path', 'campus', 'belgrade', 't3', 'g-college', 'g-final', 'c4', 'interview', 'draft',
  'c5', 'vet', 'g-debut', 'dre-call', 't4', 'g-ice', 'g-playoff', 'end', 'c6', 'y2-deal', 't6', 'y2-open', 'y2-ray', 'y2-ice', 't7', 'y2-final', 'end2'];
/**
 * A saved story, brought up to date. A first-version story still on the road to the NBA carries on where it was; one
 * already in the scripted rookie year (or Year Two) moves into the real league; a finished one stays finished (with
 * the option to take that player into the real NBA).
 */
export function migrateStory(raw: unknown): StoryState | null {
  const r = raw as (Omit<Partial<StoryState>, 'v'> & { v?: number; at?: number }) | null;
  if (!r || typeof r !== 'object' || !r.hero || !Array.isArray(r.games)) return null;
  // Maya joined the story later: older saves meet her as a little sister who is close to you.
  if (r.v === 2 && typeof r.beat === 'string') return { ...(r as StoryState), bonds: { ...(r as StoryState).bonds, maya: (r as StoryState).bonds.maya ?? 2 } };
  if (r.v !== 1 || typeof r.at !== 'number') return null;
  const { at, ...rest } = r;
  const id = V1_BEATS[Math.max(0, Math.min(V1_BEATS.length - 1, at))];
  const onTheRoad = SCRIPT.some(b => b.id === id && b.kind !== 'nba');
  const bonds = { ...(rest as StoryState).bonds, maya: (rest as StoryState).bonds.maya ?? 2 };
  if (onTheRoad && !r.done) return { ...(rest as StoryState), bonds, v: 2, beat: id };
  return { ...(rest as StoryState), bonds, v: 2, beat: 'nba', points: 0, ...(r.done ? { classic: true } : {}) };
}
export function saveStory(s: StoryState | null): void {
  try { if (s) localStorage.setItem(STORY_KEY, JSON.stringify(s)); else localStorage.removeItem(STORY_KEY); } catch { /* storage blocked */ }
}
export interface StoryEndings { finished: number; tiers: Partial<Record<Ending['tier'], number>>; ids?: Record<string, number> }
export function loadEndings(): StoryEndings {
  try { const r = JSON.parse(localStorage.getItem(STORY_ENDINGS_KEY) ?? 'null') as StoryEndings | null; if (r && Number.isFinite(r.finished)) return { finished: r.finished, tiers: r.tiers ?? {}, ids: r.ids ?? {} }; } catch { /* fall through */ }
  return { finished: 0, tiers: {} };
}
export function recordEnding(t: Ending['tier'], id?: string): StoryEndings {
  const r = loadEndings();
  const ids = id ? { ...r.ids, [id]: (r.ids?.[id] ?? 0) + 1 } : r.ids;
  const next = { finished: r.finished + 1, tiers: { ...r.tiers, [t]: (r.tiers[t] ?? 0) + 1 }, ids };
  try { localStorage.setItem(STORY_ENDINGS_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
  return next;
}
const actLabel = (s: StoryState) => { const ch = chapterOf(s); return ch ? `Act ${ch.act} · ${ch.title}` : ''; };
export const chapterOf = (s: StoryState) => [...SCRIPT.slice(0, (beatIndex(s) < 0 ? SCRIPT.length : beatIndex(s)) + 1)].reverse().find((b): b is Extract<Beat, { kind: 'chapter' }> => b.kind === 'chapter');
