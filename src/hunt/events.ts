/*
 * League Hunt events: a story stop between games with a choice to make. Options are resolved in run.ts
 * (resolveEvent), which knows the squad; here is only what the player reads.
 */

export type EventId = 'flu' | 'holdout' | 'tradeMachine' | 'camp' | 'envelope' | 'charity';
export interface HuntEventOption { id: string; label: string; detail: string }
export interface HuntEvent { id: EventId; title: string; text: string; options: HuntEventOption[] }

export const EVENTS: Record<EventId, HuntEvent> = {
  flu: { id: 'flu', title: 'The Flu Game', text: 'Your best player wakes up sick the morning of your next game. He says he can go.', options: [
    { id: 'play', label: 'Let him play', detail: '+40 coins from a legendary performance story, but he plays next game at −4.' },
    { id: 'rest', label: 'Keep him in bed', detail: 'No risk, no reward.' },
  ] },
  holdout: { id: 'holdout', title: 'Contract Year', text: 'Your second-best player wants to be paid like a star, or he will play like he isn\'t one.', options: [
    { id: 'pay', label: 'Pay him (35 coins)', detail: 'He is happy and plays +1 for the rest of the hunt.' },
    { id: 'refuse', label: 'Refuse', detail: 'He sulks: −2 for the rest of the hunt.' },
  ] },
  tradeMachine: { id: 'tradeMachine', title: 'The Trade Machine', text: 'A time-traveling GM offers to swap your weakest player for someone from another era, sight unseen.', options: [
    { id: 'swap', label: 'Make the trade', detail: 'Your weakest card for a random card one rarity higher (if it fits your cap).' },
    { id: 'pass', label: 'Hang up', detail: 'Keep your squad as it is.' },
  ] },
  camp: { id: 'camp', title: "Old-Timers' Camp", text: 'A Hall of Fame coach runs a summer camp and has one spot left.', options: [
    { id: 'send', label: 'Send your weakest starter (30 coins)', detail: '+3 overall for him for the rest of the hunt.' },
    { id: 'skip', label: 'Save the money', detail: 'Nothing happens.' },
  ] },
  envelope: { id: 'envelope', title: 'The Frozen Envelope', text: 'Someone slides a sealed envelope under your hotel door. It could be anything.', options: [
    { id: 'open', label: 'Open it', detail: 'A random Rare or better card joins your squad if there is room and cap space; otherwise 50 coins.' },
    { id: 'sell', label: 'Sell it unopened', detail: '25 coins, guaranteed.' },
  ] },
  charity: { id: 'charity', title: 'Charity Game', text: 'A children\'s hospital asks your squad to play an exhibition.', options: [
    { id: 'play', label: 'Play it', detail: 'Win a life back (or 30 coins if you have all your lives).' },
    { id: 'decline', label: 'Decline', detail: 'Your squad rests: +10 coins from the hotel refund.' },
  ] },
};
export const EVENT_IDS = Object.keys(EVENTS) as EventId[];
