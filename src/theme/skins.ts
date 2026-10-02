import type { ThemeId } from './themes';

/** Visual roles shared by the app, theme thumbnails, and the bundled scene generator. */
export interface ThemeSkin {
  page: string; panel: string; raised: string; line: string; edge: string;
  text: string; muted: string; accent: string; onAccent: string; secondary: string;
  shadow: string; radius: string; border: string; pixel: string; body: string;
}
type Colors = [string, string, string, string, string, string, string, string, string, string];
function skin([page, panel, raised, line, edge, text, muted, accent, onAccent, secondary]: Colors, details: Partial<ThemeSkin> = {}): ThemeSkin {
  return { page, panel, raised, line, edge, text, muted, accent, onAccent, secondary,
    shadow: `3px 3px 0 ${page}`, radius: '0px', border: '1px',
    pixel: "'Press Start 2P', monospace", body: "'Inter', sans-serif", ...details };
}

// page, panel, raised, line, edge, text, muted, action, action ink, secondary
export const THEME_SKINS: Record<ThemeId, ThemeSkin> = {
  original: skin(['#07111e','#12253b','#1b3551','#365775','#598bb4','#f4f0e6','#b8cadb','#ff963f','#171109','#8dc6f6'], { border: '2px' }),
  cartridge: skin(['#cfcec5','#f2f1e5','#e0dfd3','#9e9f92','#43483f','#222a23','#535d51','#ae3038','#ffffff','#485d69'], { border: '2px', radius: '5px', shadow: 'inset 1px 1px 0 #ffffff, inset -1px -2px 0 #b1b2a5, 3px 4px 0 #9b9c90' }),
  scoreboard: skin(['#090b0d','#131619','#202529','#41494e','#747e83','#f4edda','#c1c5c3','#ffbd51','#191407','#9dcbe2'], { border: '2px', shadow: 'inset 0 1px 0 #5b6063, 0 3px 0 #020304', pixel: "'DotGothic16', monospace" }),
  prodark: skin(['#131517','#1c1f22','#272b30','#393f45','#606971','#f1f2ef','#adb7bf','#ed8b48','#1b130c','#94b8d4'], { radius: '3px', shadow: 'none', pixel: "'IBM Plex Sans', sans-serif", body: "'IBM Plex Sans', sans-serif" }),
  terminal: skin(['#06110b','#0b1b11','#132c1b','#326346','#69a87b','#c9f4d2','#9ecaaa','#88e9a1','#082311','#a4dbac'], { shadow: 'none', body: "'IBM Plex Mono', monospace", pixel: "'VT323', monospace" }),
  frontoffice: skin(['#f1f3ef','#ffffff','#eaf0ed','#c2cdd1','#607b8a','#172f40','#506575','#244e6c','#ffffff','#2966a0'], { radius: '2px', shadow: '0 2px 0 #dce3df' }),
  hardwood: skin(['#c99c65','#fff7e9','#f1e3c9','#bb9f75','#48637b','#19344d','#52616a','#245983','#ffffff','#8c531f'], { border: '2px', shadow: '2px 3px 0 #9c7950' }),
  blacktop: skin(['#252723','#292c27','#373b33','#767c6c','#c5c8b2','#f4f0df','#c5caba','#ef995c','#25251d','#bfc9b1'], { shadow: '2px 3px 0 #141713', border: '2px' }),
  playbook: skin(['#102e24','#193d30','#254e3e','#6b8f76','#b1c3a6','#f5f1dc','#c1d6c3','#edd779','#1a2b1c','#b7d9c1'], { shadow: 'none' }),
  handheld: skin(['#cddd9f','#d0dd9c','#81955d','#81955d','#365333','#142b16','#365333','#365333','#d0dd9c','#365333'], { border: '3px', shadow: '3px 3px 0 #365333', pixel: "'Silkscreen', monospace", body: "'IBM Plex Mono', monospace" }),
  broadcast: skin(['#091636','#102b60','#1a4080','#607da2','#b3c2cf','#fff9e9','#c8d8ee','#f0c761','#172440','#a9c9ed'], { border: '2px', shadow: 'inset 0 2px 0 #849cb8, 3px 4px 0 #030b1b', pixel: "'Teko', sans-serif" }),
  neongrid: skin(['#110f26','#1c1636','#2d204a','#544074','#9a84bd','#f4ecfb','#cdbfe2','#81e5e9','#13242b','#eb91c3'], { shadow: '2px 3px 0 #060612' }),
  arcade: skin(['#1c1234','#2e2054','#493470','#7b61ac','#b399df','#fff4da','#d9cbed','#f5ce64','#271b39','#e39bc9'], { border: '3px', shadow: 'inset 2px 2px 0 #9472c2, inset -2px -2px 0 #1c1038, 4px 5px 0 #100b1f', pixel: "'Bungee', sans-serif", body: "'Chakra Petch', sans-serif" }),
  comicpop: skin(['#f4d45c','#fffbee','#ffefbd','#292b24','#171a16','#20251f','#50594a','#b62e23','#ffffff','#9b3127'], { border: '3px', shadow: '4px 5px 0 #20251f', radius: '1px', pixel: "'Bangers', sans-serif" }),
  championship: skin(['#10120f','#191c16','#262920','#685c3f','#bca16b','#f8f0dc','#c9c1a9','#d4b578','#1b1b12','#dbceac'], { shadow: 'inset 0 1px 0 #4c4835, 2px 3px 0 #070a06' }),
  aurora: skin(['#081922','#0e2631','#183b43','#396575','#7ebdae','#edfaf4','#bddad5','#8ee1c2','#102d26','#b6a6e3'], { shadow: '0 3px 0 #061117' }),
  royalcourt: skin(['#201429','#30213c','#432c50','#786086','#b9a370','#fcf3dd','#dacee4','#d2b67c','#271c2a','#c9a7df'], { shadow: 'inset 0 1px 0 #64503e, 3px 4px 0 #130d1b' }),
  galaxy: skin(['#09121f','#101f32','#192c44','#3d5575','#7496c0','#f0f3fa','#c0ccdf','#85c9ed','#102534','#e0abd3'], { shadow: '0 3px 0 #040a12' }),
  hallowed: skin(['#eeeae0','#fffcf5','#f2edde','#cfc2a1','#a48749','#342b18','#6d6047','#886321','#ffffff','#8b7546'], { shadow: 'inset 0 1px 0 #ffffff, 2px 3px 0 #d6cdbb' }),
  eclipse: skin(['#100e0c','#1c1713','#2d211a','#66483b','#b37753','#f7eddf','#d1c2b5','#ed9970','#28140c','#daba93'], { shadow: '0 3px 0 #070606' }),
  immortal: skin(['#0b101a','#131d2b','#202d40','#667387','#abbcd0','#f1f3fa','#c3cbd8','#f2cf91','#24221c','#9ad6e3'], { shadow: '0 3px 0 #050811' }),
  sovereign: skin(['#071525','#10273e','#1a3853','#7a6d4f','#ccb174','#fcf2db','#c3d5e4','#dfc17e','#172433','#99d4ed'], { border: '2px', shadow: 'inset 0 1px 0 #375477, 3px 4px 0 #040d16' }),
};

export function themeScene(id: ThemeId): string {
  return new URL(`../assets/looks/scenes/${id}.svg`, import.meta.url).href;
}
