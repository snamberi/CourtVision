import { offensiveFit, defensiveFit } from '../coachingSystems';
import type { CoachTendencies } from '../league';
import type { RuleMods } from './ruleMods';
import { type CoachIdentity } from '../coaching';
import type { PlayerSeason } from '../types';

export function applyCoachingPlan(base: RuleMods, offense: CoachTendencies, defense: CoachTendencies,
  offIdentity: CoachIdentity | undefined, defIdentity: CoachIdentity | undefined,
  offRoster: PlayerSeason[], defRoster: PlayerSeason[], impact = 100, moraleImpact = 100): RuleMods {
  const strength = Math.max(0, Math.min(2, impact / 100));
  const scale = (value: number) => 1 + (value - 1) * strength;

  const system = offense.offensiveSystem ?? 'balanced';
  const scheme = defense.defensiveScheme ?? 'man';
  const avg = (roster:PlayerSeason[], value:(p:PlayerSeason)=>number) => roster.reduce((n,p)=>n+value(p)*Math.max(1,p.minutes.target),0)/Math.max(1,roster.reduce((n,p)=>n+Math.max(1,p.minutes.target),0));
  const familiarity = avg(offRoster,p=>p.training?.familiarity['offense:'+system]??70)/100;
  const fit = avg(offRoster,p=>offensiveFit(p,system));
  const defenseFit = avg(defRoster,p=>defensiveFit(p,scheme));
  const morale=avg(offRoster,p=>p.training?(p.training.morale.trust+p.training.morale.role)/2:50);
  const offenseExecution = 1+(morale-50)/3000*Math.max(0,Math.min(2,moraleImpact/100)) +(fit-60)/1600+((offIdentity?.traits.offense??50)-50)/1800-(1-familiarity)*(system==='motion'?.07:.035);
  const defenseExecution = 1+(defenseFit-60)/1800+((defIdentity?.traits.defense??50)-50)/1800;
  const slowSwitch = scheme==='switch'?Math.max(0,65-avg(defRoster,p=>p.attributes.physical.agility))/180:0;
  const three = (1 + (offense.threePointFrequency - 50) / 100) * (system === 'pace-space' ? 1.5 : system === 'post' ? 0.75 : 1);
  return {
    ...base,
    shot: {
      ...base.shot,
      catchAndShootBonus: base.shot.catchAndShootBonus * scale(system==='motion'?1.06:1),
      openShotBonus: base.shot.openShotBonus * scale(scheme==='pressure'?1.08:1),
      offensiveEfficiency: base.shot.offensiveEfficiency * scale(offenseExecution),
      defensiveEfficiency: base.shot.defensiveEfficiency * scale(defenseExecution),
      interiorDefenseImpact: base.shot.interiorDefenseImpact * scale(scheme === 'zone' ? 1.15 : scheme === 'drop' ? 1.2 : scheme === 'switch' ? 0.92 : 1),
      closeoutEffectiveness: base.shot.closeoutEffectiveness * scale(scheme === 'zone' ? 0.85 : scheme === 'drop' ? .83 : scheme === 'pressure' ? .92 : scheme === 'switch' ? 1.08-slowSwitch : 1),
      pickAndRollDefense: base.shot.pickAndRollDefense * scale(scheme === 'switch' ? 1.15-slowSwitch : scheme==='drop'?.95:1),
    },
    shotTypeWeight: { ...base.shotTypeWeight, three: base.shotTypeWeight.three * scale(three) },
    action: {
      ...base.action,
      pnr: base.action.pnr * scale((0.5 + offense.pnrFrequency / 100) * (system === 'pick-roll' ? 1.7 : 1)),
      postUp: base.action.postUp * scale((0.7 + offense.postFrequency / 100) * (system === 'post' ? 1.8 : 1)),
      transition: base.action.transition * scale(system === 'pace-space' ? 1.45 : system === 'post' ? 0.8 : 1),
      isolation: base.action.isolation * scale(system === 'motion' ? 0.6 : system==='isolation'?1.8:1),
    },
    assistFrequency: base.assistFrequency * scale(system === 'motion' ? 1.3 : system==='isolation'?.75:1),
    turnover: { ...base.turnover, stealFrequency: base.turnover.stealFrequency * scale(scheme === 'pressure' ? 1.25 : 1) },
  };
}
