import { memo, useId, useMemo } from 'react';
import type { PlayerSeason } from '../simulation/types';
import type { CourtActor, CourtBall, CourtFrame, CourtShot } from '../simulation/courtMotion';
import { resolveTeamIdentity, type TeamIdentity } from '../simulation/teamIdentity';
import { useTeamIdentity } from '../visuals/TeamIdentityContext';
import { playerTraits } from '../visuals/playerSprite';
import { PlayerAvatar } from './PlayerAvatar';
import { CrestArt } from './TeamCrest';
import { DISCORD_URL } from './DiscordLink';
import { CLYDE_PATH } from '../visuals/discordGlyph';
import { pixelTextPath, pixelTextWidth } from '../visuals/pixelFont';

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

/* The scene is wider than the court: baseline aprons carry the team name and the side stands hold the crowd. */
export const SCENE={x:-110,w:1220};
const shade=(hex:string,amt:number)=>{const n=parseInt(hex.slice(1),16),c=[n>>16,(n>>8)&255,n&255].map(v=>Math.max(0,Math.min(255,Math.round(amt<0?v*(1+amt):v+(255-v)*amt))));return `#${c.map(v=>v.toString(16).padStart(2,'0')).join('')}`;};
const floorStyle=(teamId:string):'planks'|'parquet'=>/^(BOS|GEN0?4)$/.test(teamId)||[...teamId].reduce((h,c)=>h+c.charCodeAt(0),0)%6===0?'parquet':'planks';
/** Big pixel letters read along a baseline apron (rotated a quarter turn). */
function BaselineName({text,x,side,fill}:{text:string;x:number;side:1|-1;fill:string}){
 const w=pixelTextWidth(text),px=Math.max(3,Math.min(9,Math.floor(430/w))),d=pixelTextPath(text,px);
 return <g transform={`translate(${x},310) rotate(${side*-90}) translate(${(-w*px/2).toFixed(1)},${(-3.5*px).toFixed(1)})`} shapeRendering="crispEdges">
  <path d={d} fill="#0b1018" opacity=".35" transform={`translate(${px*.5},${px*.5})`}/><path d={d} fill={fill}/>
 </g>;
}
function Fan({x,y,n,primary,secondary,stand,scale=1}:{x:number;y:number;n:number;primary:string;secondary:string;stand:boolean;scale?:number}){
 const skin=CROWD_SKIN[n%CROWD_SKIN.length],hair=['#1b1410','#3b2a1c','#6b4a2b','#d8c08a','#101010'][n%5];
 return <g transform={`translate(${x},${y-(stand?4:0)}) scale(${scale})`}>
  <rect x="0" y="9" width="14" height="10" fill={n%3===0?primary:n%4===0?secondary:CROWD_SHIRT[n%CROWD_SHIRT.length]}/>
  <rect x="2" y="1" width="10" height="9" fill={skin}/><rect x="2" y="0" width="10" height={n%4===1?2:4} fill={hair}/>
  <rect x="4" y="5" width="2" height="2" fill="#1a1410"/><rect x="8" y="5" width="2" height="2" fill="#1a1410"/>
  {stand&&<><rect x="-3" y="-3" width="3" height="11" fill={skin}/><rect x="14" y="-3" width="3" height="11" fill={skin}/></>}
 </g>;
}
/** Side stands: stepped rows of fans in two sections either side of the tunnel. */
function SideStand({x0,dir,primary,secondary,hype}:{x0:number;dir:1|-1;primary:string;secondary:string;hype:number}){
 const cols=4;
 return <g shapeRendering="crispEdges">{[[40,270],[350,580]].map(([y0,y1],sec)=><g key={sec}>
  <rect x={dir>0?x0:x0-cols*17-4} y={y0-6} width={cols*17+4} height={y1-y0+6} fill="#0a121f" stroke="#1f2c3f"/>
  {Array.from({length:cols},(_,c)=>Array.from({length:Math.floor((y1-y0)/22)},(_,r)=>{const n=(c*7+r*5+sec*3)%13,fx=dir>0?x0+2+c*17:x0-2-(c+1)*17;return <g key={`${c}-${r}`}>
   <rect x={fx-1} y={y0+r*22+12} width="17" height="6" fill={c%2?'#223247':'#1b293b'}/>
   <Fan x={fx} y={y0+r*22-2} n={n} primary={primary} secondary={secondary} stand={hype>0&&(c+r)%3!==0}/>
  </g>;}))}
 </g>)}</g>;
}
/** A bench: chairs along the sideline with the team's reserves sitting in them. */
function Bench({x,y,players,kit,count=9,teamId}:{x:number;y:number;players:PlayerSeason[];kit:TeamIdentity;count?:number;teamId:string}){
 return <g>{Array.from({length:count},(_,i)=>{const p=players[i];return <g key={i} transform={`translate(${x+i*28},${y})`}>
  <rect x="0" y="6" width="22" height="18" fill="#1d2a3c" stroke="#0a111c" shapeRendering="crispEdges"/><rect x="2" y="0" width="18" height="10" fill="#2c3e55" shapeRendering="crispEdges"/>
  {p&&<g transform="translate(-2,-14)"><PlayerAvatar playerId={p.playerId} teamId={teamId} size={26} jerseyNumber={p.jerseyNumber} age={p.age} primaryColor={kit.primary} secondaryColor={kit.secondary} jerseyStyle={kit.jerseyStyle}/></g>}
 </g>;})}</g>;
}
/** A referee in stripes who trails the play along the sideline. */
export function Referee({x,y,facing=1}:{x:number;y:number;facing?:number}){
 return <g transform={`translate(${x.toFixed(1)},${y}) scale(${facing},1)`} shapeRendering="crispEdges" data-testid="court-referee">
  <ellipse cx="0" cy="0" rx="10" ry="3.5" fill="#1a120c" opacity=".3"/>
  <rect x="-6" y="-14" width="5" height="14" fill="#15161b"/><rect x="1" y="-14" width="5" height="14" fill="#15161b"/>
  <rect x="-7" y="-2" width="6" height="3" fill="#0a0a0a"/><rect x="1" y="-2" width="6" height="3" fill="#0a0a0a"/>
  <rect x="-8" y="-31" width="16" height="18" fill="#f4f1ea"/>{[-6,-2,2,6].map(v=><rect key={v} x={v-1} y="-31" width="2" height="18" fill="#15161b"/>)}
  <rect x="-12" y="-30" width="4" height="12" fill="#f4f1ea"/><rect x="8" y="-30" width="4" height="12" fill="#f4f1ea"/>
  <rect x="-12" y="-19" width="4" height="4" fill="#d6aa7b"/><rect x="8" y="-19" width="4" height="4" fill="#d6aa7b"/>
  <rect x="-5" y="-42" width="10" height="11" fill="#d6aa7b"/><rect x="-5" y="-43" width="10" height="3" fill="#3b2a1c"/>
  <rect x="-3" y="-38" width="2" height="2" fill="#1a1410"/><rect x="2" y="-38" width="2" height="2" fill="#1a1410"/>
 </g>;
}
/** Courtside board with the community link (it opens Discord in a new tab). */
function DiscordBoard({x,y}:{x:number;y:number}){
 const title=pixelTextPath('JOIN US ON DISCORD',2),w=pixelTextWidth('JOIN US ON DISCORD')*2;
 return <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" aria-label="Join the Court Vision Discord (opens in a new tab)" className="court-discord">
  <g transform={`translate(${x},${y})`} shapeRendering="crispEdges">
   <rect x="-4" y="-4" width={w+60} height="36" fill="#0b1018"/>
   <rect x="-2" y="-2" width={w+56} height="32" fill="#3c45a5"/><rect x="0" y="0" width={w+52} height="28" fill="#5865f2"/>
   <g transform="translate(6,2) scale(1.5)"><path d={CLYDE_PATH} fill="#fff"/></g>
   <g transform="translate(40,7)"><path d={title} fill="#fff"/></g>
   <rect x="14" y="30" width="4" height="14" fill="#2a3546"/><rect x={w+34} y="30" width="4" height="14" fill="#2a3546"/>
  </g>
 </a>;
}
const Arena=memo(function Arena({home,away,identity,awayKit,id,hype,homeBench,awayBench}:{home:Team;away:Team;identity:TeamIdentity;awayKit:TeamIdentity;id:string;hype:number;homeBench:PlayerSeason[];awayBench:PlayerSeason[]}){
 const apron=shade(identity.primary,-.18),apronDark=shade(identity.primary,-.45),paint=identity.courtPaint,style=floorStyle(home.teamId);
 const cream='#f6ecd2';
 return <>
  <defs>
   <pattern id={`${id}-planks`} width="120" height="10" patternUnits="userSpaceOnUse" shapeRendering="crispEdges">
    <rect width="120" height="10" fill="#e3b479"/><rect y="5" width="120" height="5" fill="#dcab6e"/>
    <path d="M0 0H120M0 5H120" stroke="#a8743f" strokeOpacity=".55"/><path d="M34 0V5M92 0V5M8 5V10M66 5V10" stroke="#a8743f" strokeOpacity=".45"/>
    <path d="M44 2H80M12 7H40M76 7H100" stroke="#f2cd96" strokeOpacity=".35"/>
   </pattern>
   <pattern id={`${id}-parquet`} width="48" height="48" patternUnits="userSpaceOnUse" shapeRendering="crispEdges">
    <rect width="48" height="48" fill="#b7784a"/>
    {[0,1].map(r=>[0,1].map(c=>{const vertical=(r+c)%2===0,ox=c*24,oy=r*24;return <g key={`${r}${c}`}>{[0,1,2].map(k=>vertical
     ?<rect key={k} x={ox+k*8} y={oy} width="8" height="24" fill={k%2?'#c68a55':'#ad6f42'} stroke="#7d4a28" strokeOpacity=".6"/>
     :<rect key={k} x={ox} y={oy+k*8} width="24" height="8" fill={k%2?'#c68a55':'#b27446'} stroke="#7d4a28" strokeOpacity=".6"/>)}</g>;}))}
   </pattern>
   <radialGradient id={`${id}-sheen`} cx="50%" cy="40%" r="65%"><stop offset="0" stopColor="#fff6dc" stopOpacity=".16"/><stop offset=".6" stopColor="#fff6dc" stopOpacity="0"/><stop offset="1" stopColor="#1a0f05" stopOpacity=".22"/></radialGradient>
   <linearGradient id={`${id}-apron`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={apronDark}/><stop offset=".12" stopColor={apron}/><stop offset=".88" stopColor={apron}/><stop offset="1" stopColor={apronDark}/></linearGradient>
  </defs>
  {/* The whole building in the home team's colour, darker toward the stands. */}
  <rect x={SCENE.x} y="0" width={SCENE.w} height="600" fill={`url(#${id}-apron)`}/>
  <rect x={SCENE.x} y="0" width={SCENE.w} height="600" fill="#000" opacity=".12"/>
  <SideStand x0={SCENE.x+2} dir={1} primary={identity.primary} secondary={identity.secondary} hype={hype}/>
  <SideStand x0={SCENE.x+SCENE.w-2} dir={-1} primary={identity.primary} secondary={identity.secondary} hype={hype}/>
  {/* Top sideline: the visitors' bench, the table officials' chairs and the community board. */}
  <rect x="100" y="8" width="332" height="44" fill={apronDark} opacity=".55"/>
  <Bench x={112} y={24} players={awayBench} kit={awayKit} teamId={away.teamId} count={11}/>
  <DiscordBoard x={624} y={12}/>
  {/* Baseline aprons carry the name, top to bottom, like a painted end line. */}
  <BaselineName text={home.name} x={11} side={1} fill={cream}/>
  <BaselineName text={home.name} x={989} side={-1} fill={cream}/>
  {/* Floor */}
  <rect x="58" y="81" width="884" height="458" fill="#0b1018"/>
  <rect x="62" y="85" width="876" height="450" fill={`url(#${id}-${style})`}/>
  <path d={`M62 ${LANE.top}H${62+LANE.depth}V${LANE.bottom}H62ZM938 ${LANE.top}H${938-LANE.depth}V${LANE.bottom}H938Z`} fill={paint}/>
  {[62+LANE.depth,938-LANE.depth].map((x,i)=><path key={i} d={`M${x} ${310-FT_R}A${FT_R} ${FT_R} 0 0 ${i?0:1} ${x} ${310+FT_R}Z`} fill={identity.secondary} opacity=".85"/>)}
  <circle cx="500" cy="310" r="56" fill={identity.secondary} opacity=".35"/>
  <CourtLines/>
  <g data-testid="home-court-logo" transform="translate(420,230) scale(.8)" opacity=".96"><CrestArt team={home} identity={identity}/></g>
  <rect x="62" y="85" width="876" height="450" fill={`url(#${id}-sheen)`} pointerEvents="none"/>
  {/* Bottom sideline: the scorer's table between the home bench and the media row. */}
  <g shapeRendering="crispEdges">
   <rect x="376" y="566" width="248" height="28" fill="#1c2a3b" stroke="#0a111c"/><rect x="386" y="571" width="228" height="16" fill="#0c1725"/>
   <g transform={`translate(${(500-pixelTextWidth(identity.abbreviation+' COURT VISION'))},575)`}><path d={pixelTextPath(identity.abbreviation+' COURT VISION',2)} fill="#f8bc70"/></g>
  </g>
  <Bench x={96} y={566} players={homeBench} kit={identity} teamId={home.teamId} count={9}/>
  <g shapeRendering="crispEdges">{Array.from({length:8},(_,i)=><g key={i} transform={`translate(${650+i*34},566)`}><rect width="24" height="20" fill="#1d2a3c" stroke="#0a111c"/><rect x="4" y="-10" width="16" height="12" fill="#2c3e55"/></g>)}</g>
 </>;
});
function Photographers({flash}:{flash:number}){
 return <g shapeRendering="crispEdges">{[[40,150],[40,470],[960,150],[960,470]].map(([x,y],i)=><g key={i} transform={`translate(${x},${y})`}>
  <rect x="-6" y="0" width="12" height="11" fill="#1b2533"/><rect x="-4" y="-8" width="8" height="8" fill={CROWD_SKIN[i%CROWD_SKIN.length]}/><rect x={i<2?4:-12} y="-2" width="8" height="6" fill="#0a0f18"/>
  {flash>0&&(i+Math.round(flash*3))%2===0&&<circle cx={i<2?12:-12} cy="1" r={6+flash*6} fill="#fffbe8" opacity={.75*flash}/>}
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
 const scale=1.18*Math.max(.9,Math.min(1.1,(player?.attributes.physical.heightInches??79)/79));
 const crouch=pose==='guard'?3:pose==='screen'?1:0,clip=`${id}-body`;
 // Arms: [shoulder, elbow, hand] per side, as simple pixel segments.
 const arm=(side:number):string=>{
  const s=`${side*10} -26`;
  if(pose==='shoot'||pose==='reach')return `M${s}L${side*12} -38L${side*7} -48`;
  if(pose==='rebound')return `M${s}L${side*9} -40L${side*8} -54`;
  if(pose==='pass')return `M${s}L${side*4+actor.facing*12} -24L${side*3+actor.facing*21} -25`;
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
   {/* Shorts in the kit colour with a side stripe */}
   <path d="M-10 -19H10V-11H2V-13H-2V-11H-10Z" fill={identity.primary} stroke="#080d19" strokeWidth="1.5" paintOrder="stroke"/>
   <path d="M-10 -19V-11M10 -19V-11" stroke={identity.secondary} strokeWidth="2"/>
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
 if(camera==='full')return `${SCENE.x} 0 ${SCENE.w} 600`;
 const ball=frame.ball,cx=frame.players.reduce((s,a)=>s+a.x,0)/Math.max(1,frame.players.length),cy=frame.players.reduce((s,a)=>s+a.y,0)/Math.max(1,frame.players.length);
 if(camera==='broadcast'){const w=700,h=344,fx=ball.x*.45+cx*.55;return `${Math.max(SCENE.x,Math.min(SCENE.x+SCENE.w-w,fx-w/2)).toFixed(1)} ${Math.max(0,Math.min(600-h,(ball.y*.3+cy*.7)-h/2+10)).toFixed(1)} ${w} ${h}`;}
 const fx=ball.x*.7+cx*.3,fy=ball.y*.7+cy*.3;
 return `${Math.max(SCENE.x,Math.min(SCENE.x+SCENE.w-560,fx-280)).toFixed(1)} ${Math.max(0,Math.min(600-276,fy-150)).toFixed(1)} 560 276`;
}
export function WatchCourt({frame,home,away,rosters,hotId,labels=true,trail=false,camera='full',ghosts=[],shots=[],bug}:{frame:CourtFrame;home:Team;away:Team;rosters:PlayerSeason[];hotId?:string;labels?:boolean;trail?:boolean;camera?:CourtCamera;ghosts?:CourtBall[];shots?:CourtShot[];bug?:CourtBug}){
 const homeIdentity=useTeamIdentity(home.teamId),awayIdentity=useTeamIdentity(away.teamId),id=useId().replace(/:/g,'');
 const hi=homeIdentity??resolveTeamIdentity(home),ai=awayIdentity??resolveTeamIdentity(away);
 const awayKit={...ai,primary:'#f2e8d2',secondary:ai.primary};
 const players=[...frame.players].sort((a,b)=>a.y-b.y),ball=frame.ball;
 const onCourt=frame.players.map(a=>a.id).join('|');
 // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by who is on the floor, not the frame object
 const [homeBench,awayBench]=useMemo(()=>{const court=new Set(onCourt.split('|'));const side=(t:string)=>rosters.filter(p=>p.teamId===t&&!court.has(p.playerId));return [side(home.teamId),side(away.teamId)];},[rosters,onCourt,home.teamId,away.teamId]);
 const homeMoment=frame.callout?.tone==='make'&&frame.offenseTeamId===home.teamId?Math.sin(frame.callout.t*Math.PI):frame.callout?.tone==='defense'&&frame.offenseTeamId===away.teamId?Math.sin(frame.callout.t*Math.PI)*.7:0;
 const hype=Math.round(homeMoment*6)/6;
 const flash=frame.net>0?frame.net:0;
 const athlete=(a:CourtActor)=>{const homeSide=a.teamId===home.teamId;return <Athlete key={a.id} id={`${id}-${frame.players.indexOf(a)}`} actor={a} player={rosters.find(p=>p.playerId===a.id)} identity={homeSide?hi:awayKit} ring={homeSide?hi.primary:ai.primary} hot={a.id===hotId} carrier={a.id===frame.carrier} labels={labels&&(a.teamId===frame.offenseTeamId||!frame.offenseTeamId||a.id===frame.carrier)} above={a.teamId!==frame.offenseTeamId&&!!frame.offenseTeamId}/>;};
 return <div className="watch-arena"><svg className="watch-court" viewBox={cameraBox(frame,camera)} role="img" aria-label={`${home.name} home court. ${frame.phase}.`}>
  <Arena home={home} away={away} identity={hi} awayKit={awayKit} id={id} hype={hype} homeBench={homeBench} awayBench={awayBench}/>
  <Photographers flash={flash}/>
  <Referee x={Math.max(180,Math.min(820,300+ball.x*.4))} y={82} facing={ball.x>500?1:-1}/>
  <Referee x={Math.max(180,Math.min(820,700-(1000-ball.x)*.35))} y={556} facing={ball.x>500?1:-1}/>
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
