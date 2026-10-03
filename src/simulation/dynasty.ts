import type { League, FranchiseHistoryRecord } from './league';
import { newOffice, type LeagueOfficeEvent } from './ownerBox';
import { RNG } from './engine/rng';

/*
 * Dynasty Mode: one league meant to run for 50 seasons and more. A dynasty league switches on the living world:
 *  - the league office (relocations and expansion bids, see ownerBox.ts);
 *  - more sons of retired stars in the draft (family.ts reads `league.dynasty`);
 *  - AI owners who sell a struggling team to a new owner, with a new outlook;
 *  - a History Book that writes itself from the archive, one chapter per decade.
 * The history book is derived; the only new stored state is `league.dynasty` (owners and when the dynasty began).
 */

export interface DynastyOwner { name: string; since: string }
export interface DynastyState { startSeason: string; owners: Record<string, DynastyOwner> }

const FIRST = ['Theo', 'Nadia', 'Marcus', 'Priya', 'Graham', 'Lena', 'Omar', 'Rosa', 'Declan', 'Imani', 'Wes', 'Carla', 'Julian', 'Tess', 'Andre', 'Maya', 'Victor', 'Hana', 'Reggie', 'Celine'];
const LAST = ['Ashford', 'Okafor', 'Lindqvist', 'Barrera', 'Whitfield', 'Nakamura', 'Coleman', 'Sterling', 'Haddad', 'Morrow', 'Quinlan', 'Delacroix', 'Beckett', 'Ferro', 'Ingram', 'Vasquez', 'Holloway', 'Mbeki', 'Castellano', 'Pryce'];
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const ownerName = (seed: string) => `${FIRST[hash(`${seed}|f`) % FIRST.length]} ${LAST[hash(`${seed}|l`) % LAST.length]}`;

export const isDynasty = (league: League) => !!league.dynasty;

/** Turns a new league into a dynasty: every team gets an owner, and the league office opens. */
export function startDynasty(league: League): League {
  const season = league.season ?? '';
  const owners: Record<string, DynastyOwner> = {};
  for (const t of league.teams) owners[t.teamId] = { name: ownerName(`${t.teamId}|${season}`), since: season };
  return { ...league, dynasty: { startSeason: season, owners }, leagueOffice: league.leagueOffice ?? newOffice(league) };
}

/** Losing seasons in a row for a team, newest first, from the archive. */
function losingStreak(history: FranchiseHistoryRecord[], teamId: string): number {
  let n = 0;
  for (const rec of [...history].reverse()) {
    const ts = rec.teamSeasons?.find(t => t.teamId === teamId);
    if (!ts || ts.wins >= ts.losses) break;
    n++;
  }
  return n;
}

/**
 * The end of a dynasty season: maybe one AI owner sells. A team with four or more losing seasons in a row is the
 * likeliest to be sold; any team can be (owners retire too). Never your team.
 */
export function dynastySeasonEnd(league: League, previousSeason: string, userTeamId?: string | null): League {
  const d = league.dynasty;
  if (!d) return league;
  const rng = new RNG(hash(`${previousSeason}|dynasty-owners`));
  const owners = { ...d.owners };
  for (const t of league.teams) if (!owners[t.teamId]) owners[t.teamId] = { name: ownerName(`${t.teamId}|${previousSeason}`), since: previousSeason };
  const history = league.franchiseHistory ?? [];
  const candidates = league.teams.filter(t => t.teamId !== userTeamId && t.teamId !== league.owner?.teamId)
    .map(t => ({ t, odds: losingStreak(history, t.teamId) >= 4 ? 0.35 : 0.03 }));
  const events: LeagueOfficeEvent[] = [];
  for (const c of candidates) {
    if (events.length || !rng.chance(c.odds)) continue;
    const old = owners[c.t.teamId];
    const buyer = ownerName(`${c.t.teamId}|${previousSeason}|buyer`);
    if (buyer === old.name) continue;
    owners[c.t.teamId] = { name: buyer, since: league.season ?? previousSeason };
    events.push({ season: league.season ?? previousSeason, kind: 'sale', teamId: c.t.teamId, text: `${old.name} sells the ${c.t.name} after ${seasonsBetween(old.since, previousSeason)} seasons. ${buyer} is the new owner and promises a fresh start.` });
  }
  const office = league.leagueOffice ?? newOffice(league);
  return { ...league, dynasty: { ...d, owners }, leagueOffice: events.length ? { ...office, events: [...office.events, ...events].slice(-60) } : office };
}
const seasonsBetween = (from: string, to: string) => Math.max(1, parseInt(to, 10) - parseInt(from, 10) + 1 || 1);

// ---------------------------------------------------------------- the history book

export interface HistoryChapter {
  title: string; from: string; to: string;
  champions: { season: string; team: string }[];
  /** Teams with two or more titles in the chapter. */
  dynasties: { team: string; titles: number }[];
  mvps: { player: string; times: number }[];
  bestTeam?: { season: string; team: string; wins: number; losses: number };
  moves: string[];
  sons: string[];
  story: string[];
}

const decadeOf = (season: string) => Math.floor(parseInt(season, 10) / 10) * 10;

/** The league's story in chapters of ten seasons, written from the archive (simulated seasons only). */
export function historyBook(league: League): HistoryChapter[] {
  const recs = (league.franchiseHistory ?? []).filter(r => !r.imported && /^\d{4}/.test(r.season));
  const events = league.leagueOffice?.events ?? [];
  const sonsBySeason = legacySons(league);
  const byDecade = new Map<number, FranchiseHistoryRecord[]>();
  for (const r of recs) { const k = decadeOf(r.season); byDecade.set(k, [...(byDecade.get(k) ?? []), r]); }
  return [...byDecade.entries()].sort((a, b) => a[0] - b[0]).map(([decade, list]) => {
    const champions = list.filter(r => r.championTeamName).map(r => ({ season: r.season, team: r.championTeamName! }));
    const titles = new Map<string, number>();
    for (const c of champions) titles.set(c.team, (titles.get(c.team) ?? 0) + 1);
    const dynasties = [...titles.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).map(([team, n]) => ({ team, titles: n }));
    const mvpCount = new Map<string, number>();
    for (const r of list) if (r.mvpPlayerId) mvpCount.set(r.mvpPlayerId, (mvpCount.get(r.mvpPlayerId) ?? 0) + 1);
    const mvps = [...mvpCount.entries()].sort((a, b) => b[1] - a[1]).map(([player, times]) => ({ player, times }));
    let bestTeam: HistoryChapter['bestTeam'];
    for (const r of list) for (const t of r.teamSeasons ?? []) if (!bestTeam || t.wins > bestTeam.wins) bestTeam = { season: r.season, team: t.teamName, wins: t.wins, losses: t.losses };
    const seasons = new Set(list.map(r => r.season.slice(0, 4)));
    const moves = events.filter(e => (e.kind === 'relocation' || e.kind === 'expansion' || e.kind === 'sale') && seasons.has(e.season.slice(0, 4))).map(e => e.text);
    const sons = [...seasons].flatMap(s => sonsBySeason.get(s) ?? []);
    const from = list[0].season, to = list[list.length - 1].season;
    const story: string[] = [];
    if (dynasties[0]) story.push(`The ${decade}s belonged to the ${dynasties[0].team}: ${dynasties[0].titles} titles in ${list.length} seasons.`);
    else if (champions.length > 1) story.push(`No one ruled the ${decade}s: ${new Set(champions.map(c => c.team)).size} different champions in ${champions.length} seasons.`);
    if (mvps[0] && mvps[0].times >= 2) story.push(`${mvps[0].player} was the face of the league with ${mvps[0].times} MVP awards.`);
    if (bestTeam) story.push(`The best record: the ${bestTeam.season} ${bestTeam.team} at ${bestTeam.wins}-${bestTeam.losses}.`);
    if (moves.length) story.push(`${moves.length} franchise ${moves.length === 1 ? 'change' : 'changes'} off the court: moves, new teams and new owners.`);
    if (sons.length) story.push(`${sons.length} son${sons.length === 1 ? '' : 's'} of former players came into the league.`);
    return { title: `The ${decade}s`, from, to, champions, dynasties, mvps: mvps.slice(0, 5), bestTeam, moves, sons, story };
  });
}

/** Sons of retired players now in the league, by the draft year they arrived (from their family links). */
function legacySons(league: League): Map<string, string[]> {
  const retired = new Set((league.retiredPlayers ?? []).map(r => r.playerId));
  const out = new Map<string, string[]>();
  for (const t of league.teams) for (const p of t.seasons) {
    const dad = p.family?.find(f => f.relation === 'father' && retired.has(f.playerId));
    if (!dad) continue;
    const year = String(parseInt(p.draftYear ?? '', 10) || parseInt(league.season ?? '', 10));
    out.set(year, [...(out.get(year) ?? []), `${p.playerId} (son of ${dad.playerId})`]);
  }
  return out;
}
