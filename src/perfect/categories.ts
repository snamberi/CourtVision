import type { NbaHistory, HistSeasonRow } from '../history/nbaHistoryData';
import { cardPool, type HuntCard } from '../hunt/cards';

/*
 * Category Draft: the categories a run rolls ("MVPs", "90s players", "Duke", "No. 1 picks", "7-footers", "Lakers"...)
 * and the players in each. A player comes in at his best season that fits: an MVP at his MVP season, a champion at a
 * title season, a Laker at his best year in purple and gold. Everything is built from the real history data.
 *
 * Categories are tiered S to D by how strong their best ten are, and a weaker category pays a bigger score: going
 * 82-0 with second-round picks beats doing it with MVPs.
 */

export type CategoryGroup = 'Awards' | 'Titles' | 'Eras' | 'Teams' | 'Draft' | 'College' | 'Body' | 'Stats' | 'Careers' | 'Names';
export type Tier = 'S' | 'A' | 'B' | 'C' | 'D';
export interface Category { id: string; name: string; blurb: string; group: CategoryGroup }
export interface CategoryInfo extends Category { tier: Tier; size: number; pool: HuntCard[] }

/** Players a category needs to be rolled: five picks, and still a choice on the last one. */
export const MIN_CATEGORY = 12;
export const TIER_MULTIPLIER: Record<Tier, number> = { S: 1, A: 1.15, B: 1.3, C: 1.5, D: 1.75 };
export const TIER_LABEL: Record<Tier, string> = { S: 'Stacked', A: 'Strong', B: 'Solid', C: 'Tough', D: 'Brutal' };

// ---------------------------------------------------------------- what we know about every card

interface Ctx {
  h: NbaHistory;
  idOf: Map<number, string>;
  row: Map<string, HistSeasonRow>;
  awards: Map<string, Set<string>>;
  allNba1: Set<string>; allNba: Set<string>; allDef1: Set<string>; allDef: Set<string>; allRookie: Set<string>;
  allStar: Set<string>; allStarPlayers: Set<string>; asgMvp: Set<string>;
  champs: Set<string>; finalsMvp: Set<string>; ringCount: Map<string, number>;
  runnerUp: Set<string>;
  teamRec: Map<string, { w: number; l: number }>;
  leaders: Record<'pts' | 'trb' | 'ast' | 'blk' | 'stl', Set<string>>;
  franchiseCount: Map<string, number>; oneFranchise: Set<string>; seasonsPlayed: Map<string, number>;
}

const key = (pid: string, season: number) => `${pid}|${season}`;
const ctxCache = new WeakMap<NbaHistory, Ctx>();

function context(h: NbaHistory): Ctx {
  const hit = ctxCache.get(h);
  if (hit) return hit;
  const idOf = new Map(h.players.map(p => [p.idx, p.id]));
  const pid = (idx: number) => idOf.get(idx) ?? '';
  const awards = new Map<string, Set<string>>();
  for (const a of h.awards) if (a.winner) { const s = awards.get(a.award) ?? awards.set(a.award, new Set()).get(a.award)!; s.add(key(pid(a.player), a.season)); }
  const set = (pred: (a: (typeof h.teamAwards)[number]) => boolean) => new Set(h.teamAwards.filter(pred).map(a => key(pid(a.player), a.season)));
  const champs = new Set<string>(), finalsMvp = new Set<string>(), ringCount = new Map<string, number>(), runnerUp = new Set<string>();
  for (const c of h.champions) {
    for (const p of c.rosterCredit) { champs.add(key(pid(p), c.season)); ringCount.set(pid(p), (ringCount.get(pid(p)) ?? 0) + 1); }
    if (c.finalsMvp != null) finalsMvp.add(key(pid(c.finalsMvp), c.season));
    runnerUp.add(`${c.runnerUp}|${c.season}`);
  }
  const teamRec = new Map(h.teams.filter(t => t.w != null && t.l != null).map(t => [`${t.abbr}|${t.season}`, { w: t.w!, l: t.l! }]));
  // Per-card season rows (the full-season line for players who were traded).
  const row = new Map<string, HistSeasonRow>();
  const franchiseOf = new Map(h.teams.map(t => [`${t.abbr}|${t.season}`, t.franchise ?? t.abbr]));
  const franchises = new Map<string, Set<string>>(), seasonsPlayed = new Map<string, number>();
  for (const p of h.players) {
    const rows = (h.seasonsByPlayer.get(p.idx) ?? []).filter(r => r.league === 'NBA' || r.league === 'BAA');
    const seasons = new Set<number>();
    for (const r of rows) {
      seasons.add(r.season);
      if (!r.isAggregate) (franchises.get(p.id) ?? franchises.set(p.id, new Set()).get(p.id)!).add(franchiseOf.get(`${r.team}|${r.season}`) ?? r.team);
      const k = key(p.id, r.season);
      if (r.isAggregate || !row.has(k)) row.set(k, r);
    }
    seasonsPlayed.set(p.id, seasons.size);
  }
  // League leaders (per game, with a games minimum so 10-game wonders don't count).
  const leaders = { pts: new Set<string>(), trb: new Set<string>(), ast: new Set<string>(), blk: new Set<string>(), stl: new Set<string>() };
  const bySeason = new Map<number, { pid: string; r: HistSeasonRow }[]>();
  for (const [k, r] of row) { const [p] = k.split('|'); (bySeason.get(r.season) ?? bySeason.set(r.season, []).get(r.season)!).push({ pid: p, r }); }
  for (const [season, list] of bySeason) {
    const maxG = Math.max(...list.map(x => x.r.stats.g ?? 0));
    const qualified = list.filter(x => (x.r.stats.g ?? 0) >= maxG * 0.7);
    for (const stat of ['pts', 'trb', 'ast', 'blk', 'stl'] as const) {
      let best: { pid: string; v: number } | null = null;
      for (const x of qualified) { const v = (x.r.stats[stat] ?? -1) / Math.max(1, x.r.stats.g ?? 1); if (x.r.stats[stat] != null && (!best || v > best.v)) best = { pid: x.pid, v }; }
      if (best) leaders[stat].add(key(best.pid, season));
    }
  }
  const franchiseCount = new Map([...franchises].map(([k, v]) => [k, v.size]));
  const oneFranchise = new Set([...franchises].filter(([p, v]) => v.size === 1 && (seasonsPlayed.get(p) ?? 0) >= 10).map(([p]) => p));
  const ctx: Ctx = {
    h, idOf, row, awards,
    allNba1: set(a => a.award === 'allLeague' && a.rank === 1), allNba: set(a => a.award === 'allLeague'),
    allDef1: set(a => a.award === 'allDefense' && a.rank === 1), allDef: set(a => a.award === 'allDefense'), allRookie: set(a => a.award === 'allRookie'),
    allStar: new Set(h.allStars.map(a => key(pid(a.player), a.season))), allStarPlayers: new Set(h.allStars.map(a => pid(a.player))), asgMvp: new Set(h.allStarMvp.map(a => key(pid(a.player), a.season))),
    champs, finalsMvp, ringCount, runnerUp, teamRec, leaders, franchiseCount, oneFranchise, seasonsPlayed,
  };
  ctxCache.set(h, ctx);
  return ctx;
}

// ---------------------------------------------------------------- the categories

type Test = (c: HuntCard, x: Ctx) => boolean;
interface Def extends Category { test: Test }

const won = (award: string): Test => (c, x) => x.awards.get(award)?.has(key(c.playerId, c.end)) ?? false;
const inSet = (pick: (x: Ctx) => Set<string>): Test => (c, x) => pick(x).has(key(c.playerId, c.end));
const player = (c: HuntCard, x: Ctx) => x.h.byId.get(c.playerId);
const per = (c: HuntCard, x: Ctx, stat: 'pts' | 'trb' | 'ast' | 'blk' | 'stl' | 'x3p' | 'mp') => { const r = x.row.get(key(c.playerId, c.end)); const g = r?.stats.g ?? 0; const v = r?.stats[stat]; return v == null || !g ? -1 : v / g; };
const pct = (c: HuntCard, x: Ctx, made: 'fg' | 'x3p' | 'ft', att: 'fga' | 'x3pa' | 'fta', min: number) => { const r = x.row.get(key(c.playerId, c.end)); const a = r?.stats[att] ?? 0; return a < min ? -1 : (r?.stats[made] ?? 0) / a; };
const teamRecord = (c: HuntCard, x: Ctx) => x.teamRec.get(`${c.team}|${c.end}`);
const decade = (from: number): Test => c => c.end - 1 >= from && c.end - 1 < from + 10;
const age = (c: HuntCard, x: Ctx) => x.row.get(key(c.playerId, c.end))?.age ?? null;

const AWARDS: Def[] = [
  { id: 'mvp', name: 'MVPs', blurb: 'Every MVP, at his MVP season', group: 'Awards', test: won('mvp') },
  { id: 'fmvp', name: 'Finals MVPs', blurb: 'At the season they won Finals MVP', group: 'Awards', test: inSet(x => x.finalsMvp) },
  { id: 'dpoy', name: 'Defensive Players of the Year', blurb: 'At their DPOY season', group: 'Awards', test: won('dpoy') },
  { id: 'roy', name: 'Rookies of the Year', blurb: 'At their rookie season', group: 'Awards', test: won('roy') },
  { id: 'smoy', name: 'Sixth Men of the Year', blurb: 'The best bench scorers ever', group: 'Awards', test: won('smoy') },
  { id: 'mip', name: 'Most Improved Players', blurb: 'At the season they broke out', group: 'Awards', test: won('mip') },
  { id: 'allnba1', name: 'All-NBA First Team', blurb: 'At a First Team season', group: 'Awards', test: inSet(x => x.allNba1) },
  { id: 'allnba', name: 'All-NBA', blurb: 'At an All-NBA season (any team)', group: 'Awards', test: inSet(x => x.allNba) },
  { id: 'alldef1', name: 'All-Defense First Team', blurb: 'Lockdown seasons only', group: 'Awards', test: inSet(x => x.allDef1) },
  { id: 'alldef', name: 'All-Defensive Team', blurb: 'At an All-Defense season', group: 'Awards', test: inSet(x => x.allDef) },
  { id: 'allrookie', name: 'All-Rookie Team', blurb: 'At their rookie season', group: 'Awards', test: inSet(x => x.allRookie) },
  { id: 'allstar', name: 'All-Stars', blurb: 'At an All-Star season', group: 'Awards', test: inSet(x => x.allStar) },
  { id: 'asgmvp', name: 'All-Star Game MVPs', blurb: 'At the season they won it', group: 'Awards', test: inSet(x => x.asgMvp) },
  { id: 'hof', name: 'Hall of Famers', blurb: 'Every Hall of Famer at his best', group: 'Awards', test: (c, x) => !!player(c, x)?.hallOfFame },
  { id: 'scoring', name: 'Scoring champions', blurb: 'At the season they led the league in points', group: 'Awards', test: inSet(x => x.leaders.pts) },
  { id: 'rebchamp', name: 'Rebounding champions', blurb: 'At the season they led the league in boards', group: 'Awards', test: inSet(x => x.leaders.trb) },
  { id: 'astchamp', name: 'Assist champions', blurb: 'At the season they led the league in assists', group: 'Awards', test: inSet(x => x.leaders.ast) },
  { id: 'blkchamp', name: 'Block champions', blurb: 'At the season they led the league in blocks', group: 'Awards', test: (c, x) => c.end >= 1974 && x.leaders.blk.has(key(c.playerId, c.end)) },
  { id: 'stlchamp', name: 'Steals champions', blurb: 'At the season they led the league in steals', group: 'Awards', test: (c, x) => c.end >= 1974 && x.leaders.stl.has(key(c.playerId, c.end)) },
  { id: 'nevers', name: 'Never an All-Star', blurb: '8+ seasons, never picked for one All-Star Game', group: 'Awards', test: (c, x) => !x.allStarPlayers.has(c.playerId) && (x.seasonsPlayed.get(c.playerId) ?? 0) >= 8 },
];

const TITLES: Def[] = [
  { id: 'champs', name: 'Champions', blurb: 'At a season they won the title', group: 'Titles', test: inSet(x => x.champs) },
  { id: 'rings3', name: 'Three rings or more', blurb: 'Dynasty guys, at a title season', group: 'Titles', test: (c, x) => (x.ringCount.get(c.playerId) ?? 0) >= 3 && x.champs.has(key(c.playerId, c.end)) },
  { id: 'onering', name: 'Exactly one ring', blurb: 'At their one title season', group: 'Titles', test: (c, x) => x.ringCount.get(c.playerId) === 1 && x.champs.has(key(c.playerId, c.end)) },
  { id: 'nering', name: 'Never won a ring', blurb: 'Ringless, 10+ seasons. Win it for them.', group: 'Titles', test: (c, x) => !x.ringCount.has(c.playerId) && (x.seasonsPlayed.get(c.playerId) ?? 0) >= 10 },
  { id: 'finalslosers', name: 'Lost in the Finals', blurb: 'At a season they lost the Finals', group: 'Titles', test: (c, x) => x.runnerUp.has(`${c.team}|${c.end}`) },
  { id: 'win60', name: '60-win teams', blurb: 'From a team that won 60 or more', group: 'Titles', test: (c, x) => (teamRecord(c, x)?.w ?? 0) >= 60 },
  { id: 'losing', name: 'Stuck on bad teams', blurb: 'At a season their team won under 30', group: 'Titles', test: (c, x) => { const r = teamRecord(c, x); return !!r && r.w / Math.max(1, r.w + r.l) < 0.366; } },
];

const ERAS: Def[] = [
  { id: 'd1950', name: '1950s players', blurb: 'At their best season of the 50s', group: 'Eras', test: c => c.end - 1 < 1960 },
  ...[1960, 1970, 1980, 1990, 2000, 2010].map(y => ({ id: `d${y}`, name: `${String(y).slice(2)}s players`, blurb: `At their best season of the ${y}s`, group: 'Eras' as const, test: decade(y) })),
  { id: 'd2020', name: '2020s players', blurb: 'Today\'s league, at its best', group: 'Eras', test: c => c.end - 1 >= 2020 },
  { id: 'threeless', name: 'Before the three', blurb: 'Seasons before the three-point line (1979-80)', group: 'Eras', test: c => c.end <= 1979 },
  { id: 'jordanera', name: 'The Jordan years', blurb: 'At a season between 1985 and 1998', group: 'Eras', test: c => c.end >= 1985 && c.end <= 1998 },
  { id: 'lebronera', name: 'The LeBron years', blurb: 'At a season since 2004', group: 'Eras', test: c => c.end >= 2004 },
  { id: 'abaish', name: 'The 70s merger years', blurb: 'At a season between 1974 and 1980', group: 'Eras', test: c => c.end >= 1974 && c.end <= 1980 },
];

const DRAFT: Def[] = [
  { id: 'no1', name: 'No. 1 picks', blurb: 'Every first pick at his best', group: 'Draft', test: (c, x) => player(c, x)?.draft?.pick === 1 },
  { id: 'top3', name: 'Top-3 picks', blurb: 'Drafted first, second or third', group: 'Draft', test: (c, x) => { const d = player(c, x)?.draft; return !!d?.pick && d.pick <= 3; } },
  { id: 'top10', name: 'Top-10 picks', blurb: 'Drafted in the top ten', group: 'Draft', test: (c, x) => { const d = player(c, x)?.draft; return !!d?.pick && d.pick <= 10; } },
  { id: 'lottery', name: 'Lottery picks (5-14)', blurb: 'The middle of the lottery', group: 'Draft', test: (c, x) => { const d = player(c, x)?.draft; return !!d?.pick && d.pick >= 5 && d.pick <= 14; } },
  { id: 'late1', name: 'Late first-rounders', blurb: 'Picks 15 to 30: the steals', group: 'Draft', test: (c, x) => { const d = player(c, x)?.draft; return d?.round === 1 && !!d.pick && d.pick >= 15; } },
  { id: 'round2', name: 'Second-round picks', blurb: 'Everyone passed on them once', group: 'Draft', test: (c, x) => player(c, x)?.draft?.round === 2 },
  { id: 'late', name: 'Drafted in round 3 or later', blurb: 'From the old long drafts', group: 'Draft', test: (c, x) => (player(c, x)?.draft?.round ?? 0) >= 3 },
  { id: 'undrafted', name: 'Undrafted', blurb: 'Nobody picked them. Since 1970.', group: 'Draft', test: (c, x) => { const p = player(c, x); return !!p && !p.draft && (p.firstSeason ?? 0) >= 1970; } },
  { id: 'd1984', name: 'The 1984 draft', blurb: 'Hakeem, Jordan, Barkley, Stockton...', group: 'Draft', test: (c, x) => player(c, x)?.draft?.year === 1984 },
  { id: 'd1996', name: 'The 1996 draft', blurb: 'Kobe, Iverson, Nash, Allen...', group: 'Draft', test: (c, x) => player(c, x)?.draft?.year === 1996 },
  { id: 'd2003', name: 'The 2003 draft', blurb: 'LeBron, Wade, Melo, Bosh...', group: 'Draft', test: (c, x) => player(c, x)?.draft?.year === 2003 },
  { id: 'd2009', name: 'The 2009 draft', blurb: 'Curry, Harden, Griffin, DeRozan...', group: 'Draft', test: (c, x) => player(c, x)?.draft?.year === 2009 },
  { id: 'd2011', name: 'The 2011 draft', blurb: 'Kawhi, Kyrie, Klay, Butler...', group: 'Draft', test: (c, x) => player(c, x)?.draft?.year === 2011 },
  { id: 'd1998', name: 'The 1998 draft', blurb: 'Dirk, Pierce, Carter, Kirilenko...', group: 'Draft', test: (c, x) => player(c, x)?.draft?.year === 1998 },
  { id: 'd1987', name: 'The 1987 draft', blurb: 'Robinson, Pippen, Miller, Kevin Johnson...', group: 'Draft', test: (c, x) => player(c, x)?.draft?.year === 1987 },
];

const COLLEGES = ['Kentucky', 'Duke', 'UCLA', 'UNC', 'Kansas', 'Indiana', 'Michigan', 'Arizona', 'Louisville', 'Michigan State', 'Villanova', 'Syracuse', 'Georgetown', 'UConn', 'Ohio State', 'LSU', 'Texas', 'Florida', 'Wake Forest', 'Georgia Tech', 'Notre Dame', 'Maryland'];
const COLLEGE: Def[] = [
  ...COLLEGES.map(n => ({ id: `col-${n.toLowerCase().replace(/\W+/g, '')}`, name: `${n} players`, blurb: `Everyone who went to ${n}`, group: 'College' as const, test: ((c, x) => player(c, x)?.college === n) as Test })),
  { id: 'nocollege', name: 'Skipped college', blurb: 'Straight from high school or overseas (since 1970)', group: 'College', test: (c, x) => { const p = player(c, x); return !!p && !p.college && (p.firstSeason ?? 0) >= 1970; } },
];

const BODY: Def[] = [
  { id: 'seven', name: '7-footers', blurb: 'Seven feet and up', group: 'Body', test: (c, x) => (player(c, x)?.heightIn ?? 0) >= 84 },
  { id: 'small', name: '6\'2" and under', blurb: 'Little guards, big games', group: 'Body', test: (c, x) => { const hgt = player(c, x)?.heightIn; return !!hgt && hgt <= 74; } },
  { id: 'pgs', name: 'Point guards', blurb: 'Only point guards. Who rebounds?', group: 'Body', test: c => c.pos === 'PG' },
  { id: 'centers', name: 'Centers', blurb: 'Only centers. Who brings it up?', group: 'Body', test: c => c.pos === 'C' },
  { id: 'wings', name: 'Wings', blurb: 'Shooting guards and small forwards', group: 'Body', test: c => c.pos === 'SG' || c.pos === 'SF' },
  { id: 'heavy', name: '260 pounds and up', blurb: 'The heavyweights', group: 'Body', test: (c, x) => (player(c, x)?.weightLb ?? 0) >= 260 },
  { id: 'teens', name: 'Teenagers', blurb: 'At a season they played at 19 or younger', group: 'Body', test: (c, x) => { const a = age(c, x); return a != null && a <= 19; } },
  { id: 'over35', name: '35 and older', blurb: 'At a season they played at 35+', group: 'Body', test: (c, x) => (age(c, x) ?? 0) >= 35 },
  { id: 'young', name: '22 and younger', blurb: 'At a season they played at 22 or younger', group: 'Body', test: (c, x) => { const a = age(c, x); return a != null && a <= 22; } },
];

const STATS: Def[] = [
  { id: 'p30', name: '30-point scorers', blurb: 'At a season they averaged 30+', group: 'Stats', test: (c, x) => per(c, x, 'pts') >= 30 },
  { id: 'p25', name: '25-point scorers', blurb: 'At a season they averaged 25+', group: 'Stats', test: (c, x) => per(c, x, 'pts') >= 25 },
  { id: 'p2010', name: '20 and 10', blurb: 'At a 20-point, 10-rebound season', group: 'Stats', test: (c, x) => per(c, x, 'pts') >= 20 && per(c, x, 'trb') >= 10 },
  { id: 'p2510', name: '25 and 10', blurb: 'At a 25-point, 10-rebound season', group: 'Stats', test: (c, x) => per(c, x, 'pts') >= 25 && per(c, x, 'trb') >= 10 },
  { id: 'p205', name: '20 points, 5 assists', blurb: 'At a 20-and-5 season', group: 'Stats', test: (c, x) => per(c, x, 'pts') >= 20 && per(c, x, 'ast') >= 5 },
  { id: 'a10', name: '10-assist passers', blurb: 'At a season they averaged 10+ assists', group: 'Stats', test: (c, x) => per(c, x, 'ast') >= 10 },
  { id: 'r13', name: '13-rebound boards men', blurb: 'At a season they averaged 13+ boards', group: 'Stats', test: (c, x) => per(c, x, 'trb') >= 13 },
  { id: 'b25', name: 'Shot blockers', blurb: 'At a season with 2.5+ blocks a game', group: 'Stats', test: (c, x) => c.end >= 1974 && per(c, x, 'blk') >= 2.5 },
  { id: 's2', name: 'Pickpockets', blurb: 'At a season with 2+ steals a game', group: 'Stats', test: (c, x) => c.end >= 1974 && per(c, x, 'stl') >= 2 },
  { id: 'threes', name: 'Volume three shooters', blurb: 'At a season with 2.5+ threes a game', group: 'Stats', test: (c, x) => per(c, x, 'x3p') >= 2.5 },
  { id: 'shooters', name: 'Sharpshooters', blurb: 'At a 40%+ three-point season (200+ tries)', group: 'Stats', test: (c, x) => pct(c, x, 'x3p', 'x3pa', 200) >= 0.4 },
  { id: 'ft90', name: '90% free throw shooters', blurb: 'At a 90% season (200+ tries)', group: 'Stats', test: (c, x) => pct(c, x, 'ft', 'fta', 200) >= 0.9 },
  { id: 'fg60', name: '60% field goal shooters', blurb: 'At a 60%+ season (400+ tries)', group: 'Stats', test: (c, x) => pct(c, x, 'fg', 'fga', 400) >= 0.6 },
  { id: 'brick', name: 'Bad free throw shooters', blurb: 'At a season under 60% from the line (200+ tries)', group: 'Stats', test: (c, x) => { const v = pct(c, x, 'ft', 'fta', 200); return v >= 0 && v < 0.6; } },
  { id: 'iron', name: 'Iron men', blurb: 'At a season of 40+ minutes a game', group: 'Stats', test: (c, x) => per(c, x, 'mp') >= 40 },
  { id: 'trip', name: 'Triple-double machines', blurb: 'At a season with 10+ triple-doubles', group: 'Stats', test: (c, x) => (x.row.get(key(c.playerId, c.end))?.stats.trp_dbl ?? 0) >= 10 },
  { id: 'role', name: 'Role players', blurb: 'At a season under 10 points a game', group: 'Stats', test: (c, x) => { const v = per(c, x, 'pts'); return v >= 0 && v < 10; } },
];

const CAREERS: Def[] = [
  { id: 'onefranchise', name: 'One-franchise careers', blurb: '10+ seasons, one team, never left', group: 'Careers', test: (c, x) => x.oneFranchise.has(c.playerId) },
  { id: 'journeymen', name: 'Journeymen', blurb: 'Played for 7 franchises or more', group: 'Careers', test: (c, x) => (x.franchiseCount.get(c.playerId) ?? 0) >= 7 },
  { id: 'long', name: '18-season careers', blurb: 'Played 18 seasons or more', group: 'Careers', test: (c, x) => (x.seasonsPlayed.get(c.playerId) ?? 0) >= 18 },
  { id: 'short', name: 'Short careers', blurb: '5 seasons or fewer', group: 'Careers', test: (c, x) => (x.seasonsPlayed.get(c.playerId) ?? 99) <= 5 },
];

const NAME_LAST = ['Johnson', 'Williams', 'Jones', 'Smith', 'Brown', 'Davis', 'Thomas', 'Robinson', 'Anderson', 'Miller'];
const NAME_FIRST = ['Michael', 'Kevin', 'Chris', 'Anthony', 'James', 'John', 'Larry', 'Tony', 'Mike', 'David'];
const NAMES: Def[] = [
  ...NAME_LAST.map(n => ({ id: `last-${n.toLowerCase()}`, name: `Named ${n}`, blurb: `Every ${n} in NBA history`, group: 'Names' as const, test: ((c: HuntCard) => c.name.split(' ').at(-1) === n) as Test })),
  ...NAME_FIRST.map(n => ({ id: `first-${n.toLowerCase()}`, name: `First name ${n}`, blurb: `Every ${n} in NBA history`, group: 'Names' as const, test: ((c: HuntCard) => c.name.split(' ')[0] === n) as Test })),
];

const NICKNAME: Record<string, string> = {
  ATL: 'Hawks', BOS: 'Celtics', BRK: 'Nets', CHI: 'Bulls', CHO: 'Hornets', CLE: 'Cavaliers', DAL: 'Mavericks', DEN: 'Nuggets', DET: 'Pistons', GSW: 'Warriors',
  HOU: 'Rockets', IND: 'Pacers', LAC: 'Clippers', LAL: 'Lakers', MEM: 'Grizzlies', MIA: 'Heat', MIL: 'Bucks', MIN: 'Timberwolves', NOP: 'Pelicans', NYK: 'Knicks',
  OKC: 'Thunder', ORL: 'Magic', PHI: '76ers', PHO: 'Suns', POR: 'Trail Blazers', SAC: 'Kings', SAS: 'Spurs', TOR: 'Raptors', UTA: 'Jazz', WAS: 'Wizards',
};
/** One per franchise still playing: its best players at their best season there. */
function teamDefs(h: NbaHistory): Def[] {
  const latest = Math.max(...h.teams.map(t => t.season));
  const active = h.teams.filter(t => t.season === latest && t.league === 'NBA');
  return active.map(t => ({ id: `team-${t.franchise ?? t.abbr}`, name: NICKNAME[t.abbr] ? `${t.name === 'LA' ? 'LA' : t.name} ${NICKNAME[t.abbr]}` : t.name, blurb: `Their best players ever, at their best year there`, group: 'Teams' as const, test: (c: HuntCard) => c.franchise === (t.franchise ?? t.abbr) }));
}

// ---------------------------------------------------------------- pools and tiers

const infoCache = new WeakMap<NbaHistory, CategoryInfo[]>();

/** Every category big enough to play, with its pool (each player once, at his best fitting season) and its tier. */
export function categories(h: NbaHistory): CategoryInfo[] {
  const hit = infoCache.get(h);
  if (hit) return hit;
  const x = context(h);
  const cards = cardPool(h).cards;
  const defs = [...AWARDS, ...TITLES, ...ERAS, ...teamDefs(h), ...DRAFT, ...COLLEGE, ...BODY, ...STATS, ...CAREERS, ...NAMES];
  const built: Omit<CategoryInfo, 'tier'>[] = [];
  for (const d of defs) {
    const best = new Map<string, HuntCard>();
    for (const c of cards) {
      if (!d.test(c, x)) continue;
      const cur = best.get(c.playerId);
      if (!cur || c.ovr > cur.ovr) best.set(c.playerId, c);
    }
    if (best.size < MIN_CATEGORY) continue;
    const pool = [...best.values()].sort((a, b) => b.ppg - a.ppg || b.ovr - a.ovr);
    built.push({ id: d.id, name: d.name, blurb: d.blurb, group: d.group, size: pool.length, pool });
  }
  // Tier by the average of the best ten: the top 15% are S, then A (25%), B (30%), C (20%) and D.
  const strength = (c: Omit<CategoryInfo, 'tier'>) => { const top = [...c.pool].sort((a, b) => b.ovr - a.ovr).slice(0, 10); return top.reduce((n, p) => n + p.ovr, 0) / top.length; };
  const ranked = [...built].sort((a, b) => strength(b) - strength(a));
  const tierAt = (i: number): Tier => { const q = i / ranked.length; return q < 0.15 ? 'S' : q < 0.4 ? 'A' : q < 0.7 ? 'B' : q < 0.9 ? 'C' : 'D'; };
  const tiers = new Map(ranked.map((c, i) => [c.id, tierAt(i)]));
  const out = built.map(c => ({ ...c, tier: tiers.get(c.id)! }));
  infoCache.set(h, out);
  return out;
}

export const categoryById = (h: NbaHistory, id: string) => categories(h).find(c => c.id === id);
