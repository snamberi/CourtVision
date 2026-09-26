import { memo, useId } from 'react';
import type { PlayerSeason } from '../simulation/types';
import type { CourtActor, CourtBall, CourtFrame, CourtShot } from '../simulation/courtMotion';
import { resolveTeamIdentity, type TeamIdentity } from '../simulation/teamIdentity';
import { useTeamIdentity } from '../visuals/TeamIdentityContext';
import { playerTraits } from '../visuals/playerSprite';
import { PlayerAvatar } from './PlayerAvatar';
import { TeamLogo } from './TeamLogo';

type Team={teamId:string;name:string};
export interface CourtBug { homeScore:number; awayScore:number; clock:string; shotClock?:number }

/* Court geometry (1000×650 viewBox). Playing surface 62–938 × 85–535, rims at x=100/900, y=310.
   Scale ≈ 9.3 px/ft horizontally, 9 px/ft vertically, so lines follow regulation proportions. */
const LANE={depth:177,top:238,bottom:382},ARC={r:221,ry:213,cornerY:[112,508],cornerX:190},FT_R=54;
const CROWD_SKIN=['#f1c49a','#d6aa7b','#a8734f','#7a5038','#c8906a'];
const CROWD_SHIRT=['#6c8093','#c4b490','#354c6a','#8b3a3a','#3f6b4f','#d8d0bc'];

function CourtLines(){
 const half=(side:1|-1)=>{
  const base=side>0?62:938,x=(v:number)=>base+side*v;
  return <g key={side}>
   <path d={`M${base} ${LANE.top}H${x(LANE.depth)}V${LANE.bottom}H${base}`}/>
   <path d={`M${x(LANE.depth)} ${310-FT_R}A${FT_R} ${FT_R} 0 0 ${side>0?1:0} ${x(LANE.depth)} ${310+FT_R}`}/>
   <path d={`M${x(LANE.depth)} ${310-FT_R}A${FT_R} ${FT_R} 0 0 ${side>0?0:1} ${x(LANE.depth)} ${310+FT_R}`} strokeDasharray="7 7" opacity=".6"/>
   <path d={`M${base} ${ARC.cornerY[0]}H${x(ARC.cornerX-62)}A${ARC.r} ${ARC.ry} 0 0 ${side>0?1:0} ${x(ARC.cornerX-62)} ${ARC.cornerY[1]}H${base}`}/>
   <path d={`M${side>0?100:900} ${310-37}A37 37 0 0 ${side>0?1:0} ${side>0?100:900} ${310+37}`}/>
   <path d={`M${side>0?100:900} ${310-37}H${side>0?86:914}M${side>0?100:900} ${310+37}H${side>0?86:914}`}/>
   {/* Lane blocks and hash marks */}
   {[95,125,155].map(v=><path key={v} d={`M${x(v)} ${LANE.top}V${LANE.top-8}M${x(v)} ${LANE.bottom}V${LANE.bottom+8}`}/>)}
   <rect x={side>0?x(64):x(74)} y={LANE.top-8} width="10" height="8" fill="#fff0d0" stroke="none"/>
   <rect x={side>0?x(64):x(74)} y={LANE.bottom} width="10" height="8" fill="#fff0d0" stroke="none"/>
   {/* Coaching-box / 28 ft marks */}
   <path d={`M${x(261)} 85V100M${x(261)} 520V535`}/>
  </g>;
 };
 return <g fill="none" stroke="#fff0d0" strokeWidth="2.5" strokeLinejoin="miter">
  <rect x="62" y="85" width="876" height="450"/><path d="M500 85V535"/>
  <circle cx="500" cy="310" r="56"/><circle cx="500" cy="310" r="19" opacity=".7"/>
  {half(1)}{half(-1)}
 </g>;
}

const Arena=memo(function Arena({home,identity,id,hype}:{home:Team;identity:TeamIdentity;id:string;hype:number}){
 const rows=[0,1,2,3];
 return <>
  <defs>
   <pattern id={`${id}-wood`} width="104" height="24" patternUnits="userSpaceOnUse"><rect width="104" height="24" fill="#d4a46c"/><rect width="52" height="12" fill="#dbb47f"/><rect x="52" y="12" width="52" height="12" fill="#ca9a60"/><rect x="26" y="0" width="26" height="12" fill="#d7ac74"/><rect x="0" y="12" width="20" height="12" fill="#cfa168"/><path d="M0 0H104M0 12H104M52 0V12M0 12V24M78 12V24" stroke="#9d713f" strokeOpacity=".35"/><path d="M9 6H44M63 18H92M60 4H70" stroke="#f3cc91" strokeOpacity=".35"/></pattern>
   <radialGradient id={`${id}-sheen`} cx="50%" cy="38%" r="62%"><stop offset="0" stopColor="#fff6dc" stopOpacity=".22"/><stop offset=".55" stopColor="#fff6dc" stopOpacity=".04"/><stop offset="1" stopColor="#1a0f05" stopOpacity=".28"/></radialGradient>
   <linearGradient id={`${id}-wall`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#050a13"/><stop offset="1" stopColor="#132338"/></linearGradient>
  </defs>
  <rect width="1000" height="650" fill={`url(#${id}-wall)`}/>
  {/* Stands: four stepped rows, nearer rows are larger; the crowd rises on big home moments. */}
  <g shapeRendering="crispEdges">
   {rows.map(row=>{const size=.72+row*.09,count=Math.floor(46-row*3),gap=1000/count;return <g key={row}>
    <rect x="0" y={row*12+2} width="1000" height="14" fill={row%2?'#0e1a2b':'#0b1624'}/>
    {Array.from({length:count},(_,i)=>{const n=(i*7+row*13)%11,stand=hype>0&&(i+row)%3!==0,lift=stand?hype*(3+((i+row)%2)*2):0;
     return <g key={i} transform={`translate(${i*gap+(row%2)*gap/2+4},${row*12+1-lift}) scale(${size})`}>
      <rect x="-1" y="5" width="13" height="11" fill="#070d18"/>
      <rect x="1" y="0" width="8" height="7" fill={CROWD_SKIN[n%CROWD_SKIN.length]}/>
      <rect x="-1" y="7" width="12" height="7" fill={n%3===0?identity.primary:n%5===0?identity.secondary:CROWD_SHIRT[n%CROWD_SHIRT.length]}/>
      {stand&&<><rect x="-3" y={-4} width="3" height="10" fill={CROWD_SKIN[n%CROWD_SKIN.length]}/><rect x="10" y={-4} width="3" height="10" fill={CROWD_SKIN[n%CROWD_SKIN.length]}/></>}
     </g>;})}
   </g>;})}
  </g>
  {/* LED ribbon board */}
  <g shapeRendering="crispEdges">
   <rect x="0" y="50" width="1000" height="10" fill="#060b14"/>
   <svg x="0" y="50" width="1000" height="10" viewBox="0 0 1000 10" overflow="hidden">
    <g className="cv-ribbon">{Array.from({length:6},(_,i)=><text key={i} x={i*400} y="8.2" fill={i%2?'#ffb45f':'#f4f0e6'} fontSize="8" fontFamily="monospace" letterSpacing="3">{`${home.name.toUpperCase()} · ${identity.abbreviation} · COURT VISION ·`}</text>)}</g>
   </svg>
  </g>
  <rect x="34" y="62" width="932" height="499" fill={identity.courtApron} stroke="#e2c999" strokeWidth="2"/>
  <rect x="62" y="85" width="876" height="450" fill={`url(#${id}-wood)`}/>
  <path d={`M62 ${LANE.top}H${62+LANE.depth}V${LANE.bottom}H62ZM938 ${LANE.top}H${938-LANE.depth}V${LANE.bottom}H938Z`} fill={identity.courtPaint} opacity=".92"/>
  <path d={`M62 ${LANE.top+10}H${52+LANE.depth}V${LANE.bottom-10}H62ZM938 ${LANE.top+10}H${948-LANE.depth}V${LANE.bottom-10}H938Z`} fill="#111827" opacity=".1"/>
  <circle cx="500" cy="310" r="56" fill={identity.courtPaint} opacity=".22"/>
  <CourtLines/>
  <g opacity=".87" data-testid="home-court-logo" transform="translate(448,258)"><TeamLogo team={{...home,identity}} size={104}/></g>
  <rect x="62" y="85" width="876" height="450" fill={`url(#${id}-sheen)`} pointerEvents="none"/>
  <g fill="#fff4d9" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
   <text x="500" y="78" fontSize="13" letterSpacing="5">{home.name.toUpperCase()}</text>
   <text x="500" y="553" fontSize="12" letterSpacing="6">{identity.abbreviation} · HOME COURT</text>
   <text transform="translate(51,310) rotate(-90)" fontSize="13" letterSpacing="4">{identity.abbreviation}</text>
   <text transform="translate(950,310) rotate(90)" fontSize="13" letterSpacing="4">{identity.abbreviation}</text>
  </g>
  {/* Benches and scorer's table */}
  <g shapeRendering="crispEdges">
   <rect x="376" y="566" width="248" height="26" fill="#263b50" stroke="#5e7183"/><rect x="390" y="571" width="220" height="15" fill="#0c1725"/>
   <text x="500" y="582" fill="#f8bc70" fontSize="10" fontFamily="monospace" letterSpacing="3" textAnchor="middle">COURT VISION · COURTSIDE</text>
   {[0,1].map(side=><g key={side}><rect x={side?652:108} y="572" width="240" height="6" fill="#1d2d40"/>{Array.from({length:8},(_,i)=><g key={i} transform={`translate(${side?666+i*27:120+i*27},568)`}><rect width="20" height="17" fill="#32465c"/><rect x="6" y="-5" width="8" height="8" fill={CROWD_SKIN[(i+side*3)%CROWD_SKIN.length]}/><rect x="4" y="4" width="12" height="11" fill={side?'#e9dfca':identity.primary}/></g>)}</g>)}
  </g>
 </>;
});
function Photographers({flash}:{flash:number}){
 return <g shapeRendering="crispEdges">{[[14,168],[14,420],[966,168],[966,420]].map(([x,y],i)=><g key={i} transform={`translate(${x},${y})`}>
  <rect x="2" y="0" width="12" height="11" fill="#1b2533"/><rect x="4" y="-8" width="8" height="8" fill={CROWD_SKIN[i%CROWD_SKIN.length]}/><rect x={i<2?12:-4} y="-2" width="8" height="6" fill="#0a0f18"/>
  {flash>0&&(i+Math.round(flash*3))%2===0&&<circle cx={i<2?20:-4} cy="1" r={6+flash*6} fill="#fffbe8" opacity={.75*flash}/>}
 </g>)}</g>;
}
function Hoop({x,net,rim}:{x:number;net:number;rim:number}){
 const left=x<500,dir=left?-1:1,shake=rim*Math.sin(rim*20)*2;
 return <g transform={`translate(${x},310)`}>
  {/* stanchion: padded base behind the baseline, arm reaching the backboard */}
  <rect x={dir*58-(left?0:14)} y="-12" width="14" height="30" fill="#1b2c42" stroke="#0a111c"/>
  <path d={`M${dir*52} 0V-50H${dir*18}`} fill="none" stroke="#162334" strokeWidth="8"/>
  <path d={`M${dir*52} 0V-50`} fill="none" stroke={'#2e4460'} strokeWidth="3"/>
  <g transform={`translate(0,${shake})`}>
   <path d="M-21 -52H21V-24H-21Z" fill="#e5f2ff" fillOpacity=".22" stroke="#f6ead1" strokeWidth="3"/>
   <path d="M-9 -42H9V-28H-9Z" fill="none" stroke="#f47b20" strokeWidth="2"/>
   <path d={`M-9 -31L${-6-net*3} ${-15+net*9}H${6+net*3}L9 -31M-5 -30L${2+net*2} ${-15+net*9}M5 -30L${-2-net*2} ${-15+net*9}M-7 -24H7`} fill="none" stroke="#fff3d2" strokeWidth="1.4"/>
   <ellipse cy="-33" rx="11" ry="4" fill="none" stroke="#fa743b" strokeWidth="3"/>
  </g>
 </g>;
}
const lastName=(id:string)=>{const parts=id.split(/[\s-]+/);return (parts[parts.length-1]||id).toUpperCase().slice(0,10);};
function Athlete({actor,player,identity,ring,hot,carrier,labels,above,id}:{actor:CourtActor;player?:PlayerSeason;identity:TeamIdentity;ring:string;hot:boolean;carrier:boolean;labels:boolean;above:boolean;id:string}){
 const skin=playerTraits(actor.id).skin,pose=actor.pose,stride=actor.stride*5;
 const scale=Math.max(.9,Math.min(1.1,(player?.attributes.physical.heightInches??79)/79));
 const crouch=pose==='guard'?3:pose==='screen'?1:0,clip=`${id}-body`;
 // Arms: [shoulder, elbow, hand] per side, as simple pixel segments.
 const arm=(side:number):string=>{
  const s=`${side*10} -26`;
  if(pose==='shoot'||pose==='reach')return `M${s}L${side*12} -38L${side*7} -48`;
  if(pose==='celebrate')return `M${s}L${side*16} -36L${side*20} -48`;
  if(pose==='guard')return `M${s}L${side*20} -24L${side*25} -30`;
  if(pose==='screen')return `M${s}L${side*6} -20L${side*2} -16`;
  if(pose==='dribble'&&side===actor.facing)return `M${s}L${side*15} -18L${side*16} -10`;
  return `M${s}L${side*17} ${-23+stride*side*.4}L${side*19} ${-19+stride*side*.5}`;
 };
 const legSpread=pose==='guard'?11:7;
 return <g className="court-player" data-player-id={actor.id} data-pose={pose} transform={`translate(${actor.x.toFixed(2)},${actor.y.toFixed(2)})`}>
  <ellipse rx={15-actor.jump*.06} ry="5" fill="#2f231c" opacity={.3-actor.jump*.004}/>
  <ellipse rx="14" ry="4.5" fill="none" stroke={ring} strokeWidth="2" opacity=".75"/>
  {carrier&&<ellipse rx="19" ry="7" fill="none" stroke="#fff3a5" strokeWidth="2" opacity=".9"/>}
  <g transform={`translate(0,${-actor.jump+crouch}) scale(${scale})`} shapeRendering="crispEdges">
   <defs><clipPath id={clip}><rect x="0" y="0" width="40" height="24"/><rect x="12" y="24" width="16" height="16"/></clipPath></defs>
   {[-1,1].map(side=><g key={side}>
    <path d={`M${side*7} -14L${side*legSpread+stride*side} -5V0`} stroke="#080d19" strokeWidth="8" fill="none"/>
    <path d={`M${side*7} -14L${side*legSpread+stride*side} -5`} stroke={skin} strokeWidth="5"/>
    <path d={`M${side*legSpread+stride*side-3} -1H${side*legSpread+stride*side+5}`} stroke="#f5e8cc" strokeWidth="4"/>
    <path d={arm(side)} fill="none" stroke="#080d19" strokeWidth="7"/>
    <path d={arm(side)} fill="none" stroke={skin} strokeWidth="4"/>
   </g>)}
   <g transform={`translate(-20,${-50+Math.abs(actor.stride)*1.5})`}><g clipPath={`url(#${clip})`}><PlayerAvatar playerId={actor.id} teamId={actor.teamId} size={40} jerseyNumber={player?.jerseyNumber} age={player?.age} primaryColor={identity.primary} secondaryColor={identity.secondary} jerseyStyle={identity.jerseyStyle}/></g></g>
   {hot&&<path d="M-11 -54L-5 -66L0 -58L5 -70L12 -54Z" fill="#ffb347"/>}
  </g>
  {labels&&<g transform="translate(0,19)" opacity={above?.8:1}>
   <text textAnchor="middle" fill="#fff7e4" stroke="#152031" strokeWidth="3" paintOrder="stroke" fontFamily="monospace" fontSize="9.5" fontWeight="bold">{player?.jerseyNumber!=null?`${player.jerseyNumber} `:''}{lastName(actor.id)}</text>
  </g>}
 </g>;
}
function Ball({ball}:{ball:CourtBall}){
 const size=1+Math.min(.45,ball.z*.006);
 return <g data-testid="court-ball" data-height={ball.z.toFixed(2)} transform={`translate(${ball.x.toFixed(2)},${(ball.y-ball.z).toFixed(2)}) scale(${size.toFixed(3)})`}>
  <g transform={`rotate(${ball.spin.toFixed(1)})`}><path d="M-4 -7H4L7 -4V4L4 7H-4L-7 4V-4Z" fill="#f99b3d" stroke="#65351c" strokeWidth="1.5"/><path d="M0 -7V7M-7 0H7M-4 -6Q2 0-4 6" fill="none" stroke="#7b4020" strokeWidth="1.2"/><path d="M-3 -5H1" stroke="#ffce7f" strokeWidth="2"/></g>
 </g>;
}
function ShotChart({shots,home,homeColor,awayColor}:{shots:CourtShot[];home:string;homeColor:string;awayColor:string}){
 return <g data-testid="court-shot-chart" opacity=".85" pointerEvents="none">{shots.map((s,i)=>{const c=s.teamId===home?homeColor:awayColor;return s.made
  ?<rect key={i} x={s.x-3.5} y={s.y-3.5} width="7" height="7" fill={c} stroke="#0b1018" strokeWidth="1.2" shapeRendering="crispEdges"/>
  :<path key={i} d={`M${s.x-3.5} ${s.y-3.5}L${s.x+3.5} ${s.y+3.5}M${s.x+3.5} ${s.y-3.5}L${s.x-3.5} ${s.y+3.5}`} stroke={c} strokeWidth="2" opacity=".75"/>;})}</g>;
}
function Burst({x,y,t,color}:{x:number;y:number;t:number;color:string}){
 if(t<=0||t>=1)return null;
 const r=10+t*34,o=1-t;
 return <g transform={`translate(${x},${y-33})`} opacity={o} shapeRendering="crispEdges">{Array.from({length:10},(_,i)=>{const a=i/10*Math.PI*2;return <rect key={i} x={Math.cos(a)*r-2} y={Math.sin(a)*r*.7-2} width="4" height="4" fill={i%2?color:'#fff3c4'}/>;})}</g>;
}
function Callout({text,x,y,t,tone}:{text:string;x:number;y:number;t:number;tone:'make'|'defense'|'neutral'}){
 if(t<=0||t>=1)return null;
 const pop=t<.15?.6+t/.15*.5:1.1-Math.min(.1,(t-.15)*.3),rise=t*18,fade=t>.75?1-(t-.75)/.25:1;
 const fill=tone==='make'?'#ffd166':tone==='defense'?'#7cc4ff':'#f4f0e6';
 const cx=Math.max(70,Math.min(930,x));
 return <g className="court-callout" transform={`translate(${cx},${y-rise}) scale(${pop.toFixed(3)})`} opacity={fade}>
  <text textAnchor="middle" fontFamily="'Press Start 2P', monospace" fontSize="17" fill={fill} stroke="#0b1018" strokeWidth="5" paintOrder="stroke">{text}</text>
 </g>;
}
function ScoreBug({bug,home,away,hi,ai,frame}:{bug:CourtBug;home:Team;away:Team;hi:TeamIdentity;ai:TeamIdentity;frame:CourtFrame}){
 const offHome=frame.offenseTeamId===home.teamId,offAway=frame.offenseTeamId===away.teamId;
 const side=(identity:TeamIdentity,score:number,x:number,has:boolean)=><g transform={`translate(${x},606)`} shapeRendering="crispEdges">
  <rect width="150" height="30" fill="#0b1018" stroke="#2a3546"/><rect width="8" height="30" fill={identity.primary}/>
  <text x="18" y="21" fill="#f4f0e6" fontFamily="'Press Start 2P', monospace" fontSize="12">{identity.abbreviation}</text>
  <text x="140" y="23" textAnchor="end" fill="#ffe7af" fontFamily="monospace" fontWeight="bold" fontSize="22">{score}</text>
  {has&&<path d="M76 10L84 15L76 20Z" fill="#f47b20"/>}
 </g>;
 return <g data-testid="court-score-bug">
  <rect x="0" y="600" width="1000" height="50" fill="#0d1726"/>
  <text x="45" y="626" fill="#d5e1eb" fontFamily="monospace" fontSize="11">{frame.attackRight?'ATTACK →':'← ATTACK'}</text>
  {side(hi,bug.homeScore,262,offHome)}
  <g transform="translate(418,606)" shapeRendering="crispEdges"><rect width="164" height="30" fill="#192333" stroke="#2a3546"/>
   <text x="62" y="20" textAnchor="middle" fill="#f6ab64" fontFamily="monospace" fontWeight="bold" fontSize="14">{bug.clock}</text>
   {bug.shotClock!=null&&<><rect x="124" y="4" width="34" height="22" fill="#0b1018"/><text x="141" y="20" textAnchor="middle" fill={bug.shotClock<=5?'#e85d5d':'#ffd166'} fontFamily="monospace" fontWeight="bold" fontSize="14">{bug.shotClock}</text></>}
  </g>
  {side(ai,bug.awayScore,588,offAway)}
  <text x="955" y="626" textAnchor="end" fill="#d5e1eb" fontFamily="monospace" fontSize="11">{frame.phase.toUpperCase()}</text>
 </g>;
}
export type CourtCamera='full'|'follow'|'broadcast';
function cameraBox(frame:CourtFrame,camera:CourtCamera):string{
 if(camera==='full')return '0 0 1000 600';
 const ball=frame.ball,cx=frame.players.reduce((s,a)=>s+a.x,0)/Math.max(1,frame.players.length),cy=frame.players.reduce((s,a)=>s+a.y,0)/Math.max(1,frame.players.length);
 if(camera==='broadcast'){const w=680,h=408,fx=ball.x*.45+cx*.55;return `${Math.max(0,Math.min(1000-w,fx-w/2)).toFixed(1)} ${Math.max(0,Math.min(600-h,(ball.y*.3+cy*.7)-h/2+10)).toFixed(1)} ${w} ${h}`;}
 const fx=ball.x*.7+cx*.3,fy=ball.y*.7+cy*.3;
 return `${Math.max(0,Math.min(440,fx-280)).toFixed(1)} ${Math.max(0,Math.min(264,fy-190)).toFixed(1)} 560 336`;
}
export function WatchCourt({frame,home,away,rosters,hotId,labels=true,trail=false,camera='full',ghosts=[],shots=[],bug}:{frame:CourtFrame;home:Team;away:Team;rosters:PlayerSeason[];hotId?:string;labels?:boolean;trail?:boolean;camera?:CourtCamera;ghosts?:CourtBall[];shots?:CourtShot[];bug?:CourtBug}){
 const homeIdentity=useTeamIdentity(home.teamId),awayIdentity=useTeamIdentity(away.teamId),id=useId().replace(/:/g,'');
 const hi=homeIdentity??resolveTeamIdentity(home),ai=awayIdentity??resolveTeamIdentity(away);
 const awayKit={...ai,primary:'#f2e8d2',secondary:ai.primary};
 const players=[...frame.players].sort((a,b)=>a.y-b.y),ball=frame.ball;
 const homeMoment=frame.callout?.tone==='make'&&frame.offenseTeamId===home.teamId?Math.sin(frame.callout.t*Math.PI):frame.callout?.tone==='defense'&&frame.offenseTeamId===away.teamId?Math.sin(frame.callout.t*Math.PI)*.7:0;
 const hype=Math.round(homeMoment*6)/6;
 const flash=frame.net>0?frame.net:0;
 const athlete=(a:CourtActor)=>{const homeSide=a.teamId===home.teamId;return <Athlete key={a.id} id={`${id}-${frame.players.indexOf(a)}`} actor={a} player={rosters.find(p=>p.playerId===a.id)} identity={homeSide?hi:awayKit} ring={homeSide?hi.primary:ai.primary} hot={a.id===hotId} carrier={a.id===frame.carrier} labels={labels&&(a.teamId===frame.offenseTeamId||!frame.offenseTeamId||a.id===frame.carrier)} above={a.teamId!==frame.offenseTeamId&&!!frame.offenseTeamId}/>;};
 return <div className="watch-arena"><svg className="watch-court" viewBox={cameraBox(frame,camera)} role="img" aria-label={`${home.name} home court. ${frame.phase}.`}>
  <Arena home={home} identity={hi} id={id} hype={hype}/>
  <Photographers flash={flash}/>
  {shots.length>0&&<ShotChart shots={shots} home={home.teamId} homeColor={hi.primary} awayColor={ai.primary==='#f2e8d2'?'#94a0b2':ai.primary}/>}
  {trail&&ghosts.map((g,i)=><ellipse key={i} cx={g.x} cy={g.y-g.z} rx={5-i*.8} ry={5-i*.8} fill="#ffcf8a" opacity={.4-i*.08}/>)}
  <ellipse cx={ball.x} cy={ball.y} rx={Math.max(3,7-ball.z*.025)} ry="2.5" fill="#3e2919" opacity={Math.max(.08,.3-ball.z*.002)}/>
  {players.filter(a=>a.y<310).map(athlete)}
  <Hoop x={100} net={frame.hoop.x===100?frame.net:0} rim={frame.hoop.x===100?frame.rim??0:0}/><Hoop x={900} net={frame.hoop.x===900?frame.net:0} rim={frame.hoop.x===900?frame.rim??0:0}/>
  {players.filter(a=>a.y>=310).map(athlete)}
  <Ball ball={ball}/>
  {frame.callout?.tone==='make'&&<Burst x={frame.hoop.x} y={frame.hoop.y} t={frame.callout.t} color={frame.offenseTeamId===home.teamId?hi.primary:ai.primary}/>}
  {frame.callout&&<Callout {...frame.callout}/>}
</svg>
  <svg className="watch-bug" viewBox="0 600 1000 50" aria-hidden="true">{bug?<ScoreBug bug={bug} home={home} away={away} hi={hi} ai={ai} frame={frame}/>:<g fill="#d5e1eb" fontFamily="monospace" fontSize="11"><rect x="0" y="600" width="1000" height="50" fill="#0d1726"/><text x="45" y="631">{frame.attackRight?'ATTACK →':'← ATTACK'}</text><text x="955" y="631" textAnchor="end">{frame.phase.toUpperCase()}</text></g>}</svg>
  <div className="watch-arena-caption"><span>{home.name} arena</span><span>{frame.phase}</span></div></div>;
}
