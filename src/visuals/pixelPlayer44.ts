import { mix, playerTraits, type SpriteGrid, type SpriteOptions } from './playerSprite';

/** Native artwork: one cell is one pixel. Every feature is placed on this grid;
 * no curves, subpixel detail, image filters, or downsampled illustrations. */
export const PLAYER_PIXELS = 44;
export type PlayerView = 'front' | 'frontLeft' | 'frontRight' | 'left' | 'right' | 'backLeft' | 'backRight' | 'back';
export const INK = '#15121e', CREAM = '#fff1d7';
const DIGITS: Record<string, string[]> = {
  0: ['111','101','101','101','111'], 1: ['010','110','010','010','111'],
  2: ['111','001','111','100','111'], 3: ['111','001','111','001','111'],
  4: ['101','101','111','001','001'], 5: ['111','100','111','001','111'],
  6: ['111','100','111','101','111'], 7: ['111','001','010','010','010'],
  8: ['111','101','111','101','111'], 9: ['111','101','111','001','111'],
};
const color = (s: string, fallback: string) => /^#[\da-f]{6}$/i.test(s) ? s : /^#[\da-f]{3}$/i.test(s) ? '#' + [...s.slice(1)].map(c => c+c).join('') : fallback;

export function buildPixelPlayer44(opts: SpriteOptions): SpriteGrid {
  const t = playerTraits(opts.playerId, opts.appearance);
  const grid: SpriteGrid = Array.from({length:44},()=>Array(44).fill(null));
  const rect = (x:number,y:number,w:number,h:number,c:string) => {
    for(let yy=Math.max(0,Math.round(y));yy<Math.min(44,Math.round(y+h));yy++)
      for(let xx=Math.max(0,Math.round(x));xx<Math.min(44,Math.round(x+w));xx++)grid[yy][xx]=c;
  };
  const skin=t.skin, light=mix(skin,'#ffe9cb',.25), dark=mix(skin,'#542c30',.35), deep=mix(skin,'#351c29',.55);
  const hair=t.hair, hairLight=mix(hair,'#a8a0b4',.3), hairDark=mix(hair,INK,.4);
  const kit=color(opts.primary,'#1d428a'),trim=color(opts.secondary,'#ffc72c'),kitLight=mix(kit,CREAM,.2),kitDark=mix(kit,INK,.35);
  const view=opts.view??'front', back=view.startsWith('back'), profile=view==='left'||view==='right';
  const side=view.toLowerCase().endsWith('left')?-1:view.toLowerCase().endsWith('right')?1:0;
  // Canonical side/angled view faces right. Mirror the head at the end, never the jersey digits.
  const angle=side!==0;
  const number=(x:number,y:number) => {
    if(opts.jerseyNumber==null||!Number.isFinite(opts.jerseyNumber))return;
    const s=String(Math.max(0,Math.min(99,Math.round(opts.jerseyNumber))));
    for(let i=0;i<s.length;i++)DIGITS[s[i]].forEach((row,dy)=>[...row].forEach((b,dx)=>{
      if(b==='1')rect(x+(s.length===1?2:0)+i*4+dx,y+dy,1,1,trim);
    }));
  };
  // Shoes have distinct toe, heel, sole and tongue clusters.
  if(opts.legs!==false)for(const [x,right] of [[16,false],[24,true]] as const){
    rect(x,36,4,5,skin);rect(x+3,37,1,3,dark);
    rect(x,39,4,2,CREAM);rect(x,39,4,1,mix(CREAM,kit,.18));
    rect(x-1,41,6,2,kit);rect(x-1,40,4,2,kitLight);
    rect(x+(right?3:-2),41,2,2,kit);rect(x-1,42,6,1,CREAM);
    rect(x,40,2,1,CREAM);rect(x+3,41,1,1,trim);
  }
  if(opts.pose!=='none'){
    if(opts.pose==='raise')for(const x of [8,32]){
      rect(x,9,3,19,skin);rect(x,10,1,17,light);rect(x+2,11,1,16,dark);
      rect(x-1,6,4,4,skin);rect(x,6,2,1,light);
    }else{
      rect(12,26,4,6,skin);rect(11,30,4,5,skin);rect(11,33,3,3,dark);rect(11,32,3,2,light);
      rect(28,26,4,6,skin);rect(29,30,4,5,skin);rect(30,33,3,3,dark);rect(29,32,2,2,light);
      if(t.sleeve){rect(12,26,4,6,CREAM);rect(11,30,4,3,CREAM);rect(14,27,1,5,'#b9bdc9');}
      if(t.seed%4<2)rect(29,32,4,1,trim);
    }
  }
  // Compact basketball body; a narrow waist separates jersey and shorts.
  const left=profile?17:15,width=profile?11:14;
  rect(left,25,width,10,kit);rect(left,26,2,8,kitLight);rect(left+width-2,26,2,8,kitDark);
  rect(left,25,3,2,trim);rect(left+width-3,25,3,2,trim);
  rect(19,24,6,2,dark);rect(20,24,3,1,skin);rect(19,26,6,1,trim);
  rect(left,33,width,1,kitDark);rect(left,34,width,1,trim);
  rect(15,35,6,3,kit);rect(23,35,6,3,kit);rect(15,37,6,1,trim);rect(23,37,6,1,trim);
  rect(16,35,2,2,kitLight);rect(27,35,2,2,kitDark);
  if(opts.jerseyStyle==='stripe')rect(left+1,28,width-2,2,mix(kit,trim,.35));
  if(opts.jerseyStyle==='split')rect(23,27,3,6,trim);
  if(!profile)number(angle?19:18,28);
  else {rect(26,28,1,4,trim);rect(27,29,1,2,trim);}
  if(back)rect(19,25,6,1,trim);

  // Head silhouette, deliberately wider than the jersey.
  rect(profile?14:13,6,profile?17:18,17,skin);
  rect(profile?12:11,10,profile?20:22,10,skin);
  rect(profile?14:13,20,profile?17:18,3,skin);
  rect(16,23,13,1,dark);
  rect(profile?14:12,10,2,9,light);rect(profile?28:30,11,3,10,dark);
  rect(14,8,12,2,light);rect(15,21,4,1,light);
  if(!profile){
    rect(9,14,3,5,dark);rect(9,14,2,3,skin);rect(10,15,1,2,light);
    rect(33,14,3,5,deep);rect(33,14,2,3,skin);
  }
  if(profile){rect(32,16,2,2,skin);rect(33,17,1,1,light);}

  if(!back){
    const eyes=profile?[27]:angle?[18,28]:[15,26];
    const eyeY=14, eyeH=t.eyeStyle==='relaxed'?3:4;
    for(const x of eyes){
      rect(x-1,eyeY-2,4,1,hairDark);
      if(t.eyeStyle==='focused')rect(x+(x<22?2:-1),eyeY-1,2,1,hairDark);
      rect(x-1,eyeY,4,eyeH,deep);
      rect(x-1,eyeY+1,1,eyeH-2,CREAM);
      rect(x,eyeY,3,eyeH-1,t.eyeColor);
      rect(x+1,eyeY,2,eyeH-1,INK);
      rect(x+1,eyeY,1,1,CREAM);
      if(t.eyeStyle==='wide')rect(x,eyeY+eyeH-1,2,1,CREAM);
      rect(x,eyeY+eyeH,3,1,dark);
    }
    const nose=profile?31:angle?26:22;
    rect(nose,17,2,2,dark);rect(nose-1,17,1,2,light);
    const mouth=profile?28:angle?23:20;
    if(t.beardStyle==='none'){
      rect(mouth,21,4,1,deep);
      if(t.expression==='smile'||t.expression==='grin')rect(mouth+1,21,2,1,CREAM);
      if(t.expression==='grin')rect(mouth+1,22,2,1,deep);
    }else{
      const b=t.beardStyle, full=!/stubble|soulPatch|goatee|vandyke|mustache|anchor|balboa|circleBeard/.test(b);
      if(b.startsWith('stubble')){
        const stubble=mix(skin,hair,.5);
        rect(profile?16:13,19,2,3,stubble);rect(29,19,2,3,stubble);
        rect(15,22,14,1,stubble);rect(17,23,10,1,stubble);
        if(b==='stubbleFull'){rect(15,21,3,1,stubble);rect(26,21,3,1,stubble);}
      }else if(full){
        rect(profile?15:12,18,3,5,hair);rect(29,18,3,5,hairDark);
        rect(15,21,3,3,hair);rect(26,21,3,3,hair);
        rect(15,22,14,2,hair);rect(17,24,10,/Long|lumberjack/.test(b)?2:1,hairDark);
        rect(15,21,2,2,hairLight);
      }
      if(!/stubbleLight|soulPatch|chinstrap|thinLine|mutton/.test(b))rect(mouth-1,20,6,1,hairDark);
      if(/goatee|vandyke|anchor|balboa|circleBeard|soulPatch/.test(b))rect(mouth,22,b==='goateeWide'?5:3,b==='soulPatch'?1:3,hair);
      rect(mouth,21,4,1,deep);if(t.expression!=='determined')rect(mouth+1,21,2,1,CREAM);
    }
  }else{
    // Nape below the hair. No face, beard, or front-facing ear highlights on the back.
    rect(13,11,18,11,skin);rect(29,12,2,9,dark);rect(16,22,13,2,dark);
  }

  // Each hairstyle has a deliberately stepped silhouette and clustered highlights.
  const h=(x:number,y:number,w:number,hh:number)=>rect(x,y,w,hh,hair);
  const hs=t.hairStyle;
  if(hs!=='bald'){
    const close=hs==='buzzCut'||hs==='lowFade'||hs==='waves';
    const big=/afro|curlyMedium|mediumWide|dreadsPiled/.test(hs);
    const top=big?2:close?5:4;
    h(15,top,14,1);h(13,top+1,18,2);h(12,top+3,20,close?2:4);
    h(11,top+4,22,close?1:3);h(11,10,3,4);h(30,10,3,4);
    if(back){h(12,10,angle?18:20,9);h(14,18,angle?14:16,2);}
    if(profile){h(12,10,6,10);rect(16,14,3,4,skin);rect(17,15,1,2,dark);}
    if(hs==='lowFade'){rect(13,9,18,2,skin);rect(14,9,16,1,mix(skin,hair,.5));}
    if(close){rect(14,top+1,8,1,hairLight);rect(12,9,2,3,mix(skin,hair,.5));rect(30,9,2,3,mix(skin,hair,.5));}
    if(/crop|short/.test(hs)){h(14,10,3,2);h(19,10,4,1);h(27,9,3,2);}
    if(/curly|afro|twists/.test(hs))for(const [x,y]of [[12,5],[15,3],[20,2],[25,3],[30,5]]){
      h(x,big?y:y+2,3,3);rect(x,big?y+1:y+3,2,1,hairLight);
    }
    if(/Flat|flat|highTop/.test(hs)){h(13,2,18,7);rect(14,2,16,1,hairLight);}
    if(/mohawk/.test(hs)){rect(13,6,18,4,skin);h(20,2,hs==='mohawkThin'?3:6,10);h(11,10,2,3);h(31,10,2,3);}
    if(/cornrows|boxBraids/.test(hs))for(let x=13;x<32;x+=4){rect(x,6,2,7,hairDark);rect(x,6,1,4,hairLight);}
    if(/dreads|boxBraids|twists/.test(hs))for(let x=10;x<=32;x+=4){
      const length=/Long|boxBraids/.test(hs)?20:/Medium/.test(hs)?15:10;
      h(x,6+(x%3),3,(x<15||x>28)?length:5);rect(x,8,1,3,hairLight);
    }
    if(hs==='sidePart'||hs==='slickBack'||hs==='undercut'){
      for(let x=14;x<29;x+=4)rect(x,5,2,1,hairLight);
      if(hs==='sidePart')rect(27,6,1,4,dark);
      if(hs==='undercut')rect(11,11,3,3,mix(skin,hair,.5));
    }
    if(hs==='waves')for(let x=14;x<30;x+=4)rect(x,8,2,1,hairLight);
    // Clustered highlights rather than noise scattered across the silhouette.
    if(!close){rect(15,top+1,5,1,hairLight);rect(12,top+4,2,2,hairLight);rect(21,top+2,3,1,hairLight);rect(27,top+3,2,1,hairLight);}
    if(hs==='short'||hs==='shortWide'){rect(14,top,2,1,hairLight);rect(20,top,2,1,hairDark);rect(29,top+2,2,2,hairDark);}
    rect(31,top+5,2,close?3:5,hairDark);
  }
  const hat=t.hatStyle,hc=t.hatColor,hl=mix(hc,CREAM,.35),hd=mix(hc,INK,.35);
  if(hat==='headband'||hat==='headbandWide'||hat==='visor'){
    rect(11,10,22,hat==='headbandWide'?3:2,hc);rect(12,10,20,1,hl);
    if(hat==='visor')rect(26,12,10,2,hd);
  }else if(hat){
    rect(13,4,18,5,hc);rect(11,7,22,4,hc);rect(12,10,20,2,hd);rect(14,5,5,1,hl);
    if(hat==='beanieCuffed')rect(10,9,24,3,hl);
    if(hat==='cap'||hat==='bucket')rect(hat==='bucket'?9:23,12,hat==='bucket'?26:13,2,hc);
    if(hat==='capBack'){rect(8,12,10,2,hd);rect(20,10,4,2,skin);}
    if(hat==='durag'){rect(32,12,3,4,hd);rect(34,15,2,5,hc);}
  }
  if(t.goggles&&!back){
    for(const x of profile?[26]:angle?[17,27]:[14,25]){
      rect(x-1,13,6,6,INK);rect(x,14,4,3,'#75aabd');rect(x,14,2,1,CREAM);
    }
    rect(profile?20:19,15,profile?7:6,1,INK);
  }
  if(opts.age!=null&&opts.age>=36&&hs!=='bald')for(const x of [11,31])for(let y=11;y<14;y++)if([hair,hairDark].includes(grid[y][x]??''))rect(x,y,1,1,opts.age>=43?'#c6bec4':'#a79caa');
  // Reflect only head rows for left-facing views; both jersey numbers stay readable.
  if(side<0)for(let y=0;y<24;y++)grid[y]=grid[y].slice().reverse();
  // Profiles use a slimmer jersey without changing the arm rig or gear locations.
  return grid;
}
