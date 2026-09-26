import type { CoachTendencies, LeagueTeam } from './league';
import type { PlayerSeason } from './types';
export function offensiveFit(p:PlayerSeason,system:CoachTendencies['offensiveSystem']):number{
 const o=p.attributes.offense,ph=p.attributes.physical;
 return system==='pace-space'?(o.threePoint+ph.speed+ph.stamina)/3:system==='motion'?(o.passing+o.decisionMaking+o.catchAndShoot)/3:system==='post'?(o.postControl+o.touch+o.closeShot)/3:system==='pick-roll'?(Math.max(o.ballHandling,o.finishing)+o.passingIQ+o.decisionMaking)/3:system==='isolation'?(o.ballHandling+o.midrange+o.finishing)/3:(o.offensiveIQ+o.decisionMaking)/2;
}
export function defensiveFit(p:PlayerSeason,scheme:CoachTendencies['defensiveScheme']):number{
 const d=p.attributes.defense;
 return scheme==='switch'?(d.perimeterDefense+d.interiorDefense+p.attributes.physical.agility)/3:scheme==='drop'?(d.rimProtection+d.defensiveIQ)/2:scheme==='zone'?(d.helpDefense+d.defensiveAwareness)/2:scheme==='pressure'?(d.steal+p.attributes.physical.speed+d.defensiveDiscipline)/3:(d.perimeterDefense+d.defensiveIQ)/2;
}
export function systemFitReport(team:LeagueTeam):string{
 const players=[...team.seasons].sort((a,b)=>b.minutes.target-a.minutes.target).slice(0,team.coach?.rotationDepth??10);
 const system=team.coach?.offensiveSystem??'balanced';
 const fit=players.reduce((n,p)=>n+offensiveFit(p,system),0)/Math.max(1,players.length);
 const learning=players.filter(p=>(p.training?.familiarity['offense:'+system]??15)<60).length;
 return `${fit>=70?'Strong':fit>=55?'Moderate':'Weak'} ${system} fit (${Math.round(fit)}/100). ${learning} rotation player${learning===1?' is':'s are'} still learning the offense. ${team.coachingControl?.adjustmentGames?`${team.coachingControl.adjustmentGames} staff-adjustment games remaining.`:''}`;
}
