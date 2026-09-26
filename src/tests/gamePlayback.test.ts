import { describe, expect, it } from 'vitest';
import { simulateGame } from '../simulation/engine/game';
import { buildDemoTeam } from '../simulation/presets/samplePlayers';
import { DEFAULT_GAME_SETTINGS } from '../simulation/types';
import { hotHand, playbackClock, playbackForEntry, playbackScore } from '../simulation/gamePlayback';

const game = () => simulateGame({ home:buildDemoTeam('H','Home'), away:buildDemoTeam('A','Away'), settings:{...DEFAULT_GAME_SETTINGS,injuriesEnabled:false,seed:92} });
describe('recorded game playback', () => {
  it('records the actual handler and participants and reconstructs every point and three in the boxes', () => {
    const g=game(); const totals:Record<string,{points:number;threes:number}>={};
    for (const e of g.possessionLog) {
      expect(e.events).toContain(`${e.ballHandlerId} has the ball`);
      expect([...e.onCourtHome,...e.onCourtAway]).toContain(e.ballHandlerId);
      const p=playbackForEntry(e);
      for (const id of [p.shooterId,p.passerId,p.rebounderId,p.stealerId,p.blockerId].filter(Boolean)) expect([...e.onCourtHome,...e.onCourtAway]).toContain(id);
      if(p.passerId) expect(e.events).toContain(`Pass to ${p.shooterId}`);
      if(p.shooterId) {
        const n=totals[p.shooterId]??={points:0,threes:0};
        const three=['corner3','aboveBreak3','pullUp3','catchAndShoot3','stepback'].includes(p.shotType??'');
        if(p.freeThrows?.outcomes){expect(p.freeThrows.outcomes.length).toBe(p.freeThrows.attempted);expect(p.freeThrows.outcomes.filter(Boolean).length).toBe(p.freeThrows.made);}
        n.points+=(p.shotMade?(three?3:2):0)+(p.freeThrows?.made??0);
        n.threes+=p.shotMade&&three?1:0;
      }
    }
    for (const s of Object.values({...g.homeBox.players,...g.awayBox.players})) {
      expect(totals[s.playerId]?.points??0).toBe(s.points);
      expect(totals[s.playerId]?.threes??0).toBe(s.tpm);
    }
  });
  it('reveals only completed possessions, then exactly matches the official final score', () => {
    const g=game();expect(playbackScore(g,0)).toEqual({home:0,away:0});
    const e=g.possessionLog[9];expect(playbackScore(g,10)).toEqual({home:e.homeScoreAfter,away:e.awayScoreAfter});
    expect(playbackScore(g,g.possessionLog.length)).toEqual({home:g.homeScore,away:g.awayScore});
    expect(hotHand(g,0)).toBeNull();
  });
  it('replays old saves without metadata or duration and uses the original custom-period rules', () => {
    const g=game(); const e=g.possessionLog.find(e=>e.playback?.passerId&&e.result==='MAKE')!;
    const legacy={...e,playback:undefined};
    expect(playbackForEntry(legacy).shooterId).toBe(e.playback?.shooterId);
    expect(playbackForEntry(legacy).passerId).toBe(e.playback?.passerId);
    g.regulationPeriods=2;
    g.possessionLog=[{...e,quarter:2,clockSeconds:65,durationSeconds:undefined},{...e,quarter:2,clockSeconds:45}];
    expect(playbackClock(g,0,.5)).toBe('H2 · 0:55');
    g.possessionLog[0].quarter=3;expect(playbackClock(g,0,0)).toBe('OT1 · 1:05');
  });
  it('hot streaks require three actual consecutive made three-point attempts', () => {
    const g=game(); const base=g.possessionLog[0];
    g.possessionLog=Array.from({length:4},()=>({...base,result:'MAKE',playback:{shooterId:'Shooter',shotType:'pullUp3',shotMade:true}}));
    expect(hotHand(g,2)).toBeNull();expect(hotHand(g,3)).toEqual({playerId:'Shooter',threes:3});
    g.possessionLog[3].playback!.shotMade=false;expect(hotHand(g,4)).toBeNull();
  });
});
