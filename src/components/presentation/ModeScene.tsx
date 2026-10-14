import { memo } from 'react';
import './presentation.css';

export type SceneMode = 'franchise' | 'legends' | 'career' | 'survival';
const SCENE_NAMES: Record<SceneMode, string> = { franchise: 'THE TROPHY ROOM', legends: 'THE BOSS ARENA', career: 'THE LOCKER ROOM', survival: 'THE LAST COURT' };

function Cup({ x, y, size = 1 }: { x: number; y: number; size?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${size})`}><path d="M-11 0H11V13L5 20H-5L-11 13Z" fill="#f2b847" /><path d="M-8 1H-4V13H-8Z" fill="#ffe9a6" /><path d="M-15 2H-11V12L-17 8V2H-15M11 2H17V8L11 12" fill="none" stroke="#b7782f" strokeWidth="3" /><path d="M-3 20H3V27H10V31H-10V27H-3Z" fill="#d59b39" /><path d="M-14 31H14V35H-14Z" fill="#523b2c" /></g>;
}

/** Local vector scenery, built on the same pixel grid as the game's avatars. */
export const ModeScene = memo(function ModeScene({ mode, className = '', fit = 'slice' }: { mode: SceneMode; className?: string; fit?: 'meet' | 'slice' }) {
  const gold = mode === 'franchise', boss = mode === 'legends', locker = mode === 'career';
  const accent = gold ? '#efbc5a' : boss ? '#b99aff' : locker ? '#76bfc9' : '#f8793f';
  return <svg className={`mode-scene ${className}`} viewBox="0 0 640 260" preserveAspectRatio={`xMidYMid ${fit}`} shapeRendering="crispEdges" aria-hidden="true" focusable="false">
    <rect width="640" height="260" fill={gold ? '#17151a' : boss ? '#171329' : locker ? '#101f28' : '#251918'} />
    <path d="M0 185H640V260H0Z" fill={gold ? '#31251e' : boss ? '#252033' : locker ? '#29333a' : '#342723'} />
    {Array.from({ length: 12 }, (_, i) => <path key={i} d={`M${i * 64 - 32} 185L${i * 80 - 100} 260`} stroke={accent} opacity=".12" />)}
    {[200, 220, 247].map(y => <path key={y} d={`M0 ${y}H640`} stroke={accent} opacity=".13" />)}
    {gold ? <>
      {[38, 226, 414].map((x, i) => <g key={x}>
        <path d={`M${x} 24H${x + 166}V186H${x}Z`} fill="#392b29" stroke="#725035" strokeWidth="4" />
        <path d={`M${x + 8} 33H${x + 158}V176H${x + 8}Z`} fill="#151c24" />
        <path d={`M${x + 8} 108H${x + 158}M${x + 8} 176H${x + 158}`} stroke="#ac7b3f" strokeWidth="4" />
        <path className="scene-light" d={`M${x + 30} 35H${x + 134}L${x + 150} 175H${x + 14}Z`} fill="#ffd582" opacity=".08" />
        <Cup x={x + 83} y={i === 1 ? 44 : 55} size={i === 1 ? 1.55 : 1.15} />
        <Cup x={x + 48} y={127} size={.9} /><Cup x={x + 116} y={125} size={.95} />
        <path d={`M${x + 20} 35L${x + 78} 176H${x + 89}L${x + 31} 35Z`} fill="#fff2cd" opacity=".035" />
      </g>)}
      <path d="M226 204H414L472 260H168Z" fill="#653b32" /><path d="M235 207H405L451 254H189Z" fill="none" stroke="#c89353" opacity=".5" />
    </> : boss ? <>
      {[0, 1, 2, 3].map(i => <g key={i}><path d={`M0 ${49 + i * 25}H640`} stroke="#33273f" strokeWidth="15" />{Array.from({ length: 25 }, (_, j) => <rect key={j} x={j * 27 + i % 2 * 6} y={44 + i * 25} width="9" height="5" fill={j % 3 ? '#50405f' : '#826090'} />)}</g>)}
      <path d="M32 11H158V19H32ZM482 11H608V19H482Z" fill="#d7c0ff" />
      <path className="scene-light" d="M36 20H154L290 222H102ZM486 20H604L538 222H350Z" fill="#a988ff" opacity=".1" />
      <path d="M246 8H394V95H246Z" fill="#0a0c17" stroke="#8a68b1" strokeWidth="3" />
      <path d="M264 25H376V70H264Z" fill="#37223a" /><path d="M290 39L307 53L320 33L333 53L350 39L343 65H297Z" fill="#edbb69" />
      <path d="M314 96H326V160M282 147H358V170H282ZM300 164H340V177H300Z" fill="none" stroke="#88729c" strokeWidth="4" />
      <path d="M312 177H328L335 190H305Z" fill="none" stroke="#d78b5a" strokeWidth="3" />
      <path d="M75 201H565L609 250H31ZM320 201V250M248 224H392" stroke="#a383bd" fill="none" opacity=".6" />
      <ellipse cx="320" cy="226" rx="46" ry="18" fill="none" stroke="#a383bd" />
    </> : locker ? <>
      {[30, 125, 220, 325, 420, 515].map((x, i) => <g key={x}>
        <rect x={x} y="22" width="83" height="164" fill="#263d49" stroke="#497181" strokeWidth="3" />
        <path d={`M${x + 7} 29H${x + 76}V145H${x + 7}Z`} fill="#0c1822" />
        <path d={`M${x + 13} 37H${x + 70}M${x + 10} 153H${x + 73}`} stroke="#738d92" strokeWidth="3" />
        <path d={`M${x + 34} 48H${x + 49}L${x + 65} 59L${x + 57} 76L${x + 53} 72V114H${x + 29}V72L${x + 25} 76L${x + 17} 59Z`} fill={i % 2 ? '#e8ba69' : '#5691a6'} />
        <path d={`M${x + 37} 77H${x + 45}V96H${x + 37}Z`} fill="none" stroke="#172936" strokeWidth="3" />
        <rect x={x + 10} y="165" width="20" height="8" fill="#c2b8a0" /><rect x={x + 42} y="164" width="24" height="10" fill="#161c26" />
      </g>)}
      <path d="M60 201H580V214H60ZM80 214H90V239H80ZM550 214H560V239H550Z" fill="#916546" /><path d="M60 201H580" stroke="#ce9867" strokeWidth="4" />
      <path className="scene-light" d="M220 0H420L515 200H125Z" fill="#bdeaff" opacity=".055" />
      <path d="M230 9H410V14H230Z" fill="#c4e0d9" />
      <circle cx="476" cy="224" r="13" fill="#b36b3f" /><path d="M463 224H489M476 211V237" stroke="#50372c" strokeWidth="2" />
    </> : <>
      <path d="M0 21H132V40H148V103H95V147H0ZM513 0H640V149H556V76H513Z" fill="#3b2a28" />
      <path d="M0 60H87M0 84H115M554 49H640M572 112H640" stroke="#5b3730" strokeWidth="3" />
      <path d="M110 0L148 39L133 53L168 89L150 134M553 0L519 35L540 75L514 103" fill="none" stroke="#070d17" strokeWidth="6" />
      <path d="M314 18H326V160M278 55H362V101H278ZM300 78H340V98H300Z" fill="none" stroke="#645957" strokeWidth="5" />
      <path d="M304 106H339L331 114H300ZM303 116L306 129M326 116L322 123" fill="none" stroke="#c56a44" strokeWidth="3" />
      <path d="M82 203H556L617 250H26ZM320 204V250" stroke="#b48c6c" opacity=".5" fill="none" /><ellipse cx="320" cy="227" rx="45" ry="17" fill="none" stroke="#b48c6c" opacity=".5" />
      <path d="M97 188L162 207L143 218L228 236L208 260M507 180L463 205L492 215L402 260" fill="none" stroke="#17171b" strokeWidth="5" /><path d="M97 188L162 207L143 218L228 236M507 180L463 205L492 215" fill="none" stroke="#b55230" opacity=".6" />
      {[25, 71, 143, 489, 568, 611].map((x, i) => <g key={x} className="scene-ember" style={{ animationDelay: `${i * -.7}s` }}><rect x={x} y={156 - i % 3 * 19} width="3" height="5" fill="#f89749" /><rect x={x + 7} y={174 - i % 2 * 23} width="2" height="2" fill="#ffd38a" /></g>)}
      <path d="M0 192L22 181L58 194L86 189L106 203H0ZM533 199L556 186L581 193L600 178L640 191V205H533Z" fill="#533027" />
    </>}
    <path d="M0 0H640V6H0ZM0 255H640V260H0Z" fill="#090e17" opacity=".6" />
  </svg>;
});

export function ModeBackdrop({ mode }: { mode: SceneMode }) {
  return <div className={`mode-room room-${mode}`} aria-hidden="true"><ModeScene mode={mode} fit="meet" /><span>{SCENE_NAMES[mode]}</span></div>;
}
