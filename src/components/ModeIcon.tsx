import { memo, type CSSProperties } from 'react';
import './modeIcons.css';

/** Layered, code-native pixel art. Shared motifs keep related submodes recognizable. */
type Motif = 'arena' | 'trophy' | 'score' | 'jersey' | 'shield' | 'book' | 'calendar' | 'crown' | 'hammer' | 'cards' | 'clock' | 'globe' | 'grid' | 'mystery' | 'chart' | 'bracket' | 'quiz' | 'team' | 'swords' | 'podium' | 'network' | 'heart' | 'wheel' | 'slots' | 'tools' | 'infinity' | 'bolt' | 'hoop' | 'flask';
type Tone = 'orange' | 'gold' | 'blue' | 'green' | 'red' | 'purple' | 'cyan' | 'pink';
type IconSpec = { motif: Motif; tone: Tone; mark?: string };
const spec = (motif: Motif, tone: Tone, mark?: string): IconSpec => ({ motif, tone, mark });
const MODE_ICON_ART: Record<string, IconSpec> = {
  franchise: spec('arena', 'orange'), legends: spec('trophy', 'gold'), perfect: spec('score', 'orange'),
  career: spec('jersey', 'green'), survival: spec('shield', 'red'), story: spec('book', 'purple'),
  decade: spec('calendar', 'gold', '10'), dynasty: spec('crown', 'gold'), rebuild: spec('hammer', 'green'),
  draft: spec('cards', 'blue'), timeMachine: spec('clock', 'purple'), worldgames: spec('globe', 'cyan'),
  category: spec('grid', 'blue'), grid: spec('grid', 'green'), guess: spec('mystery', 'blue'), hilo: spec('chart', 'purple'), categorize: spec('grid', 'purple', '4'), guessTeam: spec('team', 'orange'),
  bracket: spec('bracket', 'gold'), quiz: spec('quiz', 'cyan'), legendsT: spec('crown', 'orange'), street: spec('hoop', 'orange'), oneOnOne: spec('swords', 'red'),
  tour: spec('swords', 'gold'), ranked: spec('podium', 'gold'), clubs: spec('team', 'green'), online: spec('network', 'blue'), friends: spec('heart', 'pink'),
  'league-history': spec('arena', 'blue'), 'league-random': spec('wheel', 'green'), 'league-world': spec('globe', 'orange'),
  'world-euro': spec('globe', 'blue', 'EU'), 'world-china': spec('globe', 'red', 'CN'), 'world-georgia': spec('globe', 'red', 'GE'), 'world-college': spec('jersey', 'blue', 'NC'),
  'hunt-hunt': spec('trophy', 'gold'), 'hunt-weekly': spec('calendar', 'gold', '7'), 'hunt-daily': spec('calendar', 'orange', '1'),
  'hunt-legend': spec('crown', 'red'), 'hunt-album': spec('cards', 'purple'), 'hunt-dream': spec('swords', 'cyan'),
  'deck-classic': spec('cards', 'gold'), 'deck-bigMen': spec('hoop', 'red'), 'deck-oldSchool': spec('book', 'orange'),
  'deck-paceSpace': spec('bolt', 'cyan'), 'deck-dynasty': spec('crown', 'gold'), 'deck-category': spec('grid', 'blue'),
  'perfect-quick': spec('wheel', 'orange'), 'perfect-franchise': spec('arena', 'blue'), 'perfect-category': spec('grid', 'gold'),
  'perfect-slots': spec('slots', 'purple'), 'perfect-weekly': spec('calendar', 'gold', '7'), 'perfect-rule': spec('bolt', 'cyan'),
  'perfect-custom': spec('tools', 'green'), 'perfect-battle': spec('swords', 'red'), 'perfect-daily': spec('calendar', 'blue', '1'),
  'career-wheel': spec('wheel', 'green'), 'career-sandbox': spec('infinity', 'purple'), 'career-myplayer': spec('jersey', 'blue'),
  'career-weekly': spec('calendar', 'green', '7'), 'survival-daily': spec('shield', 'purple', '1'),
  'games-real': spec('globe', 'cyan'), 'games-fantasy': spec('globe', 'gold'),
  'battle-rookie': spec('team', 'green'), 'battle-pro': spec('swords', 'blue'), 'battle-legend': spec('crown', 'gold'), 'battle-friend': spec('heart', 'pink'),
  'legend-jazz98': spec('trophy', 'purple'), 'legend-stop73': spec('shield', 'gold'), 'legend-sonics96': spec('crown', 'green'), 'legend-spurs13': spec('swords', 'red'),
  'legend-pistons04': spec('hammer', 'blue'), 'legend-believe07': spec('bolt', 'orange'), 'legend-showtime84': spec('arena', 'gold'), 'legend-knicks94': spec('hoop', 'blue'),
  'story-scorer': spec('bolt', 'orange'), 'story-playmaker': spec('network', 'blue'), 'story-wing': spec('shield', 'green'), 'story-big': spec('hoop', 'red'),
  'arcade-daily': spec('calendar', 'blue', '1'), 'arcade-weekly': spec('calendar', 'gold', '7'), 'arcade-endless': spec('infinity', 'purple'), 'arcade-random': spec('wheel', 'green'),
  'whatif-prime': spec('bolt', 'gold'), 'whatif-rookies': spec('jersey', 'green'), 'whatif-travel': spec('clock', 'purple'),
  'whatif-super': spec('crown', 'gold'), 'whatif-legends': spec('arena', 'blue'), 'whatif-star': spec('team', 'cyan'),
  'whatif-create': spec('flask', 'cyan'), 'whatif-chaos': spec('flask', 'red'),
};
const PALETTES: Record<Tone, [string, string, string, string]> = {
  orange: ['#ff9c43', '#ffe0a0', '#a84320', '#241c21'], gold: ['#f9c74f', '#fff2bc', '#9b671e', '#25211d'],
  blue: ['#5bafff', '#cef0ff', '#285caa', '#15253d'], green: ['#6ddd9b', '#dcffd1', '#25775a', '#142e29'],
  red: ['#ff7169', '#ffddb2', '#a93240', '#341b28'], purple: ['#bc94ff', '#f1dcff', '#6741aa', '#251e3e'],
  cyan: ['#65dedc', '#d1ffff', '#258795', '#123039'], pink: ['#ff8dbb', '#ffe1ee', '#a04473', '#321e32'],
};
const INK = '#0b1120';
const DIGITS: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '111', '001', '111'],
  '7': ['111', '001', '010', '010', '010'], '8': ['111', '101', '111', '101', '111'], '-': ['000', '000', '111', '000', '000'],
};
function Digits({ value, x, y, unit = 1, fill = 'var(--mi-light)' }: { value: string; x: number; y: number; unit?: number; fill?: string }) {
  return <g fill={fill}>{[...value].flatMap((d, i) => (DIGITS[d] ?? DIGITS['0']).flatMap((row, yy) => [...row].map((v, xx) => v === '1' ? <rect key={`${i}-${yy}-${xx}`} x={x + (i * 4 + xx) * unit} y={y + yy * unit} width={unit} height={unit} /> : null)))}</g>;
}
function Star({ x = 32, y = 29, scale = 1 }: { x?: number; y?: number; scale?: number }) {
  return <path transform={`translate(${x} ${y}) scale(${scale})`} d="M-2-8H2V-3H7V1H4V6H0V4H-4V6H-7V1H-4V-3H-2Z" fill="var(--mi-light)" />;
}
function Ball({ x = 32, y = 32, scale = 1 }: { x?: number; y?: number; scale?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <path d="M-5-10H5V-8H8V-5H10V5H8V8H5V10H-5V8H-8V5H-10V-5H-8V-8H-5Z" fill={INK} />
    <path d="M-4-8H4V-6H7V-3H8V4H6V7H3V8H-4V6H-7V3H-8V-4H-6V-6H-4Z" fill="#ef913b" />
    <path d="M-4-7H2V-5H-3V-3H-6V-5H-4Z" fill="#ffdc89" />
    <path d="M-1-8H1V8H-1ZM-8-1H8V1H-8ZM-6-6H-4V-3H-3V3H-4V6H-6V4H-5V-4H-6ZM4-6H6V-4H5V4H6V6H4V3H3V-3H4Z" fill="#713626" />
  </g>;
}
function Jersey() {
  return <><path d="M22 15H28V19H36V15H42L50 25L43 31V49H21V31L14 25Z" fill="var(--mi-dark)" stroke={INK} strokeWidth="2" />
    <path d="M22 16H27V22H37V16H41L46 25L40 28V45H23V28L18 25Z" fill="var(--mi-color)" />
    <path d="M25 17V23H39M23 43H40" fill="none" stroke="var(--mi-light)" strokeWidth="2" />
    <Digits value="30" x={25} y={28} unit={2} /></>;
}
function MotifArt({ motif, mark }: Pick<IconSpec, 'motif' | 'mark'>) {
  switch (motif) {
    case 'arena': return <><path d="M10 30V20H15V16H49V20H54V45H10Z" fill="var(--mi-dark)" stroke={INK} strokeWidth="2" /><path d="M14 21H50V29H14Z" fill="var(--mi-color)" /><path d="M18 17H46V21H18Z" fill="var(--mi-light)" /><path d="M15 25H19M23 25H27M31 25H35M39 25H43M47 25H50" stroke={INK} strokeWidth="2" /><path d="M12 34H52V48H12Z" fill="#bc7b45" /><path d="M14 36H50V46H14ZM32 36V46M14 39H20V43H14M50 39H44V43H50" fill="none" stroke="#ffe3ae" strokeWidth="1" /><g className="mi-detail"><Ball x={33} y={32} scale={1.1} /></g></>;
    case 'trophy': return <><path d="M19 20H12V28L19 35H24M45 20H52V28L45 35H40" fill="none" stroke="var(--mi-dark)" strokeWidth="5" /><path d="M19 18H12V26L19 32H24M45 18H52V26L45 32H40" fill="none" stroke="var(--mi-color)" strokeWidth="3" /><path d="M21 14H43V30L38 37H35V44H44V50H20V44H29V37H26L21 30Z" fill="var(--mi-dark)" stroke={INK} strokeWidth="2" /><path d="M22 15H42V29L36 35H28L22 29Z" fill="var(--mi-color)" /><path d="M24 17H28V28H30V32H27L24 28Z" fill="var(--mi-light)" /><path d="M31 36H34V44H31M23 45H41V47H23" fill="var(--mi-light)" /><Star x={34} y={24} scale={.65} /><rect x="27" y="49" width="10" height="2" fill="var(--mi-color)" /></>;
    case 'score': return <><path className="mi-flare" d="M13 24V17L20 22V10L27 18L33 8L38 19L45 12V23L52 18V31Z" fill="var(--mi-dark)" /><path d="M10 24H54V45H10Z" fill={INK} stroke="var(--mi-color)" strokeWidth="2" /><path d="M14 28H50V40H14Z" fill="var(--mi-deep)" /><Digits value="82-0" x={17} y={29} unit={2} /><path d="M17 46H47V49H17Z" fill="var(--mi-dark)" /><path d="M18 43H25M28 43H35M38 43H45" stroke="var(--mi-color)" strokeWidth="1" /><Star x={33} y={17} scale={.65} /></>;
    case 'jersey': return <><Jersey /><g className="mi-detail"><Star x={47} y={17} scale={.65} /></g></>;
    case 'shield': return <><path className="mi-flare" d="M12 36L10 25L17 29L15 15L23 21L29 9L34 19L44 11L43 25L52 19L50 36Z" fill="var(--mi-dark)" /><path d="M17 22L32 16L47 22V38L42 45L32 53L22 45L17 38Z" fill="var(--mi-dark)" stroke={INK} strokeWidth="2" /><path d="M20 24L32 19L44 24V37L39 43L32 48L25 43L20 37Z" fill="var(--mi-color)" /><path d="M23 26L31 23V43L27 39L23 35Z" fill="var(--mi-light)" opacity=".65" /><path d="M35 25L28 34H33L29 43L40 31H35Z" fill={INK} />{mark && <Digits value={mark} x={44} y={43} unit={2} />}</>;
    case 'book': return <><path d="M10 20L28 18L32 22L36 18L54 20V47L35 45L32 48L29 45L10 47Z" fill="var(--mi-dark)" stroke={INK} strokeWidth="2" /><path d="M13 17H26L31 21V42L26 39H13ZM33 21L38 17H51V39H38L33 42Z" fill="#efdcb2" /><path d="M16 24H25M16 28H25M16 32H23M38 25H48M38 29H46" stroke="#927d6e" strokeWidth="2" /><path d="M38 16V32L41 29L44 32V16Z" fill="var(--mi-color)" /><g className="mi-detail"><Star x={47} y={40} scale={.8} /></g></>;
    case 'calendar': return <><path d="M14 17H50V49H14Z" fill="var(--mi-dark)" stroke={INK} strokeWidth="2" /><path d="M17 20H47V45H17Z" fill="#eee0c0" /><path d="M16 20H48V28H16Z" fill="var(--mi-color)" /><path d="M23 13V23M41 13V23" stroke={INK} strokeWidth="4" /><path d="M23 14V21M41 14V21" stroke="var(--mi-light)" strokeWidth="2" /><Digits value={mark ?? '7'} x={mark?.length === 2 ? 25 : 29} y={31} unit={2} fill="var(--mi-dark)" /><path d="M43 41H49V47H43Z" fill="var(--mi-color)" /></>;
    case 'crown': return <><path d="M12 23L23 29L32 15L41 29L52 23L46 46H18Z" fill="var(--mi-dark)" stroke={INK} strokeWidth="2" /><path d="M15 25L25 32L32 21L39 32L49 25L44 41H20Z" fill="var(--mi-color)" /><path d="M19 43H45V46H19M21 34L24 36V40H21" fill="var(--mi-light)" /><path d="M29 32H35V38H29Z" fill="#e87863" /><g className="mi-detail"><Star x={32} y={12} scale={.45} /></g><rect x="13" y="20" width="3" height="3" fill="var(--mi-light)" /><rect x="49" y="20" width="3" height="3" fill="var(--mi-light)" /></>;
    case 'hammer': return <><path d="M12 45H25V51H12M29 37H42V43H29M29 45H48V51H29" fill="var(--mi-dark)" /><path d="M12 43H25V47H12M29 35H42V39H29M29 43H48V47H29" fill="var(--mi-color)" /><g className="mi-detail"><path d="M22 43L40 19L35 15L17 39Z" fill="#c89660" stroke={INK} strokeWidth="2" /><path d="M26 15L33 9L48 22L41 30Z" fill="#739aab" stroke={INK} strokeWidth="2" /><path d="M29 15L33 12L45 22L42 25Z" fill="#d7f2f5" /></g></>;
    case 'cards': return <><path d="M13 15H37V43H13Z" fill="var(--mi-dark)" stroke={INK} strokeWidth="2" transform="rotate(-12 25 30)" /><path d="M27 18H51V46H27Z" fill="var(--mi-dark)" stroke={INK} strokeWidth="2" transform="rotate(12 39 32)" /><path d="M20 16H44V50H20Z" fill="var(--mi-color)" stroke={INK} strokeWidth="2" /><path d="M23 19H41V38H23Z" fill="var(--mi-deep)" /><path d="M29 23H35V30H29M26 31H38V36H26" fill="var(--mi-light)" /><path d="M25 42H39M25 46H34" stroke="var(--mi-light)" strokeWidth="2" /></>;
    case 'clock': return <><path d="M23 12H41V16H47V22H51V40H47V46H41V50H23V46H17V40H13V22H17V16H23Z" fill="var(--mi-dark)" stroke={INK} strokeWidth="2" /><path d="M24 17H40V21H44V25H47V37H43V42H39V45H25V42H21V38H18V25H21V21H24Z" fill="var(--mi-deep)" stroke="var(--mi-color)" strokeWidth="2" /><path d="M32 20V24M21 31H25M40 31H44M32 39V43" stroke="var(--mi-light)" strokeWidth="2" /><g className="mi-clock-hand"><path d="M31 24H33V30H39V33H31Z" fill="var(--mi-light)" /></g><rect x="30" y="29" width="4" height="4" fill="var(--mi-color)" /></>;
    case 'globe': return <><path d="M24 12H40V16H47V23H51V39H47V46H40V50H24V46H17V39H13V23H17V16H24Z" fill="var(--mi-dark)" stroke={INK} strokeWidth="2" /><path d="M25 15H39V19H45V24H48V37H44V43H38V47H25V43H19V37H16V25H20V19H25Z" fill="var(--mi-color)" /><path d="M26 16H34V21H29V26H22V31H17V25H21V20H26M37 29H44V35H40V41H35V36H31V31H37M25 39H29V45H25" fill="var(--mi-light)" /><path d="M15 31H49M32 14V48" stroke="var(--mi-deep)" strokeWidth="1" opacity=".45" /><path d="M10 37V43H16M48 18H54V24" fill="none" stroke="var(--mi-light)" strokeWidth="2" /></>;
    case 'grid': return <><path d="M13 13H51V51H13Z" fill="var(--mi-dark)" stroke={INK} strokeWidth="2" />{Array.from({ length: 9 }, (_, i) => <rect key={i} x={17 + i % 3 * 11} y={17 + Math.floor(i / 3) * 11} width="8" height="8" fill={i === 4 ? 'var(--mi-light)' : i % 2 ? 'var(--mi-deep)' : 'var(--mi-color)'} />)}<path className="mi-detail" d="M26 33L31 38L40 26" stroke="var(--mi-light)" strokeWidth="3" fill="none" /></>;
    case 'mystery': return <><path d="M21 12H43V37H38V41H47V50H17V41H26V37H21Z" fill="var(--mi-dark)" stroke={INK} strokeWidth="2" /><path d="M24 15H40V31H24M21 43H43V48H21" fill="var(--mi-color)" /><path d="M27 21V18H37V25H33V30H30V23H34V21ZM30 33H33V36H30Z" fill="var(--mi-light)" /><path d="M12 20V13H19M45 13H52V20M12 44V51H19M45 51H52V44" stroke="var(--mi-light)" strokeWidth="2" fill="none" /></>;
    case 'quiz': return <><path d="M18 14H46V50H18Z" fill="var(--mi-dark)" stroke={INK} strokeWidth="2" /><path d="M21 17H43V46H21Z" fill="#eee0c0" /><path d="M25 12H39V19H25Z" fill="var(--mi-color)" /><path d="M25 27H29M33 27H39M25 35H29M33 35H39" stroke="var(--mi-dark)" strokeWidth="2" /><path className="mi-detail" d="M30 42L35 47L47 33" stroke="var(--mi-color)" strokeWidth="4" fill="none" /></>;
    case 'chart': return <><path d="M13 45H23V51H13M27 36H37V51H27M41 28H51V51H41" fill="var(--mi-dark)" /><path d="M14 39H22V47H14M28 31H36V47H28M42 23H50V47H42" fill="var(--mi-color)" /><path className="mi-detail" d="M13 32L29 18L36 24L49 11M39 11H49V21" stroke="var(--mi-light)" strokeWidth="3" fill="none" /></>;
    case 'bracket': return <><path d="M15 16H24V28H31M15 43H24V35H31M49 16H40V28H33M49 43H40V35H33" stroke="var(--mi-color)" strokeWidth="3" fill="none" /><path d="M10 12H18V20H10M46 12H54V20H46M10 39H18V47H10M46 39H54V47H46" fill="var(--mi-dark)" stroke="var(--mi-light)" strokeWidth="2" /><Star x={32} y={32} /></>;
    case 'team': return <><path d="M12 22H23V33H12M41 22H52V33H41M9 36H25V46H9M39 36H55V46H39" fill="var(--mi-dark)" stroke={INK} strokeWidth="2" /><path d="M26 14H38V29H26M21 33H43V49H21Z" fill="var(--mi-color)" stroke={INK} strokeWidth="2" /><path d="M29 17H35V21H29M24 35H28V46H24" fill="var(--mi-light)" /><Star x={34} y={39} scale={.5} /></>;
    case 'swords': return <><path d="M17 13H24L46 40L40 46L17 20ZM47 13H40L18 40L24 46L47 20Z" fill="var(--mi-color)" stroke={INK} strokeWidth="2" /><path d="M20 15L40 38M44 15L25 38" stroke="var(--mi-light)" strokeWidth="2" /><path d="M35 43L43 35M21 35L29 43" stroke="var(--mi-dark)" strokeWidth="5" /><path d="M39 44L47 52M25 44L17 52" stroke="var(--mi-color)" strokeWidth="4" /><Star x={32} y={29} scale={.4} /></>;
    case 'podium': return <><path d="M11 35H24V51H11M25 26H39V51H25M40 40H53V51H40" fill="var(--mi-dark)" stroke={INK} strokeWidth="2" /><path d="M11 34H24V38H11M25 25H39V29H25M40 39H53V43H40" fill="var(--mi-color)" /><Digits value="1" x={29} y={34} unit={2} /><Star x={32} y={17} scale={.8} /></>;
    case 'network': return <><path d="M18 20L32 34L46 20M32 34V48M18 48L32 34L46 48" fill="none" stroke="var(--mi-dark)" strokeWidth="3" />{[[18, 19], [46, 19], [18, 47], [46, 47]].map(([x, y]) => <rect key={`${x}-${y}`} x={x - 5} y={y - 5} width="10" height="8" fill="var(--mi-color)" stroke={INK} strokeWidth="2" />)}<Ball x={32} y={32} scale={.8} /></>;
    case 'heart': return <><path d="M12 21L18 15H26L32 22L38 15H46L52 21V32L32 51L12 32Z" fill="var(--mi-dark)" stroke={INK} strokeWidth="2" /><path d="M15 22L19 18H25L32 26L39 18H45L49 22V31L32 46L15 31Z" fill="var(--mi-color)" /><path d="M19 21H24V24H20V29H17V24H19" fill="var(--mi-light)" /><path className="mi-detail" d="M20 34H26L29 29L33 38L37 32H45" stroke="var(--mi-light)" strokeWidth="2" fill="none" /></>;
    case 'wheel': return <><g className="mi-wheel"><path d="M24 12H40V16H47V23H51V39H47V46H40V50H24V46H17V39H13V23H17V16H24Z" fill="var(--mi-dark)" stroke={INK} strokeWidth="2" /><path d="M32 16V31H18V24H22V20H26V16ZM32 31H47V38H43V43H38V47H32Z" fill="var(--mi-color)" /><path d="M33 16H39V20H44V25H47V30H33ZM18 32H31V47H25V43H21V38H18Z" fill="var(--mi-light)" /><path d="M23 22L42 41M23 41L42 22" stroke="var(--mi-deep)" strokeWidth="2" /><Ball x={32} y={31} scale={.55} /></g><path d="M28 9H36L32 18Z" fill="#ffdf88" stroke={INK} strokeWidth="1" /></>;
    case 'slots': return <><path d="M11 20H49V46H11Z" fill="var(--mi-dark)" stroke={INK} strokeWidth="2" /><path d="M14 23H46V39H14Z" fill={INK} />{[16, 26, 36].map((x, i) => <g key={x}><rect x={x} y="25" width="8" height="12" fill="#efe1c9" /><g className={i === 1 ? 'mi-detail' : undefined}><Star x={x + 4} y={31} scale={.35} /></g></g>)}<path d="M16 42H34M50 35H54V20" stroke="var(--mi-color)" strokeWidth="3" /><rect x="51" y="14" width="6" height="6" fill="var(--mi-light)" /></>;
    case 'tools': return <><path d="M15 18H49V46H15Z" fill="var(--mi-dark)" stroke={INK} strokeWidth="2" /><path d="M22 24V40M32 24V40M42 24V40" stroke="var(--mi-light)" strokeWidth="2" /><path d="M18 26H26V31H18M28 34H36V39H28M38 23H46V28H38" fill="var(--mi-color)" /><path d="M20 15H44M20 49H44" stroke="var(--mi-color)" strokeWidth="2" /></>;
    case 'infinity': return <><path d="M30 27L22 20H15L9 26V38L15 44H22L42 24H48L51 28V35L47 39H42L23 20H15" fill="none" stroke={INK} strokeWidth="10" /><path d="M31 27L22 21H16L12 26V37L16 41H22L42 22H48L53 27V37L48 42H42L23 23" fill="none" stroke="var(--mi-color)" strokeWidth="6" /><path d="M15 28V35M43 25H47L50 28M25 36L36 25" fill="none" stroke="var(--mi-light)" strokeWidth="2" /><Star x={47} y={13} scale={.45} /></>;
    case 'bolt': return <><path d="M32 11H46L36 28H46L25 54L28 36H18Z" fill="var(--mi-dark)" stroke={INK} strokeWidth="2" /><path d="M32 13H41L31 30H40L29 44L32 33H23Z" fill="var(--mi-color)" /><path d="M33 15H37L29 29H26Z" fill="var(--mi-light)" /><path className="mi-detail" d="M12 26H20M11 33H16M42 41H52M46 34H55" stroke="var(--mi-color)" strokeWidth="2" /></>;
    case 'hoop': return <><path d="M31 17H35V50H31" fill="var(--mi-dark)" /><path d="M12 13H52V34H12Z" fill="var(--mi-color)" stroke={INK} strokeWidth="2" /><path d="M16 17H48V30H16Z" fill="var(--mi-deep)" /><path d="M25 23H40V32H25" stroke="var(--mi-light)" fill="none" strokeWidth="2" /><path d="M25 34L28 47H39L43 34M26 39H42M28 44H39M30 34L34 46L39 34" stroke="#e9ddc8" fill="none" strokeWidth="1" /><path d="M23 33H45" stroke="#f68b48" strokeWidth="3" /><g className="mi-detail"><Ball x={21} y={17} scale={.7} /></g></>;
    case 'flask': return <><path d="M25 12H39V17H37V28L49 43V50H15V43L27 28V17H25Z" fill="var(--mi-dark)" stroke={INK} strokeWidth="2" /><path d="M30 18H34V30L45 44V46H19V44L30 30Z" fill="var(--mi-color)" /><path d="M30 18H32V31L23 42" stroke="var(--mi-light)" fill="none" strokeWidth="2" /><path className="mi-detail" d="M29 37H33V41H29M36 42H39V45H36M42 20H46V24H42M19 25H22V28H19" fill="var(--mi-light)" /></>;
  }
}

/** SVG content also used inside the panoramic main-menu artwork. No ids or external assets. */
export function ModeEmblem({ mode, fallback = 'franchise' }: { mode: string; fallback?: string }) {
  const entry = MODE_ICON_ART[mode] ?? MODE_ICON_ART[fallback] ?? MODE_ICON_ART.franchise;
  const [color, light, dark, deep] = PALETTES[entry.tone];
  return <g className={`mi-emblem mi-${entry.motif}`} style={{ '--mi-color': color, '--mi-light': light, '--mi-dark': dark, '--mi-deep': deep } as CSSProperties}>
    <path className="mi-halo" d="M20 5H44V9H53V18H57V46H53V55H44V59H20V55H11V46H7V18H11V9H20Z" fill={color} opacity=".12" />
    <path d="M16 8H48V12H54V52H48V56H16V52H10V12H16Z" fill={INK} />
    <path d="M17 10H47V14H52V50H47V54H17V50H12V14H17Z" fill={deep} />
    <path d="M18 11H46M13 16V26M51 40V49H46M18 53H29" fill="none" stroke={dark} strokeWidth="1" />
    <path d="M16 14H22M16 14V20M48 44V50H42" stroke={color} strokeWidth="1" fill="none" opacity=".75" />
    <g className="mi-object"><MotifArt {...entry} /></g>
    <g className="mi-spark"><path d="M49 7V13M46 10H52" stroke={light} strokeWidth="2" /><rect x="9" y="43" width="2" height="2" fill={color} /></g>
    <g className="mi-spark mi-spark-late"><path d="M15 47V53M12 50H18" stroke={light} strokeWidth="1" /><rect x="52" y="22" width="2" height="2" fill={color} /></g>
  </g>;
}

/** Decorative: the adjacent button title remains its accessible name. */
export const ModeIcon = memo(function ModeIcon({ mode, size = 48, fallback, className = '' }: { mode: string; size?: number; fallback?: string; className?: string }) {
  return <svg className={`mode-icon ${className}`} data-mode-icon={mode} width={size} height={size} viewBox="0 0 64 64" shapeRendering="crispEdges" aria-hidden="true" focusable="false"><ModeEmblem mode={mode} fallback={fallback} /></svg>;
});
