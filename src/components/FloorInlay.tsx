/** Fine surface detail shared by the floor picker and live court. No per-frame work or animation. */
export function FloorInlay({ material }: { material: string }) {
  switch(material){
    case 'planks': case 'blonde': case 'midnight': case 'cherry': case 'ebony': case 'gold': return <g shapeRendering="crispEdges">
      <path d="M5 2H19M35 3H69M89 1H109M10 8H29M46 7H84M99 9H117" stroke={material==='gold'?'#fff3bf':'#fff0cb'} strokeWidth=".5" opacity=".3" />
      <path d="M9 3H16M41 4H64M80 1H94M14 9H23M50 8H69M90 7H111" stroke="#26170f" strokeWidth=".5" opacity=".24" />
      <path d="M23 0V5M82 5V10" stroke="#321d13" strokeWidth=".5" opacity=".28" />
      <path d="M68 2h4v1h-4ZM36 7h3v1h-3Z" fill="#5c3922" opacity=".2" />
    </g>;
    case 'parquet': return <g fill="none" strokeWidth=".6"><path d="M3 2V20M12 5V22M18 1V17M27 3H45M25 12H43M29 19H47M3 29H21M0 37H19M4 44H22M28 28V44M36 25V46M44 30V45" stroke="#efc58e" opacity=".45" /><path d="M5 3V14M20 8V18M30 6H42M25 15H38M5 32H18M1 39H15M31 30V39M40 26V40" stroke="#5c331d" opacity=".25" /></g>;
    case 'asphalt': return <g fill="none"><path d="M0 7L5 9L6 15L12 17L15 24M6 15L0 18M17 0L19 6L24 8" stroke="#282d35" strokeWidth=".7" opacity=".65" /><path d="M1 7L5 8M9 17L13 19" stroke="#7b8490" strokeWidth=".6" opacity=".5" /><path d="M3 2h1M15 12h1M21 22h1M12 5h1" stroke="#a2a9b2" strokeWidth=".6" opacity=".32" /></g>;
    case 'sand': return <g fill="none"><path d="M0 4Q6 1 12 4T24 4M0 13Q6 10 12 13T24 13M0 21Q6 18 12 21T24 21" stroke="#b99262" strokeWidth=".6" opacity=".3" /><path d="M2 5H7M15 14H20M4 22H9" stroke="#fff0c7" opacity=".5" /></g>;
    case 'retro': return <g fill="none"><path d="M1 1H39V39H1ZM20 0V40M0 20H40" stroke="#f1b474" strokeWidth=".6" opacity=".45" /><path d="M3 7H17M23 8H35M4 31H14M26 29H38M6 35H16M25 13H36" stroke="#43291b" strokeWidth=".6" opacity=".3" /></g>;
    case 'herringbone': return <g fill="none" strokeWidth=".6"><path d="M1 1L6 6M2 16L7 21M10 2L14 6M10 18L15 23M18 0L22 4M18 17L23 22M27 3L31 7M26 18L31 23" stroke="#f7d5a5" opacity=".6" /><path d="M2 11L6 7M10 27L14 23M18 12L22 8M26 27L30 23" stroke="#704626" opacity=".5" /></g>;
    case 'ice': return <g fill="none"><path d="M0 13L11 19L22 16L28 27L39 31L48 26M28 27L25 40L30 48M11 19L7 29L0 33M39 31L42 41" stroke="#6cabc8" strokeWidth=".7" opacity=".42" /><path d="M1 14L11 20L21 17L27 28L38 32M26 40L31 47M8 29L1 34" stroke="#ffffff" strokeWidth="1" opacity=".85" /><path d="M30 5H42M2 42H14M33 38H40" stroke="#a7d7ec" strokeWidth=".5" /></g>;
    case 'neon': return <g fill="none"><path d="M0 0H40V1H1V40H0Z" fill="#57c7dc" opacity=".4" /><path d="M0 5V0H5M35 40H40V35" stroke="#ef81dc" strokeWidth="1.5" /><path d="M17 20H23M20 17V23" stroke="#6ec3d7" strokeWidth=".6" opacity=".4" /><rect x="2" y="2" width="2" height="2" fill="#e2fcff" stroke="none" /></g>;
    case 'lava': return <g fill="none"><path d="M1 5L15 10L20 5L34 10L42 5L59 10M3 34L14 37L20 31L35 37L46 32L59 37" stroke="#64463c" strokeWidth="1" opacity=".55" /><path d="M0 21L14 27L22 19L36 29L60 23M11 60L19 45L30 51L44 41L52 49" stroke="#ffad53" strokeWidth=".5" /><path d="M22 19L25 9M36 29L40 37M18 44L8 39" stroke="#e45d30" strokeWidth=".7" /><path d="M6 12h3M29 3h4M47 57h4M50 14h2" stroke="#ac6442" strokeWidth="1" opacity=".5" /></g>;
    case 'galaxy': return <g><path d="M0 16L18 21L29 37L45 33L64 51L80 49V62L60 60L42 43L22 45L10 30L0 29Z" fill="#69458a" opacity=".25" /><path d="M0 24L21 32L30 43L48 41L66 55L80 55" stroke="#9974b4" strokeWidth="2" opacity=".13" fill="none" /><path d="M8 12L40 30L58 62L20 58" stroke="#8a91ce" strokeWidth=".5" opacity=".35" fill="none" /><path d="M65 5V11M63 8H69M18 58H22M20 56V60" stroke="#d3eaff" strokeWidth=".7" opacity=".7" /></g>;
    case 'celestial': return <g fill="none"><path d="M8 10L34 22L54 44L88 58L96 30" stroke="#4ba9dd" strokeWidth=".6" opacity=".4" /><path d="M0 100L12 94L22 99L34 87L46 96L58 83L70 94L82 82L94 91L106 78L120 87" stroke="#76c9f2" strokeWidth=".6" opacity=".8" /><path d="M8 7V13M5 10H11M85 58H91M88 55V61" stroke="#fff0c7" strokeWidth=".7" /></g>;
    default: return null;
  }
}
