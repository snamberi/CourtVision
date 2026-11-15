import type { PlayerSeason } from './types';
/** Skill tags are descriptive, never bonuses, and update from the player's actual attributes. */
export function playerTags(p: PlayerSeason): string[] {
  const {offense:o,defense:d}=p.attributes;
  const tags: string[]=[];
  if ((o.offensiveRebounding+d.defensiveRebounding)/2>=78) tags.push('Rebounder');
  if (o.threePoint>=78 && d.perimeterDefense>=75) tags.push('3&D');
  if (d.perimeterDefense>=80) tags.push('Perimeter defender');
  if ((d.interiorDefense+d.rimProtection)/2>=80) tags.push('Interior defender');
  if (Math.max(o.threePoint,o.midrange,o.finishing)>=85) tags.push('Scorer');
  if ((o.passing+o.passingIQ)/2>=80) tags.push('Playmaker');
  if (o.threePoint>=85) tags.push('Sharpshooter');
  if ((o.postControl+o.postHook)/2>=80) tags.push('Post scorer');
  if (o.finishing>=80 && p.attributes.physical.speed>=75) tags.push('Slasher');
  if (d.rimProtection>=85) tags.push('Rim protector');
  return tags.length ? tags : ['Developing role'];
}
export function recentPlayerStats(p: PlayerSeason) {
  if (p.seasonStats?.gamesPlayed) return { season:p.season, stats:p.seasonStats, previous:false };
  const last=[...(p.careerHistory??[])].reverse().find(y=>y.stats.gamesPlayed>0);
  return last ? {season:last.season,stats:last.stats,previous:true} : null;
}
