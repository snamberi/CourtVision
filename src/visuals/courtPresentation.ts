import type { CourtActor, CourtBall, CourtPoint } from '../simulation/courtMotion';
import { hashPlayerId, athleticY } from './playerSprite';
import { likenessKey } from './likeness';
import { smoothFrame, mirrorPose, upperHand, type CourtView, type P, type Pose } from './actionSprites';

const clamp = (v:number,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));
const ease = (v:number)=>{const t=clamp(v);return t*t*(3-2*t);};
export const RIM_HEIGHT = 70;
/** Continuous display projection: dribbles stay low and high passes don't leap above the rim. */
export const ballHeight = (z:number) => z<=28 ? z : z<=34 ? 28+(z-28)*7 : RIM_HEIGHT+(z-34)*1.6;

export function courtView(dx:number,dy:number):CourtView {
  if(Math.hypot(dx,dy)<4)return 'front';
  const directions:CourtView[]=['right','frontRight','front','frontLeft','left','backLeft','back','backRight'];
  return directions[(Math.round(Math.atan2(dy,dx)/(Math.PI/4))+8)%8];
}

/** Bounded two-bone reach, in the same pixel coordinate system as the rasterizer. */
export function reachBall(input:Pose,target:P,facing:number,twoHands=false,view:CourtView='front'):Pose {
  const p=facing<0?mirrorPose(input):{...input};
  if(p.lie)return input;
  const shear=Math.round((p.lean??0)*14/34);
  const local:P=[Math.round(target[0]-p.body[0]-shear+20),Math.round(target[1]-p.body[1]+50)];
  const profile=view==='left'||view==='right',diagonal=view.includes('Left')||view.includes('Right');
  const span=p.travel?8*(profile?.28:diagonal?.65:1):profile?6:8;
  const nearest=Math.hypot(local[0]-(20-span),local[1]-athleticY(27))<Math.hypot(local[0]-(20+span),local[1]-athleticY(27))?'l':'r';
  for(const side of twoHands?['l','r'] as const:[nearest] as const){
    const shoulder:P=[20+(side==='l'?-span:span),athleticY(27)],dx=local[0]-shoulder[0],dy=local[1]-shoulder[1],distance=Math.hypot(dx,dy);
    if(distance>27)continue; // Never stretch an arm to a ball that's already been released.
    const d=clamp(distance,4,23),nx=dx/(distance||1),ny=dy/(distance||1);
    const h:P=[Math.round(shoulder[0]+nx*d),Math.round(shoulder[1]+ny*d)];
    const bend=Math.sqrt(Math.max(0,12*12-d*d/4))*(side==='l'?-1:1);
    const e:P=[Math.round((shoulder[0]+h[0])/2-ny*bend),Math.round((shoulder[1]+h[1])/2+nx*bend)];
    if(side==='l'){p.lE=e;p.lH=h;}else{p.rE=e;p.rH=h;}
  }
  return facing<0?mirrorPose(p):p;
}

/** A render pose has no effect on saved games, stats or simulation RNG. */
export function presentAthlete(actor:CourtActor,ball:CourtBall,hoop:CourtPoint,carrier:boolean,height=79){
  const scale=1.18*clamp(height/79,.9,1.1),speed=Math.hypot(actor.vx??0,actor.vy??0);
  const moving=speed>14||actor.stride!==0;
  const f=smoothFrame({pose:actor.pose,anim:actor.anim,cycle:actor.cycle,carrier,moving,ballZ:ball.z,gait:actor.gait,onBall:actor.onBall});
  let pose:Pose={...f.pose};
  const facing=(actor.facing<0?-1:1)*(f.flip?-1:1),t=actor.anim?.t??0;
  const style=hashPlayerId(actor.id)%3,key=likenessKey(actor.id);
  // Individual release forms, rather than changing the player's face or proportions.
  if(actor.anim&&['jumper','stepback','fadeaway','ft'].includes(actor.anim.kind)&&t>.15&&t<.85){
    const high=key==='kevin durant'? -3:key==='stephen curry'?2:style-1;
    pose.rH=[pose.rH[0]+(style-1)*2,pose.rH[1]+high];
    pose.rE=[pose.rE[0],pose.rE[1]+Math.round(high/2)];
  }
  // A gait's torso and legs belong to its authored drawing. Braking changes floor
  // velocity, never shears the head or collapses the knees into a generic crouch.
  if(carrier&&!actor.anim&&!moving&&style===0)pose={...pose,body:[pose.body[0],pose.body[1]+.5]};
  if(actor.anim?.kind==='celebrate'){
    if(style===1)pose={...pose,lE:[10,30],lH:[18,29]}; // fist to chest
    if(style===2)pose={...pose,rE:[33,20],rH:[37,8]}; // point to the crowd
  }
  const slam=actor.anim?.kind==='dunk'||actor.anim?.kind==='alleyOop';
  const contact=slam?ease((t-.35)/.16)*(1-ease((t-.68)/.18)):0;
  const hand=upperHand(pose,facing);
  // Contact correction only near the basket: never pull a player across the court.
  const reach=contact*(1-ease((Math.abs(hoop.x-actor.x)-45)/50));
  const offsetX=clamp(hoop.x-actor.x-hand[0]*scale,-35,35)*reach;
  const targetLift=actor.y-hoop.y+RIM_HEIGHT+hand[1]*scale;
  const lift=actor.jump+(clamp(targetLift,0,42)-actor.jump)*reach;
  const target:P=[(ball.x-actor.x-offsetX)/scale,(ball.y-ballHeight(ball.z)-actor.y+lift)/scale];
  // Running watches the route; defenders, receivers and shooters look at the play.
  const running=moving&&!actor.anim&&actor.gait!=='slide'&&actor.gait!=='backpedal';
  const view=running?courtView(actor.vx??facing*30,actor.vy??0):courtView(ball.x-actor.x,ball.y-actor.y);
  const kind=actor.anim?.kind;
  const gathering=kind&&(['catch','rebound'].includes(kind)||(['jumper','stepback','fadeaway','ft'].includes(kind)&&t<.45)||(['layup','floater'].includes(kind)&&t<.35)||(['dunk','alleyOop'].includes(kind)&&t<.65)||(['chestPass','bouncePass','overheadPass'].includes(kind)&&t<.4));
  if((carrier||gathering)&&ball.z>11&&Math.abs(ball.y-actor.y)<45){
    pose=reachBall(pose,target,facing,kind==='catch'||kind==='rebound',view);
  }
  const poseKey=[pose.body,pose.lE,pose.lH,pose.rE,pose.rH,pose.lK,pose.lF,pose.rK,pose.rF].flat().map(n=>Math.round(n*2)/2).join(',');
  return {pose,view,facing,scale,lift,offsetX,contact:reach,frameId:`${f.id}:${pose.lean??0}:${poseKey}`,speed};
}

/** Labels occupy separate lanes; the carrier gets first choice. */
export function labelOffsets(players:readonly CourtActor[],carrier?:string):Map<string,number>{
  const placed:{x:number;y:number}[]=[],out=new Map<string,number>();
  const ordered=[...players].sort((a,b)=>Number(b.id===carrier)-Number(a.id===carrier)||a.y-b.y||a.id.localeCompare(b.id));
  for(const p of ordered){
    let offset=19;
    for(let lane=0;lane<4;lane++){
      offset=19+lane*13;
      if(!placed.some(q=>Math.abs(q.x-p.x)<90&&Math.abs(q.y-(p.y+offset))<12))break;
    }
    placed.push({x:p.x,y:p.y+offset});out.set(p.id,offset);
  }
  return out;
}
