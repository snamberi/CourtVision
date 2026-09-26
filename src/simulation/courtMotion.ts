import type { PossessionLogEntry, PossessionPlayback } from './boxscore';
import { playbackForEntry } from './gamePlayback';

export interface CourtPoint { x:number; y:number }
export interface CourtBall extends CourtPoint { z:number; spin:number }
export type CourtPose='run'|'guard'|'shoot'|'reach'|'idle'|'dribble'|'celebrate'|'screen';
export interface CourtActor extends CourtPoint { id:string; teamId:string; jump:number; stride:number; pose:CourtPose; facing:number }
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
 return 6200+(entry.action==='transition'?-900:0)+(entry.secondChance?-1200:0)+(p.freeThrows?.attempted??0)*1750;
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

function baseFrame(entry:PossessionLogEntry,play:PossessionPlayback,progress:number,homeId:string,awayId:string,regulationPeriods:number,starts?:Map<string,CourtPoint>):CourtFrame {
 const p=limit(progress),offHome=entry.offenseTeamId===homeId;
 const g=geometry(entry,play,homeId,regulationPeriods),{right,mirror,salt,sign,close,three,onlyFT,ftCount,handler,shooter}=g;
 const offense=offHome?entry.onCourtHome:entry.onCourtAway,defense=offHome?entry.onCourtAway:entry.onCourtHome;
 const dunk=play.shotType==='dunk',drive=close&&!onlyFT;
 const mainShare=onlyFT?.25:ftCount>0?.72:1;
 const q=limit(p/mainShare),ftActive=ftCount>0&&p>=mainShare;
 const hoop=mirror({x:900,y:310});
 const shot=mirror(shotPoint(play,g,onlyFT||ftActive));
 const toward=right?1:-1;
 // The handler's own screener: the first teammate who is neither handler nor shooter.
 const screener=offense.find(id=>id!==handler&&id!==shooter);
 const cutter=offense.slice().reverse().find(id=>id!==handler&&id!==shooter&&id!==screener);
 const turnover=entry.result==='TURNOVER';
 const actors:CourtActor[]=offense.map((id,i)=>{
  const isShooter=id===shooter,isHandler=id===handler;
  const slot=SLOTS[(i+salt)%SLOTS.length];
  let start=starts?.get(id)??mirror({x:230+i*49,y:140+i*75});
  let loc:CourtPoint,pose:CourtPose='run',moving=true,settle=.3;
  if(isHandler&&!isShooter){
   // Walk it up, probe off the screen, then deliver the pass.
   const top=mirror({x:652,y:310-sign*26}),probe=mirror({x:700,y:310+sign*38});
   loc=q<.22?courtLerp(start,top,ease(q/.22)):courtLerp(top,probe,ease(window01(q,.22,.31)));
   moving=q<.31;pose=q<.31?'dribble':'idle';
   if(q>.48)loc=courtLerp(probe,mirror({x:668,y:310+sign*70}),ease(window01(q,.48,.7)));
  }else if(isShooter){
   const gather=mirror({x:726,y:310+sign*66});
   if(drive){
    // A drive gathers outside the paint, then accelerates toward the rim.
    const setup=isHandler?courtLerp(start,gather,ease(q/.3)):courtLerp(start,mirror(slot),ease(q/.28));
    loc=q<=.3?setup:courtLerp(isHandler?gather:mirror(slot),shot,ease((q-.3)/.25));
    settle=.55;pose=isHandler&&q<.55?'dribble':'run';
   }else{
    // Jump shooters relocate via a short curl so catch-and-shoot threes arrive on the move.
    const curl=courtLerp(start,shot,.72);curl.y+=sign*28;
    loc=q<.2?courtLerp(start,curl,ease(q/.2)):courtLerp(curl,shot,ease(window01(q,.2,.46)));
    settle=.46;pose=isHandler&&q<.48?'dribble':'run';
   }
   moving=q<settle;
  }else if(id===screener&&!ftActive){
   // Set a ball screen, hold, then roll hard to the rim (or pop if the rim is taken by the shooter).
   const screenAt=mirror({x:674,y:310+sign*8}),roll=mirror(drive?{x:806,y:310-sign*92}:{x:846,y:310-sign*36});
   loc=q<.2?courtLerp(start,mirror(slot),ease(q/.2)):q<.3?courtLerp(mirror(slot),screenAt,ease(window01(q,.2,.28))):q<.38?screenAt:courtLerp(screenAt,roll,ease(window01(q,.38,.56)));
   pose=q>=.28&&q<.38?'screen':'run';moving=!(q>=.28&&q<.38)&&q<.56;
  }else if(id===cutter&&!ftActive){
   // Weak-side cutter: baseline cut then replaces to the corner.
   const cut=mirror({x:872,y:310+sign*34}),fill=mirror(slot);
   loc=q<.24?courtLerp(start,mirror(slot),ease(q/.24)):q<.4?courtLerp(mirror(slot),cut,ease(window01(q,.26,.4))):courtLerp(cut,fill,ease(window01(q,.42,.58)));
   moving=q<.58;
  }else{
   loc=courtLerp(start,mirror(slot),ease(q/.28));moving=q<.28;
   if(q>.3&&!ftActive){loc.x+=Math.sin(q*6+i)*5;loc.y+=Math.sin(q*8+i*2)*6;}
  }
  if(q>.55&&play.rebounderId===id&&!isShooter&&!ftActive)loc=courtLerp(loc,mirror({x:862,y:310+sign*46}),ease(window01(q,.55,.8)));
  if(ftActive&&!isShooter)loc=mirror(FT_OFF[offense.filter(v=>v!==shooter).indexOf(id)%FT_OFF.length]);
  if(turnover&&q>.8)loc=courtLerp(loc,mirror({x:600-i*28,y:180+i*62}),ease(window01(q,.8,1)));
  const jumping=isShooter&&!ftActive&&!turnover&&q>.51&&q<(dunk?.84:.78);
  let jump=jumping?Math.sin(window01(q,.51,dunk?.84:.78)*Math.PI)*(dunk?30:three?15:13):0;
  if(dunk&&isShooter&&q>=.68&&q<.84&&!ftActive)jump=Math.max(jump,26); // hang on the rim
  if(jumping)pose='shoot';
  const celebrate=isShooter&&!ftActive&&play.shotMade&&q>.84;
  if(celebrate){pose='celebrate';jump=Math.abs(Math.sin(window01(q,.84,1)*Math.PI*2))*7;}
  if(ftActive)pose='idle';
  if(!moving&&pose==='run')pose='idle';
  return {...loc,id,teamId:entry.offenseTeamId,jump,stride:moving?Math.sin(q*58+i)*1:0,pose,facing:toward};
 });
 const ballSide=actors.find(a=>a.id===(q<.44?handler:shooter))??actors[0];
 defense.forEach((id,i)=>{
  const attacker=actors[i%Math.max(1,actors.length)];
  let target:CourtPoint;
  if(attacker){
   // Goal-side: stay between the man and the rim; sag toward the ball when a pass away.
   const dx=hoop.x-attacker.x,dy=hoop.y-attacker.y,d=Math.hypot(dx,dy)||1,gap=attacker.id===ballSide?.id?24:34;
   target={x:attacker.x+dx/d*gap,y:attacker.y+dy/d*gap};
   const far=Math.hypot((ballSide?.x??0)-attacker.x,(ballSide?.y??0)-attacker.y);
   if(far>230&&!ftActive){const help=courtLerp(target,mirror({x:806,y:310}),.32);target=help;}
  }else target=mirror(SLOTS[i%5]);
  if(q>.57&&(id===play.blockerId||id===play.rebounderId)){target={x:hoop.x+(right?-30:30),y:310+(id===play.blockerId?0:sign*49)};}
  if(id===play.stealerId&&q>.36&&q<.8){const lane=hand(handler);target=courtLerp(target,lane,ease(window01(q,.36,.5)));}
  if(turnover&&id===play.stealerId&&q>=.62){target=courtLerp(target,mirror({x:260,y:310+sign*40}),ease(window01(q,.62,1)));}
  else if(turnover&&q>=.7)target=courtLerp(target,mirror({x:520-i*30,y:170+i*66}),ease(window01(q,.7,1)));
  if(ftActive)target=mirror(FT_DEF[i%FT_DEF.length]);
  const start=starts?.get(id)??mirror({x:330+i*49,y:170+i*68});
  const loc=courtLerp(start,target,ease(q/.32));
  const contest=(id===play.blockerId||attacker?.id===shooter)&&q>.56&&q<.8&&!ftActive&&!turnover;
  const chasing=turnover&&q>.62;
  actors.push({...loc,id,teamId:offHome?awayId:homeId,jump:contest?Math.sin((q-.56)/.24*Math.PI)*(id===play.blockerId?25:12):0,stride:q<.32||chasing?Math.sin(q*58+i)*.8:Math.sin(q*30+i)*.25,
   pose:contest?'reach':chasing?(id===play.stealerId?'dribble':'run'):ftActive?'idle':'guard',facing:-toward});
 });
 function hand(id:string|undefined):CourtPoint{const a=actors.find(v=>v.id===id)??mirror({x:720,y:310});return {x:a.x+(right?12:-12),y:a.y-3}}
 if(ftActive&&p<mainShare+.05){const before=baseFrame(entry,play,mainShare-.000001,homeId,awayId,regulationPeriods,starts);const t=ease((p-mainShare)/.05);for(const a of actors){const old=before.players.find(v=>v.id===a.id);if(old){const point=courtLerp(old,a,t);a.x=point.x;a.y=point.y;}}}
 // Symmetric separation keeps feet apart without frame-rate-dependent integration.
 for(let n=0;n<3;n++)for(let i=0;i<actors.length;i++)for(let j=i+1;j<actors.length;j++){
  const a=actors[i],b=actors[j],dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy),radius=21;
  if(dist<radius){const amount=(radius-dist)*.5*ease(q/.12),nx=dist?dx/dist:1,ny=dist?dy/dist:0;a.x-=nx*amount;a.y-=ny*amount;b.x+=nx*amount;b.y+=ny*amount;}
 }
 for(const a of actors){a.x=limit(a.x,78,922);a.y=limit(a.y,100,520);}
 // Dribble: alternating hand with a crossover every third bounce.
 const dribbleHand=(id:string|undefined):CourtBall=>{
  const a=actors.find(v=>v.id===id)??{...mirror({x:720,y:310})},c=q*7,k=Math.floor(c),f=c-k;
  const side=(n:number)=>Math.floor(n/3)%2?-1:1,cross=k%3===2;
  const lateral=cross?side(k)+(side(k+1)-side(k))*f:side(k);
  return {x:a.x+lateral*11+(right?4:-4),y:a.y-2+lateral*3,z:4+24*4*f*(1-f),spin:q*1500};
 };
 let ball:CourtBall=dribbleHand(handler),phase=entry.secondChance?'Second chance':'Bring it up',carrier:string|undefined=handler,net=0,shotAttempt:number|undefined,rim=0,callout:CourtCallout|undefined;
 if(q>=.22&&q<.31&&screener)phase='Pick and roll';
 if(q>.31&&q<.48&&play.passerId){
  const t=(q-.31)/.17,from=hand(handler),to=hand(shooter);
  // Longer deliveries travel through the air; short feeds use one controlled bounce.
  const bounce=salt%3===0;
  if(bounce){const mid=courtLerp(from,to,.52);ball=t<.52?ballFlight(from,mid,t/.52,23,3,.35):ballFlight(mid,to,(t-.52)/.48,3,26,.32);}else ball=ballFlight(from,to,t,24,26,.55);
  phase=bounce?'Bounce pass':'Pass';carrier=undefined;
 }else if(q>=.48){ball=drive&&q<.55&&!play.passerId?dribbleHand(shooter):{...hand(shooter),z:28+14*limit((q-.48)/.08),spin:0};carrier=shooter;phase=drive?'Drive & gather':'Set for the shot';}
 const shotFrom=play.shooterId&&!onlyFT?shot:undefined;
 if(play.shooterId&&q>=.56&&!onlyFT&&!turnover){
  const t=limit((q-.56)/.2),from=hand(shooter),airtime=dunk?.25:close?.6:three?1.4:1.1;
  ball=ballFlight(from,hoop,t,dunk?48:42,34,airtime);
  carrier=undefined;phase=dunk?'At the rim':three?'Three-point attempt':'Shot in the air';
  if(play.blockerId&&q>=.66){const contact=ballFlight(from,hoop,.5,dunk?48:42,34,airtime);ball=ballFlight(contact,hand(play.rebounderId??play.blockerId),limit((q-.66)/.24),contact.z,25,.48);phase='Blocked';if(q>.9)carrier=play.rebounderId??play.blockerId;
   callout={text:'BLOCKED!',...contact,t:window01(q,.66,.96),tone:'defense'};}
  else if(q>=.76){
   if(play.shotMade){const t=limit((q-.76)/.16);ball={...hoop,z:34*(1-t*t),spin:q*900};if(q>.92){const bounce=limit((q-.92)/.08);ball.z=12*4*bounce*(1-bounce);}net=Math.sin(limit((q-.76)/.1)*Math.PI);phase=dunk?'Dunk!':'Basket';
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
  const dest=play.stealerId?hand(play.stealerId):mirror({x:933,y:480});
  ball=ballFlight(hand(handler),dest,limit((q-.5)/.12),23,play.stealerId?24:3,.45);phase=play.stealerId?'Steal':'Turnover';carrier=undefined;
  if(play.stealerId&&q>=.62){ball=dribbleHand(play.stealerId);carrier=play.stealerId;phase='Breakaway';}
  else if(!play.stealerId&&q>=.62){ball={...dest,z:0,spin:0};}
  callout={text:play.stealerId?'STEAL!':'TURNOVER',x:dest.x,y:dest.y-58,t:window01(q,.5,.85),tone:play.stealerId?'defense':'neutral'};
 }
 if(entry.result==='FOUL'&&!ftActive){phase='Whistle';ball={...hand(shooter),z:26,spin:0};if(q>.5)callout={text:'FOUL',x:hand(shooter).x,y:hand(shooter).y-66,t:window01(q,.5,1),tone:'neutral'};}
 if(ftActive){
  const count=Math.max(1,ftCount),cycle=limit((p-mainShare)/(1-mainShare))*count,attempt=Math.min(count-1,Math.floor(cycle)),t=cycle-attempt;
  shotAttempt=attempt+1;const shootingActor=actors.find(a=>a.id===shooter);if(shootingActor)shootingActor.pose=t>.15&&t<.75?'shoot':t<.15?'dribble':'idle';const from=hand(shooter);phase=`Free throw ${attempt+1} of ${count}`;carrier=t<.2?shooter:undefined;
  ball=t<.2?{...from,z:26-(t<.15?18*Math.abs(Math.sin(t/.15*Math.PI*2)):0),spin:0}:ballFlight(from,hoop,limit((t-.2)/.55),40,34,.95);
  // Old logs record FT totals, not attempt order. Reconstruct a sequence with the exact recorded totals.
  if(t>.75){const made=play.freeThrows?.outcomes?.[attempt]??attempt<(play.freeThrows?.made??0),u=limit((t-.75)/.25);ball=made?{...hoop,z:34*(1-u*u),spin:u*360}:ballFlight(hoop,mirror({x:838,y:357}),u,34,6,.38);net=made?Math.sin(u*Math.PI):0;rim=made?0:Math.sin(u*Math.PI)*.6;
   if(made)callout={text:'+1',x:hoop.x,y:hoop.y-60,t:u,tone:'make'};}
 }
 // Every non-carrier faces the ball; the carrier faces the basket being attacked.
 for(const a of actors){if(a.id!==carrier&&Math.abs(ball.x-a.x)>4)a.facing=ball.x>a.x?1:-1;}
 return {players:actors,ball,phase,carrier,hoop,net,attackRight:right,shotAttempt,offenseTeamId:entry.offenseTeamId,callout,rim,shotFrom};
}
/** A stateless scene makes pause, seek, high playback speeds and repeat viewing agree exactly. */
export function courtFrame(entry:PossessionLogEntry,progress:number,homeId:string,awayId:string,regulationPeriods=4,previous?:PossessionLogEntry):CourtFrame {
 const play=playbackForEntry(entry);
 const prior=previous&&previous.quarter===entry.quarter?baseFrame(previous,playbackForEntry(previous),1,homeId,awayId,regulationPeriods):undefined;
 const frame=baseFrame(entry,play,progress,homeId,awayId,regulationPeriods,prior?new Map(prior.players.map(a=>[a.id,a])):undefined);
 if(prior&&previous&&progress<.12){const t=ease(progress/.12),point=courtLerp(prior.ball,frame.ball,t);frame.ball={...point,z:prior.ball.z+(frame.ball.z-prior.ball.z)*t+12*Math.sin(t*Math.PI),spin:t*360};frame.phase=previous.offenseTeamId===entry.offenseTeamId?'Keep possession':playbackForEntry(previous).shotMade?'Inbound':'Outlet';frame.carrier=undefined;}
 return frame;
}
