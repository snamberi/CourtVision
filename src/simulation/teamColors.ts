/** Fallback jersey color pairs for teams with no real or nickname theme, cycled deterministically by team ID hash. */
const TEAM_PALETTE: [primary: string, secondary: string][] = [
  ['#c8102e', '#1d1160'], // red / purple
  ['#1d428a', '#c8102e'], // blue / red
  ['#007a33', '#000000'], // green / black
  ['#f58426', '#002d62'], // orange / navy
  ['#552583', '#fdb927'], // purple / gold
  ['#ce1141', '#000000'], // crimson / black
  ['#006bb6', '#ed174c'], // blue / pink-red
  ['#0c2340', '#c4ced4'], // navy / silver
  ['#00471b', '#eee1c6'], // dark green / cream
  ['#e56020', '#1d1160'], // burnt orange / purple
  ['#860038', '#fdb927'], // maroon / gold
  ['#5a2d81', '#63727a'], // violet / gray
  ['#0e2240', '#a6192e'], // navy / red
  ['#1a5b3f', '#f9a01b'], // forest / amber
  ['#8a1538', '#0d1b2a'], // wine / near-black
  ['#217a4b', '#d0b48c'], // pine / tan
  ['#c4122e', '#7a7a7a'], // scarlet / gray
  ['#003da5', '#f2a900'], // royal blue / gold
];

function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface TeamColors {
  primary: string;
  secondary: string;
}

/** Logo marks drawn by TeamLogo. The first six are the original set. */
export const LOGO_MARKS = ['bolt', 'crown', 'mountain', 'wings', 'star', 'tower', 'flame', 'wave', 'anchor', 'paw', 'claw', 'horns', 'tree',
  'snowflake', 'comet', 'shield', 'hammer', 'halo', 'feather', 'sun', 'ball', 'stinger', 'fang', 'horseshoe'] as const;
export type LogoMark = typeof LOGO_MARKS[number];
interface TeamTheme extends TeamColors { logo: LogoMark }
const theme = (primary: string, secondary: string, logo: LogoMark): TeamTheme => ({ primary, secondary, logo });

/**
 * Historical leagues: each NBA franchise (and the relocated and defunct ones) in its real color pair. The marks are
 * Court Vision's own pixel shapes picked to suit the club, never the real logos.
 */
const REAL_TEAMS: Record<string, TeamTheme> = {
  ATL: theme('#c8102e', '#fdb927', 'wings'), BOS: theme('#007a33', '#ba9653', 'star'), BRK: theme('#000000', '#ffffff', 'shield'),
  NJN: theme('#002a60', '#cd1041', 'shield'), NYN: theme('#002a60', '#f58426', 'shield'), CHI: theme('#ce1141', '#000000', 'horns'),
  CHO: theme('#1d1160', '#00788c', 'wings'), CHA: theme('#f26532', '#1d1160', 'claw'), CHH: theme('#00778b', '#280071', 'wings'),
  CLE: theme('#860038', '#fdbb30', 'shield'), DAL: theme('#00538c', '#b8c4ca', 'horseshoe'), DEN: theme('#0e2240', '#fec524', 'mountain'),
  DET: theme('#c8102e', '#1d42ba', 'hammer'), FTW: theme('#c8102e', '#1d42ba', 'hammer'), GSW: theme('#1d428a', '#ffc72c', 'bolt'),
  SFW: theme('#1d428a', '#ffc72c', 'bolt'), PHW: theme('#1d428a', '#ffc72c', 'bolt'), HOU: theme('#ce1141', '#c4ced4', 'comet'),
  SDR: theme('#ce1141', '#fdb927', 'comet'), IND: theme('#002d62', '#fdbb30', 'bolt'), LAC: theme('#c8102e', '#1d428a', 'wave'),
  SDC: theme('#c8102e', '#1d428a', 'wave'), BUF: theme('#0077c0', '#e03a3e', 'horns'), LAL: theme('#552583', '#fdb927', 'star'),
  MNL: theme('#552583', '#fdb927', 'star'), MEM: theme('#5d76a9', '#12173f', 'paw'), VAN: theme('#00b2a9', '#e43c40', 'paw'),
  MIA: theme('#98002e', '#f9a01b', 'flame'), MIL: theme('#00471b', '#eee1c6', 'horns'), MIN: theme('#0c2340', '#78be20', 'paw'),
  NOP: theme('#0c2340', '#c8102e', 'feather'), NOH: theme('#00778b', '#fdb927', 'feather'), NOK: theme('#00778b', '#fdb927', 'feather'),
  NYK: theme('#006bb6', '#f58426', 'ball'), OKC: theme('#007ac1', '#ef3b24', 'comet'), SEA: theme('#00653a', '#ffc200', 'wave'),
  ORL: theme('#0077c0', '#c4ced4', 'star'), PHI: theme('#006bb6', '#ed174c', 'star'), SYR: theme('#ed174c', '#006bb6', 'star'),
  PHO: theme('#1d1160', '#e56020', 'sun'), POR: theme('#e03a3e', '#000000', 'flame'), SAC: theme('#5a2d81', '#63727a', 'crown'),
  KCK: theme('#0077c0', '#e03a3e', 'crown'), KCO: theme('#0077c0', '#e03a3e', 'crown'), CIN: theme('#0077c0', '#e03a3e', 'crown'),
  ROC: theme('#0077c0', '#e03a3e', 'crown'), SAS: theme('#000000', '#c4ced4', 'shield'), TOR: theme('#ce1141', '#000000', 'claw'),
  UTA: theme('#002b5c', '#f9a01b', 'mountain'), NOJ: theme('#002b5c', '#f9a01b', 'mountain'), WAS: theme('#002b5c', '#e31837', 'star'),
  WSB: theme('#002b5c', '#e31837', 'star'), CAP: theme('#002b5c', '#e31837', 'star'), BAL: theme('#e31837', '#002b5c', 'star'),
  CHZ: theme('#e31837', '#002b5c', 'star'), CHP: theme('#e31837', '#002b5c', 'star'), STL: theme('#c8102e', '#fdb927', 'wings'),
  TRI: theme('#c8102e', '#fdb927', 'wings'), MLH: theme('#c8102e', '#fdb927', 'wings'),
};

/** Generated and custom teams: colors and a mark that suit the nickname. */
const NICKNAME_THEMES: [RegExp, TeamTheme][] = [
  [/foundry|forge|steel|iron/i, theme('#3f4854', '#f97316', 'hammer')],
  [/timberwolves/i, theme('#0c3b2e', '#c0c7cf', 'claw')],
  [/wolves|wolf/i, theme('#1f3a5f', '#9aa5b1', 'paw')],
  [/bison|buffalo|bulls?\b/i, theme('#5b3a1e', '#e0b15c', 'horns')],
  [/vipers|cobras|snakes/i, theme('#14532d', '#a3e635', 'fang')],
  [/rattlers/i, theme('#78350f', '#fcd34d', 'fang')],
  [/mariners|sailors|admirals/i, theme('#0c2d48', '#2ec4b6', 'anchor')],
  [/tide|waves|surf/i, theme('#0b3d91', '#7dd3fc', 'wave')],
  [/marlins|sharks|dolphins/i, theme('#006d77', '#fb8500', 'wave')],
  [/ravens|crows/i, theme('#1b1b2f', '#8b5cf6', 'feather')],
  [/herons|cranes/i, theme('#1e3a5f', '#bfdbfe', 'feather')],
  [/falcons/i, theme('#0f172a', '#f97316', 'wings')],
  [/hawks|eagles/i, theme('#7f1d1d', '#e5e7eb', 'wings')],
  [/miners/i, theme('#1f2937', '#fbbf24', 'hammer')],
  [/comets|meteors|stars/i, theme('#1e1b4b', '#facc15', 'comet')],
  [/kings|royals|monarchs/i, theme('#3b0764', '#fcd34d', 'crown')],
  [/embers|flames|blaze|fire/i, theme('#9a1b1b', '#fb923c', 'flame')],
  [/phoenix/i, theme('#b91c1c', '#fbbf24', 'flame')],
  [/lynx/i, theme('#1e3a8a', '#cbd5e1', 'paw')],
  [/panthers|jaguars|tigers|cats/i, theme('#111827', '#38bdf8', 'claw')],
  [/foxes/i, theme('#c2410c', '#fef3c7', 'paw')],
  [/titans|giants/i, theme('#312e81', '#94a3b8', 'shield')],
  [/yetis|frost|polar|ice/i, theme('#0e7490', '#e0f2fe', 'snowflake')],
  [/stags|elks|bucks|deer|moose/i, theme('#14532d', '#d6b370', 'horns')],
  [/loggers|lumberjacks|pines/i, theme('#166534', '#b45309', 'tree')],
  [/sentinels/i, theme('#1e293b', '#cbd5e1', 'tower')],
  [/wardens|guardians|knights/i, theme('#27272a', '#a3e635', 'shield')],
  [/scorpions/i, theme('#78350f', '#fde68a', 'stinger')],
  [/halos|angels/i, theme('#1e3a8a', '#fde68a', 'halo')],
  [/mustangs|stallions|broncos|colts/i, theme('#7c2d12', '#e7e5e4', 'horseshoe')],
  [/suns|solar/i, theme('#4c1d95', '#f97316', 'sun')],
  [/thunder|storm|bolts|lightning/i, theme('#1e40af', '#fde047', 'bolt')],
  [/peaks|summit|mountain/i, theme('#334155', '#e2e8f0', 'mountain')],
];

/** The theme for a team: real colors in historical leagues, a nickname theme otherwise, else a stable pick from the palette. */
export function teamTheme(teamId: string | null | undefined, name?: string): TeamTheme {
  const hash = hashString(teamId ?? '');
  const fallback: TeamTheme = { ...teamColors(teamId), logo: LOGO_MARKS[hash % 6] };
  if (!teamId) return fallback;
  const real = REAL_TEAMS[teamId.toUpperCase()];
  if (real) return real;
  const nickname = name ?? GENERATED_NICKNAMES[Number(/^GEN(\d+)$/.exec(teamId)?.[1] ?? -1)];
  const themed = nickname ? NICKNAME_THEMES.find(([re]) => re.test(nickname))?.[1] : undefined;
  return themed ?? fallback;
}
/** Nicknames of the generated league, by GEN index (see leagueGenerator.ts), for callers that only have an id. */
const GENERATED_NICKNAMES = ['Foundry', 'Timberwolves', 'Bison', 'Vipers', 'Tide', 'Ravens', 'Miners', 'Comets', 'Kings', 'Embers', 'Wolves', 'Lynx',
  'Foxes', 'Hawks', 'Titans', 'Rattlers', 'Marlins', 'Yetis', 'Stags', 'Phoenixes', 'Loggers', 'Sentinels', 'Scorpions', 'Herons', 'Wardens',
  'Falcons', 'Halos', 'Mustangs', 'Panthers', 'Mariners'];

/** Deterministic — the same teamId always yields the same kit colors, with no state to store or generate ahead of time. */
export function teamColors(teamId: string | null | undefined): TeamColors {
  if (!teamId) return { primary: '#4a5160', secondary: '#c9ccd1' }; // free agents / unassigned: neutral gray kit
  const real = REAL_TEAMS[teamId.toUpperCase()];
  if (real) return { primary: real.primary, secondary: real.secondary };
  const nickname = GENERATED_NICKNAMES[Number(/^GEN(\d+)$/.exec(teamId)?.[1] ?? -1)];
  const themed = nickname ? NICKNAME_THEMES.find(([re]) => re.test(nickname))?.[1] : undefined;
  if (themed) return { primary: themed.primary, secondary: themed.secondary };
  const idx = hashString(teamId) % TEAM_PALETTE.length;
  const [primary, secondary] = TEAM_PALETTE[idx];
  return { primary, secondary };
}
