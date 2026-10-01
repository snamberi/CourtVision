import { useId } from 'react';
import { MARKS } from '../visuals/logoMarks';
import type { TeamIdentity } from '../simulation/teamIdentity';

const DETAILS: Partial<Record<TeamIdentity['logo'], string>> = {
  bolt: 'M23 11H29L20 25H17ZM28 26H31L24 35Z',
  crown: 'M13 28H37V30H13ZM16 32H18V34H16ZM24 28H26V33H24ZM32 32H34V34H32Z',
  mountain: 'M20 17L24 24H20L18 26L16 24ZM32 21L37 29H32L30 27Z',
  wings: 'M8 19H18V21H8ZM32 19H42V21H32ZM14 34H22V35H14ZM28 34H36V35H28Z',
  star: 'M25 14L27 23H36L29 26L25 25L22 30L23 23H17L23 21Z',
  tower: 'M14 21H36V23H14ZM19 26H23V28H19ZM28 26H31V28H28ZM18 33H21V35H18ZM29 33H32V35H29Z',
  flame: 'M24 16H27V21H24V24H21V30H19V24H21V20H24Z',
  wave: 'M10 33H40V35H10ZM19 27H24V29H19ZM33 27H38V29H33Z',
  anchor: 'M24 19H25V33H24ZM16 34H21V36H16ZM29 34H34V36H29Z',
  paw: 'M12 17H14V20H12ZM20 13H22V16H20ZM28 13H30V16H28ZM36 17H38V20H36ZM18 27H30V29H18Z',
  horns: 'M18 23H32V25H18ZM21 33H29V35H21Z',
  tree: 'M24 12H26V16H24ZM21 21H28V23H21ZM17 29H31V31H17Z',
  comet: 'M29 14H34V16H29ZM28 16H30V20H28ZM10 16H21V17H10ZM17 26H24V27H17Z',
  shield: 'M13 12H21V14H15V19H13ZM29 12H37V18H35V14H29ZM17 28H19V31H17ZM30 32H32V34H30Z',
  hammer: 'M14 12H30V14H14ZM22 21H24V36H22ZM33 13H36V14H33Z',
  feather: 'M33 11H37V13H33ZM27 23H33V25H27ZM24 28H28V30H24Z',
  sun: 'M21 18H27V20H21ZM20 20H22V25H20ZM24 9H26V11H24Z',
  ball: 'M19 12H23V14H19ZM15 18H17V22H15ZM28 28H30V32H28Z',
  fang: 'M12 13H38V15H12ZM17 19H19V25H17ZM31 19H33V25H31Z',
};

/** Faceted enamel and engraved details inside each original team mark. */
export function TeamMark({ logo, fill = '#f3e7ca', accent = '#f47b20' }: { logo: TeamIdentity['logo']; fill?: string; accent?: string }) {
  const id = useId();
  const d = MARKS[logo] ?? MARKS.star;
  return <g>
    <defs><clipPath id={id}><path d={d} fillRule="evenodd" clipRule="evenodd" /></clipPath></defs>
    <path d={d} fill={fill} fillRule="evenodd" stroke="#0b1018" strokeWidth=".8" paintOrder="stroke" />
    <g clipPath={`url(#${id})`}>
      <path d="M4 8H46V11H4ZM4 11H46V13H4Z" fill="#fff" opacity=".32" />
      <path d="M28 9H44V44H20V38H25V32H28Z" fill="#0b1018" opacity=".16" />
      <path d="M5 37H44V39H5ZM5 41H44V43H5Z" fill="#0b1018" opacity=".24" />
      {DETAILS[logo] && <><path d={DETAILS[logo]} fill="#0b1018" opacity=".32" transform="translate(0,1)" /><path d={DETAILS[logo]} fill={accent} /></>}
      <path d="M12 11H14V13H12ZM16 15H18V16H16ZM25 12H27V13H25" fill="#fff" opacity=".5" />
    </g>
  </g>;
}
