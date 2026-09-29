/*
 * League Hunt items: bought in the shop, kept for the rest of the run (up to two). Their effects are applied in
 * run.ts when a game is played (overall bonuses, defense, pace) or when coins are paid out.
 */

export type ItemId = 'triangle' | 'cigar' | 'sevenSeconds' | 'badBoys' | 'sixthMan' | 'homeCourt' | 'scout' | 'insurance' | 'clutch' | 'filmRoom';
export interface HuntItem { id: ItemId; name: string; blurb: string; price: number }

export const ITEMS: Record<ItemId, HuntItem> = {
  triangle: { id: 'triangle', name: 'Triangle Offense Playbook', blurb: 'Everyone knows where to be: +1 overall for the whole squad.', price: 70 },
  cigar: { id: 'cigar', name: "Red's Victory Cigar", blurb: 'Light one up after every series win: +20 coins.', price: 45 },
  sevenSeconds: { id: 'sevenSeconds', name: 'Seven Seconds or Less', blurb: 'Your squad pushes the pace and hunts threes in any era (where there is a line).', price: 50 },
  badBoys: { id: 'badBoys', name: 'Bad Boys Rulebook', blurb: 'Nobody gets an easy basket: +5 to your defensive ratings.', price: 60 },
  sixthMan: { id: 'sixthMan', name: 'Sixth Man Trophy', blurb: 'Your sixth man: +4 overall.', price: 50 },
  homeCourt: { id: 'homeCourt', name: 'Home-Court Banner', blurb: 'Home court in every series: +3 for everyone in games 1, 2, 5 and 7.', price: 70 },
  scout: { id: 'scout', name: 'Advance Scout', blurb: 'See every opponent on the road ahead, and their buffs are 1 weaker.', price: 40 },
  insurance: { id: 'insurance', name: 'Injury Insurance', blurb: 'The next series you lose costs no life (used up when it saves you).', price: 55 },
  clutch: { id: 'clutch', name: 'Clutch Gene', blurb: 'Your best player takes over in games 5-7: +6 overall for him.', price: 50 },
  filmRoom: { id: 'filmRoom', name: 'Film Room', blurb: 'After a loss in a series, everyone +2 for the next game.', price: 45 },
};
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
/** Shop boosts a hunt can hold (kept apart from the three boosts won after series; a deck's starting item doesn't count). */
export const MAX_ITEMS = 2;
