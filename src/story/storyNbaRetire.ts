import type { NbaCard } from './storyNbaCards';
import type { NbaCtx } from './storyNba';
import { careerResume, hallOfFame, retiredJerseys } from '../career/career';
import { legacyScore } from '../career/legacy';

/*
 * The end of the road: the summer after the fifteenth season. Never drawn from the deck; the last summer queues them
 * in order (the announcement, what comes next, then the Hall of Fame, a jersey night or one more run at Carver Park).
 * Their flags shape the ending's epilogue.
 */

const has = (c: NbaCtx, flag: string) => c.s.flags.includes(flag);
const career = (c: NbaCtx) => careerResume({ years: c.n.years });

/** Which card closes the career: the Hall of Fame, a retired jersey, or the park. */
export function finalCardId(years: NbaCtx['n']['years']): string {
  if (hallOfFame(legacyScore(careerResume({ years }))) !== 'no') return 'retire-hof';
  return retiredJerseys({ years }).length ? 'retire-jersey' : 'retire-park';
}

export const RETIRE_CARDS: NbaCard[] = [
  { id: 'retire-day', stops: [], title: 'The Announcement',
    text: c => `The press conference is at noon. Fifteen seasons and ${career(c).games} games, and a podium with one empty chair next to it. Who sits there with you?`,
    choices: c => [
      { id: 'mom', label: 'Mom.', result: 'She wears the jersey from your rookie season. She gets a bigger cheer than you do.', effects: { grit: 1, flag: 'thanksMom' } },
      { id: 'maya', label: 'Maya.', result: 'She steals the microphone halfway through and tells the story about the step-back. The room loses it.', effects: { bond: { maya: 2 }, flag: 'thanksMaya' } },
      { id: 'dre', label: 'Dre.', result: 'Carver Park to the podium, together. He wipes his eyes and blames the lights.', effects: { bond: { dre: 2 }, flag: 'thanksDre' } },
      { id: 'ray', label: 'Coach Ray.', result: 'Ray says one sentence into the microphone: "Talent is cheap. This one worked." Then he sits back down.', effects: { bond: { ray: 2 }, flag: 'thanksRay' } },
      ...(c.s.bonds.ice >= 1 ? [{ id: 'ice', label: 'Ice. Who else?', result: 'The two of you tell the Carver Park story in two different versions. In both of them, you won.', effects: { bond: { ice: 2 }, flag: 'thanksIce' } }] : []),
    ] },
  { id: 'retire-next', stops: [], title: 'What Comes Next',
    text: c => `${has(c, 'leanTv') ? 'The TV network still has your contract in a drawer. ' : has(c, 'leanCoach') ? 'Three teams want you on their bench next season. ' : ''}For the first time since you were sixteen, nobody needs you at practice tomorrow. What do you do with the rest of your life?`,
    choices: () => [
      { id: 'tv', label: 'The TV studio.', result: 'You sit between two Hall of Famers and argue about defense. Your first night goes viral.', effects: { hype: 1, flag: 'afterTv' } },
      { id: 'coach', label: 'The bench. Start as an assistant coach.', result: 'You get the worst job on the staff: film at 5 AM. You love it.', effects: { flag: 'afterCoach' } },
      { id: 'gm', label: 'The front office.', result: 'You trade one suit for a better suit and start reading salary-cap rules for fun.', effects: { flag: 'afterGm' } },
      { id: 'gym', label: 'Build a real gym at Carver Park.', result: 'You buy the land around the courts. Dre draws the plans on a napkin.', effects: { bond: { dre: 1 }, flag: 'afterGym' } },
      { id: 'family', label: 'Nothing. Family first.', result: 'You drive Maya to the airport, sleep for a week and learn to cook a fifth thing.', effects: { bond: { maya: 1 }, flag: 'afterFamily' } },
    ] },
  { id: 'retire-hof', stops: [], title: 'The Hall of Fame',
    text: c => `${hallOfFame(legacyScore(career(c))) === 'first-ballot' ? 'Five summers later the phone rings on the first day it can: first ballot.' : 'Five summers later, the phone rings.'} The Hall of Fame in Springfield. Eight minutes on the stage, everyone you love in the front rows. What is your speech about?`,
    choices: () => [
      { id: 'carver', label: 'Carver Park.', result: 'You describe the one working light and the nets that were never there. In the third row, Dre mouths every word.', effects: { flag: 'speechCarver' } },
      { id: 'people', label: 'Everyone who carried you.', result: 'Mom, Maya, Dre, Ray, Coach Hart, a veteran who gave you the long version. It takes eleven minutes. Nobody stops you.', effects: { bond: { dre: 1, ray: 1, maya: 1 }, flag: 'speechPeople' } },
      { id: 'ice', label: 'Ice.', result: 'You say you wouldn\'t be in this building without him. In the second row, Ice shakes his head and laughs.', effects: { bond: { ice: 2 }, flag: 'speechIce' } },
      { id: 'kids', label: 'The kid watching at home.', result: '"You don\'t need a net. You need a ball and a reason." Coaches play the clip in gyms for years.', effects: { hype: 1, flag: 'speechKids' } },
    ] },
  { id: 'retire-jersey', stops: [], title: 'Jersey Night',
    text: c => `The ${retiredJerseys({ years: c.n.years }).join(' and the ')} raise your number to the rafters. The arena goes dark, and the video starts with a clip from Carver Park.`,
    choices: () => [
      { id: 'speech', label: 'Speak from the heart. No notes.', result: 'You forget half of what you meant to say. Nobody notices, because everyone is crying.', effects: { flag: 'speechPeople' } },
      { id: 'kids', label: 'Let kids from Carver Park pull the rope.', result: 'Six kids pull the banner up together. One of them yells your name like you yelled your heroes\' names.', effects: { hype: 1, flag: 'speechKids' } },
      { id: 'family', label: 'Bring Mom and Maya out to center court.', result: 'Mom waves to the crowd like a queen. Maya takes a selfie with the banner.', effects: { bond: { maya: 1 }, flag: 'speechCarver' } },
    ] },
  { id: 'retire-park', stops: [], title: 'One More Run',
    text: () => 'A Saturday morning at Carver Park. The nets are new; you paid for them. The tall kid holding court looks over at you. "You got next, old man?"',
    choices: () => [
      { id: 'run', label: '"We got next. Run it."', result: 'First to eleven. Your legs are gone by seven. You win anyway, on a step-back.', effects: { grit: 1, flag: 'speechCarver' } },
      { id: 'teach', label: 'Teach him the step-back instead.', result: 'He has it by noon. You can tell it\'s going to be his move now.', effects: { flag: 'speechKids' } },
      { id: 'watch', label: 'Sit on the steps and watch, like Ray used to.', result: 'Ray sits down next to you. Neither of you says much. Neither of you needs to.', effects: { bond: { ray: 1 }, flag: 'speechPeople' } },
    ] },
];
