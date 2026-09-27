import type { League, AllStarWeekendRecord } from './league';
import type { AwardWinner } from './awards';
import type { PlayerSeason } from './types';
import { RNG } from './engine/rng';
import { currentAllStarWeekend } from './allStarVoting';

/*
 * All-Star Weekend you take part in.
 *  - Captains draft: the leading vote-getter of each side captains a team and they pick the rest of the All-Stars,
 *    starters first, then reserves. You draft for one captain; the other captain favours his own teammates.
 *  - Three-Point Contest: eight shooters, five racks each with one all-money-ball rack of their choosing; the top
 *    three shoot again in the final. Every ball is recorded so the page can show it rack by rack.
 *  - Slam Dunk Contest: four dunkers, two dunks each in the first round, the best two meet in the final. Each dunk
 *    is a choice between a safe dunk, a bold one or a signature one: harder dunks score higher when they go down.
 * Everything is deterministic from the league seed, so a reload shows the same weekend.
 */

// ---------------------------------------------------------------- captains draft

export interface CaptainsDraft {
  captainA: string; captainB: string;
  teamA: string[]; teamB: string[];
  /** Which captain you pick for. */
  userSide: 'A' | 'B';
  /** Draft order so far (player ids, alternating A, B from the first pick). */
  picks: string[];
  done: boolean;
}

const findSeason = (league: League, id: string): { season: PlayerSeason; teamId: string } | null => {
  for (const t of league.teams) { const s = t.seasons.find(x => x.playerId === id); if (s) return { season: s, teamId: t.teamId }; }
  return null;
};

/** The two captains: each conference's top vote-getter, or the top two when there are no conferences. */
export function pickCaptains(selected: AwardWinner[]): [string, string] | null {
  if (selected.length < 10) return null;
  const starters = selected.filter(s => s.starter ?? true);
  const east = starters.find(s => s.conference === 'east'), west = starters.find(s => s.conference === 'west');
  if (east && west) return east.score >= west.score ? [east.playerId, west.playerId] : [west.playerId, east.playerId];
  return [selected[0].playerId, selected[1].playerId];
}

/** Opens the captains draft. You pick for your own player's captain if he is one, otherwise for the top vote-getter. */
export function startCaptainsDraft(league: League, userTeamId: string | null): League {
  const record = currentAllStarWeekend(league);
  const selected = record.voting?.selected ?? [];
  const captains = pickCaptains(selected);
  if (!captains || record.draft) return league;
  const [a, b] = captains;
  const userSide = userTeamId && findSeason(league, b)?.teamId === userTeamId && findSeason(league, a)?.teamId !== userTeamId ? 'B' : 'A';
  const draft: CaptainsDraft = { captainA: a, captainB: b, teamA: [a], teamB: [b], userSide, picks: [], done: false };
  return { ...league, allStarWeekend: { ...record, format: 'captains', draft: advanceAI(league, record, draft) } };
}

/** Whose pick it is (A picks first, then they alternate). */
export const onTheClock = (d: CaptainsDraft): 'A' | 'B' => (d.picks.length % 2 === 0 ? 'A' : 'B');

/** Players still to be picked: starters go first, then reserves. */
export function draftPool(record: AllStarWeekendRecord, d: CaptainsDraft): AwardWinner[] {
  const taken = new Set([...d.teamA, ...d.teamB]);
  const left = (record.voting?.selected ?? []).filter(s => !taken.has(s.playerId));
  const starters = left.filter(s => s.starter);
  return starters.length ? starters : left;
}

function aiChoice(league: League, record: AllStarWeekendRecord, d: CaptainsDraft): string | null {
  const pool = draftPool(record, d);
  if (!pool.length) return null;
  const captain = onTheClock(d) === 'A' ? d.captainA : d.captainB;
  const captainTeam = findSeason(league, captain)?.teamId;
  // Captains take their own teammates first, then the best available by the vote.
  return [...pool].sort((x, y) => (Number(y.teamId === captainTeam) - Number(x.teamId === captainTeam)) || y.score - x.score)[0].playerId;
}

function place(d: CaptainsDraft, id: string): CaptainsDraft {
  const side = onTheClock(d);
  return { ...d, picks: [...d.picks, id], teamA: side === 'A' ? [...d.teamA, id] : d.teamA, teamB: side === 'B' ? [...d.teamB, id] : d.teamB };
}

function advanceAI(league: League, record: AllStarWeekendRecord, d: CaptainsDraft): CaptainsDraft {
  let draft = d;
  while (draftPool(record, draft).length > 0 && onTheClock(draft) !== draft.userSide) {
    const id = aiChoice(league, record, draft);
    if (!id) break;
    draft = place(draft, id);
  }
  return { ...draft, done: draftPool(record, draft).length === 0 };
}

/** You make a pick; the other captain answers until it's your turn again. */
export function draftAllStar(league: League, playerId: string): League {
  const record = currentAllStarWeekend(league);
  const d = record.draft;
  if (!d || d.done || onTheClock(d) !== d.userSide || !draftPool(record, d).some(s => s.playerId === playerId)) return league;
  return { ...league, allStarWeekend: { ...record, draft: advanceAI(league, record, place(d, playerId)) } };
}

/** Lets both captains finish the draft (your remaining picks go by the vote). */
export function autoDraft(league: League): League {
  const record = currentAllStarWeekend(league);
  let d = record.draft;
  if (!d) return league;
  while (!d.done) {
    const pool = draftPool(record, d);
    if (!pool.length) { d = { ...d, done: true }; break; }
    d = onTheClock(d) === d.userSide ? place(d, [...pool].sort((x, y) => y.score - x.score)[0].playerId) : advanceAI(league, record, d);
    d = { ...d, done: draftPool(record, d).length === 0 };
  }
  return { ...league, allStarWeekend: { ...record, draft: d } };
}

/** Team names for a finished captains draft. */
export const captainTeamName = (captain: string) => `Team ${captain.split(' ').slice(-1)[0]}`;

// ---------------------------------------------------------------- three-point contest

export interface ThreeRound { shooter: string; moneyRack: number; balls: boolean[]; score: number }
export interface ThreePointShow { entrants: string[]; first: ThreeRound[]; final: ThreeRound[]; winner: string }

const rackValue = (ball: number, rack: number, moneyRack: number) => (rack === moneyRack || ball === 4 ? 2 : 1);

function shootRound(p: PlayerSeason, moneyRack: number, rng: RNG, pressure: number): ThreeRound {
  const skill = p.attributes.offense.threePoint * 0.7 + p.attributes.offense.catchAndShoot * 0.3;
  const chance = Math.max(0.2, Math.min(0.85, 0.2 + skill * 0.0065 - pressure));
  const balls: boolean[] = [];
  let score = 0;
  for (let rack = 0; rack < 5; rack++) for (let ball = 0; ball < 5; ball++) {
    const tired = rack >= 3 ? 0.03 : 0; // the last racks are the hardest
    const made = rng.next() < chance - tired;
    balls.push(made);
    if (made) score += rackValue(ball, rack, moneyRack);
  }
  return { shooter: p.playerId, moneyRack, balls, score };
}

/** A shooter's best rack for the money balls: corners suit catch-and-shoot players, the top of the key pull-up shooters. */
const aiMoneyRack = (p: PlayerSeason) => (p.attributes.offense.catchAndShoot >= p.attributes.offense.pullUp3 ? 0 : 2);

/** Runs the whole contest. `moneyRacks` holds your shooters' choices (rack 0–4); others choose for themselves. */
export function runThreePointShow(entrants: PlayerSeason[], seed: number, moneyRacks: Record<string, number> = {}): ThreePointShow {
  const rng = new RNG(seed);
  const rack = (p: PlayerSeason) => moneyRacks[p.playerId] ?? aiMoneyRack(p);
  const first = entrants.map(p => shootRound(p, rack(p), rng, 0));
  const finalists = [...first].sort((a, b) => b.score - a.score || a.shooter.localeCompare(b.shooter)).slice(0, 3).map(r => entrants.find(p => p.playerId === r.shooter)!);
  const final = finalists.map(p => shootRound(p, rack(p), rng, 0.01));
  const winner = [...final].sort((a, b) => b.score - a.score || first.find(r => r.shooter === b.shooter)!.score - first.find(r => r.shooter === a.shooter)!.score)[0]?.shooter ?? '';
  return { entrants: entrants.map(p => p.playerId), first, final, winner };
}

/** The old summary shape (order, scores, winner) for anything that reads results. */
export function threePointSummary(show: ThreePointShow): { order: string[]; scores: Record<string, number>; winner: string } {
  const scores: Record<string, number> = {};
  for (const r of show.first) scores[r.shooter] = r.score;
  for (const r of show.final) scores[r.shooter] = Math.max(scores[r.shooter] ?? 0, r.score);
  return { order: show.entrants, scores, winner: show.winner };
}

// ---------------------------------------------------------------- slam dunk contest

export type DunkRisk = 'safe' | 'bold' | 'signature';
export interface DunkAttempt { dunker: string; risk: DunkRisk; name: string; made: boolean; score: number }
export interface DunkShow { entrants: string[]; first: DunkAttempt[]; final: DunkAttempt[]; finalists: string[]; winner: string | null; stage: 'first' | 'final' | 'done' }

const DUNKS: Record<DunkRisk, string[]> = {
  safe: ['two-hand power slam', 'one-hand tomahawk', 'reverse two-hander', 'alley-oop off the glass'],
  bold: ['360 windmill', 'between-the-legs', 'cradle rock', 'double-pump reverse'],
  signature: ['free-throw-line takeoff', 'over a teammate, between the legs', '360 between-the-legs', 'under-both-legs "Eastbay"'],
};
export const DUNK_RISK: Record<DunkRisk, { label: string; detail: string }> = {
  safe: { label: 'Safe', detail: 'Goes down almost every time; judges give 38–45.' },
  bold: { label: 'Bold', detail: 'A real risk of a miss; 43–49 when it lands.' },
  signature: { label: 'Signature', detail: 'Hard to land; 47–50 when it does.' },
};

const hops = (p: PlayerSeason) => (p.attributes.physical.vertical * 0.45 + p.attributes.physical.agility * 0.25 + p.attributes.offense.finishing * 0.3) / 100;

function attempt(p: PlayerSeason, risk: DunkRisk, rng: RNG): DunkAttempt {
  const ability = hops(p);
  const make = { safe: 0.9 + ability * 0.08, bold: 0.45 + ability * 0.4, signature: 0.15 + ability * 0.5 }[risk];
  const [lo, hi] = { safe: [38, 45], bold: [43, 49], signature: [47, 50] }[risk];
  const name = DUNKS[risk][Math.floor(rng.next() * DUNKS[risk].length)];
  const made = rng.next() < Math.min(0.98, make);
  const score = made ? Math.round(lo + (hi - lo) * Math.min(1, ability * 0.6 + rng.next() * 0.5)) : 28 + Math.floor(rng.next() * 6);
  return { dunker: p.playerId, risk, name, made, score };
}

/** An AI dunker's call: go big when trailing or gifted, play safe otherwise. */
function aiRisk(p: PlayerSeason, behind: number): DunkRisk {
  const a = hops(p);
  if (behind > 6 || a > 0.85) return 'signature';
  if (behind > 0 || a > 0.7) return 'bold';
  return 'safe';
}

const totalOf = (list: DunkAttempt[], id: string) => list.filter(d => d.dunker === id).reduce((n, d) => n + d.score, 0);

export function startDunkShow(entrants: PlayerSeason[]): DunkShow {
  return { entrants: entrants.map(p => p.playerId), first: [], final: [], finalists: [], winner: null, stage: 'first' };
}

/** Whose dunk is next in the show, or null when it is over. */
export function nextDunker(show: DunkShow): string | null {
  if (show.stage === 'done') return null;
  const field = show.stage === 'first' ? show.entrants : show.finalists;
  const list = show.stage === 'first' ? show.first : show.final;
  return list.length >= field.length * 2 ? null : field[list.length % field.length];
}

/**
 * Plays the next dunk. `risk` is used when the dunker is one of yours (`userDunkers`); everyone else decides for
 * himself. The rng is re-seeded from the dunk's position so the show is the same however it is stepped through.
 */
export function playNextDunk(league: League, show: DunkShow, seed: number, risk?: DunkRisk, userDunkers: Set<string> = new Set()): DunkShow {
  const id = nextDunker(show);
  if (!id) return show;
  const p = findSeason(league, id)?.season;
  if (!p) return show;
  const list = show.stage === 'first' ? show.first : show.final;
  const rng = new RNG(seed + (show.stage === 'first' ? 0 : 500) + list.length * 31);
  const field = show.stage === 'first' ? show.entrants : show.finalists;
  const leader = Math.max(0, ...field.map(f => totalOf(list, f)));
  const choice = userDunkers.has(id) && risk ? risk : aiRisk(p, leader - totalOf(list, id));
  const next = [...list, attempt(p, choice, rng)];
  let out: DunkShow = show.stage === 'first' ? { ...show, first: next } : { ...show, final: next };
  if (next.length >= field.length * 2) {
    // Ties go to the better first round, then the better last dunk (the judges remember the finish).
    const lastDunk = (id: string) => [...next].reverse().find(d => d.dunker === id)?.score ?? 0;
    const ranked = [...field].sort((a, b) => totalOf(next, b) - totalOf(next, a) || (show.stage === 'final' ? totalOf(show.first, b) - totalOf(show.first, a) : 0) || lastDunk(b) - lastDunk(a) || a.localeCompare(b));
    out = show.stage === 'first' ? { ...out, stage: 'final', finalists: ranked.slice(0, 2) } : { ...out, stage: 'done', winner: ranked[0] };
  }
  return out;
}

/** Plays the rest of the show with everyone deciding for himself. */
export function finishDunkShow(league: League, show: DunkShow, seed: number): DunkShow {
  let s = show;
  for (let i = 0; i < 40 && s.stage !== 'done'; i++) { const n = playNextDunk(league, s, seed); if (n === s) break; s = n; }
  return s;
}

export function dunkSummary(show: DunkShow): { order: string[]; scores: Record<string, number>; winner: string } {
  const scores: Record<string, number> = {};
  for (const id of show.entrants) scores[id] = Math.max(totalOf(show.first, id), totalOf(show.final, id));
  return { order: show.entrants, scores, winner: show.winner ?? '' };
}

export const dunkTotal = totalOf;
