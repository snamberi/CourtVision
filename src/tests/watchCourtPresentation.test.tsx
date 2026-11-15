// @vitest-environment jsdom
import {it,expect,afterEach} from 'vitest';
import {render,cleanup} from '@testing-library/react';
import {WatchCourt} from '../components/WatchCourt';
import type {CourtFrame,CourtActor} from '../simulation/courtMotion';
afterEach(cleanup);
const actor=(id:string,x:number,y:number):CourtActor=>({id,teamId:'GSW',x,y,jump:0,stride:1,pose:'dribble',facing:1,vx:80,vy:0,gait:'run',cycle:.3});
const frame:CourtFrame={players:[actor('Stephen Curry',500,310),actor('Klay Thompson',510,311)],ball:{x:512,y:307,z:20,spin:0},carrier:'Stephen Curry',phase:'Work the ball',hoop:{x:900,y:310},attackRight:true,net:0,offenseTeamId:'GSW'};
it('keeps shadows below the scene, the carried ball in front of its player, and labels above it',()=>{
 const {container}=render(<WatchCourt frame={frame} home={{teamId:'GSW',name:'Golden State'}} away={{teamId:'CLE',name:'Cleveland'}} rosters={[]}/>);
 expect(container.querySelectorAll('.court-player')).toHaveLength(2);
 expect(container.querySelectorAll('[data-testid="player-ground"]')).toHaveLength(2);
 const layers=[...container.querySelectorAll('[data-depth-layer]')].map(n=>n.getAttribute('data-depth-layer'));
 expect(layers.indexOf('ball')).toBeGreaterThan(layers.indexOf('Stephen Curry'));
 expect(layers.indexOf('ball')).toBeLessThan(layers.indexOf('Klay Thompson'));
 const labels=[...container.querySelectorAll('.court-player-label')];expect(labels).toHaveLength(2);
 expect(labels[0].getAttribute('transform')).not.toBe(labels[1].getAttribute('transform'));
 expect(container.querySelector('.court-player')?.getAttribute('data-view')).toBe('right');
});
it('makes extra ball trails opt-in and keeps contact cues small',()=>{
 const flight={...frame,flightTrail:[{x:510,y:307,z:20,spin:0}],carrier:undefined};
 const props={frame:flight,home:{teamId:'GSW',name:'Golden State'},away:{teamId:'CLE',name:'Cleveland'},rosters:[]};
 const {container,rerender}=render(<WatchCourt {...props}/>);
 const count=container.querySelectorAll('.court-play-effects rect').length;
 rerender(<WatchCourt {...props} trail/>);
 expect(container.querySelectorAll('.court-play-effects rect').length).toBeGreaterThan(count);
});
