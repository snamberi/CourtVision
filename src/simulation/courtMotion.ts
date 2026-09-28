import type { PossessionLogEntry, PossessionPlayback } from './boxscore';
import { playbackForEntry } from './gamePlayback';

export interface CourtPoint { x:number; y:number }
export interface CourtBall extends CourtPoint { z:number; spin:number }
export type CourtPose='run'|'guard'|'shoot'|'reach'|'idle'|'dribble'|'celebrate'|'screen'|'rebound'|'pass';
export type CourtAnimKind='jumper'|'layup'|'dunk'|'ft'|'pass'|'rebound'|'celebrate';
/** Presentation only: which animation a player is in and how far through it (0-1), and where he is in his run cycle. */
export interface CourtActor extends CourtPoint { id:string; teamId:string; jump:number; stride:number; pose:CourtPose; facing:number; anim?:{kind:CourtAnimKind;t:number}; cycle?:number }
export interface CourtCallout { text:string; x:number; y:number; t:number; tone:'make'|'defense'|'neutral' }
export interface CourtFrame {
 players:CourtActor[]; ball:CourtBall; phase:string; carrier?:string; hoop:CourtPoint; net:number; attackRight:boolean; shotAttempt?:number;
 /** Presentation-only extras; derived from the recorded log, never from simulation randomness. */
 offenseTeamId?:string; callout?:CourtCallout; rim?:number; shotFrom?:CourtPoint;
}
export interface CourtShot extends CourtPoint { made:boolean; three:boolean; teamId:string; dunk:boolean }

const limit=(v:number,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));
const ease=(v:number)=>{const t=limit(v);return t*t*(3-2*t)};
const window01=(v:number,a:number,b:number)=>limit((v-a)/(b-a));
export const courtLerp=(a:CourtPoint,b:CourtPoint,t:number):CourtPoint=>({x:a.x+(b.x-a.x)*limit(t),y:a.y+(b.y-a.y)*limit(t)});
const seed=(id:string)=>[...id].reduce((h,c)=>(Math.imul(h,31)+c.charCodeAt(0))>>>0,17);
const THREES=['corner3','aboveBreak3','pullUp3','catchAndShoot3','stepback'];
const CLOSE=['rim','close','dunk','layup','hook','postShot'];

/** Ballistic height under constant downward acceleration, with prescribed release/catch heights.
 * Outcomes come from the game log; this never calls the simulation RNG or changes a box score. */
export function ballFlight(a:CourtPoint,b:CourtPoint,t:number,startHeight:number,endHeight:number,seconds:number):CourtBall {
 const u=limit(t),p=courtLerp(a,b,u);
 return {...p,z:Math.max(0,startHeight+(endHeight-startHeight)*u+100*seconds*seconds*u*(1-u)),spin:u*720};
}
export function replayDuration(entry:PossessionLogEntry):number {
 const p=playbackForEntry(entry);
 // A full possession: inbound or outlet, the walk-up, ball movement, the action and the finish.
 return 9400+(entry.action==='transition'?-1600:0)+(entry.secondChance?-2800:0)+(p.freeThrows?.attempted??0)*1750;
}

interface Geometry { right:boolean; mirror:(v:CourtPoint)=>CourtPoint; salt:number; sign:number; close:boolean; three:boolean; onlyFT:boolean; ftCount:number; shooter:string; handler:string }
function geometry(entry:PossessionLogEntry,play:PossessionPlayback,homeId:string,regulationPeriods:number):Geometry {
 const offHome=entry.offenseTeamId===homeId,secondHalf=entry.quarter>Math.ceil(regulationPeriods/2),right=offHome!==secondHalf;
 const handler=play.passerId??entry.ballHandlerId,shooter=play.shooterId??handler;
 const salt=seed(shooter+entry.clockSeconds+entry.action),ftCount=play.freeThrows?.attempted??0;
 return { right, mirror:(v)=>({x:right?v.x:1000-v.x,y:v.y}), salt, sign:salt%2?1:-1, close:CLOSE.includes(play.shotType??''), three:THREES.includes(play.shotType??''),
  onlyFT:entry.result==='FOUL'&&ftCount>0, ftCount, shooter, handler };
}
/** Floor location of the recorded attempt (attacking the right basket before mirroring). */
function shotPoint(play:PossessionPlayback,g:Geometry,freeThrow:boolean):CourtPoint {
 const {sign,salt}=g,type=play.shotType??'';
 if(freeThrow) return {x:758,y:310};
 if(type==='dunk') return {x:872,y:310+sign*12};
 if(type==='rim'||type==='layup') return {x:864,y:310+sign*18};
 if(type==='close') return {x:846,y:310+sign*30};
 if(type==='hook'||type==='postShot') return {x:836,y:310+sign*44};
 if(type==='corner3') return {x:852,y:sign>0?512:108};
 if(THREES.includes(type)) { const a=(salt%70-35)/100*1.9; return {x:900-258*Math.cos(a),y:310+258*Math.sin(a)*(1+sign*.02)}; }
 if(type==='longMidrange') return {x:716,y:310+sign*92};
 if(type==='fadeaway') return {x:790,y:310+sign*112};
 return {x:758,y:310+sign*84};
}
/** Where a revealed shot was taken, for the on-floor shot chart. Returns null when no field goal was attempted. */
export function courtShot(entry:PossessionLogEntry,homeId:string,regulationPeriods=4):CourtShot|null {
 const play=playbackForEntry(entry);
 if(!play.shooterId||entry.result==='TURNOVER') return null;
 const g=geometry(entry,play,homeId,regulationPeriods);
 if(g.onlyFT) return null;
 return {...g.mirror(shotPoint(play,g,false)),made:!!play.shotMade,three:g.three,teamId:entry.offenseTeamId,dunk:play.shotType==='dunk'};
}

// Free-throw lineup: defense takes the low blocks, shooters' teammates the middle lane spots.
const FT_DEF=[{x:872,y:228},{x:872,y:392},{x:806,y:228},{x:806,y:392},{x:716,y:250}],FT_OFF=[{x:839,y:228},{x:839,y:392},{x:700,y:190},{x:700,y:430}];
// Half-court floor slots, attacking the right basket: top, both wings, both corners, dunker spot.
const SLOTS=[{x:640,y:310},{x:694,y:152},{x:694,y:468},{x:866,y:112},{x:866,y:508},{x:846,y:392}];
// Where a slot relocates to when the player moves off the ball (wing <-> corner, top <-> wing, dunker <-> short corner).
const RELOCATE=[2,3,4,1,2,0];

/*
 * The possession timeline (share of the main action, before any free throws):
 *   0    - .30  transition: inbound after a basket, outlet after a defensive rebound, lanes filled, defense sprints back
 *   .24  - .46  half-court: swing passes around the perimeter, off-ball relocation, a screen for the creator
 *   .46  - .56  the recorded pass (if any) and the catch or gather
 *   .56  - .76  the shot, then the result: net, rim, block; crashers and box-outs chase a miss
 * Tracks are keyframes joined by Catmull-Rom curves, so players arc through the floor instead of sliding between spots.
 */
const T_UP=.3,T_ACT=.46,T_PASS=.54;
type PlaySet='transition'|'pnr'|'pop'|'handoff'|'iso'|'pindown'|'backdoor'|'roll'|'post'|'horns';
/** What the broadcast calls each set while it's being run. */
const SET_LABEL:Partial<Record<PlaySet,string>>={pnr:'Pick and roll',pop:'Pick and pop',handoff:'Dribble handoff',iso:'Isolation',pindown:'Pin-down screen',backdoor:'Backdoor cut',roll:'Screen and roll',post:'Post-up',horns:'Horns'};

interface Key { t:number; p:CourtPoint }
const catmull=(p0:CourtPoint,p1:CourtPoint,p2:CourtPoint,p3:CourtPoint,u:number):CourtPoint=>{
 const u2=u*u,u3=u2*u,f=(a:number,b:number,c:number,d:number)=>.5*(2*b+(-a+c)*u+(2*a-5*b+4*c-d)*u2+(-a+3*b-3*c+d)*u3);
 return {x:f(p0.x,p1.x,p2.x,p3.x),y:f(p0.y,p1.y,p2.y,p3.y)};
};
/** Position on a keyframed track at time t; the track eases out of its first key and into its last. */
function track(keys:Key[],t:number):CourtPoint {
 if(t<=keys[0].t)return {...keys[0].p};
 const last=keys[keys.length-1];if(t>=last.t)return {...last.p};
 let i=0;while(i<keys.length-2&&t>keys[i+1].t)i++;
 const a=keys[i],b=keys[i+1],u=limit((t-a.t)/Math.max(1e-6,b.t-a.t));
 const s=keys.length===2?ease(u):i===0?u*u*(2-u):i+1===keys.length-1?1-(1-u)*(1-u)*(1+u):u;
 return catmull(keys[Math.max(0,i-1)].p,a.p,b.p,keys[Math.min(keys.length-1,i+2)].p,s);
}
const speedOn=(keys:Key[],t:number)=>{const a=track(keys,t-.004),b=track(keys,t+.004);return Math.hypot(b.x-a.x,b.y-a.y)/.008;};
const sorted=(keys:Key[])=>keys.filter((k,i)=>i===0||k.t>keys[i-1].t);
/** Court pixels a player covers per second at a sprint (about 21 ft/s; the court is ~9.3 px per foot). Curves
 * ease in and out, so the peak runs about half again faster. */
const SPRINT=170;
/** Spaces keys so no leg asks for more than a sprint; later keys wait for the player to get there. */
function paced(keys:Key[],pxPerQ:number):Key[] {
 const out=keys.map(k=>({...k}));
 for(let k=1;k<out.length;k++){const need=Math.hypot(out[k].p.x-out[k-1].p.x,out[k].p.y-out[k-1].p.y)/pxPerQ;if(out[k].t<out[k-1].t+need)out[k].t=out[k-1].t+need;}
 return out;
}


/** Where a player is at the tip of the possession: where the last one left him, or (new quarter) a center-court
 * formation, or (just checked in) the scorer's table. */
function startFor(id:string,index:number,offense:boolean,c:{starts?:Map<string,CourtPoint>;mirror:(v:CourtPoint)=>CourtPoint}):CourtPoint {
 const known=c.starts?.get(id);if(known)return known;
 if(c.starts&&c.starts.size)return {x:470+index*22,y:516};
 const ring=[{x:470,y:310},{x:430,y:210},{x:430,y:410},{x:360,y:250},{x:360,y:370}],dring=[{x:530,y:310},{x:570,y:220},{x:570,y:400},{x:640,y:260},{x:640,y:360}];
 return c.mirror((offense?ring:dring)[index%5]);
}

function baseFrame(entry:PossessionLogEntry,play:PossessionPlayback,progress:number,homeId:string,awayId:string,regulationPeriods:number,starts?:Map<string,CourtPoint>,previous?:PossessionLogEntry):CourtFrame {
 const p=limit(progress),offHome=entry.offenseTeamId===homeId;
 const g=geometry(entry,play,homeId,regulationPeriods),{right,mirror,salt,sign,close,three,onlyFT,ftCount}=g;
 const offense=offHome?entry.onCourtHome:entry.onCourtAway,defense=offHome?entry.onCourtAway:entry.onCourtHome;
 const dunk=play.shotType==='dunk',drive=close&&!onlyFT;
 const mainShare=onlyFT?.25:ftCount>0?.72:1;
 const q=limit(p/mainShare),ftActive=ftCount>0&&p>=mainShare;
 const hoop=mirror({x:900,y:310}),own=mirror({x:100,y:310});
 // Pixels a sprinter covers per unit of main-action progress in this possession.
 const pxPerQ=SPRINT*replayDuration(entry)*mainShare/1000;
 const toward=right?1:-1,turnover=entry.result==='TURNOVER';
 const bringer=offense.includes(entry.ballHandlerId)?entry.ballHandlerId:offense[0];
 const creator=play.passerId&&offense.includes(play.passerId)?play.passerId:bringer;
 const shooter=play.shooterId&&offense.includes(play.shooterId)?play.shooterId:creator;
 const others=offense.filter(id=>id!==creator&&id!==shooter&&id!==bringer);
 const screener=others[0]??offense.find(id=>id!==creator&&id!==shooter),cutter=others.length>1?others[others.length-1]:undefined;
 const shot=mirror(shotPoint(play,g,onlyFT||ftActive));
 const slotOf=(id:string)=>SLOTS[(offense.indexOf(id)+salt)%SLOTS.length];
 const prev=previous&&previous.quarter===entry.quarter?previous:undefined;
 const prevPlay=prev?playbackForEntry(prev):undefined;
 // How the ball comes in: an inbound after the other team scored, an outlet after a defensive rebound.
 const made=!!prev&&prev.offenseTeamId!==entry.offenseTeamId&&(prev.result==='MAKE'||prev.result==='AND1'||!!prevPlay?.shotMade);
 const outletFrom=prev&&prev.offenseTeamId!==entry.offenseTeamId&&!made&&prevPlay?.rebounderId&&offense.includes(prevPlay.rebounderId)&&prevPlay.rebounderId!==bringer?prevPlay.rebounderId:undefined;
 const startOf=(id:string)=>startFor(id,Math.max(0,offense.indexOf(id)),true,{starts,mirror});
 const inbounder=made?[...offense.filter(id=>id!==bringer)].sort((a,b)=>Math.hypot(startOf(a).x-own.x,startOf(a).y-own.y)-Math.hypot(startOf(b).x-own.x,startOf(b).y-own.y))[0]:undefined;
 const fast=entry.action==='transition'||entry.secondChance;

 // ---- Ball route: in-bound/outlet -> bringer -> swing passes -> creator -> (recorded pass) -> shooter ----
 const chain=[bringer];
 const swingPool=offense.filter(id=>id!==shooter||shooter===creator);
 const swings=fast?0:1+salt%3;
 for(let k=0;k<swings;k++){const cur=chain[chain.length-1];const pick=swingPool.filter(id=>id!==cur&&id!==creator)[(salt>>(k+1))%Math.max(1,swingPool.filter(id=>id!==cur&&id!==creator).length)];if(pick)chain.push(pick);}
 if(chain[chain.length-1]!==creator)chain.push(creator);
 const route=chain.filter((id,i)=>i===0||id!==chain[i-1]);
 const passes:{from:string;to:string;t0:number;t1:number;bounce:boolean}[]=[];
 const w0=T_UP-.02,w1=T_ACT-.02,n=route.length-1;
 for(let k=0;k<n;k++){const slotLen=(w1-w0)/n,t0=w0+slotLen*k+slotLen*.4;passes.push({from:route[k],to:route[k+1],t0,t1:t0+Math.min(.05,slotLen*.5),bounce:(salt+k)%4===0});}
 if(play.passerId&&shooter!==creator)passes.push({from:creator,to:shooter,t0:T_ACT,t1:T_PASS-.02,bounce:salt%3===0});

 // ---- The set: chosen from how the possession really ended (who shot, off whose pass, what kind of shot) ----
 const type=play.shotType??'',assisted=shooter!==creator;
 const set:PlaySet=fast||onlyFT?'transition'
  :assisted&&(type==='postShot'||type==='hook')?'post'
  :!assisted?(drive?(salt%3===0?'iso':'pnr'):(['pop','handoff','iso'] as const)[salt%3])
  :close?(salt%2?'roll':'backdoor')
  :salt%3===0?'horns':'pindown';
 const screenAt=mirror({x:680,y:310+sign*12});
 // ---- Offense tracks ----
 const tracks=new Map<string,Key[]>();
 const top=mirror({x:652,y:310-sign*26}),probe=mirror({x:706,y:310+sign*40});
 const laneY=[150,470,310,200,420];
 offense.forEach((id,i)=>{
  const start=startOf(id);
  const lane=mirror({x:fast?600:520,y:laneY[i%laneY.length]});
  const keys:Key[]=[{t:0,p:start}];
  if(id===inbounder){keys.push({t:.03,p:mirror({x:80,y:310+sign*44})},{t:.1,p:mirror({x:150,y:310+sign*70})});}
  const slot=mirror(slotOf(id)),alt=mirror(SLOTS[RELOCATE[(offense.indexOf(id)+salt)%SLOTS.length]]);
  const S=(x:number,y:number)=>mirror({x,y:310+y*sign}); // a spot on the strong (+) or weak (-) side
  if(id===bringer&&id===creator&&id===shooter){
   // A one-man possession: bring it up, then attack (off a ball screen, or one-on-one with the floor cleared).
   keys.push({t:T_UP*.55,p:lane},{t:T_UP,p:top},{t:T_ACT,p:probe});
   keys.push({t:drive?.52:.54,p:drive?mirror({x:760,y:310+sign*60}):shot},{t:.58,p:shot});
  }else if(id===bringer){
   if(outletFrom){keys.push({t:.05,p:mirror({x:230,y:310+sign*150})});}
   keys.push({t:T_UP*.6,p:lane},{t:T_UP,p:top});
   if(id===creator){keys.push({t:.4,p:top},{t:T_ACT,p:probe},{t:.6,p:mirror({x:668,y:310+sign*72})});}
   // After giving it up: a give-and-go cut to the rim and out to the weak-side corner, or a step to the wing.
   else if(salt%2&&set!=='post'&&set!=='backdoor')keys.push({t:.37,p:S(690,-70)},{t:.45,p:S(850,-24)},{t:.54,p:S(866,-198)});
   else keys.push({t:.36,p:mirror({x:676,y:310-sign*60})},{t:.5,p:mirror(slotOf(id))});
  }else if(id===shooter){
   const catchAt=drive?mirror({x:740,y:310+sign*70}):shot;
   if(set==='pindown')keys.push({t:T_UP*.55,p:lane},{t:T_UP,p:S(866,150)},{t:.4,p:S(850,146)},{t:.47,p:courtLerp(S(760,150),catchAt,.4)},{t:T_PASS,p:catchAt},{t:.58,p:shot});
   else if(set==='backdoor')keys.push({t:T_UP*.55,p:lane},{t:T_UP,p:S(694,158)},{t:.42,p:S(652,176)},{t:T_PASS,p:S(852,44)},{t:.58,p:shot});
   else if(set==='roll')keys.push({t:T_UP*.55,p:lane},{t:T_UP,p:slot},{t:.37,p:screenAt},{t:.42,p:screenAt},{t:T_PASS,p:S(846,-36)},{t:.58,p:shot});
   else if(set==='post')keys.push({t:T_UP*.55,p:lane},{t:T_UP,p:S(850,62)},{t:.4,p:S(844,70)},{t:.46,p:S(852,58)},{t:T_PASS,p:S(848,62)},{t:.58,p:shot});
   else if(set==='horns')keys.push({t:T_UP*.55,p:lane},{t:T_UP,p:S(742,62)},{t:.41,p:S(742,62)},{t:T_PASS,p:catchAt},{t:.58,p:shot});
   else keys.push({t:T_UP*.55,p:lane},{t:T_UP,p:slot},{t:.36,p:alt},{t:.46,p:courtLerp(alt,catchAt,.5)},{t:T_PASS,p:catchAt},{t:.58,p:shot});
  }else if(id===creator){
   if(set==='post')keys.push({t:T_UP*.55,p:lane},{t:T_UP,p:S(704,172)},{t:.44,p:S(712,166)},{t:.6,p:S(652,120)});
   else if(set==='handoff')keys.push({t:T_UP*.55,p:lane},{t:T_UP,p:S(640,-70)},{t:.4,p:S(708,104)},{t:T_ACT,p:probe},{t:.6,p:mirror({x:668,y:310+sign*72})});
   else keys.push({t:T_UP*.55,p:lane},{t:T_UP,p:slot},{t:.38,p:top},{t:T_ACT,p:probe},{t:.6,p:mirror({x:668,y:310+sign*72})});
  }else if(id===screener&&!ftActive&&set!=='roll'){
   const roll=mirror(drive?{x:808,y:310-sign*92}:{x:840,y:310-sign*38});
   if(set==='pnr')keys.push({t:T_UP*.6,p:lane},{t:T_UP,p:slot},{t:.37,p:screenAt},{t:.42,p:screenAt},{t:.56,p:roll});
   else if(set==='horns')keys.push({t:T_UP*.6,p:lane},{t:T_UP,p:S(742,-62)},{t:.37,p:screenAt},{t:.42,p:screenAt},{t:.56,p:roll});
   // Pick and pop: screen, then drift out to the three-point line.
   else if(set==='pop')keys.push({t:T_UP*.6,p:lane},{t:T_UP,p:slot},{t:.37,p:screenAt},{t:.42,p:screenAt},{t:.56,p:S(640,-128)});
   // Dribble handoff: the big brings the ball-side elbow to the guard, then dives.
   else if(set==='handoff')keys.push({t:T_UP*.6,p:lane},{t:T_UP,p:S(726,118)},{t:.42,p:S(716,110)},{t:.54,p:S(846,70)});
   // Pin-down: set the screen on the shooter's man near the block, then seal.
   else if(set==='pindown')keys.push({t:T_UP*.6,p:lane},{t:T_UP,p:slot},{t:.37,p:S(824,122)},{t:.47,p:S(824,122)},{t:.56,p:S(846,40)});
   // Isolation: clear out to the weak side.
   else keys.push({t:T_UP*.6,p:lane},{t:T_UP,p:slot},{t:.38,p:S(846,-82)},{t:.52,p:S(866,-190)});
  }else if(id===cutter&&!ftActive&&set!=='iso'&&set!=='post'){
   // A baseline cut through the lane and back out to the corner.
   const cut=mirror({x:872,y:310+sign*30});
   keys.push({t:T_UP*.6,p:lane},{t:T_UP,p:slot},{t:.4,p:alt},{t:.47,p:cut},{t:.58,p:slot});
  }else{
   // Spacing: fill a corner or a wing on the weak side, then lift when the ball moves.
   const spot=(k:number)=>[S(866,-198),S(694,-158),S(866,198),S(640,-40)][k%4];
   const k=offense.indexOf(id)+salt;
   keys.push({t:T_UP*.6,p:lane},{t:T_UP,p:spot(k)},{t:.4,p:spot(k)},{t:.5,p:spot(k+1)});
  }
  // The finish: on a miss the bigs crash and the guards get back; on a make everyone heads back up the floor.
  const lastT=keys[keys.length-1].t;
  if(!turnover&&id!==shooter&&!ftActive){
   const missed=!!play.shooterId&&!play.shotMade&&!onlyFT;
   if(missed&&(id===screener||id===play.rebounderId))keys.push({t:Math.max(lastT+.02,.7),p:keys[keys.length-1].p},{t:.9,p:mirror({x:858,y:310+(id===screener?-sign:sign)*54})});
   else if(missed)keys.push({t:Math.max(lastT+.02,.72),p:keys[keys.length-1].p},{t:.95,p:mirror({x:560,y:laneY[i%laneY.length]})});
   else if(play.shotMade)keys.push({t:Math.max(lastT+.02,.86),p:keys[keys.length-1].p},{t:1,p:mirror({x:600,y:laneY[i%laneY.length]})});
  }
  tracks.set(id,paced(sorted(keys),pxPerQ));
 });

 const actors:CourtActor[]=offense.map((id,i)=>{
  const keys=tracks.get(id)!,isShooter=id===shooter;
  let loc=track(keys,q),pose:CourtPose='run';
  const moving=speedOn(keys,q)>60;
  if(q>.55&&play.rebounderId===id&&!isShooter&&!ftActive)loc=courtLerp(loc,mirror({x:862,y:310+sign*46}),ease(window01(q,.55,.8)));
  if(ftActive&&!isShooter)loc=mirror(FT_OFF[offense.filter(v=>v!==shooter).indexOf(id)%FT_OFF.length]);
  if(turnover&&q>.8)loc=courtLerp(loc,mirror({x:600-i*28,y:180+i*62}),ease(window01(q,.8,1)));
  const screens=(set==='roll'?id===shooter:id===screener&&set!=='iso'&&set!=='handoff'&&set!=='transition'&&set!=='post'&&set!=='backdoor');
  if(screens&&q>=.37&&q<(set==='pindown'?.47:.42)&&!ftActive)pose='screen';
  const jumping=isShooter&&!ftActive&&!turnover&&q>.51&&q<(dunk?.84:.78);
  let jump=jumping?Math.sin(window01(q,.51,dunk?.84:.78)*Math.PI)*(dunk?30:three?15:13):0;
  if(dunk&&isShooter&&q>=.68&&q<.84&&!ftActive)jump=Math.max(jump,26); // hang on the rim
  if(jumping)pose='shoot';
  if(isShooter&&!ftActive&&play.shotMade&&q>.84){pose='celebrate';jump=Math.abs(Math.sin(window01(q,.84,1)*Math.PI*2))*7;}
  if(ftActive)pose='idle';
  if(!moving&&pose==='run')pose='idle';
  // The shot as an animation: gather, rise, release, follow-through and landing, by the kind of shot.
  const shotEnd=dunk?.84:.78;
  let anim:CourtActor['anim'];
  if(pose==='celebrate')anim={kind:'celebrate',t:window01(q,.84,1)};
  else if(isShooter&&play.shooterId&&!onlyFT&&!ftActive&&!turnover&&q>=.47&&q<shotEnd+.08)anim={kind:dunk?'dunk':close?'layup':'jumper',t:window01(q,.47,shotEnd+.08)};
  return {...loc,id,teamId:entry.offenseTeamId,jump,stride:moving?Math.sin(q*58+i):0,pose,facing:toward,cycle:(q*58+i)/(Math.PI*2),...(anim?{anim}:{})};
 });
 const byId=(id:string|undefined)=>actors.find(a=>a.id===id);
 const hand=(id:string|undefined):CourtPoint=>{const a=byId(id)??mirror({x:720,y:310});return {x:a.x+(right?12:-12),y:a.y-3}};
 // Who has the ball, for defensive help: the passer until the pass lands.
 const holderAt=(t:number):string=>{let h=route[0];for(const ps of passes)if(t>=ps.t1)h=ps.to;return h;};
 // Where the ball is for the defense to read: in a hand, or in flight between two hands (so help rotates smoothly).
 const anchorAt=(t:number):CourtPoint=>{
  const air=passes.find(ps=>t>=ps.t0&&t<ps.t1);
  const at=(id:string)=>{const k=tracks.get(id);const pt=k?track(k,t):hand(id);return {x:pt.x+(right?12:-12),y:pt.y-3};};
  return air?courtLerp(at(air.from),at(air.to),ease((t-air.t0)/(air.t1-air.t0))):at(holderAt(t));
 };
 // Defenders react to the ball, not ahead of it: they read where it has been over the last half second.
 const lag=[0,.012,.024,.036,.048,.06].map(d=>anchorAt(Math.max(0,q-d)));
 const anchor:CourtPoint={x:lag.reduce((s,v)=>s+v.x,0)/lag.length,y:lag.reduce((s,v)=>s+v.y,0)/lag.length};

 // ---- Defense: goal-side of the man, sagging into help away from the ball; sprinting back in transition ----
 const defStart=(id:string,i:number)=>startFor(id,i,false,{starts,mirror});
 defense.forEach((id,i)=>{
  const attacker=actors[i%Math.max(1,actors.length)];
  let target:CourtPoint;
  if(attacker){
   // Tight on the ball, a step off one pass away, sagging into the paint two passes away: all by distance to the ball.
   const far=Math.hypot(anchor.x-attacker.x,anchor.y-attacker.y);
   const dx=hoop.x-attacker.x,dy=hoop.y-attacker.y,d=Math.hypot(dx,dy)||1,gap=24+12*ease((far-30)/90);
   target={x:attacker.x+dx/d*gap,y:attacker.y+dy/d*gap};
   if(!ftActive)target=courtLerp(target,mirror({x:806,y:310}),.32*ease((far-170)/120));
  }else target=mirror(SLOTS[i%5]);
  const missed=!!play.shooterId&&!play.shotMade&&!onlyFT&&!turnover;
  // Box out the crashers: get between them and the rim.
  if(missed&&q>.7&&attacker&&(attacker.id===screener||attacker.id===play.rebounderId)&&!ftActive)target=courtLerp(target,{x:attacker.x+(hoop.x-attacker.x)*.35,y:attacker.y+(hoop.y-attacker.y)*.35},ease(window01(q,.7,.82)));
  if(q>.57&&(id===play.blockerId||id===play.rebounderId))target=courtLerp(target,{x:hoop.x+(right?-30:30),y:310+(id===play.blockerId?0:sign*49)},ease(window01(q,.57,.7)));
  if(id===play.stealerId&&q>.36&&q<.8){target=courtLerp(target,anchor,ease(window01(q,.36,.5))*(1-ease(window01(q,.7,.8))));}
  if(turnover&&id===play.stealerId&&q>=.62){target=courtLerp(target,mirror({x:260,y:310+sign*40}),ease(window01(q,.62,1)));}
  else if(turnover&&q>=.7)target=courtLerp(target,mirror({x:520-i*30,y:170+i*66}),ease(window01(q,.7,1)));
  // After a make the defense takes the ball out: one heads for the baseline, the rest start up the floor.
  if(play.shotMade&&!ftActive&&!onlyFT&&q>.86){const inb=i===0;target=courtLerp(target,inb?mirror({x:896,y:310-sign*50}):mirror({x:700-i*30,y:laneY[i%laneY.length]}),ease(window01(q,.86,1)));}
  if(ftActive)target=mirror(FT_DEF[i%FT_DEF.length]);
  const start=defStart(id,i);
  // Sprint back: the time to get there grows with the distance.
  const backBy=limit(Math.hypot(target.x-start.x,target.y-start.y)/pxPerQ*1.5,.12,.5);
  const loc=courtLerp(start,target,ease(q/backBy));
  const contest=(id===play.blockerId||attacker?.id===shooter)&&q>.56&&q<.8&&!ftActive&&!turnover;
  const chasing=turnover&&q>.62;
  const running=q<backBy&&Math.hypot(target.x-start.x,target.y-start.y)>40;
  actors.push({...loc,id,teamId:offHome?awayId:homeId,jump:contest?Math.sin((q-.56)/.24*Math.PI)*(id===play.blockerId?25:12):0,stride:running||chasing?Math.sin(q*58+i)*.8:Math.sin(q*30+i)*.25,
   pose:contest?'reach':chasing?(id===play.stealerId?'dribble':'run'):running?'run':ftActive?'idle':'guard',facing:-toward,cycle:(running||chasing?q*58+i:q*30+i)/(Math.PI*2)});
 });
 // Body language: the passer snaps the ball out with both hands; the rebounder goes up for it with both arms.
 if(!ftActive){
  for(const ps of passes)if(q>=ps.t0-.01&&q<ps.t0+.035){const a=byId(ps.from);if(a&&a.pose!=='shoot'){a.pose='pass';a.anim={kind:'pass',t:limit((q-(ps.t0-.01))/.045)};}}
  const board=play.rebounderId&&!play.shotMade&&!turnover?actors.find(a=>a.id===play.rebounderId):undefined;
  if(board&&q>=.84&&q<.99){board.pose='rebound';board.jump=Math.max(board.jump,Math.sin(window01(q,.84,.99)*Math.PI)*17);board.anim={kind:'rebound',t:window01(q,.84,.99)};}
 }
 if(ftActive&&p<mainShare+.1){const before=baseFrame(entry,play,mainShare-.000001,homeId,awayId,regulationPeriods,starts,previous);const t=ease((p-mainShare)/.1);for(const a of actors){const old=before.players.find(v=>v.id===a.id);if(old){const point=courtLerp(old,a,t);a.x=point.x;a.y=point.y;}}}
 // Symmetric separation keeps feet apart without frame-rate-dependent integration.
 for(let k=0;k<3;k++)for(let i=0;i<actors.length;i++)for(let j=i+1;j<actors.length;j++){
  const a=actors[i],b=actors[j],dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy),radius=21;
  if(dist<radius){const amount=(radius-dist)*.5*ease(q/.12),nx=dist?dx/dist:1,ny=dist?dy/dist:0;a.x-=nx*amount;a.y-=ny*amount;b.x+=nx*amount;b.y+=ny*amount;}
 }
 for(const a of actors){a.x=limit(a.x,78,922);a.y=limit(a.y,100,520);}

 // ---- The ball ----
 const dribbleHand=(id:string|undefined):CourtBall=>{
  const a=byId(id)??{...mirror({x:720,y:310})},c=q*9,k=Math.floor(c),f=c-k;
  const side=(m:number)=>Math.floor(m/3)%2?-1:1,cross=k%3===2;
  const lateral=cross?side(k)+(side(k+1)-side(k))*f:side(k);
  return {x:a.x+lateral*11+(right?4:-4),y:a.y-2+lateral*3,z:4+24*4*f*(1-f),spin:q*1500};
 };
 const held=(id:string|undefined):CourtBall=>({...hand(id),z:26,spin:0});
 let ball:CourtBall,phase=entry.secondChance?'Second chance':fast?'Push it':'Bring it up',carrier:string|undefined=bringer,net=0,shotAttempt:number|undefined,rim=0,callout:CourtCallout|undefined;
 // In-bound or outlet first.
 const entryPass=inbounder?{from:inbounder,t0:.04,t1:.1}:outletFrom?{from:outletFrom,t0:.02,t1:.07}:null;
 if(entryPass&&q<entryPass.t0){ball=held(entryPass.from);carrier=entryPass.from;phase=inbounder?'Inbound':'Outlet';}
 else if(entryPass&&q<entryPass.t1){ball=ballFlight(hand(entryPass.from),hand(bringer),(q-entryPass.t0)/(entryPass.t1-entryPass.t0),24,24,inbounder?.5:.7);carrier=undefined;phase=inbounder?'Inbound':'Outlet pass';}
 else{
  const holder=holderAt(q),flying=passes.find(ps=>q>=ps.t0&&q<ps.t1);
  if(flying){
   const t=(q-flying.t0)/(flying.t1-flying.t0),from=hand(flying.from),to=hand(flying.to);
   if(flying.bounce){const mid=courtLerp(from,to,.52);ball=t<.52?ballFlight(from,mid,t/.52,23,3,.35):ballFlight(mid,to,(t-.52)/.48,3,26,.32);}else ball=ballFlight(from,to,t,24,26,.55);
   carrier=undefined;phase=flying.to===shooter&&flying.from===creator&&play.passerId?(flying.bounce?'Bounce pass':'Pass'):'Swing pass';
  }else{
   carrier=holder;
   // The man with the ball dribbles when he's moving or attacking; a catch on the perimeter is held in triple threat.
   const a=byId(holder),keys=tracks.get(holder),movingNow=keys?speedOn(keys,q)>40:false;
   ball=movingNow||(holder===creator&&q>=.38&&q<T_ACT)||(holder===shooter&&drive&&q>=.5)?dribbleHand(holder):held(holder);
   if(a&&q>=.36&&q<T_ACT&&SET_LABEL[set])phase=SET_LABEL[set]!;
   else if(q>=T_UP&&q<T_ACT)phase='Work the ball';
   if(q>=T_PASS-.02)phase=drive?'Drive & gather':'Set for the shot';
  }
 }
 const shotFrom=play.shooterId&&!onlyFT?shot:undefined;
 if(play.shooterId&&q>=.56&&!onlyFT&&!turnover){
  const t=limit((q-.56)/.2),from=hand(shooter),airtime=dunk?.25:close?.6:three?1.4:1.1;
  ball=ballFlight(from,hoop,t,dunk?48:42,34,airtime);
  carrier=undefined;phase=dunk?'At the rim':three?'Three-point attempt':'Shot in the air';
  if(play.blockerId&&q>=.66){const contact=ballFlight(from,hoop,.5,dunk?48:42,34,airtime);ball=ballFlight(contact,hand(play.rebounderId??play.blockerId),limit((q-.66)/.24),contact.z,25,.48);phase='Blocked';if(q>.9)carrier=play.rebounderId??play.blockerId;
   callout={text:'BLOCKED!',...contact,t:window01(q,.66,.96),tone:'defense'};}
  else if(q>=.76){
   if(play.shotMade){const t2=limit((q-.76)/.16);ball={...hoop,z:34*(1-t2*t2),spin:q*900};if(q>.92){const bounce=limit((q-.92)/.08);ball.z=12*4*bounce*(1-bounce);}net=Math.sin(limit((q-.76)/.1)*Math.PI);phase=dunk?'Dunk!':'Basket';
    const and1=entry.result==='AND1'||entry.events.some(e=>e.includes(' AND-1 ('));
    callout={text:and1?'AND-1!':dunk?'SLAM!':three?'+3':'+2',x:hoop.x,y:hoop.y-60,t:window01(q,.76,1),tone:'make'};}
   else {
    // Front-rim contact pops the ball up before it caroms toward the rebounder.
    const pop=mirror({x:900-(10+salt%8),y:310+sign*6}),kick=mirror({x:846-(salt%30),y:310+sign*(40+salt%43)});
    rim=Math.sin(window01(q,.76,.84)*Math.PI);
    if(q<.82)ball=ballFlight(hoop,pop,limit((q-.76)/.06),34,40,.3);
    else if(q<.88)ball=ballFlight(pop,kick,limit((q-.82)/.06),40,9,.45);
    else ball=ballFlight(kick,hand(play.rebounderId),limit((q-.88)/.1),9,25,.32);
    phase=q<.88?'Off the rim':play.rebounderId?'Rebound':'Loose ball';if(q>=.98)carrier=play.rebounderId;
   }
  }
 }
 if(turnover&&q>=.5){
  const loser=holderAt(.5),dest=play.stealerId?hand(play.stealerId):mirror({x:933,y:480});
  ball=ballFlight(hand(loser),dest,limit((q-.5)/.12),23,play.stealerId?24:3,.45);phase=play.stealerId?'Steal':'Turnover';carrier=undefined;
  if(play.stealerId&&q>=.62){ball=dribbleHand(play.stealerId);carrier=play.stealerId;phase='Breakaway';}
  else if(!play.stealerId&&q>=.62){ball={...dest,z:0,spin:0};}
  callout={text:play.stealerId?'STEAL!':'TURNOVER',x:dest.x,y:dest.y-58,t:window01(q,.5,.85),tone:play.stealerId?'defense':'neutral'};
 }
 if(entry.result==='FOUL'&&!ftActive&&q>=T_PASS-.02){phase='Whistle';ball={...hand(shooter),z:26,spin:0};if(q>.5)callout={text:'FOUL',x:hand(shooter).x,y:hand(shooter).y-66,t:window01(q,.5,1),tone:'neutral'};}
 if(ftActive){
  const count=Math.max(1,ftCount),cycle=limit((p-mainShare)/(1-mainShare))*count,attempt=Math.min(count-1,Math.floor(cycle)),t=cycle-attempt;
  shotAttempt=attempt+1;const shootingActor=byId(shooter);if(shootingActor){shootingActor.pose=t>.15&&t<.75?'shoot':t<.15?'dribble':'idle';shootingActor.anim={kind:'ft',t};shootingActor.jump=0;}const from=hand(shooter);phase=`Free throw ${attempt+1} of ${count}`;carrier=t<.2?shooter:undefined;
  ball=t<.2?{...from,z:26-(t<.15?18*Math.abs(Math.sin(t/.15*Math.PI*2)):0),spin:0}:ballFlight(from,hoop,limit((t-.2)/.55),40,34,.95);
  // Old logs record FT totals, not attempt order. Reconstruct a sequence with the exact recorded totals.
  if(t>.75){const madeFt=play.freeThrows?.outcomes?.[attempt]??attempt<(play.freeThrows?.made??0),u=limit((t-.75)/.25);ball=madeFt?{...hoop,z:34*(1-u*u),spin:u*360}:ballFlight(hoop,mirror({x:838,y:357}),u,34,6,.38);net=madeFt?Math.sin(u*Math.PI):0;rim=madeFt?0:Math.sin(u*Math.PI)*.6;
   if(madeFt)callout={text:'+1',x:hoop.x,y:hoop.y-60,t:u,tone:'make'};}
 }
 // The ball carrier dribbles; everyone else faces the ball.
 for(const a of actors){if(a.id===carrier){if(a.pose==='run'||a.pose==='idle')a.pose=ball.z<20?'dribble':'idle';}else if(Math.abs(ball.x-a.x)>4)a.facing=ball.x>a.x?1:-1;}
 return {players:actors,ball,phase,carrier,hoop,net,attackRight:right,shotAttempt,offenseTeamId:entry.offenseTeamId,callout,rim,shotFrom};
}
const SMOOTH=.035,SMOOTH_TAPS=6;
/** A stateless scene makes pause, seek, high playback speeds and repeat viewing agree exactly. */
export function courtFrame(entry:PossessionLogEntry,progress:number,homeId:string,awayId:string,regulationPeriods=4,previous?:PossessionLogEntry):CourtFrame {
 const play=playbackForEntry(entry);
 const prior=previous&&previous.quarter===entry.quarter?baseFrame(previous,playbackForEntry(previous),1,homeId,awayId,regulationPeriods):undefined;
 const starts=prior?new Map(prior.players.map(a=>[a.id,a])):undefined;
 const frame=baseFrame(entry,play,progress,homeId,awayId,regulationPeriods,starts,previous);
 // Legs have momentum: each player is the average of where the choreography put him over the last third of a
 // second, so a changed target turns into a run rather than a snap. The window closes at both ends of the
 // possession so one possession still hands over exactly where the next begins.
 const span=SMOOTH*limit(Math.min(progress,1-progress)/.06);
 if(span>1e-4){
  const raw=new Map(frame.players.map(a=>[a.id,{x:a.x,y:a.y}]));
  const sums=new Map(frame.players.map(a=>[a.id,{x:a.x,y:a.y}]));
  for(let k=1;k<SMOOTH_TAPS;k++){const back=baseFrame(entry,play,progress-span*k/(SMOOTH_TAPS-1),homeId,awayId,regulationPeriods,starts,previous);for(const a of back.players){const sum=sums.get(a.id);if(sum){sum.x+=a.x;sum.y+=a.y;}}}
  for(const a of frame.players){const sum=sums.get(a.id)!;a.x=sum.x/SMOOTH_TAPS;a.y=sum.y/SMOOTH_TAPS;}
  const held=frame.carrier?frame.players.find(a=>a.id===frame.carrier):undefined;
  if(held&&frame.ball.z<40){const r=raw.get(held.id)!;frame.ball={...frame.ball,x:frame.ball.x+held.x-r.x,y:frame.ball.y+held.y-r.y};}
 }
 if(prior&&previous&&progress<.12){const t=ease(progress/.12),point=courtLerp(prior.ball,frame.ball,t);frame.ball={...point,z:prior.ball.z+(frame.ball.z-prior.ball.z)*t+12*Math.sin(t*Math.PI),spin:t*360};if(frame.phase!=='Inbound'&&frame.phase!=='Outlet'&&frame.phase!=='Outlet pass')frame.phase=previous.offenseTeamId===entry.offenseTeamId?'Keep possession':'Take it up';frame.carrier=undefined;}
 return frame;
}
