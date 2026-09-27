/*
 * League Hunt opponent buffs. From the third series on every team brings one; the semi-boss brings two and the boss
 * three, on top of a lift that makes the boss a 100-rated team. The Advance Scout makes every buff one point weaker.
 */

export type BuffId = 'swagger' | 'superstar' | 'depth' | 'lockdown' | 'crowd' | 'veterans' | 'runGun';
export interface HuntBuff { id: BuffId; name: string; blurb: (v: number) => string; value: number }

export const BUFFS: Record<BuffId, HuntBuff> = {
  swagger: { id: 'swagger', name: 'Swagger', value: 2, blurb: v => `Everyone +${v}.` },
  superstar: { id: 'superstar', name: 'Superstar Takeover', value: 5, blurb: v => `Their best player +${v}.` },
  depth: { id: 'depth', name: 'Instant Offense', value: 7, blurb: v => `Their sixth man +${v}.` },
  lockdown: { id: 'lockdown', name: 'Lockdown D', value: 5, blurb: v => `+${v} to their defensive ratings.` },
  crowd: { id: 'crowd', name: 'Hostile Crowd', value: 4, blurb: v => `Games 3, 4 and 6 in their building: everyone +${v}.` },
  veterans: { id: 'veterans', name: 'Playoff Veterans', value: 4, blurb: v => `Games 5, 6 and 7: everyone +${v}.` },
  runGun: { id: 'runGun', name: 'Run and Gun', value: 2, blurb: v => `A frantic pace, and everyone +${v}.` },
};
export const BUFF_IDS = Object.keys(BUFFS) as BuffId[];
