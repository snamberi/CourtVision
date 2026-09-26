import { defaultCoachTendencies } from './league';
import type { League, LeagueTeam } from './league';
import { generateCoachIdentity, type CoachIdentity } from './coaching';
import { RNG } from './engine/rng';
import { calculateOverall } from './engine/overall';
import { COACH_ATTRIBUTES, STAFF_ROLES, SPECIALTIES, DEFAULT_COACHING_SETTINGS, clamp, stableSeed, type StaffRole, type CoachingControl, type StaffProfile } from './coachingModel';
import { initialTraining } from './playerDevelopment';

export function enrichCoach(coach:CoachIdentity,role:StaffRole,teamId?:string):CoachIdentity {
  if(coach.profile)return coach;
  const rng=new RNG(stableSeed(coach.coachId));
  const attributes=Object.fromEntries(COACH_ATTRIBUTES.map(k=>[k,clamp(30+rng.nextInt(61))])) as StaffProfile['attributes'];
  Object.assign(attributes,{offensiveStrategy:coach.traits.offense,defensiveStrategy:coach.traits.defense,rotationManagement:coach.traits.rotationMgmt,playerDevelopment:coach.traits.development,communication:coach.traits.motivation,discipline:coach.traits.discipline});
  return {...coach,profile:{attributes,specialties:[SPECIALTIES[rng.nextInt(SPECIALTIES.length)]],preferredRole:role,
    offense:['balanced','motion','pace-space','post','pick-roll','isolation'][rng.nextInt(6)],defense:['man','switch','zone','pressure','drop'][rng.nextInt(5)],
    personality:(['patient','demanding','collaborative'] as const)[rng.nextInt(3)],leadership:(['teacher','tactician','motivator'] as const)[rng.nextInt(3)],
    priority:(['salary','contender','facilities','authority'] as const)[rng.nextInt(4)],experience:0,playoffWins:0,playoffLosses:0,coyAwards:0,
    history:teamId?[{teamId,role,from:coach.hiredSeason}]:[],staffRelationships:{},developmentHistory:[]}};
}
export function staffMembers(team:LeagueTeam):{role:StaffRole;coach:CoachIdentity}[]{
  return STAFF_ROLES.flatMap(role=>{const coach=role==='head'?team.coachIdentity:team.staff?.[role];return coach?[{role,coach}]:[]});
}
export const staffSalary=(team:LeagueTeam)=>staffMembers(team).reduce((n,s)=>n+s.coach.contract.annualSalary,0);
export const staffBudget=(team:LeagueTeam)=>Math.round((9+(team.marketSize??50)*.11+(team.expenseLevels?.coaching??50)*.08)*1e6);
export function newControl(user=false):CoachingControl{return {preset:'standard',staffAuto:!user,practiceAuto:true,developmentAuto:!user,direction:'balanced',practice:[{type:'skills',intensity:'normal'},{type:'offense',intensity:'normal'},{type:'recovery',intensity:'light'},{type:'defense',intensity:'normal'},{type:'film',intensity:'light'},{type:'conditioning',intensity:'normal'},{type:'recovery',intensity:'light'}],practiceDays:0,adjustmentGames:0,payout:0,reports:[],reportBaseline:{}};}
function makeCandidate(rng:RNG,season:string,used:Set<string>,role:StaffRole,teamId?:string):CoachIdentity{
 const c=enrichCoach(generateCoachIdentity(rng,season,used),role,teamId);
 if(role!=='head')c.contract={...c.contract,annualSalary:Math.round(c.contract.annualSalary*(role==='trainer'?.10:.19))};
 return c;
}
/** Additive migration; never replace established coaches, plans, contracts or earned history. */
export function initializeCoaching(league:League,userTeamId=league.coachingUserTeamId):League{
 const used=new Set([...league.teams.flatMap(t=>staffMembers(t).map(s=>s.coach.coachId)),...(league.staffMarket??[]).map(c=>c.coachId)]);
 const season=league.season??'2026';
 const teams=league.teams.map(t=>{
  const rng=new RNG(stableSeed(t.teamId+':staff'));
  const head=t.coachIdentity?enrichCoach(t.coachIdentity,'head',t.teamId):league.coachingVersion?undefined:makeCandidate(rng,season,used,'head',t.teamId);
  const staff={...t.staff};
  for(const role of STAFF_ROLES.filter(r=>r!=='head')){if(staff[role])staff[role]=enrichCoach(staff[role]! ,role,t.teamId);else if(!t.coachingControl)staff[role]=makeCandidate(rng,season,used,role,t.teamId);}
  return {...t,coach:t.coach??defaultCoachTendencies(),coachIdentity:head,staff,coachingControl:t.coachingControl??newControl(t.teamId===userTeamId),seasons:t.seasons.map(p=>p.training?p:{...p,training:initialTraining(p,t)})};
 });
 let market=league.staffMarket;
 if(!market){const rng=new RNG(stableSeed(season+':market'));market=Array.from({length:30},(_,i)=>makeCandidate(rng,season,used,STAFF_ROLES[i%5]));}
 return {...league,coachingVersion:1,coachingUserTeamId:userTeamId,coachingSettings:{...DEFAULT_COACHING_SETTINGS,...league.coachingSettings},teams,staffMarket:market};
}
export function staffOfferAssessment(team:LeagueTeam,candidate:CoachIdentity,role:StaffRole,salary:number,years:number,league:League){
 const c=enrichCoach(candidate,role),p=c.profile!;
 const record=league.schedule.filter(g=>g.played&&(g.homeTeamId===team.teamId||g.awayTeamId===team.teamId));
 const wins=record.filter(g=>g.result&&(g.homeTeamId===team.teamId?g.result.homeScore>g.result.awayScore:g.result.awayScore>g.result.homeScore)).length;
 const competitiveness=record.length?wins/record.length:team.seasons.reduce((n,s)=>n+calculateOverall(s),0)/Math.max(1,team.seasons.length)/100;
 const rosterFit=team.seasons.length?team.seasons.reduce((n,s)=>n+(p.specialties.includes('shooting')?s.attributes.offense.threePoint:p.specialties.includes('perimeter defense')?s.attributes.defense.perimeterDefense:s.development.workEthic),0)/team.seasons.length/100:.5;
 const relationships=team.seasons.length?team.seasons.reduce((n,s)=>n+(c.relationships[s.playerId]??50),0)/team.seasons.length/100:.5;
 const demand=Math.round(candidate.contract.annualSalary*(role==='head'&&p.preferredRole!=='head'?2.5:1));
 const salaryRatio=salary/Math.max(1,demand);
 const authority=role==='head'?1:role===p.preferredRole?.8:.25;
 const facilities=(team.expenseLevels?.facilities??50)/100;
 const interest=clamp(24+Math.min(1.5,salaryRatio)*24+competitiveness*(p.priority==='contender'?22:8)+facilities*(p.priority==='facilities'?20:7)+authority*(p.priority==='authority'?20:8)+(team.marketSize??50)*.04+rosterFit*6+relationships*5+Math.min(4,years)*2-(p.priority==='salary'?Math.max(0,1.25-salaryRatio)*20:0));
 const incumbent=role==='head'?team.coachIdentity:team.staff?.[role];
 const payout=(incumbent?.contract.annualSalary??0)*(incumbent?.contract.yearsRemaining??0);
 const cost=staffSalary(team)-(incumbent?.contract.annualSalary??0)+salary+payout+(team.coachingControl?.payout??0);
 const reason=!Number.isFinite(salary)||salary<=0||!Number.isInteger(years)||years<1||years>5?'Offer a positive salary and 1–5 years.':league.coachingSettings?.staffBudgetRestrictions!==false&&cost>staffBudget(team)?'Staff budget cannot cover this offer and contract payout.':salaryRatio<.75?'Salary is below the candidate’s minimum.':interest<62?'Candidate prefers a better fit, role or offer.':null;
 return {interest:Math.round(interest),demand,payout,cost,budget:staffBudget(team),accepted:!reason,reason};
}
export function interviewCoach(team:LeagueTeam,c:CoachIdentity){const p=enrichCoach(c,'head').profile!;return [
 `Priority: ${p.priority}. ${p.priority==='contender'?'I want a team ready to win.':p.priority==='facilities'?'I need a strong practice environment.':p.priority==='authority'?'My role and decision-making authority matter.':'Competitive compensation matters to me.'}`,
 `Philosophy: ${p.offense} offense and ${p.defense} defense. My specialty is ${p.specialties.join(', ')}.`,
 `Leadership: ${p.personality} ${p.leadership}. Teaching ${Math.round(p.attributes.teaching)}/100; strategy ${Math.round((p.attributes.offensiveStrategy+p.attributes.defensiveStrategy)/2)}/100.`,
 `Roster fit: ${team.seasons.filter(s=>s.age<=24).length} young players to teach; facilities ${team.expenseLevels?.facilities??50}/100. I prefer ${p.preferredRole==='head'?'head-coach authority':p.preferredRole+' work'}.`
 ];}
export function hireStaff(league:League,teamId:string,candidateId:string,role:StaffRole,salary:number,years:number,actor:string|null,sandbox=false):{league:League;message:string}{
 if(!sandbox&&actor!==teamId)return {league,message:'You can only manage your own staff.'};
 const team=league.teams.find(t=>t.teamId===teamId),candidate=league.staffMarket?.find(c=>c.coachId===candidateId);
 if(!team||!candidate)return {league,message:'This candidate is no longer available.'};
 const assessment=staffOfferAssessment(team,candidate,role,salary,years,league);
 if(!assessment.accepted)return {league,message:assessment.reason!};
 const previous=role==='head'?team.coachIdentity:team.staff?.[role];
 const hired=enrichCoach(candidate,role);const season=league.season??'2026';
 const coach={...hired,hiredSeason:season,contract:{annualSalary:salary,yearsRemaining:years},profile:{...hired.profile!,history:[...hired.profile!.history,{teamId,role,from:season}]}};
 const control={...(team.coachingControl??newControl()),adjustmentGames:5,payout:(team.coachingControl?.payout??0)+assessment.payout,payoutSeason:season};
 const updated={...team,coachingControl:control,...(role==='head'?{coachIdentity:coach}:{staff:{...team.staff,[role]:coach}})};
 const released=previous?{...previous,profile:{...enrichCoach(previous,role).profile!,history:enrichCoach(previous,role).profile!.history.map(h=>h.to?h:{...h,to:season})}}:null;
 return {league:{...league,teams:league.teams.map(t=>t.teamId===teamId?updated:t),staffMarket:[...(league.staffMarket??[]).filter(c=>c.coachId!==candidateId),...(released?[released]:[])]},message:`Hired ${coach.coachId}. ${assessment.payout?`Contract payout: $${assessment.payout.toLocaleString()}. `:''}Allow five games for staff adjustment.`};
}
export function fireStaff(league:League,teamId:string,role:StaffRole,actor:string|null,sandbox=false):{league:League;message:string}{
 const team=league.teams.find(t=>t.teamId===teamId);if(!team||(!sandbox&&teamId!==actor))return {league,message:'You can only manage your own staff.'};
 const coach=role==='head'?team.coachIdentity:team.staff?.[role];if(!coach)return {league,message:'This position is already vacant.'};
 const payout=coach.contract.annualSalary*coach.contract.yearsRemaining;
 const staff={...team.staff};if(role!=='head')delete staff[role];
 const control={...(team.coachingControl??newControl()),payout:(team.coachingControl?.payout??0)+payout,payoutSeason:league.season,adjustmentGames:5};
 const released={...enrichCoach(coach,role),profile:{...enrichCoach(coach,role).profile!,history:enrichCoach(coach,role).profile!.history.map(h=>h.to?h:{...h,to:league.season??'2026'})}};
 return {league:{...league,teams:league.teams.map(t=>t.teamId===teamId?{...team,staff,coachingControl:control,coachIdentity:role==='head'?undefined:team.coachIdentity}:t),staffMarket:[...(league.staffMarket??[]),released]},message:`Released ${coach.coachId}. $${payout.toLocaleString()} contract payout recorded. The position can remain vacant.`};
}
export function teachingQuality(team:LeagueTeam,coachId?:string){
 const members=staffMembers(team);const coach=members.find(s=>s.coach.coachId===coachId)?.coach??team.staff?.development??team.coachIdentity;
 if(!coach)return .85;
 const p=enrichCoach(coach,'development').profile!;
 return .85+(p.attributes.teaching*.6+p.attributes.playerDevelopment*.4)/100*.4;
}
export function gameStaffCoach(team:LeagueTeam):CoachIdentity|undefined{
 if(!team.coachIdentity)return undefined;
 const head=enrichCoach(team.coachIdentity,'head');
 const blend=(key:'offense'|'defense'|'development',trait:'offense'|'defense'|'development')=>team.staff?.[key]?head.traits[trait]*.7+team.staff[key]!.traits[trait]*.3:head.traits[trait];
 return {...head,traits:{...head.traits,offense:clamp(blend('offense','offense')-(team.coachingControl?.adjustmentGames??0)*1.8),defense:clamp(blend('defense','defense')-(team.coachingControl?.adjustmentGames??0)*1.8),development:blend('development','development')}};
}
export function autoManageStaff(league:League,teamIds?:string[]):League{
 let next=league;
 for(const initial of league.teams){if(teamIds&&!teamIds.includes(initial.teamId))continue;if(!initial.coachingControl?.staffAuto)continue;
  const games=league.schedule.filter(g=>g.played&&g.result&&(g.homeTeamId===initial.teamId||g.awayTeamId===initial.teamId));
  if(games.length>=40&&games.length-(initial.coachingControl.lastStaffReviewGames??0)>=20){
   next={...next,teams:next.teams.map(t=>t.teamId===initial.teamId?{...t,coachingControl:{...t.coachingControl!,lastStaffReviewGames:games.length}}:t)};
   const wins=games.filter(g=>g.homeTeamId===initial.teamId?g.result!.homeScore>g.result!.awayScore:g.result!.awayScore>g.result!.homeScore).length;
   const strength=initial.seasons.reduce((n,p)=>n+calculateOverall(p),0)/Math.max(1,initial.seasons.length);
   if(wins/games.length<.28&&strength>=65&&initial.coachIdentity?.hiredSeason!==league.season){
    const current=next.teams.find(t=>t.teamId===initial.teamId)!;
    const candidates=(next.staffMarket??[]).filter(c=>c.traits.offense+c.traits.defense>(current.coachIdentity?.traits.offense??50)+(current.coachIdentity?.traits.defense??50)+8).sort((a,b)=>a.contract.annualSalary-b.contract.annualSalary);
    for(const c of candidates){const d=staffOfferAssessment(current,c,'head',c.contract.annualSalary,3,next).demand;const hired=hireStaff(next,current.teamId,c.coachId,'head',Math.round(d*1.1),3,current.teamId);if(hired.league!==next){next=hired.league;break;}}
   }
  }
  for(const role of STAFF_ROLES){const team=next.teams.find(t=>t.teamId===initial.teamId)!;if(role==='head'?team.coachIdentity:team.staff?.[role])continue;
   const candidates=[...(next.staffMarket??[])].sort((a,b)=>{
    const score=(c:CoachIdentity)=>{const p=enrichCoach(c,role).profile!,attr=p.attributes;const primary=role==='offense'?attr.offensiveStrategy:role==='defense'?attr.defensiveStrategy:role==='development'?attr.teaching:role==='trainer'?(p.specialties.includes('conditioning')?95:45):attr.adjustments;
     const young=team.seasons.filter(s=>s.age<=24).length/Math.max(1,team.seasons.length);return primary*.55+attr.playerDevelopment*young*.35+(p.preferredRole===role?15:0)-c.contract.annualSalary/1e6*3;};return score(b)-score(a);
   });
   for(const c of candidates){const demand=staffOfferAssessment(team,c,role,c.contract.annualSalary,2,next).demand;const result=hireStaff(next,team.teamId,c.coachId,role,Math.round(demand*1.1),2,team.teamId);if(result.league!==next){next=result.league;break;}}
  }
 }
 return next;
}
export function advanceStaffSeason(league:League,previousSeason:string,champion?:string,coyName?:string):League{
 const pool=[...(league.staffMarket??[])];
 const teams=league.teams.map(t=>{
  const control={...(t.coachingControl??newControl()),payout:0,payoutSeason:league.season,lastStaffReviewGames:0};
  const staff={...t.staff};let head=t.coachIdentity;
  for(const {role,coach}of staffMembers(t)){
   const c=enrichCoach(coach,role),p=c.profile!,attributes={...p.attributes};
   for(const k of COACH_ATTRIBUTES)attributes[k]=clamp(attributes[k]+(attributes[k]<85?.3:.08));
   const next={...c,age:c.age+1,championships:c.championships+(champion===t.teamId?1:0),contract:{...c.contract,yearsRemaining:Math.max(0,c.contract.yearsRemaining-1)},profile:{...p,attributes,experience:p.experience+1,coyAwards:p.coyAwards+(c.coachId===coyName?1:0)}};
   next.traits={offense:attributes.offensiveStrategy,defense:attributes.defensiveStrategy,development:attributes.playerDevelopment,motivation:attributes.communication,rotationMgmt:attributes.rotationManagement,discipline:attributes.discipline};
   next.rating=Math.round(Object.values(next.traits).reduce((a,b)=>a+b,0)/6);
   if(role!=='head')next.profile.developmentHistory=[...p.developmentHistory,...t.seasons.filter(player=>!player.training?.plan.coachId||player.training.plan.coachId===c.coachId).map(player=>({playerId:player.playerId,season:previousSeason,before:player.previousOverall??calculateOverall(player),after:calculateOverall(player)}))];
   const averageGrowth=t.seasons.reduce((n,player)=>n+calculateOverall(player)-(player.previousOverall??calculateOverall(player)),0)/Math.max(1,t.seasons.length);
   if(role==='development'&&averageGrowth>2){next.profile.preferredRole='head';if(next.contract.yearsRemaining===0)next.contract.annualSalary=Math.round(next.contract.annualSalary*1.15);}

   const expired=next.contract.yearsRemaining===0;
   if(expired){next.profile.history=next.profile.history.map(h=>h.to?h:{...h,to:previousSeason});if(next.age<76)pool.push(next);}
   if(role==='head')head=expired?undefined:next;else if(expired)delete staff[role];else staff[role]=next;
  }
  return {...t,coach:t.coach??defaultCoachTendencies(),coachIdentity:head,staff,coachingControl:control};
 });
 const used=new Set([...pool.map(c=>c.coachId),...teams.flatMap(t=>staffMembers(t).map(s=>s.coach.coachId))]);
 const rng=new RNG(stableSeed((league.season??'')+':new-staff'));
 for(const r of (league.retiredPlayers??[]).filter(r=>r.finalSeason===previousSeason)){
  if(used.has(r.playerId)||!rng.chance(.22))continue;
  const c=makeCandidate(new RNG(stableSeed(r.playerId+':teaching')),league.season??'2026',used,'development');
  c.coachId=r.playerId;c.age=r.finalAge;c.profile={...c.profile!,formerPlayerId:r.playerId};pool.push(c);used.add(c.coachId);
 }
 while(pool.length<30)pool.push(makeCandidate(rng,league.season??'2026',used,STAFF_ROLES[pool.length%5]));
 return autoManageStaff({...league,teams,staffMarket:pool.slice(-80)});
}

export function promoteStaff(league:League,teamId:string,coachId:string,salary:number,years:number,actor:string|null,sandbox=false){
 const t=league.teams.find(t=>t.teamId===teamId),entry=t&&staffMembers(t).find(s=>s.coach.coachId===coachId&&s.role!=='head');
 if(!t||!entry||(!sandbox&&actor!==teamId))return {league,message:'Select one of your assistants for promotion.'};
 const staff={...t.staff};delete staff[entry.role as Exclude<StaffRole,'head'>];
 const temporary={...league,teams:league.teams.map(team=>team.teamId===teamId?{...team,staff}:team),staffMarket:[...(league.staffMarket??[]),{...entry.coach,profile:entry.coach.profile?{...entry.coach.profile,history:entry.coach.profile.history.map(h=>h.to?h:{...h,to:league.season})}:undefined}]};
 const r=hireStaff(temporary,teamId,coachId,'head',salary,years,actor,sandbox);
 return r.league===temporary?{league,message:r.message}:r;
}
