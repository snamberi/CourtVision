import type { DraftProspect } from './gm';
import type { PlayerSeason } from './types';
import { calculateOverall } from './engine/overall';

export const rankedProspects = (prospects: DraftProspect[], potential: (p: DraftProspect) => number = p => p.scoutedPotential) => [...prospects].sort((a, b) =>
  (potential(b) * 0.65 + calculateOverall(b.trueSeason) * 0.35) - (potential(a) * 0.65 + calculateOverall(a.trueSeason) * 0.35) || a.playerId.localeCompare(b.playerId));

export function prospectComparison(p: PlayerSeason) {
  const { offense: o, defense: d, physical: a } = p.attributes;
  const avg = (...v: number[]) => Math.round(v.reduce((n, x) => n + x, 0) / v.length);
  return {
    Shooting: avg(o.threePoint, o.midrange, o.catchAndShoot, o.freeThrow),
    Height: a.heightInches,
    Finishing: avg(o.finishing, o.drivingLayup, o.drivingDunk, o.touch),
    Playmaking: avg(o.passing, o.passingIQ, o.ballHandling, o.decisionMaking),
    Defense: avg(d.perimeterDefense, d.interiorDefense, d.defensiveIQ, d.helpDefense),
    Rebounding: avg(o.offensiveRebounding, d.defensiveRebounding),
    Athleticism: avg(a.speed, a.acceleration, a.vertical, a.agility),
  };
}
