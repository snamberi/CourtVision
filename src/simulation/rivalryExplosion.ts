import type { League } from './league';
import type { PlayerSeason } from './types';
import { rivalryTable, rivalryKey } from './rivalry';
const hash=(s:string)=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
/** One or two matchups across the league, fixed for the season. No eligible heated rivalry means none. */
export function planExplosions(league: League): League {
 if(league.scoringShowcases && league.scoringShowcases.season === league.season)return league;
 const hot=new Set(rivalryTable(league).filter(r=>r.total>=10).map(r=>rivalryKey(r.a,r.b)));
 const games=league.schedule.filter(g=>!g.played&&hot.has(rivalryKey(g.homeTeamId,g.awayTeamId))).sort((a,b)=>hash(`${league.season}:${a.id}`)-hash(`${league.season}:${b.id}`)).slice(0,1+hash(league.season??'')%2).map(g=>g.id);
 return {...league,scoringShowcases:{season:league.season,games}};
}
/** Give the best available scorer more touches, not guaranteed baskets or extra minutes. */
export function explosionRoster(roster:PlayerSeason[], active:boolean, firstOption?:string):PlayerSeason[] {
 if(!active||!roster.length)return roster;
 const scoring=(p:PlayerSeason)=>{const o=p.attributes.offense;return Math.max(o.threePoint,o.finishing,o.midrange)*.6+o.shotIQ*.4;};
 const star=roster.find(p=>p.playerId===firstOption)??[...roster].sort((a,b)=>scoring(b)-scoring(a)||a.playerId.localeCompare(b.playerId))[0];
 if(scoring(star)<70)return roster;
 return roster.map(p=>p!==star?p:{...p,ballHandlerPriority:Math.min(100,p.ballHandlerPriority+8),tendencies:{...p.tendencies,ballDominance:Math.min(100,p.tendencies.ballDominance+10),role:{...p.tendencies.role,shotCreator:Math.min(100,p.tendencies.role.shotCreator+10)}}});
}
