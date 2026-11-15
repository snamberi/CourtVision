import { mix, playerTraits, type SpriteGrid, type SpriteOptions } from './playerSprite';

/** Native 64px artwork. Coordinates below address individual cells directly;
 * the renderer never enlarges a smaller bitmap or samples an illustration. */
export const PLAYER_PIXELS = 64;
export const PLAYER_CENTER_X = 32, PLAYER_FEET_Y = 61, PLAYER_NECK_Y = 35;
export const RIG_X_SCALE = 1.14, RIG_Y_SCALE = 1.04, RIG_HEAD_SCALE = PLAYER_NECK_Y / 24, RIG_LEAN_SCALE = .75;
export type PlayerView = 'front' | 'frontLeft' | 'frontRight' | 'left' | 'right' | 'backLeft' | 'backRight' | 'back';
export const INK = '#15121e', CREAM = '#fff1d7';

// Five-column embroidery, redrawn for the larger jersey with one-pixel counters.
const DIGITS: Record<string, string[]> = {
  0: ['01110','11011','11011','11011','11011','11011','01110'],
  1: ['00110','01110','00110','00110','00110','00110','01111'],
  2: ['01110','11011','00011','00110','01100','11000','11111'],
  3: ['11110','00011','00011','01110','00011','00011','11110'],
  4: ['11011','11011','11011','11111','00011','00011','00011'],
  5: ['11111','11000','11000','11110','00011','00011','11110'],
  6: ['01110','11000','11000','11110','11011','11011','01110'],
  7: ['11111','00011','00011','00110','00110','01100','01100'],
  8: ['01110','11011','11011','01110','11011','11011','01110'],
  9: ['01110','11011','11011','01111','00011','00011','01110'],
};
const color = (s: string, fallback: string) => /^#[\da-f]{6}$/i.test(s) ? s : /^#[\da-f]{3}$/i.test(s) ? '#' + [...s.slice(1)].map(c => c+c).join('') : fallback;

export function buildPixelPlayer64(opts: SpriteOptions): SpriteGrid {
  const t = playerTraits(opts.playerId, opts.appearance);
  const grid: SpriteGrid = Array.from({length:PLAYER_PIXELS},()=>Array(PLAYER_PIXELS).fill(null));
  const rect = (x:number,y:number,w:number,h:number,c:string) => {
    for(let yy=Math.max(0,y);yy<Math.min(PLAYER_PIXELS,y+h);yy++)
      for(let xx=Math.max(0,x);xx<Math.min(PLAYER_PIXELS,x+w);xx++)grid[yy][xx]=c;
  };
  const skin=t.skin, light=mix(skin,'#ffe9cb',.25), dark=mix(skin,'#542c30',.35), deep=mix(skin,'#351c29',.55);
  const hair=t.hair, hairLight=mix(hair,'#a8a0b4',.3), hairDark=mix(hair,INK,.4);
  const kit=color(opts.primary,'#1d428a'),trim=color(opts.secondary,'#ffc72c'),kitLight=mix(kit,CREAM,.2),kitDark=mix(kit,INK,.35);
  const view=opts.view??'front',back=view.startsWith('back'),profile=view==='left'||view==='right';
  const side=view.toLowerCase().endsWith('left')?-1:view.toLowerCase().endsWith('right')?1:0,angle=side!==0;
  const number=(x:number,y:number) => {
    if(opts.jerseyNumber==null||!Number.isFinite(opts.jerseyNumber))return;
    const s=String(Math.max(0,Math.min(99,Math.round(opts.jerseyNumber))));
    for(let i=0;i<s.length;i++)DIGITS[s[i]].forEach((row,dy)=>[...row].forEach((b,dx)=>{
      if(b==='1')rect(x+(s.length===1?3:0)+i*6+dx,y+dy,1,1,trim);
    }));
  };

  // Separate ankle, ribbed sock, shoe upper, laces, heel tab and single-pixel sole.
  if(opts.legs!==false)for(const [x,right] of [[24,false],[36,true]] as const){
    rect(x,53,5,7,skin);rect(x+4,54,1,5,dark);rect(x,54,1,3,light);
    rect(x-1,57,6,3,CREAM);rect(x-1,57,6,1,mix(CREAM,kit,.18));
    rect(x+1,58,1,2,'#d6d3d1');rect(x+3,58,1,2,'#d6d3d1');
    rect(x-2,60,9,2,kit);rect(x-1,59,6,2,kitLight);
    rect(x+(right?5:-3),61,3,1,kitDark);rect(x-2,62,10,1,CREAM);
    rect(x,59,3,1,CREAM);rect(x+1,60,3,1,CREAM);rect(x+5,60,1,1,trim);
  }
  if(opts.pose!=='none'){
    if(opts.pose==='raise')for(const x of [12,47]){
      rect(x,14,5,26,skin);rect(x,15,1,23,light);rect(x+4,17,1,20,dark);
      rect(x-1,9,6,6,skin);rect(x,8,3,1,skin);rect(x,9,3,1,light);rect(x+4,11,1,3,dark);
    }else{
      rect(18,38,6,8,skin);rect(17,44,5,7,skin);rect(17,49,5,3,dark);
      rect(17,47,5,4,skin);rect(17,47,3,1,light);rect(18,51,1,1,deep);
      rect(41,38,6,8,skin);rect(43,44,5,7,skin);rect(44,49,4,3,dark);
      rect(43,47,4,4,skin);rect(43,47,2,1,light);rect(46,51,1,1,deep);
      rect(18,39,1,5,light);rect(46,39,1,5,dark);
      if(t.sleeve){rect(18,38,6,8,CREAM);rect(17,44,5,4,CREAM);rect(22,39,1,6,'#b9bdc9');rect(18,43,3,1,'#dedee8');}
      if(t.seed%4<2){rect(43,47,5,2,trim);rect(44,47,3,1,kitLight);}
    }
  }
  const left=profile?25:22,width=profile?16:20;
  rect(left,37,width,14,kit);rect(left,38,2,12,kitLight);rect(left+width-3,38,3,12,kitDark);
  rect(left,37,4,3,trim);rect(left+width-4,37,4,3,trim);
  rect(left+1,37,3,1,CREAM);rect(left+width-4,37,3,1,kitLight);
  rect(28,35,9,3,dark);rect(29,35,5,2,skin);rect(28,38,9,1,trim);rect(30,39,5,1,trim);
  rect(left,49,width,1,kitDark);rect(left,50,width,1,trim);
  rect(22,51,9,5,kit);rect(34,51,9,5,kit);
  rect(22,55,9,1,trim);rect(34,55,9,1,trim);
  rect(23,51,2,3,kitLight);rect(40,51,3,3,kitDark);
  rect(30,52,1,3,kitDark);rect(34,52,1,3,kitLight);
  rect(28,51,9,1,kitDark);rect(31,51,2,1,CREAM);
  if(opts.jerseyStyle==='stripe')rect(left+2,41,width-4,3,mix(kit,trim,.35));
  if(opts.jerseyStyle==='split')rect(34,40,4,9,trim);
  if(!profile)number(angle?28:26,41);
  else {rect(38,41,1,6,trim);rect(39,42,1,4,trim);}
  if(back)rect(28,37,9,1,trim);

  // The same broad head and compact body, with redrawn cheek/jaw steps.
  rect(profile?21:19,9,profile?24:26,23,skin);
  rect(profile?18:16,15,profile?29:32,14,skin);
  rect(profile?21:18,29,profile?24:28,4,skin);
  rect(21,33,22,2,skin);rect(25,35,15,1,dark);
  rect(profile?21:17,15,2,12,light);rect(profile?41:44,16,4,14,dark);
  rect(20,12,18,2,light);rect(20,14,4,1,light);
  rect(21,30,5,1,light);rect(22,31,3,1,light);rect(42,30,2,2,deep);
  if(!profile){
    rect(13,21,4,7,dark);rect(13,21,3,5,skin);rect(14,22,1,3,light);rect(15,24,1,2,dark);
    rect(48,21,4,7,deep);rect(48,21,3,5,skin);rect(49,23,1,2,dark);
  }else{
    rect(47,24,3,3,skin);rect(49,25,1,1,light);rect(47,27,2,1,dark);
  }

  if(!back){
    const eyes=profile?[39]:angle?[26,41]:[22,38],eyeY=21,eyeH=t.eyeStyle==='relaxed'?4:6;
    for(const x of eyes){
      rect(x-1,eyeY-4,6,1,hairDark);rect(x,eyeY-3,5,1,hairDark);
      if(t.eyeStyle==='focused')rect(x+(x<32?3:-1),eyeY-2,3,1,hairDark);
      rect(x-1,eyeY-1,6,eyeH,deep);
      rect(x,eyeY,4,eyeH-2,CREAM);rect(x+2,eyeY,3,eyeH-2,t.eyeColor);
      rect(x+3,eyeY,2,eyeH-2,INK);rect(x+3,eyeY,1,1,CREAM);
      rect(x+2,eyeY+eyeH-3,1,1,t.eyeColor);
      if(t.eyeStyle==='wide')rect(x,eyeY+eyeH-2,3,1,CREAM);
      rect(x,eyeY+eyeH-1,4,1,dark);
    }
    const nose=profile?45:angle?38:32,mouth=profile?41:angle?34:29;
    rect(nose,25,3,3,dark);rect(nose-1,25,1,3,light);rect(nose+1,28,2,1,deep);
    const beard=t.beardStyle,full=!/none|stubble|soulPatch|goatee|vandyke|mustache|anchor|balboa|circleBeard/.test(beard);
    if(beard.startsWith('stubble')){
      const stubble=mix(skin,hair,.5);
      rect(profile?23:19,28,3,4,stubble);rect(43,28,3,4,stubble);
      rect(22,32,20,1,stubble);rect(24,33,16,2,stubble);
      if(beard==='stubbleFull'){rect(22,31,4,1,stubble);rect(39,31,3,1,stubble);}
      rect(26,33,1,1,skin);rect(35,34,1,1,skin); // individual gaps in the stubble cluster
    }else if(full){
      rect(profile?22:18,27,4,7,hair);rect(42,27,4,7,hairDark);
      rect(22,31,4,4,hair);rect(38,31,4,4,hair);
      rect(23,33,18,2,hair);rect(25,35,14,/Long|lumberjack/.test(beard)?3:1,hairDark);
      rect(22,31,2,2,hairLight);rect(25,34,4,1,hairLight);rect(37,34,2,1,hairDark);
    }
    if(beard!=='none'&&!/stubbleLight|soulPatch|chinstrap|thinLine|mutton/.test(beard)){
      rect(mouth-1,29,8,1,hairDark);rect(mouth-2,30,2,1,hairDark);rect(mouth+6,30,2,1,hairDark);
    }
    if(/goatee|vandyke|anchor|balboa|circleBeard|soulPatch/.test(beard))rect(mouth,33,beard==='goateeWide'?7:4,beard==='soulPatch'?1:4,hair);
    rect(mouth,31,6,1,deep);
    if(t.expression==='smile'||t.expression==='grin'){rect(mouth+1,31,4,1,CREAM);rect(mouth+1,32,3,1,deep);}
    if(t.expression==='determined')rect(mouth+1,32,4,1,dark);
  }else{
    rect(19,16,26,16,skin);rect(42,17,3,14,dark);rect(24,32,17,3,dark);
  }

  const h=(x:number,y:number,w:number,hh:number)=>rect(x,y,w,hh,hair),hs=t.hairStyle;
  if(hs!=='bald'){
    const close=hs==='buzzCut'||hs==='lowFade'||hs==='waves';
    const big=/afro|curlyMedium|mediumWide|dreadsPiled/.test(hs),top=big?3:close?7:5;
    h(22,top,20,2);h(19,top+2,26,3);h(17,top+5,30,close?3:6);
    h(16,top+7,32,close?2:4);h(16,15,4,6);h(44,15,4,6);
    if(back){h(18,15,angle?26:29,13);h(21,27,angle?20:23,3);rect(24,29,15,1,hairDark);}
    if(profile){h(18,15,9,14);}
    if(hs==='lowFade'){rect(19,13,26,3,skin);rect(20,13,24,1,mix(skin,hair,.5));}
    if(close){rect(21,top+2,11,1,hairLight);rect(18,14,2,4,mix(skin,hair,.5));rect(44,14,2,4,mix(skin,hair,.5));}
    if(/crop|short/.test(hs)){h(20,15,4,3);h(28,15,5,1);h(39,14,4,2);rect(25,15,1,1,hairLight);}
    if(/curly|afro|twists/.test(hs))for(const [x,y]of [[17,7],[22,4],[29,3],[36,4],[43,7]]){
      const yy=big?y:y+3;h(x,yy,4,4);h(x+1,yy-1,2,1);rect(x,yy+1,2,1,hairLight);rect(x+3,yy+3,1,1,hairDark);
    }
    if(/Flat|flat|highTop/.test(hs)){h(19,3,26,10);rect(21,3,22,1,hairLight);}
    if(/mohawk/.test(hs)){rect(19,9,26,6,skin);h(29,3,hs==='mohawkThin'?4:9,14);h(16,15,3,5);h(45,15,3,5);rect(30,4,1,9,hairLight);}
    if(/cornrows|boxBraids/.test(hs))for(let x=19;x<46;x+=6){rect(x,9,3,10,hairDark);rect(x,9,1,6,hairLight);rect(x+1,15,1,2,hairLight);}
    if(/dreads|boxBraids|twists/.test(hs))for(let x=15;x<=47;x+=6){
      const length=/Long|boxBraids/.test(hs)?28:/Medium/.test(hs)?21:14;
      h(x,9+(x%3),4,(x<22||x>41)?length:7);rect(x,12,1,5,hairLight);rect(x+2,11,1,2,hairDark);
    }
    if(hs==='sidePart'||hs==='slickBack'||hs==='undercut'){
      for(let x=21;x<43;x+=6){rect(x,8,3,1,hairLight);rect(x+3,9,1,1,hairLight);}
      if(hs==='sidePart')rect(39,9,1,6,dark);
      if(hs==='undercut')rect(16,16,4,4,mix(skin,hair,.5));
    }
    if(hs==='waves')for(let x=20;x<44;x+=6){rect(x,11,3,1,hairLight);rect(x+3,12,2,1,hairLight);}
    if(!close){rect(22,top+2,7,1,hairLight);rect(18,top+6,2,2,hairLight);rect(31,top+3,5,1,hairLight);rect(40,top+5,3,1,hairLight);rect(29,top+2,1,1,hairLight);}
    if(hs==='short'||hs==='shortWide'){rect(21,top+1,3,1,hairLight);rect(29,top+1,3,1,hairDark);rect(43,top+4,2,2,hairDark);}
    rect(46,top+8,2,close?4:7,hairDark);
  }
  if(profile){rect(24,21,4,6,skin);rect(25,22,1,3,light);rect(27,23,1,3,dark);}
  const hat=t.hatStyle,hc=t.hatColor,hl=mix(hc,CREAM,.35),hd=mix(hc,INK,.35);
  if(hat==='headband'||hat==='headbandWide'||hat==='visor'){
    rect(16,15,32,hat==='headbandWide'?5:3,hc);rect(18,15,28,1,hl);rect(46,16,2,2,hd);
    if(hat==='visor'){rect(38,18,14,3,hd);rect(39,18,11,1,hc);}
  }else if(hat){
    rect(19,6,26,7,hc);rect(16,10,32,6,hc);rect(18,15,28,3,hd);rect(21,8,7,1,hl);rect(19,10,1,3,hl);
    if(hat==='beanieCuffed'){rect(15,14,34,4,hl);for(const x of [18,24,30,36,42])rect(x,15,1,3,hc);}
    if(hat==='cap'||hat==='bucket'){rect(hat==='bucket'?13:34,18,hat==='bucket'?38:18,3,hc);rect(35,20,15,1,hd);}
    if(hat==='capBack'){rect(12,18,14,3,hd);rect(29,15,6,3,skin);rect(31,15,3,1,hl);}
    if(hat==='durag'){rect(46,18,5,5,hd);rect(50,22,3,7,hc);}
  }
  if(t.goggles&&!back){
    for(const x of profile?[38]:angle?[25,39]:[20,37]){
      rect(x-1,19,9,9,INK);rect(x,20,7,6,'#75aabd');rect(x,20,4,1,CREAM);rect(x,21,1,2,CREAM);rect(x+6,25,1,1,'#467387');
    }
    rect(profile?29:28,22,profile?10:9,2,INK);
  }
  if(opts.age!=null&&opts.age>=36&&hs!=='bald')for(const x of [16,46])for(let y=16;y<20;y++)if([hair,hairDark].includes(grid[y][x]??''))rect(x,y,1,1,opts.age>=43?'#c6bec4':'#a79caa');
  // Left views reflect the face only; jersey numbers keep their reading direction.
  if(side<0)for(let y=0;y<PLAYER_NECK_Y;y++)grid[y]=grid[y].slice().reverse();
  return grid;
}
