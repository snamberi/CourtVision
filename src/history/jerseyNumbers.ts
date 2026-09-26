import type { PlayerSeason } from '../simulation/types';

/*
 * Real jersey numbers for well-known players (the statistics dataset has no uniform numbers). Each entry is a list:
 * a bare number is his usual number; "TEAM=N" is his number with that team; "TEAM@2007-=N" limits it to seasons
 * (END years, as in the data: 2007 = 2006-07). "00" is stored as 0. Everyone not listed keeps one plausible number
 * for his whole career, chosen from his name, so a player is recognisable across seasons and teams.
 */
const TABLE: Record<string, string> = {
  jordami01: '23,CHI@1995-1995=45', bryanko01: 'LAL@1997-2006=8,LAL@2007-=24', jamesle01: '23,MIA=6,LAL@2022-2023=6', curryst01: '30',
  duranke01: '35,BRK=7', onealsh01: '32,LAL=34,CLE=33,BOS=36', johnsma02: '32', birdla01: '33', abdulka01: '33', chambwi01: '13', russebi01: '6',
  duncati01: '21', garneke01: '21,BOS=5,BRK=2', nowitdi01: '41', iversal01: '3,DET=1', cartevi01: '15,PHO=25,DAL=25', mcgratr01: '1',
  piercpa01: '34', allenra02: '34,BOS=20', kiddja01: '5,PHO=32,DAL@2008-2012=2', nashst01: '13,LAL=10', wadedw01: '3,CLE=9',
  anthoca01: '15,NYK=7,OKC=7,HOU=7,POR=0,LAL=7', paulch01: '3', hardeja01: '13,PHI=1,LAC=1', westbru01: '0,WAS=4,DEN=4', leonaka01: '2',
  antetgi01: '34', jokicni01: '15', doncilu01: '77', embiijo01: '21', tatumja01: '0', davisan02: '23,LAL=3', irvinky01: '2,BOS=11,BRK=11,DAL=11',
  georgpa01: '13,IND@2011-2014=24,PHI=8', lillada01: '0', butleji01: '21,MIN=23,PHI=23,MIA=22', thompkl01: '11,DAL=31', greendr01: '23',
  millere01: '31', paytoga01: '20', hillgr01: '33', mournal01: '33', webbech01: '4,DET=84', gasolpa01: '16', parketo01: '9', ginobma01: '20',
  mingya01: '11', olajuha01: '34', robinda01: '50', malonka01: '32,LAL=11', stockjo01: '12', barklch01: '34,HOU=4', ewingpa01: '33,ORL=6',
  pippesc01: '33', rodmade01: '10,CHI=91,LAL=73,DAL=70', drexlcl01: '22', thomais01: '11', wilkido01: '21', ervinju01: '6', roberos01: '14,MIL=1',
  westje01: '44', bayloel01: '22', havlijo01: '17', cousybo01: '14', pettibo01: '9', malonmo01: '24,PHI=2', gervige01: '44', mchalke01: '32',
  parisro01: '0', worthja01: '42', dumarjo01: '4', fraziwa01: '10', reedwi01: '19', maravpe01: '7,ATL=44,BOS=44', cowenda01: '18', unselwe01: '41',
  hayesel01: '44,WSB=11,CAP=11', waltobi01: '32,BOS=5', howardw01: '12', loveke01: '42,CLE=0', griffbl01: '32,DET=23,BRK=2,BOS=91',
  edwaran01: '5,MIN@2021-2021=1', moranja01: '12', willizi01: '1', youngtr01: '11', bookede01: '1', mitchdo01: '45', gilgesh01: '2', wembavi01: '1',
  murraja01: '27', adebaba01: '13', brownja02: '7', townska01: '32', derozde01: '10,CHI=11', lowryky01: '7', hardati01: '10', mullich01: '17',
  kempsh01: '40', mutomdi01: '55', wallabe01: '3', wallara01: '30,DET=36', billuch01: '1', hamilri01: '32', stoudam01: '32,NYK=1', boshch01: '4,MIA=1',
  randoza01: '50', gasolma01: '33', brandel01: '42', houstal01: '20', ricegl01: '41', sprewla01: '15,NYK=8', onealje01: '7', francst01: '3',
  arenagi01: '0,ORL=1', kingbe01: '30', dantlad01: '4', englial01: '2', chambto01: '24', pricema01: '25', nancela01: '22', moncrsi01: '4',
  gilmoar01: '53', laniebo01: '16', architi01: '1,BOS=7', monroea01: '10,NYK=15', bingda01: '21', greerha01: '15', schaydo01: '4', mikange01: '99',
  thurmna01: '42', barryri01: '24,HOU=2', lucasje01: '16', arizipa01: '11', jonessa01: '24', heinsto01: '15', sharmbi01: '21', joneskc01: '25',
  goodrga01: '25', hawkico01: '42', haywosp01: '24', mcadobo01: '11', cunnibi01: '32',
};

type Rule = { team?: string; from?: number; to?: number; number: number };
const parsed = new Map<string, Rule[]>();
function rules(id: string): Rule[] | undefined {
  if (!(id in TABLE)) return undefined;
  let r = parsed.get(id);
  if (!r) {
    r = TABLE[id].split(',').map(part => {
      const m = /^(?:([A-Z]{3})(?:@(\d{4})-(\d{4})?)?=)?(\d{1,2})$/.exec(part.trim());
      if (!m) throw new Error(`Bad jersey entry ${id}: ${part}`);
      return { team: m[1], from: m[2] ? Number(m[2]) : undefined, to: m[3] ? Number(m[3]) : undefined, number: Number(m[4]) };
    });
    parsed.set(id, r);
  }
  return r;
}

/** His real number with this team in this season (END year), when the table knows it. */
export function realJerseyNumber(realId: string, teamAbbr: string | null | undefined, endYear: number): number | undefined {
  const r = rules(realId);
  if (!r) return undefined;
  const inRange = (x: Rule) => (x.from == null || endYear >= x.from) && (x.to == null || endYear <= x.to);
  return (r.find(x => x.team && x.team === teamAbbr && (x.from != null || x.to != null) && inRange(x))
    ?? r.find(x => x.team && x.team === teamAbbr && x.from == null && x.to == null)
    ?? r.find(x => !x.team))?.number;
}

/** Numbers players actually wear, weighted toward the common ones (0-35 and a few classic bigs' numbers). */
const COMMON = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 20, 21, 22, 23, 24, 25, 30, 31, 32, 33, 34, 35, 40, 41, 42, 44, 45, 50, 55];
const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 11);
/** A stable, plausible number for a player the table doesn't cover. */
export const plausibleJerseyNumber = (key: string) => COMMON[hash(key) % COMMON.length];

/**
 * Gives a roster its numbers: real ones where known, otherwise each player's own stable number, and no two
 * teammates share one (the less established player moves to his next free number). `retired` numbers are skipped.
 */
export function assignRosterNumbers(players: PlayerSeason[], teamAbbr: string, endYear: number, retired: number[] = []): PlayerSeason[] {
  const taken = new Set<number>(retired);
  const wanted = players.map(p => ({ p, real: p.real ? realJerseyNumber(p.real.id, teamAbbr, endYear) : undefined }));
  // Real numbers first (a star keeps his number), then everyone else by minutes.
  const order = [...wanted].sort((a, b) => Number(b.real != null) - Number(a.real != null) || (b.p.minutes?.target ?? 0) - (a.p.minutes?.target ?? 0));
  const result = new Map<string, number>();
  for (const { p, real } of order) {
    let n = real ?? (p.jerseyNumber != null && p.jerseyNumber < 100 && p.real == null ? p.jerseyNumber : plausibleJerseyNumber(p.real?.id ?? p.playerId));
    if (taken.has(n)) { const start = COMMON.indexOf(n); n = [...COMMON.slice(start + 1), ...COMMON.slice(0, Math.max(0, start))].find(x => !taken.has(x)) ?? n; }
    taken.add(n);
    result.set(p.playerId, n);
  }
  return players.map(p => result.get(p.playerId) === p.jerseyNumber ? p : { ...p, jerseyNumber: result.get(p.playerId) });
}

/** Every listed id, for data checks. */
export const JERSEY_TABLE_IDS = Object.keys(TABLE);
