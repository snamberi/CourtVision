import type { NbaCard } from './storyNbaCards';
import type { NbaCtx } from './storyNba';

/*
 * The deck of the NBA years: what can happen around the games. Some cards are one-offs, some come back (`repeat`),
 * and some are chapters of longer stories told across seasons (Maya, Dre, Coach Ray, Mom, Ice, a teammate): a choice
 * sets a flag, and a later card in the chain checks it (and the bond) years afterwards.
 */

const has = (c: NbaCtx, flag: string) => c.s.flags.includes(flag);
const bond = (c: NbaCtx, who: 'dre' | 'ray' | 'ice' | 'maya') => c.s.bonds[who] ?? 0;
/** Who handles your business (chosen when you declared for the draft). */
const agent = (c: NbaCtx) => (has(c, 'dreManager') ? 'Your manager Dre' : has(c, 'agentLena') ? 'Your agent Lena' : 'Your agent Sal');

export const NBA_EVENTS: NbaCard[] = [
  // ---------------------------------------------------------------- Maya, your little sister
  { id: 'maya-varsity', stops: ['christmas', 'deadline'], first: true, title: 'Maya\'s First Game', when: c => c.year === 1,
    text: () => 'Your little sister Maya just got called up to varsity at Douglass, as a sophomore, like you. Her first game is tonight. You are two thousand miles away on a road trip.',
    choices: () => [
      { id: 'call', label: 'Video call from the team bus.', result: 'She scores 14 and holds the phone up to the crowd so you can hear it.', effects: { bond: { maya: 1 } } },
      { id: 'pizza', label: 'Send pizza for the whole team.', result: 'Douglass High has never been louder about pepperoni. Maya says you embarrassed her. She is smiling.', effects: { bond: { maya: 1 }, hype: 1 } },
      { id: 'fly', label: 'Fly home on the off day for her next one.', result: 'She hits a three right in front of you and points at your seat.', effects: { bond: { maya: 2 }, flag: 'mayaFan' } },
    ] },
  { id: 'maya-recruit', stops: ['summer'], first: true, title: 'Maya\'s Big Decision', when: c => c.year >= 2 && c.year <= 4,
    text: () => 'Twenty colleges want Maya. The kitchen table at home is covered in letters, the same way yours was. She asks what you would do.',
    choices: () => [
      { id: 'her', label: '"It\'s your road. Pick the one that feels like home."', result: 'She picks a school three hours from home, so Mom can drive to every game.', effects: { bond: { maya: 2 }, flag: 'mayaCollege' } },
      { id: 'big', label: '"Go where the cameras are. You\'re that good."', result: 'She signs with the biggest program in the country. The pressure starts immediately.', effects: { bond: { maya: 1 }, hype: 1, flag: 'mayaCollege' } },
      { id: 'ray', label: 'Ask Coach Ray to talk to her.', result: 'Ray tells her the same thing he told you: talent is cheap, work isn\'t. She picks the school with the hardest coach.', effects: { bond: { maya: 1, ray: 1 }, flag: 'mayaCollege' } },
    ] },
  { id: 'maya-tv', stops: ['early', 'stretch'], first: true, title: 'Maya on TV', when: c => has(c, 'mayaCollege') && c.year >= 4 && c.year <= 7,
    text: () => 'Maya\'s college game is on national TV tonight, right when your team has film.',
    choices: () => [
      { id: 'team', label: 'Put her game on in the locker room.', result: 'Your whole team ends up cheering for her. She finishes with 22 and the internet finds out you have a sister.', effects: { bond: { maya: 1 }, hype: 1 } },
      { id: 'film', label: 'Film first. Watch the replay later.', result: 'You watch it at 1 AM in the hotel. She was great.', effects: { train: { iq: 1 }, grit: 1 } },
      { id: 'post', label: 'Post her best play with three fire emojis.', result: 'It becomes the most-liked thing you have ever posted.', effects: { bond: { maya: 2 }, hype: 1 } },
    ] },
  { id: 'maya-draft', stops: ['summer'], first: true, title: 'Maya\'s Draft Night', when: c => has(c, 'mayaCollege') && c.year >= 6 && bond(c, 'maya') >= 1,
    text: () => 'Maya is projected to go in the first round of the WNBA Draft. She wants you there. She also wants it to be her night, not yours.',
    choices: () => [
      { id: 'there', label: 'Sit with the family. No interviews.', result: 'They call her name in the first round. You cry harder than she does.', effects: { bond: { maya: 3 }, flag: 'mayaPro' } },
      { id: 'suit', label: 'Give her your old draft-night suit, tailored for her.', result: 'She wears it. The photo of you two in the green room goes everywhere.', effects: { bond: { maya: 2 }, hype: 1, flag: 'mayaPro' } },
      { id: 'home', label: 'Watch from home so the cameras stay on her.', result: 'She calls you the second she walks off the stage.', effects: { bond: { maya: 1 }, grit: 1, flag: 'mayaPro' } },
    ] },
  { id: 'maya-pro', stops: ['christmas', 'summer'], first: true, title: 'Two Pros in the Family', when: c => has(c, 'mayaPro') && c.year >= 8,
    text: () => 'Maya is an All-Star in her own league now. A sneaker company wants the two of you in one commercial. Mom wants the two of you at dinner.',
    choices: () => [
      { id: 'ad', label: 'Shoot the commercial together.', result: 'She beats you at H-O-R-S-E on camera. They keep it in.', effects: { hype: 2, bond: { maya: 1 } } },
      { id: 'dinner', label: 'Dinner at Mom\'s first. Commercial later.', result: 'Mom makes the dish she made before every big game you two ever had.', effects: { bond: { maya: 2, dre: 1 } } },
      { id: 'court', label: 'Run one-on-one at Carver Park, like when she was eight.', result: 'You win. Barely. She says she let you.', effects: { bond: { maya: 2 }, grit: 1 } },
    ] },

  // ---------------------------------------------------------------- Dre
  { id: 'dre-camp', stops: ['summer'], first: true, title: 'Dre\'s Camp', when: c => has(c, 'dreCamp') && c.year >= 3,
    text: () => 'The camp Dre runs at Carver Park has a waiting list of four hundred kids. He needs a real gym, real coaches and a bus.',
    choices: () => [
      { id: 'gym', label: 'Build him a gym.', result: 'The Carver Park Center opens in October. Dre cuts the ribbon with oversized scissors and makes a speech that is way too long.', effects: { bond: { dre: 2 }, hype: 1, flag: 'dreGym' } },
      { id: 'grow', label: 'Help him grow it slowly, the right way.', result: 'Two new coaches, one bus, and a plan. Dre says it\'s the best advice you ever gave him.', effects: { bond: { dre: 1 }, grit: 1 } },
      { id: 'coach', label: 'Coach a full week there yourself.', result: 'Two hundred kids and one very tired NBA player. You love every minute.', effects: { bond: { dre: 1 }, hype: 1, train: { iq: 1 } } },
    ] },
  { id: 'dre-wedding', stops: ['summer'], first: true, title: 'Best Man', when: c => c.year >= 5 && bond(c, 'dre') >= 2,
    text: () => 'Dre is getting married and wants you as his best man. The wedding is the same weekend as your team\'s preseason trip.',
    choices: () => [
      { id: 'speech', label: 'Give the speech. The team can wait.', result: 'You tell the story about the party the night before your first summer workout. The whole room loses it.', effects: { bond: { dre: 3 }, grit: -1 } },
      { id: 'both', label: 'Fly back and forth to do both.', result: 'Four flights in three days. Worth every minute.', effects: { bond: { dre: 2 }, grit: 1 } },
      { id: 'gift', label: 'Send the best gift money can buy.', result: 'He sends a thank-you note. It\'s polite. It\'s short.', effects: { bond: { dre: -1 } } },
    ] },
  { id: 'dre-distant', stops: ['early', 'summer'], title: 'An Old Photo', when: c => c.year >= 3 && bond(c, 'dre') <= 0,
    text: () => 'Dre posts an old photo: two skinny kids at Carver Park, one ball, no nets. No caption.',
    choices: () => [
      { id: 'call', label: 'Call him. Right now.', result: 'Three hours. You both apologise for different things.', effects: { bond: { dre: 3 } } },
      { id: 'like', label: 'Like it and comment "the GOAT duo".', result: 'He likes your comment. It\'s a start.', effects: { bond: { dre: 1 } } },
      { id: 'skip', label: 'Scroll past.', result: 'You think about it at night for a week.', effects: { grit: 1 } },
    ] },
  { id: 'dre-store', stops: ['deadline'], title: 'Dre\'s Idea', when: c => c.year >= 8 && bond(c, 'dre') >= 3,
    text: () => 'Dre wants to start a youth league for the whole city, with real uniforms and real refs. He needs a partner, not a donor.',
    choices: () => [
      { id: 'partner', label: 'Partner up. Fifty-fifty.', result: 'The Carver League starts with thirty-two teams. Dre runs every meeting with a whistle.', effects: { bond: { dre: 2 }, hype: 1 } },
      { id: 'advise', label: 'Help him write the plan, then let him run it.', result: 'He runs it better than you could have.', effects: { bond: { dre: 1 }, train: { iq: 1 } } },
      { id: 'later', label: '"After I retire. I promise."', result: 'He says okay. He writes the date on his calendar.', effects: { grit: 1 } },
    ] },
  { id: 'dre-kid', stops: ['summer'], title: 'Little Dre', when: c => has(c, 'dreGym') && c.year >= 10,
    text: () => 'Dre\'s son is nine and only wants to play if Uncle (that\'s you) teaches him the left hand.',
    choices: () => [
      { id: 'teach', label: 'Teach him the left hand.', result: 'Same drills Ray taught you. He hates them. Then he doesn\'t.', effects: { bond: { dre: 2, ray: 1 } } },
      { id: 'game', label: 'Take him to one of your games.', result: 'He wears your jersey. It goes to his knees.', effects: { bond: { dre: 1 }, hype: 1 } },
      { id: 'shoes', label: 'Get him a pair of your shoes.', result: 'He sleeps in them for a week.', effects: { bond: { dre: 1 } } },
    ] },

  // ---------------------------------------------------------------- Coach Ray
  { id: 'ray-courtside', stops: ['stretch'], title: 'Ray Comes to Town', when: c => c.year >= 3 && bond(c, 'ray') >= 2,
    text: c => `Coach Ray flies in to watch you play live for the first time since high school. ${c.teamName} plays tonight.`,
    choices: () => [
      { id: 'seat', label: 'Courtside, right behind the bench.', result: 'He coaches the whole game from his seat. The refs know his name by the third quarter.', effects: { bond: { ray: 2 }, hype: 1 } },
      { id: 'dinner', label: 'Dinner after, just the two of you.', result: 'He orders the same thing he always ordered. He tells you you\'re still late on closeouts.', effects: { bond: { ray: 2 }, train: { perimeterD: 1 } } },
      { id: 'win', label: 'Win this one for him.', result: 'You play the way he taught you. He doesn\'t say anything after. He doesn\'t have to.', effects: { grit: 1, bond: { ray: 1 } } },
    ] },
  { id: 'ray-cold', stops: ['camp'], title: 'A Letter', when: c => c.year >= 3 && bond(c, 'ray') <= -1,
    text: () => 'You haven\'t talked to Coach Ray in two years. You find the first workout plan he ever wrote for you, folded in an old bag.',
    choices: () => [
      { id: 'letter', label: 'Write him a real letter.', result: 'He writes back on rec-center paper. Two lines: "Proud of you. Still late on closeouts."', effects: { bond: { ray: 3 } } },
      { id: 'invite', label: 'Invite him to a game.', result: 'He comes. He pretends he isn\'t emotional. He is.', effects: { bond: { ray: 2 } } },
      { id: 'keep', label: 'Keep the plan. Do the workout instead.', result: 'Three hundred makes before lunch. Some things don\'t change.', effects: { grit: 1, train: { midRange: 1 } } },
    ] },
  { id: 'ray-leader', stops: ['deadline'], title: 'Ray\'s Lesson', when: c => c.year >= 7 && bond(c, 'ray') >= 1,
    text: () => 'You call Ray after a bad loss and ask how to lead a locker room that has stopped listening.',
    choices: () => [
      { id: 'listen', label: 'Listen more than you talk.', result: '"Lead with the work," he says. "They\'ll follow the work." You stay late every day for a month. They notice.', effects: { grit: 2, bond: { ray: 1 } } },
      { id: 'speech', label: 'Write the speech together.', result: 'It\'s short. It works.', effects: { hype: 1, bond: { ray: 1 } } },
      { id: 'film', label: 'Ask him to watch your film.', result: 'He finds four things in ten minutes. You fix three.', effects: { train: { iq: 2 } } },
    ] },
  { id: 'ray-florida', stops: ['summer'], title: 'Ray Moves South', when: c => c.year >= 10 && c.n.seen.includes('summer-ray'),
    text: () => 'Coach Ray is moving to Florida to be near his grandkids. One last summer at the rec center.',
    choices: c => [
      { id: 'party', label: 'Throw him the biggest going-away party Carver Park has ever seen.', result: 'Three generations of kids he coached, one cake shaped like a basketball, and no dry eyes.', effects: { bond: { ray: 2 }, hype: 1 } },
      { id: 'drive', label: 'Drive him down yourself.', result: 'Two days, one car, a thousand stories. He sleeps through Georgia.', effects: { bond: { ray: 3 } } },
      ...(bond(c, 'ray') < 1 ? [{ id: 'card', label: 'Send a card.', result: 'He keeps it on his fridge. You never find out.', effects: { grit: 1 } }] : []),
    ] },

  // ---------------------------------------------------------------- Mom
  { id: 'mom-house', stops: ['summer'], title: 'Mom\'s House', when: c => c.year <= 2,
    text: c => `Your first real NBA paycheck clears. ${has(c, 'momPromise') ? 'The sticky note is still on your mirror back home: "Buy Mom a house." ' : ''}Your mom still works at the hospital and still lives in the apartment you grew up in.`,
    choices: () => [
      { id: 'house', label: 'Buy her the house she always pointed at.', result: 'She cries in the driveway. Then she makes you carry every box.', effects: { hype: 1, flag: 'momHouse' } },
      { id: 'choose', label: 'Give her the money and let her choose.', result: 'She pays off her sister\'s house first. That\'s Mom.', effects: { grit: 1, flag: 'momHouse' } },
      { id: 'stay', label: 'She says she likes the apartment. Fix it up instead.', result: 'New kitchen, new windows, same neighbours. She\'s happy.', effects: { bond: { dre: 1 }, flag: 'momHouse' } },
    ] },
  { id: 'mom-birthday', stops: ['early', 'stretch'], title: 'Mom\'s Birthday', when: c => c.year >= 4,
    text: () => 'It\'s Mom\'s birthday and you have a home game.',
    choices: () => [
      { id: 'fly', label: 'Fly her in. Front row.', result: 'The arena sings happy birthday during a timeout. She pretends to be embarrassed.', effects: { hype: 1, bond: { maya: 1 } } },
      { id: 'dedicate', label: 'Write her name on your shoes.', result: 'She frames the shoes.', effects: { grit: 1 } },
      { id: 'call', label: 'Call her before tip-off.', result: '"Defense," she says, and hangs up. Same as always.', effects: { train: { perimeterD: 1 } } },
    ] },
  { id: 'mom-retires', stops: ['summer'], title: 'Mom Retires', when: c => has(c, 'momHouse') && c.year >= 9,
    text: () => 'After thirty years at the hospital, Mom is retiring. The nurses are throwing a party.',
    choices: () => [
      { id: 'party', label: 'Show up and surprise everyone.', result: 'You sign autographs for every nurse on the ward. Mom tells everyone you were a terrible patient as a kid.', effects: { hype: 1, bond: { maya: 1 } } },
      { id: 'trip', label: 'Send her and Maya on the trip she always talked about.', result: 'Postcards from four countries. Maya beat Mom at every game of cards.', effects: { bond: { maya: 2 } } },
      { id: 'wing', label: 'Fund a new children\'s wing in her name.', result: 'There\'s a plaque. Mom touches it every time she visits.', effects: { hype: 2 } },
    ] },

  // ---------------------------------------------------------------- the agent and the business
  { id: 'agent-commercial', stops: ['early'], repeat: true, title: 'The Commercial', when: c => c.year >= 2 && c.s.hype >= 6,
    text: c => `${agent(c)} has a national commercial for you: one day of shooting on your only off day this month.`,
    choices: () => [
      { id: 'shoot', label: 'Shoot it.', result: 'Twelve hours of pretending to dunk on a man in a cereal costume. You\'re on every TV by Friday.', effects: { hype: 2, grit: -1 } },
      { id: 'rest', label: 'Turn it down. You need the rest.', result: 'Sal sighs loudly into the phone. Your legs thank you.', effects: { train: { body: 1 } } },
      { id: 'team', label: 'Only if your teammates are in it too.', result: 'The whole starting five in matching cereal costumes. Team chemistry: excellent.', effects: { hype: 1, grit: 1 } },
    ] },
  { id: 'agent-cover', stops: ['summer'], title: 'The Cover', when: c => c.year >= 3 && c.ovr >= 74,
    text: () => 'You\'re on the cover of the biggest basketball video game in the world. Your little cousins have already asked for twelve copies.',
    choices: () => [
      { id: 'yes', label: 'Say yes. Ask for a 99 rating.', result: 'They give you a 96. You are furious about the 96.', effects: { hype: 3 } },
      { id: 'carver', label: 'Only if Carver Park is in the game.', result: 'It is. Kids around the world learn there\'s a court with no nets in your hometown.', effects: { hype: 2, bond: { dre: 1 } } },
      { id: 'teammate', label: 'Give the cover to a teammate who deserves it.', result: 'He never forgets it.', effects: { grit: 2 } },
    ] },
  { id: 'agent-shoe', stops: ['camp'], title: 'Your Own Shoe', when: c => c.year >= 4 && c.s.hype >= 12,
    text: () => 'Your signature shoe is coming out. The design team needs one decision: the first colorway.',
    choices: () => [
      { id: 'carver', label: 'Carver Park colors: cracked blacktop gray and rec-center orange.', result: 'It sells out in four minutes. Dre gets the first pair.', effects: { hype: 2, bond: { dre: 1 } } },
      { id: 'maya', label: 'Let Maya design it.', result: 'She puts a tiny drawing of the two of you on the tongue. It\'s the best one.', effects: { hype: 1, bond: { maya: 2 } } },
      { id: 'kids', label: 'Make them cheap enough for every kid at the park.', result: 'The shoe company grumbles. Every kid at Carver Park has a pair by spring.', effects: { hype: 1, grit: 1, bond: { ray: 1 } } },
    ] },
  { id: 'agent-noise', stops: ['deadline', 'stretch'], repeat: true, title: 'The Internet', when: c => c.year >= 2,
    text: () => 'You had a bad game last night and the internet decided you\'re washed. A clip of your airball has four million views.',
    choices: () => [
      { id: 'off', label: 'Delete the apps for a week.', result: 'The best week of the season.', effects: { grit: 1, train: { threePoint: 1 } } },
      { id: 'joke', label: 'Post the airball yourself: "working on it".', result: 'The internet decides you\'re funny now.', effects: { hype: 1 } },
      { id: 'answer', label: 'Answer the loudest critic.', result: 'You win the argument. You lose the afternoon.', effects: { hype: 1, grit: -1 } },
    ] },

  // ---------------------------------------------------------------- teammates
  { id: 'mate-theo', stops: ['camp'], title: 'Theo', when: c => c.year >= 2 && c.year <= 5,
    text: () => 'Theo Banks, your quiet backup point guard, is at the gym every morning before you. He never says much. He sees everything.',
    choices: () => [
      { id: 'work', label: 'Ask him to work out together.', result: 'Six a.m. every day. By December you can find each other blind.', effects: { train: { playmaking: 1, iq: 1 }, flag: 'theo' } },
      { id: 'dinner', label: 'Invite him to dinner with the team.', result: 'He talks for three hours. He\'s hilarious. Who knew.', effects: { grit: 1, flag: 'theo' } },
      { id: 'nod', label: 'Nod and keep to your routine.', result: 'He nods back. Respect.', effects: { train: { midRange: 1 } } },
    ] },
  { id: 'mate-theo-traded', stops: ['deadline'], title: 'Theo Is Traded', when: c => has(c, 'theo') && c.year >= 3,
    text: () => 'Deadline day: Theo is traded across the country. He finds out in the middle of practice.',
    choices: () => [
      { id: 'help', label: 'Help him pack. Drive him to the airport.', result: 'He doesn\'t say much. At the gate he hugs you for a long time.', effects: { grit: 1 } },
      { id: 'gm', label: 'Tell the GM what you think of it.', result: 'The GM listens. The trade still happens. The GM remembers.', effects: { hype: 1, grit: -1 } },
      { id: 'game', label: 'Win the next one for him.', result: 'You dedicate the game to him. He watches from his new team\'s hotel and texts you a single fist emoji.', effects: { grit: 1, hype: 1 } },
    ] },
  { id: 'mate-mistake', stops: ['stretch'], title: 'The Mistake', when: c => c.year >= 4,
    text: () => 'A rookie teammate misses a defensive assignment in the last ten seconds and the other team wins. He sits at his locker with a towel over his head.',
    choices: () => [
      { id: 'public', label: 'Tell the reporters the loss is on you.', result: 'The rookie reads the quote. He plays like a different person the next night.', effects: { grit: 2 } },
      { id: 'private', label: 'Sit with him. Watch the play together.', result: 'He never misses that assignment again.', effects: { grit: 1, train: { iq: 1 } } },
      { id: 'honest', label: 'Tell him straight: "That can\'t happen."', result: 'He nods. It stings. It also works.', effects: { hype: 1 } },
    ] },
  { id: 'mate-star', stops: ['deadline'], title: 'A New Star', when: c => c.year >= 4 && c.w > c.l,
    text: c => `${c.teamName} trades for another star. The ball is going to be shared now.`,
    choices: () => [
      { id: 'welcome', label: 'Pick him up at the airport.', result: 'Two stars, one ride, zero ego. The league notices.', effects: { grit: 1, hype: 1 } },
      { id: 'touches', label: 'Tell the coach you still want the last shot.', result: 'The coach says it depends on the night. You make sure it\'s your night.', effects: { hype: 1 } },
      { id: 'adapt', label: 'Work on playing off the ball.', result: 'You become dangerous without the ball. Your three-point numbers go up.', effects: { train: { threePoint: 1, iq: 1 } } },
    ] },

  // ---------------------------------------------------------------- Ice
  { id: 'ice-hurt', stops: ['early', 'stretch'], title: 'Ice Goes Down', when: c => !!c.ice && c.year >= 4,
    text: c => `Ice goes down hard in a game for ${c.ice!.teamName}. The doctors say six weeks.`,
    choices: c => [
      { id: 'text', label: 'Text him: "Get back. I need someone to beat."', result: 'He replies in four seconds: "Funny." Then: "Thanks."', effects: { bond: { ice: 2 } } },
      { id: 'visit', label: 'Visit him on your off day.', result: 'You sit in his kitchen and argue about who won the state championship. You both know who won.', effects: { bond: { ice: 3 } } },
      ...(bond(c, 'ice') < 0 ? [{ id: 'nothing', label: 'Say nothing.', result: 'He notices. He\'s Ice. He notices everything.', effects: { grit: 1 } }] : []),
    ] },
  { id: 'ice-allstars', stops: ['deadline'], title: 'Same Team, One Weekend', when: c => !!c.ice && c.year >= 5 && c.ovr >= 74,
    text: () => 'The All-Star captains draft you and Ice onto the same team. The league puts you two in the same locker room for a whole weekend.',
    choices: () => [
      { id: 'lob', label: 'Throw him an alley-oop in the first quarter.', result: 'He dunks it and points at you. The internet loses its mind.', effects: { bond: { ice: 2 }, hype: 1 } },
      { id: 'trash', label: 'Talk trash the entire weekend.', result: 'It\'s the most fun either of you has had at an All-Star Game.', effects: { hype: 2 } },
      { id: 'quiet', label: 'Keep it professional.', result: 'Two pros, one jersey, no drama.', effects: { grit: 1 } },
    ] },
  { id: 'ice-rumor', stops: ['deadline'], title: 'The Rumor', when: c => !!c.ice && c.year >= 6 && c.ice.teamId !== c.teamId,
    text: c => `A rumor says ${c.teamName} could trade for Ice. Reporters want to know how you'd feel about it.`,
    choices: () => [
      { id: 'yes', label: '"Bring him. We\'d win it all."', result: 'Ice sees the quote. He likes it. The trade never happens, but something changes.', effects: { bond: { ice: 2 }, hype: 1 } },
      { id: 'no', label: '"One of us is enough."', result: 'Ice sees that quote too.', effects: { bond: { ice: -1 }, hype: 1 } },
      { id: 'skip', label: '"I just play."', result: 'Boring. Safe. Smart.', effects: { grit: 1 } },
    ] },
  { id: 'ice-retires', stops: ['summer'], first: true, title: 'Ice Retires', when: c => c.iceRetired,
    text: () => 'Marcus "Ice" Vance announces his retirement. His last post is a photo from Carver Park: two kids, one ball. He tagged you.',
    choices: () => [
      { id: 'speech', label: 'Speak at his farewell.', result: 'You tell the story of the first game at the park. He calls you "lucky" from the front row, again.', effects: { bond: { ice: 3 } } },
      { id: 'post', label: 'Post the photo back: "Best rival I ever had."', result: 'Twelve million people agree.', effects: { bond: { ice: 2 }, hype: 1 } },
      { id: 'park', label: 'Meet him at Carver Park. One more game.', result: 'First to eleven. You don\'t tell anyone who won.', effects: { bond: { ice: 2 }, grit: 1 } },
    ] },

  // ---------------------------------------------------------------- the fans
  { id: 'fan-letter', stops: ['early', 'christmas'], repeat: true, title: 'A Letter', when: c => c.year >= 2,
    text: () => 'A letter from a ten-year-old: "I started playing because of you. I\'m the shortest kid on my team. What do I do?"',
    choices: () => [
      { id: 'write', label: 'Write back by hand.', result: 'Two pages. Mostly about the left hand. His mom sends a photo of him reading it.', effects: { hype: 1, grit: 1 } },
      { id: 'invite', label: 'Invite him to a game.', result: 'He sits behind your bench and holds up a sign the whole game: "SHORT KIDS UNITE".', effects: { hype: 2 } },
      { id: 'shoes', label: 'Send him your shoes.', result: 'They\'re four sizes too big. He wears them anyway.', effects: { hype: 1 } },
    ] },
  { id: 'fan-hospital', stops: ['christmas'], repeat: true, title: 'The Children\'s Hospital', when: c => c.year >= 3,
    text: () => 'The team visits the children\'s hospital on Christmas Eve.',
    choices: () => [
      { id: 'stay', label: 'Stay after everyone leaves.', result: 'You play video games against a seven-year-old for two hours. You lose every one.', effects: { grit: 1, hype: 1 } },
      { id: 'hoop', label: 'Bring a mini hoop for every room.', result: 'The nurses ask you to stop. Then they play too.', effects: { hype: 2 } },
      { id: 'maya', label: 'Bring Maya along.', result: 'The kids like her more than you. Fair.', effects: { bond: { maya: 1 }, hype: 1 } },
    ] },
  { id: 'fan-viral', stops: ['stretch'], title: 'Viral', when: c => c.ppg >= 18,
    text: () => 'Your between-the-legs dunk last night has fifty million views. Kids are trying it on every court in the country.',
    choices: () => [
      { id: 'humble', label: '"I missed four of those in practice."', result: 'Everybody loves you more for it.', effects: { grit: 1, hype: 1 } },
      { id: 'again', label: 'Promise to do it again next game.', result: 'You do. The arena explodes.', effects: { hype: 2 } },
      { id: 'teach', label: 'Post a slow-motion tutorial for kids.', result: 'A million kids try it. Thousands make it. One makes it in a game and tags you.', effects: { hype: 1, bond: { dre: 1 } } },
    ] },
  { id: 'fan-court', stops: ['summer'], title: 'A Court for Somewhere Else', when: c => c.year >= 4 && c.s.hype >= 10,
    text: () => 'A kid from a small town writes that the only court there has no rims. It sounds a lot like Carver Park used to.',
    choices: () => [
      { id: 'build', label: 'Build them a court and show up for the opening.', result: 'Half the town comes. Someone\'s grandma beats you at free throws.', effects: { hype: 2, grit: 1 } },
      { id: 'every', label: 'Start a fund: one new court every summer.', result: 'Dre runs it. Of course he does.', effects: { hype: 1, bond: { dre: 2 } } },
      { id: 'rims', label: 'Send rims and nets, no cameras.', result: 'Nobody finds out for years.', effects: { grit: 2 } },
    ] },
  { id: 'fan-film', stops: ['summer'], title: 'The Documentary', when: c => c.year >= 7 && c.s.hype >= 15,
    text: () => 'A film crew wants to follow you for a whole season.',
    choices: () => [
      { id: 'yes', label: 'Let them film everything.', result: 'It wins awards. You hate how you look at breakfast.', effects: { hype: 3, grit: -1 } },
      { id: 'carver', label: 'Only if it\'s about Carver Park, not you.', result: 'The film is about Dre, Ray and Maya. It\'s better that way.', effects: { hype: 2, bond: { dre: 1, ray: 1, maya: 1 } } },
      { id: 'no', label: 'No cameras. Just basketball.', result: 'Your best defensive season.', effects: { grit: 1, train: { perimeterD: 1 } } },
    ] },

  // ---------------------------------------------------------------- on the court
  { id: 'court-coach', stops: ['camp'], title: 'The New Coach', when: c => c.year >= 3,
    text: c => `${c.teamName} has a new head coach with a new system and a lot of whiteboards.`,
    choices: () => [
      { id: 'buy', label: 'Buy in. First one in the film room.', result: 'He builds the offense around your strengths. Smart coach.', effects: { train: { iq: 1 }, grit: 1 } },
      { id: 'meet', label: 'Take him to dinner and talk basketball.', result: 'Four hours, forty napkins of plays.', effects: { train: { iq: 2 } } },
      { id: 'push', label: 'Tell him what worked before.', result: 'He listens politely and changes nothing. Then, in March, he changes one thing. Your thing.', effects: { hype: 1 } },
    ] },
  { id: 'court-position', stops: ['camp'], title: 'A New Position', when: c => c.year >= 4 && c.ovr >= 65,
    text: () => 'The coach wants to try you at a different position this season.',
    choices: () => [
      { id: 'point', label: 'Run the offense.', result: 'You see the floor in a whole new way.', effects: { train: { playmaking: 2 } } },
      { id: 'big', label: 'Play bigger: rebounds and rim protection.', result: 'You add ten pounds and a lot of bruises.', effects: { train: { interiorD: 1, body: 1 } } },
      { id: 'no', label: '"I\'m best where I am."', result: 'He shrugs. You prove it.', effects: { hype: 1, grit: 1 } },
    ] },
  { id: 'court-b2b', stops: ['early', 'stretch'], repeat: true, title: 'Back to Back', when: c => c.year >= 2,
    text: () => 'Four games in five nights on the road. Your legs feel like they belong to an older man.',
    choices: () => [
      { id: 'sleep', label: 'Sleep. Twelve hours.', result: 'You wake up a new person.', effects: { train: { body: 1 } } },
      { id: 'shots', label: 'Extra shots anyway.', result: 'Tired legs, perfect form. That\'s the hardest kind.', effects: { train: { threePoint: 1 }, grit: 1 } },
      { id: 'movie', label: 'Team movie night in the hotel.', result: 'Someone picks a scary movie. The center screams the loudest.', effects: { grit: 1 } },
    ] },
  { id: 'court-fifty', stops: ['early', 'stretch'], title: 'The Hot Hand', when: c => c.ppg >= 25,
    text: () => 'You hit your first eight shots tonight. The bench is standing up. It\'s halftime.',
    choices: () => [
      { id: 'go', label: 'Keep shooting. Let\'s see how many.', result: 'Fifty-one. The ball goes in the trophy case.', effects: { hype: 2 } },
      { id: 'share', label: 'Find the open man every time they double you.', result: 'Thirty-eight and twelve assists. The coach calls it the best game he\'s ever seen you play.', effects: { grit: 1, train: { playmaking: 1 } } },
      { id: 'rest', label: 'It\'s a blowout. Sit the fourth quarter.', result: 'Fresh legs for tomorrow. The fans boo, lovingly.', effects: { train: { body: 1 } } },
    ] },
  { id: 'court-defense', stops: ['deadline'], title: 'The Challenge', when: c => c.year >= 3,
    text: () => 'The coach shows you a stat: the other team scores more when you\'re on the floor. "Fix it," he says.',
    choices: () => [
      { id: 'best', label: 'Guard their best scorer every night for a month.', result: 'It\'s exhausting. It\'s also the month your team goes 12-2.', effects: { train: { perimeterD: 2 }, grit: 1 } },
      { id: 'film', label: 'Study every opponent on film.', result: 'You know their plays before they call them.', effects: { train: { iq: 1, perimeterD: 1 } } },
      { id: 'argue', label: '"I score more than they do."', result: 'He doesn\'t laugh. You fix it anyway.', effects: { hype: 1 } },
    ] },
  { id: 'court-move', stops: ['summer'], repeat: true, title: 'A New Move', when: c => c.year >= 2,
    text: () => 'Every summer the great ones add one thing. What\'s yours this year?',
    choices: () => [
      { id: 'step', label: 'A step-back three.', result: 'You make it four hundred times in the empty gym before you try it in a game.', effects: { train: { threePoint: 1, midRange: 1 } } },
      { id: 'euro', label: 'A Euro-step.', result: 'Big men around the league start falling over.', effects: { train: { finishing: 2 } } },
      { id: 'post', label: 'A post-up game.', result: 'Smaller guards suddenly don\'t want to guard you.', effects: { train: { finishing: 1, body: 1 } } },
    ] },
  { id: 'court-clutch', stops: ['stretch'], title: 'The Last Shot', when: c => c.year >= 2 && c.w >= c.l - 2,
    text: () => 'Tie game, eight seconds left, the coach draws up a play for someone else.',
    choices: () => [
      { id: 'run', label: 'Run the play. Be the decoy.', result: 'Your teammate hits it. You\'re the first one to grab him.', effects: { grit: 2 } },
      { id: 'ask', label: '"Give me the ball."', result: 'He does. You hit it. The arena shakes.', effects: { hype: 2 } },
      { id: 'read', label: 'Run the play, but read the defense.', result: 'They double the other guy. You\'re open. Bang.', effects: { hype: 1, train: { iq: 1 } } },
    ] },

  // ---------------------------------------------------------------- the last years
  { id: 'late-tv', stops: ['summer'], title: 'After Basketball', when: c => c.year >= 11,
    text: () => 'A TV network wants you in the studio after you retire. A team wants you as an assistant coach. Your mom wants you to rest.',
    choices: () => [
      { id: 'tv', label: 'Sign with the network for later.', result: 'You practise your TV voice in the mirror. Maya says it\'s terrible.', effects: { hype: 1 } },
      { id: 'coach', label: 'Start learning to coach.', result: 'You sit in on every coaches\' meeting. You start seeing the game from the bench.', effects: { train: { iq: 2 } } },
      { id: 'rest', label: 'Nothing yet. Play first.', result: 'You put the offers in a drawer. Basketball first.', effects: { grit: 1 } },
    ] },
  { id: 'late-farewell', stops: ['camp'], first: true, title: 'The Last Season', when: c => c.year === 15,
    text: () => 'You tell your teammates before you tell anyone else: this is your last season.',
    choices: () => [
      { id: 'tour', label: 'Let the league throw you a farewell tour.', result: 'Every arena gives you a gift. You now own a rocking chair, a canoe and a painting of yourself.', effects: { hype: 2 } },
      { id: 'quiet', label: '"Just another season. Let\'s win."', result: 'Your teammates make shirts anyway.', effects: { grit: 2 } },
      { id: 'carver', label: 'Ask every road team to donate to a court back home.', result: 'Thirty courts in thirty cities, one in every arena\'s town.', effects: { hype: 1, bond: { dre: 1, ray: 1 } } },
    ] },
  { id: 'late-young', stops: ['deadline'], title: 'The Kid Who Wore Your Number', when: c => c.year >= 12,
    text: () => 'The rookie on the other team tells you he wore your number in high school. Then he crosses you over.',
    choices: () => [
      { id: 'laugh', label: 'Laugh and tell him "good move".', result: 'He tells the reporters it was the best moment of his life.', effects: { grit: 1, hype: 1 } },
      { id: 'answer', label: 'Answer with a crossover of your own.', result: 'The old man still has it.', effects: { hype: 2 } },
      { id: 'after', label: 'Find him after the game.', result: 'You give him the long version. He takes notes on his phone.', effects: { grit: 1, train: { iq: 1 } } },
    ] },
  // ---------------------------------------------------------------- the holidays and the grind
  { id: 'xmas-dinner', stops: ['christmas'], title: 'Holiday Dinner', when: c => c.year >= 2,
    text: c => `${c.teamName} are on the road over the holidays. Three of your teammates can't fly home either.`,
    choices: () => [
      { id: 'host', label: 'Host them all in your hotel suite.', result: 'Room-service turkey, a borrowed speaker and a very loud game of cards. Best holiday in years.', effects: { grit: 1, hype: 1 } },
      { id: 'family', label: 'Fly Mom and Maya in for the night.', result: 'Mom brings her own pans. The hotel kitchen staff ask for the recipe.', effects: { bond: { maya: 1 }, grit: 1 } },
      { id: 'call', label: 'Video call home, then early to bed.', result: 'Maya holds the phone up to the tree. You fall asleep before dessert.', effects: { train: { body: 1 } } },
    ] },
  { id: 'xmas-santa', stops: ['christmas'], title: 'Secret Santa', when: c => c.year >= 1,
    text: () => 'The locker room does Secret Santa. You drew the grumpiest veteran on the team. Twenty-dollar limit.',
    choices: () => [
      { id: 'funny', label: 'A framed photo of his worst airball.', result: 'He pretends to be angry for a whole minute. Then he hangs it in his locker.', effects: { hype: 1 } },
      { id: 'kind', label: 'A coffee mug from his hometown diner.', result: 'He goes quiet, then says "thank you" like he means it.', effects: { grit: 1 } },
      { id: 'game', label: 'A ticket to your next one-on-one session.', result: 'He accepts. He also wins. Lesson learned.', effects: { train: { perimeterD: 1 } } },
    ] },
  { id: 'xmas-toys', stops: ['christmas'], title: 'The Toy Drive', when: c => c.year >= 3,
    text: c => `The rec center back in ${c.s.hometown} runs a toy drive every December. Coach Ray says this year's donations are thin.`,
    choices: () => [
      { id: 'truck', label: 'Send a truck full of toys and bikes.', result: 'Ray sends a photo of two hundred kids and one very tired Santa.', effects: { bond: { ray: 1 }, hype: 1 } },
      { id: 'go', label: 'Fly home on the off day and hand them out yourself.', result: 'A kid asks if you\'re really you. You sign his bike helmet.', effects: { bond: { ray: 1, dre: 1 } } },
      { id: 'team', label: 'Get the whole team to chip in.', result: 'Your teammates out-give each other. The rec center gets a new scoreboard too.', effects: { grit: 1, hype: 1 } },
    ] },
  { id: 'camp-media', stops: ['camp'], repeat: true, title: 'Media Day', when: c => c.year >= 2,
    text: c => `Media day. Cameras, lights, and a reporter who asks where ${c.teamName} will finish this season.`,
    choices: () => [
      { id: 'bold', label: '"Top of the conference."', result: 'It becomes the headline. Now you have to back it up.', effects: { hype: 2 } },
      { id: 'safe', label: '"One game at a time."', result: 'The most boring answer of the day. Your coach loves it.', effects: { grit: 1 } },
      { id: 'joke', label: '"Ask me after the first road trip."', result: 'The room laughs. The clip ends up on the team\'s page.', effects: { hype: 1 } },
    ] },
  { id: 'camp-summer-shape', stops: ['camp'], title: 'Ten Pounds', when: c => c.year >= 2 && c.year <= 6,
    text: () => 'You show up to camp ten pounds heavier. All muscle, you tell everyone. The strength coach wants to check.',
    choices: () => [
      { id: 'test', label: 'Do every test in front of the team.', result: 'Your vertical went up two inches. The strength coach is speechless.', effects: { train: { body: 1, athleticism: 1 }, hype: 1 } },
      { id: 'adjust', label: 'Cut five pounds before the opener.', result: 'You feel lighter and quicker by week two.', effects: { train: { athleticism: 1 } } },
      { id: 'post', label: 'Post up every guard in practice to show it off.', result: 'Nobody wants to guard you on the block anymore.', effects: { train: { finishing: 1 } } },
    ] },
  { id: 'deadline-gm', stops: ['deadline'], title: 'The GM\'s Question', when: c => c.year >= 4 && c.ovr >= 72,
    text: c => `The general manager of ${c.teamName} asks you to lunch. He has a trade on the table and he wants your opinion.`,
    choices: () => [
      { id: 'yes', label: '"Make the trade. We need shooting."', result: 'He makes it. The new guy hits five threes in his first game.', effects: { hype: 1 } },
      { id: 'no', label: '"Keep the group together."', result: 'Your teammates hear you stood up for them. They play like it.', effects: { grit: 1 } },
      { id: 'job', label: '"That\'s your job. Mine is to play."', result: 'He laughs. "Fair enough." You eat your sandwich.', effects: { train: { iq: 1 } } },
    ] },
  { id: 'deadline-tenday', stops: ['deadline'], title: 'An Old Teammate', when: c => c.year >= 2 && c.year <= 9,
    text: () => 'Your old college teammate has been playing in the minor leagues for four years. He has a tryout for a ten-day contract. He asks if you can put in a word.',
    choices: () => [
      { id: 'word', label: 'Call your GM for him.', result: 'He gets the ten-day. Then he gets a second one. Then he gets a real contract.', effects: { grit: 1, hype: 1 } },
      { id: 'train', label: 'Train with him every morning before the tryout.', result: 'He gets the contract on his own. He says the mornings made the difference.', effects: { train: { midRange: 1 }, grit: 1 } },
      { id: 'honest', label: 'Tell him the truth: you can\'t promise anything.', result: 'He says he understands. He plays great anyway.', effects: { train: { iq: 1 } } },
    ] },
  { id: 'early-ref', stops: ['early'], title: 'The Referee', when: c => c.year >= 2,
    text: () => 'The same referee has given you two technical fouls this month. Tonight he\'s working your game again.',
    choices: () => [
      { id: 'calm', label: 'Say "good morning, sir" and nothing else all night.', result: 'He looks confused. You get a fair whistle for the first time in weeks.', effects: { grit: 1 } },
      { id: 'talk', label: 'Ask him politely what you are doing wrong.', result: '"You argue with your hands," he says. You stop doing that.', effects: { train: { iq: 1 } } },
      { id: 'play', label: 'Let your game do the talking.', result: 'Thirty points and no complaints. He says "nice game" at the end.', effects: { hype: 1 } },
    ] },
  { id: 'stretch-wall', stops: ['stretch'], title: 'The Rookie Wall', when: c => c.year === 1 && c.gp >= 40,
    text: c => `Game ${c.gp}. In college you'd have been done by now. Your legs feel like they're full of sand.`,
    choices: () => [
      { id: 'sleep', label: 'Ten hours of sleep and no phone after 10 PM.', result: 'By the next week the sand is gone.', effects: { train: { body: 1 }, grit: 1 } },
      { id: 'vet', label: 'Ask the veteran how he gets through March.', result: '"Ice baths and naps. Lots of naps." He was right.', effects: { train: { athleticism: 1 } } },
      { id: 'push', label: 'Push through it. Rest is for summer.', result: 'Your shot is short for two weeks. Then it comes back.', effects: { grit: 2 } },
    ] },
];
