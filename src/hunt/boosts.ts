/*
 * League Hunt boosts: after every series win you pick one of three. They last the rest of the hunt, and many of
 * them grow inside a series (the Sixth Man Spark adds +3 for every game you have won in it). The effects are applied
 * game by game in run.ts (seriesBonuses).
 */

export type BoostId = 'spark' | 'microwave' | 'franchise' | 'closer' | 'backToWall' | 'momentum' | 'fastStart' | 'backcourt' | 'twinTowers'
  | 'ironFive' | 'giantKiller' | 'elimination' | 'coachTrust' | 'bankroll' | 'wings' | 'lockdown';
export interface HuntBoost { id: BoostId; name: string; blurb: string }

export const BOOSTS: Record<BoostId, HuntBoost> = {
  spark: { id: 'spark', name: 'Sixth Man Spark', blurb: 'Your sixth man gets +3 overall for every game you have won in the series.' },
  microwave: { id: 'microwave', name: 'The Microwave', blurb: 'Your sixth man comes in hot: +5 overall every game.' },
  franchise: { id: 'franchise', name: 'Franchise Player', blurb: 'Your best player: +4 overall every game.' },
  closer: { id: 'closer', name: 'Closer', blurb: 'Games 5, 6 and 7: everyone +4.' },
  backToWall: { id: 'backToWall', name: 'Back to the Wall', blurb: 'While you trail in the series: everyone +4.' },
  momentum: { id: 'momentum', name: 'Momentum', blurb: 'After a win, everyone +2 for every game of your current win streak.' },
  fastStart: { id: 'fastStart', name: 'Fast Start', blurb: 'Games 1 and 2: everyone +4.' },
  backcourt: { id: 'backcourt', name: 'Backcourt Bond', blurb: 'Your PG and SG: +4 each, every game.' },
  twinTowers: { id: 'twinTowers', name: 'Twin Towers', blurb: 'Your PF and C: +4 each, every game.' },
  ironFive: { id: 'ironFive', name: 'Iron Five', blurb: 'Your starting five: +2 each, every game.' },
  giantKiller: { id: 'giantKiller', name: 'Giant Killer', blurb: 'Against the semi-boss and the boss: everyone +5.' },
  elimination: { id: 'elimination', name: 'Elimination Mode', blurb: 'Facing elimination (they have 3 wins): everyone +6.' },
  coachTrust: { id: 'coachTrust', name: "Coach's Trust", blurb: 'Your coach is worth 2 more overall to everyone.' },
  bankroll: { id: 'bankroll', name: 'Bankroll', blurb: '+30 coins for every series you win from now on.' },
  wings: { id: 'wings', name: 'Wing Stoppers', blurb: 'Your SG and SF: +3 each and +5 to their defense.' },
  lockdown: { id: 'lockdown', name: 'Lockdown', blurb: 'The whole squad: +5 to defensive ratings.' },
};
export const BOOST_IDS = Object.keys(BOOSTS) as BoostId[];
