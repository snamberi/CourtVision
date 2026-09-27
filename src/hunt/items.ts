/*
 * League Hunt items: bought in the shop, kept for the rest of the run (up to four). Their effects are applied in
 * run.ts when a game is played (overall bonuses, defense, pace) or when coins are paid out.
 */

export type ItemId = 'triangle' | 'cigar' | 'sevenSeconds' | 'badBoys' | 'sixthMan' | 'homeCourt' | 'scout' | 'legacyFund' | 'clutch';
export interface HuntItem { id: ItemId; name: string; blurb: string; price: number }

export const ITEMS: Record<ItemId, HuntItem> = {
  triangle: { id: 'triangle', name: 'Triangle Offense Playbook', blurb: 'Everyone knows where to be: +1 overall for the whole squad.', price: 70 },
  cigar: { id: 'cigar', name: "Red's Victory Cigar", blurb: 'Light one up after every win: +15 coins per win.', price: 45 },
  sevenSeconds: { id: 'sevenSeconds', name: 'Seven Seconds or Less', blurb: 'Your squad pushes the pace and hunts threes in any era (where there is a line).', price: 50 },
  badBoys: { id: 'badBoys', name: 'Bad Boys Rulebook', blurb: 'Nobody gets an easy basket: +5 to your defensive ratings.', price: 60 },
  sixthMan: { id: 'sixthMan', name: 'Sixth Man Trophy', blurb: 'Your bench comes in hot: +3 overall for everyone after the starting five.', price: 55 },
  homeCourt: { id: 'homeCourt', name: 'Home-Court Banner', blurb: 'The crowd carries your starters: +2 overall for the starting five.', price: 60 },
  scout: { id: 'scout', name: 'Advance Scout', blurb: 'See every opponent on the road ahead.', price: 30 },
  legacyFund: { id: 'legacyFund', name: 'Legacy Fund', blurb: '+12 Legacy Points on your cap, right away.', price: 55 },
  clutch: { id: 'clutch', name: 'Clutch Gene', blurb: 'Your best player takes over: +3 overall for him.', price: 50 },
};
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
export const MAX_ITEMS = 4;
