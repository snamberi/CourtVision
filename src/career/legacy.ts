import type { NbaHistory } from '../history/nbaHistoryData';

/*
 * Legacy for Career Mode: one score for a whole career, computed the same way for real players (from the NBA history
 * data) and for a player you create (from his simulated career). Rings, Finals MVPs and MVPs count most, then All-NBA
 * teams, All-Star games, defense, and career totals.
 *
 * The all-time Top 100 is a fixed, hand-ordered list (LeBron 1, Duncan 4, Curry 7, Kobe 12). Your player's place on it
 * is 1 + the number of list players whose Legacy Score is higher than his; past 100 he is outside the list.
 */

export interface LegacyResume {
  titles: number; fmvp: number; mvp: number;
  allNba1: number; allNba2: number; allNba3: number; allStar: number;
  dpoy: number; allDef1: number; allDef2: number; roy: number;
  games: number; pts: number; reb: number; ast: number; stl: number; blk: number;
  /** Career Mode only: Legacy from the big moments you chose (bigMoments.ts). */
  story?: number;
}
export const emptyResume = (): LegacyResume => ({ titles: 0, fmvp: 0, mvp: 0, allNba1: 0, allNba2: 0, allNba3: 0, allStar: 0, dpoy: 0, allDef1: 0, allDef2: 0, roy: 0, games: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0 });

export function legacyScore(r: LegacyResume): number {
  const s = r.titles * 5 + r.fmvp * 6 + r.mvp * 10
    + r.allNba1 * 5 + r.allNba2 * 3 + r.allNba3 * 1.5 + r.allStar * 1.5
    + r.dpoy * 3 + r.allDef1 * 1.2 + r.allDef2 * 0.6 + r.roy
    + r.pts / 1000 * 1.6 + r.reb / 1000 * 0.9 + r.ast / 1000 * 1.2 + (r.stl + r.blk) / 1000 * 0.8
    + (r.story ?? 0);
  return Math.round(s * 10) / 10;
}

/** The all-time Top 100, best first. Names as in the NBA history data (accents don't matter). */
export const TOP_100: string[] = [
  'LeBron James', 'Michael Jordan', 'Kareem Abdul-Jabbar', 'Tim Duncan', 'Magic Johnson', 'Bill Russell', 'Stephen Curry', 'Larry Bird', 'Wilt Chamberlain', "Shaquille O'Neal",
  'Hakeem Olajuwon', 'Kobe Bryant', 'Kevin Durant', 'Nikola Jokić', 'Giannis Antetokounmpo', 'Oscar Robertson', 'Jerry West', 'Kevin Garnett', 'Dirk Nowitzki', 'Moses Malone',
  'Karl Malone', 'Julius Erving', 'David Robinson', 'Charles Barkley', 'Elgin Baylor', 'Bob Pettit', 'Chris Paul', 'Kawhi Leonard', 'John Havlicek', 'Dwyane Wade',
  'Jason Kidd', 'Isiah Thomas', 'John Stockton', 'Allen Iverson', 'Steve Nash', 'Scottie Pippen', 'Patrick Ewing', 'James Harden', 'Russell Westbrook', 'Rick Barry',
  'George Mikan', 'Walt Frazier', 'Elvin Hayes', 'Bob Cousy', 'Gary Payton', 'Shai Gilgeous-Alexander', 'Luka Dončić', 'Joel Embiid', 'Paul Pierce', 'Clyde Drexler',
  'Willis Reed', 'Dominique Wilkins', 'Ray Allen', 'Reggie Miller', 'Anthony Davis', 'Dwight Howard', 'Bill Walton', 'Wes Unseld', 'Kevin McHale', 'George Gervin',
  'Dave Cowens', 'Nate Thurmond', 'Sam Jones', 'Tony Parker', 'Jayson Tatum', 'Damian Lillard', 'Pau Gasol', 'Carmelo Anthony', 'Tracy McGrady', 'Vince Carter',
  'Dennis Rodman', 'Alonzo Mourning', 'Manu Ginóbili', 'Hal Greer', 'Dolph Schayes', 'Paul George', 'Chris Webber', 'James Worthy', 'Robert Parish', 'Bob McAdoo',
  'Jerry Lucas', 'Earl Monroe', 'Pete Maravich', 'Kyrie Irving', 'Jimmy Butler', 'Chris Bosh', 'Klay Thompson', 'Draymond Green', 'Grant Hill', 'Adrian Dantley',
  'Bernard King', 'Tim Hardaway', 'Dave DeBusschere', 'Lenny Wilkens', 'Billy Cunningham', 'Artis Gilmore', 'Ben Wallace', 'Dikembe Mutombo', 'Yao Ming', 'Paul Arizin',
];

export const plainName = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z' -]/g, '').trim();

/** A real player's resume from the history data. */
export function historyResume(h: NbaHistory, idx: number): LegacyResume {
  const r = emptyResume();
  const bySeason = new Map<number, typeof h.seasons>();
  for (const row of h.seasonsByPlayer.get(idx) ?? []) (bySeason.get(row.season) ?? bySeason.set(row.season, []).get(row.season)!).push(row);
  for (const rows of bySeason.values()) {
    // A traded player's season is its aggregate row; otherwise the one stint (per league).
    const use = rows.some(x => x.isAggregate) ? rows.filter(x => x.isAggregate) : rows;
    for (const x of use) {
      r.games += x.stats.g ?? 0; r.pts += x.stats.pts ?? 0; r.reb += x.stats.trb ?? 0; r.ast += x.stats.ast ?? 0; r.stl += x.stats.stl ?? 0; r.blk += x.stats.blk ?? 0;
    }
  }
  for (const a of h.awards) if (a.player === idx && a.winner) {
    if (a.award === 'mvp' || a.award === 'aba-mvp') r.mvp++;
    else if (a.award === 'dpoy') r.dpoy++;
    else if (a.award === 'roy' || a.award === 'aba-roy') r.roy++;
  }
  for (const t of h.teamAwards) if (t.player === idx) {
    if (t.award === 'allLeague' || t.award === 'aba-allLeague') { if (t.rank === 1) r.allNba1++; else if (t.rank === 2) r.allNba2++; else r.allNba3++; }
    else if (t.award === 'allDefense') { if (t.rank === 1) r.allDef1++; else r.allDef2++; }
  }
  for (const s of h.allStars) if (s.player === idx) r.allStar++;
  for (const c of h.champions) {
    if (c.rosterCredit.includes(idx)) r.titles++;
    if (c.finalsMvp === idx) r.fmvp++;
  }
  return r;
}

export interface Top100Entry { rank: number; name: string; idx: number | null; resume: LegacyResume; score: number }
const cache = new WeakMap<NbaHistory, Top100Entry[]>();

/** The Top 100 with each player's resume and Legacy Score. Built once per dataset. */
export function top100(h: NbaHistory): Top100Entry[] {
  const hit = cache.get(h);
  if (hit) return hit;
  const byName = new Map<string, number[]>();
  for (const p of h.players) { const k = plainName(p.displayName); (byName.get(k) ?? byName.set(k, []).get(k)!).push(p.idx); }
  const list = TOP_100.map((name, i) => {
    // Namesakes: the one with the longest career is the legend.
    const ids = byName.get(plainName(name)) ?? [];
    const idx = ids.sort((a, b) => (h.seasonsByPlayer.get(b)?.length ?? 0) - (h.seasonsByPlayer.get(a)?.length ?? 0))[0] ?? null;
    const resume = idx == null ? emptyResume() : historyResume(h, idx);
    return { rank: i + 1, name, idx, resume, score: legacyScore(resume) };
  });
  cache.set(h, list);
  return list;
}

/** Where a Legacy Score lands on the Top 100 (null = outside it). */
export function top100Rank(list: Top100Entry[], score: number): number | null {
  const rank = 1 + list.filter(e => e.score > score).length;
  return rank <= list.length ? rank : null;
}
