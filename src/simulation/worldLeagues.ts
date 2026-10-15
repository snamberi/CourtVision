import type { RNG } from './engine/rng';
import type { EraRules, PlayerSeason } from './types';
import { NATIONALITIES, nameForCountry, type PlayerOrigin } from './names';
import { uniquePlayerId } from './playerIds';
import { withGameLength } from './gameLength';

/*
 * Other leagues for Franchise: the EuroLeague, the Chinese league (CBA), the Georgian Superleague and a college
 * conference. Real club names and each league's own rules (FIBA or college game length, shot clock and line, season
 * length, playoffs); the players are generated in each league's nationality mix and at its level. Real rosters can be
 * brought in with the CSV import (Settings → Import Data).
 */

export type WorldLeagueId = 'euro' | 'china' | 'georgia' | 'college';
export interface WorldClub { name: string; abbr: string; primary: string; secondary: string }
export interface WorldLeagueDef {
  id: WorldLeagueId; name: string; short: string; blurb: string;
  clubs: WorldClub[];
  games: number; periods: number; minutes: number; shotClock: number; line: number;
  playoffs: { teams: 4 | 8 | 16; gamesToWin: number };
  /** Ratings this many points below an NBA league (attributes and potential). */
  ratingShift: number;
  /** Nationality mix: [country, weight]. Countries without a pool here use the shared NBA pools. */
  mix: [string, number][];
  ages: [number, number];
  /** Prospect ages in the yearly intake (the draft): 18-year-old freshmen in college. */
  prospectAges: [number, number];
  rosterSize: number;
  /** College: players leave after this age (they graduate or turn pro). */
  leaveAfterAge?: number;
}

const club = (name: string, abbr: string, primary: string, secondary: string): WorldClub => ({ name, abbr, primary, secondary });

export const WORLD_LEAGUES: Record<WorldLeagueId, WorldLeagueDef> = {
  euro: {
    id: 'euro', name: 'EuroLeague', short: 'Euro', blurb: "Europe's top clubs: 18 teams, 34 games, FIBA rules, best-of-five playoffs.",
    clubs: [
      club('Real Madrid', 'RMB', '#f4f0e6', '#3d195b'), club('FC Barcelona', 'BAR', '#a50044', '#004d98'), club('Olympiacos', 'OLY', '#d6001c', '#f4f0e6'),
      club('Panathinaikos', 'PAO', '#007a3d', '#f4f0e6'), club('Fenerbahçe', 'FEN', '#00205b', '#ffd200'), club('Anadolu Efes', 'EFS', '#0b3c7d', '#d6001c'),
      club('Maccabi Tel Aviv', 'MTA', '#ffd200', '#0038a8'), club('Žalgiris Kaunas', 'ZAL', '#006a44', '#f4f0e6'), club('Partizan Belgrade', 'PAR', '#121212', '#f4f0e6'),
      club('Crvena Zvezda', 'CZV', '#d6001c', '#f4f0e6'), club('AS Monaco', 'MCO', '#d6001c', '#f4f0e6'), club('Bayern Munich', 'FCB', '#dc052d', '#0066b2'),
      club('Virtus Bologna', 'VIR', '#121212', '#f4f0e6'), club('Olimpia Milano', 'MIL', '#d6001c', '#f4f0e6'), club('Baskonia', 'BKN', '#0b2a5b', '#d6001c'),
      club('ASVEL Villeurbanne', 'ASV', '#121212', '#c0c0c0'), club('Paris Basketball', 'PAR2', '#121212', '#e5007e'), club('Valencia Basket', 'VBC', '#f28c28', '#121212'),
    ],
    games: 34, periods: 4, minutes: 10, shotClock: 24, line: 22.15, playoffs: { teams: 8, gamesToWin: 3 }, ratingShift: 5,
    mix: [['USA', 34], ['Spain', 8], ['Serbia', 8], ['Greece', 8], ['Turkey', 7], ['France', 8], ['Lithuania', 6], ['Germany', 5], ['Slovenia', 3], ['Croatia', 4], ['Italy', 6], ['Israel', 3]],
    ages: [19, 36], prospectAges: [18, 21], rosterSize: 15,
  },
  china: {
    id: 'china', name: 'Chinese Basketball Association', short: 'CBA', blurb: 'The CBA: 20 clubs, 42 games, FIBA rules, a 16-team playoff.',
    clubs: [
      club('Guangdong Southern Tigers', 'GDT', '#d6001c', '#121212'), club('Liaoning Flying Leopards', 'LNF', '#0b3c7d', '#f4f0e6'), club('Xinjiang Flying Tigers', 'XJT', '#00843d', '#f4f0e6'),
      club('Zhejiang Lions', 'ZJL', '#d6001c', '#ffd200'), club('Zhejiang Golden Bulls', 'ZJB', '#0b3c7d', '#ffd200'), club('Shanghai Sharks', 'SHS', '#0b3c7d', '#d6001c'),
      club('Beijing Ducks', 'BJD', '#0b2a5b', '#ffd200'), club('Beijing Royal Fighters', 'BRF', '#6a0dad', '#ffd200'), club('Shenzhen Leopards', 'SZL', '#121212', '#ffd200'),
      club('Shandong Heroes', 'SDH', '#f28c28', '#121212'), club('Shanxi Loongs', 'SXL', '#d6001c', '#f4f0e6'), club('Qingdao Eagles', 'QDE', '#0066b2', '#f4f0e6'),
      club('Jilin Northeast Tigers', 'JLT', '#d6001c', '#121212'), club('Tianjin Pioneers', 'TJP', '#0b3c7d', '#f4f0e6'), club('Sichuan Blue Whales', 'SCW', '#0066b2', '#f4f0e6'),
      club('Fujian Sturgeons', 'FJS', '#0b3c7d', '#d6001c'), club('Jiangsu Dragons', 'JSD', '#d6001c', '#0b3c7d'), club('Nanjing Monkey Kings', 'NJM', '#ffd200', '#121212'),
      club('Guangzhou Loong Lions', 'GZL', '#d6001c', '#ffd200'), club('Ningbo Rockets', 'NBR', '#0b3c7d', '#f4f0e6'),
    ],
    games: 42, periods: 4, minutes: 10, shotClock: 24, line: 22.15, playoffs: { teams: 16, gamesToWin: 3 }, ratingShift: 8,
    mix: [['China', 86], ['USA', 12], ['Nigeria', 1], ['Australia', 1]],
    ages: [19, 35], prospectAges: [18, 21], rosterSize: 15,
  },
  georgia: {
    id: 'georgia', name: 'Georgian Superleague', short: 'Superleague', blurb: "Georgia's top league: 10 clubs, 36 games, FIBA rules, an 8-team playoff.",
    clubs: [
      club('Dinamo Tbilisi', 'DIN', '#0b3c7d', '#f4f0e6'), club('Rustavi', 'RUS', '#d6001c', '#f4f0e6'), club('Kutaisi', 'KUT', '#00843d', '#f4f0e6'),
      club('Batumi', 'BAT', '#0066b2', '#ffd200'), club('Vera Tbilisi', 'VER', '#6a0dad', '#f4f0e6'), club('Olimpi Tbilisi', 'OLI', '#ffd200', '#0b3c7d'),
      club('TSU Tbilisi', 'TSU', '#0b2a5b', '#d6001c'), club('Telavi', 'TEL', '#7a1f3d', '#f4f0e6'), club('Zugdidi', 'ZUG', '#f28c28', '#121212'),
      club('Gori', 'GOR', '#121212', '#d6001c'),
    ],
    games: 36, periods: 4, minutes: 10, shotClock: 24, line: 22.15, playoffs: { teams: 8, gamesToWin: 3 }, ratingShift: 14,
    mix: [['Georgia', 70], ['USA', 24], ['Serbia', 3], ['Lithuania', 3]],
    ages: [18, 35], prospectAges: [17, 20], rosterSize: 14,
  },
  college: {
    id: 'college', name: 'College Conference', short: 'College', blurb: 'Sixteen famous programs, 30 games, two 20-minute halves, a 30-second clock and a one-game-a-round tournament. Players leave after four years.',
    clubs: [
      club('Duke Blue Devils', 'DUKE', '#00539b', '#f4f0e6'), club('North Carolina Tar Heels', 'UNC', '#7bafd4', '#13294b'), club('Kentucky Wildcats', 'UK', '#0033a0', '#f4f0e6'),
      club('Kansas Jayhawks', 'KU', '#0051ba', '#e8000d'), club('UCLA Bruins', 'UCLA', '#2d68c4', '#f2a900'), club('Gonzaga Bulldogs', 'GONZ', '#041e42', '#c8102e'),
      club('Michigan State Spartans', 'MSU', '#18453b', '#f4f0e6'), club('Villanova Wildcats', 'NOVA', '#00205b', '#13b5ea'), club('Arizona Wildcats', 'ARIZ', '#cc0033', '#003366'),
      club('UConn Huskies', 'CONN', '#000e2f', '#f4f0e6'), club('Houston Cougars', 'HOU', '#c8102e', '#f4f0e6'), club('Purdue Boilermakers', 'PUR', '#cfb991', '#121212'),
      club('Baylor Bears', 'BAY', '#154734', '#ffb81c'), club('Indiana Hoosiers', 'IND', '#990000', '#f4f0e6'), club('Syracuse Orange', 'SYR', '#f76900', '#002d72'),
      club('Louisville Cardinals', 'LOU', '#ad0000', '#121212'),
    ],
    games: 30, periods: 2, minutes: 20, shotClock: 30, line: 22.15, playoffs: { teams: 16, gamesToWin: 1 }, ratingShift: 10,
    mix: [['USA', 88], ['Canada', 3], ['Australia', 3], ['Nigeria', 3], ['France', 3]],
    ages: [18, 22], prospectAges: [18, 18], rosterSize: 15, leaveAfterAge: 22,
  },
};
export const WORLD_LEAGUE_IDS = Object.keys(WORLD_LEAGUES) as WorldLeagueId[];
export const isWorldLeagueId = (v: unknown): v is WorldLeagueId => typeof v === 'string' && v in WORLD_LEAGUES;

/** Name pools for countries the NBA generator does not use. Family name first for Chinese players, as in China. */
const LOCAL: Record<string, { first: string[]; last: string[]; familyFirst?: boolean }> = {
  China: {
    first: ['Wei', 'Jun', 'Hao', 'Lei', 'Peng', 'Jie', 'Tao', 'Ming', 'Bo', 'Yi', 'Kai', 'Zhe', 'Rui', 'Hang', 'Long', 'Qi', 'Xiang', 'Jian', 'Chen', 'Yu', 'Fei', 'Jiahao', 'Zihan', 'Haoran', 'Yuchen', 'Junjie', 'Zhiwei', 'Mingyu', 'Tianyu', 'Xuan', 'Shuai', 'Hongwei', 'Yifan', 'Zhenyu', 'Wenbo'],
    last: ['Wang', 'Li', 'Zhang', 'Liu', 'Chen', 'Yang', 'Zhao', 'Huang', 'Zhou', 'Wu', 'Xu', 'Sun', 'Hu', 'Zhu', 'Gao', 'Lin', 'He', 'Guo', 'Ma', 'Luo', 'Song', 'Zheng', 'Han', 'Tang', 'Feng', 'Deng', 'Cao', 'Peng', 'Xie', 'Jiang', 'Fan', 'Du', 'Shen', 'Lu', 'Yao'],
    familyFirst: true,
  },
  Georgia: {
    first: ['Giorgi', 'Luka', 'Nika', 'Davit', 'Levan', 'Irakli', 'Sandro', 'Lasha', 'Zurab', 'Tornike', 'Goga', 'Beka', 'Saba', 'Nikoloz', 'Tengiz', 'Mikheil', 'Aleksandre', 'Otar', 'Vakhtang', 'Revaz', 'Gela', 'Shota', 'Merab', 'Ilia', 'Demetre', 'Tamaz', 'Archil', 'Koba', 'Gocha', 'Vazha'],
    last: ['Beridze', 'Kapanadze', 'Gelashvili', 'Lomidze', 'Tsiklauri', 'Gogia', 'Khutsishvili', 'Maisuradze', 'Chikovani', 'Javakhishvili', 'Abashidze', 'Natsvlishvili', 'Mchedlidze', 'Japaridze', 'Bakradze', 'Gvaramia', 'Tsereteli', 'Chkheidze', 'Kobakhidze', 'Dolidze', 'Kharaishvili', 'Meskhi', 'Jgenti', 'Kiknadze', 'Shonia', 'Gabunia', 'Khachidze', 'Tabatadze', 'Margvelashvili', 'Kurdadze'],
  },
  Italy: {
    first: ['Marco', 'Luca', 'Matteo', 'Alessandro', 'Lorenzo', 'Andrea', 'Giacomo', 'Simone', 'Davide', 'Riccardo', 'Nicolò', 'Federico', 'Tommaso', 'Gabriele', 'Stefano'],
    last: ['Rossi', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Bruno', 'Gallo', 'Conti', 'De Luca', 'Mancini', 'Costa'],
  },
  Israel: {
    first: ['Yoav', 'Itay', 'Omri', 'Noam', 'Eyal', 'Tomer', 'Guy', 'Amit', 'Ido', 'Lior', 'Roi', 'Nadav', 'Ariel', 'Ofek', 'Shay'],
    last: ['Cohen', 'Levi', 'Mizrahi', 'Peretz', 'Biton', 'Dahan', 'Avraham', 'Friedman', 'Malka', 'Azoulay', 'Katz', 'Shapira', 'Ben-David', 'Golan', 'Segal'],
  },
};

function pickCountry(mix: [string, number][], rng: RNG): string {
  const total = mix.reduce((n, [, w]) => n + w, 0);
  let r = rng.next() * total;
  for (const [c, w] of mix) { r -= w; if (r <= 0) return c; }
  return mix[0][0];
}

/** A generated player for this league: a name from his country's pool, and his college (college league: his team's school). */
export function worldOrigin(def: WorldLeagueDef, rng: RNG, used: Set<string>, school?: string): PlayerOrigin {
  const country = pickCountry(def.mix, rng);
  const pool = LOCAL[country];
  let name: string;
  if (pool) {
    let tries = 0;
    do {
      const f = pool.first[rng.nextInt(pool.first.length)], l = pool.last[rng.nextInt(pool.last.length)];
      name = pool.familyFirst ? `${l} ${f}` : `${f} ${l}`;
      if (++tries > 40) { name = uniquePlayerId(name, used); break; }
    } while (used.has(name));
    used.add(name);
  } else if (NATIONALITIES.some(n => n.country === country)) {
    name = nameForCountry(country, rng, used);
  } else {
    name = nameForCountry('USA', rng, used);
  }
  return { name, nationality: country, college: def.id === 'college' ? school ?? null : null };
}

/** The league's rules: game length, shot clock and three-point line on top of today's era rules. */
export function worldEra(def: WorldLeagueDef, base: EraRules): EraRules {
  return { ...withGameLength(base, def.periods, def.minutes), shotClockSeconds: def.shotClock, threePointLineDistance: def.line };
}

/** A player brought down to the league's level: every skill and his potential lower by `shift` (body unchanged). */
export function shiftRatings(p: PlayerSeason, shift: number): PlayerSeason {
  if (!shift) return p;
  const down = <T extends object>(group: T): T => Object.fromEntries(Object.entries(group).map(([k, v]) => [k, typeof v === 'number' ? Math.max(15, v - shift) : v])) as T;
  const a = p.attributes;
  return {
    ...p,
    attributes: { ...a, offense: down(a.offense), defense: down(a.defense), mental: down(a.mental) },
    development: { ...p.development, potential: Math.max(25, p.development.potential - shift) },
  };
}

/** The league's definition when it is one of the other leagues. */
export const worldDefOf = (league: { worldLeague?: WorldLeagueId }): WorldLeagueDef | undefined =>
  league.worldLeague && isWorldLeagueId(league.worldLeague) ? WORLD_LEAGUES[league.worldLeague] : undefined;
