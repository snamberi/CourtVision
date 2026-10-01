import { memo, useId, useMemo } from 'react';
import type { PlayerSeason } from '../simulation/types';
import type { CourtActor, CourtBall, CourtFrame, CourtShot } from '../simulation/courtMotion';
import { resolveTeamIdentity, type TeamIdentity } from '../simulation/teamIdentity';
import { useTeamIdentity } from '../visuals/TeamIdentityContext';
import { actionSprite, pickFrame, handReach, headTop, ORIGIN_X, ORIGIN_Y } from '../visuals/actionSprites';
import { PlayerAvatar } from './PlayerAvatar';
import { PixelBall } from './PixelIcon';
import { CrestArt } from './TeamCrest';
import { DISCORD_URL } from './DiscordLink';
import { CLYDE_PATH } from '../visuals/discordGlyph';
import { pixelTextPath, pixelTextWidth, splitTeamName } from '../visuals/pixelFont';
import { equippedFloor } from '../profile/profile';
import { CoachFigure, type CoachPose } from './CoachFigure';
import { coachLook, type CoachLook } from '../visuals/coachLook';

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
const SCENE={x:-110,w:1220};
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
  <path d="M2 4H3V9H2ZM3 1H7V2H3Z" fill="#fff3df" opacity=".22"/><path d="M10 4H12V10H10ZM12 10H14V19H12" fill="#080d19" opacity=".28"/>
  <rect x="4" y="5" width="2" height="2" fill="#1a1410"/><rect x="8" y="5" width="2" height="2" fill="#1a1410"/>
  <path d="M5 8H9V9H5ZM4 11H10V12H4" fill="#fff3df" opacity=".65"/>
  {n%5===0&&<path d="M2 2H12V4H2ZM8 4H14V5H8Z" fill={secondary}/>}
  {n%3===0&&<path d="M6 13H8V17H6ZM5 17H9V18H5" fill={secondary}/>}
  {n%7===0&&<path d="M3 5H7V7H3ZM8 5H12V7H8ZM7 5H8V6H7" fill="#121926"/>}
  {stand&&<><rect x="-3" y="-3" width="3" height="11" fill={skin}/><rect x="14" y="-3" width="3" height="11" fill={skin}/></>}
 </g>;
}
/** Side stands: stepped rows of fans in two sections either side of the tunnel. */
function SideStand({x0,dir,primary,secondary,hype,fill=1,loud=0}:{x0:number;dir:1|-1;primary:string;secondary:string;hype:number;fill?:number;loud?:number}){
 const cols=4;
 // The loud section (an arena upgrade) is the lower stand behind the home basket: everyone in the colours, on their feet.
 const loudHere=(sec:number)=>loud>0&&sec===1&&dir>0;
 return <g shapeRendering="crispEdges">{[[40,270],[350,580]].map(([y0,y1],sec)=><g key={sec}>
  <rect x={dir>0?x0:x0-cols*17-4} y={y0-6} width={cols*17+4} height={y1-y0+6} fill="#0a121f" stroke="#1f2c3f"/>
  {Array.from({length:cols},(_,c)=>Array.from({length:Math.floor((y1-y0)/22)},(_,r)=>{const n=(c*7+r*5+sec*3)%13,fx=dir>0?x0+2+c*17:x0-2-(c+1)*17;return <g key={`${c}-${r}`}>
   <rect x={fx-1} y={y0+r*22+12} width="17" height="6" fill={c%2?'#223247':'#1b293b'}/>
   {/* Empty seats when the building isn't full (attendance, see business.ts). */}
   {loudHere(sec)?<>
    <Fan x={fx} y={y0+r*22-2} n={(c+r)%2?0:4} primary={primary} secondary={secondary} stand={hype>0||loud>=3||(loud>=2&&(c+r)%2===0)}/>
    {loud>=2&&(c*3+r)%4===0&&<g className="court-foam" style={{animationDelay:`${((c+r)%3)*.2}s`}}><rect x={fx+3} y={y0+r*22-16} width="8" height="7" fill={secondary} stroke="#0b1018"/><rect x={fx+6} y={y0+r*22-20} width="3" height="5" fill={secondary} stroke="#0b1018"/></g>}
   </>
   :((c*37+r*61+sec*17+(dir>0?0:29))%100)/100<fill?<Fan x={fx} y={y0+r*22-2} n={n} primary={primary} secondary={secondary} stand={hype>0&&(c+r)%3!==0}/>:<rect x={fx+2} y={y0+r*22+4} width="11" height="8" fill="#2a3a50"/>}
  </g>;}))}
  {loudHere(sec)&&loud>=3&&<g transform={`translate(${x0+cols*17+10},${(y0+y1)/2}) rotate(-90)`}><rect x="-52" y="-8" width="104" height="16" fill={primary} stroke="#0b1018" strokeWidth="2"/><g transform={`translate(${-pixelTextWidth('LOUD HOUSE')},-4)`}><path d={pixelTextPath('LOUD HOUSE',2)} fill={secondary}/></g></g>}
 </g>)}</g>;
}
/** The home video board, hung over the top sideline: bigger and brighter with each upgrade level. */
function VideoBoard({level,identity,bug,hype}:{level:number;identity:TeamIdentity;bug?:CourtBug;hype:number}){
 const w=[0,104,136,172][level],x=528-w/2,h=level>=3?44:38,screen=level>=2?'#07101c':'#0b1018';
 const line=bug?`${bug.homeScore}-${bug.awayScore}`:identity.abbreviation,lw=pixelTextWidth(line),px=level>=3?3:2;
 return <g data-testid="arena-scoreboard" data-level={level} transform={`translate(${x},4)`} shapeRendering="crispEdges">
  <rect x="-3" y="-3" width={w+6} height={h+6} fill="#05080e"/><rect width={w} height={h} fill={shade(identity.primary,-.35)}/>
  <rect x="4" y="4" width={w-8} height={h-12} fill={screen}/>
  <g transform={`translate(${(w/2-lw*px/2).toFixed(1)},${level>=3?10:9})`}><path d={pixelTextPath(line,px)} fill={level>=2?'#ffe7af':'#f6ab64'}/></g>
  {/* LED ribbon along the bottom edge, running in the team colours */}
  {level>=2&&Array.from({length:Math.floor((w-8)/6)},(_,i)=><rect key={i} className="court-led" style={{animationDelay:`${(i%6)*.1}s`}} x={4+i*6} y={h-7} width="4" height="3" fill={i%2?identity.primary:identity.secondary}/>)}
  {level>=3&&<><rect x="6" y={h-16} width={Math.round((w-12)*Math.min(1,.35+hype*.65))} height="3" fill="#f47b20"/><rect x="-10" y="6" width="7" height="22" fill="#05080e"/><rect x={w+3} y="6" width="7" height="22" fill="#05080e"/></>}
 </g>;
}
/** Light rigs over the corners and their beams on the floor; the top level adds moving team-colour spotlights. */
function ArenaLights({level,identity}:{level:number;identity:TeamIdentity}){
 return <g pointerEvents="none" data-testid="arena-lights" data-level={level}>
  <rect x="62" y="85" width="876" height="450" fill="#fffbe8" opacity={.025*level}/>
  {[[-40,60],[1040,60],[-40,560],[1040,560]].map(([x,y],i)=><g key={i}>
   <path d={`M${x} ${y}L${x<500?300:700} ${y<300?250:370}L${x<500?180:820} ${y<300?360:260}Z`} fill="#fff6d6" opacity={.035+level*.015}/>
   <g transform={`translate(${x},${y})`} shapeRendering="crispEdges"><rect x="-14" y="-8" width="28" height="16" fill="#0b1018"/>{[0,1,2].slice(0,level).map(k=><rect key={k} x={-11+k*8} y="-5" width="6" height="10" fill="#fff4c2"/>)}</g>
  </g>)}
  {level>=3&&[0,1].map(i=><ellipse key={i} className={`court-spot court-spot-${i}`} cx={i?660:340} cy="310" rx="70" ry="34" fill={i?identity.secondary:identity.primary} opacity=".12"/>)}
 </g>;
}
/** The home mascot, bouncing on the sideline; a cape at level 2, a T-shirt cannon at level 3. */
function Mascot({level,identity,hype}:{level:number;identity:TeamIdentity;hype:number}){
 const fur=identity.primary,trim=identity.secondary,dark=shade(identity.primary,-.4);
 return <g data-testid="arena-mascot" data-level={level} transform="translate(646,560)"><g className={hype>0?'court-mascot court-mascot-hype':'court-mascot'} shapeRendering="crispEdges">
  {level>=2&&<path d="M-10 0H10L14 24H-14Z" fill={trim} stroke="#0b1018"/>}
  <rect x="-6" y="22" width="5" height="10" fill={dark}/><rect x="1" y="22" width="5" height="10" fill={dark}/>
  <rect x="-9" y="4" width="18" height="20" fill={fur} stroke="#0b1018"/><rect x="-5" y="8" width="10" height="10" fill="#f4f0e6"/>
  <rect x="-13" y="6" width="4" height="12" fill={fur} stroke="#0b1018"/><rect x="9" y="6" width="4" height="12" fill={fur} stroke="#0b1018"/>
  <rect x="-11" y="-18" width="22" height="22" fill={fur} stroke="#0b1018"/>
  <rect x="-12" y="-24" width="7" height="8" fill={fur} stroke="#0b1018"/><rect x="5" y="-24" width="7" height="8" fill={fur} stroke="#0b1018"/>
  <rect x="-6" y="-11" width="4" height="5" fill="#fff"/><rect x="2" y="-11" width="4" height="5" fill="#fff"/><rect x="-5" y="-9" width="2" height="3" fill="#0b1018"/><rect x="3" y="-9" width="2" height="3" fill="#0b1018"/>
  <rect x="-4" y="-3" width="8" height="3" fill={trim}/>
  {level>=3&&<><rect x="11" y="2" width="16" height="6" fill="#3a4b63" stroke="#0b1018"/><rect x="25" y="1" width="4" height="8" fill="#0b1018"/>{hype>0&&<rect className="court-tshirt" x="30" y="-8" width="7" height="6" fill={trim} stroke="#0b1018"/>}</>}
 </g></g>;
}
/** A bench: chairs along the sideline with the team's reserves sitting in them. */
function Bench({x,y,players,kit,count=9,teamId}:{x:number;y:number;players:PlayerSeason[];kit:TeamIdentity;count?:number;teamId:string}){
 return <g>{Array.from({length:count},(_,i)=>{const p=players[i];return <g key={i} transform={`translate(${x+i*28},${y})`}>
  <rect x="0" y="6" width="22" height="18" fill="#1d2a3c" stroke="#0a111c" shapeRendering="crispEdges"/><rect x="2" y="0" width="18" height="10" fill="#2c3e55" shapeRendering="crispEdges"/>
  {p&&<g transform="translate(-2,-14)"><PlayerAvatar playerId={p.playerId} teamId={teamId} size={26} jerseyNumber={p.jerseyNumber} age={p.age} primaryColor={kit.primary} secondaryColor={kit.secondary} jerseyStyle={kit.jerseyStyle}/></g>}
 </g>;})}</g>;
}
/** A referee in stripes who trails the play along the sideline. */
export function Referee({x,y,facing=1,number,whistle=false}:{x:number;y:number;facing?:number;number?:number;whistle?:boolean}){
 return <g transform={`translate(${x.toFixed(1)},${y}) scale(${facing},1)`} shapeRendering="crispEdges" data-testid="court-referee" data-whistle={whistle?'1':undefined}>
  <ellipse cx="0" cy="0" rx="10" ry="3.5" fill="#1a120c" opacity=".3"/>
  <rect x="-6" y="-14" width="5" height="14" fill="#15161b"/><rect x="1" y="-14" width="5" height="14" fill="#15161b"/>
  <rect x="-7" y="-2" width="6" height="3" fill="#0a0a0a"/><rect x="1" y="-2" width="6" height="3" fill="#0a0a0a"/>
  <rect x="-8" y="-31" width="16" height="18" fill="#f4f1ea"/>{[-6,-2,2,6].map(v=><rect key={v} x={v-1} y="-31" width="2" height="18" fill="#15161b"/>)}
  <rect x="-12" y="-30" width="4" height="12" fill="#f4f1ea"/>{whistle?<><rect x="8" y="-46" width="4" height="16" fill="#f4f1ea"/><rect x="8" y="-50" width="4" height="4" fill="#d6aa7b"/></>:<rect x="8" y="-30" width="4" height="12" fill="#f4f1ea"/>}
  <rect x="-12" y="-19" width="4" height="4" fill="#d6aa7b"/>{!whistle&&<rect x="8" y="-19" width="4" height="4" fill="#d6aa7b"/>}
  {number!=null&&<><rect x="-4" y="-27" width="8" height="6" fill="#f4f1ea"/><text x="0" y="-22" textAnchor="middle" transform={facing<0?'scale(-1,1)':undefined} fontFamily="monospace" fontSize="6" fontWeight="bold" fill="#15161b">{number}</text></>}
  {whistle&&<rect x="-1" y="-35" width="3" height="2" fill="#c9ced8"/>}
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
const Arena=memo(function Arena({home,away,identity,awayKit,id,hype,homeBench,awayBench,fill=1,loud=0,mascot=0,rivalry=false,building}:{home:Team;away:Team;identity:TeamIdentity;awayKit:TeamIdentity;id:string;hype:number;homeBench:PlayerSeason[];awayBench:PlayerSeason[];fill?:number;loud?:number;mascot?:number;rivalry?:boolean;building?:{name:string;suites:number}}){
 const tableText=building?building.name.toUpperCase().replace(/[^A-Z0-9 ]/g,'').slice(0,22):identity.abbreviation+' COURT VISION';
 const apron=shade(identity.primary,-.18),apronDark=shade(identity.primary,-.45),paint=identity.courtPaint,picked=equippedFloor(),style=picked==='team'?floorStyle(home.teamId):picked;
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
   <pattern id={`${id}-blonde`} width="120" height="10" patternUnits="userSpaceOnUse" shapeRendering="crispEdges">
    <rect width="120" height="10" fill="#f0cf97"/><rect y="5" width="120" height="5" fill="#ebc68a"/>
    <path d="M0 0H120M0 5H120" stroke="#c89a5c" strokeOpacity=".45"/><path d="M28 0V5M86 0V5M14 5V10M60 5V10" stroke="#c89a5c" strokeOpacity=".4"/>
   </pattern>
   <pattern id={`${id}-midnight`} width="120" height="10" patternUnits="userSpaceOnUse" shapeRendering="crispEdges">
    <rect width="120" height="10" fill="#4a2e1d"/><rect y="5" width="120" height="5" fill="#43291a"/>
    <path d="M0 0H120M0 5H120" stroke="#23150c" strokeOpacity=".7"/><path d="M40 0V5M100 0V5M18 5V10M72 5V10" stroke="#23150c" strokeOpacity=".6"/>
    <path d="M50 2H84M16 7H44" stroke="#6b4630" strokeOpacity=".5"/>
   </pattern>
   <pattern id={`${id}-asphalt`} width="24" height="24" patternUnits="userSpaceOnUse" shapeRendering="crispEdges">
    <rect width="24" height="24" fill="#4b5058"/>
    {[[2,3],[9,14],[17,6],[21,19],[5,20],[13,9]].map(([x,y])=><rect key={`${x}-${y}`} x={x} y={y} width="2" height="2" fill={(x+y)%3?'#5b6069':'#3c4047'}/>)}
   </pattern>
   <pattern id={`${id}-grain`} width="144" height="40" patternUnits="userSpaceOnUse" shapeRendering="crispEdges">
    <path d="M6 3H29M38 8H62M81 2H102M112 13H139M9 22H37M44 31H67M78 27H119M126 36H142M13 37H31M62 18H84" stroke="#6f4527" strokeWidth=".5" strokeOpacity=".22"/>
    <path d="M7 4H24M40 9H66M81 3H107M9 23H42M78 28H112M64 19H87" stroke="#fff0ca" strokeWidth=".5" strokeOpacity=".3"/>
    <path d="M17 8H24V9H17ZM96 33H100V34H96Z" fill="#764c2c" opacity=".12"/>
   </pattern>
   <radialGradient id={`${id}-sheen`} cx="50%" cy="40%" r="65%"><stop offset="0" stopColor="#fff6dc" stopOpacity=".16"/><stop offset=".6" stopColor="#fff6dc" stopOpacity="0"/><stop offset="1" stopColor="#1a0f05" stopOpacity=".22"/></radialGradient>
   <linearGradient id={`${id}-apron`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={apronDark}/><stop offset=".12" stopColor={apron}/><stop offset=".88" stopColor={apron}/><stop offset="1" stopColor={apronDark}/></linearGradient>
  </defs>
  {/* The whole building in the home team's colour, darker toward the stands. */}
  <rect x={SCENE.x} y="0" width={SCENE.w} height="600" fill={`url(#${id}-apron)`}/>
  <rect x={SCENE.x} y="0" width={SCENE.w} height="600" fill="#000" opacity=".12"/>
  <SideStand x0={SCENE.x+2} dir={1} primary={identity.primary} secondary={identity.secondary} hype={hype} fill={fill} loud={loud}/>
  <SideStand x0={SCENE.x+SCENE.w-2} dir={-1} primary={identity.primary} secondary={identity.secondary} hype={hype} fill={fill}/>
  {/* An owner's luxury suites: lit skybox windows along the top of the building (more with each level). */}
  {building&&building.suites>0&&<g data-testid="arena-suites" shapeRendering="crispEdges">{Array.from({length:building.suites*9},(_,i)=>{const n=building.suites*9,x=60+(i+.5)*(880/n)-7;return <rect key={i} x={x} y="1" width="14" height="5" fill={i%4?'#ffd166':'#fff3c4'} stroke="#0b1018" strokeWidth=".8"/>;})}</g>}
  {/* Top sideline: the visitors' bench, the table officials' chairs and the community board. */}
  <rect x="100" y="8" width="332" height="44" fill={apronDark} opacity=".55"/>
  <Bench x={112} y={24} players={awayBench} kit={awayKit} teamId={away.teamId} count={11}/>
  <DiscordBoard x={624} y={12}/>
  {/* Baseline aprons carry the name, top to bottom, like a painted end line. */}
  <BaselineName text={home.name} x={11} side={1} fill={cream}/>
  <BaselineName text={home.name} x={989} side={-1} fill={cream}/>
  {/* Floor */}
  {/* Out-of-bounds border in the home colours around the wood, with a thin trim line. */}
  <rect x="40" y="66" width="920" height="488" fill="#0b1018"/>
  <rect x="42" y="68" width="916" height="484" fill={shade(identity.primary,-.12)}/>
  <rect x="52" y="76" width="896" height="468" fill="none" stroke={identity.secondary} strokeWidth="2" opacity=".85"/>
  {/* Rivalry Week: the border is striped in both teams' colours. */}
  {rivalry&&<rect data-testid="rivalry-trim" x="47" y="72" width="906" height="476" fill="none" stroke={awayKit.secondary} strokeWidth="6" strokeDasharray="18 18" opacity=".9"/>}
  <rect x="58" y="81" width="884" height="458" fill="#0b1018"/>
  <rect x="62" y="85" width="876" height="450" fill={`url(#${id}-${style})`}/>
  {style!=='asphalt'&&<rect x="62" y="85" width="876" height="450" fill={`url(#${id}-grain)`} pointerEvents="none"/>}
  <path d={`M62 ${LANE.top}H${62+LANE.depth}V${LANE.bottom}H62ZM938 ${LANE.top}H${938-LANE.depth}V${LANE.bottom}H938Z`} fill={paint}/>
  {[62+LANE.depth,938-LANE.depth].map((x,i)=><path key={i} d={`M${x} ${310-FT_R}A${FT_R} ${FT_R} 0 0 ${i?0:1} ${x} ${310+FT_R}Z`} fill={identity.secondary} opacity=".85"/>)}
  <circle cx="500" cy="310" r="56" fill={identity.secondary} opacity=".35"/>
  <CourtLines/>
  {/* The team name painted along both sidelines, between the arcs. */}
  {[[300,106],[700,106],[300,522],[700,522]].map(([x,y],i)=>{const t=rivalry&&i<2?(i?'WEEK':'RIVALRY'):splitTeamName(home.name).nickname.toUpperCase()||identity.abbreviation,w=pixelTextWidth(t),px=Math.max(2,Math.min(3,150/w));return <g key={i} transform={`translate(${(x-w*px/2).toFixed(1)},${(y-3.5*px).toFixed(1)})`} opacity=".5" shapeRendering="crispEdges"><path d={pixelTextPath(t,px)} fill={identity.primary}/></g>;})}
  <g data-testid="home-court-logo" transform="translate(405,215) scale(.95)" opacity=".96"><CrestArt team={home} identity={identity}/></g>
  {/* Fine paint scuffs and reflected light bars keep the floor tactile at close camera zoom. */}
  <g opacity=".08" fill="#fff3df" pointerEvents="none" shapeRendering="crispEdges"><path d="M145 147H325V149H145ZM675 147H855V149H675ZM145 466H325V468H145ZM675 466H855V468H675Z"/><path d="M176 292H187V294H176ZM813 323H824V325H813ZM228 350H242V351H228ZM758 268H772V269H758"/></g>
  {/* Reflections of the arena lights on the varnish. */}
  {[[240,190],[760,190],[240,430],[760,430],[500,310]].map(([x,y],i)=><ellipse key={i} cx={x} cy={y} rx={i===4?120:80} ry={i===4?46:30} fill="#fffbe8" opacity={i===4?.06:.08} pointerEvents="none"/>)}
  <rect x="62" y="85" width="876" height="450" fill={`url(#${id}-sheen)`} pointerEvents="none"/>
  {/* Bottom sideline: the scorer's table between the home bench and the media row. */}
  <g shapeRendering="crispEdges">
   <rect x="376" y="566" width="248" height="28" fill="#1c2a3b" stroke="#0a111c"/><rect x="386" y="571" width="228" height="16" fill="#0c1725"/>
   <g transform={`translate(${(500-pixelTextWidth(tableText))},575)`}><path d={pixelTextPath(tableText,2)} fill="#f8bc70"/></g>
  </g>
  <Bench x={96} y={566} players={homeBench} kit={identity} teamId={home.teamId} count={9}/>
  <g shapeRendering="crispEdges">{Array.from({length:mascot?7:8},(_,i)=><g key={i} transform={`translate(${(mascot?684:650)+i*34},566)`}><rect width="24" height="20" fill="#1d2a3c" stroke="#0a111c"/><rect x="4" y="-10" width="16" height="12" fill="#2c3e55"/></g>)}</g>
 </>;
});
function Photographers({flash}:{flash:number}){
 return <g shapeRendering="crispEdges">{[[40,150],[40,470],[960,150],[960,470]].map(([x,y],i)=><g key={i} transform={`translate(${x},${y})`}>
  <rect x="-6" y="0" width="12" height="11" fill="#1b2533"/><rect x="-4" y="-8" width="8" height="8" fill={CROWD_SKIN[i%CROWD_SKIN.length]}/><rect x={i<2?4:-12} y="-2" width="8" height="6" fill="#0a0f18"/>
  {flash>0&&(i+Math.round(flash*3))%2===0&&<circle cx={i<2?12:-12} cy="1" r={6+flash*6} fill="#fffbe8" opacity={.75*flash}/>}
 </g>)}</g>;
}
/** Display height of the ball: game heights (0-34 at the rim) stretched above the waist, so the rim sits over the
 * players' heads and shots arc. Low heights (dribbles, passes, the ball in hand) stay as they are. */
const RIM_HEIGHT=70;
const ballHeight=(z:number)=>z<=28?z:z<=34?28+(z-28)*7:z<=42?RIM_HEIGHT+(z-34)*4:RIM_HEIGHT+32+(z-42)*1.5;
/** The basket from the side, like the players: padded stanchion base in the home colour behind the baseline, steel
 * post and arm, the glass seen edge-on, an orange rim and a pixel net that swishes on a make. */
function Hoop({x,net,rim,pad}:{x:number;net:number;rim:number;pad:string}){
 const left=x<500,shake=rim*Math.sin(rim*20)*2,drop=net*6,sway=net*2.5,R=-RIM_HEIGHT;
 const padLight=shade(pad,.25),padDark=shade(pad,-.35);
 const strands=[-9,-5,0,5,9];
 return <g transform={`translate(${x},310) scale(${left?1:-1},1)`} shapeRendering="crispEdges">
  <ellipse cx="-44" cy="6" rx="26" ry="6" fill="#1a120c" opacity=".3"/>
  {/* padded base */}
  <rect x="-64" y="-28" width="30" height="34" fill="#0a111c"/>
  <rect x="-62" y="-26" width="26" height="30" fill={pad}/><rect x="-62" y="-26" width="26" height="4" fill={padLight}/>
  <rect x="-54" y="-22" width="2" height="26" fill={padDark}/><rect x="-44" y="-22" width="2" height="26" fill={padDark}/><rect x="-62" y="0" width="26" height="4" fill={padDark}/>
  {/* post, arm and brace */}
  <rect x="-54" y={R-34} width="8" height={RIM_HEIGHT+10} fill="#0a111c"/><rect x="-52" y={R-32} width="5" height={RIM_HEIGHT+8} fill="#3a4b63"/><rect x="-52" y={R-32} width="2" height={RIM_HEIGHT+8} fill="#566a86"/>
  <path d={`M-54 ${R-36}H-14V${R-28}H-44L-54 ${R-22}Z`} fill="#0a111c"/><path d={`M-52 ${R-34}H-16V${R-30}H-45L-52 ${R-25}Z`} fill="#3a4b63"/>
  <path d={`M-47 ${R+4}L-20 ${R-27}`} stroke="#0a111c" strokeWidth="4"/><path d={`M-47 ${R+4}L-20 ${R-27}`} stroke="#566a86" strokeWidth="2"/>
  <g transform={`translate(0,${shake.toFixed(2)})`}>
   {/* backboard edge-on, padded along the bottom */}
   <rect x="-19" y={R-40} width="8" height="48" fill="#0a111c"/><rect x="-17" y={R-38} width="4" height="44" fill="#d9ebff"/><rect x="-17" y={R-38} width="1" height="44" fill="#ffffff"/>
   <rect x="-20" y={R+4} width="10" height="5" fill={pad} stroke="#0a111c"/>
   {/* rim and bracket */}
   <rect x="-13" y={R-2} width="4" height="4" fill="#0a111c"/>
   <ellipse cx="0" cy={R} rx="10.5" ry="3.4" fill="none" stroke="#0a111c" strokeWidth="4.5"/>
   {/* net: strands and diamond mesh, stretched on a swish */}
   <g stroke="#f4f0e6" strokeWidth="1.3" fill="none" shapeRendering="auto">
    {strands.map((v,i)=><path key={i} d={`M${v} ${R+2}L${(v*.62+sway*(i%2?1:-1)).toFixed(1)} ${R+18+drop}`}/>)}
    {[0,1,2].map(k=>{const y=R+5+k*5+drop*(k/3),w=9-k*1.3;return <path key={k} d={`M${-w} ${y}L${-w/2} ${y+4}L0 ${y}L${w/2} ${y+4}L${w} ${y}`} opacity=".85"/>;})}
   </g>
   <ellipse cx="0" cy={R} rx="10.5" ry="3.4" fill="none" stroke="#f2601f" strokeWidth="2.4"/>
   <path d={`M-10 ${R+1}Q0 ${R+4.6} 10 ${R+1}`} fill="none" stroke="#ff9a52" strokeWidth="1.2" shapeRendering="auto"/>
  </g>
 </g>;
}
const lastName=(id:string)=>{const parts=id.split(/[\s-]+/);return (parts[parts.length-1]||id).toUpperCase().slice(0,10);};
function Athlete({actor,player,identity,ring,hot,carrier,labels,above,ballZ,hoopX}:{actor:CourtActor;player?:PlayerSeason;identity:TeamIdentity;ring:string;hot:boolean;carrier:boolean;labels:boolean;above:boolean;ballZ:number;hoopX:number}){
 const scale=1.18*Math.max(.9,Math.min(1.1,(player?.attributes.physical.heightInches??79)/79));
 const moving=actor.stride!==0&&actor.pose!=='guard';
 const {id:frameId,pose,flip}=useMemo(()=>pickFrame({pose:actor.pose,anim:actor.anim,cycle:actor.cycle,carrier,moving,ballZ,gait:actor.gait}),[actor.pose,actor.anim,actor.cycle,carrier,moving,ballZ,actor.gait]);
 // The spin move turns him round for two frames.
 const facing=(actor.facing<0?-1:1)*(flip?-1:1);
 const paths=actionSprite(frameId,pose,{playerId:actor.id,primary:identity.primary,secondary:identity.secondary,jerseyNumber:player?.jerseyNumber,age:player?.age,jerseyStyle:identity.jerseyStyle,appearance:player?.appearance},facing);
 // On the dunk the body is drawn so the hands meet the rim, whatever the jump.
 const handTop=handReach(pose)*scale;
 const slam=(actor.anim?.kind==='dunk'&&(frameId==='K2'||frameId==='K3'))||(actor.anim?.kind==='alleyOop'&&(frameId==='AO3'||frameId==='AO4'));
 const lift=slam?Math.min(actor.jump,Math.max(0,RIM_HEIGHT-handTop+4)):actor.jump;
 const top=-headTop(pose)*scale-lift;
 // On the slam and the hang the dunker (shadow and all) is drawn within reach of the rim.
 const gap=hoopX-actor.x,toRim=slam&&Math.abs(gap)>12?Math.sign(gap)*(Math.abs(gap)-12):0;
 return <g className="court-player" data-player-id={actor.id} data-pose={actor.pose} data-frame={frameId} transform={`translate(${(actor.x+toRim).toFixed(2)},${actor.y.toFixed(2)})`}>
  <ellipse rx={15-lift*.06} ry="5" fill="#2f231c" opacity={.3-lift*.004}/>
  <ellipse rx="14" ry="4.5" fill="none" stroke={ring} strokeWidth="2" opacity=".75"/>
  {carrier&&<ellipse rx="19" ry="7" fill="none" stroke="#fff3a5" strokeWidth="2" opacity=".9"/>}
  <g transform={`translate(0,${(-lift).toFixed(2)}) scale(${scale.toFixed(3)}) translate(${-ORIGIN_X},${-ORIGIN_Y})`} shapeRendering="crispEdges">
   {paths.map(({fill,d})=><path key={fill} fill={fill} d={d}/>)}
  </g>
  {hot&&<g transform={`translate(-7,${(top-12).toFixed(1)})`} shapeRendering="crispEdges"><path d="M4 0h2v2h2v2h2v4h2v4h-2v2H2v-2H0V8h2V4h2z" fill="#f47b20"/><path d="M5 5h2v2h2v4H3V7h2z" fill="#ffd166"/></g>}
  {labels&&<g transform="translate(0,19)" opacity={above?.8:1}>
   <text textAnchor="middle" fill="#fff7e4" stroke="#152031" strokeWidth="3" paintOrder="stroke" fontFamily="monospace" fontSize="9.5" fontWeight="bold">{player?.jerseyNumber!=null?`${player.jerseyNumber} `:''}{lastName(actor.id)}</text>
  </g>}
 </g>;
}
function Ball({ball}:{ball:CourtBall}){
 const size=1+Math.min(.45,ball.z*.006);
 return <g data-testid="court-ball" data-height={ball.z.toFixed(2)} transform={`translate(${ball.x.toFixed(2)},${(ball.y-ballHeight(ball.z)).toFixed(2)}) scale(${size.toFixed(3)})`}>
  <g transform={`rotate(${ball.spin.toFixed(1)}) translate(-7,-7)`}><PixelBall size={14}/></g>
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
 return <g transform={`translate(${x},${y-RIM_HEIGHT})`} opacity={o} shapeRendering="crispEdges">{Array.from({length:10},(_,i)=>{const a=i/10*Math.PI*2;return <rect key={i} x={Math.cos(a)*r-2} y={Math.sin(a)*r*.7-2} width="4" height="4" fill={i%2?color:'#fff3c4'}/>;})}</g>;
}
function Callout({text,x,y,t,tone,size=17}:{text:string;x:number;y:number;t:number;tone:'make'|'defense'|'neutral';size?:number}){
 if(t<=0||t>=1)return null;
 const pop=t<.15?.6+t/.15*.5:1.1-Math.min(.1,(t-.15)*.3),rise=t*18,fade=t>.75?1-(t-.75)/.25:1;
 const fill=tone==='make'?'#ffd166':tone==='defense'?'#7cc4ff':'#f4f0e6';
 const cx=Math.max(70,Math.min(930,x));
 return <g className="court-callout" transform={`translate(${cx},${y-rise}) scale(${pop.toFixed(3)})`} opacity={fade}>
  <text textAnchor="middle" fontFamily="'Press Start 2P', monospace" fontSize={size} fill={fill} stroke="#0b1018" strokeWidth="5" paintOrder="stroke">{text}</text>
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
export function WatchCourt({frame,home,away,rosters,hotId,labels=true,trail=false,camera='full',ghosts=[],shots=[],bug,crowdFill=1,arena,building,rivalry=false,duos,coaches,refs,crew}:{building?:{name:string;suites:number};frame:CourtFrame;home:Team;away:Team;rosters:PlayerSeason[];hotId?:string;labels?:boolean;trail?:boolean;camera?:CourtCamera;ghosts?:CourtBall[];shots?:CourtShot[];bug?:CourtBug;crowdFill?:number;
 /** The home arena's upgrade levels (business.ts), drawn on the court. */
 arena?:Partial<Record<'scoreboard'|'lights'|'crowd'|'mascot',number>>;
 /** Rivalry Week game: striped border, painted floor and a crowd on its feet. */
 rivalry?:boolean;
 /** Strong duos (chemistryWeb.ts): an assisted basket between the two gets its own callout. */
 duos?:Set<string>;
 /** The head coaches on the sidelines (their look comes from coachLook); refs = the game's crew numbers. */
 coaches?:{home?:CoachLook;away?:CoachLook};
 refs?:number[];
 crew?:import('../visuals/coachLook').RefCrewMember[]}){
 const homeIdentity=useTeamIdentity(home.teamId),awayIdentity=useTeamIdentity(away.teamId),id=useId().replace(/:/g,'');
 const hi=homeIdentity??resolveTeamIdentity(home),ai=awayIdentity??resolveTeamIdentity(away);
 const awayKit={...ai,primary:'#f2e8d2',secondary:ai.primary};
 const players=[...frame.players].sort((a,b)=>a.y-b.y),ball=frame.ball;
 const onCourt=frame.players.map(a=>a.id).join('|');
 // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by who is on the floor, not the frame object
 const [homeBench,awayBench]=useMemo(()=>{const court=new Set(onCourt.split('|'));const side=(t:string)=>rosters.filter(p=>p.teamId===t&&!court.has(p.playerId));return [side(home.teamId),side(away.teamId)];},[rosters,onCourt,home.teamId,away.teamId]);
 const homeMoment=frame.callout?.tone==='make'&&frame.offenseTeamId===home.teamId?Math.sin(frame.callout.t*Math.PI):frame.callout?.tone==='defense'&&frame.offenseTeamId===away.teamId?Math.sin(frame.callout.t*Math.PI)*.7:0;
 const hype=Math.max(rivalry?.35:0,Math.round(homeMoment*6)/6);
 const lv={scoreboard:arena?.scoreboard??0,lights:arena?.lights??0,crowd:arena?.crowd??0,mascot:arena?.mascot??0};
 const duoCall=frame.callout?.tone==='make'&&duos&&frame.duo&&duos.has(frame.duo.key)?frame.duo:null;
 const flash=frame.net>0?frame.net:0;
 const whistle=frame.phase==='Whistle'||frame.callout?.text==='FOUL';
 // A coach celebrates his team's baskets, folds his arms at the other team's, and points out the play on offense.
 const coachPose=(isHome:boolean):CoachPose=>{const teamId=isHome?home.teamId:away.teamId,c=frame.callout;
  if(c&&c.t>0&&c.t<1&&(c.tone==='make'||c.tone==='defense')){const ours=c.tone==='make'?frame.offenseTeamId===teamId:frame.offenseTeamId!==teamId;return ours?'up':'cross';}
  return frame.offenseTeamId===teamId?(Math.floor(frame.ball.x/120)%2?'point':'down'):'cross';};
 const athlete=(a:CourtActor)=>{const homeSide=a.teamId===home.teamId;return <Athlete key={a.id} ballZ={ball.z} hoopX={frame.hoop.x} actor={a} player={rosters.find(p=>p.playerId===a.id)} identity={homeSide?hi:awayKit} ring={homeSide?hi.primary:ai.primary} hot={a.id===hotId} carrier={a.id===frame.carrier} labels={labels&&(a.teamId===frame.offenseTeamId||!frame.offenseTeamId||a.id===frame.carrier)} above={a.teamId!==frame.offenseTeamId&&!!frame.offenseTeamId}/>;};
 return <div className="watch-arena"><svg className="watch-court" viewBox={cameraBox(frame,camera)} role="img" aria-label={`${home.name} home court. ${frame.phase}.`}>
  <Arena home={home} away={away} identity={hi} awayKit={awayKit} id={id} hype={hype} homeBench={homeBench} awayBench={awayBench} fill={rivalry?1:crowdFill} loud={lv.crowd} mascot={lv.mascot} rivalry={rivalry} building={building}/>
  {lv.lights>0&&<ArenaLights level={lv.lights} identity={hi}/>}
  {lv.scoreboard>0&&<VideoBoard level={lv.scoreboard} identity={hi} bug={bug} hype={hype}/>}
  {lv.mascot>0&&<Mascot level={lv.mascot} identity={hi} hype={hype}/>}
  <Photographers flash={flash}/>
  <Referee x={Math.max(180,Math.min(820,300+ball.x*.4))} y={82} facing={ball.x>500?1:-1} number={refs?.[0]} whistle={whistle&&ball.y<310}/>
  <Referee x={Math.max(180,Math.min(820,700-(1000-ball.x)*.35))} y={556} facing={ball.x>500?1:-1} number={refs?.[1]} whistle={whistle&&ball.y>=310}/>
  <Referee x={frame.hoop.x<500?48:952} y={Math.max(150,Math.min(470,ball.y+60))} facing={frame.hoop.x<500?1:-1} number={refs?.[2]}/>
  {/* The head coaches, working their sidelines. */}
  <g data-testid="coach-away" transform="translate(92,62)"><CoachFigure look={coaches?.away??coachLook(`${away.teamId}-coach`)} primary={ai.primary} secondary={ai.secondary} pose={coachPose(false)}/></g>
  <g data-testid="coach-home" transform="translate(356,562)"><CoachFigure look={coaches?.home??coachLook(`${home.teamId}-coach`)} primary={hi.primary} secondary={hi.secondary} pose={coachPose(true)}/></g>
  {shots.length>0&&<ShotChart shots={shots} home={home.teamId} homeColor={hi.primary} awayColor={ai.primary==='#f2e8d2'?'#94a0b2':ai.primary}/>}
  {trail&&ghosts.map((g,i)=><ellipse key={i} cx={g.x} cy={g.y-ballHeight(g.z)} rx={5-i*.8} ry={5-i*.8} fill="#ffcf8a" opacity={.4-i*.08}/>)}
  <ellipse cx={ball.x} cy={ball.y} rx={Math.max(3,7-ball.z*.025)} ry="2.5" fill="#3e2919" opacity={Math.max(.08,.3-ball.z*.002)}/>
  {players.filter(a=>a.y<310).map(athlete)}
  <Hoop x={100} pad={hi.primary} net={frame.hoop.x===100?frame.net:0} rim={frame.hoop.x===100?frame.rim??0:0}/><Hoop x={900} pad={hi.primary} net={frame.hoop.x===900?frame.net:0} rim={frame.hoop.x===900?frame.rim??0:0}/>
  {players.filter(a=>a.y>=310).map(athlete)}
  <Ball ball={ball}/>
  {frame.callout?.tone==='make'&&<Burst x={frame.hoop.x} y={frame.hoop.y} t={frame.callout.t} color={frame.offenseTeamId===home.teamId?hi.primary:ai.primary}/>}
  {frame.callout&&<Callout {...frame.callout}/>}
  {duoCall&&frame.callout&&<Callout text={`DUO: ${lastName(duoCall.passer)} > ${lastName(duoCall.shooter)}`} x={frame.callout.x} y={frame.callout.y+26} t={frame.callout.t} tone="defense" size={11}/>}
</svg>
  <svg className="watch-bug" viewBox="0 600 1000 50" aria-hidden="true">{bug?<ScoreBug bug={bug} home={home} away={away} hi={hi} ai={ai} frame={frame}/>:<g fill="#d5e1eb" fontFamily="monospace" fontSize="11"><rect x="0" y="600" width="1000" height="50" fill="#0d1726"/><text x="45" y="631">{frame.attackRight?'ATTACK →':'← ATTACK'}</text><text x="955" y="631" textAnchor="end">{frame.phase.toUpperCase()}</text></g>}</svg>
  <div className="watch-arena-caption"><span>{home.name} arena</span>{crew&&<span className="watch-crew" title={crew.map(r=>`${r.role}: ${r.name} #${r.number}`).join(' · ')}>Officials: {crew.map(r=>`${r.name.split(' ').slice(-1)[0]} #${r.number}`).join(', ')}</span>}<span>{frame.phase}</span></div></div>;
}
