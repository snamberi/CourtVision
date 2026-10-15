import type { Effects, StoryGame } from './story';
import type { TradeWish } from '../career/career';
import type { NbaCtx, NbaStop } from './storyNba';

/*
 * What happens in the NBA years: the cards (a scene with choices) each stop can draw, and the key games. A card shows
 * once per career unless it `repeat`s; `when` reads the real league (his team's record, his numbers, Ice) through the
 * context; `first` cards jump the queue when they apply (the beats of a story that must not be missed).
 */

export interface NbaChoice {
  id: string; label: string; result: string | ((c: NbaCtx) => string); effects?: Effects;
  /** Ask for a trade (to this kind of team). */
  trade?: TradeWish;
  /** Sign the extension his team offers (see NbaCtx.contract). */
  contract?: 'extend';
}
export interface NbaCard { id: string; stops: NbaStop[]; title: string; when?: (c: NbaCtx) => boolean; first?: boolean; repeat?: boolean; weight?: number; text: (c: NbaCtx) => string; choices: (c: NbaCtx) => NbaChoice[] }
export interface NbaGameDef { id: string; title: (c: NbaCtx) => string; stakes: (c: NbaCtx) => string; win: (c: NbaCtx, g: StoryGame) => string; loss: (c: NbaCtx, g: StoryGame) => string; reward?: { win?: Effects; loss?: Effects } }

const rec = (c: NbaCtx) => `${c.w}-${c.l}`;
const money = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;
const lostLastYear = (c: NbaCtx) => !!c.lastRecord && c.lastRecord.w < c.lastRecord.l;
const winning = (c: NbaCtx) => c.w > c.l;

export const NBA_CARDS: NbaCard[] = [
  // ---------------------------------------------------------------- training camp
  { id: 'vet', stops: ['camp'], first: true, title: 'The Veteran', when: c => c.year === 1,
    text: c => `First practice with ${c.teamName}. A thirteen-year veteran with two rings watches you get torched in a shell drill. Afterwards he sits next to you. "You want the short version or the long version?"`,
    choices: () => [
      { id: 'long', label: '"The long version."', result: 'Two hours on footwork, film and how to sleep on a plane. You take notes on your phone.', effects: { train: { iq: 2 }, grit: 1 } },
      { id: 'short', label: '"I got it, OG. I\'m good."', result: '"Okay," he says, and never offers again.', effects: { hype: 1 } },
      { id: 'body', label: '"Teach me how you lasted thirteen years."', result: 'His trainer, his diet, his ice baths. Your body feels five years older and five years better.', effects: { train: { body: 2, athleticism: 1 } } },
    ] },
  { id: 'camp-role', stops: ['camp'], repeat: true, title: 'The Coach\'s Office', when: c => c.year >= 2,
    text: c => `Camp opens in ${c.season}. The coach of ${c.teamName} closes the door. "Big year. ${c.ovr >= 75 ? 'This is your team now.' : c.ovr >= 65 ? 'You\'re in the mix for a starting spot.' : 'Minutes are going to be tight.'} What do you want from this season?"`,
    choices: c => [
      { id: 'start', label: c.ovr >= 75 ? '"Put the ball in my hands at the end of games."' : '"Start me. I\'ll earn it."', result: 'He nods slowly. "Then earn it every night."', effects: { hype: 1, grit: 1 } },
      { id: 'team', label: '"Whatever helps us win."', result: 'Your teammates hear about that one. The locker room gets a little warmer.', effects: { grit: 1, bond: { ray: 1 } } },
      { id: 'work', label: '"Give me the worst minutes. I\'ll make them count."', result: 'You spend camp guarding the best scorer on the roster. You get better at it.', effects: { train: { perimeterD: 1, iq: 1 } } },
    ] },
  { id: 'camp-rookie', stops: ['camp'], title: 'The Long Version', when: c => c.year >= 6,
    text: () => 'A rookie gets torched in the shell drill and sits down next to you after practice, staring at the floor. It takes you a second to realise: you\'re the veteran now.',
    choices: () => [
      { id: 'long', label: 'Give him the long version.', result: 'Two hours on footwork and film. He takes notes on his phone. Somewhere, your old vet is laughing.', effects: { grit: 1, train: { iq: 1 } } },
      { id: 'workout', label: 'Bring him to your 6 AM workout.', result: 'He throws up in the first hour and comes back the next day. Good sign.', effects: { train: { athleticism: 1 }, grit: 1 } },
      { id: 'joke', label: '"Welcome to the league, kid."', result: 'He laughs. So do you. Some lessons you have to learn on your own.', effects: { hype: 1 } },
    ] },
  { id: 'camp-body', stops: ['camp'], title: 'Your Body Talks Back', when: c => c.age >= 30,
    text: c => `Age ${c.age}. Getting out of bed takes two tries now. The training staff has a plan for you, and so does your pride.`,
    choices: () => [
      { id: 'yoga', label: 'Yoga, ice baths and a new diet.', result: 'You haven\'t felt this loose in five years.', effects: { train: { body: 2 } } },
      { id: 'legs', label: 'Hard sprints. Prove you still have it.', result: 'Your legs hate you for a week. Then they wake up.', effects: { train: { athleticism: 1 }, grit: 1 } },
      { id: 'mind', label: 'Play smarter, not harder.', result: 'You study film like a coach. You start seeing plays before they happen.', effects: { train: { iq: 2 } } },
    ] },

  // ---------------------------------------------------------------- November
  { id: 'dre-call', stops: ['early'], first: true, title: 'A Call From Home', when: c => c.year === 1,
    text: c => `Dre calls at 2 AM. ${c.s.bonds.dre >= 3 ? '"I need a favor, brother. I lost my job."' : '"Hey. I know we haven\'t talked. I lost my job."'} He sounds like he hasn't slept.`,
    choices: c => [
      { id: 'hire', label: 'Hire him to run your camps back home.', result: 'Dre runs the best youth camp in the city. Two hundred kids from Carver Park learn your name and his.', effects: { bond: { dre: 3 }, hype: 1, flag: 'dreCamp' } },
      { id: 'money', label: 'Send money. Lots of it.', result: 'It helps. It isn\'t the same as being there.', effects: { bond: { dre: 1 } } },
      ...(c.s.bonds.dre < 1 ? [{ id: 'ignore', label: 'Let it go to voicemail.', result: 'You tell yourself you\'re focused. Ray hears about it.', effects: { bond: { dre: -2, ray: -1 }, train: { threePoint: 1 } } }] : []),
    ] },
  { id: 'early-slump', stops: ['early', 'stretch'], repeat: true, weight: 2, title: 'The Slump', when: c => c.gp >= 5 && c.ppg < 10,
    text: c => `${c.ppg} points a game. ${c.teamName} are ${rec(c)} and somebody on TV says you're "not an NBA player". Your shot feels like it belongs to someone else.`,
    choices: () => [
      { id: 'shots', label: '500 extra shots a night.', result: 'By the end of the week the ball starts going in again.', effects: { train: { threePoint: 1, midRange: 1 } } },
      { id: 'film', label: 'Watch every miss on film.', result: 'Your elbow drifts on tired legs. Fixed.', effects: { train: { iq: 1, midRange: 1 } } },
      { id: 'ray', label: 'Call Coach Ray.', result: '"You\'re thinking too much," he says. "Play." He\'s right. He\'s always right.', effects: { bond: { ray: 1 }, grit: 1 } },
    ] },
  { id: 'early-hot', stops: ['early', 'stretch'], repeat: true, weight: 2, title: 'On Fire', when: c => c.gp >= 5 && c.ppg >= 18,
    text: c => `${c.ppg} points a game and ${c.teamName} are ${rec(c)}. Your highlights are everywhere. A reporter asks if you're the best player in the league yet.`,
    choices: () => [
      { id: 'humble', label: '"Ask me in April."', result: 'The quote runs everywhere. Coaches love it.', effects: { grit: 1 } },
      { id: 'loud', label: '"Yeah. Next question."', result: 'It breaks the internet for a day. Every opponent has it on their locker-room board.', effects: { hype: 2, bond: { ice: -1 } } },
      { id: 'team', label: 'Give all the credit to your teammates.', result: 'Your point guard sends you a screenshot of the quote with ten heart emojis.', effects: { hype: 1, grit: 1 } },
    ] },
  { id: 'early-podcast', stops: ['early'], repeat: true, title: 'The Podcast', when: c => c.year >= 2,
    text: () => 'The biggest basketball podcast in the country wants you for an hour. Your agent says yes. Your coach says you have film at the same time.',
    choices: () => [
      { id: 'go', label: 'Do the podcast.', result: 'You tell the Carver Park story. A million people listen.', effects: { hype: 2 } },
      { id: 'film', label: 'Film session.', result: 'The coach notices who showed up.', effects: { train: { iq: 1 }, grit: 1 } },
      { id: 'dre', label: 'Send Dre in your place.', result: 'Dre is hilarious. The podcast asks him back. You are now the second-most famous person from Carver Park.', effects: { bond: { dre: 2 }, hype: 1 } },
    ] },
  { id: 'early-injury', stops: ['early', 'stretch'], title: 'The Ankle', when: c => c.year >= 3 && c.gp >= 5,
    text: () => 'You land on someone\'s foot in the second quarter and feel it go. The X-ray is clean, the swelling isn\'t. The trainer says two weeks. You say two days.',
    choices: () => [
      { id: 'rest', label: 'Listen to the trainer.', result: 'Two boring weeks. You come back with fresh legs.', effects: { train: { body: 1 } } },
      { id: 'play', label: 'Tape it and play.', result: 'You play on one leg and it hurts all month. The crowd loves you for it.', effects: { grit: 2, hype: 1 } },
      { id: 'film', label: 'Spend the two weeks studying film.', result: 'You come back seeing the floor differently.', effects: { train: { iq: 2 } } },
    ] },

  // ---------------------------------------------------------------- Christmas (when there is no big game)
  { id: 'xmas-home', stops: ['christmas'], repeat: true, title: 'Christmas',
    text: c => `${c.teamName} aren't on the Christmas schedule this year. You have two days off and a team charter at noon on the 26th.`,
    choices: () => [
      { id: 'family', label: 'Fly your mom and Dre out.', result: 'Your mom cooks for the whole team. Three rookies cry.', effects: { bond: { dre: 1 }, hype: 1 } },
      { id: 'toys', label: 'Toy drive at Carver Park.', result: 'Four hundred kids, one tired Santa (you), and Coach Ray handing out cocoa.', effects: { bond: { ray: 1 }, hype: 1 } },
      { id: 'gym', label: 'An empty gym on Christmas morning.', result: 'Just you, a rack of balls and the sound of the net.', effects: { train: { threePoint: 1 }, grit: 1 } },
    ] },

  // ---------------------------------------------------------------- the trade deadline
  { id: 'deadline-rumor', stops: ['deadline'], repeat: true, weight: 2, title: 'Trade Rumors', when: c => c.l > c.w + 3,
    text: c => `${c.teamName} are ${rec(c)} and your name is all over the trade rumors. Your agent calls: "If you want out, now is when we say it."`,
    choices: () => [
      { id: 'contender', label: '"Get me to a contender."', result: 'Your agent makes three phone calls.', trade: 'contender', effects: { hype: 1, bond: { ray: -1 } } },
      { id: 'role', label: '"Get me somewhere I\'ll play."', result: 'Your agent makes the call.', trade: 'role' },
      { id: 'stay', label: '"I\'m not going anywhere. We fix this together."', result: 'The GM calls you that night to say thank you. The fans make a banner.', effects: { grit: 2 } },
    ] },
  { id: 'deadline-allin', stops: ['deadline'], repeat: true, title: 'All In', when: c => c.w >= c.l + 6,
    text: c => `${c.teamName} are ${rec(c)} and the front office wants to go all in. The GM asks what you think the team needs.`,
    choices: () => [
      { id: 'shooter', label: '"Shooting. Give me spacing."', result: 'They bring in a veteran shooter. The floor opens up.', effects: { hype: 1 } },
      { id: 'stop', label: '"Nothing. Don\'t break up this locker room."', result: 'The GM stands pat. Your teammates find out what you said.', effects: { grit: 1 } },
      { id: 'me', label: '"Just keep giving me the ball."', result: 'The GM laughs. You were only half joking.', effects: { hype: 1, grit: -1 } },
    ] },
  { id: 'deadline-quiet', stops: ['deadline'], repeat: true, title: 'Deadline Day',
    text: c => `Deadline day comes and goes around the league. ${c.teamName} (${rec(c)}) make a small move and keep you. Your phone buzzes all afternoon anyway.`,
    choices: () => [
      { id: 'mute', label: 'Phone off. Gym.', result: 'The only thing you hear all day is the net.', effects: { train: { midRange: 1 }, grit: 1 } },
      { id: 'group', label: 'Group dinner with the team.', result: 'Somebody picks a restaurant that is way too expensive. Worth it.', effects: { grit: 1, hype: 1 } },
      { id: 'kids', label: 'Video call the Carver Park camp.', result: 'Sixty kids yell your name at once. Dre is the loudest.', effects: { bond: { dre: 1 } } },
    ] },

  // ---------------------------------------------------------------- the stretch run
  { id: 'stretch-race', stops: ['stretch'], repeat: true, weight: 2, title: 'The Playoff Race', when: c => c.rank != null && c.rank >= 5 && c.rank <= 11,
    text: c => `Twelve games left. ${c.teamName} are ${rec(c)}, ${c.rank}th in the conference. Every night is a playoff game now.`,
    choices: () => [
      { id: 'carry', label: '"Give me the ball. I\'ll carry us."', result: 'You take the last shot four nights in a row.', effects: { hype: 1, grit: 1 } },
      { id: 'meeting', label: 'Call a players-only meeting.', result: 'Nobody remembers what you said. Everybody remembers that you said it.', effects: { grit: 2 } },
      { id: 'rest', label: 'Trust the plan, save your legs.', result: 'Fresh legs in April are worth a lot.', effects: { train: { body: 1 } } },
    ] },
  { id: 'stretch-lottery', stops: ['stretch'], repeat: true, title: 'Playing for Pride', when: c => c.rank != null && c.rank > 11,
    text: c => `${c.teamName} are ${rec(c)} and out of it. The front office would not mind a few more losses. The kids on the roster are watching how you play.`,
    choices: () => [
      { id: 'hard', label: 'Play every minute like it matters.', result: 'You win four games nobody wanted you to win. Nobody tells you to stop.', effects: { grit: 2 } },
      { id: 'teach', label: 'Teach the young guys.', result: 'One of them hits his first game-winner and runs straight to you.', effects: { grit: 1, train: { iq: 1 } } },
      { id: 'rest', label: 'Rest the ankle. Next year matters.', result: 'You spend March in the training room and come out healthier than you went in.', effects: { train: { body: 1, athleticism: 1 } } },
    ] },
  { id: 'stretch-top', stops: ['stretch'], repeat: true, title: 'Top Seed', when: c => c.rank != null && c.rank <= 4,
    text: c => `${c.teamName} are ${rec(c)}. The coach wants to rest you for a week before the playoffs. You have never sat out a healthy game in your life.`,
    choices: () => [
      { id: 'rest', label: 'Take the rest.', result: 'Your legs will thank you in May.', effects: { train: { athleticism: 1 } } },
      { id: 'play', label: '"I play. Every game."', result: 'The crowd chants your name on a Tuesday in March.', effects: { hype: 1, grit: 1 } },
      { id: 'film', label: 'Rest, and study your playoff opponents.', result: 'You know their sets better than they do.', effects: { train: { iq: 1 }, grit: 1 } },
    ] },
  { id: 'y2-ray', stops: ['stretch', 'early'], first: true, title: 'Coach Ray', when: c => c.year === 2,
    text: c => `Ray is in the hospital. Nothing serious, the doctors say, but he's seventy-one. ${c.s.bonds.ray >= 2 ? 'He asks the nurses to put your game on.' : 'He doesn\'t call you. Dre does.'}`,
    choices: c => [
      { id: 'visit', label: 'Fly home between games.', result: 'Two flights, no sleep, an hour at his bedside. He talks about your footwork the whole time.', effects: { bond: { ray: 2 }, grit: 1 } },
      { id: 'game', label: 'Dedicate the next game to him.', result: 'You write his name on your shoes. The cameras find it.', effects: { hype: 1, flag: 'forRay' } },
      ...(c.s.bonds.ray < 1 ? [{ id: 'later', label: 'Tell yourself you\'ll call after the road trip.', result: 'The road trip is twelve days long.', effects: { bond: { ray: -1 }, train: { iq: 1 } } }] : []),
    ] },

  // ---------------------------------------------------------------- the summer
  { id: 'y2-deal', stops: ['summer'], first: true, title: 'The Offer', when: c => c.year === 1,
    text: () => 'Your agent slides two papers across the table. A sneaker company wants you as the face of a new line. A smaller deal would let you spend the summer in the gym instead of on a press tour.',
    choices: () => [
      { id: 'shoe', label: 'Sign the shoe deal.', result: 'Your logo, your colorway, your name on a box. You spend June on planes, not on the court.', effects: { hype: 3, grit: -1 } },
      { id: 'gym', label: 'Take the small deal. Gym all summer.', result: 'Six a.m. every day at Carver Park. The kids start showing up at 5:45 to watch.', effects: { grit: 2, train: { athleticism: 1, body: 1 } } },
      { id: 'dre', label: 'Make Dre your business manager first.', result: 'Dre negotiates like he plays defense: annoying and effective. The deal gets better.', effects: { bond: { dre: 2 }, hype: 1 } },
    ] },
  { id: 'summer-camp', stops: ['summer'], repeat: true, title: 'Carver Park',
    text: c => `Summer in ${c.s.hometown}. The court at Carver Park has new nets now (you paid for them). Two hundred kids signed up for the camp.`,
    choices: () => [
      { id: 'coach', label: 'Coach the camp yourself all week.', result: 'One kid crosses you over. You tell him you let him. You did not let him.', effects: { bond: { dre: 1 }, hype: 1 } },
      { id: 'run', label: 'Run with the old crew at night.', result: 'No refs, no cameras, no nets for the first three days. Just like before.', effects: { grit: 1, train: { finishing: 1 } } },
      { id: 'rest', label: 'A real vacation for once.', result: 'Two weeks somewhere with no basketball. You come back hungry.', effects: { train: { body: 1 } } },
    ] },
  { id: 'summer-national', stops: ['summer'], title: 'The National Team', when: c => c.ovr >= 76,
    text: c => `The national team calls. A summer of practices with the best players in the country${c.ice ? `, Ice included` : ''}, and a gold medal on the line.`,
    choices: c => [
      { id: 'yes', label: 'Say yes.', result: 'A summer with the best. You steal three moves and one gold medal.', effects: { hype: 2, train: { iq: 1 }, ...(c.ice ? { bond: { ice: 1 } } : {}) } },
      { id: 'no', label: 'Rest instead.', result: 'Your body thanks you. Twitter does not.', effects: { train: { body: 1, athleticism: 1 } } },
    ] },
  { id: 'summer-ice', stops: ['summer'], title: 'Ice Calls', when: c => !!c.ice && c.year >= 3,
    text: c => `Your phone lights up: Marcus Vance. ${c.s.bonds.ice >= 1 ? '"Run at Carver Park on Saturday? Like old times."' : '"You still think you\'re better than me?"'}`,
    choices: c => [
      { id: 'run', label: 'Show up Saturday.', result: 'A hundred people on the fences by noon. You win, then he wins, then it gets dark. Nobody keeps score of the third game.', effects: { bond: { ice: 2 }, hype: 1 } },
      { id: 'talk', label: c.s.bonds.ice >= 1 ? 'Call him back. Just talk.' : '"Every day of the week."', result: c.s.bonds.ice >= 1 ? 'Two hours about everything but basketball.' : 'He sends back a laughing emoji. The rivalry is fine.', effects: c.s.bonds.ice >= 1 ? { bond: { ice: 1 } } : { hype: 1, bond: { ice: -1 } } },
      { id: 'ignore', label: 'Leave him on read.', result: 'He posts a clip of himself at Carver Park. You watch it eleven times.', effects: { grit: 1 } },
    ] },
  { id: 'summer-ray', stops: ['summer'], title: 'Ray\'s Last Summer', when: c => c.year >= 6,
    text: () => 'Coach Ray is retiring from the rec center after forty years. They\'re throwing a party in the gym where you learned your left hand.',
    choices: c => [
      { id: 'speech', label: 'Give the speech.', result: 'You make it four sentences in before your voice goes. Ray pretends not to cry.', effects: { bond: { ray: 2 } } },
      { id: 'gym', label: 'Pay to rebuild the gym and name it after him.', result: 'The Ray Mitchell Gym opens in the fall. He stands under the sign for an hour.', effects: { bond: { ray: 3 }, hype: 1 } },
      ...(c.s.bonds.ray < 1 ? [{ id: 'skip', label: 'You have a workout that day.', result: 'Dre sends you a video of the party. Ray asked where you were.', effects: { bond: { ray: -2 }, grit: 1 } }] : []),
    ] },
  { id: 'summer-late', stops: ['summer'], repeat: true, title: 'How Much Longer?', when: c => c.age >= 33,
    text: c => `Age ${c.age}. Season ${c.year + 1} of fifteen is next. Every summer the young guys are faster and you are smarter.`,
    choices: () => [
      { id: 'all', label: 'Train like a rookie one more summer.', result: 'Two-a-days in August. You feel 28. Mostly.', effects: { train: { athleticism: 1, body: 1 } } },
      { id: 'craft', label: 'Add one new move to your game.', result: 'A step-back you\'ve never shown anybody. Wait until October.', effects: { train: { midRange: 1, iq: 1 } } },
      { id: 'mentor', label: 'Spend it with the kids at Carver Park.', result: 'You find yourself saying Ray\'s lines word for word.', effects: { bond: { ray: 1, dre: 1 } } },
    ] },

  // ---------------------------------------------------------------- contracts and the business
  { id: 'contract-extension', stops: ['summer'], first: true, repeat: true, title: 'The Extension', when: c => !!c.contract && c.contract.years === 1 && !c.contract.extended && c.ovr >= 58,
    text: c => `Your deal with ${c.teamName} runs out after this season. They want to keep you: ${c.contract!.supermax ? 'the SUPERMAX, ' : ''}${c.contract!.supermax ? 5 : 4} more years at ${money(c.contract!.offer)} a year. Your agent says you might get more as a free agent. Or less.`,
    choices: c => [
      { id: 'sign', label: `Sign it. ${c.teamName} is home.`, result: c2 => `You sign at the podium with your mom next to you. ${c2.contract?.supermax ? 'The biggest contract in the history of the franchise.' : 'Security, and a city that believes in you.'}`, contract: 'extend', effects: { grit: 1, bond: { dre: 1 } } },
      { id: 'bet', label: 'Bet on yourself. Free agency next summer.', result: 'Your agent grins. Every game this season is an audition now.', effects: { hype: 1, grit: 1 } },
      ...(lostLastYear(c) ? [{ id: 'out', label: '"Trade me somewhere I can win."', result: 'Your agent makes the call.', trade: 'contender' as const, effects: { hype: 1 } }] : []),
    ] },
  { id: 'summer-unhappy', stops: ['summer'], title: 'Losing Season', when: c => c.year >= 3 && c.ovr >= 70 && lostLastYear(c),
    text: c => `${c.teamName} went ${c.lastRecord!.w}-${c.lastRecord!.l}. You did everything you could. The talk shows want to know if you're asking out.`,
    choices: () => [
      { id: 'out', label: 'Ask for a trade to a contender.', result: 'It is the hardest phone call you have ever made.', trade: 'contender', effects: { hype: 1 } },
      { id: 'lead', label: '"I\'m staying. We build it here."', result: 'The fans make a mural of you outside the arena.', effects: { grit: 2, hype: 1 } },
      { id: 'help', label: 'Tell the GM you need help, publicly.', result: 'Two days later the team trades for a starter. Message received.', effects: { hype: 1, grit: -1 } },
    ] },
  { id: 'ring-chase', stops: ['summer'], title: 'Chasing a Ring', when: c => c.age >= 31 && !c.s.flags.includes('champion') && !!c.lastRecord && c.lastRecord.w < c.lastRecord.l + 10,
    text: c => `Age ${c.age}, no ring yet. Three contenders call your agent the day free agency opens. ${c.teamName} says you're the face of the franchise.`,
    choices: c => [
      { id: 'chase', label: 'Go where you can win it all.', result: 'Your old fans boo you for a year and cheer for you forever.', trade: 'contender', effects: { hype: 1 } },
      { id: 'stay', label: `Win it with ${c.teamName} or not at all.`, result: 'Some rings are worth more because they are harder.', effects: { grit: 2, bond: { ray: 1 } } },
      { id: 'ray', label: 'Ask Coach Ray what he thinks.', result: '"A ring is a ring," he says. "But home is home." He doesn\'t tell you which one to pick.', effects: { bond: { ray: 1 }, grit: 1 } },
    ] },

  // ---------------------------------------------------------------- things that just happen
  { id: 'sys-traded', stops: [], repeat: true, title: 'Traded',
    text: c => `Your phone buzzes at 6 AM. You've been traded to ${c.teamName}. Your locker is being packed while you read the news.`,
    choices: () => [
      { id: 'embrace', label: 'Fresh start. Let\'s go.', result: 'You\'re at your new team\'s practice facility by 3 PM.', effects: { grit: 1 } },
      { id: 'post', label: 'Post a thank-you to the old fans.', result: 'Your old city gives you a standing ovation the first time you come back.', effects: { hype: 1 } },
      { id: 'ray', label: 'Call Coach Ray.', result: '"A team that wants you," he says. "That\'s the only kind worth playing for."', effects: { bond: { ray: 1 } } },
    ] },
];

export const NBA_GAMES: NbaGameDef[] = [
  { id: 'debut', title: () => 'NBA Debut', stakes: c => `Opening night against ${c.next?.name ?? 'other team'}. ${c.s.draft?.pick && c.s.draft.pick <= 5 ? 'The arena chants your name when you check in.' : 'You check in late in the first quarter. Your mom is in section 112.'}`,
    win: (_, g) => `A win in your first NBA game. ${g.line.pts} points; you keep the ball from your first bucket.`,
    loss: (_, g) => `A loss, ${g.them}-${g.us}. ${g.line.pts ? `Your first NBA points come on a ${g.line.pts >= 10 ? 'night you\'ll remember' : 'quiet night'}.` : 'You don\'t score. Welcome to the league.'}`,
    reward: { win: { hype: 1 }, loss: { grit: 1 } } },
  { id: 'opener', title: c => `Opening Night, Season ${c.year}`, stakes: c => `Season ${c.year} starts against ${c.next?.name ?? 'other team'}. ${c.ovr >= 78 ? 'The whole league is chasing you now.' : 'Every season is a new chance to show them.'}`,
    win: (_, g) => `${g.us}-${g.them}. ${g.line.pts >= 25 ? `${g.line.pts} points to open the year. A statement.` : 'A win to start the year. That\'s the job.'}`,
    loss: (_, g) => `${g.them}-${g.us}. One game of eighty-two. You still go to the gym that night.`,
    reward: { win: { hype: 1 }, loss: { grit: 1 } } },
  { id: 'last-opener', title: () => 'The Last Opener', stakes: c => `Season fifteen. The last opening night. ${c.teamName} play a tribute video before tip-off, and you have to look at the ceiling for a while.`,
    win: (_, g) => `${g.us}-${g.them}, and the old man had ${g.line.pts}. One last ride.`,
    loss: (_, g) => `${g.them}-${g.us}. You stay on the floor after everyone leaves and shoot free throws in the empty arena.`,
    reward: { win: { hype: 1 }, loss: { grit: 1 } } },
  { id: 'christmas', title: () => 'Christmas Day', stakes: c => `National TV on Christmas Day: ${c.teamName} (${rec(c)}) against ${c.next?.name ?? 'other team'}. ${winning(c) ? 'The league puts its best teams on Christmas. That\'s you now.' : 'Somebody at the league office believes in you.'}`,
    win: (_, g) => `${g.us}-${g.them} on Christmas Day. ${g.line.pts >= 25 ? `${g.line.pts} points with the whole country watching.` : 'Your mom watches it twice.'}`,
    loss: (_, g) => `${g.them}-${g.us}. Not the Christmas present you wanted.`,
    reward: { win: { hype: 2 }, loss: { grit: 1 } } },
  { id: 'ice', title: () => 'Ice', stakes: c => `${c.ice?.teamName ?? 'Ice\'s team'} and Marcus "Ice" Vance${c.ice ? ` (${c.ice.ppg} points a game)` : ''}. ${c.s.bonds.ice >= 1 ? 'He texts you before tip-off: "Let\'s give them a show."' : c.s.bonds.ice <= -2 ? 'He hasn\'t said a word to you in years.' : 'Carver Park against Carver Park, again.'}`,
    win: (c, g) => `${g.us}-${g.them}. ${g.line.pts >= 20 ? `${g.line.pts} for you. ` : ''}Ice finds you after the buzzer. ${c.s.bonds.ice >= 0 ? '"Carver Park," he says, and laughs. "You were always annoying."' : 'He walks past you, then stops, and taps your chest twice. Respect.'}`,
    loss: (_, g) => `${g.them}-${g.us}. Ice wins this round. "There's always next time," he says. There always is.`,
    reward: { win: { hype: 2, bond: { ice: 1 }, flag: 'beatIce' }, loss: { grit: 2 } } },
];
