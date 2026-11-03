import { describe,it,expect } from 'vitest';
import { advanceEventClock,emptyClock } from '../retention/eventPlaytime';
import { makeDefaultSeason } from '../simulation/presets/samplePlayers';
import { deferDevelopment,finishDevelopment } from '../simulation/developmentCheckpoint';
import { explosionRoster } from '../simulation/rivalryExplosion';
import { recentPlayerStats,playerTags } from '../simulation/playerLabels';
import { emptySeasonStatTotals } from '../simulation/types';
import { developOffseasonPlayer } from '../simulation/engine/development';
import { calculateOverall } from '../simulation/engine/overall';
import { RNG } from '../simulation/engine/rng';
describe('Update 50 requested expansion',()=>{
 it('pays six ten-minute rewards plus the hourly bonus and preserves fractional mode bonuses',()=>{
  for(const boosted of [false,true]){let clock=emptyClock(),earned=0;for(let i=0;i<240;i++){const out=advanceEventClock(clock,15000,boosted);clock=out.clock;earned+=out.earned;}expect(earned).toBe(boosted?39:26);}
 });
 it('does not credit an offline hour and prorates a last-second mode switch',()=>{
  expect(advanceEventClock(emptyClock(),3600000,true).clock.elapsed).toBe(15000);
  let clock=emptyClock(),earned=0;for(let i=0;i<240;i++){const out=advanceEventClock(clock,15000,i===239);clock=out.clock;earned+=out.earned;}expect(earned).toBe(26);expect(clock.fraction).toBeGreaterThan(0);
 });
 it('keeps ratings until the preseason checkpoint and applies only once',()=>{
  const p=makeDefaultSeason('Test','2026',null,21),after=structuredClone(p);after.attributes.offense.threePoint+=5;
  const queued=deferDevelopment(p,after);expect(queued.attributes).toEqual(p.attributes);
  const applied=finishDevelopment(queued);expect(applied.attributes.offense.threePoint).toBe(after.attributes.offense.threePoint);expect(finishDevelopment(applied)).toBe(applied);expect(p.attributes).toEqual(queued.attributes);
 });
 it('rivalry scoring increases touches for one capable scorer without changing ratings or bench minutes',()=>{
  const a=makeDefaultSeason('Star','2026',null,26),b=makeDefaultSeason('Bench','2026',null,23);a.attributes.offense.threePoint=95;a.attributes.offense.shotIQ=95;
  const out=explosionRoster([a,b],true);expect(out[0].tendencies.ballDominance).toBeGreaterThan(a.tendencies.ballDominance);expect(out[0].attributes).toEqual(a.attributes);expect(out[1]).toBe(b);expect(explosionRoster([a,b],false)[0]).toBe(a);
 });
 it('uses full current totals then the most recent played season, not a recent-game sample',()=>{
  const p=makeDefaultSeason('Test','2026',null,23);p.seasonStats={...emptySeasonStatTotals(),gamesPlayed:3,points:90};expect(recentPlayerStats(p)?.stats.points).toBe(90);p.attributes.offense.threePoint=90;p.attributes.defense.perimeterDefense=85;expect(playerTags(p)).toContain('3&D');
 });
 it('default young-player movement averages near three across many seeds and never exceeds ten',()=>{
  const p=makeDefaultSeason('Prospect','2026',null,20);p.development={...p.development,potential:99,workEthic:60,developmentRate:60};p.seasonStats={...emptySeasonStatTotals(),minutes:2200,gamesPlayed:82};
  const deltas=Array.from({length:500},(_,i)=>calculateOverall(developOffseasonPlayer(p,new RNG(i)))-calculateOverall(p));
  expect(Math.max(...deltas)).toBeLessThanOrEqual(10);const avg=deltas.reduce((a,b)=>a+b,0)/deltas.length;expect(avg).toBeGreaterThan(2.4);expect(avg).toBeLessThan(3.8);
 });
});

it('keeps every career-history row and does not mutate the input during optimized development',()=>{
 const p=makeDefaultSeason('Veteran','2040',null,33);
 p.careerHistory=Array.from({length:20},(_,i)=>({season:String(2020+i),teamId:'A',age:18+i,overall:70,stats:{...emptySeasonStatTotals(),gamesPlayed:82,points:1800}})) as NonNullable<typeof p.careerHistory>;
 const before=structuredClone(p);const out=developOffseasonPlayer(p,new RNG(77));
 expect(p).toEqual(before);expect(out.careerHistory).toEqual(before.careerHistory);expect(out.careerHistory).toHaveLength(20);
});
it('decline also averages near three and bench outcomes include both rust and rare breakouts',()=>{
 const old=makeDefaultSeason('Veteran','2026',null,38);old.seasonStats={...emptySeasonStatTotals(),minutes:2200,gamesPlayed:82};
 const drops=Array.from({length:500},(_,i)=>calculateOverall(old)-calculateOverall(developOffseasonPlayer(old,new RNG(i))));
 expect(Math.max(...drops)).toBeLessThanOrEqual(10);const avg=drops.reduce((a,b)=>a+b,0)/drops.length;expect(avg).toBeGreaterThan(2.4);expect(avg).toBeLessThan(3.8);
 const bench=makeDefaultSeason('Bench','2026',null,23);bench.development={...bench.development,workEthic:90,potential:80};bench.seasonStats={...emptySeasonStatTotals(),minutes:300,gamesPlayed:60};
 const outcomes=Array.from({length:300},(_,i)=>developOffseasonPlayer(bench,new RNG(i)));
 expect(outcomes.some(p=>p.developmentReason?.startsWith('Late breakout'))).toBe(true);expect(outcomes.some(p=>p.developmentReason?.startsWith('Lost rhythm'))).toBe(true);
});
