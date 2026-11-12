import {it,expect} from 'vitest';
import {generateFullLeague} from '../simulation/leagueGenerator';
import {recordRivalryTrade} from '../simulation/rivalry';
import {planExplosions} from '../simulation/rivalryExplosion';
import {curryGameHigh} from '../profile/curryAchievement';
import {emptySeasonMilestones} from '../simulation/types';
import {earnedModeAchievements} from '../profile/modeAchievements';
it('fixes no more than two heated matchups for the entire season, including reloads',()=>{
 let {league}=generateFullLeague(1,2,8,4,'2026');const [a,b]=league.teams;
 for(let i=0;i<4;i++)league=recordRivalryTrade(league,a.teamId,b.teamId,true);
 const planned=planExplosions(league),games=planned.scoringShowcases!.games;
 expect(games.length).toBeGreaterThan(0);expect(games.length).toBeLessThanOrEqual(2);
 const reloaded=JSON.parse(JSON.stringify(planned));expect(planExplosions(reloaded).scoringShowcases!.games).toEqual(games);
});
it('Curry achievement recognizes Stephen and rejects Sandbox or another Curry',()=>{
 const {league}=generateFullLeague(1,2,8,4,'2026');const p=league.teams[0].seasons[0];p.playerId='Stephen Curry';p.seasonMilestones={...emptySeasonMilestones(),gameHighPoints:77};
 expect(curryGameHigh(league)).toBe(77);league.settings.sandboxMode=true;expect(curryGameHigh(league)).toBe(0);league.settings.sandboxMode=false;p.playerId='Seth Curry';expect(curryGameHigh(league)).toBe(0);
});
it('new achievements use synced progress and the exact requested thresholds',()=>{
 const read=(key:string)=>key==='cv-feats'?JSON.stringify({curryHigh:77}):key==='cv-profile-careers'?JSON.stringify({careers:1,retired:1,legacy:9000,hallOfFame:0}):null;
 expect(earnedModeAchievements(read)).toContain('over-9000');expect(earnedModeAchievements(read)).toContain('curry-77');
});
