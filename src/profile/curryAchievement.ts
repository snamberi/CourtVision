import type { League } from '../simulation/league';
import { noteFeat } from './feats';
export function curryGameHigh(league: League): number {
 if(league.settings.sandboxMode)return 0;
 return Math.max(0,...[...league.teams.flatMap(t=>t.seasons),...(league.retiredPlayers??[]).map(r=>r.finalSeasonData).filter((p):p is NonNullable<typeof p>=>!!p)].filter(p=>/^Stephen Curry(?: \(\d{4}\))?$/.test(p.playerId)).map(p=>Math.max(p.seasonMilestones?.gameHighPoints??0,...(p.careerHistory??[]).map(y=>y.milestones?.gameHighPoints??0))));
}
export function noteCurryHigh(league:League){const high=curryGameHigh(league);if(high>=77)noteFeat('curryHigh',high,'max');}
