import type { PlayerSeason, Attributes } from './types';
import { keepLockedRatings } from './ratingLocks';
import { calculateOverall } from './engine/overall';
/** Archive/develop in summer, reveal the rating change once preseason finishes. */
export function deferDevelopment(before: PlayerSeason, after: PlayerSeason): PlayerSeason {
  return {...after, attributes:before.attributes, pendingSeasonAttributes:after.attributes, previousOverall:before.previousOverall, previousFullOverall:before.previousFullOverall};
}
export function finishDevelopment(p: PlayerSeason): PlayerSeason {
  if (p.developmentAppliedSeason === p.season || (!p.pendingSeasonAttributes && !p.deferredTraining)) return p;
  const attributes=structuredClone(p.pendingSeasonAttributes??p.attributes);
  if(p.deferredTraining)for(const group of Object.keys(attributes) as (keyof Attributes)[]) {
    const dest=attributes[group] as unknown as Record<string,number>, training=p.deferredTraining[group] as unknown as Record<string,number>, base=p.attributes[group] as unknown as Record<string,number>;
    for(const key of Object.keys(dest)) dest[key]=Math.max(0,Math.min(Math.max(99,dest[key],base[key]),dest[key]+training[key]-base[key]));
  }
  const before=calculateOverall(p);
  const projected=calculateOverall({...p,attributes,positions:p.deferredPositions??p.positions});
  // Real-reference seasons explicitly follow historical data; simulated development stays within ±10.
  if (!p.real || p.real.appliedSeason !== p.season) {
    if (Math.abs(projected-before)>10) {
      const scale=10/Math.abs(projected-before);
      for(const group of Object.keys(attributes) as (keyof Attributes)[]) {
        const dest=attributes[group] as unknown as Record<string,number>, base=p.attributes[group] as unknown as Record<string,number>;
        for(const key of Object.keys(dest)) dest[key]=base[key]+(dest[key]-base[key])*scale;
      }
    }
  }
  return keepLockedRatings(p,{...p,attributes,positions:p.deferredPositions??p.positions,deferredPositions:undefined,previousOverall:calculateOverall(p),pendingSeasonAttributes:undefined,deferredTraining:undefined,developmentAppliedSeason:p.season});
}
