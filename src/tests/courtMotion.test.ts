import { describe,it,expect } from 'vitest';
import { ballFlight,courtFrame,courtShot,replayDuration } from '../simulation/courtMotion';
import { simulateGame } from '../simulation/engine/game';
import { buildDemoTeam } from '../simulation/presets/samplePlayers';
import { DEFAULT_GAME_SETTINGS } from '../simulation/types';
import type { PossessionLogEntry } from '../simulation/boxscore';
const game=simulateGame({home:buildDemoTeam('H','Home'),away:buildDemoTeam('A','Away'),settings:{...DEFAULT_GAME_SETTINGS,seed:92,injuriesEnabled:false}});
const entry:PossessionLogEntry={...game.possessionLog[0],offenseTeamId:'H',quarter:1,result:'MAKE',ballHandlerId:game.possessionLog[0].onCourtHome[0],playback:{shooterId:game.possessionLog[0].onCourtHome[0],shotType:'catchAndShoot3',shotMade:true}};
describe('court motion',()=>{
 it('uses a gravity arc with exact release and catch heights',()=>{const a={x:100,y:100},b={x:600,y:300};expect(ballFlight(a,b,0,40,34,1).z).toBe(40);expect(ballFlight(a,b,1,40,34,1)).toMatchObject({...b,z:34});expect(ballFlight(a,b,.5,40,34,1).z).toBeGreaterThan(40);expect(ballFlight(a,b,.5,40,34,1.5).z).toBeGreaterThan(ballFlight(a,b,.5,40,34,1).z)});
 it('keeps recorded participants, finite coordinates and ground bounds without mutating games',()=>{const before=JSON.stringify(game);for(const [i,e] of game.possessionLog.entries()){for(const progress of [0,.32,.5,.65,.77,.9,1]){const f=courtFrame(e,progress,'H','A',4,game.possessionLog[i-1]);expect(f.players.map(p=>p.id).sort()).toEqual([...e.onCourtHome,...e.onCourtAway].sort());for(const p of f.players){expect(p.x).toBeGreaterThanOrEqual(78);expect(p.x).toBeLessThanOrEqual(922);expect(p.y).toBeGreaterThanOrEqual(100);expect(p.y).toBeLessThanOrEqual(520);expect(Number.isFinite(p.jump)).toBe(true)}expect(f.ball.z).toBeGreaterThanOrEqual(0);expect(Number.isFinite(f.ball.x+f.ball.y+f.ball.z)).toBe(true)}}expect(JSON.stringify(game)).toBe(before)});
 it('made shots enter the net; misses and blocks take different paths',()=>{const make=courtFrame(entry,.82,'H','A');const miss=courtFrame({...entry,result:'MISS',playback:{...entry.playback,shotMade:false,rebounderId:entry.onCourtAway[0]}},.82,'H','A');const block=courtFrame({...entry,result:'MISS',playback:{...entry.playback,shotMade:false,blockerId:entry.onCourtAway[0]}},.7,'H','A');expect(make.ball.x).toBe(make.hoop.x);expect(make.net).toBeGreaterThan(0);expect(miss.ball.x).not.toBe(miss.hoop.x);expect(block.phase).toBe('Blocked')});
 it('switches baskets at halftime and keeps overtime on the second-half side',()=>{expect(courtFrame(entry,.6,'H','A').attackRight).toBe(true);expect(courtFrame({...entry,quarter:3},.6,'H','A').attackRight).toBe(false);expect(courtFrame({...entry,quarter:5},.6,'H','A').attackRight).toBe(false);expect(courtFrame({...entry,quarter:2},.6,'H','A',2).attackRight).toBe(false)});
 it('joins consecutive possession positions and ball endpoints',()=>{const prev=game.possessionLog[0],next=game.possessionLog[1];const end=courtFrame(prev,1,'H','A'),start=courtFrame(next,0,'H','A',4,prev);for(const p of start.players){const old=end.players.find(a=>a.id===p.id);if(old){expect(p.x).toBeCloseTo(old.x);expect(p.y).toBeCloseTo(old.y)}}expect(start.ball.x).toBeCloseTo(end.ball.x);expect(start.ball.y).toBeCloseTo(end.ball.y);expect(start.ball.z).toBeCloseTo(end.ball.z)});
 it('reconstructs every free throw and gives attempts additional viewing time',()=>{const e={...entry,result:'FOUL' as const,playback:{...entry.playback,shotMade:false,freeThrows:{made:2,attempted:3}}};expect(replayDuration(e)).toBeGreaterThan(replayDuration(entry));expect(courtFrame(e,.3,'H','A').shotAttempt).toBe(1);expect(courtFrame(e,.6,'H','A').shotAttempt).toBe(2);expect(courtFrame(e,.9,'H','A').shotAttempt).toBe(3)});
 it('is seekable and deterministic for old saves without playback metadata',()=>{const old={...game.possessionLog[5],playback:undefined};const before=courtFrame(old,.67,'H','A');courtFrame(old,.9,'H','A');expect(courtFrame(old,.67,'H','A')).toEqual(before)});
 it('pops the right callout for makes, blocks and steals, and none on a plain miss',()=>{
  expect(courtFrame(entry,.85,'H','A').callout?.text).toBe('+3');
  expect(courtFrame({...entry,playback:{...entry.playback,shotType:'dunk'}},.85,'H','A').callout?.text).toBe('SLAM!');
  expect(courtFrame({...entry,result:'MISS',playback:{...entry.playback,shotMade:false,blockerId:entry.onCourtAway[0]}},.75,'H','A').callout?.text).toBe('BLOCKED!');
  expect(courtFrame({...entry,result:'TURNOVER',playback:{stealerId:entry.onCourtAway[1]}},.7,'H','A').callout?.text).toBe('STEAL!');
  expect(courtFrame({...entry,result:'MISS',playback:{...entry.playback,shotMade:false,rebounderId:entry.onCourtAway[0]}},.85,'H','A').callout).toBeUndefined();
 });
 it('charts threes behind the arc and rim attempts near the basket, on the side being attacked',()=>{
  for(const e of game.possessionLog){const s=courtShot(e,'H');if(!s)continue;const hoopX=s.x>500?900:100,d=Math.hypot((s.x-hoopX)/221,(s.y-310)/213);
   expect(s.x).toBeGreaterThanOrEqual(78);expect(s.x).toBeLessThanOrEqual(922);expect(s.y).toBeGreaterThanOrEqual(100);expect(s.y).toBeLessThanOrEqual(520);
   if(s.three&&Math.abs(s.y-310)<190)expect(d).toBeGreaterThan(1);if(s.dunk)expect(Math.abs(s.x-hoopX)).toBeLessThan(40);}
  expect(courtShot({...entry,result:'TURNOVER'},'H')).toBeNull();
  expect(courtShot(entry,'H')!.x).toBeGreaterThan(500);expect(courtShot({...entry,quarter:3},'H')!.x).toBeLessThan(500);
 });
 it('moves like basketball: walks, runs, sprints and slides, dribble moves, every kind of pass and a catch',()=>{
  const gaits=new Set<string>(),anims=new Set<string>();
  for(const [i,e] of game.possessionLog.entries())for(let p=0;p<=1;p+=.02){const f=courtFrame(e,p,'H','A',4,game.possessionLog[i-1]);for(const a of f.players){if(a.gait)gaits.add(a.gait);if(a.anim)anims.add(a.anim.kind);}}
  for(const g of ['walk','run','sprint','slide'])expect(gaits.has(g),g).toBe(true);
  for(const k of ['crossover','chestPass','catch','contest'])expect(anims.has(k),k).toBe(true);
  expect(['behindBack','spin','jab'].some(k=>anims.has(k))).toBe(true);
  expect(['overheadPass','bouncePass'].some(k=>anims.has(k))).toBe(true);
 });
 it('a charge puts the defender on the floor and calls it; a block is a block, not a reach',()=>{
  const e={...entry,result:'TURNOVER' as const,events:[...entry.events,'Turnover: CHARGE'],playback:{}};
  const f=courtFrame(e,.66,'H','A');
  expect(f.players.some(a=>a.anim?.kind==='charge')).toBe(true);
  expect(courtFrame(e,.7,'H','A').callout?.text).toBe('CHARGE!');
  const b=courtFrame({...entry,result:'MISS',playback:{...entry.playback,shotMade:false,blockerId:entry.onCourtAway[0]}},.62,'H','A');
  expect(b.players.find(a=>a.id===entry.onCourtAway[0])?.anim?.kind).toBe('block');
 });
 it('shoots the shot the log records: a floater, a step-back, a fadeaway',()=>{
  const kindAt=(shotType:string)=>courtFrame({...entry,playback:{...entry.playback,shotType}},.6,'H','A').players.find(a=>a.id===entry.playback!.shooterId)?.anim?.kind;
  expect(kindAt('close')).toBe('floater');
  expect(kindAt('stepback')).toBe('stepback');
  expect(kindAt('fadeaway')).toBe('fadeaway');
  expect(kindAt('layup')).toBe('layup');
 });
});
