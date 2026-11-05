import {describe,it,expect} from 'vitest';
import {courtView,presentAthlete,reachBall,labelOffsets,ballHeight} from '../visuals/courtPresentation';
import {ANIMATIONS,actionSprite,mirrorPose,type CourtView} from '../visuals/actionSprites';
import {athleticY} from '../visuals/playerSprite';
import type {CourtActor} from '../simulation/courtMotion';
const actor:CourtActor={id:'Stephen Curry',teamId:'GSW',x:500,y:310,jump:0,stride:1,pose:'run',facing:1,vx:100,vy:0,cycle:.3,gait:'run'};
const hoop={x:900,y:310},ball={x:512,y:307,z:23,spin:0};
describe('court presentation',()=>{
 it('selects eight directions without mirroring jersey digits or changing identity',()=>{
  const expected:CourtView[]=['right','frontRight','front','frontLeft','left','backLeft','back','backRight'];
  const sprites=new Set<string>();
  for(let i=0;i<8;i++){
   const view=courtView(Math.cos(i*Math.PI/4)*100,Math.sin(i*Math.PI/4)*100);
   expect(view).toBe(expected[i]);
   const paths=actionSprite('view-test',ANIMATIONS.run[0],{playerId:actor.id,primary:'#1d428a',secondary:'#ffc72c',jerseyNumber:30,view});
   expect(paths.some(p=>p.fill==='#1d428a')).toBe(true);sprites.add(JSON.stringify(paths));
  }
  expect(sprites.size).toBe(8);
 });
 it('keeps grounded contacts and authored flight frames without tilting for acceleration',()=>{
  for(let i=0;i<32;i++){
   const frame=presentAthlete({...actor,cycle:i/32},ball,hoop,false);
   if(!frame.pose.air)expect(Math.max(frame.pose.lF[1],frame.pose.rF[1])).toBe(49);
   else expect(Math.max(frame.pose.lF[1],frame.pose.rF[1])).toBeLessThan(49);
  }
  const brake=presentAthlete({...actor,momentum:-200},ball,hoop,false);
  const accelerate=presentAthlete({...actor,momentum:200},ball,hoop,false);
  expect(brake.pose).toEqual(accelerate.pose);
  expect(brake.pose.lean??0).toBe(0);
 });
 it('reaches a nearby ball with bounded arms on either side and never reaches a released ball',()=>{
  const input=ANIMATIONS.catch[2];
  for(const facing of [-1,1]){
   const result=reachBall(input,[18*facing,-24],facing);
   const p=facing<0?mirrorPose(result):result;
   const hand=facing<0?p.lH:p.rH,elbow=facing<0?p.lE:p.rE,shoulder=facing<0?12:28;
   expect(Math.hypot(hand[0]-elbow[0],hand[1]-elbow[1])).toBeLessThan(14);
   expect(Math.hypot(elbow[0]-shoulder,elbow[1]-athleticY(27))).toBeLessThan(14);
  }
  expect(reachBall(input,[300,-200],1)).toEqual(input);
 });
 it('clamps dunk corrections near the rim and preserves raw actor positions',()=>{
  const a={...actor,x:870,anim:{kind:'dunk' as const,t:.55},jump:27};const before=JSON.stringify(a);
  const near=presentAthlete(a,ball,hoop,false),far=presentAthlete({...a,x:500},ball,hoop,false);
  expect(near.contact).toBeGreaterThan(.9);expect(Math.abs(near.offsetX)).toBeLessThanOrEqual(35);
  expect(far.offsetX).toBe(0);expect(JSON.stringify(a)).toBe(before);
 });
 it('keeps the projection continuous and label lanes separate',()=>{
  for(const z of [28,34])expect(Math.abs(ballHeight(z-.00001)-ballHeight(z+.00001))).toBeLessThan(.001);
  const ps=[actor,{...actor,id:'B',x:515,y:311},{...actor,id:'C',x:490,y:308}];
  const offsets=labelOffsets(ps,actor.id);
  expect(offsets.get(actor.id)).toBe(19);
  const ys=ps.map(p=>p.y+offsets.get(p.id)!);
  for(let i=0;i<ys.length;i++)for(let j=i+1;j<ys.length;j++)expect(Math.abs(ys[i]-ys[j])).toBeGreaterThanOrEqual(12);
 });
 it('uses individual shot and celebration forms without changing the logged action',()=>{
  const a={...actor,anim:{kind:'jumper' as const,t:.5}};
  const curry=presentAthlete(a,{...ball,x:700},hoop,false);
  const kd=presentAthlete({...a,id:'Kevin Durant'},{...ball,x:700},hoop,false);
  expect(curry.pose.rH[1]).toBeGreaterThan(kd.pose.rH[1]);
  expect(a.anim.kind).toBe('jumper');
 });
});
