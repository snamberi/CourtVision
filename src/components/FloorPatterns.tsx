import { FloorInlay } from './FloorInlay';

/** Every court floor's SVG pattern (ids `${id}-<floor>`): the live game court and the profile previews share them. */
export function FloorPatterns({id}:{id:string}){
 return <>
   <pattern id={`${id}-planks`} width="120" height="10" patternUnits="userSpaceOnUse" shapeRendering="crispEdges">
    <rect width="120" height="10" fill="#e3b479"/><rect y="5" width="120" height="5" fill="#dcab6e"/>
    <path d="M0 0H120M0 5H120" stroke="#a8743f" strokeOpacity=".55"/><path d="M34 0V5M92 0V5M8 5V10M66 5V10" stroke="#a8743f" strokeOpacity=".45"/>
    <path d="M44 2H80M12 7H40M76 7H100" stroke="#f2cd96" strokeOpacity=".35"/>
   <FloorInlay material="planks" /></pattern>
   <pattern id={`${id}-parquet`} width="48" height="48" patternUnits="userSpaceOnUse" shapeRendering="crispEdges">
    <rect width="48" height="48" fill="#b7784a"/>
    {[0,1].map(r=>[0,1].map(c=>{const vertical=(r+c)%2===0,ox=c*24,oy=r*24;return <g key={`${r}${c}`}>{[0,1,2].map(k=>vertical
     ?<rect key={k} x={ox+k*8} y={oy} width="8" height="24" fill={k%2?'#c68a55':'#ad6f42'} stroke="#7d4a28" strokeOpacity=".6"/>
     :<rect key={k} x={ox} y={oy+k*8} width="24" height="8" fill={k%2?'#c68a55':'#b27446'} stroke="#7d4a28" strokeOpacity=".6"/>)}</g>;}))}
   <FloorInlay material="parquet" /></pattern>
   <pattern id={`${id}-blonde`} width="120" height="10" patternUnits="userSpaceOnUse" shapeRendering="crispEdges">
    <rect width="120" height="10" fill="#f0cf97"/><rect y="5" width="120" height="5" fill="#ebc68a"/>
    <path d="M0 0H120M0 5H120" stroke="#c89a5c" strokeOpacity=".45"/><path d="M28 0V5M86 0V5M14 5V10M60 5V10" stroke="#c89a5c" strokeOpacity=".4"/>
   <FloorInlay material="blonde" /></pattern>
   <pattern id={`${id}-midnight`} width="120" height="10" patternUnits="userSpaceOnUse" shapeRendering="crispEdges">
    <rect width="120" height="10" fill="#4a2e1d"/><rect y="5" width="120" height="5" fill="#43291a"/>
    <path d="M0 0H120M0 5H120" stroke="#23150c" strokeOpacity=".7"/><path d="M40 0V5M100 0V5M18 5V10M72 5V10" stroke="#23150c" strokeOpacity=".6"/>
    <path d="M50 2H84M16 7H44" stroke="#6b4630" strokeOpacity=".5"/>
   <FloorInlay material="midnight" /></pattern>
   <pattern id={`${id}-asphalt`} width="24" height="24" patternUnits="userSpaceOnUse" shapeRendering="crispEdges">
    <rect width="24" height="24" fill="#4b5058"/>
    {[[2,3],[9,14],[17,6],[21,19],[5,20],[13,9]].map(([x,y])=><rect key={`${x}-${y}`} x={x} y={y} width="2" height="2" fill={(x+y)%3?'#5b6069':'#3c4047'}/>)}
   <FloorInlay material="asphalt" /></pattern>
   {/* The Trophy Road floors. */}
   <pattern id={`${id}-cherry`} width="120" height="10" patternUnits="userSpaceOnUse" shapeRendering="crispEdges"><rect width="120" height="10" fill="#9a4a2e"/><rect y="5" width="120" height="5" fill="#8c4229"/><path d="M0 0H120M0 5H120" stroke="#5a2414" strokeOpacity=".6"/><path d="M30 0V5M90 0V5M10 5V10M64 5V10" stroke="#5a2414" strokeOpacity=".5"/><FloorInlay material="cherry" /></pattern>
   <pattern id={`${id}-sand`} width="24" height="24" patternUnits="userSpaceOnUse" shapeRendering="crispEdges"><rect width="24" height="24" fill="#e2c88f"/>{[[3,4],[11,15],[18,7],[20,20],[6,19],[14,10]].map(([x,y])=><rect key={`${x}-${y}`} x={x} y={y} width="2" height="2" fill={(x+y)%3?'#d1b277':'#efdcad'}/>)}<FloorInlay material="sand" /></pattern>
   <pattern id={`${id}-retro`} width="40" height="40" patternUnits="userSpaceOnUse" shapeRendering="crispEdges"><rect width="40" height="40" fill="#c8732b"/><rect width="20" height="20" fill="#7a4520"/><rect x="20" y="20" width="20" height="20" fill="#7a4520"/><FloorInlay material="retro" /></pattern>
   <pattern id={`${id}-herringbone`} width="32" height="32" patternUnits="userSpaceOnUse" shapeRendering="crispEdges"><rect width="32" height="32" fill="#c98e57"/>{[0,8,16,24].map(k=><g key={k}><path d={`M${k} 0L${k+8} 8L${k} 16L${k+8} 24L${k} 32`} stroke="#8a5530" strokeOpacity=".7" fill="none"/></g>)}<path d="M0 8H32M0 24H32" stroke="#e0aa72" strokeOpacity=".35"/><FloorInlay material="herringbone" /></pattern>
   <pattern id={`${id}-ebony`} width="120" height="10" patternUnits="userSpaceOnUse" shapeRendering="crispEdges"><rect width="120" height="10" fill="#1d1612"/><rect y="5" width="120" height="5" fill="#241b16"/><path d="M0 0H120M0 5H120" stroke="#c9971f" strokeOpacity=".55"/><path d="M40 0V5M100 0V5M18 5V10M72 5V10" stroke="#c9971f" strokeOpacity=".4"/><FloorInlay material="ebony" /></pattern>
   <pattern id={`${id}-ice`} width="48" height="48" patternUnits="userSpaceOnUse" shapeRendering="crispEdges"><rect width="48" height="48" fill="#cfeeff"/><rect width="24" height="24" fill="#d9f3ff"/><rect x="24" y="24" width="24" height="24" fill="#d9f3ff"/><path d="M4 30L14 22L20 26M30 6L36 14L44 10" stroke="#ffffff" strokeOpacity=".9" fill="none"/><FloorInlay material="ice" /></pattern>
   <pattern id={`${id}-neon`} width="40" height="40" patternUnits="userSpaceOnUse" shapeRendering="crispEdges"><rect width="40" height="40" fill="#120c24"/><path d="M0 0H40M0 0V40" stroke="#3ef2ff" strokeOpacity=".55"/><rect x="0" y="0" width="2" height="2" fill="#ff4fd8"/><FloorInlay material="neon" /></pattern>
   <pattern id={`${id}-lava`} width="60" height="60" patternUnits="userSpaceOnUse" shapeRendering="crispEdges"><rect width="60" height="60" fill="#2a1a16"/><path d="M0 20L14 26L22 18L36 28L60 22M10 60L18 44L30 50L44 40L52 48" stroke="#ff6b2d" strokeWidth="2" fill="none"/><path d="M14 26L22 18M30 50L44 40" stroke="#ffd166" strokeWidth="1" fill="none"/><FloorInlay material="lava" /></pattern>
   <pattern id={`${id}-gold`} width="120" height="10" patternUnits="userSpaceOnUse" shapeRendering="crispEdges"><rect width="120" height="10" fill="#e8b84a"/><rect y="5" width="120" height="5" fill="#d9a83a"/><path d="M0 0H120M0 5H120" stroke="#9a7212" strokeOpacity=".55"/><path d="M44 2H80M12 7H40" stroke="#fff3c4" strokeOpacity=".7"/><FloorInlay material="gold" /></pattern>
   <pattern id={`${id}-galaxy`} width="80" height="80" patternUnits="userSpaceOnUse" shapeRendering="crispEdges"><rect width="80" height="80" fill="#160d33"/><rect x="0" y="0" width="80" height="80" fill="#3b1d82" opacity=".25"/>{[[8,12,'#ffffff'],[40,30,'#ff7ad9'],[66,8,'#6fd3ff'],[20,58,'#ffffff'],[58,62,'#ffd166'],[34,74,'#ffffff']].map(([x,y,c])=><rect key={`${x}-${y}`} x={x as number} y={y as number} width="2" height="2" fill={c as string}/>)}<FloorInlay material="galaxy" /></pattern>
   {/* Season 2: Frozen. Pale ice with a faint red line through it. */}
   <pattern id={`${id}-frozen`} width="48" height="48" patternUnits="userSpaceOnUse" shapeRendering="crispEdges"><rect width="48" height="48" fill="#e6f6ff"/><rect y="20" width="48" height="8" fill="#dcefff"/><path d="M0 24H48" stroke="#c8102e" strokeOpacity=".25"/><FloorInlay material="frozen" /></pattern>
   {/* Season 1: Glitch. Black tiles, dead pixels and torn cyan and magenta lines. */}
   <pattern id={`${id}-glitch`} width="48" height="48" patternUnits="userSpaceOnUse" shapeRendering="crispEdges"><rect width="48" height="48" fill="#08080f"/><rect width="24" height="24" fill="#0d0d1a"/><rect x="24" y="24" width="24" height="24" fill="#0d0d1a"/><FloorInlay material="glitch" /></pattern>
   {/* The game owner's: a starfield laced with blue fire and gold crowns. */}
   <pattern id={`${id}-celestial`} width="120" height="120" patternUnits="userSpaceOnUse" shapeRendering="crispEdges">
    <rect width="120" height="120" fill="#060b2a"/><rect width="120" height="120" fill="#1f4fd9" opacity=".18"/>
    <path d="M0 96L10 88L18 94L30 80L40 90L52 76L62 88L74 74L86 86L98 72L108 84L120 78" stroke="#4da3ff" strokeWidth="3" fill="none" opacity=".75"/>
    <path d="M0 102L12 96L22 100L34 90L46 98L58 86L70 96L82 84L94 94L106 82L120 90" stroke="#9fe7ff" strokeWidth="1.5" fill="none" opacity=".8"/>
    {[[8,10,'#ffffff'],[34,22,'#9fe7ff'],[70,8,'#ffffff'],[96,30,'#b8a8ff'],[18,52,'#ffffff'],[54,44,'#6fd3ff'],[88,58,'#ffffff'],[110,12,'#9fe7ff']].map(([x,y,c])=><rect key={`${x}-${y}`} x={x as number} y={y as number} width="2" height="2" fill={c as string}/>)}
    <path d="M52 30H64L66 24L61 27L58 21L55 27L50 24Z" fill="#ffd166" opacity=".55"/>
   <FloorInlay material="celestial" /></pattern>
 </>;
}
