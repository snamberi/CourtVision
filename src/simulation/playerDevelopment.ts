import { defaultCoachTendencies } from './league';
import { evaluateBadgeRule, badgeContext, badgeCapacity, BADGE_SPACING_GAMES, type BadgeRule } from './badgeRules';
import type { League, LeagueTeam } from './league';
import type { PlayerSeason } from './types';
import type { GameResult } from './boxscore';
import { NORMAL_BADGES } from './badges';
import { playbackForEntry } from './gamePlayback';
import { practiceHeadroom } from './engine/potential';
import { calculateOverall } from './engine/overall';
import { RNG } from './engine/rng';
import { followsRealDevelopment } from './realDevelopmentGate';
import { addDays, seasonStartDate } from './calendar';
import { FOCUS_SKILLS, TARGET_ROLES, PROJECTS, DEFAULT_COACHING_SETTINGS, clamp, stableSeed, type CoachingControl, type PlayerTraining, type DevelopmentPlan, type TrainingFocus, type PracticeSession, type ProjectKey } from './coachingModel';
import { initializeCoaching, newControl, teachingQuality, staffMembers, autoManageStaff, enrichCoach } from './staffManagement';

export const attributeValue=(p:PlayerSeason,path:string):number=>{const [group,key]=path.split('.');return Number((p.attributes[group as keyof typeof p.attributes] as unknown as Record<string,number>)?.[key]??0)};
export function recommendedPlan(p:PlayerSeason,evaluation=100):DevelopmentPlan{
 const o=p.attributes.offense,d=p.attributes.defense;
 const choices:[TrainingFocus,number][]=[['catch-and-shoot',o.catchAndShoot],['ball handling',o.ballHandling],['passing accuracy',o.passing],['rim protection',d.rimProtection],['screen navigation',d.perimeterDefense],['touch',o.touch]];
 const scouting=new RNG(stableSeed(p.playerId+':evaluation'));for(const choice of choices)choice[1]+=(scouting.next()-.5)*(100-evaluation)/4;
 const strongest=choices.sort((a,b)=>b[1]-a[1])[0][0];
 return {primary:strongest,secondary:p.age>=30?'conditioning':o.ballSecurity<50?'ball security':'consistency',intensity:'normal',targetRole:strongest==='ball handling'?'lead guard':strongest==='passing accuracy'?'secondary creator':strongest==='catch-and-shoot'?'movement shooter':strongest==='rim protection'?'interior anchor':'balanced'};
}
export function initialTraining(p:PlayerSeason,t:LeagueTeam):PlayerTraining{
 const patterns:PlayerTraining['pattern'][]=['early contributor','steady improver','late bloomer','raw project','specialist','early physical peak'];
 return {plan:recommendedPlan(p),pattern:patterns[stableSeed(p.playerId+':growth')%patterns.length],workload:0,practiceDays:0,injuredDays:0,roleFamiliarity:20,familiarity:{},teamId:t.teamId,
 badgeProgress:Object.fromEntries(p.badges.filter(id=>NORMAL_BADGES.some(b=>b.id===id)).map(id=>[id,{credit:100,qualifiedGames:0,dryGames:0,stage:'Established',reason:'Existing normal badge; sustained play is reviewed over time.'}])),
 evidence:{games:0,minutes:0,handling:0,defensiveReps:0,shots:{}},morale:{trust:50,role:50,development:50,discipline:50,promises:50},brokenPromises:0,lastConversationGame:-10,games:0,history:[]};
}
/**
 * Deep copy of plain data (objects, arrays, primitives). Training runs for every player on every calendar day, and
 * structuredClone made that the single biggest cost of simulating a season; this is several times faster.
 */
function clonePlain<T>(value:T):T{
 if(Array.isArray(value))return value.map(clonePlain) as T;
 if(value&&typeof value==='object'){const out:Record<string,unknown>={};for(const key in value)out[key]=clonePlain((value as Record<string,unknown>)[key]);return out as T;}
 return value;
}
/**
 * Training copied for an update: every part that updates edit in place gets its own copy. History entries are only
 * ever appended, never edited, so the entries themselves are shared.
 */
export function copyTraining(tr:PlayerTraining):PlayerTraining{
 const out:PlayerTraining={...tr,plan:{...tr.plan},familiarity:{...tr.familiarity},morale:{...tr.morale},history:tr.history.slice()};
 const badges:PlayerTraining['badgeProgress']={};for(const id in tr.badgeProgress)badges[id]={...tr.badgeProgress[id]};out.badgeProgress=badges;
 const shots:PlayerTraining['evidence']['shots']={};for(const k in tr.evidence.shots)shots[k]={...tr.evidence.shots[k]};out.evidence={...tr.evidence,shots};
 if(tr.project)out.project={...tr.project};
 if(tr.promise)out.promise={...tr.promise};
 if(tr.pendingChanges)out.pendingChanges={...tr.pendingChanges};
 return out;
}
/** Ratings copied for practice, which edits them in place (each group is a flat set of numbers). */
function copyAttributes(a:PlayerSeason['attributes']):PlayerSeason['attributes']{
 const out:Record<string,unknown>={};
 for(const group in a){const v=(a as unknown as Record<string,unknown>)[group];out[group]=v&&typeof v==='object'?{...v}:v;}
 return out as unknown as PlayerSeason['attributes'];
}
/** Coaching control copied for an update. Practice-log and report entries are only ever added, never edited. */
function copyControl(c:CoachingControl):CoachingControl{
 const out:Record<string,unknown>={};
 for(const key in c){const v=(c as unknown as Record<string,unknown>)[key];out[key]=(key==='reports'||key==='practiceLog')&&Array.isArray(v)?v.slice():clonePlain(v);}
 return out as unknown as CoachingControl;
}
const cloneTraining=(p:PlayerSeason,t:LeagueTeam):PlayerTraining=>copyTraining(p.training??initialTraining(p,t));
export function planOpportunity(p:PlayerSeason):string{
 const tr=p.training;if(!tr)return 'Choose a development plan to direct practice.';
 const mpg=tr.evidence.games?tr.evidence.minutes/tr.evidence.games:0;
 if(tr.workload>70)return 'Excessive workload is reducing training quality. Recovery or fewer minutes would help.';
 if(['lead guard','secondary creator','bench creator'].includes(tr.plan.targetRole)&&tr.evidence.games>=5&&tr.evidence.handling/Math.max(1,tr.evidence.minutes)<.25)return 'Limited ball-handling opportunities are slowing progress toward a creator role.';
 if(tr.evidence.games>=5&&mpg<8)return 'Game experience is limited; good practices can still support growth.';
 return 'The current role supports this plan. Improvement remains uncertain and slows at high ratings.';
}
export function setDevelopmentPlan(league:League,playerId:string,patch:Partial<DevelopmentPlan>,actor:string|null,sandbox=false):{league:League;message:string}{
 const team=league.teams.find(t=>t.seasons.some(p=>p.playerId===playerId));
 if(!team||(!sandbox&&team.teamId!==actor))return {league,message:'Development plans can only be changed for your own team.'};
 const p=team.seasons.find(p=>p.playerId===playerId)!,training=cloneTraining(p,team),plan={...training.plan,...patch};
 if(!(plan.primary in FOCUS_SKILLS)||!(plan.secondary in FOCUS_SKILLS)||!['light','normal','hard'].includes(plan.intensity)||!TARGET_ROLES.includes(plan.targetRole))return {league,message:'Choose a valid training focus and intensity.'};
 if(plan.coachId&&!staffMembers(team).some(s=>s.coach.coachId===plan.coachId))return {league,message:'The assigned coach must be on this staff.'};
 if(plan.mentorId){const mentor=team.seasons.find(s=>s.playerId===plan.mentorId);if(!mentor||mentor.age<27||mentor.age<p.age+4||mentor.playerId===p.playerId)return {league,message:'Choose a teammate age 27+ and at least four years older.'};
  if(team.seasons.filter(s=>s.playerId!==playerId&&s.training?.plan.mentorId===plan.mentorId).length>=2)return {league,message:'Each mentor can effectively guide at most two players.'};}
 if(training.plan.mentorId!==plan.mentorId)training.mentorBond=50;
 training.plan=plan;
 return {league:{...league,teams:league.teams.map(t=>t.teamId===team.teamId?{...t,seasons:t.seasons.map(s=>s.playerId===playerId?{...s,training}:s)}:t)},message:'Development plan saved. Focusing here leaves less practice time for other skills.'};
}
export function setPlayerProject(league:League,playerId:string,key:ProjectKey|null,actor:string|null,sandbox=false):League{
 return {...league,teams:league.teams.map(t=>{if(!sandbox&&t.teamId!==actor)return t;return {...t,seasons:t.seasons.map(p=>{if(p.playerId!==playerId)return p;const tr=cloneTraining(p,t);tr.project=key?{key,progress:0,started:league.calendarDate??seasonStartDate(league.season),days:0,status:'active',obstacle:''}:undefined;return {...p,training:tr};})};})};
}
export function mentorshipQuality(p:PlayerSeason,team:LeagueTeam):number{
 const mentor=team.seasons.find(s=>s.playerId===p.training?.plan.mentorId);if(!mentor||mentor.age<27||mentor.age<p.age+4)return 0;
 const load=team.seasons.filter(s=>s.training?.plan.mentorId===mentor.playerId).length;if(load>2)return 0;
 const paths=FOCUS_SKILLS[p.training!.plan.primary];const skill=paths.reduce((n,k)=>n+attributeValue(mentor,k),0)/paths.length;
 const relationship=(p.training?.mentorBond??50)/100;
 return clamp((skill+mentor.attributes.mental.leadership+mentor.development.workEthic)/300*relationship*(.5+(p.training?.roleFamiliarity??0)/200),0,1);
}
export const CONVERSATIONS={bench:'Explain a bench role',compete:'Offer a rotation opportunity',training:'Discuss a training change',mentor:'Discuss mentorship',workload:'Address excessive workload',reduced:'Explain a reduced role'} as const;
export function discussRole(league:League,playerId:string,kind:keyof typeof CONVERSATIONS,actor:string|null,sandbox=false):{league:League;message:string}{
 const t=league.teams.find(t=>t.seasons.some(p=>p.playerId===playerId));if(!t||(!sandbox&&actor!==t.teamId))return {league,message:'You can only hold role discussions with your own players.'};
 const p=t.seasons.find(p=>p.playerId===playerId)!,tr=cloneTraining(p,t);
 if(tr.games-tr.lastConversationGame<5)return {league,message:'Give the player five team games before another discussion.'};
 if(tr.promise&&(kind==='compete'||kind==='workload'))return {league,message:'Resolve the current promise before making another.'};
 const communication=t.coachIdentity?enrichCoach(t.coachIdentity,'head').profile!.attributes.communication:40;
 const accepts=new RNG(stableSeed(playerId+kind+tr.games)).next()<(.25+communication/200+(p.attributes.mental.discipline/400));
 tr.lastConversationGame=tr.games;
 tr.morale.trust=clamp(tr.morale.trust+(accepts?3:-1));tr.morale.role=clamp(tr.morale.role+(accepts?4:0));
 if(kind==='training')tr.morale.development=clamp(tr.morale.development+(accepts?5:0));
 if(kind==='compete'||kind==='workload')tr.promise={kind:kind==='compete'?'rotation':'workload',remaining:10,achieved:0,required:kind==='compete'?4:7,failures:tr.brokenPromises};
 if(kind==='mentor'&&!tr.plan.mentorId)return {league,message:'Choose an eligible mentor in the development plan first.'};
 const text=`${CONVERSATIONS[kind]}: ${accepts?'the player accepted the explanation.':'the player remains unconvinced.'}${tr.promise?(kind==='compete'?' Promise: at least 12 minutes in four of the next ten available games.':kind==='workload'?' Promise: at most 30 minutes in seven of the next ten available games.':''):''}`;
 tr.history.push({date:league.calendarDate??'',season:league.season??'',kind:'conversation',text});
 return {league:{...league,teams:league.teams.map(team=>team.teamId===t.teamId?{...team,seasons:team.seasons.map(s=>s.playerId===playerId?{...s,training:tr}:s)}:team)},message:text};
}
export function practiceForDate(team:LeagueTeam,date:string,gameToday:boolean,playoffs=false):PracticeSession{
 const c=team.coachingControl??newControl();
 if(!c.practiceAuto)return c.practice[(new Date(date+'T12:00:00Z').getUTCDay()+6)%7]??{type:'recovery',intensity:'light'};
 const gap=c.lastGameDate?Math.round((Date.parse(date)-Date.parse(c.lastGameDate))/86400000):3;
 const tired=team.seasons.some(p=>(p.training?.workload??0)>65);
 if(gap<=1||tired)return {type:'recovery',intensity:'light'};
 if(playoffs)return {type:'film',intensity:'light'};
 if(gameToday)return {type:'film',intensity:'light'};
 return {type:['offense','defense','skills','conditioning'][new Date(date).getUTCDay()%4] as PracticeSession['type'],intensity:gap>=4?'hard':'normal'};
}
export function practicePreview(session:PracticeSession):string{
 if(session.type==='recovery')return 'Reduces workload; little skill development. Injured players always receive restricted work.';
 return `${session.type==='offense'||session.type==='defense'?'Improves system familiarity':session.type==='film'?'Builds understanding with low physical demand':'Develops individual skills'}; ${session.intensity==='hard'?'more opportunity and greater fatigue':session.intensity==='light'?'less training volume and lower fatigue':'balanced training volume and fatigue'}.`;
}
function changeSkill(p:PlayerSeason,path:string,gain:number,cap:number){const [group,key]=path.split('.');const attrs=p.attributes[group as keyof typeof p.attributes] as unknown as Record<string,number>;if(typeof attrs[key]!=='number')return;attrs[key]=clamp(attrs[key]+gain,0,Math.max(cap,attrs[key]));}
function advanceProject(p:PlayerSeason,tr:PlayerTraining,team:LeagueTeam,quality:number,date:string,injured:boolean,ratingsLocked=false){
 const project=tr.project;if(!project||project.status==='completed')return;
 const definition=PROJECTS[project.key];project.days++;
 const relevant=tr.plan.primary===definition.focus||tr.plan.secondary===definition.focus;
 const specialist=staffMembers(team).some(s=>s.coach.profile?.specialties.includes(definition.specialty));
 const opportunity=definition.focus==='secondary handler'||project.key==='bench-creator'?Math.min(1,tr.evidence.handling/Math.max(1,tr.evidence.games*12)):.8;
 const blocked=injured||tr.workload>80;
 const progress=blocked?0:quality*(relevant?.34:.10)*(specialist?1.15:1)*(.55+opportunity*.45);
 project.progress=clamp(project.progress+progress);
 project.obstacle=injured?'Injury restriction':tr.workload>80?'High workload':!relevant?'Current training focuses do not match this project':!specialist?'No matching staff specialty':opportunity<.4?'Limited relevant game opportunities':'';
 project.status=blocked?'stalled':'active';
 if(project.progress>=100){
  const suitable=project.key!=='defend-position'||(p.attributes.physical.heightInches>=75&&p.attributes.physical.speed>=55);
  if(attributeValue(p,definition.skill)<definition.threshold||!suitable){project.status='partial';project.obstacle=!suitable?'Physical suitability is not ready for another position':`Needs ${definition.threshold} in ${definition.skill.split('.')[1]}`;return;}
  project.status='completed';project.obstacle='';
  // Real Player Development owns a real player's ratings and positions: the project still builds role familiarity.
  if(ratingsLocked){if(project.key==='secondary-playmaker'||project.key==='bench-creator')tr.roleFamiliarity=clamp(tr.roleFamiliarity+10);tr.history.push({date,season:p.season,kind:'project',text:`Completed: ${definition.name}. Real Player Development is on, so ratings and positions follow his real trajectory; only role familiarity changes.`});return;}
  if(project.key==='defend-position'){const pos=['PG','SG','SF','PF','C'] as const;const index=pos.reduce((best,k,i)=>p.positions[k]>p.positions[pos[best]]?i:best,0);const other=pos[index===4?3:index+1];if((other!=='C'||p.attributes.physical.heightInches>=80))p.positions={...p.positions,[other]:clamp(p.positions[other]+8)};}
  if(project.key==='secondary-playmaker'||project.key==='bench-creator')tr.roleFamiliarity=clamp(tr.roleFamiliarity+10);
  tr.history.push({date,season:p.season,kind:'project',text:`Completed: ${definition.name}. ${definition.impact}`});
 }
}
function trainDay(team:LeagueTeam,league:League,date:string,gameToday:boolean):LeagueTeam{
 const control=copyControl(team.coachingControl??newControl());
 const session=practiceForDate(team,date,gameToday,league.seasonPhase==='playoffs');
 const settings={...DEFAULT_COACHING_SETTINGS,...league.coachingSettings};
 const seasons=team.seasons.map(original=>{
  const p={...original,attributes:copyAttributes(original.attributes)},tr=cloneTraining(original,team);p.training=tr;
  if(tr.teamId!==team.teamId){for(const key of Object.keys(tr.familiarity))tr.familiarity[key]*=.7;tr.teamId=team.teamId;tr.plan.mentorId=undefined;tr.plan.coachId=undefined;tr.roleFamiliarity*=.75;}
  if(tr.plan.mentorId&&!team.seasons.some(s=>s.playerId===tr.plan.mentorId))tr.plan.mentorId=undefined;
  if(tr.plan.coachId&&!staffMembers(team).some(s=>s.coach.coachId===tr.plan.coachId))tr.plan.coachId=undefined;
  const injured=(league.injuries?.[p.playerId]?.gamesRemaining??0)>0;
  tr.practiceDays++;if(injured)tr.injuredDays++;
  const intensity=(session.intensity==='hard'?1.3:session.intensity==='light'?.65:1)*(tr.plan.intensity==='hard'?1.15:tr.plan.intensity==='light'?.8:1);
  const trainer=team.staff?.trainer?.profile?.attributes.playerDevelopment??0;
  const load=session.type==='recovery'||injured?-18-trainer/20:session.type==='film'?-10: intensity*10-8;
  tr.workload=settings.trainingFatigue===0?0:clamp(tr.workload+load*(settings.trainingFatigue/100));
  if(tr.plan.mentorId)tr.mentorBond=clamp((tr.mentorBond??50)+.12*(settings.mentorshipImpact/100));
  const mentor=mentorshipQuality(p,team)*(settings.mentorshipImpact/100);
  const teach=1+(teachingQuality(team,tr.plan.coachId)-1)*(league.rulesSettings?.coachingImpact??100)/100;
  const quality=teach*(.55+p.development.workEthic/180)*(1-tr.workload/140)*(1+mentor*.15)*(injured?.25:1);
  const familiarGain=(session.type==='offense'||session.type==='defense'?1.1:session.type==='film'?.65:.2)*settings.familiaritySpeed/100*(.7+(team.coachIdentity?.profile?.attributes.adaptability??50)/100);
  for(const [side,system] of [['offense',team.coach?.offensiveSystem??'balanced'],['defense',team.coach?.defensiveScheme??'man']] as const){const key=side+':'+system;if(tr.familiarity[key]==null){const relatives=Object.entries(tr.familiarity).filter(([k])=>k.startsWith(side+':')).map(([,v])=>v);tr.familiarity[key]=Math.max(12,...relatives.map(v=>v*.45));}tr.familiarity[key]=clamp(tr.familiarity[key]+familiarGain*(session.type===side?1.5:1));}
  tr.roleFamiliarity=clamp(tr.roleFamiliarity+.12*(1+mentor));
  const rng=new RNG(stableSeed(p.playerId+date+':practice'));
  const variance=clamp((league.rulesSettings?.developmentRandomness??100)/100,0,2);
  const roll=rng.next();
  // Real players under Real Player Development keep their base ratings; practice still drives workload, familiarity and morale.
  const ratingsLocked=followsRealDevelopment(p,league);
  if(!ratingsLocked&&!injured&&session.type!=='recovery'&&(variance===0||roll<clamp(.25+quality*.22,0,.8))){
   const focus=rng.next()<.72?tr.plan.primary:tr.plan.secondary;
   const paths=session.type==='conditioning'?FOCUS_SKILLS.conditioning:FOCUS_SKILLS[focus];
   // Practice builds toward a player's ceiling; players in their prime mostly maintain (see engine/potential).
   const headroom=practiceHeadroom(p,league.rulesSettings);
   for(const path of paths){const current=attributeValue(p,path);const highRating=Math.max(.08,1-current/(league.settings.sandboxMode?220:112));const ageFactor=path.startsWith('physical.')&&p.age>=29?.25:p.age>33?.4:1;
    const gain=.045*quality*intensity*highRating*ageFactor*headroom*(variance===0?.45:1)*((league.rulesSettings?.developmentSpeed??100)/100);
    changeSkill(p,path,gain,league.settings.sandboxMode?200:100);
    tr.pendingChanges??={};tr.pendingChanges[path]=(tr.pendingChanges[path]??0)+(attributeValue(p,path)-current);
   }
  }
  advanceProject(p,tr,team,quality,date,injured,ratingsLocked);
  return p;
 });
 control.practiceDays++;control.lastPracticeDate=date;control.practiceLog=[...(control.practiceLog??[]),{date,...session}].slice(-28);
 const reportKind=control.practiceDays%28===0?'monthly':control.practiceDays%7===0?'weekly':null;
 if(reportKind&&(settings.reportFrequency==='weekly'||settings.reportFrequency==='monthly'&&reportKind==='monthly')){
  const completed=control.practiceLog.slice(reportKind==='weekly'?-7:-28);
  const items=[`Completed practices: ${completed.map(s=>`${s.date}: ${s.type} (${s.intensity})`).join('; ')}`, ...seasons.map(p=>{
   const tr=p.training!,delta=calculateOverall(p)-(control.reportBaseline[p.playerId]??calculateOverall(p));
   return `${p.playerId}: ${tr.plan.primary}; workload ${tr.workload.toFixed(0)}/100${reportKind==='monthly'?`; OVR ${delta>=0?'+':''}${delta.toFixed(1)}; system ${Math.round(tr.familiarity['offense:'+(team.coach?.offensiveSystem??'balanced')]??0)}%`:''}${tr.project?`; ${PROJECTS[tr.project.key].name} ${tr.project.progress.toFixed(0)}% (${tr.project.status})`:''}. ${planOpportunity(p)}`;
  })];
  if(reportKind==='monthly')for(const p of seasons){const tr=p.training!;tr.history.push({date,season:p.season,kind:'training',text:`Monthly training: ${tr.plan.primary}; workload ${Math.round(tr.workload)}/100; ${planOpportunity(p)}`,changes:{...tr.pendingChanges}});tr.pendingChanges={};}
  if(reportKind==='monthly'&&team.rotationReview)items.push(...team.rotationReview.changes.map(c=>`${c.playerId}: ${c.reason}`));
  control.reports=[{date,season:league.season??'',kind:reportKind as 'weekly'|'monthly',summary:`${reportKind==='weekly'?'Weekly workload and training':'Monthly development and rotation'} report. Last practice: ${session.type}, ${session.intensity}. Temporary workload is separate from permanent ratings.`,items},...control.reports].slice(0,104);
  if(reportKind==='monthly')for(const p of seasons)control.reportBaseline[p.playerId]=calculateOverall(p);
 }
 return {...team,seasons,coachingControl:control};
}
/** Runs each team's calendar practice once, including days between games. No UI-only training ticks. */
export function prepareCoachingForGame(raw:League,teamIds:string[],date:string):League{
 let league=raw.coachingVersion===1?raw:initializeCoaching(raw);
 league=autoManageStaff(league,teamIds);
 const teams=league.teams.map(original=>{
  if(!teamIds.includes(original.teamId))return original;
  let t={...original,coachingControl:copyControl(original.coachingControl??newControl()),seasons:original.seasons.map(p=>{if(!p.training)return {...p,training:initialTraining(p,original)};if(p.training.teamId===original.teamId)return p;const tr=cloneTraining(p,original);for(const key of Object.keys(tr.familiarity))tr.familiarity[key]*=.7;tr.teamId=original.teamId;tr.plan.mentorId=undefined;tr.plan.coachId=undefined;tr.roleFamiliarity*=.75;return {...p,training:tr};})};
  const roster=t.seasons.map(p=>p.playerId).sort().join('|');
  const c=t.coachingControl;
  if(c.developmentAuto&&(c.lastRoster!==roster||c.practiceDays-(c.lastAIReview??-28)>=28)){
   t={...t,seasons:t.seasons.map(p=>{const tr=cloneTraining(p,t);tr.plan={...recommendedPlan(p,t.coachIdentity?.profile?.attributes.talentEvaluation??50),mentorId:tr.plan.mentorId};if(p.age>=31&&tr.workload>55)tr.plan.intensity='light';return {...p,training:tr}})};
   const mentorLoads=new Map<string,number>();
   t={...t,seasons:t.seasons.map(p=>{const tr=cloneTraining(p,t);if(p.age<=24){const mentors=t.seasons.filter(m=>m.age>=27&&m.age>=p.age+4&&(mentorLoads.get(m.playerId)??0)<2).sort((a,b)=>(b.attributes.mental.leadership+b.development.workEthic)-(a.attributes.mental.leadership+a.development.workEthic));const mentor=mentors[0];tr.plan.mentorId=mentor?.playerId;if(mentor)mentorLoads.set(mentor.playerId,(mentorLoads.get(mentor.playerId)??0)+1);
    if(!tr.project){const key:ProjectKey=tr.plan.targetRole==='movement shooter'?'corner-three':tr.plan.targetRole==='interior anchor'?'interior-strength':tr.plan.targetRole==='lead guard'?'secure-handle':'secondary-playmaker';tr.project={key,progress:0,started:date,days:0,status:'active',obstacle:''};}
   }return {...p,training:tr};})};
   if(t.teamId!==league.coachingUserTeamId){const avgAge=t.seasons.reduce((n,p)=>n+p.age,0)/Math.max(1,t.seasons.length);c.direction=avgAge<26?'rebuild':'contend';t={...t,coach:{...defaultCoachTendencies(),...t.coach,rotationPolicy:{starters:[],closing:[],smallBall:[],defensive:[],allowStarterChanges:true,allowOverrides:true,...t.coach?.rotationPolicy,mode:c.direction==='rebuild'?'development':'playoff'}}};}
   c.lastAIReview=c.practiceDays;
   if(c.lastRoster!==roster){const avg=(key:'threePoint'|'postControl'|'passing')=>t.seasons.reduce((n,p)=>n+p.attributes.offense[key],0)/Math.max(1,t.seasons.length);const system=avg('threePoint')>72?'pace-space':avg('postControl')>avg('passing')+8?'post':avg('passing')>65?'motion':'balanced';t={...t,coach:{...defaultCoachTendencies(),...t.coach,offensiveSystem:system}};}
   c.lastRoster=roster;
  }
  const last=c.lastPracticeDate??addDays(date,-1);
  const count=Math.max(0,Math.min(180,Math.round((Date.parse(date)-Date.parse(last))/86400000)));
  for(let i=1;i<=count;i++)t=trainDay(t,league,addDays(last,i),i===count) as typeof t;
  return t;
 });
 return {...league,teams};
}
export function badgeRequirements(p:PlayerSeason,id:string):{eligible:boolean;description:string;rule?:BadgeRule}{
 return evaluateBadgeRule(id,badgeContext(p,attributeValue));
}
/** What a game's possessions add to each player's development evidence: ball-handling touches, defensive possessions and shots by type. */
export interface GameEvidence {shots:Record<string,Record<string,{attempts:number;makes:number}>>;handling:Record<string,number>;defense:Record<string,number>}
export function gameEvidence(result:GameResult):GameEvidence{
 const shots:GameEvidence['shots']={},handling:Record<string,number>={},defense:Record<string,number>={};
 for(const entry of result.possessionLog){const play=playbackForEntry(entry);handling[entry.ballHandlerId]=(handling[entry.ballHandlerId]??0)+1;
  const defending=entry.offenseTeamId===result.homeTeamId?entry.onCourtAway:entry.onCourtHome;for(const id of defending)defense[id]=(defense[id]??0)+1;
  if(play.shooterId&&play.shotType&&!play.freeThrows){const buckets=shots[play.shooterId]??={};const s=buckets[play.shotType]??={attempts:0,makes:0};s.attempts++;if(play.shotMade)s.makes++;}}
 return {shots,handling,defense};
}
/** `evidence` lets a game simulated elsewhere (a background engine worker) be applied without shipping its possession log back. */
export function finishCoachingGame(league:League,result:GameResult,playoffs=false,evidence?:GameEvidence):League{
 const date=league.calendarDate??seasonStartDate(league.season);
 let computed=evidence;
 return {...league,teams:league.teams.map(team=>{
  const box=team.teamId===result.homeTeamId?result.homeBox:team.teamId===result.awayTeamId?result.awayBox:null;if(!box)return team;
  computed??=gameEvidence(result);
  const {shots,handling,defense}=computed;
  const seasons=team.seasons.map(original=>{const p={...original,badges:[...original.badges]},tr=cloneTraining(original,team);p.training=tr;tr.games++;
   const line=box.players[p.playerId],minutes=line?.minutes??0,available=!(league.injuries?.[p.playerId]?.gamesRemaining);
   const trait=team.staff?.trainer?.profile?.attributes.playerDevelopment??0;
   tr.workload=clamp(tr.workload+Math.max(0,minutes-12)*.75*(1-trait/500)*(league.coachingSettings?.trainingFatigue??100)/100);
   if(minutes>0){tr.evidence.games++;tr.evidence.minutes+=minutes;tr.evidence.handling+=handling[p.playerId]??0;tr.evidence.defensiveReps+=defense[p.playerId]??0;
    for(const [k,s]of Object.entries(shots[p.playerId]??{})){const old=tr.evidence.shots[k]??{attempts:0,makes:0};tr.evidence.shots[k]={attempts:old.attempts+s.attempts,makes:old.makes+s.makes};}
    for(const key of ['offense:'+(team.coach?.offensiveSystem??'balanced'),'defense:'+(team.coach?.defensiveScheme??'man')])tr.familiarity[key]=clamp((tr.familiarity[key]??15)+minutes/35*(league.coachingSettings?.familiaritySpeed??100)/100);
    const creator=['lead guard','secondary creator','bench creator'].includes(tr.plan.targetRole);
    tr.roleFamiliarity=clamp(tr.roleFamiliarity+(creator?Math.min(1,(handling[p.playerId]??0)/20):Math.min(1,minutes/25)));
   }
   if(available){const expected=Math.max(8,p.minutes.target);tr.morale.role=clamp(tr.morale.role+clamp((minutes-expected)/25,-.6,.4));
    if(tr.promise){tr.promise.remaining--;if(tr.promise.kind==='rotation'?minutes>=12:minutes<=30)tr.promise.achieved++;
     if(tr.promise.remaining<=0){const met=tr.promise.achieved>=tr.promise.required;tr.morale.promises=clamp(tr.morale.promises+(met?8:-8-tr.brokenPromises*3));tr.morale.trust=clamp(tr.morale.trust+(met?4:-6-tr.brokenPromises*2));if(!met)tr.brokenPromises++;tr.history.push({date,season:p.season,kind:'conversation',text:`${met?'Kept':'Broke'} ${tr.promise.kind} promise: ${tr.promise.achieved}/${tr.promise.required} qualifying games.`});tr.promise=undefined;}}
   }
   if(minutes>=8){let earnedToday=false;const capacity=badgeCapacity(calculateOverall(p));for(const badge of NORMAL_BADGES){const requirement=badgeRequirements(p,badge.id);const old=tr.badgeProgress[badge.id]??{credit:0,qualifiedGames:0,dryGames:0,stage:'Developing' as const,reason:requirement.description};
     const relevant=Object.keys(badge.effect.attributeModifiers??{}).some(k=>(FOCUS_SKILLS[tr.plan.primary] as readonly string[]).includes(k));
     const rule=requirement.rule;
     if(requirement.eligible){old.qualifiedGames++;old.dryGames=0;old.credit=clamp(old.credit+(rule?.rate??1.4)+(relevant?.4:0)+mentorshipQuality(p,team)*.3);}else if(tr.evidence.games>=25){old.dryGames++;if(old.dryGames>15)old.credit=clamp(old.credit-1);}
     // One badge at a time: a spacing between new badges, and no more badges than his overall can carry.
     const held=p.badges.filter(id=>NORMAL_BADGES.some(b=>b.id===id)).length,spaced=tr.games-(tr.lastBadgeGame??-999)>=BADGE_SPACING_GAMES;
     if(!p.badges.includes(badge.id)&&!earnedToday&&spaced&&held<capacity&&old.credit>=100&&old.qualifiedGames>=(rule?.games??30)){p.badges.push(badge.id);earnedToday=true;tr.lastBadgeGame=tr.games;tr.history.push({date,season:p.season,kind:'badge',text:`Earned ${badge.name}: ${rule?.text??'sustained ability and quality opportunities.'}`});}
     if(p.badges.includes(badge.id)&&old.credit<60&&old.dryGames>=40){p.badges=p.badges.filter(id=>id!==badge.id);tr.history.push({date,season:p.season,kind:'badge',text:`${badge.name} regressed after a prolonged drop in supporting ability or role opportunities.`});}
     old.stage=p.badges.includes(badge.id)?'Established':old.credit>=75?'Close to earning':'Developing';old.reason=requirement.description;tr.badgeProgress[badge.id]=old;
   }}
   return p;
  });
  const c={...(team.coachingControl??newControl()),lastGameDate:date,adjustmentGames:Math.max(0,(team.coachingControl?.adjustmentGames??0)-1)};
  let coach=team.coachIdentity;
  if(coach?.profile){const profile={...coach.profile,staffRelationships:{...coach.profile.staffRelationships}};const won=team.teamId===result.homeTeamId?result.homeScore>result.awayScore:result.awayScore>result.homeScore;
   if(playoffs){profile.playoffWins+=won?1:0;profile.playoffLosses+=won?0:1;}
   for(const s of staffMembers(team))if(s.coach.coachId!==coach.coachId)profile.staffRelationships[s.coach.coachId]=clamp((profile.staffRelationships[s.coach.coachId]??50)+(won?.12:-.08));
   coach={...coach,profile,relationships:{...coach.relationships}};for(const p of seasons)coach.relationships[p.playerId]=clamp((coach.relationships[p.playerId]??50)+(p.training!.morale.trust-50)/500*(league.coachingSettings?.moraleImpact??100)/100);
  }
  return {...team,seasons,coachIdentity:coach,coachingControl:c};
 })};
}
export function recordOffseasonDevelopment(before:PlayerSeason,after:PlayerSeason,team:LeagueTeam,date:string,note?:string):PlayerSeason{
 const training=cloneTraining(before,team),changes:Record<string,number>={};
 for(const group of ['offense','defense','mental','physical'] as const)for(const key of Object.keys(before.attributes[group])){const path=group+'.'+key,delta=attributeValue(after,path)-attributeValue(before,path);if(Math.abs(delta)>.001)changes[path]=Math.round(delta*100)/100;}
 training.history.push({date,season:before.season,kind:'offseason',text:`OVR ${calculateOverall(before).toFixed(1)} → ${calculateOverall(after).toFixed(1)}. ${note??`Focus: ${training.plan.primary}. Permanent gains and decline; workload resets after the offseason.`}`,changes});
 training.workload=0;training.evidence={games:0,minutes:0,handling:0,defensiveReps:0,shots:{}};training.practiceDays=0;training.injuredDays=0;
 return {...after,training};
}

/** Six-week offseason training block. It advances projects without aging players twice. */
export function offseasonTrainingCamp(league:League):League{
 const start=league.calendarDate??seasonStartDate(league.season);
 return {...league,teams:league.teams.map(original=>{let team=original;for(let day=1;day<=42;day++)team=trainDay(team,league,addDays(start,day),false);return team;})};
}
